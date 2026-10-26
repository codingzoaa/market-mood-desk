import type { MarketBreadthPoint } from './market-breadth-chart';

export type BreadthDataset = {
  schemaVersion: 1;
  status: 'provisional' | 'validated';
  startDate: string;
  endDate: string;
  rows: MarketBreadthPoint[];
};

const validDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
export async function loadMarketBreadth(url: string, signal?: AbortSignal): Promise<BreadthDataset> {
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`하락비율 데이터를 가져오지 못했습니다 (HTTP ${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('잘못된 하락비율 응답');
  const p = payload as Record<string, unknown>;
  if (p.schemaVersion !== 1 || !Array.isArray(p.rows) || !['provisional', 'validated'].includes(String(p.status))) throw new Error('지원하지 않는 하락비율 형식');
  const rows: MarketBreadthPoint[] = p.rows.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('잘못된 일별 데이터');
    const v = value as Record<string, unknown>;
    if (!validDate(v.date) || typeof v.kospiClose !== 'number' || !Number.isFinite(v.kospiClose) || v.kospiClose <= 0) throw new Error('유효하지 않은 지수 값');
    if (v.below20Pct !== null && (typeof v.below20Pct !== 'number' || !Number.isFinite(v.below20Pct) || v.below20Pct < 0 || v.below20Pct > 100)) throw new Error('유효하지 않은 하락비율');
    if (v.validStockCount != null && (!Number.isInteger(v.validStockCount) || (v.validStockCount as number) < 0)) throw new Error('유효하지 않은 종목 수');
    return {date:v.date,kospiClose:v.kospiClose,below20Pct:v.below20Pct as number|null,validStockCount: v.validStockCount == null ? undefined : v.validStockCount as number};
  });
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  if (rows.some((x,i)=>i>0 && x.date===rows[i-1].date)) throw new Error('중복된 거래일');
  return {schemaVersion:1,status:p.status as BreadthDataset['status'],startDate:String(p.startDate),endDate:String(p.endDate),rows};
}
