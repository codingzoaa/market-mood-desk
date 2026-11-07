import {saveJournalDay} from './journal-history.mjs';
import {check} from './security.mjs';
import {readState,writeState} from './store.mjs';
export const JOURNAL_VERSION='LS_T0150_V1';
const cursors=['cts_medosu','cts_expcode','cts_price','cts_middiv'];
const totals=['mdqty','mdamt','mdfee','mdtax','mdargtax','tmdtax','mdadjamt','msqty','msamt','msfee','tmstax','msadjamt','tqty','tamt','tfee','tottax','targtax','ttax','tadjamt'];
const amounts=['qty','price','amt','fee','tax','argtax','adjamt'];
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
function integer(value,signed=false){check(typeof value==='number'||typeof value==='string'&&/^-?\d+$/.test(value),'JOURNAL_AMOUNT_INVALID');const n=Number(value);check(Number.isSafeInteger(n)&&(signed||n>=0),'JOURNAL_AMOUNT_INVALID');return n;}
export function journalPage(data,tr='t0150'){
 check(['t0150','t0151'].includes(tr),'JOURNAL_TR_INVALID');
 check(typeof data.rsp_cd==='string'&&/^0{1,6}$/.test(data.rsp_cd),'JOURNAL_QUERY_FAILED');
 const block=data[tr+'OutBlock'],rows=data[tr+'OutBlock1'];
 check(block&&typeof block==='object'&&!Array.isArray(block)&&Array.isArray(rows)&&rows.length<=1000,'JOURNAL_SHAPE_INVALID');
 const summary=Object.fromEntries(totals.map(k=>[k,integer(block[k],k==='tadjamt')]));
 check(summary.ttax===summary.tfee+summary.tottax+summary.targtax&&summary.tmdtax===summary.mdfee+summary.mdtax+summary.mdargtax&&summary.tmstax===summary.msfee,'JOURNAL_COST_MISMATCH');
 check(summary.mdadjamt===summary.mdamt-summary.tmdtax&&summary.msadjamt===summary.msamt+summary.tmstax&&summary.tadjamt===summary.mdadjamt-summary.msadjamt,'JOURNAL_SETTLEMENT_MISMATCH');
 const normalized=rows.map(row=>{check(row&&typeof row==='object','JOURNAL_ROW_INVALID');const r=Object.fromEntries(amounts.map(k=>[k,integer(row[k])]));for(const k of ['medosu','expcode','middiv']){check(typeof row[k]==='string'&&row[k].length<=80,'JOURNAL_ROW_INVALID');r[k]=row[k].trim();}return r;});
 const cursor=Object.fromEntries(cursors.map(k=>{check(typeof block[k]==='string'&&block[k].length<=24,'JOURNAL_CURSOR_INVALID');return [k,block[k].trim()];}));
 return {summary,rows:normalized,cursor};
}
export function journalContinuation(headers,cursor){
 const raw=headers.get('tr_cont'),key=headers.get('tr_cont_key')||'',bodyMore=Object.values(cursor).some(Boolean);
 check(raw===null||raw.trim()===''||['N','Y'].includes(raw.trim()),'JOURNAL_CURSOR_INVALID');
 const flag=raw?.trim()||null;
 if(flag==='Y'){check(key.length>0,'JOURNAL_CURSOR_INVALID');return {done:false,flag:'Y',key,fallback:false};}
 // This TR also uses four explicit body CTS fields; absent headers alone do not mean completion.
 return {done:!bodyMore,flag:'N',key:'',fallback:flag===null};
}
function reconcileRows(rows,summary){
 const sum={BUY:{qty:0,amt:0},SELL:{qty:0,amt:0}};
 for(const row of rows){
  const side=row.medosu==='매수'?'BUY':row.medosu==='매도'?'SELL':null;
  if(!side){check(!row.expcode,'JOURNAL_SIDE_UNVERIFIED');continue;}
  check(/^(?:A)?[0-9A-Z]{6}$/.test(row.expcode),'JOURNAL_SYMBOL_UNVERIFIED');
  sum[side].qty+=row.qty;sum[side].amt+=row.amt;
  check(Number.isSafeInteger(sum[side].qty)&&Number.isSafeInteger(sum[side].amt),'JOURNAL_AMOUNT_INVALID');
 }
 check(sum.BUY.qty===summary.msqty&&sum.BUY.amt===summary.msamt&&sum.SELL.qty===summary.mdqty&&sum.SELL.amt===summary.mdamt,'JOURNAL_INCOMPLETE_ROWS');
}
/** Daily aggregates are not fills. Keep subtotal rows for display, never feed to the cost-basis engine. */
export async function collectJournal(env,{fetcher,token,date,now=Date.now(),pause=ms=>new Promise(r=>setTimeout(r,ms)),tr='t0150'}){
 check(['t0150','t0151'].includes(tr),'JOURNAL_TR_INVALID');
 const anchor=day(),stateKey=tr==='t0151'?'journalPrevious':'journal',errorKey=tr==='t0151'?'journalPreviousError':'journalError';
 check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date&&(tr==='t0150'?date===anchor:date<anchor),'JOURNAL_DATE_CHANGED');
 const previous=await readState(env,stateKey);if(previous?.date===date&&previous.complete){await saveJournalDay(env,previous);return {alreadyComplete:true};}
 try{
  const started=performance.now();
  let cursor=Object.fromEntries(cursors.map(k=>[k,''])),continuation={flag:'N',key:''},rows=[],summary,seen=new Set();
  for(let page=0;page<40;page++){
   check(anchor===day(),'JOURNAL_DATE_CHANGED');check(performance.now()-started<55000,'JOURNAL_TIME_LIMIT');
   if(page)await pause(600);
   const response=await fetcher('https://openapi.ls-sec.co.kr:8080/stock/accno',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json; charset=utf-8',authorization:'Bearer '+token,tr_cd:tr,tr_cont:continuation.flag,tr_cont_key:continuation.key},body:JSON.stringify({[tr+'InBlock']:{...(tr==='t0151'?{date:date.replaceAll('-','')}:{}),...cursor}})});
   check(response.ok,'JOURNAL_UNAVAILABLE');const text=await response.text();check(text.length<1500000,'JOURNAL_RESPONSE_LIMIT');
   // Reject unsafe monetary integers rather than round 18-digit fields.
   const parsed=journalPage(JSON.parse(text),tr),next=journalContinuation(response.headers,parsed.cursor);
   if(!summary)summary=parsed.summary;else check(JSON.stringify(summary)===JSON.stringify(parsed.summary),'JOURNAL_CHANGED_DURING_QUERY');
   rows.push(...parsed.rows);check(rows.length<=10000,'JOURNAL_ROW_LIMIT');
   check(anchor===day(),'JOURNAL_DATE_CHANGED');
   if(next.done){
    if(next.fallback)reconcileRows(rows,summary);
    const saved={version:tr==='t0151'?'LS_T0151_V1':JOURNAL_VERSION,date,asOf:new Date(now).toISOString(),complete:true,summary,rows,pages:page+1,source:'LS/'+tr,pnlAvailable:false};
    await saveJournalDay(env,saved);await writeState(env,stateKey,saved);await writeState(env,errorKey,{code:null});return {ok:true};
   }
   check(parsed.rows.length>0,'JOURNAL_CURSOR_INVALID');const signature=JSON.stringify([next.key,parsed.cursor]);check(!seen.has(signature),'JOURNAL_CURSOR_REPEATED');seen.add(signature);cursor=parsed.cursor;continuation={flag:next.flag,key:next.key};
  }
  throw Error('JOURNAL_PAGE_LIMIT');
 }catch(error){const code=/^JOURNAL_[A-Z_]+$/.test(error?.message)?error.message:'JOURNAL_SYNC_FAILED';await writeState(env,errorKey,{code,at:new Date(now).toISOString(),date});return {ok:false,error:code};}
}
export function visibleJournal(saved){if(!saved?.complete)return null;return {...saved,rows:saved.rows.slice(0,200),totalRows:saved.rows.length};}
