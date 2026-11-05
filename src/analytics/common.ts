import {eligibleStocks, validDate} from '../market.ts';
import {grade, type Thresholds} from './grading.ts';
import type {AnalysisInput, Benchmark, DailyBar, LeadershipScore, Quote, ScoreMode} from './types.ts';
export const METHODOLOGY_VERSION = 'leadership-v2.0-experimental-1';
export const WEIGHTS = {
  SECTOR: {INTRADAY: {rs:20,rvol:35,breadth:20,persistence:15,leaders:10}, EOD:{rs:30,rvol:25,breadth:20,persistence:15,leaders:10}},
  STOCK: {INTRADAY: {rs:20,rvol:35,structure:25,persistence:10,sector:10}, EOD:{rs:30,rvol:25,structure:20,persistence:15,sector:10}},
} as const;
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export const positive=(n:unknown):n is number=>finite(n)&&n>0;
export const nonnegative=(n:unknown):n is number=>finite(n)&&n>=0;
export const stamp=(s:unknown):s is string=>typeof s==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
export const kstDate=(s:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(s));
export const minute=(s:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s)).replace(':','');
export const slot=(s:string)=>{const t=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));return t.slice(0,2)+String(Math.floor(Number(t.slice(3))/5)*5).padStart(2,'0');};
export const known=(at:unknown,cutoff:string)=>stamp(at)&&Date.parse(at)<=Date.parse(cutoff);
export function previousDays(input:AnalysisInput,n:number):string[]|null {
  const days=input.calendar.tradingDays;
  if(!input.calendar.verified||new Set(days).size!==days.length||days.some(d=>!validDate(d))||!days.includes(input.date))return null;
  const previous=days.filter(d=>d<input.date).sort().slice(-n);
  return previous.length===n?previous:null;
}
export function members(input:AnalysisInput):Quote[]|null {
  const ids=input.entity.type==='STOCK'?[input.entity.id]:input.entity.membership?.symbols;
  if(!ids?.length||new Set(ids).size!==ids.length)return null;
  const quotes=ids.map(id=>input.quotes.find(q=>q.symbol===id));
  if(quotes.some(q=>!q))return null;
  const all=quotes as Quote[];
  const eligible=eligibleStocks(all.map(q=>({...q,themes:[],price:q.price??0,changePct:0,turnoverKRW:q.turnoverKRW??0})),(input.excludedProductSymbols||[]).map(symbol=>({symbol,name:'ETF',price:0,changePct:0,turnoverKRW:0})));
  return all.filter(q=>eligible.some(e=>e.symbol===q.symbol));
}
export function currentValid(q:Quote|Benchmark,input:AnalysisInput){
  return stamp(q.asOf)&&kstDate(q.asOf)===input.date&&known(q.asOf,input.asOf)&&known(q.availableAt,input.asOf)&&Date.parse(q.availableAt)>=Date.parse(q.asOf)&&slot(q.asOf)===(slot(input.asOf)>'1530'?'1530':slot(input.asOf));
}
export function historyAt(q:Quote|Benchmark,date:string,input:AnalysisInput):DailyBar|null {
  const rows=q.history.filter(p=>p.date===date&&p.final&&p.adjusted&&known(p.availableAt,input.asOf)&&Date.parse(p.availableAt)>=Date.parse(date+'T15:30:00+09:00')&&!/(demo|simulation|시뮬레이션|가상)/i.test(p.source));
  return rows.length===1&&positive(rows[0].close)?rows[0]:null;
}
export function contextIssues(input:AnalysisInput,mode:ScoreMode){
  const issues:string[]=[];
  if(!validDate(input.date)||!stamp(input.asOf)||kstDate(input.asOf)!==input.date)issues.push('INVALID_AS_OF');
  if(!input.source.trim()||/(demo|simulation|시뮬레이션|가상)/i.test(input.source))issues.push('NON_PRODUCTION_SOURCE');
  if(!['FULL_MARKET','SAMPLED_UNIVERSE'].includes(input.universe))issues.push('INVALID_UNIVERSE');
  if(new Set(input.quotes.map(q=>q.symbol)).size!==input.quotes.length)issues.push('DUPLICATE_SYMBOL');
  if(input.quotes.some(q=>!['KOSPI','KOSDAQ'].includes(q.market)))issues.push('INVALID_MARKET');
  if(input.entity.type==='SECTOR'){
    const m=input.entity.membership;
    if(m&&(new Set(m.symbols).size!==m.symbols.length||!validDate(m.effectiveDate)||!known(m.knownAt,input.asOf)||m.effectiveDate>input.date||!m.version.trim()))issues.push('INVALID_MEMBERSHIP');
  }
  if(stamp(input.asOf)){
    const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short'}).format(new Date(input.asOf));
    if(input.isTradingDay===false||['Sat','Sun'].includes(weekday))issues.push('NON_TRADING_DAY');
    if(mode==='INTRADAY'&&(minute(input.asOf)<'0900'||minute(input.asOf)>'1530'))issues.push('OUTSIDE_SESSION');
  }
  return issues;
}
export function finalConfirmed(q:Quote|Benchmark,input:AnalysisInput){
  const f=q.finality;
  return currentValid(q,input)&&!!f&&f.sourceConfirmed&&!!f.source.trim()&&known(f.confirmedAt,input.asOf)&&kstDate(f.confirmedAt)===input.date&&slot(f.confirmedAt)>='1530'&&Date.parse(f.confirmedAt)>=Date.parse(q.asOf)&&f.finalPrice&&f.finalTurnover&&f.finalOHLC&&positive(q.price)&&nonnegative(q.turnoverKRW)&&ohlc(q);
}
export function ohlc(q:{open?:number;high?:number;low?:number;price?:number}){
  return positive(q.open)&&positive(q.high)&&positive(q.low)&&positive(q.price)&&q.low<=Math.min(q.open,q.price)&&q.high>=Math.max(q.open,q.price)&&q.high>=q.low;
}
export function scoreId(input:AnalysisInput,mode:ScoreMode,version:string){return JSON.stringify([input.date,input.entity.type,input.entity.id,mode,new Date(input.asOf).toISOString(),version]);}
export function finish(input:AnalysisInput,mode:ScoreMode,raw:Record<string,number|null>,missing:string[],version=METHODOLOGY_VERSION,thresholds?:Thresholds):LeadershipScore {
  const issues=contextIssues(input,mode),weights=WEIGHTS[input.entity.type][mode] as Record<string,number>;
  const factors=Object.fromEntries(Object.entries(weights).map(([name,weight])=>[name,!(mode==='EOD'&&missing.some(m=>m.startsWith('SOURCE_CONFIRMED_FINAL')))&&finite(raw[name])&&raw[name]>=0&&raw[name]<=1?raw[name]*weight:null]));
  const absent=Object.keys(factors).filter(k=>factors[k]===null);
  const missingFactors=[...new Set([...issues,...missing,...absent])];
  const total=missingFactors.length?null:Math.round(Object.values(factors).reduce((sum,n)=>sum+(n??0),0)*100)/100;
  return {id:stamp(input.asOf)?scoreId(input,mode,version):JSON.stringify([input.date,input.entity.id,mode,'INVALID_AS_OF',version]),date:input.date,asOf:stamp(input.asOf)?new Date(input.asOf).toISOString():input.asOf,entityType:input.entity.type,entityId:input.entity.id,mode,status:issues.length?'INVALIDATED':missingFactors.length?'INSUFFICIENT_DATA':mode==='EOD'?'FINAL':'PROVISIONAL',score:total,grade:grade(total,thresholds),factors,missingFactors,universe:input.universe,methodologyVersion:version};
}
export function prerequisites(input:AnalysisInput,mode:ScoreMode){
  const missing:string[]=[];const quotes=members(input);
  if(input.isTradingDay!==true||!previousDays(input,1))missing.push('VERIFIED_TRADING_CALENDAR');
  if(!quotes?.length)missing.push('ELIGIBLE_MEMBERS');
  if(quotes?.some(q=>!currentValid(q,input)||!positive(q.price)||!positive(q.previousClose)||!nonnegative(q.turnoverKRW)))missing.push('ALIGNED_CURRENT_QUOTES');
  const markets=[...new Set(quotes?.map(q=>q.market)||[])];
  for(const market of markets){const b=input.benchmarks[market];if(!b||!currentValid(b,input)||!positive(b.price)||!positive(b.previousClose))missing.push('BENCHMARK_'+market);}
  if(mode==='EOD'){
    if(quotes?.some(q=>!finalConfirmed(q,input)))missing.push('SOURCE_CONFIRMED_FINAL_QUOTES');
    for(const market of markets){const b=input.benchmarks[market];if(!b||!finalConfirmed(b,input))missing.push('SOURCE_CONFIRMED_FINAL_BENCHMARK_'+market);}
  }
  return {quotes,missing};
}
