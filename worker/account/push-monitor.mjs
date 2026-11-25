import {guardClock} from '../../src/account/loss-guard.mjs';
import {readState,writeState} from './store.mjs';
import {guardStatus,pollGuard} from './loss-guard.mjs';
import {monitorWindow,nextMonitorAt,pushDecision} from './push-rules.mjs';
import {subscriptions,saveSubscriptions,pushLock,sendBrowserPush,ensurePushKeys} from './push.mjs';
const key='lossguard:push:monitor';
export async function verifiedTradingDay(env,now,fetcher=fetch){const date=guardClock(now).date;if((await readState(env,'lossguard:push:tradingDate'))?.date===date)return true;try{const r=await fetcher('https://market-note-ls-api.kby0991.workers.dev/api/dashboard',{redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)return false;const text=await r.text();if(text.length>2000000)return false;const data=JSON.parse(text);const verified=data.snapshots?.some(s=>s.date===date&&String(s.source).startsWith('LS증권 KRX')&&Number.isFinite(Date.parse(s.asOf))&&guardClock(s.asOf).date===date);if(verified)await writeState(env,'lossguard:push:tradingDate',{date});return !!verified;}catch{return false;}}
export async function runServerMonitor(env,sessionFactory,{now=Date.now(),poll=pollGuard,send=sendBrowserPush,marketCheck=verifiedTradingDay,readStatus=guardStatus}={}){
 const list=await subscriptions(env);if(!list.some(s=>s.enabled))return {enabled:false};
 if(!monitorWindow(now)){const result={enabled:true,status:'OUTSIDE_MARKET_HOURS',nextCheckAt:new Date(nextMonitorAt(now)).toISOString(),checkedAt:new Date(now).toISOString()};await writeState(env,key,result);return result;}
 if(!await marketCheck(env,now)){const waiting={enabled:true,status:'WAITING_FOR_TRADING_DAY',lastCheckAt:new Date(now).toISOString(),nextCheckAt:new Date(now+30000).toISOString()};await writeState(env,key,waiting);return waiting;}
 const result=await poll(env,sessionFactory),data=await readStatus(env);const fresh=data.state&&now-Date.parse(data.state.lastSampleAt)<=90000&&Date.parse(data.state.lastSampleAt)<=Date.now()+120000;
 if(!fresh){const status={enabled:true,status:result.busy||result.throttled?'WAITING_FOR_FRESH_DATA':'COLLECTION_DELAYED',lastCheckAt:new Date(now).toISOString(),nextCheckAt:new Date(now+30000).toISOString()};await writeState(env,key,status);return status;}
 await ensurePushKeys(env);let sent=0;
 for(const sub of list.filter(s=>s.enabled)){
  const decision=pushDecision(data.state,sub.notificationState,data.settings,now);
  if(!decision.kind){await pushLock(env,async()=>{const current=await subscriptions(env),own=current.find(s=>s.id===sub.id);if(own&&own.enabled){own.notificationState=decision.notificationState;await saveSubscriptions(env,current);}});continue;}
  let reserved=false;const eventId=crypto.randomUUID();await pushLock(env,async()=>{const current=await subscriptions(env),own=current.find(s=>s.id===sub.id);if(own?.enabled&&(!own.pending||own.pending.until<=now)){own.pending={eventId,until:now+120000};await saveSubscriptions(env,current);reserved=true;}});if(!reserved)continue;
  let delivery;try{delivery=await send(env,sub,decision.kind);}catch{delivery={accepted:false,status:0,expired:false};}
  await pushLock(env,async()=>{const current=await subscriptions(env),own=current.find(s=>s.id===sub.id);if(own?.pending?.eventId===eventId){delete own.pending;own.lastDeliveryStatus=delivery.status;if(delivery.accepted){own.notificationState=decision.notificationState;own.lastSentAt=new Date(now).toISOString();sent++;}if(delivery.expired)own.enabled=false;await saveSubscriptions(env,current);}});
 }
 const status={enabled:true,status:'MONITORING',lastCheckAt:new Date(now).toISOString(),lastSampleAt:data.state.lastSampleAt,lastSuccessAt:new Date(now).toISOString(),nextCheckAt:new Date(now+30000).toISOString(),sent};await writeState(env,key,status);return status;
}
export class AccountPushMonitor {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){if(request.method!=='POST'||new URL(request.url).pathname!=='/wake')return new Response(null,{status:404});const active=(await subscriptions(this.env)).some(s=>s.enabled);if(!active){await this.state.storage.deleteAlarm();await writeState(this.env,key,{...(await readState(this.env,key)),enabled:false,status:'DISABLED',nextCheckAt:null});return Response.json({enabled:false});}const at=monitorWindow()?Date.now()+100:nextMonitorAt();await this.state.storage.setAlarm(at);await writeState(this.env,key,{...(await readState(this.env,key)),enabled:true,status:monitorWindow()?'SCHEDULED':'OUTSIDE_MARKET_HOURS',nextCheckAt:new Date(at).toISOString()});return Response.json({enabled:true,nextCheckAt:new Date(at).toISOString()});}
 async alarm(){if(!(await subscriptions(this.env)).some(s=>s.enabled)){await this.state.storage.deleteAlarm();return;}const now=Date.now();await this.state.storage.setAlarm(nextMonitorAt(now));try{const {createCoordinatedSession}=await import('../ls-session.mjs');await runServerMonitor(this.env,createCoordinatedSession,{now});}catch{await writeState(this.env,key,{enabled:true,status:'MONITOR_DELAYED',lastCheckAt:new Date(now).toISOString(),nextCheckAt:new Date(nextMonitorAt()).toISOString()});}}
}
