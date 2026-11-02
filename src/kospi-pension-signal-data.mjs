const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The supplied KRX investor series is in KRW billions (십억원), not 억원. */
export const PENSION_MIN_BILLION = 100; // 1,000억원

export function validateKospiPensionDataset(input) {
  if (!input || input.schemaVersion !== 1 || input.pensionUnit !== '십억원' || !Array.isArray(input.rows) || input.rows.length < 15 || input.rows.length > 8000) {
    throw new Error('코스피·연기금 데이터 형식 또는 금액 단위가 올바르지 않습니다.');
  }
  let previous = '';
  return input.rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 3) throw new Error('데이터 행 형식 오류');
    const [date, close, netBuyBillion] = row;
    if (typeof date !== 'string' || !DATE_RE.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date || date <= previous ||
        !Number.isFinite(close) || close <= 0 || !Number.isFinite(netBuyBillion) || Math.abs(netBuyBillion) > 100000) {
      throw new Error('일자 중복, 순서 또는 수치 오류');
    }
    previous = date;
    return { date, close, netBuyBillion };
  });
}

/** TradingView-style Wilder RMA, seeded with the first 14 day-to-day changes. */
export function withWilderRsi(rows, length = 14) {
  if (!Number.isInteger(length) || length < 2) throw new Error('Invalid RSI length');
  let avgGain = 0, avgLoss = 0;
  return rows.map((row, index) => {
    if (index === 0) return { ...row, rsi: null };
    const delta = row.close - rows[index - 1].close;
    const gain = Math.max(delta, 0), loss = Math.max(-delta, 0);
    if (index <= length) {
      avgGain += gain;
      avgLoss += loss;
      if (index !== length) return { ...row, rsi: null };
      avgGain /= length;
      avgLoss /= length;
    } else {
      avgGain = (avgGain * (length - 1) + gain) / length;
      avgLoss = (avgLoss * (length - 1) + loss) / length;
    }
    const rsi = avgGain === 0 && avgLoss === 0 ? 50 : avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    return { ...row, rsi };
  });
}

export function signalDays(rows) {
  return rows.filter(row => row.rsi !== null && row.rsi <= 35 && row.netBuyBillion >= PENSION_MIN_BILLION);
}

/** Recalculate the vertical axis from visible closes on every pan/zoom/resize. */
export function visiblePriceBounds(rows, start, end) {
  if (!rows.length) return [0, 1];
  const first = Math.max(0, Math.min(rows.length - 1, Math.floor(start)));
  const last = Math.max(first, Math.min(rows.length - 1, Math.ceil(end)));
  let lo = Infinity, hi = -Infinity;
  for (let i = first; i <= last; i++) {
    lo = Math.min(lo, rows[i].close);
    hi = Math.max(hi, rows[i].close);
  }
  const pad = Math.max((hi - lo) * .09, hi * .004, 6);
  return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];
}

export function periodStartIndex(rows, period) {
  if (!rows.length || period === 'ALL') return 0;
  const end = new Date(rows[rows.length - 1].date + 'T00:00:00Z');
  if (period === '1M') end.setUTCMonth(end.getUTCMonth() - 1);
  else if (period === '3M') end.setUTCMonth(end.getUTCMonth() - 3);
  else if (period === '1Y') end.setUTCFullYear(end.getUTCFullYear() - 1);
  else if (period === '5Y') end.setUTCFullYear(end.getUTCFullYear() - 5);
  else return 0;
  const date = end.toISOString().slice(0,10);
  const found = rows.findIndex(row => row.date >= date);
  return found < 0 ? 0 : found;
}
