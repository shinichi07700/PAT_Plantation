import { useState, useMemo } from 'react';
import { Target, Calendar, CheckCircle2, AlertCircle, Clock, Users, Zap } from 'lucide-react';
import { computePacing, type Analysis, type Period } from '@/lib/analytics';
import { DataTable, type Col } from './data-table';
import { DrillBtn, Panel, type Drill } from './shared';

export function PacingCadencePanel({
  a,
  drill,
  printAll,
}: {
  a: Analysis;
  drill: Drill;
  printAll?: boolean;
}) {
  const [monthlyTarget, setMonthlyTarget] = useState<number>(20);

  // Recompute pacing based on user-selected monthly benchmark
  const pacing = useMemo(() => {
    return computePacing(a.curVisits, a.reps, a.period, monthlyTarget);
  }, [a.curVisits, a.reps, a.period, monthlyTarget]);

  const p = a.period;
  const isNoCov = p.curCov === 'none';

  const rows = pacing.reps.filter((r) => r.visits > 0 || r.prevVisits > 0);

  const cols: Col<(typeof rows)[number]>[] = [
    {
      id: 'name',
      label: 'Representative',
      sort: (r) => r.rep,
      cell: (r) => (
        <DrillBtn
          onClick={() => drill({ field: 'salesName', value: r.rep })}
          label={`Open ${r.rep}'s records in the visit register`}
        >
          {r.rep}
        </DrillBtn>
      ),
    },
    {
      id: 'visits',
      label: 'Visits',
      num: true,
      sort: (r) => r.visits,
      cell: (r) => <span className="font-semibold">{r.visits}</span>,
    },
    {
      id: 'activeDays',
      label: 'Active Days',
      num: true,
      sort: (r) => r.activeDays,
      cell: (r) => <span className="mono text-xs">{r.activeDays} d</span>,
    },
    {
      id: 'cadence',
      label: 'Visits / Day',
      num: true,
      sort: (r) => r.visitsPerActiveDay,
      cell: (r) => (
        <span className="mono text-xs">
          {r.visitsPerActiveDay > 0 ? `${r.visitsPerActiveDay.toFixed(1)} /d` : '-'}
        </span>
      ),
    },
    {
      id: 'accounts',
      label: 'Accounts',
      num: true,
      sort: (r) => r.accountsVisited,
      cell: (r) => <span className="mono text-xs">{r.accountsVisited}</span>,
    },
    {
      id: 'progress',
      label: 'Pacing vs Target',
      sort: (r) => r.pacingPct,
      cell: (r) => {
        const pct = Math.min(150, r.pacingPct);
        const expectedPct = Math.min(100, Math.round(pacing.elapsedRatio * 100));
        return (
          <div className="w-36 space-y-1">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  r.status === 'ahead'
                    ? 'bg-chart-4'
                    : r.status === 'on_track'
                    ? 'bg-primary'
                    : 'bg-ochre'
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
              {/* Expected pace marker */}
              {p.inProgress && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/60"
                  style={{ left: `${expectedPct}%` }}
                  title={`Elapsed period marker: ${expectedPct}%`}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{r.pacingPct}%</span>
              <span>tgt {r.expectedPace}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'status',
      label: 'Status',
      sort: (r) => r.status,
      cell: (r) => {
        if (r.status === 'ahead') {
          return (
            <span className="inline-flex items-center gap-1 rounded bg-chart-4/15 px-2 py-0.5 text-[11px] font-medium text-chart-4">
              <CheckCircle2 className="h-3 w-3" /> Ahead
            </span>
          );
        }
        if (r.status === 'on_track') {
          return (
            <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Clock className="h-3 w-3" /> On Track
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded bg-ochre/20 px-2 py-0.5 text-[11px] font-medium text-ochre">
            <AlertCircle className="h-3 w-3" /> Behind
          </span>
        );
      },
    },
  ];

  const totalActiveRepDays = pacing.reps.reduce((acc, r) => acc + r.activeDays, 0);
  const avgVisitsPerDay =
    totalActiveRepDays > 0 ? (pacing.totalTeamActual / totalActiveRepDays).toFixed(1) : '0.0';

  return (
    <Panel
      title="Target pacing & field cadence"
      note="Benchmarks actual recorded visits against elapsed period timeline. Configurable monthly target."
      id="pacing-cadence"
      action={
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Benchmark:</span>
          <div className="inline-flex rounded-md border border-input p-0.5 bg-background">
            {[15, 20, 25].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setMonthlyTarget(val)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                  monthlyTarget === val
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {val}/mo
              </button>
            ))}
          </div>
        </div>
      }
    >
      {isNoCov ? (
        <p className="rounded border border-dashed border-border p-4 text-xs text-muted-foreground">
          Dates lie outside recorded source coverage. Pacing is unavailable.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border/70 bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span>Team Pacing</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="mono text-2xl font-semibold">
                  {pacing.teamPacingPct}%
                </span>
                <span
                  className={`text-xs font-medium ${
                    pacing.teamStatus === 'ahead'
                      ? 'text-chart-4'
                      : pacing.teamStatus === 'on_track'
                      ? 'text-primary'
                      : 'text-ochre'
                  }`}
                >
                  {pacing.teamStatus === 'ahead'
                    ? 'Ahead'
                    : pacing.teamStatus === 'on_track'
                    ? 'On Track'
                    : 'Behind'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {pacing.totalTeamActual} of {pacing.totalTeamTarget} expected visits
              </p>
            </div>

            <div className="rounded-md border border-border/70 bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Period Elapsed</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="mono text-2xl font-semibold">
                  {Math.round(pacing.elapsedRatio * 100)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {pacing.elapsedDays} / {pacing.totalPeriodDays} d
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Target pace: {pacing.expectedVisitsPerRep} visits/rep
              </p>
            </div>

            <div className="rounded-md border border-border/70 bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>Field Days</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="mono text-2xl font-semibold">
                  {totalActiveRepDays}
                </span>
                <span className="text-xs text-muted-foreground">rep-days</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Across {pacing.activeRepsCount} active reps
              </p>
            </div>

            <div className="rounded-md border border-border/70 bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>Field Density</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="mono text-2xl font-semibold">
                  {avgVisitsPerDay}
                </span>
                <span className="text-xs text-muted-foreground">visits/day</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Average visits per active day
              </p>
            </div>
          </div>

          {/* Reps Detail Table */}
          <DataTable
            rows={rows}
            cols={cols}
            rowKey={(r) => r.rep}
            pageSize={10}
            printAll={printAll}
            initialSort={{ id: 'visits', dir: 'desc' }}
            testid="table-rep-pacing"
            minW={640}
          />
        </div>
      )}
    </Panel>
  );
}
