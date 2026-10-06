import { db, reportCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetReportDataResponse, type ReportData, type Visit } from "@workspace/api-zod";
import { logger } from "./logger";

const DEFAULT_SHEET_ID = "1b-RY5WAl2I68iflXML9JHt70hY9nMhdYbbs0pgpfAVQ";
const SHEET_ID = process.env.PLANTATION_SHEET_ID || DEFAULT_SHEET_ID;
const CACHE_KEY = "plantation-visits";
const TTL = 5 * 60 * 1000;
const FIELDS = ["id_trans", "date_activity", "sales_name", "pt_name", "pt_pic", "commodity",
  "activity_type", "meeting_result", "product_list", "next_agenda", "next_date", "detail_loc"];

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function buildData(values: string[][], title: string, fetchedAt: string): ReportData {
  const header = values[0] ?? [];
  const indexes = FIELDS.map(key => header.indexOf(key));
  if (indexes.some(index => index < 0)) throw new Error("Sheet columns changed: required visit fields are missing.");
  let excludedRows = 0;
  const visits: Visit[] = [];
  values.slice(1).forEach((row, i) => {
    if (!row.some(cell => String(cell).trim())) return;
    const v = indexes.map(index => String(row[index] ?? "").trim());
    if (!calendarDate(v[1])) { excludedRows++; return; }
    visits.push({
      id: v[0] || `source-row-${i + 2}`, date: v[1], salesName: v[2], company: v[3],
      contact: v[4], commodity: v[5], activityType: v[6], result: v[7], products: v[8],
      nextAgenda: v[9], nextDate: calendarDate(v[10]) ? v[10] : "",
      location: v[11], sourceRow: i + 2,
    });
  });
  visits.sort((a, b) => b.date.localeCompare(a.date) || b.sourceRow - a.sourceRow);
  return GetReportDataResponse.parse({
    visits, sourceTitle: title, fetchedAt, today: today(), timezone: "Asia/Jakarta",
    mode: "live", syncError: null, coverageStart: visits.at(-1)?.date ?? "",
    coverageEnd: visits[0]?.date ?? "", excludedRows,
  });
}

async function fetchSource(): Promise<ReportData> {
  const sheetId = SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

  if (!apiKey && !accessToken) {
    throw new Error(
      "GOOGLE_API_KEY (or GOOGLE_ACCESS_TOKEN) must be configured in environment variables to fetch from Google Sheets."
    );
  }

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const keyParam = apiKey ? `key=${encodeURIComponent(apiKey)}` : "";

  // 1. Fetch metadata
  const metaUrl = `${base}?fields=properties.title,sheets.properties${keyParam ? `&${keyParam}` : ""}`;
  const response = await fetch(metaUrl, { method: "GET", headers });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Google Sheets metadata request failed (${response.status}): ${errorText || response.statusText}`);
  }

  const meta = await response.json() as {
    properties: { title: string };
    sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number } } }[];
  };

  const table = meta.sheets.find(sheet => sheet.properties.sheetId === 0)?.properties;
  if (!table) throw new Error("The original visit tab (gid 0) is unavailable.");

  const size = table.gridProperties.rowCount;
  if (!Number.isInteger(size) || size < 1 || size > 100_000) {
    throw new Error("Visit table size exceeds the supported safe read limit.");
  }

  // 2. Fetch row values
  const range = `'${table.title.replace(/'/g, "''")}'!A1:L${size}`;
  const dataUrl = `${base}/values/${encodeURIComponent(range)}${keyParam ? `?${keyParam}` : ""}`;

  const dataResponse = await fetch(dataUrl, { method: "GET", headers });
  if (!dataResponse.ok) {
    const errorText = await dataResponse.text().catch(() => "");
    throw new Error(`Google Sheets values request failed (${dataResponse.status}): ${errorText || dataResponse.statusText}`);
  }

  const data = await dataResponse.json() as { values?: string[][] };
  return buildData(data.values ?? [], meta.properties.title, new Date().toISOString());
}

let inFlight: Promise<ReportData> | null = null;
async function synchronize(): Promise<ReportData> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const data = await fetchSource();
    if (db) {
      try {
        await db.insert(reportCacheTable).values({
          key: CACHE_KEY, payload: data, fetchedAt: new Date(data.fetchedAt),
        }).onConflictDoUpdate({
          target: reportCacheTable.key,
          set: { payload: data, fetchedAt: new Date(data.fetchedAt) },
        });
      } catch (err) {
        logger.warn({ err }, "Database cache update failed");
      }
    }
    return data;
  })();
  try { return await inFlight; } finally { inFlight = null; }
}

export async function reportData(force = false): Promise<ReportData> {
  let cached: ReportData | null = null;
  if (db) {
    try {
      const [entry] = await db.select().from(reportCacheTable).where(eq(reportCacheTable.key, CACHE_KEY));
      if (entry) cached = GetReportDataResponse.parse(entry.payload);
      if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < TTL) {
        return { ...cached, today: today() };
      }
    } catch {
      logger.warn("Report cache unavailable; attempting live Sheets read");
    }
  }
  try { return await synchronize(); }
  catch {
    // Upstream errors may include private source identifiers or URLs.
    const message = "The source could not be refreshed. Showing saved report data.";
    logger.warn("Google Sheets sync unavailable; serving explicitly labeled saved data");
    if (!cached) throw new Error("The report source is unavailable and no cached report data exists.");
    return { ...cached, today: today(), mode: "snapshot", syncError: message };
  }
}