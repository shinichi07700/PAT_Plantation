import { useState } from 'react';
import type { ReportData } from '@workspace/api-client-react';
import { fmtDate, fmtRange, type Analysis } from '@/lib/analytics';
import { Empty, Panel, stamp } from './shared';
import { RecordedExceptionsReview } from './priorities';

export function AccountsReview({ a, today, printAll }: { a: Analysis; today: string; printAll?: boolean }) {
  const [all, setAll] = useState(false);
  const rows = all || printAll ? a.accounts : a.accounts.slice(0, 10);
  const label = (x: Analysis['accounts'][number]) =>
    x.status === 'elapsed' ? `Planned date elapsed ${x.daysOverdue} d ago; completion untracked` : x.status === 'upcoming' ? 'Planned date upcoming' : x.status === 'none' ? 'No next date recorded' : 'Next date unreadable';
  return (
    <Panel title="Accounts for review" note={`Latest record per account up to window end. Elapsed means the planned date is before ${fmtDate(today)}; it does not prove the action was missed.`} id="accounts">
      {a.accounts.length === 0 ? <Empty id="empty-accounts">No accounts recorded in this window.</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm" data-testid="table-accounts">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-2 font-medium">Account</th><th className="font-medium">Last record</th><th className="font-medium">Owner</th><th className="font-medium">Next agenda (original)</th><th className="font-medium">Next date status</th><th className="font-medium">Row</th></tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.key} className="row-hover border-b border-border/60 align-top" data-testid={`row-account-${x.latest.id}`}>
                    <td className="py-2 pr-3"><div className="font-medium">{x.name}</div><div className="mono text-[11px] text-muted-foreground">{x.windowVisits} in window / {x.totalVisits} to date</div></td>
                    <td className="whitespace-nowrap pr-3"><div className="mono text-xs">{fmtDate(x.latest.date)}</div><div className="text-[11px] text-muted-foreground">{x.latest.activityType}</div></td>
                    <td className="pr-3">{x.latest.salesName}</td>
                    <td className="max-w-[280px] pr-3 text-[13px]" lang="id">{x.latest.nextAgenda || <span className="text-muted-foreground">Blank</span>}</td>
                    <td className="pr-3"><span className={`text-xs font-medium ${x.status === 'elapsed' ? 'text-clay' : 'text-muted-foreground'}`}>{label(x)}</span>{x.latest.nextDate && <div className="mono text-[11px] text-muted-foreground">{fmtDate(x.latest.nextDate)}</div>}</td>
                    <td className="mono text-xs">{x.latest.sourceRow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {a.accounts.length > 10 && <button onClick={() => setAll(!all)} className="mt-3 text-sm text-primary underline underline-offset-4 print:hidden" data-testid="button-toggle-accounts">{all ? 'Show fewer accounts' : `Show all ${a.accounts.length} accounts`}</button>}
        </>
      )}
    </Panel>
  );
}

function SignalList({ title, tone, items, id }: { title: string; tone: string; items: Analysis['risks']; id: string }) {
  return (
    <div data-testid={`list-${id}`}>
      <h3 className={`text-sm font-semibold ${tone}`}>{title}</h3>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No notes in this window matched the keyword list.</p> : (
        <ul className="mt-3 space-y-4">
          {items.slice(0, 5).map((s) => (
            <li key={s.visit.id} className="border-l-2 border-border pl-3 text-sm">
              <div className="font-medium">{s.visit.company}</div>
              <div className="mono text-[11px] text-muted-foreground">{fmtDate(s.visit.date)} / {s.visit.salesName} / source row {s.visit.sourceRow}</div>
              <blockquote lang="id" className="mt-1.5 leading-relaxed text-foreground/90">{s.visit.result}</blockquote>
              {s.visit.nextAgenda && <blockquote lang="id" className="mt-1 text-[13px] text-muted-foreground">Next: {s.visit.nextAgenda}</blockquote>}
              <div className="mt-1.5 text-[11px] text-muted-foreground">Keyword match: {s.terms.join(', ')}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BriefView({ a, data }: { a: Analysis; data: ReportData }) {
  const items: [string, string][] = [
    ['Recorded date span', `${fmtDate(data.coverageStart)} to ${fmtDate(data.coverageEnd)}. Earlier and later dates are unknown, not zero. A date within this span does not guarantee that all visits were logged.`],
    ['Rows excluded at ingestion', `${data.excludedRows} rows could not be used.`],
    ['Products field blank', `${a.quality.blankProducts} of ${a.m.activities} records in window. A data gap, not absence of product interest.`],
    ['Next date blank', `${a.quality.blankNextDate} of ${a.m.activities} records in window.`],
    ['Account names', `Matched by whitespace and case only; ${a.quality.mergedVariants} account${a.quality.mergedVariants === 1 ? '' : 's'} have spelling variants merged. Names are not verified legal entities.`],
    ['Elapsed next dates', `${a.quality.elapsedAccounts} accounts. Planned date passed; completion is not tracked.`],
    ['Closing label', 'An activity label. No amount, order or deal ID exists in the source.'],
    ['Activity mix', 'Label counts are not a chronological opportunity funnel.'],
    ['Keyword signals', 'Heuristic matches on original notes; not AI verified and not statuses.'],
    ['Data mode', data.mode === 'live' ? `Live read of the source, fetched ${stamp(data.fetchedAt)} WIB.` : `Stored snapshot, fetched ${stamp(data.fetchedAt)} WIB. May be behind the sheet.`],
  ];
  return (
    <div className="space-y-4">
      <RecordedExceptionsReview a={a} />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel title="Executive key points" note="Recomputed from the records in the selected window." id="keypoints">
          <ol className="space-y-3" data-testid="list-keypoints">
            {a.keypoints.map((k, i) => <li key={i} className="flex gap-3 border-b border-border/60 pb-3 text-sm leading-relaxed"><span className="mono mt-0.5 text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span><span>{k}</span></li>)}
          </ol>
        </Panel>
        <Panel title="Recommended for the board" id="recs">
          <ul className="space-y-3 text-sm leading-relaxed" data-testid="list-recommendations">{a.recommendations.map((r, i) => <li key={i} className="border-l-2 border-primary pl-3">{r}</li>)}</ul>
        </Panel>
      </div>
      <Panel title="Evidence priorities" note="Heuristic keyword signals on Indonesian notes. Not AI verified and not statuses." id="evidence">
        <p className="mb-4 rounded border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">Each item is a record whose notes contain words from a fixed list. A match shows where to read, not what happened. Quotes are the original notes.</p>
        <div className="grid gap-8 lg:grid-cols-2">
          <SignalList id="risks" title="Notes mentioning friction words" tone="text-clay" items={a.risks} />
          <SignalList id="opps" title="Notes mentioning interest or order words" tone="text-chart-4" items={a.opps} />
        </div>
      </Panel>
      <Panel title="Data quality and limitations" id="quality">
        <dl className="grid gap-x-10 sm:grid-cols-2" data-testid="list-quality">
          {items.map(([k, v]) => <div key={k} className="border-b border-border/60 py-2.5"><dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-0.5 text-sm leading-relaxed">{v}</dd></div>)}
        </dl>
        <p className="mono mt-4 text-[11px] text-muted-foreground">Prepared {fmtDate(data.today)} ({data.timezone}). Window {fmtRange(a.period.cur)}. Comparison {fmtRange(a.period.prev)}. Source: {data.sourceTitle}.</p>
      </Panel>
    </div>
  );
}
