import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SQLiteD1,MemoryR2} from './helpers/sqlite-d1.mjs';
import {PipelineDB,Meter} from '../worker/pipeline/db.mjs';
import {captureRows,insertHistory,safeCapture,loadHistory} from '../worker/pipeline/history.mjs';
import {prepareRvolDay,readBaselines} from '../worker/pipeline/rvol.mjs';
import {archiveDay} from '../worker/pipeline/archive.mjs';
import {pruneHistory} from '../worker/pipeline/retention.mjs';
import {planBackfill as planCollected,backfillStep} from '../worker/pipeline/backfill.mjs';
import {saveReplay,loadReplay} from '../worker/pipeline/replay.mjs';
import {captureAfterLatest} from '../worker/pipeline/hook.mjs';
import {relativeVolume,calculateLeadership} from '../src/analytics/index.ts';
import {engineInput} from '../src/pipeline/input.ts';
const pd=(db,budget=24)=>new PipelineDB(db,new Meter(new Date('2026-10-20T00:00:00Z')),budget);
const date='2026-10-20';
async function planBackfill(db,options){db.db.sqlite.exec('CREATE TABLE IF NOT EXISTS snapshots(date TEXT PRIMARY KEY,payload TEXT)');await db.db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?)').bind(date,JSON.stringify(snapshot())).run();return planCollected(db,options);}
function snapshot(day=date,amount=100){return {date:day,asOf:day+'T10:00:01+09:00',stocks:[{symbol:'005930',name:'삼성전자',market:'KOSPI',price:100,turnoverKRW:amount}]};}
const row=(day=date,amount=100)=>captureRows(snapshot(day,amount),{},day+'T10:00:30+09:00')[0];
function days(n=40){const out=[];for(let d=new Date('2026-08-01T00:00:00Z');d.toISOString().slice(0,10)<date;d.setUTCDate(d.getUTCDate()+1))if(![0,6].includes(d.getUTCDay()))out.push(d.toISOString().slice(0,10));return out.slice(-n);}
async function seedCalendar(db,previous){for(const d of [...previous,date])await db.prepare('INSERT OR IGNORE INTO trading_sessions VALUES(?,?,?,1)').bind(d,'2026-07-01T00:00:00.000Z','test-calendar fixture').run();}
test('bulk insert uses atomic JSON bind, first observation wins, and snapshot input is unchanged',async()=>{
 const db=new SQLiteD1();try{const snap=snapshot(),before=structuredClone(snap);await insertHistory(pd(db),captureRows(snap,{},date+'T10:00:30+09:00'));await insertHistory(pd(db),[row(date,999)]);const result=await loadHistory(pd(db),{symbol:'005930',from:date,to:date,slot:'1000'});assert.equal(result.length,1);assert.equal(result[0].turnover_krw,100);assert.equal(result[0].source_quote_at,null);assert.equal(result[0].timing_basis,'RECEIPT_TIME');assert.deepEqual(snap,before);}finally{db.close();}
});
test('optional pipeline never touches DB when disabled and storage failures never escape',async()=>{
 let calls=0;const env={DB:{prepare(){calls++;throw Error('storage failure');}}};assert.deepEqual(await captureAfterLatest(env,snapshot()),{enabled:false});assert.equal(calls,0);const result=await captureAfterLatest({...env,ENABLE_HISTORY_PIPELINE:'true'},snapshot(),{}, {},date+'T10:00:30+09:00');assert.equal(result.ok,false);assert.doesNotMatch(JSON.stringify(result),/storage failure/);
});
test('pre-open cache freezes exactly previous twenty sessions; IPOs and missing slots stay insufficient',async()=>{
 const db=new SQLiteD1();try{const previous=days(20);await seedCalendar(db,previous);for(const d of previous)await insertHistory(pd(db),[row(d)]);await prepareRvolDay(pd(db),{target:date,cutoff:date+'T08:50:00+09:00'});const {day,rows}=await readBaselines(pd(db),{target:date,symbols:['005930','000660'],slot:'1000',cutoff:date+'T10:00:59+09:00'});assert.equal(rows.length,1);assert.equal(rows[0].samples,20);assert.equal(rows[0].sum_turnover,2000);assert.equal(JSON.parse(day.days_json).at(-1),previous.at(-1));
 await insertHistory(pd(db),[row(previous[0],999)]);assert.equal((await prepareRvolDay(pd(db),{target:date,cutoff:date+'T08:55:00+09:00'})).reused,true);await assert.rejects(prepareRvolDay(pd(db),{target:date,cutoff:date+'T09:00:00+09:00'}),/NOT_PREOPEN/);
 }finally{db.close();}
});
test('cache does not count unavailable backfill or treat missing trading dates as zero',async()=>{
 const db=new SQLiteD1();try{const previous=days(20);await seedCalendar(db,previous);for(const [i,d] of previous.entries())await insertHistory(pd(db),[{...row(d),available_at:i===0?date+'T10:00:00.000Z':row(d).available_at}]);await prepareRvolDay(pd(db),{target:date,cutoff:date+'T08:50:00+09:00'});const x=await readBaselines(pd(db),{target:date,symbols:['005930'],slot:'1000',cutoff:date+'T10:00:59+09:00'});assert.equal(x.rows[0].samples,19);
 const base={targetDate:date,symbol:'005930',slot:'1000',sumTurnover:1900,samples:19,dates:previous,availableAt:date+'T08:50:00+09:00',version:'receipt-5m-v1',timingBasis:'RECEIPT_TIME'};
 const {input,missingFields}=engineInput({date,asOf:date+'T10:00:59+09:00',rows:[row()],calendar:{verified:true,tradingDays:[...previous,date]},entity:{type:'STOCK',id:'005930'},baselines:[base]});assert.equal(relativeVolume(input,'INTRADAY'),null);assert.equal(calculateLeadership(input,'INTRADAY').score,null);assert.ok(missingFields.includes('previousClose'));
 base.samples=20;base.sumTurnover=2000;const valid=engineInput({date,asOf:date+'T10:00:59+09:00',rows:[row()],calendar:input.calendar,entity:input.entity,baselines:[base]}).input;assert.equal(relativeVolume(valid,'INTRADAY'),1);base.availableAt=date+'T11:00:00+09:00';assert.equal(relativeVolume(valid,'INTRADAY'),null);
 }finally{db.close();}
});
test('R2 verification failure blocks retention, retries resume sealed immutable pages, no R2 keeps thirty days',async()=>{
 const db=new SQLiteD1(),bucket=new MemoryR2();try{const previous=days(40);for(const d of previous)await insertHistory(pd(db),[row(d)]);const oldest=previous[0];bucket.corrupt=true;await assert.rejects(archiveDay(pd(db),bucket,{date:oldest,now:date+'T10:00:00+09:00',pageSize:1}));let deleted=await pruneHistory(pd(db),{target:date,verifiedDays:previous,r2Enabled:true,bucket});assert.equal(deleted.deleted,0);
 bucket.corrupt=false;let result;for(let i=0;i<4;i++){result=await archiveDay(pd(db),bucket,{date:oldest,now:date+`T10:0${i+2}:00+09:00`,pageSize:1});if(result.done)break;}assert.equal(result.done,true);assert.equal(result.manifest.count,1);await assert.rejects(insertHistory(pd(db),[row(oldest)]),/SEALED/);deleted=await pruneHistory(pd(db),{target:date,verifiedDays:previous,r2Enabled:true,bucket});assert.equal(deleted.deleted,1);
 for(let i=0;i<20;i++)await pruneHistory(pd(db),{target:date,verifiedDays:previous,r2Enabled:false});const retained=await db.prepare('SELECT COUNT(DISTINCT date) AS n FROM history_5m').first();assert.equal(retained.n,30);
 }finally{db.close();}
});
test('replay frame restores canonical engine inputs and scores after raw observations are removed',async()=>{
 const db=new SQLiteD1();try{const {input}=engineInput({date,asOf:date+'T10:00:59+09:00',rows:[row()],calendar:{verified:true,tradingDays:[...days(20),date]},entity:{type:'STOCK',id:'005930'}});const {entity,...shared}=input;const score=calculateLeadership(input,'INTRADAY');const data={shared,entities:[entity],scores:[score],mode:'INTRADAY',version:score.methodologyVersion};const first=await saveReplay(pd(db),data);assert.equal(first.reused,false);assert.equal((await saveReplay(pd(db),data)).reused,true);await db.prepare('DELETE FROM history_5m').run();const loaded=await loadReplay(pd(db),{date,asOf:input.asOf,mode:data.mode,version:data.version});assert.deepEqual(calculateLeadership({...loaded.shared,entity:loaded.entities[0]},'INTRADAY'),score);await assert.rejects(saveReplay(pd(db),{...data,scores:[{...score,score:1}]}),/CONFLICT/);
 }finally{db.close();}
});
test('backfill plans only gaps, blocks unreviewed/unapproved providers, checkpoints pages, completed jobs do not call again',async()=>{
 const db=new SQLiteD1();let calls=0;try{await insertHistory(pd(db),[row(days(20)[0])]);const request={symbols:['005930'],dates:days(20).slice(0,2),slots:['1000'],contractHash:'reviewed-fixture-contract',tr:'t8412'};await planBackfill(pd(db),request);await planBackfill(pd(db),request);const jobs=await db.prepare('SELECT * FROM backfill_jobs').all();assert.equal(jobs.results.length,1);assert.equal(JSON.parse(jobs.results[0].request_json).missing.length,1);const job=jobs.results[0];const adapter={async page(){calls++;return {rows:[{...row(request.dates[1]),source:'LS:t8412:KRX',available_at:'2026-10-20T01:00:00.000Z'}],cursor:'',done:true};}};
 await assert.rejects(backfillStep(pd(db),{jobId:job.id,adapter,approval:{approved:false},contract:{}}),/NOT_APPROVED/);assert.equal(calls,0);
 const options={jobId:job.id,adapter,now:'2026-10-20T01:00:00.000Z',approval:{approved:true,contractHash:request.contractHash,expiresAt:'2026-10-21T00:00:00Z',symbols:['005930'],jobIds:[job.id],tr:'t8412',maxPages:10},contract:{verified:true,hash:request.contractHash,tr:'t8412',krxOnly:true,cumulativeFromSessionOpen:true,maxRequestsPerSecond:1,documentationURL:'fixture://reviewed'}};assert.equal((await backfillStep(pd(db),options)).done,true);assert.equal((await backfillStep(pd(db),options)).done,true);assert.equal(calls,1);const stored=await db.prepare('SELECT provenance_json FROM backfill_jobs').first();assert.match(stored.provenance_json,/normalizedRowsHash/);
 }finally{db.close();}
});
test('D1 meta reads/scans are measured when supplied; absent scanned-row metadata stays unknown, and budgets stop work',async()=>{
 const meter=new Meter(new Date('2026-10-20T01:00:00Z'));meter.add({meta:{rows_read:250,rows_written:4,size_after:4096}});assert.equal(meter.snapshot().rowsRead,250);const db=new SQLiteD1();try{const measured=new PipelineDB(db,meter,3);await measured.query('SELECT * FROM history_5m');assert.equal(meter.unknownMeta,1);await measured.flush('test');assert.equal((await db.prepare('SELECT rows_read FROM pipeline_metrics').first()).rows_read,250);await measured.query('SELECT 1');await assert.rejects(measured.query('SELECT 1'),/BUDGET/);}finally{db.close();}
});

