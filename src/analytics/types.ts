export type ScoreMode = 'INTRADAY' | 'EOD';
export type ScoreStatus = 'PROVISIONAL' | 'FINAL' | 'INSUFFICIENT_DATA' | 'INVALIDATED';
export type Universe = 'FULL_MARKET' | 'SAMPLED_UNIVERSE';
export type Market = 'KOSPI' | 'KOSDAQ';
export type DataQuality = {
  asOf: string; lastSuccessAt: string | null; source: string; universe: Universe;
  stockCount: number; classifiedCount: number; historicalTradingDays: number;
  stale: boolean; missingFields: string[]; errors: string[];
};
export type LeadershipScore = {
  id: string; date: string; asOf: string; entityType: 'SECTOR' | 'STOCK'; entityId: string;
  mode: ScoreMode; status: ScoreStatus; score: number | null; grade: string | null;
  factors: Record<string, number | null>; missingFactors: string[]; universe: Universe;
  methodologyVersion: string;
};
export type Finality = {
  sourceConfirmed: boolean; source: string; confirmedAt: string;
  finalPrice: boolean; finalTurnover: boolean; finalOHLC: boolean;
};
export type DailyBar = {
  date: string; availableAt: string; source: string; final: boolean; adjusted: boolean;
  close: number; open?: number; high?: number; low?: number; turnoverKRW?: number;
  cumulative?: Record<string, number>;
};
export type IntradayBar = { asOf: string; availableAt: string; high: number; low: number; close: number };
export type Quote = {
  symbol: string; name: string; market: Market; instrumentType?: 'STOCK' | 'ETF' | 'ETN';
  asOf: string; availableAt: string; price?: number; previousClose?: number; turnoverKRW?: number;
  open?: number; high?: number; low?: number; finality?: Finality;
  bars?: IntradayBar[]; history: DailyBar[];
  rvolBaseline?: {targetDate:string;symbol:string;slot:string;sumTurnover:number;samples:number;dates:string[];availableAt:string;version:string;timingBasis:'RECEIPT_TIME'|'SOURCE_TIME'};
};
export type Benchmark = Omit<Quote, 'name' | 'market' | 'instrumentType'>;
export type Membership = { symbols: string[]; effectiveDate: string; knownAt: string; version: string };
export type AnalysisInput = {
  date: string; asOf: string; source: string; universe: Universe;
  isTradingDay: boolean | null;
  calendar: { verified: boolean; tradingDays: string[] };
  quotes: Quote[]; benchmarks: Partial<Record<Market, Benchmark>>;
  entity: { type: 'SECTOR' | 'STOCK'; id: string; membership?: Membership };
  excludedProductSymbols?: string[];
  // Sector scores are resolved first using independent raw candidates, never stock scores.
  sectorId?: string;
  sectorScore?: LeadershipScore;
};
