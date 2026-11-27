import {kst} from './ls.mjs';
import {marketSession} from '../shared/market-session.mjs';
import {classify,FRAMES,readVwmaScanner} from './vwma-scanner.mjs';

const PREFIX='vwma-alert:v1:',MAX_AGE=25*60000,EVENT_AGE=5*60000;
const targets=['단기 전환','중기 전환','상승 정렬'];
const read=async(env,id)=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();return r?JSON.parse(r.payload):null;};
const save=(env,id,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
const complete=row=>FRAMES.every(f=>{const x=row.frames?.[f];return x&&Number.isFinite(x.gap)&&Number.isFinite(x.vwma)&&x.vwma>0&&Number.isFinite(Date.parse(x.barAt));});
export function transition(previous,current){
 if(previous===current)return null;
 if(previous==='상승 정렬')return '상승 정렬 이탈';
 return targets.includes(current)?current+' 진입':null;
}
export function formatVwmaAlert(event){
 const time=kst(new Date(event.checkedAt)).time;
 return ['🔔 마켓노트 거가중 100선',event.name+' ('+event.symbol+')',event.kind,event.from+' → '+event.to,event.date+' '+time.slice(0,2)+':'+time.slice(2)+' KST · 조회 기준',...FRAMES.map((f,i)=>['5분','60분','240분','일봉'][i]+' '+(event.frames[f].gap>=0?'+':'')+event.frames[f].gap.toFixed(2)+'%'),'※ 각 봉 종가와 거가중 100선의 차이 · 종목별 약 20분 순환 조회','https://codingzoaa.github.io/market-mood-desk/#stocks'].join('\n');
}
export async function readVwmaAlertStatus(env){
 const state=await read(env,PREFIX+'status');
 return {enabled:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),scope:'scanner-top20',targets:[...targets,'상승 정렬 이탈'],...state};
}
export async function deliverVwmaAlerts(env,{now=new Date(),fetcher=fetch}={}){
 const k=kst(now),session=marketSession(k.date);
 if(['Sat','Sun'].includes(k.weekday)||k.time<session.open||k.time>=session.close)return {status:'outside-session'};
 const data=await readVwmaScanner(env);
 if(data.date!==k.date||data.historicalBootstrap||data.status!=='collecting')return {status:'not-live'};
 const configured=!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID);
 let baselines=0,queued=0,sent=0,failed=0,uncertain=0;
 for(const row of data.rows||[]){
  const at=Date.parse(row.checkedAt);
  if(!/^\d{6}$/.test(row.symbol)||!Number.isFinite(at)||at>+now||+now-at>EVENT_AGE)continue;
  const id=PREFIX+'baseline:'+row.symbol,old=await read(env,id);
  if(old&&Date.parse(old.checkedAt)>=at)continue;
  const valid=complete(row),pattern=valid?classify(row.frames):null;
  const canCompare=configured&&old?.configured&&old?.valid&&valid&&old.date===k.date&&at-Date.parse(old.checkedAt)<=MAX_AGE;
  const kind=canCompare?transition(old.pattern,pattern):null;
  if(kind){
   const event={date:k.date,symbol:row.symbol,name:String(row.name||row.symbol).slice(0,80),kind,from:old.pattern,to:pattern,frames:row.frames,checkedAt:row.checkedAt,status:'queued'};
   const result=await env.DB.prepare('INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)').bind(PREFIX+'event:'+row.symbol+':'+at,JSON.stringify(event)).run();
   queued+=result.meta?.changes||0;
  }
  await save(env,id,{date:k.date,checkedAt:row.checkedAt,valid,pattern,configured});baselines++;
 }
 if(configured){
  const pending=await env.DB.prepare("SELECT id,payload FROM state WHERE id LIKE ? AND json_extract(payload,'$.status')='queued' ORDER BY id LIMIT 20").bind(PREFIX+'event:%').all();
  for(const record of pending.results||[]){
   const event=JSON.parse(record.payload),age=+now-Date.parse(event.checkedAt);
   if(event.date!==k.date||age<0||age>EVENT_AGE){await save(env,record.id,{...event,status:'expired'});continue;}
   const claim=await env.DB.prepare("UPDATE state SET payload=json_set(payload,'$.status','sending') WHERE id=? AND json_extract(payload,'$.status')='queued' RETURNING payload").bind(record.id).first();
   if(!claim)continue;
   // A timeout may happen after Telegram accepted a message. Never automatically
   // retry an ambiguous transmission; this keeps the same transition from repeating.
   try{
    const response=await fetcher('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:formatVwmaAlert(event),link_preview_options:{is_disabled:true}})});
    const result=await response.json();
    if(response.ok&&result.ok===true&&Number.isInteger(result.result?.message_id)){await save(env,record.id,{...event,status:'sent',messageId:result.result.message_id,sentAt:now.toISOString()});sent++;}
    else{await save(env,record.id,{...event,status:'failed',error:'TELEGRAM_REJECTED'});failed++;}
   }catch{await save(env,record.id,{...event,status:'uncertain',error:'TELEGRAM_DELIVERY_UNCONFIRMED'});uncertain++;}
  }
 }
 const status={checkedAt:now.toISOString(),status:configured?'monitoring':'configuration-required',baselines,queued,sent,failed,uncertain};
 await save(env,PREFIX+'status',status);return status;
}
