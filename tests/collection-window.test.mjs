import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectWindow,collectionFetch,LSFailure,accessToken} from '../worker/ls.mjs';
import {collect,CollectorAlarm} from '../worker/index.mjs';
import {collectDetails,indexSeries,naverMarket} from '../worker/details.mjs';
test('KRX window is weekday 09:00 through the 15:30 closing minute, never 15:31 or 16:00',()=>{
 for(const [kst,expected] of [['08:59:59',false],['09:00:00',true],['15:29:59',true],['15:30:00',true],['15:30:59',true],['15:31:00',false],['16:00:00',false]])assert.equal(collectWindow(new Date('2026-10-20T'+kst+'+09:00')),expected,kst);
 assert.equal(collectWindow(new Date('2026-10-24T12:00:00+09:00')),false);
});
test('cutoff blocks a new upstream request and rejects a response crossing the deadline',async()=>{
 let requests=0,current=new Date('2026-10-20T15:31:00+09:00');
 const fetcher=collectionFetch(async()=>{requests++;return Response.json({ok:true});},()=>current);
 await assert.rejects(fetcher('https://upstream.test'),e=>e instanceof LSFailure&&e.code==='COLLECTION_WINDOW_CLOSED');assert.equal(requests,0);
 current=new Date('2026-10-20T15:30:50+09:00');
 const crossing=collectionFetch(async()=>{requests++;current=new Date('2026-10-20T15:31:00+09:00');return Response.json({ok:true});},()=>current);
 await assert.rejects(crossing('https://upstream.test'),e=>e.code==='COLLECTION_WINDOW_CLOSED');assert.equal(requests,1);
 await assert.rejects(accessToken({LS_APP_KEY:'test',LS_APP_SECRET:'test'},fetcher,Date.now(),false),e=>e.code==='COLLECTION_WINDOW_CLOSED');assert.equal(requests,1);
});
test('both collectors and durable alarms remain idle after close, including partial enrichment',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-20T15:31:00+09:00')});
 let calls=0;const env={LS_APP_KEY:'test',LS_APP_SECRET:'test',DASHBOARD_TOKEN:'x'.repeat(40),DB:{prepare(){calls++;throw Error('must not touch collector storage after close');}}};
 await collect(env);await collectDetails(env);assert.equal(calls,0);
 await assert.rejects(naverMarket('/upjong/list',async()=>{calls++;throw Error('upstream must stay idle');}),e=>e.code==='COLLECTION_WINDOW_CLOSED');assert.equal(calls,0);
 const alarm=new CollectorAlarm({storage:{getAlarm(){calls++;},setAlarm(){calls++;}}},env);
 const r=await alarm.fetch(new Request('https://collector.internal/wake',{method:'POST'}));assert.equal(r.status,204);
 await alarm.alarm();assert.equal(calls,0);
});
test('intraday index charts discard post-15:30 bars',()=>{
 assert.deepEqual(indexSeries([{date:'20261020',time:'153000',close:100},{date:'20261020',time:'153500',close:200}],'2026-10-20'),[{time:'153000',value:100}]);
});
