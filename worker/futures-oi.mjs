// LS t2424 daily OI normalizer (configured near-month KOSPI200 futures contract).
// No inference of investor position direction from aggregate OI.
export function normalizeFuturesOi(data,date,contract,asOf){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[0-9A-Z]{8}$/.test(contract))throw new Error('OI_CONTRACT_INVALID');
 const rows=data?.t2424OutBlock1;
 if(!Array.isArray(rows) || rows.length<2 || rows.length>1000)throw new Error('OI_ROWS_INVALID');
 const normalized=rows.map(r=>{
  if(typeof r?.dt!=='string'||!/^[0-9]{8}(?:[0-9]{6})?$/.test(r.dt))throw new Error('OI_DATE_INVALID');
  const n=Number(r.closeopenyak),price=Number(r.close);
  if(r.closeopenyak===null || r.closeopenyak===undefined || !Number.isSafeInteger(n)||n<0 || n>1e9 ||
     r.close===null || r.close===undefined || !Number.isFinite(price) || price<=0)throw new Error('OI_VALUE_INVALID');
  return {date:r.dt.slice(0,8),openInterest:n,price};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 const requested=date.replaceAll('-','');
 const today=normalized.filter(r=>r.date===requested).at(-1);
 const previous=normalized.filter(r=>r.date<requested).at(-1);
 if(!today || !previous || previous.date===today.date)throw new Error('OI_PREVIOUS_CLOSE_MISSING');
 return {source:'LS t2424',contract,asOf,openInterest:today.openInterest,change:today.openInterest-previous.openInterest,price:today.price};
}
