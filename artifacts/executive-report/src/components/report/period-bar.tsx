import type { ReportData } from '@workspace/api-client-react';
import { useState } from 'react';
import { buildPeriod, defaultSel, fmtDate, fmtRange, monthLabel, monthOptions, quarterOptions, yearOptions, type Analysis, type Sel } from '@/lib/analytics';
import { covText } from './shared';

export function PeriodBar({ data, sel, setSel, usingDefault, a }: { data: ReportData; sel: Sel; setSel: (s: Sel) => void; usingDefault: boolean; a: Analysis }) {
  const p = a.period;
  const [expanded, setExpanded] = useState(false);
  const ty = Number(data.today.slice(0, 4));
  const tq = Math.ceil(Number(data.today.slice(5, 7)) / 3);
  const thisYm = data.today.slice(0, 7);
  const lastYm = buildPeriod({ mode: 'month', ym: thisYm }, data).prev.start.slice(0, 7);
  const def = defaultSel(data);
  const defYm = def.mode === 'month' ? def.ym : lastYm;
  const tabs = [
    { id: 'mtd', label: 'This month', active: sel.mode === 'month' && sel.ym === thisYm, go: () => setSel({ mode: 'month', ym: thisYm }) },
    { id: 'last', label: 'Last month', active: sel.mode === 'month' && sel.ym === lastYm, go: () => setSel({ mode: 'month', ym: lastYm }) },
    { id: 'quarter', label: 'Quarter summary', active: sel.mode === 'quarter', go: () => setSel({ mode: 'quarter', y: ty, q: tq }) },
    { id: 'ytd', label: 'Year to date', active: sel.mode === 'year', go: () => setSel({ mode: 'year', y: ty }) },
  ];
  const selCls = 'min-h-11 min-w-0 rounded border border-input bg-card px-2 py-1.5 text-sm sm:min-h-0';
  return (
    <div className="panel p-3 print:hidden" data-testid="controls">
      <div className="mb-2 flex items-center justify-between gap-2 sm:hidden">
        <span className="text-sm font-semibold">{p.title}{usingDefault && <span className="ml-2 text-[10px] font-normal text-muted-foreground">Latest recorded month</span>}</span>
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="period-extra-controls" className="min-h-11 px-2 text-xs text-primary" data-testid="button-mobile-period-filters">{expanded ? 'Close filters' : 'Filters & dates'}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Reporting period" className="grid w-full grid-cols-4 gap-1 rounded-md bg-muted p-1 sm:flex sm:w-auto sm:flex-wrap">
          {tabs.map((t) => (
            <button key={t.id} aria-pressed={t.active} onClick={t.go} data-testid={`tab-${t.id}`}
              className={`min-h-11 rounded px-1 py-1.5 text-xs sm:min-h-0 sm:px-3 sm:text-sm ${t.active ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><span className="sm:hidden">{t.id === 'quarter' ? 'Quarter' : t.id === 'ytd' ? 'YTD' : t.label}</span><span className="hidden sm:inline">{t.label}</span></button>
          ))}
        </div>
        <div id="period-extra-controls" className={`${expanded ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 sm:contents`}>
        <button onClick={() => setSel({ mode: 'month', ym: defYm })} className="min-h-11 rounded border border-input px-3 py-1.5 text-sm hover:bg-muted sm:min-h-0" data-testid="button-latest-complete">Latest complete month</button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Month
          <select className={selCls} value={sel.mode === 'month' ? sel.ym : ''} onChange={(e) => e.target.value && setSel({ mode: 'month', ym: e.target.value })} data-testid="select-month">
            {sel.mode !== 'month' && <option value="">Choose</option>}
            {monthOptions(data).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Quarter
          <select className={selCls} value={sel.mode === 'quarter' ? `${sel.y}-${sel.q}` : ''} onChange={(e) => { if (!e.target.value) return; const [y, qq] = e.target.value.split('-').map(Number); setSel({ mode: 'quarter', y, q: qq }); }} data-testid="select-quarter">
            {sel.mode !== 'quarter' && <option value="">Choose</option>}
            {quarterOptions(data).map((o) => <option key={`${o.y}-${o.q}`} value={`${o.y}-${o.q}`}>Q{o.q} {o.y}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Year
          <select className={selCls} value={sel.mode === 'year' ? sel.y : ''} onChange={(e) => e.target.value && setSel({ mode: 'year', y: Number(e.target.value) })} data-testid="select-year">
            {sel.mode !== 'year' && <option value="">Choose</option>}
            {yearOptions(data).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground sm:hidden">
        <p className="mono text-foreground">{fmtRange(p.cur)}</p>
        <p>vs {fmtRange(p.prev)}{p.inProgress && ' · equal elapsed days'}</p>
        {(p.curCov !== 'full' || p.prevCov !== 'full') && <p className="text-ochre">Limited recorded dates; comparison may be unavailable.</p>}
      </div>
      <div className={`${expanded ? 'grid' : 'hidden'} mt-3 gap-x-8 gap-y-1 text-xs text-muted-foreground sm:grid sm:grid-cols-2`} data-testid="window-summary">
        <div><span className="text-sm font-semibold text-foreground">{p.title}</span> <span className="uppercase tracking-wider">{p.kind}</span> <span className="mono text-foreground">{fmtRange(p.cur)}</span><br />{p.inProgress ? `In progress; nominal period ends ${fmtDate(p.nominalEnd)}.` : 'Complete period.'} {covText[p.curCov]}.</div>
        <div><span className="uppercase tracking-wider">Compared with</span> <span className="mono text-foreground">{fmtRange(p.prev)}</span><br />{p.compareRule} {covText[p.prevCov]}.</div>
      </div>
      {usingDefault && (
        <p className={`${expanded ? 'block' : 'hidden'} mt-2 border-t border-border pt-2 text-xs text-muted-foreground sm:block`} data-testid="text-default-note">
          Opened on the latest complete recorded month ({monthLabel(defYm)}). Today is {fmtDate(data.today)}; this is not the current month.
        </p>
      )}
    </div>
  );
}

export function PrintHeader({ data, a }: { data: ReportData; a: Analysis }) {
  return (
    <div className="print-only mb-4 border-y border-border py-2 text-xs">
      <b>{a.period.title}</b> ({fmtRange(a.period.cur)}), compared with {fmtRange(a.period.prev)}.<br />
      {data.sourceTitle} · {data.mode === 'live' ? 'Live source read' : 'Saved snapshot'} · Fetched {new Date(data.fetchedAt).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' })} WIB.<br />
      Recorded dates: {fmtDate(data.coverageStart)} to {fmtDate(data.coverageEnd)}. Report prepared {fmtDate(data.today)}.<br />
      {data.syncError && <p>Source refresh unavailable: {data.syncError}. This report uses saved data.</p>}
    </div>
  );
}
