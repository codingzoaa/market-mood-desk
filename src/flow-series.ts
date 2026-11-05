import type {Board,FlowPoint} from './market-details';
export const minuteOf=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(2,4));
export function flowSeries(history:FlowPoint[],board:Board,delta:boolean){
 return history.map((p,i)=>{
  const current=p.markets[board],previous=history[i-1],contiguous=!!previous&&minuteOf(p.time)-minuteOf(previous.time)===5;
  return {time:p.time,asOf:p.asOf,changePct:current.changePct,individual:delta?(contiguous?current.individual-previous.markets[board].individual:null):current.individual,foreign:delta?(contiguous?current.foreign-previous.markets[board].foreign:null):current.foreign};
 });
}
