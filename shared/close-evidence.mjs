export const EVIDENCE_VERSION='LS_KRX_CLOSE_V1';
const num=(v,min=-1e18,max=1e18)=>{if(!['number','string'].includes(typeof v)||typeof v==='string'&&!v.trim())throw Error('CLOSE_NUMBER');const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error('CLOSE_NUMBER');return n;};
export const day=v=>/^\d{8}$/.test(String(v))?String(v).slice(0,4)+'-'+String(v).slice(4,6)+'-'+String(v).slice(6):v;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function closeStamp(stamp,date,now=Date.now(),captureOnly=false){
 if(!validDate(date)||typeof stamp!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||Date.parse(stamp)>now)return false;
 const at=new Date(Date.parse(stamp)+9*3600000),time=at.toISOString().slice(11,19);
 return at.toISOString().slice(0,10)===date&&time>='15:30:00'&&time<(captureOnly?'15:40:00':'16:11:00')&&![0,6].includes(at.getUTCDay());
}
export function dailyBars(rows,date){
 if(!Array.isArray(rows)||rows.length>100)throw Error('CLOSE_DAILY_SHAPE');const seen=new Set();
 const bars=rows.map(r=>{const d=day(r.date);if(!validDate(d)||seen.has(d)||d>date)throw Error('CLOSE_DAILY_DATE');seen.add(d);const close=num(r.close,1,1e9),low=num(r.low,1,1e9),high=num(r.high,1,1e9),volume=num(r.jdiff_vol,1,1e13),turnover=num(r.value,1,1e12)*1e6;
 if(low>close||high<close||low>high||turnover<volume*low-1e6||turnover>volume*high+1e6)throw Error('CLOSE_DAILY_UNIT');return {date:d,close,volume,turnover,low,high};}).sort((a,b)=>a.date.localeCompare(b.date));
 if(bars.at(-1)?.date!==date)throw Error('CLOSE_DAILY_MISSING');return bars;
}
export function risingStreak(bars){let n=0;for(let i=bars.length-1;i>0;i--){if(bars[i].close<=bars[i-1].close)return n;n++;if(n===5)return 5;}return null;}
export function captureQuote(raw,rows,target,date,asOf,now=Date.now()){
 if(!closeStamp(asOf,date,now,true))throw Error('CLOSE_CAPTURE_TIME');
 const bars=dailyBars(rows,date),last=bars.at(-1);
 if(raw?.shcode!==target.symbol||raw.hname!==target.name||num(raw.krx_mcls_price,1)!==last.close||num(raw.price,1)!==last.close||num(raw.volume,1)!==last.volume)throw Error('CLOSE_QUOTE_MISMATCH');
 const marketCap=num(raw.total,1)*1e8,shares=num(raw.listing,1)*1000,derived=last.close*shares;
 if(Math.abs(marketCap-derived)>Math.max(1e8,derived*.002))throw Error('CLOSE_CAP_UNIT');
 // t1102.value is checked against date-keyed t8410.value, never guessed from the latest snapshot.
 const turnover=num(raw.value,1)*1e6;if(Math.abs(turnover-last.turnover)>2e6)throw Error('CLOSE_TURNOVER_MISMATCH');
 return {symbol:target.symbol,name:target.name,date,asOf,method:EVIDENCE_VERSION,exchange:'KRX',unit:'KRW',close:last.close,volume:last.volume,turnover:last.turnover,marketCap,bars,streak:risingStreak(bars),source:'LS t1102 + t8410 · KRX 정규장 교차 확인'};
}
export function captureFlow(rows,quote,date,asOf,now=Date.now()){
 if(!closeStamp(asOf,date,now)||!Array.isArray(rows))throw Error('CLOSE_FLOW_TIME');
 const matching=rows.filter(r=>day(r.date)===date);if(matching.length!==1)throw Error('CLOSE_FLOW_DATE');const row=matching[0];
 if(num(row.close,1)!==quote.close||num(row.volume,1)!==quote.volume||Math.abs(num(row.value,1)*1e6-quote.turnover)>2e6)throw Error('CLOSE_FLOW_SCOPE');
 const foreignNet=num(row.tjj0016)*1e6,institutionNet=num(row.tjj0018)*1e6,individual=num(row.tjj0008)*1e6,other=num(row.tjj0007)*1e6+num(row.tjj0011)*1e6;
 if([foreignNet,institutionNet,individual,other].every(v=>v===0))throw Error('CLOSE_FLOW_PENDING');
 if([foreignNet,institutionNet,individual,other].some(v=>Math.abs(v)>quote.turnover)||Math.abs(foreignNet+institutionNet+individual+other)>5e6)throw Error('CLOSE_FLOW_UNIT');
 return {foreignNet,institutionNet,asOf,unit:'KRW',source:'LS t1702 · KRX 일간 금액 순매수 (집계 갱신 가능)'};
}
export function verifiedEvidence(raw,date,now=Date.now()){
 if(!raw||raw.method!==EVIDENCE_VERSION||raw.date!==date||raw.exchange!=='KRX'||raw.unit!=='KRW'||!/^\d{6}$/.test(raw.symbol)||!closeStamp(raw.asOf,date,now,true))return null;
 try{const turnover=num(raw.turnover,1),marketCap=num(raw.marketCap,1),close=num(raw.close,1),volume=num(raw.volume,1);const bars=raw.bars;if(!Array.isArray(bars)||bars.length>100||bars.at(-1)?.date!==date)return null;let prev='';
 for(const b of bars){if(!validDate(b.date)||b.date<=prev||b.date>date)return null;num(b.close,1);prev=b.date;}
 if(bars.at(-1).close!==close||bars.at(-1).turnover!==turnover||bars.at(-1).volume!==volume)return null;
 const result={symbol:raw.symbol,name:String(raw.name).slice(0,80),date,asOf:raw.asOf,turnover,marketCap,close,changePct:bars.length>=2?(close/bars.at(-2).close-1)*100:null,streak:risingStreak(bars),sourceUrls:['https://openapi.ls-sec.co.kr/apiservice']};
 if(raw.flow&&raw.flow.unit==='KRW'&&closeStamp(raw.flow.asOf,date,now)&&Math.abs(num(raw.flow.foreignNet))<=turnover&&Math.abs(num(raw.flow.institutionNet))<=turnover){result.foreignNet=raw.flow.foreignNet;result.institutionNet=raw.flow.institutionNet;result.flowAsOf=raw.flow.asOf;}
 return result;
 }catch{return null;}
}
