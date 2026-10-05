import { useState } from 'react';
import { deltaText, fmtDate, fmtRange, type Analysis } from '@/lib/analytics';
import { Panel, type ViewId } from './shared';

export function ReadFirst({ a, go }: { a: Analysis; go: (v: ViewId) => void }) {
  const e = a.exceptions;
  const cards = [
    { id: 'activity', title: 'Recorded activity', text: a.period.curCov === 'none'
      ? 'Unavailable: selected dates lie outside the recorded span. This is not zero performance.'
      : `${a.m.activities} activities · ${a.m.companies} accounts · ${a.m.reps} active reps. ${deltaText(a.deltas.activities)} vs prior window.` },
    { id: 'account-gaps', title: 'Visit gaps >14 days', text: e.accountGaps === null
      ? 'Unavailable: window end is outside recorded coverage.'
      : `${e.accountGaps.length} previously recorded accounts as of ${fmtDate(e.asOf)}. Includes accounts not visited in this window; not proof of inactivity.` },
    { id: 'closing-gaps', title: 'Closing follow-up evidence', text: e.closingGaps === null
      ? 'Unavailable: window end is outside recorded coverage.'
      : `${e.closingGaps.length} Closing-labelled accounts in this window have no later same-account visit recorded by ${fmtDate(e.asOf)}. Not verified sales or unfinished actions.` },
    { id: 'rep-gaps', title: 'Weekly rep activity gaps', text: e.repGaps === null
      ? e.repReason
      : `${new Set(e.repGaps.map((x) => x.rep)).size} expected reps have a week with no recorded activity (${e.repGaps.length} rep-weeks). Confirmed-complete weeks only.` },
    { id: 'limits', title: 'Before drawing conclusions', text: 'Recorded dates do not guarantee all visits were logged. Passed planned dates do not prove unfinished work. Labels are not a conversion funnel.' },
  ];
  return (
    <Panel title="Read first" note="Selected window; recorded-evidence review, not performance verdicts." id="read-first"
      action={<button onClick={() => go('brief')} className="min-h-11 text-xs text-primary underline underline-offset-4 sm:min-h-0" data-testid="link-brief">Open board brief & exceptions</button>}>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="list-teaser">
        {cards.map((c) => <li key={c.id} className="min-w-0 rounded border border-border border-t-2 border-t-primary p-3" data-testid={`card-priority-${c.id}`}>
          <h3 className="text-xs font-semibold">{c.title}</h3><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
        </li>)}
      </ul>
    </Panel>
  );
}

export function RecordedExceptionsReview({ a }: { a: Analysis }) {
  const [expanded, setExpanded] = useState(false);
  const e = a.exceptions;
  const gapRows = expanded ? e.accountGaps : e.accountGaps?.slice(0, 5);
  const closingRows = expanded ? e.closingGaps : e.closingGaps?.slice(0, 5);
  const repRows = expanded ? e.repGaps : e.repGaps?.slice(0, 5);
  const limit = [e.accountGaps, e.closingGaps, e.repGaps].some((xs) => xs && xs.length > 5);
  return (
    <Panel title="Recorded-evidence exceptions" note={`As of ${fmtDate(e.asOf)}; no records after the selected window are used.`} id="exceptions">
      <div className="grid gap-6 lg:grid-cols-3">
        <div data-testid="exceptions-account-gaps">
          <h3 className="text-sm font-semibold">Accounts with no recorded visit for over 14 days</h3>
          <p className="mt-1 text-xs text-muted-foreground">All accounts recorded before window end, including those absent from this window. Missing visits are not proof of inactivity; no complete account roster exists.</p>
          <p className="mt-2 text-sm">{e.accountGaps === null ? 'Unavailable: window end lies outside recorded coverage.' : `${e.accountGaps.length} accounts in recorded history.`}</p>
          <ul className="mt-2 space-y-2 text-xs">{gapRows?.map((x) => <li key={x.key} className="border-l-2 border-border pl-2"><strong>{x.latest.company}</strong><div>{x.days} days · last record {fmtDate(x.latest.date)}</div><div className="text-muted-foreground">{x.latest.salesName} · sample record {x.latest.sourceRow}</div></li>)}</ul>
        </div>
        <div data-testid="exceptions-closing-gaps">
          <h3 className="text-sm font-semibold">Closing-labelled accounts without follow-up evidence</h3>
          <p className="mt-1 text-xs text-muted-foreground">Latest Closing label in the selected window, with no later-date visit for the same normalized account by window end. An agenda or planned date alone is not follow-up evidence; a later visit is not proof of action completion.</p>
          <p className="mt-2 text-sm">{e.closingGaps === null ? 'Unavailable: window end lies outside recorded coverage.' : `${e.closingGaps.length} accounts needing evidence review.`}</p>
          <ul className="mt-2 space-y-2 text-xs">{closingRows?.map((x) => <li key={x.key} className="border-l-2 border-border pl-2"><strong>{x.closing.company}</strong><div>Closing label {fmtDate(x.closing.date)}</div><div className="text-muted-foreground">{x.closing.salesName} · sample record {x.closing.sourceRow}</div></li>)}</ul>
        </div>
        <div data-testid="exceptions-rep-gaps">
          <h3 className="text-sm font-semibold">Reps with no recorded activity in a covered week</h3>
          <p className="mt-1 text-xs text-muted-foreground">{e.repReason}</p>
          {e.repGaps !== null && <p className="mt-2 text-sm">{new Set(e.repGaps.map((x) => x.rep)).size} reps · {e.repGaps.length} rep-weeks. Not proof of inactivity.</p>}
          <ul className="mt-2 space-y-2 text-xs">{repRows?.map((x) => <li key={`${x.rep}-${x.week.start}`} className="border-l-2 border-border pl-2"><strong>{x.rep}</strong><div>{fmtRange(x.week)}</div></li>)}</ul>
        </div>
      </div>
      {limit && <button onClick={() => setExpanded(!expanded)} className="mt-3 min-h-11 text-sm text-primary underline underline-offset-4 print:hidden" data-testid="button-toggle-exceptions">{expanded ? 'Show first five per list' : 'Show all recorded exceptions'}</button>}
      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Monthly visit pacing is not configured: it needs the actual target and agreement on calendar-day or business-day pacing. Activity labels can describe distinct-account coverage, but opportunity identity and confirmed business rules are required for a chronological conversion funnel.</p>
    </Panel>
  );
}