test('batched daily metrics add counters instead of replacing them and failures do not create fake scan counts',async()=>{
 const db=new SQLiteD1();try{for(let i=0;i<2;i++){const m=pd(db);m.meter.count('lsTR:t1463',2);await m.flush('core');}const data=await db.prepare('SELECT counters_json FROM pipeline_metrics').first();assert.equal(JSON.parse(data.counters_json)['lsTR:t1463'],4);}finally{db.close();}
});
test('cached backfill response is retried locally after D1 failure without another provider call',async()=>{
 const db=new SQLiteD1();let calls=0;try{
 const d=days(20)[0],contractHash='fixture-contract';await planBackfill(pd(db),{symbols:['005930'],dates:[d],slots:['1000'],contractHash,tr:'t8452'});const job=await db.prepare('SELECT id FROM backfill_jobs').first();
 const options={jobId:job.id,now:'2026-10-20T01:00:00.000Z',approval:{approved:true,contractHash,expiresAt:'2026-10-21T00:00:00Z',symbols:['005930'],jobIds:[job.id],tr:'t8452',maxPages:5},contract:{verified:true,hash:contractHash,tr:'t8452',krxOnly:true,cumulativeFromSessionOpen:true,maxRequestsPerSecond:1,documentationURL:'fixture://contract'},adapter:{async page(){calls++;return {rows:[{...row(d),source:'LS:t8452:KRX',available_at:'2026-10-20T01:00:00.000Z',access_token:'must-not-be-stored'}],done:true,cursor:''};}}};
 const broken=pd(db);const batch=broken.batch.bind(broken);broken.batch=async statements=>{if(statements.some(([sql])=>sql.includes('history_5m')))throw Error('simulated D1 outage');return batch(statements);};
 assert.equal((await backfillStep(broken,options)).done,false);assert.equal(calls,1);const pending=await db.prepare('SELECT pending_page_json FROM backfill_jobs').first();assert.ok(pending.pending_page_json);assert.doesNotMatch(pending.pending_page_json,/must-not-be-stored|access_token/);
 assert.equal((await backfillStep(pd(db),{...options,now:'2026-10-20T01:02:00.000Z'})).done,true);assert.equal(calls,1);
 }finally{db.close();}
});
test('stored-data API never fetches upstream or writes to D1; feature off leaves DB untouched',async()=>{
 const {pipelineRead}=await import('../worker/pipeline/read.mjs');const db=new SQLiteD1(),previous=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;throw Error('must not fetch');};try{await insertHistory(pd(db),[row()]);const before=db.sqlite.prepare('SELECT total_changes() AS n').get().n;const response=await pipelineRead(new Request('https://api.test/api/history?symbol=005930&from=2026-10-20&to=2026-10-20'),{DB:db,ENABLE_HISTORY_PIPELINE:'true'});assert.equal(response.status,200);assert.equal(response.data.data.rows.length,1);assert.equal(db.sqlite.prepare('SELECT total_changes() AS n').get().n,before);assert.equal(fetches,0);assert.equal((await pipelineRead(new Request('https://api.test/api/history'),{DB:{prepare(){throw Error('untouched');}}})).status,404);}finally{globalThis.fetch=previous;db.close();}
});
test('R2 replay restore reproduces exact scores after D1 frame/context cleanup',async()=>{
 const {archiveReplay,loadArchivedReplay}=await import('../worker/pipeline/replay-archive.mjs');const {replayScores}=await import('../src/pipeline/compute.ts');const db=new SQLiteD1(),bucket=new MemoryR2();try{const {input}=engineInput({date,asOf:date+'T10:00:59+09:00',rows:[row()],calendar:{verified:true,tradingDays:[...days(20),date]},entity:{type:'STOCK',id:'005930'}});const {entity,...shared}=input,score=calculateLeadership(input,'INTRADAY');const key={date,asOf:input.asOf,mode:'INTRADAY',version:score.methodologyVersion};await saveReplay(pd(db),{shared,entities:[{entity,quoteSymbols:['005930']}],scores:[score],mode:key.mode,version:key.version});await archiveReplay(pd(db),bucket,{...key,now:'2026-10-21T00:00:00Z'});await db.batch([db.prepare('DELETE FROM replay_frames'),db.prepare('DELETE FROM replay_contexts')]);const replay=await loadArchivedReplay(pd(db),bucket,key);assert.deepEqual(replayScores(replay),[score]);bucket.corrupt=true;await assert.rejects(loadArchivedReplay(pd(db),bucket,key),/incorrect|header|HASH|invalid|format/i);}finally{db.close();}
});
test('query plans use only the required primary key or symbol/slot index',()=>{
 const db=new SQLiteD1();try{const a=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM history_5m WHERE date=? AND (symbol,slot)>(?,?) ORDER BY symbol,slot LIMIT 500').all(date,'','');assert.match(JSON.stringify(a),/PRIMARY KEY/);const b=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM history_5m WHERE symbol=? AND slot=? AND date>=? AND date<=?').all('005930','1000',days(20)[0],date);assert.match(JSON.stringify(b),/history_symbol_slot_date/);}finally{db.close();}
});
test('capacity model warns on free-tier writes and preserves unknown unverified backfill page counts',async()=>{
 const {estimate}=await import('../worker/pipeline/costs.mjs');assert.ok(estimate({stocks:200}).warnings.includes('D1_FREE_WRITES_HEADROOM_LOW'));for(const stocks of [500,1000]){const c=estimate({stocks});assert.ok(c.warnings.includes('D1_FREE_WRITES_EXCEEDED'));assert.equal(c.monthly.extraLiveTRs,0);assert.equal(c.monthly.backfillTRs,null);}
});

