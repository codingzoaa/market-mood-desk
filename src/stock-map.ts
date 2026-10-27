import raw from './data/stock-map.json';
import type {MarketDetails} from './market-details';

export type StockMapEntry={
 symbol:string;
 name:string;
 market:'KOSPI'|'KOSDAQ';
 sector:string;
 subSector:string;
 themes:string[];
 breadth:boolean;
 updatedAt?:string;
};

const GROUPS:Record<string,string[]>={
 '메모리 반도체':['메모리 반도체'],
 'PCB·반도체 기판':['PCB·반도체 기판'],
 '반도체 장비·테스트':['반도체 장비','후공정·테스트'],
 '반도체 소재·부품':['반도체 소재·부품'],
 '2차전지 셀':['2차전지 셀'],
 '2차전지 셀·소재':['2차전지 셀','양극재','2차전지 소재','동박·부품','전해질·분리막'],
 '로봇·자동화':['로봇·자동화'],
 '전력기기·전력망':['전력기기·전력망']
};

function validateMap(input:unknown):StockMapEntry[]{
 if(!Array.isArray(input))throw Error('STOCK_MAP 배열 오류');
 const seen=new Set<string>();
 return input.map((v:any)=>{
  if(!v||typeof v!=='object'||!/^\d{6}$/.test(v.symbol)||seen.has(v.symbol))throw Error('STOCK_MAP 종목코드 오류');
  seen.add(v.symbol);
  if(!['KOSPI','KOSDAQ'].includes(v.market)||typeof v.name!=='string'||!v.name.trim()||typeof v.sector!=='string'||!v.sector.trim()||typeof v.subSector!=='string'||!v.subSector.trim()||!Array.isArray(v.themes)||typeof v.breadth!=='boolean')throw Error('STOCK_MAP 항목 오류');
  return {symbol:v.symbol,name:v.name.trim(),market:v.market,sector:v.sector.trim(),subSector:v.subSector.trim(),themes:[...new Set(v.themes.filter((x:any)=>typeof x==='string'&&x.trim()).map((x:string)=>x.trim()))],breadth:v.breadth,...(typeof v.updatedAt==='string'?{updatedAt:v.updatedAt}:{})};
 });
}

export const STOCK_MAP=validateMap(raw);
export const STOCK_MAP_BY_SYMBOL=new Map(STOCK_MAP.map(x=>[x.symbol,x]));

export type SectorBreadth={
 group:string;
 members:number;
 up:number;
 strongUp:number;
 upRatio:number;
 strongUpRatio:number;
 complete:boolean;
 missingSymbols:string[];
 symbols:string[];
};

export function getSectorBreadth(details:MarketDetails|undefined|null,group:string):SectorBreadth|null{
 const subSectors=GROUPS[group];
 if(!details?.heatmap||!subSectors)return null;
 const members=STOCK_MAP.filter(x=>x.breadth&&subSectors.includes(x.subSector));
 if(members.length<2)return null;
 const bySymbol=new Map(details.heatmap.stocks.map(x=>[x.symbol,x]));
 const missing=members.filter(x=>!bySymbol.has(x.symbol)).map(x=>x.symbol);
 const observed=members.flatMap(x=>{const q=bySymbol.get(x.symbol);return q?[q]:[];});
 const up=observed.filter(x=>x.changePct>0).length;
 const strongUp=observed.filter(x=>x.changePct>=3).length;
 return {
  group,
  members:members.length,
  up,
  strongUp,
  upRatio:observed.length?up/observed.length*100:0,
  strongUpRatio:observed.length?strongUp/observed.length*100:0,
  complete:missing.length===0,
  missingSymbols:missing,
  symbols:members.map(x=>x.symbol)
 };
}

export function seedStockMapFromHeatmap(details:MarketDetails|undefined|null):StockMapEntry[]{
 if(!details?.heatmap)return [];
 const known=new Set(STOCK_MAP.map(x=>x.symbol));
 return details.heatmap.stocks.filter(x=>!known.has(x.symbol)).map(x=>({
  symbol:x.symbol,
  name:x.name,
  market:x.market,
  sector:x.sector,
  subSector:x.sector,
  themes:[],
  breadth:false,
  updatedAt:details.date
 }));
}

export const BREADTH_GROUPS=Object.freeze({...GROUPS});
