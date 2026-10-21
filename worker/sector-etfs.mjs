import {fetchHoldings} from './etf-holdings.mjs';
import {SECTOR_ETFS,normalizeDaily,sectorRotation} from '../shared/sector-etfs.mjs';
import {createSession} from './tls.mjs';
import {accessToken,tr,kst,collectWindow,collectionFetch} from './ls.mjs';
const KEY='sector-etfs:v1';
export function refreshPhase(date,time){return date+':'+time.slice(0,2)+String(Math.floor(Number(time.slice(2))/5)*5).padStart(2,'0');}
export function mergeDailyHistory(oldBars,newBars){return [...new Map([...(oldBars||[]),...newBars].map(b=>[b.date,b])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-80);}
const read=async env=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(KEY).first();return r?JSON.parse(r.payload):{quotes:{}};};
export async function safeCollectSectorEtfs(env){try{return await collectSectorEtfs(env);}catch{return false;}}
export async function etfHoldingsPayload(env,symbol){if(!SECTOR_ETFS.some(e=>e.symbol===symbol))return null;const saved=await read(env);return {symbol,...(saved.holdings?.[symbol]||{holdings:[],date:null,asOf:null}),status:saved.holdings?.[symbol]?'READY':'PENDING',error:saved.holdingErrors?.[symbol]||null};}
export async function sectorEtfPayload(env,date){return sectorRotation(await read(env),date);}
export async function collectSectorEtfs(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow())return;
 let session;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('sector-etf-lease','0')").run();
 const started=Date.now(),lock=await env.DB.prepare("UPDATE state SET payload=? WHERE id='sector-etf-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(String(started+240000),started).first();if(!lock)return;
 let saved;
 try{
  saved=await read(env);const {date,time}=kst(),phase=refreshPhase(date,time);saved.mode=time<'1530'?'INTRADAY':'CLOSE';
  const targets=SECTOR_ETFS.filter(e=>saved.quotes?.[e.symbol]?.phase!==phase);
  if(saved.phase===phase&&!targets.length)return;
  session=await createSession();const fetcher=collectionFetch(session.fetch),token=await accessToken(env,fetcher,Date.now(),false);
  const request=(code,body,continuation)=>tr(token,code,body,continuation,fetcher);
  const stamp=()=>new Date().toISOString();
  if(saved.phase!==phase){
   const r=await request('t8429',{shcode:'101',gubun:'2',qrycnt:saved.benchmark?.historyDate===date?3:80,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N'});
   const bars=mergeDailyHistory(saved.benchmark?.bars,normalizeDaily(r.data.t8429OutBlock1,{date,closed:true,turnoverScale:1e6}));if(!bars.length)throw Error('BENCHMARK_EMPTY');
   saved.benchmark={bars,historyDate:date,asOf:stamp(),source:'LS t8429 KOSPI200 101'};saved.phase=phase;
  }
  saved.quotes||={};
  // At most four ETFs and one benchmark per invocation; never repeat a completed five-minute phase.
  for(const etf of targets.slice(0,4)){
   if(!collectWindow())break;
   await new Promise(r=>setTimeout(r,1100));
   const r=await request('t8410',{shcode:etf.symbol,gubun:'2',qrycnt:saved.quotes[etf.symbol]?.historyDate===date?3:80,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'Y'});
   const bars=mergeDailyHistory(saved.quotes[etf.symbol]?.bars,normalizeDaily(r.data.t8410OutBlock1,{date,closed:true,turnoverScale:1e6}));if(!bars.length)throw Error('ETF_DAILY_EMPTY');
   saved.quotes[etf.symbol]={bars,historyDate:date,asOf:stamp(),phase,source:'LS t8410 · 수정주가'};
   saved.holdings||={};saved.holdingErrors||={};
   if(!saved.holdings[etf.symbol]||kst(new Date(saved.holdings[etf.symbol].asOf)).date!==date){
    try{saved.holdings[etf.symbol]=await fetchHoldings(request,etf.symbol,date);delete saved.holdingErrors[etf.symbol];}
    catch(error){if(error.diagnostic){saved.holdingDiagnostics||={};saved.holdingDiagnostics[etf.symbol]=error.diagnostic;}saved.holdingErrors[etf.symbol]=typeof error.code==='string'&&/^LS_[A-Z0-9_]+$/.test(error.code)?error.code:typeof error.message==='string'&&/^HOLDINGS_[A-Z_]+$/.test(error.message)?error.message:'HOLDINGS_COLLECTION_FAILED';}
   }
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
