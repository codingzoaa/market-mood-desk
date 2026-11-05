import type {AnalysisInput,Benchmark,DailyBar,Membership,Quote,LeadershipScore,ScoreMode} from '../analytics/types.ts';
export type CachedRvol={targetDate:string;symbol:string;slot:string;sumTurnover:number;samples:number;dates:string[];availableAt:string;version:string;timingBasis:'RECEIPT_TIME'|'SOURCE_TIME'};
export type Observation={date:string;symbol:string;slot:string;observed_at:string;available_at:string;source_quote_at:string|null;price:number;turnover_krw:number;market:'KOSPI'|'KOSDAQ';name:string;source:string;timing_basis:string};
/** Missing previous close/OHLC/finality stay missing. Caller must validate an official calendar. */
export function engineInput({date,asOf,rows,calendar,entity,baselines=[],history={},benchmarks={},extras={},sectorId,sectorScore}:{date:string;asOf:string;rows:Observation[];calendar:AnalysisInput['calendar'];entity:AnalysisInput['entity'];baselines?:CachedRvol[];history?:Record<string,DailyBar[]>;benchmarks?:Partial<Record<'KOSPI'|'KOSDAQ',Benchmark>>;extras?:Record<string,Partial<Quote>>;sectorId?:string;sectorScore?:LeadershipScore}):{input:AnalysisInput;missingFields:string[]}{
 const missingFields=new Set<string>();
 const quotes:Quote[]=rows.map(r=>{
  if(!r.source_quote_at)missingFields.add('sourceQuoteAt');
  const extra=extras[r.symbol]||{};for(const key of ['previousClose','open','high','low','finality'] as const)if(extra[key]===undefined)missingFields.add(key);
  // Historical cumulative values are provided by a frozen cache, not synthesized from EOD turnover.
  return {...extra,symbol:r.symbol,name:r.name,market:r.market,asOf:r.source_quote_at||r.observed_at,availableAt:r.available_at,price:r.price,turnoverKRW:r.turnover_krw,history:history[r.symbol]||[],rvolBaseline:baselines.find(b=>b.symbol===r.symbol)};
 });
 return {input:{date,asOf,source:'LS stored observations',universe:'SAMPLED_UNIVERSE',isTradingDay:calendar.verified&&calendar.tradingDays.includes(date)?true:null,calendar,quotes,benchmarks,entity,sectorId,sectorScore},missingFields:[...missingFields]};
}
export function cachedBaselines(result:{day:any;rows:any[]}):CachedRvol[]{
 if(!result.day)return [];return result.rows.map(r=>({targetDate:r.target_date,symbol:r.symbol,slot:r.slot,sumTurnover:r.sum_turnover,samples:r.samples,dates:JSON.parse(result.day.days_json),availableAt:result.day.cutoff,version:r.version,timingBasis:r.timing_basis}));
}
