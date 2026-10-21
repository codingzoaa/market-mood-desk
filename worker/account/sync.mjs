import {collectJournal} from './t0150.mjs';
import {saveLedger} from './ledger-store.mjs';
import {collectWindow,kst} from '../ls.mjs';
import {check,opaqueID} from './security.mjs';
import {readState,writeState,saveTrades} from './store.mjs';
import {reviewedContract,tokenForAccount,accountPage} from './provider.mjs';
const day=now=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(now));
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function accountSyncWindow(env,now=Date.now()){
 if(!['AFTER_CLOSE','DAILY_1630'].includes(env.ACCOUNT_SYNC_MODE))return collectWindow(new Date(now));
 const clock=kst(new Date(now));
 if(env.ACCOUNT_SYNC_MODE==='DAILY_1630')return !['Sat','Sun'].includes(clock.weekday)&&clock.time>='1630'&&clock.time<='1645';
 return !['Sat','Sun'].includes(clock.weekday)&&clock.time>='1540'&&clock.time<='2355';
}
export async function syncAccount(env,sessionFactory,now=Date.now()){
 if(env.ENABLE_ACCOUNT_SYNC!=='true')return {enabled:false};
 if(!accountSyncWindow(env,now))return {enabled:true,marketClosed:true};
 let c;try{c=reviewedContract(env);}catch{return {enabled:true,error:'LS_CONTRACT_REQUIRED'};}
 const owner=crypto.randomUUID(),started=performance.now();
 const claimed=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=? WHERE id='sync' AND expires<=? RETURNING id").bind(now+120000,owner,now).first();if(!claimed)return {busy:true};
 let session;
 try{
  const saved=await readState(env,'sync'),today=day(now),initial=env.ACCOUNT_START_DATE;
  check(typeof initial==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(initial)&&Number.isFinite(Date.parse(initial+'T00:00:00Z'))&&new Date(initial+'T00:00:00Z').toISOString().slice(0,10)===initial&&initial<=today,'ACCOUNT_START_DATE_REQUIRED');
  const daily=env.ACCOUNT_SYNC_MODE==='DAILY_1630';
  const ledgerComplete=daily&&saved?.dailyDate===today&&!saved.job&&saved.through===today;
  const journalEnabled=daily&&env.ENABLE_T0150==='true';
  if(ledgerComplete&&(!journalEnabled||(await readState(env,'journal'))?.date===today))return {ok:true,more:false,alreadyComplete:true};
  const job=daily?(saved?.dailyDate===today&&saved.job?saved.job:{from:today,to:today,continuation:{flag:'N',key:''}}):(saved?.job||{from:saved?.through?shift(saved.through,-1):initial,to:null,continuation:{flag:'N',key:''}});
  if(!job.to)job.to=[shift(job.from,c.maxRangeDays-1),today].sort()[0];
  // A delayed scheduled event must never start shared-key OAuth during quotes.
  if(['AFTER_CLOSE','DAILY_1630'].includes(env.ACCOUNT_SYNC_MODE))check(accountSyncWindow(env,Date.now()),'ACCOUNT_SYNC_WINDOW_CLOSED');
  session=await sessionFactory();
  // LS tokens can be bound to the egress IP: acquire and use in the same TLS session.
  // No account OAuth token is persisted to D1 or shared with the public collector.
  const oauth=await tokenForAccount(env,session.fetch);
  if(ledgerComplete){const journal=await collectJournal(env,{fetcher:session.fetch,token:oauth.token,date:today,now});return {ok:true,more:false,journal};}
  const page=await accountPage(env,{job,token:oauth.token,fetcher:session.fetch});
  let digests=job.pageDigests||[];
  if(page.ledgerRows&&!page.done){check(page.ledgerRows.length>0&&digests.length<1000,'LEDGER_CURSOR_LIMIT');const fingerprint=await opaqueID(env,'ledger-page:'+JSON.stringify(page.ledgerRows));check(!digests.includes(fingerprint),'LEDGER_CURSOR_REPEATED_PAGE');digests=[...digests,fingerprint];}
  const clock=now+Math.floor(performance.now()-started);
  const renewed=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=? WHERE id='sync' AND owner=? AND expires>? RETURNING id").bind(clock+120000,owner,clock).first();check(renewed,'SYNC_LEASE_EXPIRED');
  const result=page.ledgerRows?await saveLedger(env,page.ledgerRows):await saveTrades(env,page.trades);
  const next=page.done?(job.to<today?{from:shift(job.to,1),to:null,continuation:{flag:'N',key:''}}:null):{...job,continuation:page.continuation,...(page.ledgerRows?{pageDigests:digests}:{})};
  await writeState(env,'sync',{job:next,through:page.done?job.to:saved?.through||null,...(daily?{dailyDate:today}:{}),lastSuccessAt:new Date(now).toISOString(),lastPage:result,contractVersion:page.contractVersion,error:null});
  await writeState(env,'lastError',{code:null});
  const journal=journalEnabled&&!next?await collectJournal(env,{fetcher:session.fetch,token:oauth.token,date:today,now}):null;
  return {ok:true,more:!!next,...(journal?{journal}:{})};
 }catch{await writeState(env,'lastError',{code:'ACCOUNT_SYNC_FAILED',at:new Date(now).toISOString()});return {ok:false,error:'ACCOUNT_SYNC_FAILED'};}
 finally{try{if(session)await session.close();}finally{await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=NULL WHERE id='sync' AND owner=?").bind(now+Math.floor(performance.now()-started)+(env.ACCOUNT_SYNC_MODE==='DAILY_1630'?0:30000),owner).run();}}
}
export async function runScheduledAccountSync(env,sessionFactory){
 const started=Date.now();
 for(let pages=0;pages<100;pages++){
  const result=await syncAccount(env,sessionFactory);
  if(env.ACCOUNT_SYNC_MODE!=='DAILY_1630'||!result.ok||!result.more)return result;
  if(Date.now()-started>=600000)return {ok:true,more:true,limited:true};
  await new Promise(resolve=>setTimeout(resolve,1100));
 }
 return {ok:true,more:true,limited:true};
}
