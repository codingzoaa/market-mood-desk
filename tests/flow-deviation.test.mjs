import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personalFlowDeviation} from '../src/flow-series.ts';
const point=(time,individual,changePct=0)=>({time,asOf:'2026-11-05T09:00:00+09:00',markets:{KOSPI:{individual,foreign:0,changePct},KOSDAQ:{individual:999,foreign:0,changePct:99}}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('decline reference is positive; excess buying uses same-interval flow and true return',()=>{
 const p=personalFlowDeviation([point('0900',2000),point('0905',3000,-.1)]);
 assert.equal(p[0].deviation,null);near(p[1].actual,1000);near(p[1].indexReturn,-.1);near(p[1].reference,390);near(p[1].deviation,610);
 // Daily -5.0% to -5.1% is a 5-minute -0.10526% move, not -5.1% or -0.1%.
 const q=personalFlowDeviation([point('0900',0,-5),point('0905',100,-5.1)])[1];near(q.indexReturn,(94.9/95-1)*100);near(q.reference,-3900*q.indexReturn);
});
test('rising and unchanged indices retain the correct signed reference',()=>{
 const p=personalFlowDeviation([point('0900',0),point('0905',200,.1),point('0910',150,.1)]);
 near(p[1].reference,-390);near(p[1].deviation,590);near(p[2].reference,0);near(p[2].deviation,-50);
});
test('30-minute sum requires seven observations; zero is a valid result',()=>{
 const times=['0900','0905','0910','0915','0920','0925','0930'];
 const p=personalFlowDeviation(times.map((t,i)=>point(t,i*100)));
 assert.equal(p[5].rolling30,null);near(p[6].rolling30,600);
 assert.equal(personalFlowDeviation(times.map(t=>point(t,0)))[6].rolling30,0);
});
test('missing intervals are never bridged or converted to partial 30-minute totals',()=>{
 const p=personalFlowDeviation(['0900','0905','0915','0920','0925','0930','0935','0940','0945'].map((t,i)=>point(t,i*10)));
 assert.equal(p[2].actual,null);assert.equal(p[7].rolling30,null);near(p[8].rolling30,60);
});
test('empty, non-finite, and invalid index baselines are unavailable',()=>{
 assert.deepEqual(personalFlowDeviation([]),[]);
 for(const bad of [NaN,Infinity,-100,-101])assert.equal(personalFlowDeviation([point('0900',0,bad),point('0905',100)])[1].deviation,null);
 assert.equal(personalFlowDeviation([point('0900',0),point('0905',NaN)])[1].deviation,null);
});


test('large positive and negative differences are highlighted against preceding 30 minutes',()=>{
 const times=['0900','0905','0910','0915','0920','0925','0930','0935'];
 for(const sign of [1,-1]){
  const p=personalFlowDeviation(times.map((t,i)=>point(t,i<7?i*100:600+sign*1000)));
  assert.equal(p[6].highlightThreshold,null);assert.equal(p[7].highlightThreshold,500);assert.equal(p[7].highlighted,true);
 }
});
test('highlight threshold uses a 500억원 floor and median magnitude, excluding current and future data',()=>{
 const times=['0900','0905','0910','0915','0920','0925','0930','0935','0940'];
 let h=times.slice(0,8).map((t,i)=>point(t,i<7?i*400:3100));
 const before=personalFlowDeviation(h)[7];assert.equal(before.highlightThreshold,800);assert.equal(before.highlighted,false); // 700 vs 800
 h.push(point(times[8],99999));assert.deepEqual(personalFlowDeviation(h)[7],before);
 const low=personalFlowDeviation(times.slice(0,8).map((t,i)=>point(t,i<7?0:499)))[7];assert.equal(low.highlightThreshold,500);assert.equal(low.highlighted,false);
 const zero=personalFlowDeviation(times.slice(0,8).map(t=>point(t,0)))[7];assert.equal(zero.highlighted,false);
});
test('a missing interval suspends highlighting until six preceding intervals are complete',()=>{
 const p=personalFlowDeviation(['0900','0905','0910','0915','0920','0925','0930','0940'].map((t,i)=>point(t,i===7?10000:i*100)));
 assert.equal(p.at(-1).highlightThreshold,null);assert.equal(p.at(-1).highlighted,false);
});
