import {rankSectors, type Stock, type Etf} from './market';

/** Collapse only themes with the same observed stock set; preserve allocated turnover. */
export function leadershipGroups(stocks:Stock[], etfs:Etf[]=[]){
 const groups=new Map<string,ReturnType<typeof rankSectors>[number]&{aliases:string[];dominance:number}>();
 for(const sector of rankSectors(stocks,etfs)){
  const key=(sector.name==='미분류'?'unclassified:':'classified:')+sector.leaders.map(s=>s.symbol).sort().join(',');
  const existing=groups.get(key);
  if(existing){existing.aliases.push(sector.name);existing.turnoverKRW+=sector.turnoverKRW;existing.share+=sector.share;}
  else groups.set(key,{...sector,aliases:[sector.name],dominance:0});
 }
 return [...groups.values()].map(group=>{
  const total=group.leaders.reduce((sum,s)=>sum+s.turnoverKRW,0);
  return {...group,dominance:total?group.leaders[0].turnoverKRW/total*100:0};
 }).sort((a,b)=>b.turnoverKRW-a.turnoverKRW||a.name.localeCompare(b.name));
}
