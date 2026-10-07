import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, computePacing, computeAccountHealth } from '../src/lib/analytics.ts';

const visit = (company, date, extra = {}) => ({
  id: `${company}-${date}`,
  company,
  date,
  salesName: 'Demo Rep A',
  contact: 'PIC',
  commodity: 'Sawit',
  activityType: 'Visit',
  result: 'Meeting result',
  products: '',
  nextAgenda: '',
  nextDate: '',
  location: '',
  sourceRow: 2,
  ...extra,
});

const data = (visits, extra = {}) => ({
  visits,
  today: '2026-10-06',
  coverageStart: '2026-08-01',
  coverageEnd: '2026-09-30',
  sourceTitle: 'Synthetic test data',
  fetchedAt: '2026-10-06',
  timezone: 'Asia/Jakarta',
  mode: 'demo',
  syncError: null,
  excludedRows: 0,
  ...extra,
});

const september = { mode: 'month', ym: '2026-09' };

test('computePacing computes active days, visits per active day, and pacing status', () => {
  const visits = [
    visit('Co A', '2026-09-02', { salesName: 'Rep One' }),
    visit('Co B', '2026-09-02', { salesName: 'Rep One' }), // 2 visits on same day
    visit('Co C', '2026-09-10', { salesName: 'Rep One' }), // 2nd active day
    visit('Co D', '2026-09-05', { salesName: 'Rep Two' }), // 1 visit on 1 day
  ];
  const d = data(visits);
  const a = analyze(d, september);

  assert.equal(a.pacing.reps.length >= 2, true);
  const repOne = a.pacing.reps.find((r) => r.rep === 'Rep One');
  assert.ok(repOne);
  assert.equal(repOne.visits, 3);
  assert.equal(repOne.activeDays, 2);
  assert.equal(repOne.visitsPerActiveDay, 1.5);

  const repTwo = a.pacing.reps.find((r) => r.rep === 'Rep Two');
  assert.ok(repTwo);
  assert.equal(repTwo.visits, 1);
  assert.equal(repTwo.activeDays, 1);
  assert.equal(repTwo.visitsPerActiveDay, 1.0);
});

test('computeAccountHealth categorizes account tiers and dormancy without future lookahead', () => {
  const visits = [
    // Account A: 4 visits (Tier 1 Key Account), last on 2026-06-01 -> >60 days by 2026-09-30 (Dormant)
    visit('Account A', '2026-05-01'),
    visit('Account A', '2026-05-15'),
    visit('Account A', '2026-05-20'),
    visit('Account A', '2026-06-01'),

    // Account B: 2 visits (Tier 2 Growing), last on 2026-09-25 -> <=30 days by 2026-09-30 (Healthy)
    visit('Account B', '2026-08-10'),
    visit('Account B', '2026-09-25'),

    // Account C: 1 visit (Tier 3 Prospect), on 2026-08-15 -> 46 days (Cooling)
    visit('Account C', '2026-08-15'),

    // Future visit after September must not hide dormancy as of September 30
    visit('Account A', '2026-10-05'),
  ];
  const d = data(visits, { coverageStart: '2026-05-01', coverageEnd: '2026-10-05' });
  const a = analyze(d, september);

  assert.equal(a.accountHealth.asOf, '2026-09-30');
  assert.equal(a.accountHealth.tier1Count, 1);
  assert.equal(a.accountHealth.tier2Count, 1);
  assert.equal(a.accountHealth.tier3Count, 1);

  // Account A should be in dormantKeyAccounts
  assert.equal(a.accountHealth.dormantKeyAccounts.length, 1);
  assert.equal(a.accountHealth.dormantKeyAccounts[0].name, 'Account A');
  assert.equal(a.accountHealth.dormantKeyAccounts[0].totalVisits, 4);
  assert.equal(a.accountHealth.dormantKeyAccounts[0].tier, 'tier1');
  assert.equal(a.accountHealth.dormantKeyAccounts[0].healthStatus, 'dormant');

  // Account B should be healthy
  const accB = a.accountHealth.allAccounts.find((x) => x.name === 'Account B');
  assert.ok(accB);
  assert.equal(accB.healthStatus, 'healthy');
});

