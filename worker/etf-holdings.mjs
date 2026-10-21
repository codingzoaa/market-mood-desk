import {SECTOR_ETFS} from '../shared/sector-etfs.mjs';
const day=d=>{if(typeof d!=='string'||!/^\d{8}$/.test(d))throw Error('HOLDINGS_DATE');const s=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6);if(!Number.isFinite(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('HOLDINGS_DATE');return s;};
export function normalizeHoldings(data,symbol,asOf){
 if(!SECTOR_ETFS.some(e=>e.symbol===symbol)||!Number.isFinite(Date.parse(asOf)))throw Error('HOLDINGS_SCOPE');
 const header=data?.t1904OutBlock,rows=data?.t1904OutBlock1;
 if(!header||!Array.isArray(rows)||!rows.length||rows.length>1000)throw Error('HOLDINGS_SHAPE');
 const date=day(header.date);if(Date.parse(date+'T00:00:00+09:00')>Date.parse(asOf))throw Error('HOLDINGS_FUTURE_DATE');
 const seen=new Set();const holdings=rows.map(row=>{
  const name=typeof row.hname==='string'?row.hname.trim():'',code=typeof row.shcode==='string'?row.shcode.trim():'';
  if(!name||name.length>100||code.length>20||code&&!/^[A-Za-z0-9._-]+$/.test(code)||seen.has(code||name))throw Error('HOLDINGS_ID');seen.add(code||name);
  const raw=row.weight;if(!['string','number'].includes(typeof raw)||String(raw).trim()==='')throw Error('HOLDINGS_WEIGHT');const weight=Number(raw);if(!Number.isFinite(weight)||weight< -100||weight>100)throw Error('HOLDINGS_WEIGHT');
  if(row.profitdate&&day(row.profitdate)!==date)throw Error('HOLDINGS_MIXED_DATE');
  return {symbol:code,name,weight};
 }).sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name,'ko'));
 const totalWeight=holdings.reduce((n,r)=>n+r.weight,0);if(totalWeight>105||totalWeight<0)throw Error('HOLDINGS_WEIGHT_TOTAL');
 const expected=Number(header.etfnum);return {symbol,date,asOf,source:'LS증권 t1904 · ETF PDF 구성종목',sourceURL:'https://openapi.ls-sec.co.kr/apiservice',order:'WEIGHT_DESC',complete:!Number.isFinite(expected)||expected<=holdings.length,holdings,totalWeight};
}
export async function fetchHoldings(request,symbol,date,pause=()=>new Promise(r=>setTimeout(r,1100))){
 const rows=[];let header=null,continuation={flag:'N',key:''};const cursors=new Set();
 for(let page=0;page<10;page++){
  await pause();const response=await request('t1904',{shcode:symbol,date:'',sgb:'1',exchgubun:'K'},continuation);
  if(!response.data?.t1904OutBlock||!Array.isArray(response.data?.t1904OutBlock1))throw Error('HOLDINGS_SHAPE');
  if(header&&header.date!==response.data.t1904OutBlock.date)throw Error('HOLDINGS_MIXED_DATE');header=response.data.t1904OutBlock;rows.push(...response.data.t1904OutBlock1);
  if(response.continuation?.flag!=='Y')return normalizeHoldings({t1904OutBlock:header,t1904OutBlock1:rows},symbol,new Date().toISOString());
  continuation=response.continuation;if(!continuation.key||cursors.has(continuation.key))throw Error('HOLDINGS_CURSOR');cursors.add(continuation.key);
 }
 throw Error('HOLDINGS_PAGE_LIMIT');
}