test('latest snapshot survives a missing optional history table and raw archive outage prevents deletion',async()=>{
 const db=new SQLiteD1(),bucket=new MemoryR2();try{db.sqlite.exec('CREATE TABLE snapshots(date TEXT PRIMARY KEY,payload TEXT)');await db.prepare('INSERT INTO snapshots VALUES(?,?)').bind(date,JSON.stringify(snapshot())).run();db.sqlite.exec('DROP TABLE history_5m');const result=await captureAfterLatest({DB:db,ENABLE_HISTORY_PIPELINE:'true'},snapshot(),{}, {},date+'T10:00:30+09:00');assert.equal(result.ok,false);assert.deepEqual(JSON.parse((await db.prepare('SELECT payload FROM snapshots').first()).payload),snapshot());}finally{db.close();}
 const store=new SQLiteD1();try{const previous=days(40),oldest=previous[0];await insertHistory(pd(store),[row(oldest)]);await archiveDay(pd(store),bucket,{date:oldest,now:date+'T10:00:00+09:00'});bucket.fail=true;const pruned=await pruneHistory(pd(store),{target:date,verifiedDays:previous,r2Enabled:true,bucket});assert.equal(pruned.deleted,0);assert.equal((await store.prepare('SELECT COUNT(*) AS n FROM history_5m').first()).n,1);}finally{store.close();}
});
test('replay serialization strips arbitrary credential fields from shared inputs and quotes',async()=>{
 const db=new SQLiteD1();try{const {input}=engineInput({date,asOf:date+'T10:00:59+09:00',rows:[row()],calendar:{verified:true,tradingDays:[...days(20),date]},entity:{type:'STOCK',id:'005930'}});input.appkey='private-key-sentinel';input.quotes[0].access_token='private-token-sentinel';const {entity,...shared}=input,score=calculateLeadership(input,'INTRADAY');await saveReplay(pd(db),{shared,entities:[entity],scores:[score],mode:'INTRADAY',version:score.methodologyVersion});const restored=await loadReplay(pd(db),{date,asOf:input.asOf,mode:'INTRADAY',version:score.methodologyVersion});assert.doesNotMatch(JSON.stringify(restored),/private-|access_token|appkey/);}finally{db.close();}
});

