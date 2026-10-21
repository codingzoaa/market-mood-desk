import {check} from './security.mjs';
import {readState,writeState} from './store.mjs';
export const JOURNAL_VERSION='LS_T0150_V1';
const cursors=['cts_medosu','cts_expcode','cts_price','cts_middiv'];
const totals=['mdqty','mdamt','mdfee','mdtax','mdargtax','tmdtax','mdadjamt','msqty','msamt','msfee','tmstax','msadjamt','tqty','tamt','tfee','tottax','targtax','ttax','tadjamt'];
const amounts=['qty','price','amt','fee','tax','argtax','adjamt'];
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
function integer(value,signed=false){check(typeof value==='number'||typeof value==='string'&&/^-?\d+$/.test(value),'JOURNAL_AMOUNT_INVALID');const n=Number(value);check(Number.isSafeInteger(n)&&(signed||n>=0),'JOURNAL_AMOUNT_INVALID');return n;}
export function journalPage(data){
 check(typeof data.rsp_cd==='string'&&/^0{1,6}$/.test(data.rsp_cd),'JOURNAL_QUERY_FAILED');
 const block=data.t0150OutBlock,rows=data.t0150OutBlock1;
 check(block&&typeof block==='object'&&!Array.isArray(block)&&Array.isArray(rows)&&rows.length<=1000,'JOURNAL_SHAPE_INVALID');
 const summary=Object.fromEntries(totals.map(k=>[k,integer(block[k],k==='tadjamt')]));
 check(summary.ttax===summary.tfee+summary.tottax+summary.targtax&&summary.tmdtax===summary.mdfee+summary.mdtax+summary.mdargtax&&summary.tmstax===summary.msfee,'JOURNAL_COST_MISMATCH');
 check(summary.mdadjamt===summary.mdamt-summary.tmdtax&&summary.msadjamt===summary.msamt+summary.tmstax&&summary.tadjamt===summary.mdadjamt-summary.msadjamt,'JOURNAL_SETTLEMENT_MISMATCH');
 const normalized=rows.map(row=>{check(row&&typeof row==='object','JOURNAL_ROW_INVALID');const r=Object.fromEntries(amounts.map(k=>[k,integer(row[k])]));for(const k of ['medosu','expcode','middiv']){check(typeof row[k]==='string'&&row[k].length<=80,'JOURNAL_ROW_INVALID');r[k]=row[k].trim();}return r;});
 const cursor=Object.fromEntries(cursors.map(k=>{check(typeof block[k]==='string'&&block[k].length<=24,'JOURNAL_CURSOR_INVALID');return [k,block[k].trim()];}));
 return {summary,rows:normalized,cursor};
}
/** Daily aggregates are not fills. Keep subtotal rows for display, never feed to the cost-basis engine. */
export async function collectJournal(env,{fetcher,token,date,now=Date.now(),pause=ms=>new Promise(r=>setTimeout(r,ms))}){
 check(date===day(),'JOURNAL_DATE_CHANGED');
 const previous=await readState(env,'journal');if(previous?.date===date&&previous.complete)return {alreadyComplete:true};
 try{
  const started=performance.now();
  let cursor=Object.fromEntries(cursors.map(k=>[k,''])),continuation={flag:'N',key:''},rows=[],summary,seen=new Set();
  for(let page=0;page<40;page++){
   check(date===day(),'JOURNAL_DATE_CHANGED');check(performance.now()-started<55000,'JOURNAL_TIME_LIMIT');
   if(page)await pause(600);
   const response=await fetcher('https://openapi.ls-sec.co.kr:8080/stock/accno',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json; charset=utf-8',authorization:'Bearer '+token,tr_cd:'t0150',tr_cont:continuation.flag,tr_cont_key:continuation.key},body:JSON.stringify({t0150InBlock:cursor})});
   check(response.ok,'JOURNAL_UNAVAILABLE');const text=await response.text();check(text.length<1500000,'JOURNAL_RESPONSE_LIMIT');
   // Reject unsafe monetary integers rather than round 18-digit fields.
   const parsed=journalPage(JSON.parse(text)),flag=response.headers.get('tr_cont'),key=response.headers.get('tr_cont_key');
   check(['N','Y'].includes(flag),'JOURNAL_CURSOR_MISSING');
   if(!summary)summary=parsed.summary;else check(JSON.stringify(summary)===JSON.stringify(parsed.summary),'JOURNAL_CHANGED_DURING_QUERY');
   rows.push(...parsed.rows);check(rows.length<=10000,'JOURNAL_ROW_LIMIT');
   check(date===day(),'JOURNAL_DATE_CHANGED');
   if(flag==='N'){
    const saved={version:JOURNAL_VERSION,date,asOf:new Date(now).toISOString(),complete:true,summary,rows,pages:page+1,source:'LS/t0150',pnlAvailable:false};
    await writeState(env,'journal',saved);await writeState(env,'journalError',{code:null});return {ok:true};
   }
   check(key&&parsed.rows.length>0,'JOURNAL_CURSOR_INVALID');const signature=JSON.stringify([key,parsed.cursor]);check(!seen.has(signature),'JOURNAL_CURSOR_REPEATED');seen.add(signature);cursor=parsed.cursor;continuation={flag,key};
  }
  throw Error('JOURNAL_PAGE_LIMIT');
 }catch(error){const code=/^JOURNAL_[A-Z_]+$/.test(error?.message)?error.message:'JOURNAL_SYNC_FAILED';await writeState(env,'journalError',{code,at:new Date(now).toISOString(),date});return {ok:false,error:code};}
}
export function visibleJournal(saved){if(!saved?.complete)return null;return {...saved,rows:saved.rows.slice(0,200),totalRows:saved.rows.length};}
