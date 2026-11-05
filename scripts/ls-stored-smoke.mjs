import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {engineInput} from '../src/pipeline/input.ts';
import {calculateLeadership} from '../src/analytics/index.ts';
import {eligibleStocks} from '../src/market.ts';
import {kstDate, stamp, slot} from '../src/analytics/common.ts';

export const ENDPOINT='https://market-note-ls-api.kby0991.workers.dev/api/dashboard';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function analyze(raw,{now=new Date(),limit=5}={}){
 const testedAt=now.toISOString(),date=kstDate(testedAt);
 const report={testedAt,testDateKST:date,endpoint:ENDPOINT,upstreamLSCalls:0,status:'INVALID_RESPONSE',results:[]};
 if(raw?.schemaVersion!==2||!Array.isArray(raw.snapshots))return report;
 const today=raw.snapshots.filter(s=>s.date===date);
 if(!today.length)return {...report,status:'NO_TODAY_DATA',availableDates:raw.snapshots.map(s=>s.date)};
 if(today.length!==1)return report;
 const snapshot=today[0],asOf=snapshot.stockAsOf||snapshot.asOf;
 if(typeof snapshot.source!=='string'||!snapshot.source.startsWith('LS증권 KRX')||/demo|simulation|시뮬레이션|가상/i.test(snapshot.source)||!stamp(asOf)||kstDate(asOf)!==date||Date.parse(asOf)>now.getTime()||!Array.isArray(snapshot.stocks))return report;
 const count=Number.isInteger(limit)?Math.max(1,Math.min(5,limit)):5;
 const seen=new Set();
 const stocks=eligibleStocks(snapshot.stocks.filter(s=>s&&typeof s.name==='string'&&typeof s.symbol==='string'),snapshot.etfs||[]).filter(s=>{if(seen.has(s.symbol))return false;seen.add(s.symbol);return true;}).slice(0,count);
 const results=stocks.map(s=>{
  const invalid=[];
  if(!/^\d{6}$/.test(s.symbol))invalid.push('symbol');
  if(!s.name.trim())invalid.push('name');
  if(!['KOSPI','KOSDAQ'].includes(s.market))invalid.push('market');
  if(!finite(s.price)||s.price<=0)invalid.push('price');
  if(!finite(s.changePct)||s.changePct< -100||s.changePct>10000)invalid.push('changePct');
  if(!finite(s.turnoverKRW)||s.turnoverKRW<0)invalid.push('turnoverKRW');
  const base={symbol:s.symbol,name:s.name,quoteReadSuccess:!invalid.length,price:s.price,changePct:s.changePct,turnoverKRW:s.turnoverKRW,asOf,source:snapshot.source,sourceQuoteAt:null,score:null};
  if(invalid.length)return {...base,status:'INVALID_DATA',missingFields:invalid};
  // Snapshot timestamp is receipt time, not a verified exchange quote timestamp.
  const row={date,symbol:s.symbol,name:s.name,market:s.market,slot:slot(asOf),observed_at:asOf,available_at:asOf,source_quote_at:null,price:s.price,turnover_krw:s.turnoverKRW,source:snapshot.source,timing_basis:'RECEIPT_TIME'};
  const converted=engineInput({date,asOf,rows:[row],calendar:{verified:false,tradingDays:[]},entity:{type:'STOCK',id:s.symbol}});
  const engine=calculateLeadership(converted.input,'INTRADAY');
  const missingFields=[...new Set([...converted.missingFields,...engine.missingFactors,'verifiedTradingCalendar','history.adjustedDailyBars','rvolBaseline.previous20TradingDaysSameSlot','bars','sectorId','sectorScore'])];
  return {...base,status:'INSUFFICIENT_DATA',missingFields,engineStatus:engine.status,engineIssues:engine.missingFactors,methodologyVersion:engine.methodologyVersion,engineInput:converted.input};
 });
 return {...report,status:results.length?'READ_OK':'NO_ELIGIBLE_STOCKS',feedFailed:raw.feed?.failed===true,results};
}
export async function run({fetcher=fetch,now=new Date(),limit=5}={}){
 const base={testedAt:now.toISOString(),testDateKST:kstDate(now.toISOString()),endpoint:ENDPOINT,upstreamLSCalls:0,results:[]};
 let response;
 try{response=await fetcher(ENDPOINT+'?date='+base.testDateKST,{method:'GET',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{return {...base,status:'FETCH_FAILED',reason:'NETWORK_OR_ACCESS_FAILURE'};}
 if(!response.ok)return {...base,status:'FETCH_FAILED',reason:'HTTP_ERROR',httpStatus:response.status};
 try{
  let size=0;const chunks=[];
  for await(const chunk of response.body){size+=chunk.byteLength;if(size>6000000)return {...base,status:'INVALID_RESPONSE',reason:'RESPONSE_TOO_LARGE'};chunks.push(chunk);}
  const text=new TextDecoder().decode(Buffer.concat(chunks));
  return analyze(JSON.parse(text),{now,limit});
 }catch{return {...base,status:'INVALID_RESPONSE',reason:'BODY_OR_JSON_ERROR'};}
}
export async function readInput(path){
 try{const bytes=await readFile(path);if(bytes.length>6000000)throw Error();return {...analyze(JSON.parse(bytes.toString('utf8'))),inputMethod:'USER_UPLOADED_API_RESPONSE',liveFetchPerformed:false,inputSHA256:createHash('sha256').update(bytes).digest('hex')};}
 catch{return {testedAt:new Date().toISOString(),status:'INPUT_FILE_FAILED',results:[]};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let report;
 if(process.argv[2]==='--input'&&process.argv.length===4){
  report=await readInput(process.argv[3]);
 }else if(process.argv.length===2){report=await run();}
 else{report={status:'INVALID_ARGUMENTS',usage:'npm run test:ls-stored -- --input response.json',results:[]};}
 console.log(JSON.stringify(report,null,2));
 if(!['READ_OK'].includes(report.status))process.exitCode=1;
}
