import type { ReportData } from '@workspace/api-client-react';
import { coverage, fmtDate, monthLabel, normName, type Analysis } from '@/lib/analytics';
import { Empty, Panel, type Drill } from './shared';

const D = 86400000;
const n = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / D;
const f = (x: number) => new Date(x * D).toISOString().slice(0, 10);

export function HeatmapView({ a, data, drill }: { a: Analysis; data: ReportData; drill: Drill }) {
  const { cur } = a.period;
  const days = n(cur.end) - n(cur.start) + 1;
  const weekly = days <= 45;
  const buckets: { label: string; start: string; end: string }[] = [];
  if (weekly) {
    for (let s = n(cur.start), i = 1; s <= n(cur.end); s += 7, i++) buckets.push({ label: `Wk ${i}`, start: f(s), end: f(Math.min(s + 6, n(cur.end))) });
  } else {
    let ym = cur.start.slice(0, 7);
    while (ym <= cur.end.slice(0, 7)) {
      const [y, m] = ym.split('-').map(Number);
      const start = `${ym}-01`, end = f(Date.UTC(y, m, 0) / D);
      buckets.push({ label: monthLabel(ym).split(' ')[0], start: start < cur.start ? cur.start : start, end: end > cur.end ? cur.end : end });
      ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
  }
  const reps = a.reps.filter((r) => r.n > 0);
  const cell = (rep: string, b: { start: string; end: string }) => a.curVisits.filter((v) => normName(v.salesName) === normName(rep) && v.date.slice(0, 10) >= b.start && v.date.slice(0, 10) <= b.end).length;
  const grid = reps.map((r) => buckets.map((b) => (coverage(b, data.coverageStart, data.coverageEnd) === 'none' ? null : cell(r.label, b))));
  const max = Math.max(1, ...grid.flat().map((x) => x ?? 0));
  return (
    <Panel title="Heat map: representative by period" note={`${weekly ? 'Weekly' : 'Monthly'} groups of recorded activity. Grey n/a cells lie outside the recorded date span: unknown, not zero.`} id="heatmap">
      {reps.length === 0 ? <Empty id="empty-heatmap">No activity recorded in this window.</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-sm" data-testid="table-heatmap" style={{ minWidth: 120 + buckets.length * 56 }}>
              <caption className="sr-only">Activity count per representative and period</caption>
              <thead><tr><th scope="col" className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Representative</th>{buckets.map((b) => <th key={b.start} scope="col" title={`${fmtDate(b.start)} - ${fmtDate(b.end)}`} className="text-[11px] font-medium text-muted-foreground">{b.label}</th>)}<th scope="col" className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total</th></tr></thead>
              <tbody>
                {reps.map((r, i) => (
                  <tr key={r.label}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-left font-normal"><button onClick={() => drill({ field: 'salesName', value: r.label })} className="rounded-sm hover:text-primary hover:underline" aria-label={`Open ${r.label}'s records in the visit register`}>{r.label}</button></th>
                    {grid[i].map((c, j) => (
                      <td key={buckets[j].start} title={c === null ? 'Outside recorded span: unknown' : `${r.label}, ${fmtDate(buckets[j].start)} - ${fmtDate(buckets[j].end)}: ${c}`}
                        className="mono h-9 rounded text-center text-xs" style={c === null ? { background: 'hsl(var(--muted) / .4)', color: 'hsl(var(--muted-foreground))' } : { background: c ? `hsl(var(--primary) / ${0.14 + 0.78 * (c / max)})` : 'hsl(var(--muted) / .5)', color: c / max > 0.55 ? 'hsl(var(--primary-foreground))' : undefined }}>
                        {c === null ? 'n/a' : <button className="h-full w-full rounded hover:ring-1 hover:ring-primary" aria-label={`Open ${c} records for ${r.label}, ${fmtDate(buckets[j].start)} to ${fmtDate(buckets[j].end)}`} onClick={() => drill({ field: 'salesName', value: r.label, start: buckets[j].start, end: buckets[j].end })}>{c}</button>}
                      </td>
                    ))}
                    <td className="mono text-right text-xs font-medium">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">Fewer<span className="h-2.5 w-24 rounded-sm" style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / .14), hsl(var(--primary) / .92))' }} />More (max {max} in a cell)</p>
        </>
      )}
    </Panel>
  );
}
