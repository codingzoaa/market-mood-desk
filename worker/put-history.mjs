import {createSession} from './tls.mjs';
import {accessToken,tr,number,kst,collectWindow} from './ls.mjs';
import {putDailyPoints} from './put-daily.mjs';
const put=(env,id,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
const read=async(env,id)=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();return r?JSON.parse(r.payload):null;};
const pause=()=>new Promise(r=>setTimeout(r,1150));
export function historyDate(v){if(typeof v!=='string'||!/^\d{8}$/.test(v))throw Error('PUT_HISTORY_DATE');const d=v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6);if(new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw Error('PUT_HISTORY_DATE');return d;}
export function calibratePutHistory(rows,details){
 const ref=new Map(details.map(d=>[d.date,d])),overlap=rows.filter(r=>ref.has(historyDate(r.date)));
 if(overlap.length<3)throw Error('PUT_HISTORY_OVERLAP_REQUIRED');
 const groups=[['08','individual'],['17','foreign']];
 const matching=scale=>overlap.filter(r=>groups.every(([code,key])=>Math.abs(number(r['sa_'+code])*scale-ref.get(historyDate(r.date))[key])<=Math.max(2,Math.abs(ref.get(historyDate(r.date))[key])*.005)));
 const scales=[1,.01,.0001].filter(scale=>matching(scale).length>=3&&matching(scale).some(r=>Math.max(Math.abs(number(r.sa_08)*scale),Math.abs(number(r.sa_17)*scale))>=50));
 if(scales.length!==1){const e=Error('PUT_HISTORY_UNIT_UNVERIFIED');e.evidence=overlap.slice(0,12).map(r=>({date:r.date,raw:[r.sa_08,r.sa_17],reference:[ref.get(historyDate(r.date)).individual,ref.get(historyDate(r.date)).foreign]}));throw e;}
 return {factor:scales[0],dates:matching(scales[0]).map(r=>historyDate(r.date)),compared:overlap.length,differentDates:overlap.filter(r=>!matching(scales[0]).includes(r)).map(r=>historyDate(r.date))};
}
export function normalizePutHistory(flowRows,priceRows,{from,to,factor}){
 if(!Array.isArray(flowRows)||!Array.isArray(priceRows)||!flowRows.length||!priceRows.length||flowRows.length>500||priceRows.length>500)throw Error('PUT_HISTORY_SHAPE');
 const prices=new Map();for(const r of priceRows){const date=historyDate(r.date),close=number(r.close,1,1e7);if(prices.has(date))throw Error('PUT_HISTORY_DUPLICATE');prices.set(date,close);}
 const seen=new Set(),points=[];for(const r of flowRows){const date=historyDate(r.date);if(date<from||date>to)throw Error('PUT_HISTORY_SCOPE');if(seen.has(date))throw Error('PUT_HISTORY_DUPLICATE');seen.add(date);if(!prices.has(date))throw Error('PUT_HISTORY_INDEX_MISSING');points.push({date,kospi:prices.get(date),changePct:0,individual:number(r.sa_08)*factor,foreign:number(r.sa_17)*factor,source:'LS_HISTORY'});}
 const expected=[...prices.keys()].filter(d=>d>=from&&d<=to);if(expected.some(d=>!seen.has(d)))throw Error('PUT_HISTORY_FLOW_MISSING');
 const dates=[...prices.keys()].sort();for(const p of points){const i=dates.indexOf(p.date);if(i>0)p.changePct=(p.kospi/prices.get(dates[i-1])-1)*100;else throw Error('PUT_HISTORY_PREVIOUS_CLOSE_MISSING');}
 return points.sort((a,b)=>a.date.localeCompare(b.date));
}
export function historyQuarters(from,to){const parts=[];let start=from;while(start<=to){const d=new Date(start+'T00:00:00Z'),end=new Date(Date.UTC(d.getUTCFullYear(),Math.floor(d.getUTCMonth()/3)*3+3,0)).toISOString().slice(0,10);parts.push({from:start,to:end<to?end:to});start=new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString().slice(0,10);}return parts;}
export async function loadPutDailyHistory(request,references,from,to,onProgress=async()=>{}){
 const data=new Map(),seen=new Set();let cts_date=' ',cts_time=' ',continuation;
 for(let page=0;page<120;page++){
  const r=await request('t1617',{gubun1:'5',gubun2:'2',gubun3:'2',cts_date,cts_time,exchgubun:'K'},continuation);
  const rows=r.data.t1617OutBlock1;if(!Array.isArray(rows))break;
  for(const raw of rows){const date=historyDate(raw.date);if(date>to||date<from)continue;const row={date:raw.date,sa_08:raw.sv_08,sa_17:raw.sv_17};if(data.has(date)&&JSON.stringify(data.get(date))!==JSON.stringify(row))throw Error('PUT_HISTORY_CONFLICT');data.set(date,row);}
  await onProgress({page:page+1,count:data.size,oldest:rows.at(-1)?.date});
  const header=r.data.t1617OutBlock,next=String(header?.cts_date||'').trim(),time=String(header?.cts_time||'').trim();
  if(!rows.length||rows.some(x=>historyDate(x.date)<=from)||!next)break;
  const key=next+':'+time;if(seen.has(key))throw Error('PUT_HISTORY_CURSOR');seen.add(key);cts_date=next;cts_time=time;continuation=r.continuation;
 }
 const rows=[...data.values()];const calibration=calibratePutHistory(rows,references);return {rows,calibration,earliest:[...data.keys()].sort()[0],count:rows.length};
}
export async function recoverPutHistory(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow())return;
 let saved=await read(env,'put-history:v1');if(saved?.status==='COMPLETE')return;
 if(saved?.revision===5&&saved?.status==='FAILED'&&Date.now()-Date.parse(saved.checkedAt)<600000)return;
 const lease=String(Date.now()+240000);await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('put-history-lease','0')").run();
 const locked=await env.DB.prepare("UPDATE state SET payload=? WHERE id='put-history-lease' AND CAST(payload AS INTEGER)<? RETURNING id").bind(lease,Date.now()).first();if(!locked)return;
 let session,stage='REFERENCE';
 try{
  const stored=await env.DB.prepare("SELECT payload FROM state WHERE id LIKE 'details:%' ORDER BY id DESC LIMIT 365").all(),references=putDailyPoints(stored.results.flatMap(r=>{try{return [JSON.parse(r.payload)];}catch{return [];}}));
  if(references.length<3)throw Error('PUT_HISTORY_REFERENCE_REQUIRED');const to=saved?.to||references.at(-1).date,from=saved?.from||String(Number(to.slice(0,4))-5)+to.slice(4),parts=historyQuarters(from,to);
  saved={...saved,revision:5,from,to,status:'RUNNING',checkedAt:new Date().toISOString(),points:saved?.points||[],completed:saved?.completed||[],source:'LS증권 t1665 풋옵션 금액 + t8429 코스피 종가',method:'LS_PUT_DAILY_V1'};await put(env,'put-history:v1',saved);
  session=await createSession();const token=await accessToken(env,session.fetch,Date.now(),false),request=async(code,input,continuation)=>{await pause();return tr(token,code,input,continuation,session.fetch);};
  if(!saved.calibration){stage='UNIT';const input={market:'5',upcode:'800',gubun2:'1',gubun3:'1',from_date:references.at(-Math.min(10,references.length)).date.replaceAll('-',''),to_date:to.replaceAll('-',''),exchgubun:'K'};
   const result=await request('t1665',input);const rows=result.data.t1665OutBlock1;if(!Array.isArray(rows))throw Error('PUT_HISTORY_SHAPE');saved.calibration={...calibratePutHistory(rows,references),header:result.data.t1665OutBlock};await put(env,'put-history:v1',saved);
  }
  for(const part of parts){if(saved.completed.includes(part.from))continue;stage=part.from;await put(env,'put-history:v1',{...saved,stage});
   let flow=saved.fallback?{data:{t1665OutBlock1:saved.fallback.rows.filter(r=>{const d=historyDate(r.date);return d>=part.from&&d<=part.to;}),t1665OutBlock:{source:'t1617'}}}:await request('t1665',{market:'5',upcode:'800',gubun2:'1',gubun3:'1',from_date:part.from.replaceAll('-',''),to_date:part.to.replaceAll('-',''),exchgubun:'K'});
   let factor=saved.fallback?saved.fallback.calibration.factor:saved.calibration.factor;
   if(!Array.isArray(flow.data.t1665OutBlock1)||!flow.data.t1665OutBlock1.length){
    if(!saved.fallback){saved.fallback=await loadPutDailyHistory(request,references,from,to,async progress=>{saved.fallbackProgress=progress;await put(env,'put-history:v1',saved);});await put(env,'put-history:v1',saved);}
    flow={data:{t1665OutBlock1:saved.fallback.rows.filter(r=>{const d=historyDate(r.date);return d>=part.from&&d<=part.to;}),t1665OutBlock:{source:'t1617'}}};factor=saved.fallback.calibration.factor;
   }
   const sdate=new Date(Date.parse(part.from+'T00:00:00Z')-14*86400000).toISOString().slice(0,10).replaceAll('-','');
   const price=await request('t8429',{shcode:'001',gubun:'2',qrycnt:500,sdate,edate:part.to.replaceAll('-',''),cts_date:'',comp_yn:'N'});
   saved.probe={flowCount:flow.data.t1665OutBlock1?.length,priceCount:price.data.t8429OutBlock1?.length,flowFirst:flow.data.t1665OutBlock1?.[0]?.date,flowLast:flow.data.t1665OutBlock1?.at(-1)?.date,priceFirst:price.data.t8429OutBlock1?.[0]?.date,priceLast:price.data.t8429OutBlock1?.at(-1)?.date,header:flow.data.t1665OutBlock};
   const rows=normalizePutHistory(flow.data.t1665OutBlock1,price.data.t8429OutBlock1,{...part,factor});
   const data=new Map(saved.points.map(p=>[p.date,p]));for(const p of rows)data.set(p.date,p);saved.points=[...data.values()].sort((a,b)=>a.date.localeCompare(b.date));saved.completed.push(part.from);saved.stage=stage;await put(env,'put-history:v1',saved);
  }
  delete saved.code;delete saved.evidence;saved.status='COMPLETE';saved.completedAt=new Date().toISOString();await put(env,'put-history:v1',saved);
 }catch(e){saved={...saved,status:'FAILED',stage,checkedAt:new Date().toISOString(),code:String(e.code||e.message).replace(/[^A-Z0-9_]/g,'').slice(0,80),...(e.evidence?{evidence:e.evidence}:{})};await put(env,'put-history:v1',saved);}
 finally{if(session)await session.close();await env.DB.prepare("UPDATE state SET payload='0' WHERE id='put-history-lease' AND payload=?").bind(lease).run();}
}
