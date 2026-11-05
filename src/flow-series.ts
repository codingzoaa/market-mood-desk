import type {Board,FlowPoint} from './market-details';
export const minuteOf=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(2,4));
export function flowSeries(history:FlowPoint[],board:Board,delta:boolean){
 return history.map((p,i)=>{
  const current=p.markets[board],previous=history[i-1],contiguous=!!previous&&minuteOf(p.time)-minuteOf(previous.time)===5;
  return {time:p.time,asOf:p.asOf,changePct:current.changePct,individual:delta?(contiguous?current.individual-previous.markets[board].individual:null):current.individual,foreign:delta?(contiguous?current.foreign-previous.markets[board].foreign:null):current.foreign};
 });
}


// User-supplied daily slope, used as a fixed reference rather than an intraday fit.
export const PERSONAL_FLOW_REFERENCE=3900; // 억원 per 1 percentage point decline
export function personalFlowDeviation(history:FlowPoint[]){
 const ordered=[...history].sort((a,b)=>a.time.localeCompare(b.time));
 const points=ordered.map((p,i)=>{
  const prev=ordered[i-1],current=p.markets.KOSPI,prior=prev?.markets.KOSPI;
  const contiguous=!!prev&&minuteOf(p.time)-minuteOf(prev.time)===5;
  const valid=contiguous&&[current?.individual,prior?.individual,current?.changePct,prior?.changePct].every(Number.isFinite)&&current.changePct> -100&&prior.changePct> -100;
  // Both daily returns have the same previous-close denominator. Their ratio
  // recovers the 5-minute index return (subject to source percentage rounding).
  const indexReturn=valid?((100+current.changePct)/(100+prior.changePct)-1)*100:null;
  const actual=valid?current.individual-prior.individual:null;
  const reference=indexReturn===null?null:-PERSONAL_FLOW_REFERENCE*indexReturn;
  return {time:p.time,actual,indexReturn,reference,deviation:actual===null||reference===null?null:actual-reference};
 });
 return points.map((p,i)=>{
  const window=points.slice(Math.max(0,i-5),i+1);
  const complete=window.length===6&&window.every((v,j)=>v.deviation!==null&&(j===0||minuteOf(v.time)-minuteOf(window[j-1].time)===5));
  return {...p,rolling30:complete?window.reduce((sum,v)=>sum+v.deviation!,0):null,validIntervals:window.filter(v=>v.deviation!==null).length};
 });
}
