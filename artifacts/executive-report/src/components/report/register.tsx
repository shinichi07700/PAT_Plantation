import { useMemo } from 'react';
import type { Visit } from '@workspace/api-client-react';
import { fmtDate, normName } from '@/lib/analytics';
import { DataTable, type Col } from './data-table';
import { Empty, type RegFilter } from './shared';

export function Notes({ v }: { v: Visit }) {
  return (
    <div className="grid gap-4 text-sm md:grid-cols-[2fr_1fr]">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Meeting result (original)</div>
        <p lang="id" className="mt-1 whitespace-pre-wrap leading-relaxed">{v.result || 'Blank'}</p>
        <div className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">Next agenda (original)</div>
        <p lang="id" className="mt-1 whitespace-pre-wrap leading-relaxed">{v.nextAgenda || 'Blank'}</p>
      </div>
      <dl className="space-y-1 text-[13px]">
        <div><dt className="inline text-muted-foreground">Contact: </dt><dd className="inline">{v.contact || '-'}</dd></div>
        <div><dt className="inline text-muted-foreground">Commodity: </dt><dd className="inline">{v.commodity || '-'}</dd></div>
        <div><dt className="inline text-muted-foreground">Location: </dt><dd className="inline">{v.location || '-'}</dd></div>
        <div><dt className="inline text-muted-foreground">Next date: </dt><dd className="inline">{v.nextDate ? `${fmtDate(v.nextDate)} (planned; completion untracked)` : 'Not recorded'}</dd></div>
        <div><dt className="inline text-muted-foreground">Source row: </dt><dd className="inline" data-testid={`source-row-${v.id}`}>{v.sourceRow}</dd></div>
      </dl>
    </div>
  );
}

export function RegisterView({ visits, filter, setFilter, printAll }: { visits: Visit[]; filter: RegFilter; setFilter: (f: RegFilter) => void; printAll?: boolean }) {
  const { term, type } = filter;
  const types = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of visits) { const k = normName(v.activityType); if (!m.has(k)) m.set(k, v.activityType.replace(/\s+/g, ' ').trim()); }
    return [...m.values()].sort();
  }, [visits]);
  const rows = useMemo(() => {
    const t = normName(term), ty = normName(type);
    return visits.filter((v) =>
      (!filter.field || normName(v[filter.field]) === normName(filter.value ?? '')) &&
      (!filter.start || v.date.slice(0, 10) >= filter.start) &&
      (!filter.end || v.date.slice(0, 10) <= filter.end) &&
      (!ty || normName(v.activityType) === ty) &&
      (!t || normName([v.company, v.salesName, v.contact, v.commodity, v.result, v.products, v.nextAgenda, v.location].join(' ')).includes(t)));
  }, [visits, term, type, filter.field, filter.value, filter.start, filter.end]);
  const cols: Col<Visit>[] = [
    { id: 'date', label: 'Date', sort: (v) => v.date, cell: (v) => <span className="mono whitespace-nowrap text-xs">{fmtDate(v.date)}</span> },
    { id: 'company', label: 'Account', sort: (v) => v.company, cell: (v) => <span className="font-medium">{v.company}</span> },
    { id: 'rep', label: 'Owner', sort: (v) => v.salesName, cell: (v) => v.salesName },
    { id: 'type', label: 'Activity', sort: (v) => v.activityType, cell: (v) => v.activityType },
    { id: 'products', label: 'Products field', cell: (v) => <span className="text-[13px]">{v.products?.trim() || <span className="text-muted-foreground">Not recorded</span>}</span> },
  ];
  return (
    <div className="panel p-4" data-testid="panel-register">
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        <input type="search" value={term} onChange={(e) => setFilter({ ...filter, term: e.target.value })} placeholder="Search account, rep, notes, product" aria-label="Search visits" className="min-h-11 min-w-0 basis-full rounded border border-input bg-background px-3 py-2 text-sm sm:min-h-0 sm:min-w-[240px] sm:flex-1 sm:basis-auto" data-testid="input-search" />
        <select value={type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} aria-label="Filter by activity type" className="min-h-11 w-full min-w-0 rounded border border-input bg-background px-2 py-2 text-sm sm:min-h-0 sm:w-auto" data-testid="select-activity">
          <option value="">All activity types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
          {type && !types.some((t) => normName(t) === normName(type)) && <option value={type}>{type}</option>}
        </select>
        {(term || type || filter.field || filter.start) && <button onClick={() => setFilter({ term: '', type: '' })} className="px-3 text-sm underline" data-testid="button-clear-filters">Clear filters</button>}
      </div>
      <div className="mono mb-2 text-xs text-muted-foreground" aria-live="polite" data-testid="text-row-count">
        {rows.length} matching of {visits.length} records in period.
        {filter.field && <span> {filter.field === 'salesName' ? 'Representative' : filter.field === 'company' ? 'Company' : 'Commodity'}: {filter.value || '(not recorded)'}.</span>}
        {filter.start && <span> Dates: {fmtDate(filter.start)} – {fmtDate(filter.end ?? filter.start)}.</span>}
        {(term || type) && <span> Filters: {term && `search "${term}"`} {type && `activity "${type}"`}.</span>}
      </div>
      {rows.length === 0 ? <Empty id="empty-visits">{visits.length === 0 ? 'No records exist in this window.' : 'No records match the search or filter.'}</Empty> : (
        <DataTable rows={rows} cols={cols} rowKey={(v) => v.id} pageSize={25} printAll={printAll} initialSort={{ id: 'date', dir: 'desc' }} tieBreak={(a, b) => b.sourceRow - a.sourceRow} testid="table-visits" minW={760} expand={(v) => <Notes v={v} />} />
      )}
    </div>
  );
}
