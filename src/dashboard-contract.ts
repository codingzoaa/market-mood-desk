import { dayKey,validateSnapshot,type Snapshot } from './market';
export type FeedSnapshot=Snapshot&{feed:{status:'live'|'final';coverage:'market-wide';components:Record<string,string>}};
export type DashboardEnvelope={schemaVersion:1;timezone:'Asia/Seoul';generatedAt:string;snapshots:FeedSnapshot[]};
const componentKeys=['indices','etfs','stocks','sox','rates','breadth','regime'];
function timestamp(v:unknown,now:number){if(typeof v!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)>now+60000)throw Error('Invalid timestamp');return v;}
export function validateDashboard(raw:any,from:string,to:string,now=Date.now()):DashboardEnvelope{
 if(raw?.schemaVersion!==1||raw.timezone!=='Asia/Seoul'||!Array.isArray(raw.snapshots)||raw.snapshots.length>28)throw Error('Invalid envelope');
 const generatedAt=timestamp(raw.generatedAt,now),ids=new Set();
 const snapshots=raw.snapshots.map((v:any)=>{
  const s=validateSnapshot(v,dayKey(new Date(now)));
  if(s.date<from||s.date>to||ids.has(s.date)||/시뮬레이션|demo|sample/i.test(s.source))throw Error('Invalid date or source');ids.add(s.date);
  timestamp(s.asOf,now);if(Date.parse(s.asOf)>Date.parse(generatedAt)+60000)throw Error('Inconsistent timestamps');
  if(!['live','final'].includes(v.status)||v.coverage!=='market-wide')throw Error('Full market coverage required');
  if(s.date<dayKey(new Date(now))&&v.status!=='final')throw Error('Historical data must be final');
  const kst=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s.asOf));
  if(v.status==='final'&&kst<'15:30')throw Error('Final snapshot precedes close');
  const components:Record<string,string>={};
  for(const key of componentKeys)if(v.components?.[key]!==undefined){components[key]=timestamp(v.components[key],now);if(Date.parse(components[key])>Date.parse(s.asOf)+60000)throw Error('Component ahead of snapshot');}
  if(s.stocks.length&&!components.stocks||s.etfs?.length&&!components.etfs||(s.metrics.kospi!==undefined||s.metrics.kosdaq!==undefined)&&!components.indices)throw Error('Missing component timestamp');
  if(s.metrics.sox!==undefined&&!components.sox||s.metrics.yield2y!==undefined&&!components.rates||s.metrics.yield10y!==undefined&&!components.rates||s.metrics.breadthAbove50!==undefined&&!components.breadth||s.metrics.riskFactors&&!components.regime)throw Error('Missing macro timestamp');
  return {...s,stockAsOf:components.stocks,feed:{status:v.status,coverage:v.coverage,components}} as FeedSnapshot;
 }).sort((a:FeedSnapshot,b:FeedSnapshot)=>a.date.localeCompare(b.date));
 return {schemaVersion:1,timezone:'Asia/Seoul',generatedAt,snapshots};
}
export function feedHealth(snapshot:FeedSnapshot|undefined,failed:boolean,now=Date.now()){
 if(!snapshot)return {state:failed?'error':'empty',label:failed?'연결 오류 · 정상 데이터 없음':'데이터 없음'};
 if(!snapshot.feed)return {state:'stale',label:'수집 출처 확인 필요'};
 if(failed)return {state:'stale',label:'연결 오류 · 마지막 정상 데이터'};
 if(snapshot.feed.status==='final')return {state:'final',label:'장 마감 확정 스냅샷'};
 const stamps=[snapshot.asOf,...['indices','etfs','stocks'].flatMap(k=>snapshot.feed.components[k]?[snapshot.feed.components[k]]:[])].map(Date.parse);
 return now-Math.min(...stamps)>180000?{state:'delayed',label:'데이터 지연 · 3분 초과'}:{state:'live',label:'수집 시점 데이터 · 60초 갱신'};
}
