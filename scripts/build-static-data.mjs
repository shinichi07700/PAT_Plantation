import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'artifacts/executive-report/public/data');
const outFile = path.resolve(outDir, 'report.json');

const SHEET_ID = process.env.PLANTATION_SHEET_ID || '1b-RY5WAl2I68iflXML9JHt70hY9nMhdYbbs0pgpfAVQ';
const API_KEY = process.env.GOOGLE_API_KEY;

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

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  if (!API_KEY) {
    console.log('[build-static-data] No GOOGLE_API_KEY environment variable provided.');
    console.log('[build-static-data] Skipping static Google Sheet fetch.');
    return;
  }

  console.log(`[build-static-data] Fetching metadata for sheet ${SHEET_ID}...`);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
  const metaUrl = `${base}?fields=properties.title,sheets.properties&key=${encodeURIComponent(API_KEY)}`;
  
  let metaRes;
  try {
    metaRes = await fetch(metaUrl);
  } catch (netErr) {
    throw new Error(`Network failure connecting to Google Sheets API: ${netErr.message}`);
  }

  if (!metaRes.ok) {
    const errText = await metaRes.text().catch(() => '');
    if (metaRes.status === 403 || metaRes.status === 401) {
      console.error('\n================================================================');
      console.error('GOOGLE SHEETS PERMISSION ERROR (' + metaRes.status + ')');
      console.error('An API Key can ONLY access sheets that are shared with link access.');
      console.error('Please open your Google Sheet:');
      console.error(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
      console.error('Click "Share" (top right) -> Under "General access" -> change from "Restricted" to "Anyone with the link can view".');
      console.error('================================================================\n');
    }
    throw new Error(`Google Sheets metadata request failed (${metaRes.status}): ${errText}`);
  }

  const meta = await metaRes.json();
  const table = meta.sheets?.find(s => s.properties.sheetId === 0)?.properties;
  if (!table) throw new Error('Tab gid 0 not found in sheet metadata.');

  const size = table.gridProperties?.rowCount || 1000;
  console.log(`[build-static-data] Fetching values for tab "${table.title}" (up to ${size} rows)...`);
  const range = `'${table.title.replace(/'/g, "''")}'!A1:L${size}`;
  const dataUrl = `${base}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(API_KEY)}`;
  const dataRes = await fetch(dataUrl);
  if (!dataRes.ok) {
    const errText = await dataRes.text().catch(() => '');
    throw new Error(`Google Sheets values request failed (${dataRes.status}): ${errText}`);
  }

  const data = await dataRes.json();
  const payload = buildData(data.values ?? [], meta.properties.title, new Date().toISOString());

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[build-static-data] Successfully generated ${outFile} (${payload.visits.length} visits recorded).`);
}

main().catch(err => {
  console.error('[build-static-data] Error:', err.message);
  // Write an explicit error payload so the frontend can display the reason rather than a blank 404
  const errorPayload = {
    visits: [],
    sourceTitle: 'Plantation Report (Source Restricted)',
    fetchedAt: new Date().toISOString(),
    today: today(),
    timezone: 'Asia/Jakarta',
    mode: 'snapshot',
    syncError: `Google Sheets access error: ${err.message}. Ensure the sheet General Access is set to 'Anyone with the link can view'.`,
    coverageStart: '',
    coverageEnd: '',
    excludedRows: 0,
  };
  fs.writeFileSync(outFile, JSON.stringify(errorPayload, null, 2), 'utf-8');
  console.log('[build-static-data] Wrote error payload to report.json so the dashboard can display diagnostic feedback.');
});
