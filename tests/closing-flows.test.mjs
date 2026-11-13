import {test} from 'node:test';
import assert from 'node:assert/strict';
import {closingFlowWindow,collectClosingFlows} from '../worker/closing-flows.mjs';
import {collectionFetch,collectWindow} from '../worker/ls.mjs';
const at=t=>new Date('2026-11-13T'+t+'+09:00');
test('closing flows have their own final minute and reject late responses',async()=>{
 for(const [t,yes] of [['16:10:00',false],['16:14:59',false],['16:15:00',true],['16:15:59',true],['16:16:00',false]])assert.equal(closingFlowWindow(at(t)),yes);
 assert.equal(closingFlowWindow(new Date('2026-11-14T16:15:00+09:00')),false);
 assert.equal(collectWindow(at('16:15:00')),false);
 let now=at('16:15:02');
 const get=collectionFetch(async()=>Response.json({ok:true}),()=>now,'1615');
 assert.equal((await get('https://test')).status,200);
 now=at('16:16:00');await assert.rejects(get('https://test'),{code:'COLLECTION_WINDOW_CLOSED'});
 now=at('16:15:59');const crossing=collectionFetch(async()=>{now=at('16:16:00');return Response.json({});},()=>now,'1615');
 await assert.rejects(crossing('https://test'),{code:'COLLECTION_WINDOW_CLOSED'});
});
test('16:15 sample updates investor flows and index together with an actual timestamp',async()=>{
 const writes=[],requests=[];let closed=false;
 const env={LS_APP_KEY:'test',LS_APP_SECRET:'test',DB:{prepare(sql){let args;return {bind(...v){args=v;return this;},async first(){if(sql.startsWith('SELECT'))return {payload:JSON.stringify({date:'2026-11-13',flows:{asOf:at('16:10:00').toISOString()}})};return {id:'lease'};},async run(){writes.push({sql,args});}};}}};
 const openSession=async()=>({close:async()=>{closed=true;},fetch:async(url,options)=>{
 requests.push(options.headers?.tr_cd||'auth');
 if(url.endsWith('/token'))return Response.json({access_token:'test',expires_in:3600});
 if(options.headers.tr_cd==='t8410')return Response.json({rsp_cd:'00000',t8410OutBlock1:[{date:'20261113'}]});
 if(options.headers.tr_cd==='t1511')return Response.json({rsp_cd:'00000',t1511OutBlock:{pricejisu:5000,diffjisu:1,change:50,sign:'2',highjo:400,unchgjo:20,lowjo:300}});
 const blocks=Object.fromEntries([1,2,3,4,5].map(i=>['t1601OutBlock'+i,{svolume_17:1,svolume_18:2,svolume_08:-3,svolume_01:4}]));
 return Response.json({rsp_cd:'00000',...blocks});
 }});
 await collectClosingFlows(env,{clock:()=>at('16:15:04'),openSession});
 assert.deepEqual(requests,['auth','t8410','t1601','t1511','t1511']);assert.equal(closed,true);
 const update=writes.find(w=>w.sql.startsWith('UPDATE state SET payload=json_patch'));
 assert.ok(update);const patch=JSON.parse(update.args[0]),flow=patch.flows;assert.equal(flow.asOf,at('16:15:04').toISOString());assert.equal(flow.segments.PUT.individual,-3);
 assert.equal(patch.flowHistory.at(-1).time,'1615');assert.equal(patch.indices.KOSPI.value,5000);
});
