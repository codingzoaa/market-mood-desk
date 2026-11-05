// Keep real observations only; never reconstruct intraday flows from a closing value.
export function appendFlowHistory(previous, details) {
 const history=Array.isArray(previous)?previous.slice():[];
 if(details.errors?.ls||details.errors?.flows||!details.flows||details.flows.asOf!==details.asOf)return history;
 const instant=new Date(details.asOf);
 if(!Number.isFinite(instant.getTime()))return history;
 const kst=new Date(instant.getTime()+9*3600000),date=kst.toISOString().slice(0,10),minutes=kst.getUTCHours()*60+kst.getUTCMinutes();
 if(date!==details.date||minutes<540||minutes>970)return history;
 const bucket=Math.floor(minutes/5)*5,time=String(Math.floor(bucket/60)).padStart(2,'0')+String(bucket%60).padStart(2,'0'),markets={};
 for(const board of ['KOSPI','KOSDAQ']){
  const q=details.indices?.[board],f=details.flows.segments?.[board];
  if(details.errors?.[board]||q?.asOf!==details.asOf||![q?.changePct,f?.individual,f?.foreign].every(Number.isFinite))return history;
  markets[board]={individual:f.individual,foreign:f.foreign,changePct:q.changePct};
 }
 const point={time,asOf:details.asOf,markets};
 return [...history.filter(p=>p.time!==time),point].sort((a,b)=>a.time.localeCompare(b.time)).slice(-100);
}
