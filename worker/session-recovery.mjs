import {sessionRecoveryAllowed} from '../shared/market-session.mjs';
const encode=new TextEncoder();
const key=secret=>crypto.subtle.importKey('raw',encode.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const input=(date,time)=>encode.encode('market-note/session-recovery/v1|POST|/internal/session-recovery|'+date+'|'+time);
export async function sessionRecoverySignature(secret,date,time){return [...new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),input(date,time)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function handleSessionRecovery(request,env,deps,now=new Date()){
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST'||request.headers.has('origin'))return reply({error:'RECOVERY_NOT_ALLOWED'},403);
 const date=request.headers.get('X-Session-Date'),time=request.headers.get('X-Session-Time'),signature=request.headers.get('X-Session-Signature');
 if(date!=='2026-11-19'||!/^\d{13}$/.test(time||'')||Math.abs(+now-Number(time))>300000||!/^[a-f0-9]{64}$/.test(signature||'')||!env.TELEGRAM_BOT_TOKEN)return reply({error:'RECOVERY_AUTH_REQUIRED'},401);
 if(!await crypto.subtle.verify('HMAC',await key(env.TELEGRAM_BOT_TOKEN),Uint8Array.from(signature.match(/../g).map(x=>parseInt(x,16))),input(date,time)))return reply({error:'RECOVERY_AUTH_REQUIRED'},401);
 const recoveryEnv={...env,RECOVER_SESSION:date};if(!sessionRecoveryAllowed(recoveryEnv,now))return reply({error:'RECOVERY_DATE_WINDOW'},409);
 const id='session-recovery:'+date,put=body=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(body)).run();
 const startedAt=now.toISOString();let stage='closing';
 try{
  for(const [name,task] of [['closing',deps.collectClosingFlows],['intraday',deps.recoverIntradayFlows],['program',deps.collectProgramFlow],['stocks',deps.collect],['charts',deps.enrichDetails]]){
   stage=name;await put({date,status:'running',stage,startedAt,updatedAt:new Date().toISOString()});await task(recoveryEnv);
  }
  stage='etfs';for(let i=0;i<6;i++){await put({date,status:'running',stage,pass:i+1,startedAt,updatedAt:new Date().toISOString()});if(!await deps.safeCollectSectorEtfs(recoveryEnv))break;}
  await deps.probeVenueFlows(recoveryEnv);
  let drawdownsQueued=0;if(env.COLLECTOR){const cached=await env.DB.prepare("SELECT id FROM state WHERE id LIKE 'drawdown:prices:%' LIMIT 30").all();for(const row of cached.results||[]){const symbol=row.id.split(':').at(-1);if(!/^[0-9A-Z]{6}$/.test(symbol))continue;const objectId=env.COLLECTOR.idFromName('drawdown-'+symbol);await env.COLLECTOR.get(objectId).fetch('https://collector.internal/drawdown?symbol='+symbol,{method:'POST'});drawdownsQueued++;}}
  const read=async key=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key).first();return r?JSON.parse(r.payload):null;};
  const d=await read('details:'+date),p=await read('program-flow:'+date),e=await read('sector-etfs:v1'),snap=await env.DB.prepare('SELECT payload FROM snapshots WHERE date=?').bind(date).first();
  const report={date,status:d?.closingRecovery?.tradeDate===date&&d?.intradayRecovery?.status==='COMPLETE'&&p?.markets?.KOSPI?.length&&p?.markets?.KOSDAQ?.length&&!Object.keys(p?.errors||{}).length?'complete':'partial',startedAt,completedAt:new Date().toISOString(),drawdownsQueued,closing:d?.closingRecovery||null,indices:Object.fromEntries(Object.entries(d?.indices||{}).map(([b,q])=>[b,{value:q.value,asOf:q.asOf,chart:q.series?.length}])),flowsAsOf:d?.flows?.asOf,history:{count:d?.flowHistory?.length,first:d?.flowHistory?.[0]?.time,last:d?.flowHistory?.at(-1)?.time,status:d?.intradayRecovery},program:{asOf:p?.asOf,counts:Object.fromEntries(Object.entries(p?.markets||{}).map(([b,rows])=>[b,rows.length])),errors:p?.errors},stocks:snap?JSON.parse(snap.payload).stocks.length:0,etfs:{count:Object.keys(e?.quotes||{}).length,updatedAt:e?.lastAttemptAt,error:e?.error||null}};
  await put(report);return reply(report);
 }catch(e){const report={date,status:'failed',stage,startedAt,code:String(e.code||e.message||'RECOVERY_FAILED').replace(/[^A-Z0-9_]/g,'').slice(0,80)};await put(report);return reply(report,502);}
}
