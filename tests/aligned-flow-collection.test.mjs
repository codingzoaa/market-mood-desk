import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flowBucket,flowBucketNeeded} from '../worker/details.mjs';
import {sourceTime,verifiedFlowScale,historicalFlowPoints} from '../worker/intraday-recovery.mjs';
test('wall-clock buckets do not inherit a previous request 300-second cooldown',()=>{
 const old={checkedAt:'2026-11-06T09:04:59+09:00',flowHistory:[{time:'0900'}]};
 assert.deepEqual(flowBucket(new Date('2026-11-06T09:05:00+09:00')),{date:'2026-11-06',time:'0905'});
 assert.equal(flowBucketNeeded(old,flowBucket(new Date('2026-11-06T09:05:00+09:00'))),true);
 assert.equal(flowBucketNeeded(old,flowBucket(new Date('2026-11-06T09:04:59+09:00'))),false);
 assert.equal(flowBucket(new Date('2026-11-06T08:59:59+09:00')),null);assert.equal(flowBucket(new Date('2026-11-06T16:11:00+09:00')),null);
 assert.equal(flowBucket(new Date('2026-11-07T09:05:00+09:00')),null);
});
test('currency scale is established with both contemporaneous investor totals',()=>{
 const ref={individual:2000,foreign:-9000};assert.equal(verifiedFlowScale({svolume_08:200000,svolume_17:-900000},ref),.01);
 assert.equal(verifiedFlowScale({svolume_08:2000,svolume_17:-9000},ref),1);
 assert.throws(()=>verifiedFlowScale({svolume_08:0,svolume_17:0},{individual:0,foreign:0}),/UNVERIFIED/);
 assert.throws(()=>verifiedFlowScale({svolume_08:2000,svolume_17:9000},ref),/UNVERIFIED/);
});
function source(){const rows=[{time:'09050000',sv_08:10000,sv_17:-20000},{time:'09100000',sv_08:20000,sv_17:-40000}];return {date:'2026-11-06',observedAt:'2026-11-06T09:12:00+09:00',flows:Object.fromEntries(['KOSPI','KOSDAQ'].map(b=>[b,{rows,scale:.01,header:{svolume_08:20000,svolume_17:-40000}}])),indices:Object.fromEntries(['KOSPI','KOSDAQ'].map(b=>[b,{quote:{value:990,change:-10},series:[{time:'090500',value:995},{time:'091000',value:990}]}]))};}
test('backfill joins exact same-date market timestamps, keeps live observations, and never interpolates',()=>{
 const s=source(),p=historicalFlowPoints(s);assert.equal(p.length,2);assert.equal(p[0].markets.KOSPI.individual,100);assert.ok(Math.abs(p[0].markets.KOSPI.changePct+.5)<1e-9);assert.ok(p[0].source.includes('t1602'));
 const existing={...p[0],markets:{KOSPI:{individual:123,foreign:4,changePct:5},KOSDAQ:{individual:2,foreign:3,changePct:4}}};assert.equal(historicalFlowPoints({...s,previous:[existing]})[0].markets.KOSPI.individual,123);
 s.indices.KOSDAQ.series=s.indices.KOSDAQ.series.slice(1);assert.equal(historicalFlowPoints(s).length,1);
 assert.equal(sourceTime('09103000'),'091030');assert.throws(()=>sourceTime('09600000'));
});
test('backfill rejects incremental quantities, unknown units, duplicate timestamps and future observations',()=>{
 const s=source();s.flows.KOSPI.rows=s.flows.KOSPI.rows.map(r=>({...r,sv_08:0}));assert.throws(()=>historicalFlowPoints(s),/NOT_CUMULATIVE/);
 const d=source();d.flows.KOSPI.rows=[...d.flows.KOSPI.rows,d.flows.KOSPI.rows[1]];assert.throws(()=>historicalFlowPoints(d),/DUPLICATE/);
 const f=source();f.observedAt='2026-11-06T09:06:00+09:00';assert.equal(historicalFlowPoints(f).length,1);
});

test('atomic D1 history writes preserve recovered slots and newer live samples in either order',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const {readFileSync}=await import('node:fs');
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE state(id TEXT PRIMARY KEY,payload TEXT)');
 const core=readFileSync('worker/details.mjs','utf8').match(/env.DB.prepare\(`(INSERT INTO state\(id,payload\) VALUES\(\?,\?\) ON CONFLICT[\s\S]*?)`\)/)[1];
 const recovery=readFileSync('worker/intraday-recovery.mjs','utf8').match(/env.DB.prepare\(`(UPDATE state SET payload=json_set\(payload,'\$\.flowHistory'[\s\S]*?)`\)/)[1];
 for(const order of ['core-first','recovery-first']){
  db.exec('DELETE FROM state');const initial={flowHistory:[{time:'0900',v:1}],indices:{KOSPI:{series:[1]},KOSDAQ:{series:[2]}},errors:{flows:'OLD'},heatmap:{kept:true}};
  db.prepare('INSERT INTO state VALUES(?,?)').run('details:test',JSON.stringify(initial));
  const writeCore=()=>{const sample=JSON.stringify([{time:'0910',v:3}]);db.prepare(core).run('details:test','{}',JSON.stringify({indices:{KOSPI:{value:123}},errors:{flows:null}}),sample,sample);};
  const writeRecovery=()=>db.prepare(recovery).run(JSON.stringify([{time:'0900',v:99},{time:'0905',v:2}]),JSON.stringify({status:'COMPLETE'}),'details:test');
  if(order==='core-first'){writeCore();writeRecovery();}else{writeRecovery();writeCore();}
  const result=JSON.parse(db.prepare('SELECT payload FROM state').get().payload);
  assert.deepEqual(result.flowHistory,[{time:'0900',v:1},{time:'0905',v:2},{time:'0910',v:3}]);assert.equal(result.heatmap.kept,true);assert.deepEqual(result.indices.KOSPI.series,[1]);assert.equal(result.errors.flows,undefined);
 }db.close();
});

test('durable sampler schedules the next absolute 5-minute boundary, not five minutes after completion',async t=>{
 const {CollectorAlarm}=await import('../worker/index.mjs');
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-06T09:04:40+09:00')});
 const alarms=[];const coordinator=new CollectorAlarm({storage:{setAlarm:async time=>alarms.push(time),getAlarm:async()=>alarms.at(-1)||null}},{});
 await coordinator.alarm();assert.equal(alarms[0],Date.parse('2026-11-06T09:05:00+09:00'));
});
