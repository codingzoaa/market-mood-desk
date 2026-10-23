import {eligibleStocks, rankSectors, type Stock, type Etf} from './market.ts';
import type {IndexDetail} from './market-details.ts';

// Group only identical observed constituents; never infer an industry or merge overlaps.
export function leadershipGroups(stocks:Stock[], etfs:Etf[]=[]){
 const groups=new Map<string,ReturnType<typeof rankSectors>[number]&{aliases:string[];dominance:number}>();
 for(const sector of rankSectors(stocks,etfs)){
  const key=(sector.name==='미분류'?'unclassified:':'classified:')+sector.leaders.map(s=>s.symbol).sort().join(',');
  const old=groups.get(key);
  if(old){old.aliases.push(sector.name);old.turnoverKRW+=sector.turnoverKRW;old.share+=sector.share;}
  else groups.set(key,{...sector,aliases:[sector.name],dominance:0});
 }
 return [...groups.values()].map(group=>{
  const total=group.leaders.reduce((sum,s)=>sum+s.turnoverKRW,0);
  return {...group,dominance:total?group.leaders[0].turnoverKRW/total*100:0};
 }).sort((a,b)=>b.turnoverKRW-a.turnoverKRW||a.name.localeCompare(b.name));
}
export function classificationCoverage(stocks:Stock[],etfs:Etf[]=[]){
 const pool=eligibleStocks(stocks,etfs);
 const classified=pool.filter(s=>s.themes.some(t=>t.trim()&&t!=='미분류')).length;
 return {total:pool.length,classified,pct:pool.length?classified/pool.length*100:null};
}
export function breadthSummary(index?:IndexDetail){
 if(!index)return '시장 폭 데이터 대기';
 const {changePct,advances,declines}=index;
 if(advances+declines===0)return '상승·하락 종목 집계 대기';
 if(advances===declines)return '상승·하락 종목 수 동일';
 if(changePct>0&&declines>advances)return '지수 상승에도 하락 종목 우세';
 if(changePct<0&&advances>declines)return '지수 하락에도 상승 종목 우세';
 return advances>declines?'상승 종목 우세':'하락 종목 우세';
}
