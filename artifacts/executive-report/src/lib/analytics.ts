import type { ReportData, Visit } from '@workspace/api-client-react';

/* ---------- date helpers (ISO yyyy-mm-dd, calendar math in UTC days) ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const iso = (s: string) => (s || '').slice(0, 10);
const toN = (s: string) => {
  const [y, m, d] = iso(s).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const fromN = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const p2 = (n: number) => String(n).padStart(2, '0');
const minD = (a: string, b: string) => (a < b ? a : b);
export const fmtDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso(s))) return s || '-';
  const [y, m, d] = iso(s).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
export const fmtRange = (w: Win) => `${fmtDate(w.start)} to ${fmtDate(w.end)}`;
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const prevYm = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${p2(m - 1)}`;
};
const monthEnd = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${p2(dim(y, m))}`;
};

/* ---------- types ---------- */
export type Sel =
  | { mode: 'month'; ym: string }
  | { mode: 'quarter'; y: number; q: number }
  | { mode: 'year'; y: number };
export interface Win { start: string; end: string }
export type Cov = 'full' | 'partial' | 'none';
export interface Metrics { activities: number; companies: number; reps: number; closing: number; trials: number }
export type Delta =
  | { kind: 'pct'; value: number }
  | { kind: 'fromZero' }
  | { kind: 'flat' }
  | { kind: 'unavailable'; reason: string };

export const normName = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const cleanName = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

/* ---------- selection / period math ---------- */
export function latestCompleteMonth(d: ReportData): string {
  let ym = prevYm(d.today.slice(0, 7));
  for (let i = 0; i < 60; i++) {
    const end = monthEnd(ym);
    if (end < d.today && end <= d.coverageEnd && `${ym}-01` >= d.coverageStart) return ym;
    ym = prevYm(ym);
  }
  return prevYm(d.today.slice(0, 7));
}
export const defaultSel = (d: ReportData): Sel => ({ mode: 'month', ym: latestCompleteMonth(d) });
export function monthOptions(d: ReportData): string[] {
  const out: string[] = [];
  let ym = d.today.slice(0, 7);
  const first = d.coverageStart.slice(0, 7);
  while (ym >= first && out.length < 120) { out.push(ym); ym = prevYm(ym); }
  return out;
}
export function quarterOptions(d: ReportData): { y: number; q: number }[] {
  const [ty, tm] = d.today.split('-').map(Number);
  const [fy, fm] = d.coverageStart.split('-').map(Number);
  const out: { y: number; q: number }[] = [];
  let y = ty, q = Math.ceil(tm / 3);
  while (y > fy || (y === fy && q >= Math.ceil(fm / 3))) {
    out.push({ y, q });
    q -= 1;
    if (q === 0) { q = 4; y -= 1; }
  }
  return out;
}
export function yearOptions(d: ReportData): number[] {
  const ty = Number(d.today.slice(0, 4));
  const fy = Number(d.coverageStart.slice(0, 4));
  const out: number[] = [];
  for (let y = ty; y >= fy; y--) out.push(y);
  return out;
}

export interface Period {
  key: string; title: string; kind: string; cur: Win; prev: Win;
  nominalEnd: string; inProgress: boolean; curCov: Cov; prevCov: Cov; compareRule: string;
}
export const coverage = (w: Win, cs: string, ce: string): Cov =>
  w.end < cs || w.start > ce ? 'none' : w.start >= cs && w.end <= ce ? 'full' : 'partial';

