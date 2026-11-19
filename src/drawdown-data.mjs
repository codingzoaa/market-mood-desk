export function validatePrices(raw,expectedSymbol){
 if(expectedSymbol&&raw?.symbol!==expectedSymbol)throw Error('요청한 종목과 가격 이력의 종목이 다릅니다.');
 const index=raw?.kind==='INDEX'&&['KOSPI','KOSDAQ'].includes(raw.symbol)&&raw.unit==='P';
 if(!raw||(!index&&raw.adjusted!==true)||!Array.isArray(raw.points)||raw.points.length<2||raw.points.length>(index?20000:10000))throw Error('수정주가 이력을 확인할 수 없습니다.');
 const seen=new Set();return raw.points.map(p=>{if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date+'T00:00:00Z'))||new Date(p.date+'T00:00:00Z').toISOString().slice(0,10)!==p.date||seen.has(p.date)||typeof p.close!=='number'||!Number.isFinite(p.close)||p.close<=0)throw Error('가격 이력 형식 오류');seen.add(p.date);return {date:p.date,close:p.close};}).sort((a,b)=>a.date.localeCompare(b.date));
}
const days=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
export function drawdownAnalysis(history,years=20){
 if(!history.length)return null;
 const end=history.at(-1).date,cutoff=new Date(end+'T00:00:00Z');if(years!=='ALL')cutoff.setUTCFullYear(cutoff.getUTCFullYear()-Number(years));
 const rows=years==='ALL'?history:history.filter(p=>p.date>=cutoff.toISOString().slice(0,10));if(!rows.length)return null;
 let peak=rows[0],active=null,mdd=0,worst=null;const episodes=[],points=[];
 for(const r of rows){
  if(r.close>=peak.close){if(active){active.recoveryDate=r.date;active.days=days(active.peakDate,r.date);episodes.push(active);active=null;}peak=r;}
  const dd=Math.min(0,(r.close/peak.close-1)*100);points.push({...r,drawdown:dd,peak:peak.close,peakDate:peak.date});
  if(dd<0){if(!active)active={peakDate:peak.date,peakPrice:peak.close,troughDate:r.date,troughPrice:r.close,drawdown:dd,recoveryDate:null,days:0};
   if(dd<active.drawdown){active.troughDate=r.date;active.troughPrice=r.close;active.drawdown=dd;}
   if(dd<mdd){mdd=dd;worst=active;}
  }
 }
 if(active){active.days=days(active.peakDate,end);episodes.push(active);}
 return {points,mdd,current:points.at(-1).drawdown,last:rows.at(-1),first:rows[0],worst,episodes:[...episodes].sort((a,b)=>a.drawdown-b.drawdown).slice(0,5)};
}
