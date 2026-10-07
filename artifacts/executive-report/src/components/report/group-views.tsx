import type { Analysis } from '@/lib/analytics';
import { compareDelta, fmtDate, normName } from '@/lib/analytics';
import { groupVisits } from '@/lib/groups';
import { DataTable, type Col } from './data-table';
import { Bar, DeltaTag, DrillBtn, Empty, Panel, type Drill } from './shared';
import { AccountsReview } from './brief';
import { CompanyTable, MixDonut, RepTable } from './overview';
import type { ReportData } from '@workspace/api-client-react';

import { PacingCadencePanel } from './pacing-cadence';
import { AccountHealthPanel } from './account-health';

export function RepsView({ a, drill, printAll }: { a: Analysis; drill: Drill; printAll?: boolean }) {
  const noPrev = a.period.prevCov === 'none';
  const rows = a.reps.filter((r) => r.n > 0 || r.prev > 0);
  const closing = (name: string) => a.curVisits.filter((v) => normName(v.salesName) === normName(name) && /closing/i.test(v.activityType)).length;
  const cols: Col<(typeof rows)[number]>[] = [
    { id: 'name', label: 'Representative', sort: (r) => r.label, cell: (r) => <DrillBtn onClick={() => drill({ field: 'salesName', value: r.label })} label={`Open ${r.label}'s records in the visit register`}>{r.label}</DrillBtn> },
    { id: 'n', label: 'Visits', num: true, sort: (r) => r.n, cell: (r) => <b>{r.n}</b> },
    { id: 'prev', label: 'Prev', num: true, sort: (r) => r.prev, cell: (r) => <span className="text-muted-foreground">{noPrev ? 'n/a' : r.prev}</span> },
    { id: 'cos', label: 'Accounts', num: true, sort: (r) => r.companies, cell: (r) => r.companies },
    { id: 'closing', label: 'Closing-labelled', num: true, sort: (r) => closing(r.label), cell: (r) => closing(r.label) },
    { id: 'share', label: 'Share', sort: (r) => r.share, cell: (r) => <div className="flex items-center gap-2"><div className="w-24"><Bar pct={r.share} tone="bg-chart-5" /></div><span className="mono w-12 text-xs">{r.share.toFixed(1)}%</span></div> },
  ];
  return (
    <div className="space-y-4">
      <PacingCadencePanel a={a} drill={drill} printAll={printAll} />
      <Panel title="Representative contribution" note="Share of recorded activity in the window. Closing is an activity label." id="reps">
        {rows.length === 0 ? <Empty id="empty-reps">No representative activity in this window.</Empty> : <DataTable rows={rows} cols={cols} rowKey={(r) => r.label} pageSize={20} printAll={printAll} initialSort={{ id: 'n', dir: 'desc' }} testid="table-reps-full" minW={620} />}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest activity per representative"><RepTable a={a} drill={drill} printAll={printAll} /></Panel>
        <Panel title="Activity type"><MixDonut a={a} drill={drill} /></Panel>
      </div>
    </div>
  );
}

export function CompaniesView({ a, data, drill, printAll }: { a: Analysis; data: ReportData; drill: Drill; printAll?: boolean }) {
  return (
    <div className="space-y-4">
      <AccountHealthPanel a={a} drill={drill} printAll={printAll} />
      <Panel title="Company ranking" note="Recorded activities per account in the window." id="companies"><CompanyTable a={a} drill={drill} pageSize={15} printAll={printAll} extra /></Panel>
      <AccountsReview a={a} today={data.today} printAll={printAll} />
    </div>
  );
}

export function CommoditiesView({ a, drill, printAll }: { a: Analysis; drill: Drill; printAll?: boolean }) {
  const rows = groupVisits(a.curVisits, (v) => v.commodity, '(commodity not recorded)');
  const prior = new Map(groupVisits(a.prevVisits, (v) => v.commodity).map((r) => [r.key, r.n]));
  const previous = (key: string) => prior.get(key) ?? 0;
  const max = Math.max(1, ...rows.map((r) => r.n));
  const cols: Col<(typeof rows)[number]>[] = [
    { id: 'name', label: 'Commodity (as recorded)', sort: (r) => r.name, cell: (r) => <DrillBtn onClick={() => drill({ field: 'commodity', value: r.key })} label={`Open ${r.name} records in the visit register`}>{r.name}</DrillBtn> },
    { id: 'n', label: 'Activities', num: true, sort: (r) => r.n, cell: (r) => <div className="flex items-center justify-end gap-2"><div className="hidden w-20 sm:block"><Bar pct={(r.n / max) * 100} /></div><b>{r.n}</b></div> },
    { id: 'prev', label: 'Prev', num: true, sort: (r) => previous(r.key), cell: (r) => a.period.prevCov === 'none' ? 'n/a' : previous(r.key) },
    { id: 'change', label: 'Change', cell: (r) => <DeltaTag d={compareDelta(r.n, previous(r.key), a.period.curCov, a.period.prevCov)} /> },
    { id: 'accounts', label: 'Accounts', num: true, sort: (r) => r.accounts, cell: (r) => r.accounts },
    { id: 'reps', label: 'Reps', num: true, sort: (r) => r.reps, cell: (r) => r.reps },
    { id: 'type', label: 'Most common activity', sort: (r) => r.topType, cell: (r) => r.topType },
    { id: 'latest', label: 'Latest', num: true, sort: (r) => r.latest.date, cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDate(r.latest.date)}</span> },
  ];
  const blank = rows.find((r) => r.key === '');
  return (
    <Panel title="Commodity report" note="Counts of visits by the commodity field. This is where visits happened, not product demand." id="commodities">
      {rows.length === 0 ? <Empty id="empty-commodities">No activity recorded in this window.</Empty> : (
        <>
          <DataTable rows={rows} cols={cols} rowKey={(r) => r.key || 'blank'} pageSize={15} printAll={printAll} initialSort={{ id: 'n', dir: 'desc' }} testid="table-commodities" minW={640} />
          {blank && <p className="mt-3 text-xs text-muted-foreground">{blank.n} records have a blank commodity field; this is a data gap and cannot be read as zero.</p>}
          <p className="mt-1 text-xs text-muted-foreground">Compares currently visited commodities with the previous period. Names match only by case and whitespace; mixed labels and spelling variants stay separate. Percent changes require both periods within the recorded date span.</p>
        </>
      )}
    </Panel>
  );
}
