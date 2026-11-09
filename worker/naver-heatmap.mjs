import bundled from '../src/data/naver-heatmap-baseline.json' with {type:'json'};
import {kst} from './ls.mjs';
export const NAVER_HEATMAP_REVISION='naver-industries-v2-krx-v1';
const ROOT='https://stock.naver.com';
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export function naverHeatmapWindow(now=new Date()){
 const local=kst(now),weekday=new Date(local.date+'T12:00:00Z').getUTCDay();
 return weekday>0&&weekday<6&&local.time>='0900'&&local.time<='2000';
}
export async function naverJson(path,fetcher=fetch){
 if(!/^\/api\/(?:stockSecurity\/rankings\/v2\/domestic\/industries\?|domestic\/market\/upjong\/\d{1,5}\/stocklist\?)/.test(path))throw Error('NAVER_PATH');
 const response=await fetcher(ROOT+path,{headers:{Accept:'application/json','User-Agent':'MarketNote/1.0'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('NAVER_HTTP_'+response.status);
 const text=await response.text();if(text.length>3000000)throw Error('NAVER_SIZE');return JSON.parse(text);
}
const value=x=>{if(typeof x!=='string'&&typeof x!=='number'||String(x).trim()==='')throw Error('NAVER_NUMBER');const n=Number(String(x).replaceAll(',',''));if(!Number.isFinite(n))throw Error('NAVER_NUMBER');return n;};
export function naverHeatStock(row,sector){
 if(!['KOSPI','KOSDAQ'].includes(row.marketType)||row.stockEndType!=='stock')return null;
 const symbol=row.itemCode?.replace(/^A(?=\d{6}$)/,''),name=row.itemName;
 if(!/^[0-9A-Z]{6}$/.test(symbol)||typeof name!=='string'||!name.trim()||name.length>80)throw Error('HEATMAP_ID');
 // The page serves KRX and NXT side by side. Never read NXT for this map.
 const quote=row.krx;if(!quote||quote.marketCap===null||quote.changeRate===null)return null;
 const marketCap=value(quote.marketCap),changePct=value(quote.changeRate);
 if(marketCap<=0)return null;
 if(marketCap>1e17||changePct< -100||changePct>10000)throw Error('HEATMAP_RANGE');
 return {symbol,name,market:row.marketType,sector,changePct,marketCap};
}
async function read(env,key){const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key).first();return row?JSON.parse(row.payload):null;}
async function write(env,key,data){await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key,JSON.stringify(data)).run();}
let decodedBaseline;
async function bundledHeatmap(date){
 if(bundled.date!==date||Date.parse(bundled.asOf)>Date.now()+60000)return null;
 decodedBaseline??=(async()=>{
  const bytes=Uint8Array.from(atob(bundled.gzipBase64),x=>x.charCodeAt(0));
  const text=await new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'))).text();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  if([...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')!==bundled.sha256)throw Error('NAVER_BASELINE_HASH');
  const data=JSON.parse(text);validateHeatmapCoverage(data.stocks,data.industryCount);
  if(data.date!==bundled.date||data.asOf!==bundled.asOf||data.revision!==NAVER_HEATMAP_REVISION)throw Error('NAVER_BASELINE_ID');
  return data;
 })().catch(()=>null);
 return decodedBaseline;
}
export async function readNaverHeatmap(env,date){
 const data=await read(env,'naver-heatmap:'+date),baseline=await bundledHeatmap(date);
 const saved=data?.date===date&&data.revision===NAVER_HEATMAP_REVISION&&Array.isArray(data.stocks)?data:null;
 return [saved,baseline].filter(Boolean).sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf))[0]||null;
}
export function validateHeatmapCoverage(stocks,categories,{minimumStocks=2000}={}){
 if(categories<50||categories>120||stocks.length<minimumStocks||stocks.length>6000)throw Error('NAVER_COVERAGE');
 if(minimumStocks>=2000&&(stocks.filter(x=>x.market==='KOSPI').length<500||stocks.filter(x=>x.market==='KOSDAQ').length<1000))throw Error('NAVER_MARKET_COVERAGE');
 if(new Set(stocks.map(x=>x.symbol)).size!==stocks.length)throw Error('NAVER_DUPLICATE');
}
// One invocation makes at most 20 upstream requests, safely below the Worker's
// subrequest limit. Progress is durable; only a complete, checked map publishes.
export async function collectNaverHeatmap(env,date,{fetcher=naverJson,now=new Date(),requestLimit=20,minimumStocks=2000}={}){
 if(!DAY.test(date)||date!==kst(now).date)throw Error('NAVER_CURRENT_DATE_ONLY');
 const session=await env.DB.prepare('SELECT date FROM snapshots WHERE date=?').bind(date).first();
 if(session?.date!==date)throw Error('NAVER_TRADING_DAY_UNVERIFIED');
 const bucket=Math.floor(now.getTime()/300000),key='naver-heatmap-progress-v2';
 const old=await readNaverHeatmap(env,date);
 if(old&&Math.floor(Date.parse(old.asOf)/300000)>=bucket)return {complete:true,heatmap:old,skipped:true};
 let progress=await read(env,key),requests=0;
 if(!progress||progress.date!==date||progress.revision!==NAVER_HEATMAP_REVISION||now-Date.parse(progress.startedAt)>900000){
  const data=await fetcher('/api/stockSecurity/rankings/v2/domestic/industries?sortType=changeRate&sortDirection=desc&size=100&period=daily');requests++;
  if(!Array.isArray(data.items)||data.hasNext!==false||data.items.length<50||data.items.length>120)throw Error('NAVER_INDUSTRIES');
  const seen=new Set(),categories=data.items.map(x=>{
   if(!/^\d{1,5}$/.test(x.code)||seen.has(x.code)||typeof x.name!=='string'||!x.name.trim()||x.name.length>60||typeof x.updatedAt!=='string'||!Number.isFinite(Date.parse(x.updatedAt))||kst(new Date(x.updatedAt)).date!==date||Date.parse(x.updatedAt)>now.getTime()+60000)throw Error('NAVER_INDUSTRY_ID_DATE');
   seen.add(x.code);return {id:x.code,name:x.name};
  });
  progress={revision:NAVER_HEATMAP_REVISION,date,startedAt:now.toISOString(),categories,category:0,cursor:'',stocks:[],skipped:0};
 }
 const seen=new Set(progress.stocks.map(x=>x.symbol));
 while(progress.category<progress.categories.length&&requests<requestLimit){
  const group=progress.categories[progress.category];
  const params=new URLSearchParams({sortType:'marketCap',sortDirection:'desc',size:'100',...(progress.cursor?{cursor:progress.cursor}:{})});
  const data=await fetcher('/api/domestic/market/upjong/'+group.id+'/stocklist?'+params);requests++;
  if(!Array.isArray(data.items)||data.items.length>100||typeof data.hasNext!=='boolean')throw Error('NAVER_MEMBERS');
  for(const row of data.items){const stock=naverHeatStock(row,group.name);if(!stock){progress.skipped++;continue;}if(seen.has(stock.symbol))throw Error('NAVER_DUPLICATE');seen.add(stock.symbol);progress.stocks.push(stock);}
  if(progress.stocks.length>6000)throw Error('NAVER_STOCK_LIMIT');
  if(data.hasNext){if(!data.items.length||typeof data.cursor!=='string'||!data.cursor||data.cursor===progress.cursor||data.cursor.length>1000)throw Error('NAVER_CURSOR');progress.cursor=data.cursor;}
  else{progress.category++;progress.cursor='';}
 }
 if(progress.category<progress.categories.length){await write(env,key,progress);return {complete:false,requests,loaded:progress.stocks.length};}
 validateHeatmapCoverage(progress.stocks,progress.categories.length,{minimumStocks});
 const heatmap={date,revision:NAVER_HEATMAP_REVISION,asOf:new Date().toISOString(),source:'네이버 증권 KRX · 네이버 업종 · 조회 시각 기준',sourceUrl:'https://stock.naver.com/market/stock/kr/industry',startedAt:progress.startedAt,industryCount:progress.categories.length,skipped:progress.skipped,stocks:progress.stocks};
 // Refuse to label a collection that crossed midnight as the previous day.
 if(kst().date!==date)throw Error('NAVER_DAY_CHANGED');
 await write(env,'naver-heatmap:'+date,heatmap);
 await env.DB.prepare('DELETE FROM state WHERE id=?').bind(key).run();
 return {complete:true,heatmap,requests};
}
// The scheduled GitHub collector validates the source and publishes the complete
// compressed snapshot through the existing Worker deploy permission. This
// coordinator persists it via its existing D1 binding; no broader token needed.
export async function safeCollectNaverHeatmap(env,now=new Date()){
 if(!naverHeatmapWindow(now))return false;
 const date=kst(now).date,baseline=await bundledHeatmap(date);if(!baseline)return false;
 const session=await env.DB.prepare('SELECT date FROM snapshots WHERE date=?').bind(date).first();if(session?.date!==date)return false;
 const saved=await read(env,'naver-heatmap:'+date);
 if(!saved?.asOf||Date.parse(saved.asOf)<Date.parse(baseline.asOf))await write(env,'naver-heatmap:'+date,baseline);
 const status=await read(env,'naver-heatmap-status');
 if(!status?.asOf||Date.parse(status.asOf)<=Date.parse(baseline.asOf)||status.error)await write(env,'naver-heatmap-status',{date,asOf:now.toISOString(),error:null});
 return false;
}
