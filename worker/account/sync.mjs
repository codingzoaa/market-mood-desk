import {collectWindow} from '../ls.mjs';
import {check} from './security.mjs';
import {readState,writeState,saveTrades} from './store.mjs';
import {reviewedContract,tokenForAccount,accountPage} from './provider.mjs';
const day=now=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(now));
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export async function syncAccount(env,sessionFactory,now=Date.now()){
 if(env.ENABLE_ACCOUNT_SYNC!=='true')return {enabled:false};
 if(!collectWindow(new Date(now)))return {enabled:true,marketClosed:true};
 let c;try{c=reviewedContract(env);}catch{return {enabled:true,error:'LS_CONTRACT_REQUIRED'};}
 const owner=crypto.randomUUID(),started=performance.now();
 const claimed=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=? WHERE id='sync' AND expires<=? RETURNING id").bind(now+120000,owner,now).first();if(!claimed)return {busy:true};
 let session;
 try{
  const saved=await readState(env,'sync'),today=day(now),initial=env.ACCOUNT_START_DATE;
  check(typeof initial==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(initial)&&Number.isFinite(Date.parse(initial+'T00:00:00Z'))&&new Date(initial+'T00:00:00Z').toISOString().slice(0,10)===initial&&initial<=today,'ACCOUNT_START_DATE_REQUIRED');
  const job=saved?.job||{from:saved?.through?shift(saved.through,-1):initial,to:null,continuation:{flag:'N',key:''}};
  if(!job.to)job.to=[shift(job.from,c.maxRangeDays-1),today].sort()[0];
  session=await sessionFactory();
  // LS tokens can be bound to the egress IP: acquire and use in the same TLS session.
  // No account OAuth token is persisted to D1 or shared with the public collector.
  const oauth=await tokenForAccount(env,session.fetch);
  const page=await accountPage(env,{job,token:oauth.token,fetcher:session.fetch});
  const clock=now+Math.floor(performance.now()-started);
  const renewed=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=? WHERE id='sync' AND owner=? AND expires>? RETURNING id").bind(clock+120000,owner,clock).first();check(renewed,'SYNC_LEASE_EXPIRED');
  const result=await saveTrades(env,page.trades);
  const next=page.done?(job.to<today?{from:shift(job.to,1),to:null,continuation:{flag:'N',key:''}}:null):{...job,continuation:page.continuation};
  await writeState(env,'sync',{job:next,through:page.done?job.to:saved?.through||null,lastSuccessAt:new Date(now).toISOString(),lastPage:result,contractVersion:page.contractVersion,error:null});
  await writeState(env,'lastError',{code:null});
  return {ok:true,more:!!next};
 }catch{await writeState(env,'lastError',{code:'ACCOUNT_SYNC_FAILED',at:new Date(now).toISOString()});return {ok:false,error:'ACCOUNT_SYNC_FAILED'};}
 finally{try{if(session)await session.close();}finally{await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=NULL WHERE id='sync' AND owner=?").bind(now+Math.floor(performance.now()-started)+30000,owner).run();}}
}
