import {currentValid,historyAt,members,nonnegative,previousDays,slot,known,kstDate,minute} from './common.ts';
import type {AnalysisInput,Quote,ScoreMode} from './types.ts';
export function relativeVolume(input:AnalysisInput,mode:ScoreMode,subset?:Quote[]):number|null {
  const quotes=subset||members(input),dates=previousDays(input,20);if(!quotes?.length||!dates)return null;
  if(input.entity.type==='SECTOR'&&(!input.entity.membership||input.entity.membership.effectiveDate>dates[0]))return null;
  if(quotes.some(q=>!currentValid(q,input)||!nonnegative(q.turnoverKRW)))return null;
  if(mode==='INTRADAY'&&quotes.some(q=>q.rvolBaseline!==undefined)){
    const cached=quotes.map(q=>q.rvolBaseline);
    if(cached.some((b,i)=>!b||b.targetDate!==input.date||b.symbol!==quotes[i].symbol||b.slot!==slot(input.asOf)||b.samples!==20||b.version!=='receipt-5m-v1'||!['RECEIPT_TIME','SOURCE_TIME'].includes(b.timingBasis)||!known(b.availableAt,input.asOf)||kstDate(b.availableAt)!==input.date||minute(b.availableAt)>='0900'||!Number.isSafeInteger(b.sumTurnover)||b.sumTurnover<=0||b.dates.length!==20||new Set(b.dates).size!==20||b.dates.slice().sort().join(',')!==dates.join(',')))return null;
    if(new Set(cached.map(b=>b!.timingBasis)).size!==1)return null;
    return quotes.reduce((s,q)=>s+q.turnoverKRW!,0)/(cached.reduce((s,b)=>s+b!.sumTurnover,0)/20);
  }
  const history=dates.map(date=>{
    const values=quotes.map(q=>{const bar=historyAt(q,date,input);return mode==='INTRADAY'?bar?.cumulative?.[slot(input.asOf)]:bar?.turnoverKRW;});
    return values.every(nonnegative)?values.reduce((s,n)=>s+n!,0):null;
  });
  if(history.some(v=>v===null))return null;
  const mean=history.reduce((s,n)=>s+n!,0)/20;
  return mean>0?quotes.reduce((s,q)=>s+q.turnoverKRW!,0)/mean:null;
}
