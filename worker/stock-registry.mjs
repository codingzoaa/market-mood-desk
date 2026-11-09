import catalog from '../src/data/stock-map.json' with {type:'json'};
// Persist LS-discovered stock classifications in public market D1, not the browser.
// Curated registry is authoritative; LS labels never overwrite its classifications.
const CURATED=new Set(catalog.map(x=>x.symbol));
const CATALOG_BY_CODE=new Map(catalog.map(x=>[x.symbol,x]));
const RESERVED=/^(?:KODEX|TIGER|ACE|RISE|PLUS|SOL|HANARO|KOSEF|ARIRANG|KBSTAR|KINDEX|TIMEFOLIO|ETF|ETN)/i;
const valid=s=>s&&/^\d{6}$/.test(s.symbol)&&['KOSPI','KOSDAQ'].includes(s.market)&&typeof s.name==='string'&&s.name.length<=80;
const key='stock-map:registry';
// Restore missing quote classifications from the same registry used by the
// sector map. Never alter quotes or replace existing historical LS theme tags.
export function attachStockSectors(snapshot,registry={entries:[]}){
 if(!Array.isArray(snapshot?.stocks))return snapshot;
 const discovered=new Map((Array.isArray(registry?.entries)?registry.entries:[]).filter(valid).map(x=>[x.symbol,x]));
 return {...snapshot,stocks:snapshot.stocks.map(stock=>{
  if(Array.isArray(stock.themes)&&stock.themes.length||stock.instrumentType==='ETF'||stock.instrumentType==='ETN'||RESERVED.test(stock.name||''))return stock;
  const curated=CATALOG_BY_CODE.get(stock.symbol),entry=curated||discovered.get(stock.symbol);
  if(!entry||entry.market!==stock.market||!curated&&entry.reviewRequired===true||typeof entry.sector!=='string')return stock;
  const sector=entry.sector.trim();
  if(!sector||sector.length>40||/분류\s*대기|검토|미분류/.test(sector))return stock;
  return {...stock,themes:[sector]};
 })};
}
export function inferCuratedSector(tags){
 const clean=[...new Set(tags.filter(t=>typeof t==='string'&&t.trim()).map(t=>t.trim()))].slice(0,12);
 const matched=catalog.filter(x=>clean.some(t=>x.sector===t||x.subSector===t||x.themes.includes(t)));
 const sectors=[...new Set(matched.map(x=>x.sector))];
 if(sectors.length!==1)return {sector:'분류 대기',subSector:'분류 대기',themes:[]};
 const sector=sectors[0],subSectors=[...new Set(matched.map(x=>x.subSector))];
 const themes=clean.filter(t=>matched.some(x=>x.themes.includes(t)));
 return {sector,subSector:subSectors.length===1?subSectors[0]:'세부 분류 검토',themes:themes.length?themes:clean.includes(sector)?[sector]:[]};
}
export function top100Missing(stocks,etfs,entries){
 const denied=new Set(etfs.map(x=>x.symbol)),known=new Set([...CURATED,...entries.map(x=>x.symbol)]);
 const seen=new Set();
 return stocks.filter(x=>valid(x)&&!denied.has(x.symbol)&&!RESERVED.test(x.name)&&x.instrumentType!=='ETF'&&x.instrumentType!=='ETN')
  .sort((a,b)=>b.turnoverKRW-a.turnoverKRW||a.symbol.localeCompare(b.symbol)).slice(0,100)
  .filter(x=>{if(seen.has(x.symbol)){return false;}seen.add(x.symbol);return !known.has(x.symbol);});
}
export async function readStockRegistry(env){
 const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key).first();
 const stored=row?JSON.parse(row.payload):null;
 const entries=Array.isArray(stored?.entries)?stored.entries.filter(valid).slice(0,5000):[];
 return {version:1,entries,updatedAt:stored?.updatedAt||null};
}
export async function syncStockRegistry(env,snapshot,request,wait){
 const registry=await readStockRegistry(env);
 const missing=top100Missing(snapshot.stocks,snapshot.etfs||[],registry.entries).slice(0,10);
 if(!missing.length)return {added:0};
 let failures=0;
 for(const stock of missing){
  try{
   await wait(1100);
   const data=(await request('t1532',{shcode:stock.symbol})).data;
   if(!Array.isArray(data?.t1532OutBlock))throw Error('LS_THEME_RESPONSE_INVALID');
   const tags=data.t1532OutBlock.map(x=>x.tmname).filter(x=>typeof x==='string'&&x.trim()&&x.length<=60);
   registry.entries.push({symbol:stock.symbol,name:stock.name,market:stock.market,...inferCuratedSector(tags),breadth:false,updatedAt:snapshot.date,source:'LS t1532 · 섹터맵 규칙',reviewRequired:tags.length===0});
  }catch{if(++failures>=3)break;}
 }
 if(registry.entries.length>5000)registry.entries=registry.entries.slice(-5000);
 if(registry.entries.length){
  registry.updatedAt=new Date().toISOString();
  await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key,JSON.stringify(registry)).run();
 }
 return {added:registry.entries.length};
}
