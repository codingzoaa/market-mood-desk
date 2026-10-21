const methods=new Set(['NAVER_KOSPI_DAILY_V1','LS_KOSPI_DAILY_V1']);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const sourceURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['finance.naver.com','m.stock.naver.com','stock.naver.com','api.stock.naver.com','openapi.ls-sec.co.kr'].includes(u.hostname)&&!u.username&&!u.password&&!u.hash;}catch{return false;}};
export function validateHistoricalCloseRecord(record,{from,to,now=new Date()}={}){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);
 if(!record||!validDate(record.date)||record.date>=today||from&&record.date<from||to&&record.date>to||!methods.has(record.method)||record.market!=='KOSPI'||record.unit!=='억원'||record.final!==true)throw Error('INVALID_HISTORY_SCOPE');
 if(!Number.isFinite(record.kospi)||record.kospi<=0||record.kospi>1e7||!Number.isFinite(record.changePct)||Math.abs(record.changePct)>100||!Number.isFinite(record.individual)||Math.abs(record.individual)>1e10)throw Error('INVALID_HISTORY_VALUES');
 if(!sourceURL(record.indexSource)||!sourceURL(record.flowSource)||!Number.isFinite(Date.parse(record.fetchedAt))||Date.parse(record.fetchedAt)>now.getTime()||!/^sha256:[a-f0-9]{64}$/.test(record.indexHash||'')||!/^sha256:[a-f0-9]{64}$/.test(record.flowHash||''))throw Error('INVALID_HISTORY_PROVENANCE');
 if(record.method==='LS_KOSPI_DAILY_V1'&&(record.unitVerification?.method!=='T1665_VS_T1601_3_GROUPS'||!validDate(record.unitVerification?.date)||![1,0.01].includes(record.unitVerification?.factorToEok)||record.indexVerification!=='T1665_VS_T8429'))throw Error('HISTORY_UNIT_NOT_VERIFIED');
 if(record.method==='LS_KOSPI_DAILY_V1'&&(!record.indexSource.startsWith('https://openapi.ls-sec.co.kr')||!record.flowSource.startsWith('https://openapi.ls-sec.co.kr')))throw Error('INVALID_HISTORY_PROVENANCE');
 return {...record};
}
export function mergeCorrelationHistory(lsPoints,records,options={}){
 const seen=new Map();
 for(const record of records){let r;try{r=validateHistoricalCloseRecord(record,options);}catch{continue;}
  const point={date:r.date,kospi:r.kospi,changePct:r.changePct,individual:r.individual,source:r.method==='LS_KOSPI_DAILY_V1'?'LS_HISTORY':'NAVER'};
  if(seen.has(r.date)&&JSON.stringify(seen.get(r.date))!==JSON.stringify(point))throw Error('CONFLICTING_HISTORY_DATE');
  seen.set(r.date,point);
 }
 // LS observations retain priority, including verified late recoveries.
 for(const point of lsPoints)seen.set(point.date,point);
 return [...seen.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-365);
}

export const validateNaverCloseRecord=validateHistoricalCloseRecord;
