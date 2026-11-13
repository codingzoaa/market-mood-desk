import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendFlowHistory} from '../worker/flow-history.mjs';
import {flowSeries} from '../src/flow-series.ts';
import {validateDetails,demoMarketDetails} from '../src/market-details.ts';
import {demoSnapshots,dayKey,shiftDay} from '../src/market.ts';
let date=shiftDay(dayKey(),-1);
while([0,6].includes(new Date(date+'T12:00:00Z').getUTCDay()))date=shiftDay(date,-1);
function details(time='09:05:12',value=100){const asOf=date+'T'+time+'+09:00';return {date,asOf,errors:{},indices:Object.fromEntries(['KOSPI','KOSDAQ'].map(b=>[b,{asOf,changePct:1}])),flows:{asOf,segments:Object.fromEntries(['KOSPI','KOSDAQ'].map(b=>[b,{individual:value,foreign:-value}]))}};}
test('history buckets deduplicate, survive failures, reject stale indices and stay in trade date',()=>{
 const first=appendFlowHistory([],details());assert.equal(first[0].time,'0905');
 const replaced=appendFlowHistory(first,details('09:07:00',120));assert.equal(replaced.length,1);assert.equal(replaced[0].markets.KOSPI.individual,120);
 const failed=details('09:10:00');failed.errors.flows='LS_ERROR';assert.deepEqual(appendFlowHistory(first,failed),first);
 const stale=details('09:10:00');stale.indices.KOSPI.asOf=date+'T09:00:00+09:00';assert.deepEqual(appendFlowHistory(first,stale),first);
 assert.equal(appendFlowHistory([],details('08:59:59')).length,0);assert.equal(appendFlowHistory([],details('16:16:00')).length,0);
});
test('5 minute changes require consecutive real observations, including after gaps',()=>{
 let history=[];for(const [time,value] of [['09:05:00',100],['09:10:00',150],['09:20:00',300]])history=appendFlowHistory(history,details(time,value));
 const delta=flowSeries(history,'KOSPI',true);assert.equal(delta[0].individual,null);assert.equal(delta[1].individual,50);assert.equal(delta[1].foreign,-50);assert.equal(delta[2].individual,null);assert.equal(delta[2].changePct,1);
 const raw=demoMarketDetails(demoSnapshots(date).at(-1));raw.flowHistory=history;assert.equal(validateDetails(raw,date).flowHistory.length,3);
 assert.throws(()=>validateDetails({...raw,flowHistory:[history[0],history[0]]},date));
 assert.throws(()=>validateDetails({...raw,flowHistory:[{...history[0],asOf:shiftDay(date,-1)+'T09:05:00+09:00'}]},date));
 assert.throws(()=>validateDetails({...raw,flowHistory:[{...history[0],markets:{KOSPI:{individual:NaN,foreign:1,changePct:1}}}]},date));
});
