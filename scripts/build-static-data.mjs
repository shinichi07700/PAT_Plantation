import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'artifacts/executive-report/public/data');
const outFile = path.resolve(outDir, 'report.json');

const SHEET_ID = process.env.PLANTATION_SHEET_ID || '1b-RY5WAl2I68iflXML9JHt70hY9nMhdYbbs0pgpfAVQ';
const API_KEY = process.env.GOOGLE_API_KEY;
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const CREDENTIALS_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const FIELDS = [
  'id_trans', 'date_activity', 'sales_name', 'pt_name', 'pt_pic', 'commodity',
  'activity_type', 'meeting_result', 'product_list', 'next_agenda', 'next_date', 'detail_loc'
];

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.length > 1 || currentRow[0] !== '') rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows;
}

function buildData(values, title, fetchedAt) {
  const header = values[0] ?? [];
  const indexes = FIELDS.map(key => header.indexOf(key));
  if (indexes.some(index => index < 0)) throw new Error('Sheet columns changed: required visit fields are missing.');
  let excludedRows = 0;
  const visits = [];
  values.slice(1).forEach((row, i) => {
    if (!row.some(cell => String(cell).trim())) return;
    const v = indexes.map(index => String(row[index] ?? '').trim());
    if (!calendarDate(v[1])) { excludedRows++; return; }
    visits.push({
      id: v[0] || `source-row-${i + 2}`, date: v[1], salesName: v[2], company: v[3],
      contact: v[4], commodity: v[5], activityType: v[6], result: v[7], products: v[8],
      nextAgenda: v[9], nextDate: calendarDate(v[10]) ? v[10] : '',
      location: v[11], sourceRow: i + 2,
    });
  });
  visits.sort((a, b) => b.date.localeCompare(a.date) || b.sourceRow - a.sourceRow);
  return {
    visits, sourceTitle: title, fetchedAt, today: today(), timezone: 'Asia/Jakarta',
    mode: 'live', syncError: null, coverageStart: visits.at(-1)?.date ?? '',
    coverageEnd: visits[0]?.date ?? '', excludedRows,
  };
}

async function getAccessTokenFromServiceAccount(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${b64(header)}.${b64(claim)}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  sign.end();
  const signature = sign.sign(creds.private_key, 'base64url');
  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

function resolveServiceAccountCreds() {
  if (SERVICE_ACCOUNT_KEY) {
    try {
      if (fs.existsSync(SERVICE_ACCOUNT_KEY)) {
        return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY, 'utf-8'));
      }
      return JSON.parse(SERVICE_ACCOUNT_KEY);
    } catch (e) {
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: ${e.message}`);
    }
  }
  if (CREDENTIALS_FILE && fs.existsSync(CREDENTIALS_FILE)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
  }
  return null;
}

async function fetchFromCsv() {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
  const res = await fetch(csvUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Google Sheets CSV export failed (${res.status}): ${res.statusText}`);
  }
  const text = await res.text();
  const rows = parseCsv(text);
  if (!rows || rows.length < 2) {
    throw new Error('CSV export returned insufficient data.');
  }
  return buildData(rows, 'Plantation Report', new Date().toISOString());
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const creds = resolveServiceAccountCreds();
  let bearerToken = process.env.GOOGLE_ACCESS_TOKEN;

  if (creds) {
    console.log(`[build-static-data] Authenticating as service account: ${creds.client_email}...`);
    bearerToken = await getAccessTokenFromServiceAccount(creds);
    console.log('[build-static-data] Service account access token obtained.');
  }

  // 1. If Service Account or API Key is available, try Google Sheets API v4
  if (bearerToken || API_KEY) {
    try {
      console.log(`[build-static-data] Fetching via Google Sheets API v4 for sheet ${SHEET_ID}...`);
      const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
      const headers = {};
      if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`;
      }

      const queryParams = new URLSearchParams();
      if (API_KEY && !bearerToken) {
        queryParams.set('key', API_KEY);
      }

      const metaQuery = new URLSearchParams(queryParams);
      metaQuery.set('fields', 'properties.title,sheets.properties');
      const metaUrl = `${base}?${metaQuery.toString()}`;

      const metaRes = await fetch(metaUrl, { headers });
      if (!metaRes.ok) {
        const errText = await metaRes.text().catch(() => '');
        throw new Error(`Google Sheets metadata request failed (${metaRes.status}): ${errText}`);
      }

      const meta = await metaRes.json();
      const table = meta.sheets?.find(s => s.properties.sheetId === 0)?.properties;
      if (!table) throw new Error('Tab gid 0 not found in sheet metadata.');

      const size = table.gridProperties?.rowCount || 2000;
      console.log(`[build-static-data] Fetching values for tab "${table.title}" (up to ${size} rows)...`);
      const range = `'${table.title.replace(/'/g, "''")}'!A1:L${size}`;
      const dataUrl = `${base}/values/${encodeURIComponent(range)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const dataRes = await fetch(dataUrl, { headers });
      if (!dataRes.ok) {
        const errText = await dataRes.text().catch(() => '');
        throw new Error(`Google Sheets values request failed (${dataRes.status}): ${errText}`);
      }

      const data = await dataRes.json();
      const payload = buildData(data.values ?? [], meta.properties.title, new Date().toISOString());

      fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');
      console.log(`[build-static-data] Successfully generated ${outFile} (${payload.visits.length} visits recorded).`);
      return;
    } catch (apiErr) {
      console.warn(`[build-static-data] Google Sheets API v4 attempt failed: ${apiErr.message}`);
      console.log('[build-static-data] Falling back to direct CSV export...');
    }
  }

  // 2. Direct CSV export fallback
  const payload = await fetchFromCsv();
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[build-static-data] Successfully generated ${outFile} via CSV export (${payload.visits.length} visits recorded).`);
}

main().catch(err => {
  console.error('[build-static-data] Error:', err.message);
  const errorPayload = {
    visits: [],
    sourceTitle: 'Plantation Report (Source Restricted)',
    fetchedAt: new Date().toISOString(),
    today: today(),
    timezone: 'Asia/Jakarta',
    mode: 'snapshot',
    syncError: `Google Sheets access error: ${err.message}`,
    coverageStart: '',
    coverageEnd: '',
    excludedRows: 0,
  };
  fs.writeFileSync(outFile, JSON.stringify(errorPayload, null, 2), 'utf-8');
  console.log('[build-static-data] Wrote error payload to report.json.');
});
