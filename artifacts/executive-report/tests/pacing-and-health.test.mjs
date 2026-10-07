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
