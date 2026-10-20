import {historyAt,members,positive,previousDays} from './common.ts';
import type {AnalysisInput} from './types.ts';
// Previous five actual trading days only, never today's provisional price.
export function persistence(input:AnalysisInput):number|null {
  const days=previousDays(input,6),quotes=members(input);if(!days||!quotes?.length)return null;
  if(input.entity.type==='SECTOR'&&(!input.entity.membership||input.entity.membership.effectiveDate>days[0]))return null;
  let strong=0;
  for(let i=1;i<days.length;i++){
    const rs=quotes.map(q=>{const b=input.benchmarks[q.market];if(!b)return null;const p=historyAt(q,days[i],input)?.close,prev=historyAt(q,days[i-1],input)?.close,m=historyAt(b,days[i],input)?.close,mprev=historyAt(b,days[i-1],input)?.close;return positive(p)&&positive(prev)&&positive(m)&&positive(mprev)?p/prev-m/mprev:null;});
    if(rs.some(v=>v===null))return null;if(rs.reduce((s,n)=>s+n!,0)>0)strong++;
  }
  return strong/5;
}