test('pacing correctly scales targets across month, quarter, and year time filters', () => {
  const visits = [
    visit('Co A', '2026-04-10', { salesName: 'Rep One' }),
    visit('Co B', '2026-05-15', { salesName: 'Rep One' }),
    visit('Co C', '2026-06-20', { salesName: 'Rep One' }),
    visit('Co D', '2026-09-10', { salesName: 'Rep One' }),
  ];
  const d = data(visits, { coverageStart: '2026-01-01', coverageEnd: '2026-09-30' });

  // 1. Month filter (20 visits/mo benchmark)
  const aMonth = analyze(d, { mode: 'month', ym: '2026-09' });
  assert.equal(aMonth.pacing.periodTarget, 20);
  assert.equal(aMonth.pacing.expectedVisitsPerRep, 20);
  assert.equal(aMonth.pacing.totalTeamActual, 1);

  // 2. Quarter filter (3 months * 20 = 60 visits)
  const aQuarter = analyze(d, { mode: 'quarter', y: 2026, q: 2 });
  assert.equal(aQuarter.pacing.periodTarget, 60);
  assert.equal(aQuarter.pacing.expectedVisitsPerRep, 60);
  assert.equal(aQuarter.pacing.totalTeamActual, 3); // 3 visits in Q2

  // 3. Past Full Year filter (12 months * 20 = 240 visits)
  const aYearPast = analyze(d, { mode: 'year', y: 2025 });
  assert.equal(aYearPast.pacing.periodTarget, 240);
  assert.equal(aYearPast.pacing.expectedVisitsPerRep, 240);

  // 4. In-progress Year filter (prorated by elapsed days)
  const aYearYtd = analyze(d, { mode: 'year', y: 2026 });
  assert.equal(aYearYtd.pacing.periodTarget, 240);
  assert.equal(aYearYtd.pacing.elapsedDays > 0, true);
  assert.equal(aYearYtd.pacing.expectedVisitsPerRep < 240, true);
  assert.equal(aYearYtd.pacing.totalTeamActual, 4); // all 4 visits in 2026
});

test('account health recalculates historically based on period end asOf date', () => {
  const visits = [
    // Account X: visited on 2026-04-01 and 2026-04-15 (2 visits)
    visit('Account X', '2026-04-01'),
    visit('Account X', '2026-04-15'),
    // Later visit in September
    visit('Account X', '2026-09-01'),
  ];
  const d = data(visits, { coverageStart: '2026-01-01', coverageEnd: '2026-09-30' });

  // In April 2026: last visit was 2026-04-15, asOf is 2026-04-30 (15 days silent -> healthy)
  const aApril = analyze(d, { mode: 'month', ym: '2026-04' });
  assert.equal(aApril.accountHealth.asOf, '2026-04-30');
  const accApril = aApril.accountHealth.allAccounts.find((x) => x.name === 'Account X');
  assert.ok(accApril);
  assert.equal(accApril.totalVisits, 2);
  assert.equal(accApril.daysSinceLastVisit, 15);
  assert.equal(accApril.healthStatus, 'healthy');

  // In July 2026 (before September visit): asOf is 2026-07-31 (107 days silent -> dormant)
  const aJuly = analyze(d, { mode: 'month', ym: '2026-07' });
  assert.equal(aJuly.accountHealth.asOf, '2026-07-31');
  const accJuly = aJuly.accountHealth.allAccounts.find((x) => x.name === 'Account X');
  assert.ok(accJuly);
  assert.equal(accJuly.totalVisits, 2);
  assert.equal(accJuly.daysSinceLastVisit, 107);
  assert.equal(accJuly.healthStatus, 'dormant');
});

