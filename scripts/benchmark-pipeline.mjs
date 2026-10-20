import {SQLiteD1,MemoryR2} from '../tests/helpers/sqlite-d1.mjs';
import {PipelineDB,Meter} from '../worker/pipeline/db.mjs';
import {slots} from '../worker/pipeline/util.mjs';
import {insertHistory} from '../worker/pipeline/history.mjs';
import {prepareRvolDay} from '../worker/pipeline/rvol.mjs';
import {archiveDay} from '../worker/pipeline/archive.mjs';
import {saveReplay} from '../worker/pipeline/replay.mjs';
import {calculateLeadership} from '../src/analytics/index.ts';
const date='2026-10-20',previous=[];for(let d=new Date('2026-06-01T00:00:00Z');d.toISOString().slice(0,10)<date;d.setUTCDate(d.getUTCDate()+1))if(![0,6].includes(d.getUTCDay()))previous.push(d.toISOString().slice(0,10));
const past20=previous.slice(-20),history=previous.slice(-80).map((date,i)=>({date,availableAt:date+'T15:31:00+09:00',source:'LS-shaped synthetic fixture',final:true,adjusted:true,close:100+i,open:100+i-.1,high:100+i+.5,low:100+i-.5,turnoverKRW:100,cumulative:{'1000':50}}));
const dbFor=store=>new PipelineDB(store,new Meter(),24);
const reports=[];
for(const n of [200,500,1000]){
 const store=new SQLiteD1(),meter=new Meter();const empty=store.bytes(),symbols=Array.from({length:n},(_,i)=>String(i+1).padStart(6,'0'));
 const raw=(d,s,slot)=>({date:d,symbol:s,slot,observed_at:`${d}T${slot.slice(0,2)}:${slot.slice(2)}:01.000+09:00`,available_at:`${d}T${slot.slice(0,2)}:${slot.slice(2)}:30.000+09:00`,source_quote_at:null,price:100+Number(s)%100,turnover_krw:1000+Number(s)*Number(slot),market:'KOSPI',name:'분석종목 '+s,source:'LS:t1463:KRX',timing_basis:'RECEIPT_TIME'});
 const start=performance.now();for(const slot of slots){const d=dbFor(store);await insertHistory(d,symbols.map(s=>raw(past20.at(-1),s,slot)));meter.rowsWritten+=d.meter.rowsWritten;}
 const afterFullDay=store.bytes(),fullDayMs=performance.now()-start;
 // Remaining19 sessions store only10:00 for a bounded local cache benchmark, not all79 slots.
 for(const date of past20.slice(0,-1))await insertHistory(dbFor(store),symbols.map(s=>raw(date,s,'1000')));
 for(const d of [...past20,date])await store.prepare('INSERT INTO trading_sessions VALUES(?,?,?,1)').bind(d,'2026-01-01T00:00:00.000Z','synthetic-calendar').run();
 const baselineStart=performance.now();await prepareRvolDay(dbFor(store),{target:date,cutoff:date+'T08:50:00+09:00'});const baselineMs=performance.now()-baselineStart;
 const q=s=>({symbol:s,name:'분석종목 '+s,market:'KOSPI',instrumentType:'STOCK',asOf:date+'T10:00:00+09:00',availableAt:date+'T10:00:05+09:00',price:200,previousClose:179,turnoverKRW:150,open:185,high:205,low:180,history,rvolBaseline:{targetDate:date,symbol:s,slot:'1000',sumTurnover:1000,samples:20,dates:past20,availableAt:date+'T08:50:00+09:00',version:'receipt-5m-v1',timingBasis:'RECEIPT_TIME'},bars:[{asOf:date+'T09:55:00+09:00',availableAt:date+'T09:55:01+09:00',high:190,low:185,close:189},{asOf:date+'T10:00:00+09:00',availableAt:date+'T10:00:05+09:00',high:205,low:190,close:200}]});
 const quotes=symbols.map(q),benchmark={...q('KOSPI'),price:120,previousClose:119,open:119,high:121,low:118,history:history.map(p=>({...p,close:100+(p.close-100)*.2,open:100+(p.close-100)*.2,high:101+(p.close-100)*.2,low:99+(p.close-100)*.2}))};
 const shared={date,asOf:date+'T10:00:59+09:00',source:'LS-shaped synthetic fixture',universe:'SAMPLED_UNIVERSE',isTradingDay:true,calendar:{verified:true,tradingDays:[...previous,date]},quotes,benchmarks:{KOSPI:benchmark}};
 const sectorEntity={type:'SECTOR',id:'fixture-sector',membership:{symbols,effectiveDate:previous[0],knownAt:previous[0]+'T08:00:00+09:00',version:'fixture-v1'}};
 const scoreStart=performance.now(),cpu=process.cpuUsage(),sector=calculateLeadership({...shared,entity:sectorEntity},'INTRADAY');
 const entities=symbols.map(id=>({entity:{type:'STOCK',id},quoteSymbols:[id],sectorId:sector.entityId,sectorScore:sector})),scores=quotes.map((quote,i)=>calculateLeadership({...shared,quotes:[quote],entity:entities[i].entity,sectorId:sector.entityId,sectorScore:sector},'INTRADAY'));
 const cpuDelta=process.cpuUsage(cpu),scoreMs=performance.now()-scoreStart;
 const replay=await saveReplay(dbFor(store),{shared,entities,scores,mode:'INTRADAY',version:sector.methodologyVersion});
 const bucket=new MemoryR2(),archiveStart=performance.now();let passes=0,result;do{result=await archiveDay(dbFor(store),bucket,{date:past20.at(-1),now:'2026-10-21T01:00:00Z',pageSize:500});passes++;}while(!result.done&&passes<200);
 reports.push({stocks:n,rawFullSessionRows:n*79,rawFullSessionInsertionMs:+fullDayMs.toFixed(2),sqliteFileGrowthBytes:afterFullDay-empty,sqliteBytesPerRawRow:+((afterFullDay-empty)/(n*79)).toFixed(1),rvolBenchmarkRows:n*(79+19),rvolAggregationMs:+baselineMs.toFixed(2),scoreBatchWallMs:+scoreMs.toFixed(2),scoreBatchProcessCpuMs:+((cpuDelta.user+cpuDelta.system)/1000).toFixed(2),scoreStatusCounts:scores.reduce((a,s)=>(a[s.status]=(a[s.status]||0)+1,a),{}),replayCompressedBytes:replay.compressedBytes,replayContextBytes:replay.contextBytes,rawArchive:{done:result.done,invocations:passes,wallMs:+(performance.now()-archiveStart).toFixed(2),objects:bucket.objects.size,requests:bucket.requests,compressedBytes:[...bucket.objects.values()].reduce((s,b)=>s+b.length,0)},cloudflareBilledRowsRead:null,cloudflareBilledRowsWritten:null});
 store.close();
 console.error(`Offline scenario ${n} complete`);
}
console.log(JSON.stringify({kind:'LOCAL_SQLITE_NODE_SYNTHETIC_NOT_CLOUDFLARE_BILL',calendar:'synthetic weekdays, not exchange validation',notes:'RVOL aggregation measures20 sessions only for10:00;19 of them contain just that slot. Scores are a complete synthetic fixture. CPU is Node process CPU, not Workers CPU. SQLite rows_written excludes index billing. No production calls.',reports},null,2));
