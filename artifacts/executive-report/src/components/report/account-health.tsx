import { useState, useMemo } from 'react';
import { AlertTriangle, Clock, ShieldAlert, Sparkles, Building2, Search, ArrowRight } from 'lucide-react';
import { fmtDate, type Analysis } from '@/lib/analytics';
import { DataTable, type Col } from './data-table';
import { DrillBtn, Panel, type Drill } from './shared';

export function AccountHealthPanel({
  a,
  drill,
  printAll,
}: {
  a: Analysis;
  drill: Drill;
  printAll?: boolean;
}) {
  const h = a.accountHealth;
  const [tab, setTab] = useState<'dormant' | 'cooling' | 'strategic' | 'single' | 'all'>(
    h.dormantKeyAccounts.length > 0 ? 'dormant' : 'all'
  );
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    let base = h.allAccounts;
    if (tab === 'dormant') {
      base = h.dormantKeyAccounts;
    } else if (tab === 'cooling') {
      base = h.coolingAccounts;
    } else if (tab === 'strategic') {
      base = h.allAccounts.filter((x) => x.tier === 'tier1' || x.tier === 'tier2');
    } else if (tab === 'single') {
      base = h.allAccounts.filter((x) => x.tier === 'tier3');
    }

    if (!search.trim()) return base;
    const q = search.toLowerCase().trim();
    return base.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.latest.salesName.toLowerCase().includes(q) ||
        x.latest.activityType.toLowerCase().includes(q)
    );
  }, [h, tab, search]);

  const cols: Col<(typeof items)[number]>[] = [
    {
      id: 'name',
      label: 'Account Name',
      sort: (r) => r.name,
      cell: (r) => (
        <div>
          <DrillBtn
            onClick={() => drill({ field: 'company', value: r.key })}
            label={`Open all visit records for ${r.name}`}
          >
            {r.name}
          </DrillBtn>
          <div className="text-[11px] text-muted-foreground">
            {r.windowVisits > 0
              ? `${r.windowVisits} in period / ${r.totalVisits} total`
              : `${r.totalVisits} total (not in current window)`}
          </div>
        </div>
      ),
    },
    {
      id: 'tier',
      label: 'Tier / Depth',
      sort: (r) => (r.tier === 'tier1' ? 3 : r.tier === 'tier2' ? 2 : 1),
      cell: (r) => {
        if (r.tier === 'tier1') {
          return (
            <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" /> Tier 1 (Key)
            </span>
          );
        }
        if (r.tier === 'tier2') {
          return (
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              Tier 2 (Growing)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            Tier 3 (Prospect)
          </span>
        );
      },
    },
    {
      id: 'daysSilent',
      label: 'Days Silent',
      num: true,
      sort: (r) => r.daysSinceLastVisit,
      cell: (r) => {
        const d = r.daysSinceLastVisit;
        if (r.healthStatus === 'dormant') {
          return (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center gap-1 rounded bg-clay/20 px-1.5 py-0.5 text-xs font-semibold text-clay">
                <ShieldAlert className="h-3 w-3" /> {d} d silent
              </span>
              <span className="text-[10px] text-muted-foreground">&gt; 60 days</span>
            </div>
          );
        }
        if (r.healthStatus === 'cooling') {
          return (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center gap-1 rounded bg-ochre/20 px-1.5 py-0.5 text-xs font-medium text-ochre">
                <Clock className="h-3 w-3" /> {d} d silent
              </span>
              <span className="text-[10px] text-muted-foreground">31–60 days</span>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-end">
            <span className="inline-flex items-center gap-1 rounded bg-chart-4/15 px-1.5 py-0.5 text-xs font-medium text-chart-4">
              Active ({d} d)
            </span>
            <span className="text-[10px] text-muted-foreground">≤ 30 days</span>
          </div>
        );
      },
    },
    {
      id: 'lastVisit',
      label: 'Last Recorded Visit',
      sort: (r) => r.latest.date,
      cell: (r) => (
        <div className="text-xs">
          <div className="mono font-medium">{fmtDate(r.latest.date)}</div>
          <div className="text-muted-foreground">{r.latest.activityType}</div>
        </div>
      ),
    },
    {
      id: 'rep',
      label: 'Owner',
      sort: (r) => r.latest.salesName,
      cell: (r) => <span className="text-xs">{r.latest.salesName}</span>,
    },
    {
      id: 'nextAgenda',
      label: 'Last Agenda / Follow-up',
      cell: (r) => (
        <div className="max-w-[240px] text-xs">
          <p className="line-clamp-2 italic text-muted-foreground">
            {r.latest.nextAgenda || r.latest.result || 'No notes'}
          </p>
          {r.latest.nextDate && (
            <div className="mono mt-0.5 text-[10px] text-muted-foreground">
              Planned: {fmtDate(r.latest.nextDate)}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Panel
      title="Key account health & dormancy tracking"
      note={`Evaluates account engagement and dormancy across the full client portfolio as of ${fmtDate(
        h.asOf
      )}.`}
      id="account-health"
    >
      {a.period.curCov === 'none' ? (
        <p className="rounded border border-dashed border-border p-4 text-xs text-muted-foreground">
          Selected period lies outside recorded source coverage. Account health status is unknown, not zero.
        </p>
      ) : (
        <div className="space-y-4">
        {/* KPI Banner */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Key Accounts (T1)</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-2xl font-semibold">{h.tier1Count}</span>
              <span className="text-xs text-muted-foreground">accounts (≥4 visits)</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {h.recurringCount} total recurring accounts
            </p>
          </div>

          <div
            className={`rounded-md border p-3 ${
              h.dormantKeyAccounts.length > 0
                ? 'border-clay/40 bg-clay/5'
                : 'border-border/70 bg-card'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-clay">
              <ShieldAlert className="h-3.5 w-3.5 text-clay" />
              <span>Dormant Key Accounts</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-2xl font-semibold text-clay">
                {h.dormantKeyAccounts.length}
              </span>
              <span className="text-xs font-medium text-clay">Action Needed</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              ≥2 historical visits, silent &gt; 60 days
            </p>
          </div>

          <div className="rounded-md border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ochre">
              <Clock className="h-3.5 w-3.5 text-ochre" />
              <span>Cooling Down</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-2xl font-semibold">{h.coolingCount}</span>
              <span className="text-xs text-muted-foreground">accounts (31-60d)</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Approaching dormancy threshold
            </p>
          </div>

          <div className="rounded-md border border-border/70 bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Single-Touch Ratio</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="mono text-2xl font-semibold">{h.singleVisitPct}%</span>
              <span className="text-xs text-muted-foreground">
                ({h.tier3Count} / {h.totalAccounts})
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Accounts visited only once (leads)
            </p>
          </div>
        </div>

        {/* Filter Tabs and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('dormant')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === 'dormant'
                  ? 'bg-clay/20 text-clay border border-clay/30'
                  : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Dormant Key Accounts ({h.dormantKeyAccounts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('cooling')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === 'cooling'
                  ? 'bg-ochre/20 text-ochre border border-ochre/30'
                  : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Cooling ({h.coolingAccounts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('strategic')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === 'strategic'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Strategic Accounts ({h.recurringCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('single')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === 'single'
                  ? 'bg-muted text-foreground border border-border'
                  : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <span>Single-Touch ({h.tier3Count})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('all')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === 'all'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <span>All Portfolio ({h.totalAccounts})</span>
            </button>
          </div>

          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search account, rep..."
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          rows={items}
          cols={cols}
          rowKey={(r) => r.key}
          pageSize={10}
          printAll={printAll}
          initialSort={{ id: 'daysSilent', dir: 'desc' }}
          testid="table-account-health"
          minW={740}
        />
      </div>
      )}
    </Panel>
  );
}
