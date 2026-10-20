import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SQLiteD1} from './helpers/sqlite-d1.mjs';
import {PipelineDB,Meter} from '../worker/pipeline/db.mjs';
import {captureRows,insertHistory} from '../worker/pipeline/history.mjs';
import {pruneHistory} from '../worker/pipeline/retention.mjs';
import {prepareRvolDay,readBaselines} from '../worker/pipeline/rvol.mjs';
import {storeDailyBars,loadDailyBars,pruneDailyBars} from '../worker/pipeline/daily.mjs';
import {reserveHistoryWrites} from '../worker/pipeline/write-budget.mjs';
import {captureAfterLatest} from '../worker/pipeline/hook.mjs';
import {saveReplay,loadReplay} from '../worker/pipeline/replay.mjs';
import {engineInput} from '../src/pipeline/input.ts';
import {calculateLeadership} from '../src/analytics/index.ts';
import {estimate} from '../worker/pipeline/costs.mjs';
const target='2026-10-20',pd=db=>new PipelineDB(db,new Meter(new Date(target+'T01:00:00Z')),24);
const previous=Array.from({length:160},(_,i)=>new Date(Date.UTC(2026,4,1+i))).filter(d=>![0,6].includes(d.getUTCDay())).map(d=>d.toISOString().slice(0,10)).filter(d=>d<target);
const stock=(symbol,market='KOSPI',turnoverKRW=100)=>({symbol,name:symbol,market,turnoverKRW,price:100});
const snap=(date=target,stocks=[stock('005930')])=>({date,asOf:date+'T10:00:01+09:00',stocks});
const rows=(date=target,amount=100)=>captureRows(snap(date,[stock('005930','KOSPI',amount)]),{},date+'T10:00:30+09:00');
test('history selects turnover top50 per board independently; original200 quotes unchanged and ties deterministic',()=>{
 const stocks=['KOSPI','KOSDAQ'].flatMap((m,j)=>Array.from({length:100},(_,i)=>stock(String(j*100+i).padStart(6,'0'),m,i))),snapshot=snap(target,stocks),before=structuredClone(snapshot);
 const result=captureRows(snapshot,{},target+'T10:00:30+09:00');assert.equal(result.length,100);for(const m of ['KOSPI','KOSDAQ']){const board=result.filter(r=>r.market===m);assert.equal(board.length,50);assert.equal(Math.min(...board.map(r=>r.turnover_krw)),50);}assert.deepEqual(snapshot,before);
 const tied=captureRows(snap(target,[...stocks].reverse().map(s=>({...s,turnoverKRW:1}))),{},target+'T10:00:30+09:00');assert.equal(tied[0].symbol,'000000');
});
test('retention keeps exactly previous20 plus today; RVOL never includes today or21st prior session',async()=>{
 const db=new SQLiteD1();try{
 const days=previous.slice(-22);for(const d of [...days,target]){await db.prepare('INSERT INTO trading_sessions VALUES(?,?,?,1)').bind(d,'2026-01-01T00:00:00.000Z','synthetic').run();await insertHistory(pd(db),rows(d,d===target?999999:100));}
 for(let i=0;i<3;i++)await pruneHistory(pd(db),{target,verifiedDays:[...days,target]});
 const dates=(await db.prepare('SELECT date FROM history_days WHERE EXISTS(SELECT 1 FROM history_5m h WHERE h.date=history_days.date) ORDER BY date').all()).results.map(r=>r.date);
 assert.deepEqual(dates,[...days.slice(-20),target]);
 await prepareRvolDay(pd(db),{target,cutoff:target+'T08:50:00+09:00'});
 const result=await readBaselines(pd(db),{target,symbols:['005930','000660'],slot:'1000',cutoff:target+'T10:01:00+09:00'});
 assert.equal(result.rows[0].sum_turnover,2000);assert.equal(result.rows[0].samples,20);assert.ok(!JSON.parse(result.day.days_json).includes(target));assert.deepEqual(result.historyStatus.map(s=>s.status),['READY','BACKFILL_REQUIRED']);
 }finally{db.close();}
});
test('incomplete/new entrant baseline explicitly requires backfill, never implicit zeros',async()=>{
 const db=new SQLiteD1();try{const result=await readBaselines(pd(db),{target,symbols:['005930'],slot:'1000',cutoff:target+'T10:00:00+09:00'});assert.equal(result.historyStatus[0].status,'BACKFILL_REQUIRED');assert.equal(result.historyStatus[0].validSamples,0);}finally{db.close();}
});
test('daily store retains90 previous sessions separately; source versions and known-at prevent lookahead',async()=>{
 const db=new SQLiteD1();try{
 for(const date of [...previous,target]){await storeDailyBars(pd(db),[{symbol:'005930',date,availableAt:date+'T15:31:00+09:00',source:'approved-fixture',version:'v1',close:100,open:100,high:101,low:99,turnoverKRW:100,final:true,adjusted:true}]);await insertHistory(pd(db),rows(date));}
 const d=previous.at(-1);await storeDailyBars(pd(db),[{symbol:'005930',date:d,availableAt:'2026-10-21T15:31:00+09:00',source:'approved-fixture',version:'v2',close:999,open:999,high:1000,low:998,turnoverKRW:100,final:true,adjusted:true}]);
 await pruneDailyBars(pd(db),{target,verifiedDays:[...previous,target]});for(let i=0;i<previous.length;i++)await pruneHistory(pd(db),{target,verifiedDays:[...previous,target]});
 const bars=await loadDailyBars(pd(db),{symbol:'005930',target,asOf:target+'T10:00:00+09:00'});assert.equal(bars.length,90);assert.equal(bars.at(-1).close,100);assert.equal((await loadDailyBars(pd(db),{symbol:'005930',target,asOf:'2026-10-22T00:00:00Z'})).at(-1).close,999);
 assert.equal((await db.prepare('SELECT COUNT(DISTINCT date) AS n FROM history_5m').first()).n,21);
 }finally{db.close();}
});
test('atomic70k forecast permits boundary, blocks excess and concurrent reservations; latest snapshot remains intact',async()=>{
 const db=new SQLiteD1();try{
 const model=estimate({stocks:100}),maintenance=model.daily.rowsWritten-31600-4000;
 await db.prepare('INSERT INTO pipeline_metrics VALUES(?,?,?,?,?,?)').bind(target,'core',0,70000-maintenance-31600,null,'{}').run();
 assert.equal((await reserveHistoryWrites(pd(db),{rows:100})).allowed,true);
 await db.prepare('UPDATE pipeline_metrics SET rows_written=rows_written+1').run();assert.equal((await reserveHistoryWrites(pd(db),{rows:100})).allowed,false);
 db.sqlite.exec('CREATE TABLE snapshots(date TEXT PRIMARY KEY,payload TEXT)');await db.prepare('INSERT INTO snapshots VALUES(?,?)').bind(target,JSON.stringify(snap())).run();
 const result=await captureAfterLatest({DB:db,ENABLE_HISTORY_PIPELINE:'true'},snap(),{}, {},target+'T10:00:30+09:00');assert.equal(result.error,'HISTORY_WRITE_LIMIT');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM history_5m').first()).n,0);assert.deepEqual(JSON.parse((await db.prepare('SELECT payload FROM snapshots').first()).payload),snap());
 await db.prepare('UPDATE pipeline_metrics SET rows_written=0').run();await db.prepare('UPDATE history_write_budget SET reserved=?').bind(70000-maintenance-4000-203).run();
 const simultaneous=await Promise.all([reserveHistoryWrites(pd(db),{rows:100}),reserveHistoryWrites(pd(db),{rows:100})]);assert.deepEqual(simultaneous.map(x=>x.allowed),[true,false]);
 }finally{db.close();}
});
test('intraday and closing replay scores coexist at identical date/asOf/version',async()=>{
 const db=new SQLiteD1();try{const {input}=engineInput({date:target,asOf:target+'T10:00:59+09:00',rows:rows(),calendar:{verified:true,tradingDays:[...previous,target]},entity:{type:'STOCK',id:'005930'}}),{entity,...shared}=input;
 for(const mode of ['INTRADAY','EOD'])await saveReplay(pd(db),{shared,entities:[entity],scores:[calculateLeadership(input,mode)],mode,version:'separate-modes'});
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM replay_frames').first()).n,2);for(const mode of ['INTRADAY','EOD'])assert.equal((await loadReplay(pd(db),{date:target,asOf:input.asOf,mode,version:'separate-modes'})).mode,mode);
 }finally{db.close();}
});
test('100 stock cost forecast is below70k and leaves dashboard/provider universe untouched',()=>{const c=estimate({stocks:100});assert.equal(c.daily.rowsWritten,52319);assert.equal(c.daily.rowsRead,202760);assert.equal(c.assumptions.rawDays,20);assert.equal(c.monthly.extraLiveTRs,0);assert.ok(!c.warnings.includes('HISTORY_WRITE_GUARD_70000'));assert.ok(estimate({stocks:200}).warnings.includes('HISTORY_WRITE_GUARD_70000'));});
test('successful capture runs bounded20-session retention only after saving latest data',async()=>{
 const db=new SQLiteD1();try{const days=previous.slice(-21);for(const d of [...days,target])await db.prepare('INSERT INTO trading_sessions VALUES(?,?,?,1)').bind(d,'2026-01-01T00:00:00.000Z','fixture').run();await insertHistory(pd(db),rows(days[0]));
 const result=await captureAfterLatest({DB:db,ENABLE_HISTORY_PIPELINE:'true'},snap(),{}, {},target+'T10:00:30+09:00');assert.equal(result.ok,true);assert.equal(result.retention.deleted,1);assert.equal((await db.prepare('SELECT date FROM history_5m').first()).date,target);
 }finally{db.close();}
});
test('retention backlog also consumes write reservations and stops before an excessive optional delete',async()=>{
 const db=new SQLiteD1();try{await insertHistory(pd(db),rows(previous[0]));await db.prepare('INSERT INTO pipeline_metrics VALUES(?,?,?,?,?,?)').bind(target,'core',0,70000,null,'{}').run();
 const result=await pruneHistory(pd(db),{target,verifiedDays:previous});assert.equal(result.error,'HISTORY_WRITE_LIMIT');assert.equal(result.deleted,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM history_5m').first()).n,1);
 }finally{db.close();}
});
