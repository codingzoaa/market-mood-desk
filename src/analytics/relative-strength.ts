import {currentValid,historyAt,members,positive,previousDays,clamp} from './common.ts';
import type {AnalysisInput} from './types.ts';
// Equal-weight fixed membership; each constituent uses its own market benchmark.
export function relativeStrength(input:AnalysisInput,lookback=0):number|null {
  const quotes=members(input);if(!quotes?.length)return null;
  const dates=lookback?previousDays(input,lookback):null;if(lookback&&!dates)return null;
  if(input.entity.type==='SECTOR'&&lookback&&(!input.entity.membership||input.entity.membership.effectiveDate>dates![0]))return null;
  const returns=quotes.map(q=>{
    const b=input.benchmarks[q.market];if(!b||!currentValid(q,input)||!currentValid(b,input)||!positive(q.price)||!positive(b.price))return null;
    const base=lookback?historyAt(q,dates![0],input)?.close:q.previousClose;
    const bench=lookback?historyAt(b,dates![0],input)?.close:b.previousClose;
    return positive(base)&&positive(bench)?(q.price/base-b.price/bench)*100:null;
  });
  return returns.some(v=>v===null)?null:returns.reduce((s,v)=>s+v!,0)/returns.length;
}
export const rsFactor=(rs:number|null)=>rs===null?null:clamp((rs+5)/10);
export function eodRelativeStrength(input:AnalysisInput){const five=relativeStrength(input,5),twenty=relativeStrength(input,20);return five===null||twenty===null?null:.6*five+.4*twenty;}
