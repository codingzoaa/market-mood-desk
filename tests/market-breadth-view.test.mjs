import {test} from 'node:test';
import assert from 'node:assert/strict';
import {thresholdBands, periodStartIndex, visiblePriceBounds} from '../src/market-breadth-view.mjs';

const row = (date, kospiClose, below20Pct) => ({date, kospiClose, below20Pct});
const time = date => Date.parse(date + 'T00:00:00Z');

test('85-only and 90-plus shades never double-paint and missing days break a run', () => {
  const rows = [
    row('2026-10-19', 5500, 84),
    row('2026-10-20', 5400, 86),
    row('2026-10-21', 5300, 91),
    row('2026-10-22', 5500, 85),
    row('2026-10-23', 5520, null),
    row('2026-10-26', 5600, 90)
  ];
  assert.deepEqual(thresholdBands(rows, 85, 90), [[time('2026-10-20'), time('2026-10-21')], [time('2026-10-22'), time('2026-10-23')]]);
  assert.deepEqual(thresholdBands(rows, 90), [[time('2026-10-21'), time('2026-10-22')], [time('2026-10-26'), time('2026-10-27')]]);
});

test('threshold run on the final observation remains visible', () => {
  assert.deepEqual(thresholdBands([row('2026-10-30', 5600, 90)], 90), [[time('2026-10-30'), time('2026-10-31')]]);
  assert.deepEqual(thresholdBands([row('2026-10-30', 5600, null)], 85), []);
});

test('period buttons anchor to latest available data and ALL restores history', () => {
  const rows = [row('2020-01-02', 2200, 33), row('2025-10-22', 3000, 30), row('2026-09-22', 5000, 50), row('2026-10-22', 5600, 51)];
  assert.equal(periodStartIndex(rows, '1M'), 2);
  assert.equal(periodStartIndex(rows, '1Y'), 1);
  assert.equal(periodStartIndex(rows, '5Y'), 1);
  assert.equal(periodStartIndex(rows, 'ALL'), 0);
  assert.equal(periodStartIndex([], '1Y'), 0);
});

test('y-axis bounds follow visible closes rather than the full historical range', () => {
  const rows = [row('2020-01-02', 2000, 20), row('2026-10-21', 5500, 95), row('2026-10-22', 5600, 87)];
  const [min, max] = visiblePriceBounds(rows, 1, 2);
  assert.ok(min > 5000 && min < 5500);
  assert.ok(max > 5600 && max < 6000);
  assert.equal(visiblePriceBounds([], 0, 0)[0], 0);
});
