import {canonical,hash,ensure,iso,validDate,slots as validSlots} from './util.mjs';
import {insertHistory} from './history.mjs';
export const PROVIDER_REVIEW={t8412:{verified:false},t8452:{verified:false}};
export async function planBackfill(db,{symbols,dates,slots,contractHash,tr}){
 ensure(['t8412','t8452'].includes(tr)&&symbols.length>0&&symbols.length<=20&&symbols.every(s=>/^\d{6}$/.test(s))&&dates.length>0&&dates.length<=20&&dates.every(validDate)&&slots.length>0&&slots.length<=79&&slots.every(s=>validSlots.includes(s))&&typeof contractHash==='string'&&contractHash.length>0,'INVALID_BACKFILL_PLAN');
 const latest=await db.query('SELECT payload FROM snapshots ORDER BY date DESC LIMIT 1');
 ensure(latest.length===1,'COLLECTED_UNIVERSE_UNAVAILABLE');const universe=new Set(JSON.parse(latest[0].payload).stocks?.map(s=>s.symbol)||[]);
 ensure(symbols.every(symbol=>universe.has(symbol)),'SYMBOL_NOT_IN_COLLECTED_UNIVERSE');
 const present=await db.query('SELECT date,symbol,slot FROM history_5m WHERE symbol IN(SELECT value FROM json_each(?)) AND date IN(SELECT value FROM json_each(?))',[JSON.stringify(symbols),JSON.stringify(dates)]);
 const seen=new Set(present.map(r=>[r.symbol,r.date,r.slot].join(':'))),jobs=[];
 for(const symbol of [...new Set(symbols)]){
  const missing=dates.flatMap(date=>slots.filter(slot=>!seen.has([symbol,date,slot].join(':'))).map(slot=>({date,slot})));if(!missing.length)continue;
  const request={symbol,missing,tr},id=await hash(canonical({request,contractHash}));
  jobs.push([`INSERT OR IGNORE INTO backfill_jobs(id,symbol,tr,contract_hash,request_json,status) VALUES(?,?,?,?,?,'PENDING_REVIEW')`,[id,symbol,tr,contractHash,canonical(request)]]);
 }
 // JSON insertion keeps planning independent of symbol count/invocation query limits.
 if(jobs.length)await db.query(`INSERT OR IGNORE INTO backfill_jobs(id,symbol,tr,contract_hash,request_json,status) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),'PENDING_REVIEW' FROM json_each(?)`,[JSON.stringify(jobs.map(j=>j[1]))]);
 return {jobs:jobs.length};
}
/** Injected adapter only. No built-in LS endpoint, token acquisition or guessed t8412/t8452 field mapping. */
export async function backfillStep(db,{jobId,approval,contract,adapter,now=new Date().toISOString()}){
 ensure(approval?.approved===true&&approval.contractHash===contract?.hash&&Date.parse(approval.expiresAt)>Date.parse(now)&&contract?.verified===true&&contract.krxOnly===true&&contract.cumulativeFromSessionOpen===true&&Number.isFinite(contract.maxRequestsPerSecond)&&contract.maxRequestsPerSecond>0&&contract.documentationURL&&typeof adapter?.page==='function','BACKFILL_NOT_APPROVED_OR_VERIFIED');
 const rows=await db.query('SELECT * FROM backfill_jobs WHERE id=?',[jobId]);ensure(rows.length===1,'BACKFILL_JOB_MISSING');const job=rows[0];
 ensure(job.contract_hash===contract.hash&&job.tr===contract.tr,'CONTRACT_MISMATCH');
 ensure(approval.symbols?.includes(job.symbol)&&approval.tr===job.tr&&approval.jobIds?.includes(jobId),'BACKFILL_SCOPE_EXCEEDED');
 if(job.status==='DONE')return {done:true,reused:true};
 if(job.status==='PARTIAL')return {done:false,reused:true,error:'GAPS_REMAIN'};
 ensure(Number.isInteger(approval.maxPages)&&job.pages<approval.maxPages,'BACKFILL_PAGE_BUDGET');
 if(job.next_attempt_at&&job.next_attempt_at>iso(now))return {waiting:true};
 // Claim one page per invocation; persisted lease throttles retries and concurrent runners.
 const claimed=await db.query(`UPDATE backfill_jobs SET status='RUNNING',attempts=attempts+1,next_attempt_at=? WHERE id=? AND (next_attempt_at IS NULL OR next_attempt_at<=?) AND status!='DONE' RETURNING id`,[new Date(Date.parse(now)+60000).toISOString(),jobId,iso(now)]);if(!claimed.length)return {waiting:true};
 try{
  let page=job.pending_page_json?JSON.parse(job.pending_page_json):null;
  if(!page){
   await db.query('INSERT OR IGNORE INTO provider_leases VALUES(?,?)',[job.tr,iso(now)]);
   const rate=await db.query('UPDATE provider_leases SET next_request_at=? WHERE tr=? AND next_request_at<=? RETURNING tr',[new Date(Date.parse(now)+Math.ceil(1000/contract.maxRequestsPerSecond)).toISOString(),job.tr,iso(now)]);
   if(!rate.length)return {waiting:true};
   db.meter.count('lsTR:'+job.tr);db.meter.count('backfill:'+job.symbol);
   page=await adapter.page({request:JSON.parse(job.request_json),cursor:job.cursor,tr:job.tr,signal:AbortSignal.timeout(10000)});page.fetchedAt=iso(now);
  }
  ensure(Array.isArray(page.rows)&&page.rows.length<=1000&&typeof page.done==='boolean'&&(page.done||typeof page.cursor==='string'&&page.cursor!==job.cursor),'BACKFILL_PAGE_INVALID');
  const allow=new Set(JSON.parse(job.request_json).missing.map(r=>r.date+':'+r.slot));
  ensure(page.rows.every(r=>r.symbol===job.symbol&&allow.has(r.date+':'+r.slot)&&r.source===`LS:${job.tr}:KRX`&&r.available_at===page.fetchedAt&&Date.parse(r.available_at)<=Date.parse(now)),'BACKFILL_PROVENANCE_INVALID');
  ensure(new Set(page.rows.map(r=>r.date)).size<=3,'BACKFILL_PAGE_DATE_LIMIT');
  page.rows=page.rows.map(r=>Object.fromEntries(['date','symbol','slot','observed_at','available_at','source_quote_at','price','turnover_krw','market','name','source','timing_basis'].map(k=>[k,r[k]??null])));
  const safePage={rows:page.rows,cursor:page.cursor||'',done:page.done,fetchedAt:page.fetchedAt};
  ensure(new TextEncoder().encode(canonical(safePage)).length<1500000,'BACKFILL_PAGE_BYTES');
  await db.query('UPDATE backfill_jobs SET pending_page_json=? WHERE id=?',[canonical(safePage),jobId]);
  for(const date of [...new Set(page.rows.map(r=>r.date))])await insertHistory(db,page.rows.filter(r=>r.date===date));
  let complete=page.done;
  if(page.done){
   const request=JSON.parse(job.request_json),dates=[...new Set(request.missing.map(r=>r.date))];
   const present=await db.query('SELECT date,slot FROM history_5m WHERE symbol=? AND date IN(SELECT value FROM json_each(?))',[job.symbol,JSON.stringify(dates)]);
   const keys=new Set(present.map(r=>r.date+':'+r.slot));complete=request.missing.every(r=>keys.has(r.date+':'+r.slot));
  }
  const provenance=JSON.parse(job.provenance_json);provenance.push({tr:job.tr,cursor:job.cursor,normalizedRowsHash:await hash(canonical(page.rows)),rows:page.rows.length,availableAt:page.fetchedAt,contractHash:contract.hash});
  await db.query('UPDATE backfill_jobs SET cursor=?,status=?,pages=pages+1,next_attempt_at=?,error_code=?,provenance_json=?,pending_page_json=NULL WHERE id=?',[page.cursor||'',page.done?(complete?'DONE':'PARTIAL'):'PENDING',new Date(Date.parse(now)+Math.ceil(1000/contract.maxRequestsPerSecond)).toISOString(),page.done&&!complete?'GAPS_REMAIN':null,canonical(provenance),jobId]);return {done:complete,...(page.done&&!complete?{error:'GAPS_REMAIN'}:{})};
 }catch{
  await db.query("UPDATE backfill_jobs SET status='FAILED',error_code='BACKFILL_PAGE_FAILED',next_attempt_at=? WHERE id=?",[new Date(Date.parse(now)+60000).toISOString(),jobId]);return {done:false,error:'BACKFILL_PAGE_FAILED'};
 }
}