export function buildPeriod(sel: Sel, d: ReportData): Period {
  const today = d.today;
  let start: string, nominalEnd: string, pStart: string, pNominal: string, title: string, kind: string;
  let capPrevByElapsed: (n: number, inProg: boolean) => string;
  if (sel.mode === 'month') {
    start = `${sel.ym}-01`; nominalEnd = monthEnd(sel.ym);
    const pm = prevYm(sel.ym); pStart = `${pm}-01`; pNominal = monthEnd(pm);
    title = monthLabel(sel.ym);
    kind = sel.ym === today.slice(0, 7) ? 'This month (MTD)' : sel.ym === prevYm(today.slice(0, 7)) ? 'Last month' : 'Month';
    capPrevByElapsed = (n, ip) => (ip ? minD(fromN(toN(pStart) + n - 1), pNominal) : pNominal);
  } else if (sel.mode === 'quarter') {
    const m0 = (sel.q - 1) * 3 + 1;
    start = `${sel.y}-${p2(m0)}-01`; nominalEnd = monthEnd(`${sel.y}-${p2(m0 + 2)}`);
    const pq = sel.q === 1 ? { y: sel.y - 1, q: 4 } : { y: sel.y, q: sel.q - 1 };
    const pm0 = (pq.q - 1) * 3 + 1;
    pStart = `${pq.y}-${p2(pm0)}-01`; pNominal = monthEnd(`${pq.y}-${p2(pm0 + 2)}`);
    title = `Q${sel.q} ${sel.y}`;
    kind = nominalEnd >= today && start <= today ? 'Quarter to date (QTD)' : 'Quarter summary';
    capPrevByElapsed = (n, ip) => (ip ? minD(fromN(toN(pStart) + n - 1), pNominal) : pNominal);
  } else {
    start = `${sel.y}-01-01`; nominalEnd = `${sel.y}-12-31`;
    pStart = `${sel.y - 1}-01-01`; pNominal = `${sel.y - 1}-12-31`;
    title = String(sel.y);
    kind = nominalEnd >= today && start <= today ? 'Year to date (YTD)' : 'Full year';
    capPrevByElapsed = (_n, ip) => {
      if (!ip) return pNominal;
      const [, m, dd] = today.split('-').map(Number);
      return `${sel.y - 1}-${p2(m)}-${p2(Math.min(dd, dim(sel.y - 1, m)))}`;
    };
  }
  const inProgress = today < nominalEnd;
  const end = inProgress ? (today < start ? start : today) : nominalEnd;
  const n = toN(end) - toN(start) + 1;
  const cur = { start, end };
  const prev = { start: pStart, end: capPrevByElapsed(n, inProgress) };
  const compareRule = inProgress
    ? `Period is in progress: compared with the equivalent elapsed span (${n} days) of the previous ${sel.mode === 'year' ? 'year' : sel.mode}, capped at its end.`
    : `Period is complete: compared with the full preceding ${sel.mode === 'year' ? 'year' : sel.mode}.`;
  return {
    key: `${sel.mode}-${start}`, title, kind, cur, prev, nominalEnd, inProgress,
    curCov: coverage(cur, d.coverageStart, d.coverageEnd),
    prevCov: coverage(prev, d.coverageStart, d.coverageEnd), compareRule,
  };
}

/* ---------- metrics ---------- */
const inWin = (v: Visit, w: Win) => iso(v.date) >= w.start && iso(v.date) <= w.end;
const isClosing = (v: Visit) => /closing/i.test(v.activityType);
const isTrial = (v: Visit) => /trial/i.test(v.activityType);
export function metricsOf(vs: Visit[]): Metrics {
  return {
    activities: vs.length,
    companies: new Set(vs.map((v) => normName(v.company))).size,
    reps: new Set(vs.map((v) => normName(v.salesName))).size,
    closing: vs.filter(isClosing).length,
    trials: vs.filter(isTrial).length,
  };
}
export function compareDelta(cur: number, prev: number, cc: Cov, pc: Cov): Delta {
  if (cc === 'none') return { kind: 'unavailable', reason: 'Current window lies outside recorded coverage' };
  if (pc === 'none') return { kind: 'unavailable', reason: 'No source coverage in the comparison window' };
  if (cc === 'partial') return { kind: 'unavailable', reason: 'Current window only partly covered by source' };
  if (pc === 'partial') return { kind: 'unavailable', reason: 'Comparison window only partly covered by source' };
  if (prev === 0) return cur === 0 ? { kind: 'flat' } : { kind: 'fromZero' };
  return { kind: 'pct', value: ((cur - prev) / prev) * 100 };
}
export const deltaText = (d: Delta) =>
  d.kind === 'pct' ? `${d.value >= 0 ? '+' : ''}${d.value.toFixed(1)}%`
  : d.kind === 'fromZero' ? 'from zero' : d.kind === 'flat' ? 'no change (0 and 0)' : 'comparison unavailable';

