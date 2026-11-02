// Pure chart helpers: data and threshold semantics are shared by render and tests.
const utc = date => Date.parse(date + 'T00:00:00Z');

export function thresholdBands(rows, lower, upper = Infinity) {
  const bands = [];
  let first = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const v = rows[i].below20Pct;
    const active = typeof v === 'number' && Number.isFinite(v) && v >= lower && v < upper;
    if (active && first < 0) first = i;
    if (!active && first >= 0) {
      bands.push([utc(rows[first].date), utc(rows[i].date)]);
      first = -1;
    }
  }
  if (first >= 0) bands.push([utc(rows[first].date), utc(rows[rows.length - 1].date) + 86400000]);
  return bands;
}

function earlierMonth(date, months) {
  const current = new Date(date + 'T00:00:00Z');
  const day = current.getUTCDate();
  current.setUTCDate(1);
  current.setUTCMonth(current.getUTCMonth() - months);
  const last = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
  current.setUTCDate(Math.min(day, last));
  return current.toISOString().slice(0, 10);
}

export function periodStartIndex(rows, period) {
  if (!rows.length || period === 'ALL') return 0;
  const months = { '1M': 1, '3M': 3, '1Y': 12, '5Y': 60 }[period];
  if (!months) return 0;
  const target = earlierMonth(rows[rows.length - 1].date, months);
  const index = rows.findIndex(row => row.date >= target);
  return index < 0 ? 0 : index;
}

export function visiblePriceBounds(rows, first, last) {
  const subset = rows.slice(Math.max(0, first), Math.min(rows.length, last + 1));
  const prices = subset.map(p => p.kospiClose).filter(v => Number.isFinite(v) && v > 0);
  if (!prices.length) return [0, 1];
  const low = Math.min(...prices), high = Math.max(...prices);
  const padding = Math.max((high - low) * 0.08, high * 0.012, 1);
  return [Math.max(0, Math.floor((low - padding) * 100) / 100),
    Math.ceil((high + padding) * 100) / 100];
}
