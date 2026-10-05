import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetReportDataQueryKey, useGetReportData, useRefreshReportData } from '@workspace/api-client-react';
import type { ReportData } from '@workspace/api-client-react';
import { analyze, defaultSel, type Sel } from '@/lib/analytics';
import { Shell, NAV } from '@/components/report/shell';
import { PeriodBar, PrintHeader } from '@/components/report/period-bar';
import { OverviewView } from '@/components/report/overview';
import { RegisterView } from '@/components/report/register';
import { CommoditiesView, CompaniesView, RepsView } from '@/components/report/group-views';
import { HeatmapView } from '@/components/report/heatmap';
import { BriefView } from '@/components/report/brief';
import type { Drill, RegFilter, ViewId } from '@/components/report/shared';

const IDS = NAV.map((n) => n.id);
const fromHash = (): ViewId => { const h = window.location.hash.replace('#', '') as ViewId; return IDS.includes(h) ? h : 'overview'; };

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1180px] animate-pulse space-y-4 px-5 py-10" data-testid="state-loading">
      <div className="h-10 w-1/2 rounded bg-muted" />
      <div className="h-24 rounded bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2"><div className="h-72 rounded bg-muted" /><div className="h-72 rounded bg-muted" /></div>
    </div>
  );
}

export default function ReportPage() {
  const qc = useQueryClient();
  const q = useGetReportData();
  const refresh = useRefreshReportData({ mutation: { onSuccess: (data) => { qc.setQueryData(getGetReportDataQueryKey(), data); } } });
  const [selState, setSel] = useState<Sel | null>(null);
  const data = q.data;
  if (q.isLoading) return <Skeleton />;
  if (q.isError || !data) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24" data-testid="state-error">
        <h1 className="text-2xl font-semibold">The report data could not be loaded</h1>
        <p className="mt-3 text-sm text-muted-foreground">The source did not respond. No figures are shown rather than showing stale or invented ones.</p>
        <button className="mt-6 rounded bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => q.refetch()} data-testid="button-retry">Retry</button>
      </div>
    );
  }
  return <ReportBody data={data} sel={selState ?? defaultSel(data)} usingDefault={selState === null} setSel={setSel} onRefresh={() => refresh.mutate()} refreshing={refresh.isPending} refreshError={refresh.isError} />;
}

function ReportBody({ data, sel, usingDefault, setSel, onRefresh, refreshing, refreshError }: {
  data: ReportData; sel: Sel; usingDefault: boolean; setSel: (s: Sel) => void; onRefresh: () => void; refreshing: boolean; refreshError: boolean;
}) {
  const a = useMemo(() => analyze(data, sel), [data, sel]);
  const [view, setViewState] = useState<ViewId>(fromHash);
  const [reg, setReg] = useState<RegFilter>({ term: '', type: '' });
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const on = () => setViewState(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const setView = useCallback((v: ViewId) => { window.history.replaceState(null, '', `#${v}`); setViewState(v); window.scrollTo({ top: 0 }); }, []);
  const drill: Drill = useCallback((f) => { setReg({ ...f, term: f.term ?? '', type: f.type ?? '' }); setView('register'); }, [setView]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const t = window.setTimeout(() => window.print(), 150);
    return () => { window.clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printing]);

  const title = NAV.find((n) => n.id === view)?.label ?? '';
  const views: Record<ViewId, ReactElement> = {
    overview: <OverviewView a={a} data={data} drill={drill} go={setView} />,
    register: <RegisterView visits={a.curVisits} filter={printing ? { term: '', type: '' } : reg} setFilter={setReg} printAll={printing} />,
    reps: <RepsView a={a} drill={drill} printAll={printing} />,
    companies: <CompaniesView a={a} data={data} drill={drill} printAll={printing} />,
    commodities: <CommoditiesView a={a} drill={drill} printAll={printing} />,
    heatmap: <HeatmapView a={a} data={data} drill={drill} />,
    brief: <BriefView a={a} data={data} />,
  };

  return (
    <Shell data={data} view={view} setView={setView} onRefresh={onRefresh} refreshing={refreshing} refreshError={refreshError} onPrint={() => setPrinting(true)}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title === 'Dashboard' ? 'Field visit dashboard' : title}</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground"><span className="sm:hidden">Recorded visits, not revenue or verified sales.</span><span className="hidden sm:inline">{data.sourceTitle}. Counts are recorded activity from the visit log, not revenue, verified sales or pipeline stages.</span></p>
        </div>
      </header>
      <PrintHeader data={data} a={a} />
      <div className="space-y-4">
        <PeriodBar data={data} sel={sel} setSel={setSel} usingDefault={usingDefault} a={a} />
        <div key={`${a.period.key}-${printing ? 'p' : view}`} className="rise">
          {printing ? (
            <div className="space-y-8">
              {NAV.map((n) => <div key={n.id}><h2 className="mb-2 text-lg font-semibold">{n.label}</h2>{views[n.id]}</div>)}
            </div>
          ) : views[view]}
        </div>
      </div>
    </Shell>
  );
}