const countBy = (vs: Visit[], f: (v: Visit) => string) => {
  const m = new Map<string, { label: Map<string, number>; n: number; cos: Set<string> }>();
  for (const v of vs) {
    const raw = f(v);
    const k = normName(raw);
    const e = m.get(k) ?? { label: new Map(), n: 0, cos: new Set() };
    e.n++; e.cos.add(normName(v.company));
    e.label.set(cleanName(raw), (e.label.get(cleanName(raw)) ?? 0) + 1);
    m.set(k, e);
  }
  return m;
};
const topLabel = (l: Map<string, number>) => [...l.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '(blank)';

/* ---------- signals (heuristic) ---------- */
const RISK = ['\\bkendala', '\\bmasalah', '\\bkomplain', '\\bkeluhan', '\\bbelum', '\\bditunda', '\\btunda', '\\bmenolak', '\\bmahal', '\\bkompetitor', '\\bpesaing', '\\bgagal', '\\bterlambat', '\\bragu', '\\bpertimbang', '\\bbatal'];
const OPP = ['\\btertarik', '\\bminat', '\\border', '\\bpesan', '\\bsetuju', '\\bsepakat', '\\bpo\\b', '\\bnegosiasi', '\\bpenawaran', '\\bpenambahan', '\\brepeat', '\\bpuas', '\\bkontrak', '\\bpermintaan', '\\bakan membeli', '\\bpembelian'];
export interface Signal { visit: Visit; terms: string[] }
const scan = (vs: Visit[], pats: string[]): Signal[] =>
  vs.map((v) => {
    const t = `${v.result} ${v.nextAgenda}`.toLowerCase();
    const terms = [...new Set(pats.map((p) => t.match(new RegExp(p))?.[0]).filter((x): x is string => !!x))];
    return { visit: v, terms };
  }).filter((s) => s.terms.length > 0)
    .sort((a, b) => b.terms.length - a.terms.length || iso(b.visit.date).localeCompare(iso(a.visit.date)));

/* ---------- accounts ---------- */
export interface Account {
  key: string; name: string; variants: string[]; windowVisits: number; totalVisits: number;
  latest: Visit; status: 'elapsed' | 'none' | 'upcoming' | 'invalid'; daysSince: number; daysOverdue: number | null;
}
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(iso(s));

export interface ReportingEvidence {
  // Explicit inputs, never inferred from representatives observed in the log.
  expectedReps: string[];
  confirmedCompleteWeeks: Win[];
}
export interface RecordedExceptions {
  asOf: string;
  accountGaps: { key: string; latest: Visit; days: number }[] | null;
  closingGaps: { key: string; closing: Visit }[] | null;
  repGaps: { rep: string; week: Win }[] | null;
  repReason: string;
}

export function recordedExceptions(d: ReportData, period: Period, evidence?: ReportingEvidence): RecordedExceptions {
  const asOf = minD(period.cur.end, d.today);
  const history = d.visits.filter((v) => validDate(v.date) && iso(v.date) <= asOf);
  const knownEnd = asOf >= d.coverageStart && asOf <= d.coverageEnd && period.curCov !== 'none';
  const grouped = new Map<string, Visit[]>();
  for (const v of history) {
    const key = normName(v.company);
    if (key) grouped.set(key, [...(grouped.get(key) ?? []), v]);
  }
  const accountGaps: NonNullable<RecordedExceptions['accountGaps']> = [];
  const closingGaps: NonNullable<RecordedExceptions['closingGaps']> = [];
  for (const [key, visits] of grouped) {
    const sorted = [...visits].sort((a, b) => iso(b.date).localeCompare(iso(a.date)) || b.sourceRow - a.sourceRow);
    const latest = sorted[0];
    const days = toN(asOf) - toN(latest.date);
    if (days > 14) accountGaps.push({ key, latest, days });
    const closing = sorted.find((v) => isClosing(v) && inWin(v, period.cur));
    // A plan or another row on the same day is not evidence of a later visit.
    if (closing && !visits.some((v) => iso(v.date) > iso(closing.date))) closingGaps.push({ key, closing });
  }
  accountGaps.sort((a, b) => b.days - a.days || a.key.localeCompare(b.key));
  closingGaps.sort((a, b) => a.closing.date.localeCompare(b.closing.date) || a.key.localeCompare(b.key));

  const roster = [...new Map((evidence?.expectedReps ?? []).filter((r) => normName(r)).map((r) => [normName(r), cleanName(r)])).values()];
  const coveredWeeks = [...new Map((evidence?.confirmedCompleteWeeks ?? []).filter((w) => {
    const monday = new Date(toN(w.start) * 86400000).getUTCDay() === 1;
    return validDate(w.start) && validDate(w.end) && monday && toN(w.end) - toN(w.start) === 6
      && w.start >= period.cur.start && w.end <= asOf
      && coverage(w, d.coverageStart, d.coverageEnd) === 'full';
  }).map((w) => [w.start, w])).values()];
  const eligible = roster.length > 0 && coveredWeeks.length > 0;
  const repGaps = eligible ? coveredWeeks.flatMap((week) =>
    roster.filter((rep) => !history.some((v) => normName(v.salesName) === normName(rep) && inWin(v, week)))
      .map((rep) => ({ rep, week }))) : null;
  return {
    asOf, accountGaps: knownEnd ? accountGaps : null, closingGaps: knownEnd ? closingGaps : null, repGaps,
    repReason: !roster.length ? 'Unavailable: no confirmed expected-rep roster. Observed names are not a roster.'
      : !coveredWeeks.length ? 'Unavailable: no complete Monday–Sunday week with confirmed reporting coverage in this window.'
      : `Checked ${coveredWeeks.length} confirmed-complete Monday–Sunday week(s) against ${roster.length} expected reps; other weeks are excluded.`,
  };
}

export interface ScheduledVisitItem {
  company: string;
  rep: string;
  nextDate: string;
  nextAgenda: string;
  lastVisitDate: string;
  lastActivityType: string;
  daysDiff: number;
  sourceRow: number;
}

export interface ScheduleAnalysis {
  upcoming: ScheduledVisitItem[];
  overdueWithoutReport: ScheduledVisitItem[];
}

/* ---------- pacing & cadence ---------- */
export interface RepCadence {
  rep: string;
  visits: number;
  prevVisits: number;
  activeDays: number;
  visitsPerActiveDay: number;
  expectedPace: number;
  pacingPct: number;
  status: 'ahead' | 'on_track' | 'behind';
  accountsVisited: number;
}

export interface PacingSummary {
  monthlyTarget: number;
  periodTarget: number;
  elapsedDays: number;
  totalPeriodDays: number;
  elapsedRatio: number;
  expectedVisitsPerRep: number;
  activeRepsCount: number;
  totalTeamActual: number;
  totalTeamTarget: number;
  teamPacingPct: number;
  teamStatus: 'ahead' | 'on_track' | 'behind';
  reps: RepCadence[];
}

export function computePacing(
  curVisits: Visit[],
  reps: { label: string; n: number; prev: number; companies: number }[],
  period: Period,
  monthlyTarget = 20
): PacingSummary {
  const monthsInPeriod = period.key.startsWith('year') ? 12 : period.key.startsWith('quarter') ? 3 : 1;
  const periodTarget = monthlyTarget * monthsInPeriod;
  const totalPeriodDays = Math.max(1, toN(period.nominalEnd) - toN(period.cur.start) + 1);
  const elapsedDays = Math.max(1, toN(period.cur.end) - toN(period.cur.start) + 1);
  const elapsedRatio = period.inProgress ? Math.min(1, Math.max(0.01, elapsedDays / totalPeriodDays)) : 1;
  const expectedPace = Math.max(1, Math.round(periodTarget * elapsedRatio));

  const repCadences: RepCadence[] = reps.map((r) => {
    const repVisits = curVisits.filter((v) => normName(v.salesName) === normName(r.label));
    const activeDays = new Set(repVisits.map((v) => iso(v.date))).size;
    const visitsPerActiveDay = activeDays > 0 ? +(r.n / activeDays).toFixed(1) : 0;
    const pacingPct = expectedPace > 0 ? Math.round((r.n / expectedPace) * 100) : 100;
    const status: 'ahead' | 'on_track' | 'behind' =
      r.n >= Math.round(expectedPace * 1.1) ? 'ahead' :
      r.n >= Math.round(expectedPace * 0.8) ? 'on_track' : 'behind';
    return {
      rep: r.label,
      visits: r.n,
      prevVisits: r.prev,
      activeDays,
      visitsPerActiveDay,
      expectedPace,
      pacingPct,
      status,
      accountsVisited: r.companies,
    };
  });

  const activeRepsCount = reps.filter((r) => r.n > 0).length || 1;
  const totalTeamActual = curVisits.length;
  const totalTeamTarget = expectedPace * activeRepsCount;
  const teamPacingPct = totalTeamTarget > 0 ? Math.round((totalTeamActual / totalTeamTarget) * 100) : 100;
  const teamStatus: 'ahead' | 'on_track' | 'behind' =
    totalTeamActual >= Math.round(totalTeamTarget * 1.1) ? 'ahead' :
    totalTeamActual >= Math.round(totalTeamTarget * 0.85) ? 'on_track' : 'behind';

  return {
    monthlyTarget,
    periodTarget,
    elapsedDays,
    totalPeriodDays,
    elapsedRatio,
    expectedVisitsPerRep: expectedPace,
    activeRepsCount,
    totalTeamActual,
    totalTeamTarget,
    teamPacingPct,
    teamStatus,
    reps: repCadences,
  };
}

/* ---------- account health & dormancy ---------- */
export interface AccountHealthItem {
  key: string;
  name: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  tierLabel: string;
  totalVisits: number;
  windowVisits: number;
  latest: Visit;
  daysSinceLastVisit: number;
  healthStatus: 'healthy' | 'cooling' | 'dormant';
  statusLabel: string;
  nextDate: string;
  nextAgenda: string;
  daysOverdue: number | null;
}

export interface AccountHealthAnalysis {
  asOf: string;
  totalAccounts: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  singleVisitPct: number;
  recurringCount: number;
  healthyCount: number;
  coolingCount: number;
  dormantCount: number;
  dormantKeyAccounts: AccountHealthItem[];
  coolingAccounts: AccountHealthItem[];
  allAccounts: AccountHealthItem[];
}

export function computeAccountHealth(
  d: ReportData,
  period: Period,
  curVisits: Visit[],
  all: Visit[]
): AccountHealthAnalysis {
  const asOf = minD(period.cur.end, d.today);
  const upTo = all.filter((v) => iso(v.date) <= asOf);
  const byAcc = new Map<string, Visit[]>();
  for (const v of upTo) {
    const k = normName(v.company);
    if (k) byAcc.set(k, [...(byAcc.get(k) ?? []), v]);
  }

  const curCounts = new Map<string, number>();
  for (const v of curVisits) {
    const k = normName(v.company);
    if (k) curCounts.set(k, (curCounts.get(k) ?? 0) + 1);
  }

  const items: AccountHealthItem[] = [];
  let t1 = 0, t2 = 0, t3 = 0;
  let healthy = 0, cooling = 0, dormant = 0;

  for (const [k, vs] of byAcc) {
    const sorted = [...vs].sort((a, b) => iso(b.date).localeCompare(iso(a.date)) || b.sourceRow - a.sourceRow);
    const latest = sorted[0];
    const totalVisits = vs.length;
    const windowVisits = curCounts.get(k) ?? 0;
    const daysSince = toN(asOf) - toN(latest.date);

    const tier: AccountHealthItem['tier'] = totalVisits >= 4 ? 'tier1' : totalVisits >= 2 ? 'tier2' : 'tier3';
    const tierLabel = tier === 'tier1' ? 'Strategic (Tier 1)' : tier === 'tier2' ? 'Growing (Tier 2)' : 'Prospect (Tier 3)';
    if (tier === 'tier1') t1++;
    else if (tier === 'tier2') t2++;
    else t3++;

    const healthStatus: AccountHealthItem['healthStatus'] = daysSince <= 30 ? 'healthy' : daysSince <= 60 ? 'cooling' : 'dormant';
    const statusLabel = healthStatus === 'healthy' ? 'Active (≤30d)' : healthStatus === 'cooling' ? 'Cooling (31-60d)' : 'Dormant (>60d)';
    if (healthStatus === 'healthy') healthy++;
    else if (healthStatus === 'cooling') cooling++;
    else dormant++;

    const nd = iso(latest.nextDate);
    const daysOverdue = validDate(nd) && nd < d.today ? toN(d.today) - toN(nd) : null;

    items.push({
      key: k,
      name: cleanName(latest.company),
      tier,
      tierLabel,
      totalVisits,
      windowVisits,
      latest,
      daysSinceLastVisit: daysSince,
      healthStatus,
      statusLabel,
      nextDate: nd,
      nextAgenda: latest.nextAgenda || '',
      daysOverdue,
    });
  }

  items.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
    return b.totalVisits - a.totalVisits || b.daysSinceLastVisit - a.daysSinceLastVisit;
  });

  const dormantKeyAccounts = items
    .filter((x) => x.tier !== 'tier3' && x.healthStatus === 'dormant')
    .sort((a, b) => b.totalVisits - a.totalVisits || b.daysSinceLastVisit - a.daysSinceLastVisit);

  const coolingAccounts = items
    .filter((x) => x.healthStatus === 'cooling')
    .sort((a, b) => b.totalVisits - a.totalVisits || b.daysSinceLastVisit - a.daysSinceLastVisit);

  const totalAccounts = items.length;
  const singleVisitPct = totalAccounts > 0 ? Math.round((t3 / totalAccounts) * 100) : 0;

  return {
    asOf,
    totalAccounts,
    tier1Count: t1,
    tier2Count: t2,
    tier3Count: t3,
    singleVisitPct,
    recurringCount: t1 + t2,
    healthyCount: healthy,
    coolingCount: cooling,
    dormantCount: dormant,
    dormantKeyAccounts,
    coolingAccounts,
    allAccounts: items,
  };
}

