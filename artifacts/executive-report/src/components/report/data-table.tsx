import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Col<T> { id: string; label: string; sort?: (r: T) => string | number; cell: (r: T, rank: number) => ReactNode; num?: boolean; className?: string }

export function DataTable<T>({ rows, cols, rowKey, pageSize = 10, initialSort, testid, expand, printAll, minW = 520, tieBreak }: {
  rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; pageSize?: number; initialSort: { id: string; dir: 'asc' | 'desc' };
  testid: string; expand?: (r: T) => ReactNode; printAll?: boolean; minW?: number; tieBreak?: (a: T, b: T) => number;
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.id === sort.id);
    if (!c?.sort) return rows;
    const g = c.sort; const k = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = g(a), y = g(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return r * k || (tieBreak ? tieBreak(a, b) : 0);
    });
  }, [rows, cols, sort, tieBreak]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const start = cur * pageSize;
  const shown = printAll ? sorted : sorted.slice(start, start + pageSize);
  const span = cols.length + (expand ? 1 : 0);
  const primary = cols.find((c) => c.id === 'company') ?? cols.find((c) => c.id === 'name') ?? cols[0];
  return (
    <div data-testid={testid}>
      {!printAll && <div className="space-y-3 sm:hidden print:hidden">
        <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
          Sort
          <select value={`${sort.id}:${sort.dir}`} onChange={(e) => {
            const [id, dir] = e.target.value.split(':');
            setSort({ id, dir: dir as 'asc' | 'desc' }); setPage(0);
          }} className="min-h-11 min-w-0 flex-1 rounded border border-input bg-background px-2" aria-label="Sort records" data-testid={`mobile-sort-${testid}`}>
            {cols.filter((c) => c.sort).flatMap((c) => ['asc', 'desc'].map((dir) =>
              <option key={`${c.id}:${dir}`} value={`${c.id}:${dir}`}>{c.label} · {dir === 'asc' ? 'ascending' : 'descending'}</option>))}
          </select>
        </label>
        {shown.map((r, i) => {
          const id = rowKey(r), rank = start + i + 1;
          return <article key={id} className="rounded border border-border bg-background/40 p-3">
            <div className="mb-3 flex items-start gap-2">
              <span className="mono mt-0.5 text-xs text-muted-foreground">{rank}.</span>
              <div className="min-w-0 flex-1 break-words font-medium">{primary?.cell(r, rank)}</div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
              {cols.filter((c) => c.id !== primary?.id && c.id !== 'rank').map((c) =>
                <div key={c.id} className="min-w-0">
                  <dt className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</dt>
                  <dd className="break-words text-sm">{c.cell(r, rank)}</dd>
                </div>)}
            </dl>
            {expand && <>
              <button onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id} aria-controls={`mobile-notes-${id}`} className="mt-3 min-h-11 w-full rounded border border-border text-sm text-primary" data-testid={`button-mobile-notes-${id}`}>{open === id ? 'Hide meeting notes' : 'Read meeting notes'}</button>
              {open === id && <div id={`mobile-notes-${id}`} className="mt-3 border-t border-border pt-3 [overflow-wrap:anywhere]">{expand(r)}</div>}
            </>}
          </article>;
        })}
      </div>}
      <div className="hidden overflow-x-auto sm:block print:block">
        <table className="w-full text-sm" style={{ minWidth: minW }}>
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              {cols.map((c) => (
                <th key={c.id} scope="col" className={`py-2 pr-3 font-medium ${c.num ? 'text-right' : ''}`} aria-sort={sort.id === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button onClick={() => { setSort(sort.id === c.id ? { id: c.id, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { id: c.id, dir: c.num ? 'desc' : 'asc' }); setPage(0); }}
                      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground" data-testid={`sort-${testid}-${c.id}`}>
                      {c.label}{sort.id === c.id && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : c.label}
                </th>
              ))}
              {expand && <th scope="col" className="py-2 font-medium print:hidden">Notes</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const id = rowKey(r); const isOpen = open === id;
              return (
                <Fragment key={id}>
                  <tr className="row-hover border-b border-border/60 align-top">
                    {cols.map((c) => <td key={c.id} className={`py-2 pr-3 ${c.num ? 'mono text-right' : ''} ${c.className ?? ''}`}>{c.cell(r, (printAll ? 0 : start) + i + 1)}</td>)}
                    {expand && (
                      <td className="py-2 print:hidden">
                        <button onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen} aria-controls={`notes-${id}`} className="text-xs text-primary underline underline-offset-4" data-testid={`button-notes-${id}`}>{isOpen ? 'Hide notes' : 'Read notes'}</button>
                      </td>
                    )}
                  </tr>
                  {expand && (isOpen || printAll) && (
                    <tr id={`notes-${id}`} className="border-b border-border bg-muted/40"><td colSpan={span} className="px-3 py-4">{expand(r)}</td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!printAll && sorted.length > pageSize && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground print:hidden">
          <span className="mono" aria-live="polite">{start + 1} - {Math.min(start + pageSize, sorted.length)} / {sorted.length}</span>
          <button onClick={() => setPage(cur - 1)} disabled={cur === 0} aria-label="Previous page" className="flex min-h-11 min-w-11 items-center justify-center rounded p-1 hover:bg-muted disabled:opacity-30 sm:min-h-0 sm:min-w-0" data-testid={`prev-${testid}`}><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1} aria-label="Next page" className="flex min-h-11 min-w-11 items-center justify-center rounded p-1 hover:bg-muted disabled:opacity-30 sm:min-h-0 sm:min-w-0" data-testid={`next-${testid}`}><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
