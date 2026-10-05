import type { ReactNode } from 'react';
import { BarChart3, Building2, ClipboardList, FileText, Grid3x3, LayoutDashboard, Printer, RefreshCw, Sprout, Users } from 'lucide-react';
import type { ReportData } from '@workspace/api-client-react';
import { fmtDate } from '@/lib/analytics';
import { stamp, type ViewId } from './shared';

export const NAV: { id: ViewId; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'register', label: 'Detail Table', icon: ClipboardList },
  { id: 'reps', label: 'Sales Report', icon: Users },
  { id: 'companies', label: 'Company Report', icon: Building2 },
  { id: 'commodities', label: 'Commodity Report', icon: Sprout },
  { id: 'heatmap', label: 'Heat Map', icon: Grid3x3 },
  { id: 'brief', label: 'Board Brief', icon: FileText },
];

export function Shell({ data, view, setView, onRefresh, refreshing, refreshError, onPrint, children }: {
  data: ReportData; view: ViewId; setView: (v: ViewId) => void; onRefresh: () => void; refreshing: boolean; refreshError: boolean; onPrint: () => void; children: ReactNode;
}) {
  const btn = 'inline-flex min-h-11 items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60 sm:min-h-0';
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[216px_minmax(0,1fr)] print:block">
      <aside className="border-b border-border bg-sidebar print:hidden lg:sticky lg:top-0 lg:h-[100dvh] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-3 lg:py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground"><Sprout className="h-4 w-4" /></span>
          <div className="leading-tight"><div className="text-sm font-semibold">Plantation Report</div><div className="text-[11px] text-muted-foreground">PT Prima Agro Tech</div></div>
          <select value={view} onChange={(e) => setView(e.target.value as ViewId)} aria-label="Choose report view" className="ml-auto min-h-11 max-w-[45%] rounded border border-input bg-sidebar px-2 text-sm sm:hidden" data-testid="select-mobile-view">
            {NAV.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </div>
        <nav aria-label="Report views" className="hidden gap-1 overflow-x-auto px-2 pb-2 sm:flex lg:flex-col lg:px-3 lg:pb-0">
          {NAV.map((n) => {
            const on = view === n.id; const Icon = n.icon;
            return (
              <button key={n.id} onClick={() => setView(n.id)} aria-current={on ? 'page' : undefined} data-testid={`nav-${n.id}`}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-3 py-2 text-sm ${on ? 'bg-primary/15 font-medium text-primary' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'}`}>
                <Icon className="h-4 w-4" />{n.label}
              </button>
            );
          })}
        </nav>
        <div className="hidden space-y-2 border-t border-sidebar-border px-4 py-4 text-[11px] text-muted-foreground lg:mt-6 lg:block">
          <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${data.mode === 'live' ? 'bg-chart-4' : 'bg-ochre'}`} /><span className="mono font-medium uppercase tracking-widest text-foreground" data-testid="status-mode">{data.mode === 'live' ? 'Live' : 'Snapshot'}</span></div>
          <div data-testid="text-fetched">Fetched {stamp(data.fetchedAt)} WIB</div>
          <div>Recorded {fmtDate(data.coverageStart)} to {fmtDate(data.coverageEnd)}</div>
          <div>Today {fmtDate(data.today)} ({data.timezone})</div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-1 print:hidden sm:px-6 sm:py-2">
          <span className="text-[11px] text-muted-foreground lg:hidden" title={`Fetched ${stamp(data.fetchedAt)} WIB`}>
            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${data.mode === 'live' ? 'bg-chart-4' : 'bg-ochre'}`} />
            {data.mode === 'live' ? 'Live' : 'Snapshot'}<span className="hidden sm:inline"> / {stamp(data.fetchedAt)} WIB</span>
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={onRefresh} disabled={refreshing} className={btn} data-testid="button-refresh" aria-label="Refresh from source"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /><span className="sm:hidden">{refreshing ? 'Refreshing…' : 'Refresh'}</span><span className="hidden sm:inline">{refreshing ? 'Refreshing source...' : 'Refresh from source'}</span></button>
            <button onClick={onPrint} className={btn} data-testid="button-print" aria-label="Print board report"><Printer className="h-3.5 w-3.5" /><span className="sm:hidden">Print</span><span className="hidden sm:inline">Print board report</span></button>
          </div>
        </div>
        {(data.syncError || refreshError) && (
          <div className="flex flex-wrap items-center gap-3 border-b border-clay/60 bg-accent px-4 py-2 text-sm print:hidden sm:px-6" role="alert" data-testid="banner-sync-error">
            <span className="font-medium text-clay">Sync problem</span>
            <span>{refreshError ? 'Refresh failed. Showing the last data loaded.' : `Source sync reported: ${data.syncError}. Showing ${data.mode} data.`}</span>
            <button onClick={onRefresh} className="ml-auto underline" data-testid="button-retry-refresh">Try again</button>
          </div>
        )}
        <main className="report-main mx-auto max-w-[1280px] px-3 pb-16 pt-4 sm:px-6 sm:pt-5 print:px-0 print:pt-0">{children}</main>
      </div>
      <nav aria-label="Quick report navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-sidebar sm:hidden print:hidden">
        {(['overview', 'register', 'companies', 'brief'] as ViewId[]).map((id) => {
          const item = NAV.find((n) => n.id === id)!;
          const Icon = item.icon;
          const label = id === 'overview' ? 'Dashboard' : id === 'register' ? 'Records' : id === 'companies' ? 'Companies' : 'Board brief';
          return <button key={id} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${view === id ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`mobile-nav-${id}`}><Icon className="h-5 w-5" />{label}</button>;
        })}
      </nav>
    </div>
  );
}
