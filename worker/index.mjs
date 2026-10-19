import {collectDetails} from './details.mjs';
import {createSession} from './tls.mjs';
import {accessToken,tr,normalizeStock,signed,number,kst,collectWindow,verifySession,LSFailure} from './ls.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const READY=env=>!!(env.LS_APP_KEY&&env.LS_APP_SECRET&&env.DASHBOARD_TOKEN&&env.DASHBOARD_TOKEN.length>=32);
async function state(env,id,value){await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();}
export async function collect(env){
 if(!READY(env)||!collectWindow())return;
 const now=Date.now();
 const lease=await env.DB.prepare("UPDATE state SET payload=? WHERE id='lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(String(now+300000),now).first();
 if(!lease)return;
 let session,stage='TLS_CONNECT';
 try{
  await state(env,'progress',{stage:'AUTH',startedAt:new Date(now).toISOString()});
  session=await createSession();
  stage='AUTH';
  const token=await accessToken(env,session.fetch,Date.now(),false);
  const requestTR=(code,body,continuation)=>tr(token,code,body,continuation,session.fetch);
  stage='CHART';
  const chart=(await requestTR('t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:'99999999',cts_date:'',comp_yn:'N',sujung:'N'})).data;
  stage='CHART_VALIDATE';
  if(!verifySession(chart)){await state(env,'sync',{checkedAt:new Date().toISOString(),error:null,message:'휴장·개장 전 · 기존 저장 기록 유지'});return;}
  const stored=await env.DB.prepare('SELECT symbol,payload FROM themes WHERE expires_at>?').bind(now).all();
  const themeMap=new Map(stored.results.map(x=>[x.symbol,JSON.parse(x.payload)]));
  await state(env,'progress',{stage:'RANKING',startedAt:new Date(now).toISOString()});
  const stocks=[],etfs=[],seen=new Set();
  for(const [gubun,market] of [['1','KOSPI'],['2','KOSDAQ']]){
   let idx=0,continuation={flag:'N',key:''},count=0;
   for(let page=0;page<5&&count<100;page++){
    await wait(1100);
    stage='RANK_'+market+'_PAGE_'+page;
    const response=await requestTR('t1463',{gubun,jnilgubun:'0',jc_num:0,sprice:0,eprice:0,volume:0,idx,jc_num2:0},continuation);
    const rows=response.data.t1463OutBlock1;if(!Array.isArray(rows))throw new LSFailure('LS_RESPONSE_INVALID');
    for(const row of rows){if(count>=100)break;if(seen.has(row.shcode))throw new LSFailure('LS_RESPONSE_INVALID');seen.add(row.shcode);count++;
     stage='RANK_NORMALIZE_'+market;
     if(/^[0-9A-Z]{6}$/.test(row.shcode)&&!/^\d{6}$/.test(row.shcode)){if(typeof row.hname==='string'&&/^KODEX/i.test(row.hname))etfs.push({symbol:row.shcode,name:row.hname,price:number(row.price,0,1e9),changePct:signed(row.diff,row.sign),turnoverKRW:number(row.value,0,1e9)*1000000});continue;}
     const item=normalizeStock(row,market,themeMap.get(row.shcode)||[]);stocks.push(item);if(/^KODEX/i.test(item.name))etfs.push({symbol:item.symbol,name:item.name,price:item.price,changePct:item.changePct,turnoverKRW:item.turnoverKRW});
    }
    stage='RANK_CURSOR_'+market;
    const next=response.data.t1463OutBlock?.idx;if(next===undefined)throw new LSFailure('LS_RESPONSE_INVALID');
    if(!rows.length||next===0||next==='0')break;
    if(next===idx)throw new LSFailure('LS_RESPONSE_INVALID');idx=next;continuation=response.continuation;
   }
  }
  if(!stocks.length)throw new LSFailure('LS_RESPONSE_INVALID');
  // Enrich at most 12 names per cycle; gradually fill the daily theme cache.
  stage='THEMES';
  await state(env,'progress',{stage,startedAt:new Date(now).toISOString()});
  const themesToWrite=[];
  for(const item of stocks.filter(s=>s.changePct>=4&&!themeMap.has(s.symbol)).sort((a,b)=>b.turnoverKRW-a.turnoverKRW).slice(0,12)){
   await wait(1100);
   try{const data=(await requestTR('t1532',{shcode:item.symbol})).data;if(!Array.isArray(data.t1532OutBlock))continue;
    const names=[...new Set(data.t1532OutBlock.map(x=>x.tmname).filter(x=>typeof x==='string'&&x.trim()&&x.length<=40))].slice(0,5);item.themes=names;
    themesToWrite.push(env.DB.prepare('INSERT INTO themes(symbol,payload,expires_at) VALUES(?,?,?) ON CONFLICT(symbol) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').bind(item.symbol,JSON.stringify(names),now+86400000));
   }catch{/* Keep missing themes unclassified; never invent a classification. */}
  }
  await state(env,'progress',{stage:'INDICES',startedAt:new Date(now).toISOString()});
  const metrics={};
  for(const [upcode,key] of [['001','kospi'],['301','kosdaq']]){stage='INDEX_'+key;const data=(await requestTR('t1511',{upcode})).data;const row=data.t1511OutBlock;if(!row)throw new LSFailure('LS_RESPONSE_INVALID');metrics[key]=number(row.pricejisu,0,1e7);metrics[key+'ChangePct']=signed(row.diffjisu,row.sign);}
  // Persist only if collection started and ended on the same verified trading day.
  const end=kst();if(end.date!==kst(new Date(now)).date)throw new LSFailure('COLLECTION_DAY_CHANGED');
  stage='STORE';
  const asOf=new Date(now).toISOString();
  const snapshot={date:end.date,asOf,source:'LS증권 KRX · 시장별 거래대금 최대100개 수집 · 테마 부분 보강',stocks,etfs,metrics,note:''};
  await env.DB.batch([...themesToWrite,env.DB.prepare('INSERT INTO snapshots(date,payload,updated_at) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(snapshot.date,JSON.stringify(snapshot),new Date().toISOString()),env.DB.prepare("DELETE FROM snapshots WHERE date < date('now','-365 day')")]);
  await state(env,'sync',{checkedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),error:null,message:'LS증권 KRX · 5분 수집 · 시장별 최대100개 · 관측 시각 확인'});
  await state(env,'progress',{stage:'DONE',completedAt:new Date().toISOString()});
 }catch(error){
  await state(env,'diagnostic',{code:error instanceof LSFailure?error.code:'COLLECTION_FAILED',stage,message:error instanceof LSFailure&&error.safeDetail?error.safeDetail:'Response shape validation failed',checkedAt:new Date().toISOString()});
  if(error instanceof LSFailure&&error.code==='LS_AUTH_FAILED')await env.DB.prepare("DELETE FROM state WHERE id='oauth'").run();
  const prev=await env.DB.prepare("SELECT payload FROM state WHERE id='sync'").first();const old=prev?JSON.parse(prev.payload):{};
  await state(env,'sync',{...old,checkedAt:new Date().toISOString(),error:error instanceof LSFailure?error.code:'COLLECTION_FAILED',stage,message:'LS 수집 실패 · 마지막 정상 기록 유지'});
 }finally{if(session)await session.close();}
}
async function authorized(request,env){
 if(!env.DASHBOARD_TOKEN||env.DASHBOARD_TOKEN.length<32)return false;
 const supplied=request.headers.get('authorization')||'';if(supplied.length>512)return false;
 const digest=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));
 const [a,b]=await Promise.all([digest(supplied),digest('Bearer '+env.DASHBOARD_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export default {
 async fetch(request,env,ctx){
  const origin=request.headers.get('origin');const allowed=env.ALLOWED_ORIGIN||'https://codingzoaa.github.io';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin===allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Authorization';headers['Access-Control-Allow-Methods']='GET, OPTIONS';}
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&origin!==allowed)return reply({error:'ORIGIN_NOT_ALLOWED'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return reply({error:'METHOD_NOT_ALLOWED'},405);
  const path=new URL(request.url).pathname;
  if(path==='/health')return reply({service:'market-note-ls',status:READY(env)?'configured':'setup_required'});
  if(!['/api/dashboard','/api/status','/api/market-details'].includes(path))return reply({error:'NOT_FOUND'},404);
  if(!await authorized(request,env))return reply({error:'ACCESS_CODE_REQUIRED'},401);
  if(!READY(env))return reply({error:'LS_KEYS_REQUIRED'},503);
  try{
   const row=await env.DB.prepare("SELECT payload FROM state WHERE id='sync'").first();const sync=row?JSON.parse(row.payload):{};
   if(path==='/api/status')return reply({configured:true,...sync});
   const to=new URL(request.url).searchParams.get('date')||kst().date;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(to+'T12:00:00Z'))||new Date(to+'T12:00:00Z').toISOString().slice(0,10)!==to||to>kst().date)return reply({error:'INVALID_DATE'},400);
   if(path==='/api/market-details'){const detail=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+to).first();return reply({details:detail?JSON.parse(detail.payload):null});}
   const from=new Date(Date.parse(to+'T12:00:00Z')-27*86400000).toISOString().slice(0,10);
   const rows=await env.DB.prepare('SELECT payload FROM snapshots WHERE date>=? AND date<=? ORDER BY date').bind(from,to).all();
   if(env.COLLECTOR){const id=env.COLLECTOR.idFromName('global');ctx.waitUntil(env.COLLECTOR.get(id).fetch('https://collector.internal/wake',{method:'POST'}));}
   const detailRows=await env.DB.prepare("SELECT payload FROM state WHERE id>=? AND id<=?").bind('details:'+from,'details:'+to).all();const details=new Map(detailRows.results.map(x=>{const d=JSON.parse(x.payload);delete d.heatmap;return [d.date,d];}));
   return reply({schemaVersion:2,snapshots:rows.results.map(x=>{const s=JSON.parse(x.payload);return {...s,...(details.has(s.date)?{details:details.get(s.date)}:{})};}),feed:{configured:true,failed:!!sync.error,lastSuccessAt:sync.lastSuccessAt||null,checkedAt:sync.checkedAt||null,error:sync.error||null,message:sync.message||'첫 시세 수집 대기 · 평일 장중 최대5분 간격'}});
  }catch{return reply({error:'STORAGE_UNAVAILABLE'},503);}
 },
 scheduled(event,env,ctx){ctx.waitUntil((async()=>{await collect(env);await collectDetails(env);})());}
};

// An alarm invocation outlives the HTTP request's 30-second waitUntil window.
// LS calls still pass through the same D1 five-minute lease as Cron Triggers.
export class CollectorAlarm {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){
  if(request.method!=='POST'||new URL(request.url).pathname!=='/wake')return new Response(null,{status:405});
  if(await this.state.storage.getAlarm()===null)await this.state.storage.setAlarm(Date.now()+100);
  return new Response(null,{status:202});
 }
 async alarm(){await collect(this.env);await collectDetails(this.env);}
}
