import {accessToken,tr,kst,number} from './ls.mjs';
import {createSession} from './tls.mjs';
const pause=()=>new Promise(r=>setTimeout(r,1100));
const get=async(env,key)=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key).first();return r?JSON.parse(r.payload):null;};
const put=(env,key,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key,JSON.stringify(value)).run();
export const validSymbol=s=>typeof s==='string'&&/^[0-9A-Z]{6}$/.test(s);
export function priceRows(rows){
 if(!Array.isArray(rows))throw Error('PRICE_SHAPE');
 return rows.map(r=>{const date=String(r.date);if(!/^\d{8}$/.test(date))throw Error('PRICE_DATE');const iso=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6);if(new Date(iso+'T00:00:00Z').toISOString().slice(0,10)!==iso)throw Error('PRICE_DATE');return {date:iso,close:number(r.close,0,1e9)};}).filter(r=>r.close>0);
}
export function drawdownScope(now=new Date()){
 const d=kst(now),from=new Date(d.date+'T00:00:00Z');from.setUTCFullYear(from.getUTCFullYear()-20);from.setUTCDate(from.getUTCDate()-14);
 return {...d,from:from.toISOString().slice(0,10),cacheDay:d.date+(d.time>='1540'?':closed':':previous')};
}
export async function stockSearch(env,query){
 if(!query||query.length>40)return [];
 let master=await get(env,'drawdown:master');
 if(master?.date!==kst().date){let session;try{
  session=await createSession();const token=await accessToken(env,session.fetch,Date.now(),false);
  const raw=(await tr(token,'t8436',{gubun:'0'},undefined,session.fetch)).data.t8436OutBlock;
  if(!Array.isArray(raw)||raw.length<1000)throw Error('MASTER_SHAPE');
  const entries=raw.filter(r=>validSymbol(r.shcode)&&['1','2'].includes(String(r.gubun))&&String(r.etfgubun)==='0').map(r=>({symbol:r.shcode,name:String(r.hname).trim(),market:String(r.gubun)==='1'?'KOSPI':'KOSDAQ'}));
  master={date:kst().date,entries};await put(env,'drawdown:master',master);
 }finally{if(session)await session.close();}}
 const q=query.replaceAll(' ','').toLowerCase();return master.entries.filter(r=>(r.name.replaceAll(' ','').toLowerCase().includes(q)||r.symbol.toLowerCase().includes(q))).sort((a,b)=>(a.name===query?-1:0)-(b.name===query?-1:0)||a.name.localeCompare(b.name,'ko')).slice(0,15);
}
export async function drawdownFeed(env,symbol){
 if(!validSymbol(symbol))return {http:400,error:'INVALID_SYMBOL'};
 const scope=drawdownScope(),saved=await get(env,'drawdown:prices:'+symbol),progress=await get(env,'drawdown:progress:'+symbol);
 if(saved?.cacheDay===scope.cacheDay)return {http:200,...saved};
 if(progress?.status==='FAILED'&&Date.now()-Date.parse(progress.checkedAt)<60000)return {http:503,error:progress.error||'PRICE_FETCH_FAILED',message:'일봉 수집을 완료하지 못했습니다. 잠시 후 다시 시도하세요.'};
 if(env.COLLECTOR){const id=env.COLLECTOR.idFromName('drawdown-'+symbol);await env.COLLECTOR.get(id).fetch('https://collector.internal/drawdown?symbol='+symbol,{method:'POST'});}
 return {http:202,status:'FETCHING',symbol,progress:progress?.status==='RUNNING'?{pages:progress.pages,rows:progress.rows}:null};
}
export async function collectDrawdown(env,symbol){
 if(!validSymbol(symbol))return;
 const scope=drawdownScope(),id='drawdown:prices:'+symbol,existing=await get(env,id);if(existing?.cacheDay===scope.cacheDay)return;
 const now=Date.now(),leaseId='drawdown:lease:'+symbol,lease=String(now+240000);
 await env.DB.prepare('INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)').bind(leaseId,'0').run();
 if(!await env.DB.prepare('UPDATE state SET payload=? WHERE id=? AND CAST(payload AS INTEGER) < ? RETURNING id').bind(lease,leaseId,now).first())return;
 let session;const statusId='drawdown:progress:'+symbol;
 try{
  session=await createSession();const token=await accessToken(env,session.fetch,Date.now(),false);
  const prices=new Map(),seen=new Set();let cursor='',continuation,complete=false;
  for(let page=0;page<18;page++){
   const result=await tr(token,'t8410',{shcode:symbol,gubun:'2',qrycnt:500,sdate:scope.from.replaceAll('-',''),edate:scope.date.replaceAll('-',''),cts_date:cursor,comp_yn:'N',sujung:'Y'},continuation,session.fetch);
   const rows=priceRows(result.data.t8410OutBlock1);
   for(const r of rows)if(r.date>=scope.from&&r.date<=scope.date&&(r.date<scope.date||scope.time>='1540')){if(prices.has(r.date)&&prices.get(r.date)!==r.close)throw Error('PRICE_CONFLICT');prices.set(r.date,r.close);}
   const next=String(result.data.t8410OutBlock?.cts_date||'').trim();
   await put(env,statusId,{status:'RUNNING',pages:page+1,rows:prices.size,checkedAt:new Date().toISOString()});
   if(!next||!rows.length||rows.some(r=>r.date<=scope.from)){complete=true;break;}
   if(seen.has(next))throw Error('PRICE_CURSOR_REPEAT');seen.add(next);cursor=next;continuation=result.continuation;await pause();
  }
  if(!complete)throw Error('PRICE_HISTORY_INCOMPLETE');if(prices.size<2)throw Error('PRICE_HISTORY_EMPTY');
  const points=[...prices].map(([date,close])=>({date,close})).sort((a,b)=>a.date.localeCompare(b.date));
  const value={symbol,cacheDay:scope.cacheDay,requestedFrom:scope.from,firstDate:points[0].date,lastDate:points.at(-1).date,asOf:new Date().toISOString(),adjusted:true,source:'LS증권 t8410 · 수정주가(Y) · 일별 종가 · 배당 재투자 제외',points};
  await put(env,id,value);await put(env,statusId,{status:'COMPLETE',rows:points.length,checkedAt:new Date().toISOString()});
 }catch(e){await put(env,statusId,{status:'FAILED',error:e.code||(/^[A-Z_]+$/.test(e.message)?e.message:'PRICE_FETCH_FAILED'),checkedAt:new Date().toISOString()});}
 finally{if(session)await session.close();await env.DB.prepare("UPDATE state SET payload='0' WHERE id=? AND payload=?").bind(leaseId,lease).run();}
}
