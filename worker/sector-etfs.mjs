import {SECTOR_ETFS,normalizeDaily,sectorRotation} from '../shared/sector-etfs.mjs';
import {createSession} from './tls.mjs';
import {accessToken,tr,kst,collectWindow,collectionFetch} from './ls.mjs';
const KEY='sector-etfs:v1';
const read=async env=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(KEY).first();return r?JSON.parse(r.payload):{quotes:{}};};
export async function safeCollectSectorEtfs(env){try{return await collectSectorEtfs(env);}catch{return false;}}
export async function sectorEtfPayload(env,date){return sectorRotation(await read(env),date);}
export async function collectSectorEtfs(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow())return;
 let session;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('sector-etf-lease','0')").run();
 const started=Date.now(),lock=await env.DB.prepare("UPDATE state SET payload=? WHERE id='sector-etf-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(String(started+240000),started).first();if(!lock)return;
 let saved;
 try{
  saved=await read(env);const {date,time}=kst(),closed=time>='1535',phase=date+(closed?':close':':history');
  const targets=SECTOR_ETFS.filter(e=>saved.quotes?.[e.symbol]?.phase!==phase);
  if(saved.phase===phase&&!targets.length)return;
  session=await createSession();const fetcher=collectionFetch(session.fetch),token=await accessToken(env,fetcher,Date.now(),false);
  const request=(code,body)=>tr(token,code,body,undefined,fetcher);
  const stamp=()=>new Date().toISOString();
  if(saved.phase!==phase){
   const r=await request('t8429',{shcode:'101',gubun:'2',qrycnt:80,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N'});
   const bars=normalizeDaily(r.data.t8429OutBlock1,{date,closed,turnoverScale:1e6});if(!bars.length)throw Error('BENCHMARK_EMPTY');
   saved.benchmark={bars,asOf:stamp(),source:'LS t8429 KOSPI200 101'};saved.phase=phase;
  }
  saved.quotes||={};
  // At most four ETFs and one benchmark per invocation; never repeat a completed daily phase.
  for(const etf of targets.slice(0,4)){
   if(!collectWindow())break;
   await new Promise(r=>setTimeout(r,1100));
   const r=await request('t8410',{shcode:etf.symbol,gubun:'2',qrycnt:80,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'Y'});
   const bars=normalizeDaily(r.data.t8410OutBlock1,{date,closed,turnoverScale:1e6});if(!bars.length)throw Error('ETF_DAILY_EMPTY');
   saved.quotes[etf.symbol]={bars,asOf:stamp(),phase,source:'LS t8410 · 수정주가'};
  }
  saved.lastAttemptAt=stamp();saved.error=null;
 }catch(e){if(saved){saved.lastAttemptAt=new Date().toISOString();saved.error=typeof e.code==='string'&&/^LS_[A-Z0-9_]+$/.test(e.code)?e.code:'SECTOR_ETF_COLLECTION_FAILED';}}
 finally{
  if(session)await session.close();
  if(saved)await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(KEY,JSON.stringify(saved)).run();
  await env.DB.prepare("UPDATE state SET payload='0' WHERE id='sector-etf-lease' AND payload=?").bind(String(started+240000)).run();
 }
 return !saved?.error&&SECTOR_ETFS.some(e=>saved?.quotes?.[e.symbol]?.phase!==saved?.phase);
}