test('provider end-of-range with missing slots is terminal PARTIAL and does not silently retry forever',async()=>{
 const db=new SQLiteD1();let calls=0;try{const d=days(20)[0],contractHash='fixture-incomplete';await planBackfill(pd(db),{symbols:['005930'],dates:[d],slots:['1000'],contractHash,tr:'t8412'});const job=await db.prepare('SELECT id FROM backfill_jobs').first();const options={jobId:job.id,now:'2026-10-20T01:00:00.000Z',approval:{approved:true,contractHash,expiresAt:'2026-10-21T00:00:00Z',symbols:['005930'],jobIds:[job.id],tr:'t8412',maxPages:5},contract:{verified:true,hash:contractHash,tr:'t8412',krxOnly:true,cumulativeFromSessionOpen:true,maxRequestsPerSecond:1,documentationURL:'fixture://contract'},adapter:{async page(){calls++;return {rows:[],cursor:'',done:true};}}};const result=await backfillStep(pd(db),options);assert.equal(result.done,false);assert.equal(result.error,'GAPS_REMAIN');assert.equal((await db.prepare('SELECT status FROM backfill_jobs').first()).status,'PARTIAL');await backfillStep(pd(db),options);assert.equal(calls,1);}finally{db.close();}
});

test('backfill refuses a symbol outside the latest collected snapshot',async()=>{
 const db=new SQLiteD1();try{await planBackfill(pd(db),{symbols:['005930'],dates:days(20).slice(0,1),slots:['1000'],contractHash:'fixture',tr:'t8412'});await assert.rejects(planCollected(pd(db),{symbols:['000660'],dates:days(20).slice(0,1),slots:['1000'],contractHash:'fixture',tr:'t8412'}),/NOT_IN_COLLECTED/);}finally{db.close();}
});
