// Recorded daily realized PnL, never inferred from changing loss-guard modes or net cash flows.
export function performanceDays(history=[],state=null){
 const rows=new Map();const valid=r=>r&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(Date.parse(r.date+'T00:00:00Z'))&&new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)===r.date&&Number.isSafeInteger(r.realizedKRW)&&typeof r.at==='string'&&Number.isFinite(Date.parse(r.at));
 for(const r of history){if(!valid(r))continue;const old=rows.get(r.date);if(!old||Date.parse(r.at)>Date.parse(old.at))rows.set(r.date,{date:r.date,realizedKRW:r.realizedKRW,at:r.at});}
 if(state?.sample){const r={date:state.date,realizedKRW:state.sample.realizedKRW,at:state.sample.at};if(valid(r)){const old=rows.get(r.date);if(!old||Date.parse(r.at)>=Date.parse(old.at))rows.set(r.date,r);}}
 let total=0;return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(r=>({...r,cumulativeKRW:total+=r.realizedKRW}));
}
