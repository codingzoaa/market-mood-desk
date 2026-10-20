import {tokenForAccount,accountPage} from './provider.mjs';
import {saveLedger} from './ledger-store.mjs';
import {writeState} from './store.mjs';
import {kst} from '../ls.mjs';
// Owner-triggered, single historical page. Never advances the backfill checkpoint.
// Keep the shared app key idle throughout the public collector's market session.
export async function checkAccountConnection(env,sessionFactory,now=Date.now()){
 const clock=kst(new Date(now));
 if(!['Sat','Sun'].includes(clock.weekday)&&clock.time>='0850'&&clock.time<='1535')return {ok:false,error:'PUBLIC_COLLECTOR_ACTIVE'};
 const owner=crypto.randomUUID(),started=performance.now();
 const lease=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=? WHERE id='sync' AND expires<=? RETURNING id").bind(now+120000,owner,now).first();
 if(!lease)return {ok:false,error:'ACCOUNT_BUSY'};
 let session,phase='AUTH';
 try{
  let date=new Date(Date.parse(clock.date+'T00:00:00Z')-86400000);
  while([0,6].includes(date.getUTCDay()))date=new Date(date.getTime()-86400000);
  const historicalDate=date.toISOString().slice(0,10);
  session=await sessionFactory();
  const oauth=await tokenForAccount(env,session.fetch);phase='QUERY';
  const page=await accountPage(env,{job:{from:historicalDate,to:historicalDate,continuation:{flag:'N',key:''}},token:oauth.token,fetcher:session.fetch});
  if(!page.ledgerRows)throw Error('LS_ACCOUNT_RESPONSE_INVALID');
  phase='STORE';
  const at=now+Math.floor(performance.now()-started);
  const renewed=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=? WHERE id='sync' AND owner=? AND expires>? RETURNING id").bind(at+120000,owner,at).first();
  if(!renewed)throw Error('SYNC_LEASE_EXPIRED');
  await saveLedger(env,page.ledgerRows);
  const result={ok:true,received:page.ledgerRows.length,accountVerified:page.ledgerRows.length>0,more:!page.done,checkedAt:new Date(now).toISOString()};
  await writeState(env,'connectionCheck',result);return result;
 }catch(error){
  const allowed=['LS_ACCOUNT_NOT_CONFIGURED','LS_ACCOUNT_AUTH_FAILED','LS_ACCOUNT_TR_FAILED','LS_ACCOUNT_UNAVAILABLE','LS_ACCOUNT_RESPONSE_INVALID','LS_ACCOUNT_CURSOR_MISSING','LS_ACCOUNT_CURSOR_INVALID','LS_ACCOUNT_RANGE_MISMATCH','LS_ACCOUNT_LOSSLESS_JSON_REQUIRED','SYNC_LEASE_EXPIRED'];
  const result={ok:false,error:allowed.includes(error?.message)?error.message:'LS_ACCOUNT_'+phase+'_FAILED',phase,...(typeof error?.providerCode==='string'&&/^(?:[0-9]{4,6}|[A-Z]{2,8}[0-9]{3,8})$/.test(error.providerCode)?{providerCode:error.providerCode}:{}),checkedAt:new Date(now).toISOString()};
  await writeState(env,'connectionCheck',result);return result;
 }finally{
  try{if(session)await session.close();}finally{await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=NULL WHERE id='sync' AND owner=?").bind(now+Math.floor(performance.now()-started)+30000,owner).run();}
 }
}
