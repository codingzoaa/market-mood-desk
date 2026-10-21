import {saveJournalDay} from './journal-history.mjs';
import {collectJournal} from './t0150.mjs';
import {readState,writeState} from './store.mjs';
import {tokenForAccount} from './provider.mjs';
/** Admin-configured expiring historical-only job. Never exposes account data or adds a public route. */
export async function priorJournalOnce(env,sessionFactory,now=Date.now()){
 const version='LS_JOURNAL_CTS_V2';
 const date=env.ACCOUNT_PRIOR_ONCE_DATE,expires=Date.parse(env.ACCOUNT_PRIOR_ONCE_EXPIRES||''),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(now));
 if(!date||!Number.isFinite(expires)||expires<=now||expires-now>600000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=today)return {skipped:true};
 const existing=await readState(env,'journalPrevious');
 if(existing?.date===date){const owner=crypto.randomUUID(),claim=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=? WHERE id='sync' AND expires<=? RETURNING id").bind(now+120000,owner,now).first();if(!claim)return {busy:true};try{await saveJournalDay(env,existing);return {alreadyComplete:true};}finally{await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=NULL WHERE id='sync' AND owner=?").bind(now,owner).run();}}
 const owner=crypto.randomUUID(),started=performance.now(),claimed=await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=? WHERE id='sync' AND expires<=? RETURNING id").bind(now+120000,owner,now).first();if(!claimed)return {busy:true};
 let session;
 const priorAttempt=await readState(env,'priorOnceAttempt');
 if(priorAttempt?.date===date&&priorAttempt.version===version){await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=NULL WHERE id='sync' AND owner=?").bind(now,owner).run();return {alreadyAttempted:true};}
 try{await writeState(env,'priorOnceAttempt',{date,version,at:new Date(now).toISOString()});session=await sessionFactory();const oauth=await tokenForAccount(env,session.fetch);return await collectJournal(env,{fetcher:session.fetch,token:oauth.token,date,tr:'t0151',now});}
 catch{await writeState(env,'journalPreviousError',{code:'JOURNAL_SYNC_FAILED',date,at:new Date(now).toISOString()});return {ok:false};}
 finally{try{if(session)await session.close();}finally{await env.PRIVATE_DB.prepare("UPDATE account_lease SET expires=?,owner=NULL WHERE id='sync' AND owner=?").bind(now+Math.floor(performance.now()-started)+30000,owner).run();}}
}