/* ---------- full analysis ---------- */
export interface Analysis {
  period: Period; curVisits: Visit[]; prevVisits: Visit[]; m: Metrics; pm: Metrics;
  deltas: Record<keyof Metrics, Delta>;
  trend: { label: string; range: string; cur: number | null; prev: number | null }[];
  monthly: { ym: string; n: number | null; partial: boolean }[];
  mix: { label: string; n: number; prev: number }[];
  reps: { label: string; n: number; prev: number; companies: number; share: number }[];
  accounts: Account[]; risks: Signal[]; opps: Signal[];
  keypoints: string[]; recommendations: string[];
  quality: { blankProducts: number; blankNextDate: number; elapsedAccounts: number; mergedVariants: number };
  exceptions: RecordedExceptions;
  schedule: ScheduleAnalysis;
  pacing: PacingSummary;
  accountHealth: AccountHealthAnalysis;
}

export function analyze(d: ReportData, sel: Sel, evidence?: ReportingEvidence): Analysis {
  const period = buildPeriod(sel, d);
  const all = d.visits.filter((v) => validDate(v.date));
  const curVisits = all.filter((v) => inWin(v, period.cur));
  const prevVisits = all.filter((v) => inWin(v, period.prev));
  const m = metricsOf(curVisits), pm = metricsOf(prevVisits);
  const dl = (k: keyof Metrics) => compareDelta(m[k], pm[k], period.curCov, period.prevCov);
  const deltas = { activities: dl('activities'), companies: dl('companies'), reps: dl('reps'), closing: dl('closing'), trials: dl('trials') };

  // weekly trend aligned by elapsed day
  const nDays = toN(period.cur.end) - toN(period.cur.start) + 1;
  const bucketDays = nDays > 100 ? 28 : 7;
  const weeks = Math.ceil(nDays / bucketDays);
  const trend = Array.from({ length: weeks }, (_, i) => {
    const s = toN(period.cur.start) + i * bucketDays;
    const e = Math.min(s + bucketDays - 1, toN(period.cur.end));
    const ps = toN(period.prev.start) + i * bucketDays;
    const pe = Math.min(ps + bucketDays - 1, toN(period.prev.end));
    const cnt = (vs: Visit[], a: number, b: number) => vs.filter((v) => toN(v.date) >= a && toN(v.date) <= b).length;
    return {
      label: bucketDays === 7 ? `Wk ${i + 1}` : `4wk ${i + 1}`, range: `${fmtDate(fromN(s))} - ${fmtDate(fromN(e))}`,
      cur: coverage({ start: fromN(s), end: fromN(e) }, d.coverageStart, d.coverageEnd) === 'none' ? null : cnt(curVisits, s, e),
      prev: ps > toN(period.prev.end) || coverage({ start: fromN(ps), end: fromN(pe) }, d.coverageStart, d.coverageEnd) === 'none' ? null : cnt(prevVisits, ps, pe),
    };
  });

  const monthly: Analysis['monthly'] = [];
  let ym = d.coverageStart.slice(0, 7);
  const lastYm = d.today.slice(0, 7);
  while (ym <= lastYm && monthly.length < 120) {
    const w = { start: `${ym}-01`, end: monthEnd(ym) };
    const cov = coverage(w, d.coverageStart, d.coverageEnd);
    monthly.push({ ym, n: cov === 'none' ? null : all.filter((v) => inWin(v, w)).length, partial: cov === 'partial' });
    const [y, mm] = ym.split('-').map(Number);
    ym = mm === 12 ? `${y + 1}-01` : `${y}-${p2(mm + 1)}`;
  }

  const curTypes = countBy(curVisits, (v) => v.activityType), prevTypes = countBy(prevVisits, (v) => v.activityType);
  const keys = new Set([...curTypes.keys(), ...prevTypes.keys()]);
  const mix = [...keys].map((k) => ({ label: topLabel((curTypes.get(k) ?? prevTypes.get(k))!.label), n: curTypes.get(k)?.n ?? 0, prev: prevTypes.get(k)?.n ?? 0 })).sort((a, b) => b.n - a.n || b.prev - a.prev);
  const curReps = countBy(curVisits, (v) => v.salesName), prevReps = countBy(prevVisits, (v) => v.salesName);
  const reps = [...new Set([...curReps.keys(), ...prevReps.keys()])].map((k) => {
    const current = curReps.get(k), prior = prevReps.get(k);
    const n = current?.n ?? 0;
    return { label: topLabel((current ?? prior)!.label), n, prev: prior?.n ?? 0,
      companies: current?.cos.size ?? 0, share: curVisits.length ? n / curVisits.length * 100 : 0 };
  }).sort((a, b) => b.n - a.n || b.prev - a.prev);

  // accounts
  const upTo = all.filter((v) => iso(v.date) <= period.cur.end);
  const byAcc = new Map<string, Visit[]>();
  for (const v of upTo) { const k = normName(v.company); byAcc.set(k, [...(byAcc.get(k) ?? []), v]); }
  const inWinKeys = new Set(curVisits.map((v) => normName(v.company)));
  const accounts: Account[] = [...inWinKeys].map((k) => {
    const vs = byAcc.get(k)!;
    const latest = [...vs].sort((a, b) => iso(b.date).localeCompare(iso(a.date)) || b.sourceRow - a.sourceRow)[0];
    const nd = iso(latest.nextDate);
    const status: Account['status'] = !nd ? 'none' : !validDate(nd) ? 'invalid' : nd < d.today ? 'elapsed' : 'upcoming';
    return {
      key: k, name: cleanName(latest.company), variants: [...new Set(vs.map((v) => cleanName(v.company)))],
      windowVisits: curVisits.filter((v) => normName(v.company) === k).length, totalVisits: vs.length, latest, status,
      daysSince: toN(period.cur.end) - toN(latest.date),
      daysOverdue: status === 'elapsed' ? toN(d.today) - toN(nd) : null,
    };
  });
  const rank = { elapsed: 0, none: 1, invalid: 1, upcoming: 2 } as const;
  accounts.sort((a, b) => rank[a.status] - rank[b.status] || (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0) || b.daysSince - a.daysSince);

  const risks = scan(curVisits, RISK), opps = scan(curVisits, OPP);
  const blankProducts = curVisits.filter((v) => !v.products?.trim()).length;
  const blankNextDate = curVisits.filter((v) => !iso(v.nextDate)).length;
  const elapsedAccounts = accounts.filter((a) => a.status === 'elapsed').length;
  const mergedVariants = [...new Set(all.map((v) => normName(v.company)))].filter((k) => new Set(all.filter((v) => normName(v.company) === k).map((v) => v.company)).size > 1).length;

  // narrative recomputed from evidence
  const kp: string[] = [];
  const rec: string[] = [];
  const win = fmtRange(period.cur);
  if (period.curCov === 'none') {
    kp.push(`No records exist in ${win}. Source coverage runs ${fmtDate(d.coverageStart)} to ${fmtDate(d.coverageEnd)}, so this window is unknown, not zero performance.`);
  } else {
    const dt = deltas.activities;
    kp.push(`${m.activities} recorded activities across ${m.companies} unique accounts and ${m.reps} reps in ${win}; ${dt.kind === 'pct' ? `${deltaText(dt)} against ${pm.activities} in ${fmtRange(period.prev)}` : dt.kind === 'fromZero' ? `up from zero in ${fmtRange(period.prev)}` : `${pm.activities} in ${fmtRange(period.prev)}, percent comparison unavailable (${dt.kind === 'unavailable' ? dt.reason.toLowerCase() : 'no change'})`}.`);
    kp.push(`${m.closing} activities carry the "Closing" label and ${m.trials} are trial-related (preparation, supervision, final presentation). These are activity labels; the source holds no order value, deal ID or sale verification.`);
    if (m.activities && reps[0]) kp.push(`${reps[0].label} logged ${reps[0].n} of ${m.activities} activities (${reps[0].share.toFixed(1)}%); ${m.reps} rep${m.reps === 1 ? '' : 's'} contributed in this window.`);
    if (accounts.length) kp.push(`${elapsedAccounts} of ${accounts.length} accounts seen in the window have a latest planned next date that has already passed (${fmtDate(d.today)}). Completion is not tracked, so this is a review list, not a list of missed actions.`);
    kp.push(`Product field is blank on ${blankProducts} of ${m.activities} records. This is a data gap: product mentions, where present, sit in the free-text notes.`);
  }
  if (period.curCov === 'partial') kp.push(`Source coverage only partly spans this window (recorded ${fmtDate(d.coverageStart)} to ${fmtDate(d.coverageEnd)}); counts are a floor, not the full period.`);
  if (m.activities && blankProducts / m.activities > 0.5) rec.push(`Make product list a required field in the visit log. ${Math.round((blankProducts / m.activities) * 100)}% of records are blank, so demand by product cannot be read without opening notes.`);
  if (elapsedAccounts) rec.push(`Ask owners to confirm status on the ${Math.min(elapsedAccounts, 5)} longest-elapsed planned follow-ups first (see Accounts for review); record completion so elapsed dates can be separated from done work.`);
  if (m.closing) rec.push(`Attach an order reference or amount to the ${m.closing} Closing-labelled activities so the board can separate activity from commercial evidence.`);
  if (reps[0] && reps.length > 1 && reps[0].share > 40) rec.push(`Contribution is concentrated: ${reps[0].label} accounts for ${reps[0].share.toFixed(1)}% of recorded activity. Check whether coverage depends on one person.`);
  if (risks.length) rec.push(`Read the ${Math.min(risks.length, 5)} highest-ranked keyword-flagged notes under Evidence priorities; the flags are heuristic and need a human reading.`);
  if (!rec.length) rec.push('No evidence-driven action is triggered by this window. Widen the period or check coverage.');

  const exceptions = recordedExceptions(d, period, evidence);
  if (exceptions.accountGaps?.length) rec.unshift(`Confirm visit history for ${exceptions.accountGaps.length} previously recorded accounts with no recorded visit for over 14 days as of ${fmtDate(exceptions.asOf)}. Missing records do not prove inactivity.`);
  if (exceptions.closingGaps?.length) rec.unshift(`Confirm follow-up evidence for ${exceptions.closingGaps.length} accounts whose latest Closing-labelled activity in the window has no later same-account visit recorded by ${fmtDate(exceptions.asOf)}. Plans are not completion evidence.`);

  // schedule & follow-up tracking
  const scheduleTodayN = toN(d.today);
  const upcomingSchedule: ScheduledVisitItem[] = [];
  const overdueSchedule: ScheduledVisitItem[] = [];

  for (const [k, vs] of byAcc) {
    const sorted = [...vs].sort((a, b) => iso(b.date).localeCompare(iso(a.date)) || b.sourceRow - a.sourceRow);
    const latest = sorted[0];
    const nd = iso(latest.nextDate);
    if (!validDate(nd)) continue;
    const diff = toN(nd) - scheduleTodayN;
    const item: ScheduledVisitItem = {
      company: cleanName(latest.company),
      rep: latest.salesName || 'Unassigned',
      nextDate: nd,
      nextAgenda: latest.nextAgenda || '-',
      lastVisitDate: latest.date,
      lastActivityType: latest.activityType || 'Visit',
      daysDiff: Math.abs(diff),
      sourceRow: latest.sourceRow,
    };
    if (diff >= 0) {
      upcomingSchedule.push(item);
    } else {
      const hasFollowUp = vs.some((v) => iso(v.date) >= nd);
      if (!hasFollowUp) {
        overdueSchedule.push(item);
      }
    }
  }

  upcomingSchedule.sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.daysDiff - b.daysDiff);
  overdueSchedule.sort((a, b) => b.daysDiff - a.daysDiff || a.nextDate.localeCompare(b.nextDate));

  const schedule: ScheduleAnalysis = {
    upcoming: upcomingSchedule,
    overdueWithoutReport: overdueSchedule,
  };

  const pacing = computePacing(curVisits, reps, period, 20);
  const accountHealth = computeAccountHealth(d, period, curVisits, all);

  if (accountHealth.dormantKeyAccounts.length > 0) {
    const topDormant = accountHealth.dormantKeyAccounts.slice(0, 3).map((a) => `${a.name} (${a.totalVisits} visits, ${a.daysSinceLastVisit}d silent)`).join(', ');
    rec.unshift(`Re-engage ${accountHealth.dormantKeyAccounts.length} dormant key accounts (≥2 visits historically, but >60 days without visit as of ${fmtDate(accountHealth.asOf)}): ${topDormant}.`);
  }

  return { period, curVisits, prevVisits, m, pm, deltas, trend, monthly, mix, reps, accounts, risks, opps, keypoints: kp, recommendations: rec, exceptions, schedule, pacing, accountHealth, quality: { blankProducts, blankNextDate, elapsedAccounts, mergedVariants } };
}
