import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { ReportData } from '@workspace/api-client-react';
import { fmtDate, monthLabel, normName, type Analysis } from '@/lib/analytics';
import { groupVisits } from '@/lib/groups';
import { DataTable, type Col } from './data-table';
import { ReadFirst } from './priorities';
import { Bar, DeltaTag, DrillBtn, Empty, Panel, PIE_COLORS, type Drill, type ViewId } from './shared';

function Metric({ id, label, value, prev, d, hint }: { id: string; label: string; value: number; prev: number | null; d: Analysis['deltas']['activities']; hint: string }) {
  return (
    <div className="mobile-metric px-4 py-3 first:pl-0" data-testid={`metric-${id}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mono mt-1 text-4xl font-medium leading-none">{value}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs"><span className="text-muted-foreground">prev <span className="mono text-foreground">{prev ?? 'n/a'}</span></span><DeltaTag d={d} /></div>
      <div className="mt-1 hidden text-[11px] leading-snug text-muted-foreground sm:block">{hint}</div>
    </div>
  );
}

export function MixDonut({ a, drill }: { a: Analysis; drill: Drill }) {
  const total = a.m.activities;
  const noPrev = a.period.prevCov === 'none';
  if (!a.mix.length) return <Empty id="empty-mix">No activity recorded in this window.</Empty>;
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="relative h-[200px]" role="img" aria-label={`Activity mix: ${a.mix.map((x) => `${x.label} ${x.n}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={a.mix} dataKey="n" nameKey="label" innerRadius={58} outerRadius={92} stroke="hsl(var(--card))" strokeWidth={2} isAnimationActive={false}>
              {a.mix.map((x, i) => <Cell key={x.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="mono text-2xl">{total}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">activities</span></div>
      </div>
      <ul className="space-y-1" data-testid="list-mix">
        {a.mix.map((x, i) => (
          <li key={x.label} className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm sm:min-h-0 sm:flex-nowrap">
            <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <DrillBtn onClick={() => drill({ type: x.label })} label={`Open ${x.n} ${x.label} records in the visit register`}>{x.label}</DrillBtn>
            <span className="mono ml-auto whitespace-nowrap text-xs"><b>{x.n}</b> <span className="text-muted-foreground">{total ? ((x.n / total) * 100).toFixed(1) : '0.0'}% / prev {noPrev ? 'n/a' : x.prev}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RepTable({ a, drill, printAll, pageSize = 8 }: { a: Analysis; drill: Drill; printAll?: boolean; pageSize?: number }) {
  const rows = groupVisits(a.curVisits, (v) => v.salesName);
  const noPrev = a.period.prevCov === 'none';
  const prevOf = (name: string) => a.reps.find((r) => normName(r.label) === normName(name))?.prev ?? 0;
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <Empty id="empty-reps">No representative activity in this window.</Empty>;
  const cols: Col<(typeof rows)[number]>[] = [
    { id: 'rank', label: '#', cell: (_r, i) => <span className="mono text-xs text-muted-foreground">{i}</span> },
    { id: 'name', label: 'Representative', sort: (r) => r.name, cell: (r) => <DrillBtn onClick={() => drill({ field: 'salesName', value: r.key })} label={`Open ${r.name}'s records in the visit register`}>{r.name}</DrillBtn> },
    { id: 'n', label: 'Visits', num: true, sort: (r) => r.n, cell: (r) => <div className="flex items-center justify-end gap-2"><div className="hidden w-14 sm:block"><Bar pct={(r.n / max) * 100} /></div><b>{r.n}</b></div> },
    { id: 'prev', label: 'Prev', num: true, cell: (r) => <span className="text-muted-foreground">{noPrev ? 'n/a' : prevOf(r.name)}</span> },
    { id: 'latest', label: 'Latest activity', num: true, sort: (r) => r.latest.date, cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDate(r.latest.date)}</span> },
  ];
  return <DataTable rows={rows} cols={cols} rowKey={(r) => r.key} pageSize={pageSize} printAll={printAll} initialSort={{ id: 'n', dir: 'desc' }} testid="table-reps" minW={420} />;
}

export function CompanyTable({ a, drill, printAll, pageSize = 8, extra }: { a: Analysis; drill: Drill; printAll?: boolean; pageSize?: number; extra?: boolean }) {
  const rows = groupVisits(a.curVisits, (v) => v.company);
  if (!rows.length) return <Empty id="empty-companies">No accounts recorded in this window.</Empty>;
  const cols: Col<(typeof rows)[number]>[] = [
    { id: 'rank', label: '#', cell: (_r, i) => <span className="mono text-xs text-muted-foreground">{i}</span> },
    { id: 'name', label: 'Company', sort: (r) => r.name, cell: (r) => <DrillBtn onClick={() => drill({ field: 'company', value: r.key })} label={`Open ${r.name} records in the visit register`}>{r.name}</DrillBtn> },
    ...(extra ? [{ id: 'owner', label: 'Latest owner', sort: (r: (typeof rows)[number]) => r.latest.salesName, cell: (r: (typeof rows)[number]) => r.latest.salesName } as Col<(typeof rows)[number]>,
      { id: 'type', label: 'Latest activity type', sort: (r: (typeof rows)[number]) => r.latest.activityType, cell: (r: (typeof rows)[number]) => r.latest.activityType } as Col<(typeof rows)[number]>] : []),
    { id: 'n', label: 'Activities', num: true, sort: (r) => r.n, cell: (r) => <b>{r.n}</b> },
    { id: 'latest', label: 'Latest activity', num: true, sort: (r) => r.latest.date, cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDate(r.latest.date)}</span> },
  ];
  return <DataTable rows={rows} cols={cols} rowKey={(r) => r.key} pageSize={pageSize} printAll={printAll} initialSort={{ id: 'n', dir: 'desc' }} tieBreak={(x, y) => y.latest.date.localeCompare(x.latest.date)} testid="table-companies" minW={extra ? 720 : 420} />;
}

export function TrendPanel({ a, data }: { a: Analysis; data: ReportData }) {
  const p = a.period;
  const maxTrend = Math.max(1, ...a.trend.flatMap((t) => [t.cur ?? 0, t.prev ?? 0]));
  const maxMonth = Math.max(1, ...a.monthly.map((m) => m.n ?? 0));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Against the comparison window" note="Elapsed-day alignment: weekly, or 4-week groups over 100 days." id="trend">
        {a.trend.length === 0 || p.curCov === 'none' ? <Empty id="empty-trend">No recorded data in this window to chart. This is unknown, not zero performance.</Empty> : (
          <>
            <div className="overflow-x-auto pb-1">
              <div className="flex h-36 items-end gap-3 border-b border-border" style={{ minWidth: `${a.trend.length * 44}px` }} role="img" aria-label="Activity counts per period segment, selected versus previous window">
                {a.trend.map((t) => (
                  <div key={t.label} className="flex h-full flex-1 items-end justify-center gap-1" title={`${t.range}: ${t.cur} vs ${t.prev ?? 'n/a'}`}>
                    <div className="flex h-full w-1/3 max-w-9 flex-col justify-end"><span className="mono mb-0.5 text-center text-[11px]">{t.cur ?? 'n/a'}</span>{t.cur !== null && <div className="growy rounded-t-sm bg-primary" style={{ height: `${(t.cur / maxTrend) * 74}%` }} />}</div>
                    <div className="flex h-full w-1/3 max-w-9 flex-col justify-end"><span className="mono mb-0.5 text-center text-[11px] text-muted-foreground">{t.prev ?? 'n/a'}</span>{t.prev !== null && <div className="growy rounded-t-sm bg-ochre/70" style={{ height: `${(t.prev / maxTrend) * 74}%` }} />}</div>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-3" style={{ minWidth: `${a.trend.length * 44}px` }}>{a.trend.map((t) => <div key={t.label} className="flex-1 text-center text-[11px] text-muted-foreground">{t.label}</div>)}</div>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 bg-primary" />Selected</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 bg-ochre/70" />Comparison{p.prevCov !== 'full' && ' (partly or not covered)'}</span></div>
          </>
        )}
      </Panel>
      <Panel title="Recorded activity by month" note="Full source history." id="monthly">
        <div className="overflow-x-auto pb-1">
          <div className="flex h-36 items-end gap-2 border-b border-border" style={{ minWidth: `${a.monthly.length * 34}px` }} data-testid="chart-monthly" role="img" aria-label="Recorded activity per month">
            {a.monthly.map((m) => {
              const on = m.ym >= p.cur.start.slice(0, 7) && m.ym <= p.cur.end.slice(0, 7);
              return (
                <div key={m.ym} className="flex h-full flex-1 flex-col justify-end text-center" title={m.n === null ? `${monthLabel(m.ym)}: outside recorded coverage` : `${monthLabel(m.ym)}: ${m.n}${m.partial ? ' (partial coverage)' : ''}`}>
                  {m.n === null ? <span className="mono mb-1 text-[10px] text-muted-foreground">n/a</span> : (<><span className="mono text-[11px]">{m.n}</span><div className={`growy mt-0.5 rounded-t-sm ${on ? 'bg-primary' : 'bg-chart-5/60'} ${m.partial ? 'hatch' : ''}`} style={{ height: `${(m.n / maxMonth) * 74}%` }} /></>)}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-2" style={{ minWidth: `${a.monthly.length * 34}px` }}>{a.monthly.map((m) => <div key={m.ym} className="flex-1 text-center text-[11px] text-muted-foreground">{monthLabel(m.ym).split(' ')[0]}</div>)}</div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Hatched months are only partly covered. Months after {fmtDate(data.coverageEnd)} are unknown, not zero.</p>
      </Panel>
    </div>
  );
}

export function OverviewView({ a, data, drill, go }: { a: Analysis; data: ReportData; drill: Drill; go: (v: ViewId) => void }) {
  const p = a.period;
  const pv = (n: number) => (p.prevCov === 'none' ? null : n);
  return (
    <div className="space-y-4">
      {(p.curCov !== 'full' || p.prevCov !== 'full') && (
        <div className="rounded border-l-4 border-ochre bg-accent px-4 py-3 text-sm" data-testid="notice-coverage">
          <strong className="font-semibold">Coverage caveat.</strong> The source records activity from {fmtDate(data.coverageStart)} to {fmtDate(data.coverageEnd)}. Dates outside that span are unknown, not zero. Percent changes are withheld unless both windows lie within that span; this does not guarantee every visit was reported.
          {p.curCov === 'none' && ' This window has no recorded data yet.'}
        </div>
      )}
      <div className="dashboard-kpis panel grid grid-cols-2 divide-x divide-border p-2 sm:p-4 lg:grid-cols-5" data-testid="kpis">
        <Metric id="activities" label="Activities" value={a.m.activities} prev={pv(a.pm.activities)} d={a.deltas.activities} hint="Rows with date in window" />
        <Metric id="companies" label="Unique accounts" value={a.m.companies} prev={pv(a.pm.companies)} d={a.deltas.companies} hint="Names normalised for space and case" />
        <Metric id="reps" label="Active reps" value={a.m.reps} prev={pv(a.pm.reps)} d={a.deltas.reps} hint="Distinct sales labels" />
        <Metric id="closing" label="Closing-labelled" value={a.m.closing} prev={pv(a.pm.closing)} d={a.deltas.closing} hint="Activity label, not a verified sale" />
        <Metric id="trials" label="Trial activities" value={a.m.trials} prev={pv(a.pm.trials)} d={a.deltas.trials} hint="Preparation, supervision, final presentation" />
      </div>
      <ReadFirst a={a} go={go} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Activities by representative" note={`${a.m.activities} in window`} action={<button onClick={() => go('reps')} className="text-xs text-primary underline underline-offset-4" data-testid="link-all-reps">Full report</button>}><RepTable a={a} drill={drill} /></Panel>
        <div className="space-y-4">
          <Panel title="Activity type" note="Label counts, not a funnel. Select a label to read its records."><MixDonut a={a} drill={drill} /></Panel>
          <Panel title="Company ranking" note="By recorded activities in window" action={<button onClick={() => go('companies')} className="text-xs text-primary underline underline-offset-4" data-testid="link-all-companies">Full report</button>}><CompanyTable a={a} drill={drill} /></Panel>
        </div>
      </div>
      <TrendPanel a={a} data={data} />
    </div>
  );
}
