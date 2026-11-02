import {kst} from './ls.mjs';

// t1601 stock amount mode is stored by Market Note in 억원.
// KRX's stock-market '연기금 등' corresponds to pension/fund (LS code 06);
// the separately reported 국가 (11) must NOT be added.
export function pensionDailyFeed(details) {
  if (!details || !/^\d{4}-\d{2}-\d{2}$/.test(String(details.date))) return null;
  const quote = details.indices?.KOSPI;
  const flows = details.flows;
  if (!quote || !flows || flows.unit !== '억원' ||
      typeof flows.source !== 'string' || !flows.source.includes('t1601')) return null;
  const close = quote.value;
  const amountEok = flows.segments?.KOSPI?.pension;
  if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0 || close > 1e7 ||
      typeof amountEok !== 'number' || !Number.isFinite(amountEok) || Math.abs(amountEok) > 1e8) return null;
  // Do not publish intraday estimates. Both the index quote and pension flow
  // must be observed after 15:50 KST on the SAME KRX session date.
  for (const stamp of [quote.asOf, flows.asOf]) {
    if (typeof stamp !== 'string' || !Number.isFinite(Date.parse(stamp))) return null;
    const observed = kst(new Date(stamp));
    if (observed.date !== details.date || observed.time < '1550') return null;
  }
  return {
    date: details.date,
    kospiClose: close,
    pensionNetBuyBillion: Math.round(amountEok / 10),
    regularSessionClosed: true,
    source: 'LS증권 KRX t1511 + t1601(기금 06)',
    category: '연기금 등(기금)',
    pensionUnit: '십억원',
    observedAt: flows.asOf,
    note: '정규장 마감 후 LS 수급 스냅샷(최종 KRX 정산치는 이후 조정될 수 있음)'
  };
}
