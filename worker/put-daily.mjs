import {validOHLC} from './index-ohlc.mjs';
import {kst} from './ls.mjs';
export function putDailyPoints(details,now=new Date()){
 const points=new Map(),today=kst(now).date;
 for(const d of details){
  if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date+'T00:00:00Z'))||new Date(d.date+'T00:00:00Z').toISOString().slice(0,10)!==d.date||d.date>today||d.errors?.ls||d.errors?.flows||d.errors?.KOSPI||d.flows?.unit!=='억원')continue;
  const q=d.indices?.KOSPI,f=d.flows?.segments?.PUT;
  // Both markets must have post-close observations; never substitute a midday snapshot.
  const closed=t=>{if(typeof t!=='string'||!Number.isFinite(Date.parse(t))||Date.parse(t)>now.getTime())return false;const k=kst(new Date(t));return k.date===d.date&&k.time>='1545'&&k.time<='1610'&&!['Sat','Sun'].includes(k.weekday);};
  if(!q||!f||!closed(q.asOf)||!closed(d.flows.asOf)||![q.value,q.changePct,f.individual,f.foreign].every(v=>typeof v==='number'&&Number.isFinite(v))||q.value<=0||q.value>1e7||Math.abs(q.changePct)>100||Math.max(Math.abs(f.individual),Math.abs(f.foreign))>1e10)continue;
  const ohlc=validOHLC(q.ohlc,q.value);points.set(d.date,{date:d.date,kospi:q.value,changePct:q.changePct,individual:f.individual,foreign:f.foreign,...(ohlc?{ohlc}:{}),indexAt:q.asOf,flowAt:d.flows.asOf});
 }return [...points.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-365);
}
export async function archivePutClose(env,details,now=new Date()){
 const point=putDailyPoints([details],now)[0];if(!point)return;
 await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind('put-close:'+point.date,JSON.stringify(point)).run();
}
export async function putDailyFeed(env){
 const rows=await env.DB.prepare("SELECT payload FROM state WHERE id LIKE 'details:%' ORDER BY id DESC LIMIT 365").all();
 const live=putDailyPoints(rows.results.flatMap(r=>{try{return [JSON.parse(r.payload)];}catch{return [];}}));
 const archives=await env.DB.prepare("SELECT payload FROM state WHERE id LIKE 'put-close:%' ORDER BY id DESC LIMIT 2000").all();
 const stored=await env.DB.prepare("SELECT payload FROM state WHERE id='put-history:v1'").first();let history;try{history=stored?JSON.parse(stored.payload):null;}catch{}
 const merged=new Map();if(history?.method==='LS_PUT_DAILY_V1'&&[1,.01,.0001].includes(history.calibration?.factor))for(const p of history.points||[]){if(p.date>=history.from&&p.date<=history.to&&p.date<kst().date&&[p.kospi,p.changePct,p.individual,p.foreign].every(Number.isFinite))merged.set(p.date,p);}
 for(const r of archives.results){try{const p=JSON.parse(r.payload);if(p.date<=kst().date&&[p.kospi,p.changePct,p.individual,p.foreign].every(Number.isFinite))merged.set(p.date,p);}catch{}}
 for(const p of live)merged.set(p.date,p);const points=[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date));
 return {points,unit:'억원',source:'LS증권 t1601·t1665 풋옵션 금액 순매수 / t1511·t8429 코스피 종가',closePolicy:'마감 관측 자료 및 검증된 과거 일별 조회',latestDate:points.at(-1)?.date||null,history:history?{status:history.status,from:history.from,to:history.to,count:history.points?.length||0,completed:history.completed?.length||0,stage:history.stage,probe:history.probe,code:history.code,evidence:history.evidence,calibration:history.calibration}:null};
}
