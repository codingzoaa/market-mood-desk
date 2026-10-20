import {currentValid,historyAt,members,nonnegative,previousDays,slot} from './common.ts';
import type {AnalysisInput,Quote,ScoreMode} from './types.ts';
export function relativeVolume(input:AnalysisInput,mode:ScoreMode,subset?:Quote[]):number|null {
  const quotes=subset||members(input),dates=previousDays(input,20);if(!quotes?.length||!dates)return null;
  if(input.entity.type==='SECTOR'&&(!input.entity.membership||input.entity.membership.effectiveDate>dates[0]))return null;
  if(quotes.some(q=>!currentValid(q,input)||!nonnegative(q.turnoverKRW)))return null;
  const history=dates.map(date=>{
    const values=quotes.map(q=>{const bar=historyAt(q,date,input);return mode==='INTRADAY'?bar?.cumulative?.[slot(input.asOf)]:bar?.turnoverKRW;});
    return values.every(nonnegative)?values.reduce((s,n)=>s+n!,0):null;
  });
  if(history.some(v=>v===null))return null;
  const mean=history.reduce((s,n)=>s+n!,0)/20;
  return mean>0?quotes.reduce((s,q)=>s+q.turnoverKRW!,0)/mean:null;
}
