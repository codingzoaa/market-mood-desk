import {METHODOLOGY_VERSION,clamp,currentValid,finite,historyAt,known,kstDate,members,ohlc,positive,previousDays,slot} from './common.ts';
import {relativeVolume} from './relative-volume.ts';
import type {AnalysisInput,ScoreMode} from './types.ts';
export function breadth(input:AnalysisInput){const quotes=members(input);if(!quotes?.length||quotes.some(q=>!currentValid(q,input)||!positive(q.price)||!positive(q.previousClose)))return null;return quotes.filter(q=>q.price!>q.previousClose!).length/quotes.length;}
export function leaderParticipation(input:AnalysisInput,mode:ScoreMode){
  const quotes=members(input);if(!quotes?.length)return null;let count=0;
  for(const q of quotes){const b=input.benchmarks[q.market],rvol=relativeVolume(input,mode,[q]);if(!b||!currentValid(q,input)||!currentValid(b,input)||!positive(q.price)||!positive(q.previousClose)||!positive(b.price)||!positive(b.previousClose)||rvol===null)return null;if(q.price/q.previousClose>b.price/b.previousClose&&rvol>=1.5)count++;}
  return count/quotes.length;
}
export function priceStructure(input:AnalysisInput,mode:ScoreMode){
  const quotes=members(input),days=previousDays(input,mode==='EOD'?60:20);if(quotes?.length!==1||!days)return null;const q=quotes[0];if(!currentValid(q,input)||!ohlc(q))return null;
  const bars=days.map(date=>historyAt(q,date,input));if(bars.some(b=>!b||!ohlc({open:b.open,high:b.high,low:b.low,price:b.close})))return null;
  const recent=bars.slice(-20),ceiling=Math.max(...recent.map(b=>b!.high!)),floor=Math.min(...recent.map(b=>b!.low!)),inBox=(ceiling-floor)/floor<=.2;
  const newHigh=q.price!>ceiling,box=inBox&&newHigh;
  if(mode==='EOD'){
    const sma20=recent.reduce((s,b)=>s+b!.close,0)/20,sma60=bars.reduce((s,b)=>s+b!.close,0)/60;
    const failed=q.high!>ceiling&&q.price!<ceiling;
    return (newHigh?.3:0)+(box?.3:0)+(q.price!>sma20&&sma20>sma60?.2:0)+(!failed?.2:0);
  }
  const intraday=q.bars?.filter(b=>known(b.asOf,q.asOf)&&known(b.availableAt,input.asOf)&&kstDate(b.asOf)===input.date&&Date.parse(b.availableAt)>=Date.parse(b.asOf));
  if(!intraday||intraday.length<2||new Set(intraday.map(b=>b.asOf)).size!==intraday.length||intraday.some(b=>!positive(b.high)||!positive(b.low)||!positive(b.close)||b.high<b.close||b.low>b.close||b.high<b.low))return null;
  const ordered=intraday.slice().sort((a,b)=>Date.parse(a.asOf)-Date.parse(b.asOf));
  if(slot(ordered.at(-1)!.asOf)!==slot(q.asOf)||ordered.at(-1)!.close!==q.price)return null;
  const priorHigh=Math.max(...ordered.slice(0,-1).map(b=>b.high)),last=ordered.at(-1)!;
  const rvol=relativeVolume(input,mode);if(rvol===null)return null;
  const hold=ordered.at(-2)!.close>=ceiling&&q.price!>=ceiling;
  return [q.price!>priorHigh&&last.close>priorHigh,newHigh,box,hold,rvol>=1.5].filter(Boolean).length/5;
}
export function sectorStrength(input:AnalysisInput,mode:ScoreMode){
 const score=input.sectorScore;
 return score&&score.entityType==='SECTOR'&&score.entityId===input.sectorId&&score.mode===mode&&score.date===input.date&&Date.parse(score.asOf)===Date.parse(input.asOf)&&score.universe===input.universe&&score.methodologyVersion===METHODOLOGY_VERSION&&score.status===(mode==='EOD'?'FINAL':'PROVISIONAL')&&finite(score.score)&&score.score>=0&&score.score<=100?clamp(score.score/100):null;
}
