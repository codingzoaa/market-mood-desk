export const SECTOR_ETFS=[
 ['반도체','TIGER 반도체TOP10','396500'],['2차전지','KODEX 2차전지산업','305720'],['조선','SOL 조선TOP3플러스','466920'],['방산','PLUS 방산','449450'],['전력기기','KODEX AI전력핵심설비','487240'],['원자력','HANARO 원자력iSelect','434730'],['로봇','KODEX 로봇액티브','445290'],['바이오','TIGER 바이오TOP10','364970'],['자동차','KODEX 자동차','091180'],['은행','KODEX 은행','091170'],['증권','KODEX 증권','102970'],['보험','KODEX 보험','140700'],['화장품','TIGER 화장품','228790'],['건설','KODEX 건설','117700'],['철강','KODEX 철강','117680'],['기계·장비','KODEX 기계장비','102960'],['화학·에너지','KODEX 에너지화학','117460'],['운송','KODEX 운송','140710'],['소프트웨어','TIGER 소프트웨어','157490'],['미디어·콘텐츠','TIGER 미디어컨텐츠','228810']
].map(([sector,name,symbol])=>({sector,name,symbol}));
export const BENCHMARK={symbol:'101',name:'KOSPI200 지수',tr:'t8429'};
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function normalizeDaily(rows,{date,closed,turnoverScale=1e6}={}){
 if(!Array.isArray(rows)||rows.length>500)throw Error('DAILY_ROWS_INVALID');
 const seen=new Set();return rows.map(r=>{const d=String(r.date),day=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6);const close=Number(r.close),value=r.value==null?null:Number(r.value);
 if(!/^\d{8}$/.test(d)||!validDate(day)||seen.has(day)||!Number.isFinite(close)||close<=0||r.close===null||r.close===''||value!==null&&(!Number.isFinite(value)||value<0))throw Error('DAILY_VALUES_INVALID');seen.add(day);
 return {date:day,close,turnoverKRW:value===null?null:value*turnoverScale};
 }).filter(r=>r.date<date||r.date===date&&closed).sort((a,b)=>a.date.localeCompare(b.date)).slice(-80);
}
export function sectorRotation(saved,requestedDate){
 if(!validDate(requestedDate))throw Error('INVALID_DATE');
 const benchmark=(saved?.benchmark?.bars||[]).filter(b=>b.date<=requestedDate),anchor=benchmark.at(-1)?.date||null;
 const windows=[5,20,60];
 const rows=SECTOR_ETFS.map(etf=>{
  const quote=saved?.quotes?.[etf.symbol],map=new Map((quote?.bars||[]).map(b=>[b.date,b]));
  const current=map.get(anchor),missing=[];const result={...etf,asOf:quote?.asOf||null,date:anchor,return5:null,return20:null,return60:null,rs5:null,rs20:null,rs60:null,rsComposite:null,avgTurnover20:null,status:'INSUFFICIENT_DATA',missing};
  if(!anchor||!current){missing.push('ALIGNED_DAILY_CLOSE');return result;}
  for(const n of windows){const days=benchmark.slice(-(n+1));if(days.length<n+1||days.some(d=>!map.has(d.date))){missing.push(n+'D_ALIGNED_HISTORY');continue;}
   const prev=map.get(days[0].date);const ret=(current.close/prev.close-1)*100,bret=(days.at(-1).close/days[0].close-1)*100;
   result['return'+n]=ret;result['rs'+n]=ret-bret;
  }
  const last20=benchmark.slice(-20).map(b=>map.get(b.date));if(last20.length===20&&last20.every(b=>b&&typeof b.turnoverKRW==='number'&&Number.isFinite(b.turnoverKRW)))result.avgTurnover20=last20.reduce((s,b)=>s+b.turnoverKRW,0)/20;else missing.push('20D_TURNOVER');
  if(result.rs5!==null&&result.rs20!==null)result.status='READY';
  if(windows.every(n=>result['rs'+n]!==null))result.rsComposite=result.rs5*.2+result.rs20*.5+result.rs60*.3;
  return result;
 });
 const ranked=rows.filter(r=>r.status==='READY').sort((a,b)=>b.rs20-a.rs20||b.rs5-a.rs5||a.symbol.localeCompare(b.symbol));
 return {methodology:'sector-etf-rs-v1',requestedDate,date:anchor,source:'LS증권 일봉 · KRX',benchmark:BENCHMARK,benchmarkAsOf:saved?.benchmark?.asOf||null,ready:ranked.length,total:20,top5:ranked.slice(0,5),rows,lastAttemptAt:saved?.lastAttemptAt||null,error:saved?.error||null};
}
