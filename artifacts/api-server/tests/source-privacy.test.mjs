import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetReportDataResponse, RefreshReportDataResponse } from '../../../lib/api-zod/src/generated/api.ts';

const legacyPayload = {
  visits: [],
  sourceTitle: 'Test report',
  sourceUrl: 'https://docs.google.com/spreadsheets/d/private-test-sheet/edit',
  spreadsheetId: 'private-test-sheet',
  fetchedAt: '2026-10-05T00:00:00Z',
  today: '2026-10-05',
  timezone: 'Asia/Jakarta',
  mode: 'live',
  syncError: null,
  coverageStart: '2026-09-01',
  coverageEnd: '2026-09-30',
  excludedRows: 0,
};

for (const [name, schema] of [
  ['report data', GetReportDataResponse],
  ['report refresh', RefreshReportDataResponse],
]) {
  test(`${name} strips source URLs and identifiers from legacy cached payloads`, () => {
    const response = schema.parse(legacyPayload);
    assert.equal(response.sourceTitle, 'Test report');
    assert.equal('sourceUrl' in response, false);
    assert.equal('spreadsheetId' in response, false);
    assert.doesNotMatch(JSON.stringify(response), /docs\.google\.com|private-test-sheet/);
  });

  test(`${name} accepts data without a sheet URL`, () => {
    const { sourceUrl, spreadsheetId, ...safePayload } = legacyPayload;
    assert.deepEqual(schema.parse(safePayload), safePayload);
  });
}
