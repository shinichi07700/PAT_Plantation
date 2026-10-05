import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/lib/analytics.ts';

const visit = (company, date, extra = {}) => ({
  id: `${company}-${date}`, company, date, salesName: 'Demo Rep A', contact: '',
  commodity: 'Sample crop', activityType: 'Visit', result: 'Synthetic example',
  products: '', nextAgenda: '', nextDate: '', location: '', sourceRow: 2, ...extra,
});
const data = (visits, extra = {}) => ({
  visits, today: '2026-10-03', coverageStart: '2026-08-01', coverageEnd: '2026-09-30',
  sourceTitle: 'Synthetic test data', fetchedAt: '2026-10-03',
  timezone: 'Asia/Jakarta', mode: 'demo', syncError: null, excludedRows: 0, ...extra,
});
const september = { mode: 'month', ym: '2026-09' };

test('gaps include historically recorded accounts absent from selected month; threshold is strictly over 14 days', () => {
  const a = analyze(data([
    visit('Demo Old', '2026-08-15'),
    visit('Demo Fourteen', '2026-09-16'),
    visit('Demo Fifteen', '2026-09-15'),
    visit(' demo old ', '2026-10-01'), // future record must not hide historical gap
  ]), september);
  assert.equal(a.exceptions.asOf, '2026-09-30');
  assert.deepEqual(a.exceptions.accountGaps.map((x) => [x.key, x.days]), [['demo old', 46], ['demo fifteen', 15]]);
  assert.equal(a.m.companies, 2);
});

test('Closing gaps are distinct accounts, anchored to latest Closing in window; plans and same-day rows are not later evidence', () => {
  const a = analyze(data([
    visit('Demo Planned', '2026-09-05', { activityType: 'Closing', nextAgenda: 'Review', nextDate: '2026-09-10' }),
    visit(' demo planned ', '2026-09-10', { activityType: 'Closing', sourceRow: 3 }),
    visit('Demo Planned', '2026-09-10', { sourceRow: 4 }),
    visit('Demo Planned', '2026-10-01'),
    visit('Demo Followed', '2026-09-10', { activityType: 'Closing' }),
    visit(' demo followed ', '2026-09-11'),
    visit('Demo Prior Closing', '2026-08-31', { activityType: 'Closing' }),
  ]), september);
  assert.deepEqual(a.exceptions.closingGaps.map((x) => [x.key, x.closing.date]), [['demo planned', '2026-09-10']]);
});

test('filtered month, quarter and year recompute without future look-ahead', () => {
  const d = data([visit('Demo Account', '2026-08-01', { activityType: 'Closing' }), visit('Demo Account', '2026-09-30')]);
  const august = analyze(d, { mode: 'month', ym: '2026-08' });
  assert.equal(august.exceptions.closingGaps.length, 1);
  assert.equal(august.exceptions.accountGaps[0].days, 30);
  assert.equal(analyze(d, september).exceptions.closingGaps.length, 0);
  const quarter = analyze(d, { mode: 'quarter', y: 2026, q: 3 });
  assert.equal(quarter.exceptions.closingGaps.length, 0);
  assert.equal(quarter.m.activities, 2);
  assert.equal(analyze(d, { mode: 'year', y: 2026 }).exceptions.closingGaps, null); // end outside coverage
});

test('uncovered window end returns unknown, not zero; partial-start coverage permits qualified historical review', () => {
  const d = data([visit('Demo Account', '2026-09-01', { activityType: 'Closing' })]);
  const october = analyze(d, { mode: 'month', ym: '2026-10' });
  assert.equal(october.exceptions.accountGaps, null);
  assert.equal(october.exceptions.closingGaps, null);
  const partial = analyze({ ...d, coverageStart: '2026-09-10' }, september);
  assert.equal(partial.period.curCov, 'partial');
  assert.notEqual(partial.exceptions.accountGaps, null);
});

test('observed reps and date bounds never imply a roster or complete week', () => {
  const d = data([visit('Demo Account', '2026-09-01')]);
  assert.equal(analyze(d, september).exceptions.repGaps, null);
  const a = analyze(d, september, { expectedReps: ['Demo Rep A', 'Demo Rep B'], confirmedCompleteWeeks: [] });
  assert.equal(a.exceptions.repGaps, null);
  assert.match(a.exceptions.repReason, /confirmed reporting coverage/);
});

test('rep gaps require expected roster and explicitly complete Monday–Sunday weeks wholly inside window and coverage', () => {
  const d = data([visit('Demo Account', '2026-09-09')]);
  const week = { start: '2026-09-07', end: '2026-09-13' };
  const a = analyze(d, september, {
    expectedReps: ['Demo Rep A', 'Demo Rep B', ' demo rep b ', ''],
    confirmedCompleteWeeks: [week, week,
      { start: '2026-08-31', end: '2026-09-06' }, // crosses window boundary
      { start: '2026-09-28', end: '2026-10-04' }, // unfinished week
      { start: '2026-09-08', end: '2026-09-14' }], // not Monday–Sunday
  });
  assert.deepEqual(a.exceptions.repGaps, [{ rep: 'demo rep b', week }]);
  assert.match(a.exceptions.repReason, /1 confirmed-complete/);
  assert.equal(analyze({ ...d, coverageStart: '2026-09-08' }, september, {
    expectedReps: ['Demo Rep B'], confirmedCompleteWeeks: [week],
  }).exceptions.repGaps, null);
});

test('elapsed planned dates remain unverified even when a later visit is recorded', () => {
  const a = analyze(data([
    visit('Demo Account', '2026-09-01', { activityType: 'Closing', nextDate: '2026-09-10' }),
    visit('Demo Account', '2026-09-20', { nextDate: '2026-09-25' }),
  ]), september);
  assert.equal(a.accounts[0].status, 'elapsed');
  assert.equal(a.exceptions.closingGaps.length, 0);
  assert.match(a.keypoints.join(' '), /not a list of missed actions/);
});