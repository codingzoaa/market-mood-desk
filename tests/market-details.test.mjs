import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDetails,tileLayout,demoMarketDetails,heatColor} from '../src/market-details.ts';
import {dayKey,shiftDay,demoSnapshots,validateSnapshot} from '../src/market.ts';
import {indexQuote,indexSeries,rawFlows,heatStock,collectHeatmap} from '../worker/details.mjs';
const date=shiftDay(dayKey(),-1),snapshot=demoSnapshots(date).at(-1),valid=demoMarketDetails(snapshot);
test('new market fields survive validation; dates, units and duplicate symbols are rejected',()=>{
 const checked=validateSnapshot({...snapshot,details:valid});assert.equal(checked.details.flows.unit,'억원');assert.equal(checked.details.heatmap.stocks.length,snapshot.stocks.length);
 assert.throws(()=>validateDetails({...valid,date:'2020-01-01'},date));assert.throws(()=>validateDetails({...valid,flows:{...valid.flows,unit:'백만원'}},date));
 assert.throws(()=>validateDetails({...valid,heatmap:{...valid.heatmap,stocks:[valid.heatmap.stocks[0],valid.heatmap.stocks[0]]}},date));
 assert.throws(()=>validateDetails({...valid,indices:{KOSPI:{...valid.indices.KOSPI,advances:null}}},date));
});
test('treemap preserves weighted areas, stays within bounds and uses both gain and loss colors',()=>{
 const input=Array.from({length:103},(_,i)=>({id:i,value:i+1}));const total=input.reduce((s,t)=>s+t.value,0);const layout=tileLayout(input,x=>x.value);
 assert.equal(layout.length,input.length);for(const t of layout){assert.ok(t.x>=0&&t.y>=0&&t.x+t.w<=1000+1e-8&&t.y+t.h<=620+1e-8);assert.ok(Math.abs(t.w*t.h/(1000*620)-t.item.value/total)<1e-10);}
 for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){const a=layout[i],b=layout[j];assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<1e-8||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<1e-8);}
 assert.notEqual(heatColor(-3),heatColor(3));assert.notEqual(heatColor(0),heatColor(1));
});
test('LS breadth and intraday chart use source counts and current trade-day rows only',()=>{
 const q=indexQuote({pricejisu:5768.01,diffjisu:1.76,change:99.96,sign:'2',highjo:677,upjo:8,unchgjo:33,lowjo:204,downjo:2});assert.equal(q.advances,677);assert.equal(q.declines,204);
 assert.deepEqual(indexSeries([{date:'20261019',time:'100000',close:2},{date:'20261019',time:'090000',close:1},{date:'20261016',time:'100000',close:3}],'2026-10-19'),[{time:'090000',value:1},{time:'100000',value:2}]);
 assert.throws(()=>indexSeries([{date:'20261016',time:'100000',close:3}],'2026-10-19'));
 const data=Object.fromEntries(Array.from({length:5},(_,i)=>['t1601OutBlock'+(i+1),{svolume_17:-500,svolume_18:700,svolume_08:-200,svolume_01:25}]));assert.equal(rawFlows(data).PUT.foreign,-500);delete data.t1601OutBlock4;assert.throws(()=>rawFlows(data));
 assert.throws(()=>heatStock({itemcode:'005930',itemname:'삼성전자',marketSum:'',prevChangeRate:'1'},'KOSPI','반도체'));
});
test('Naver pagination must terminate, classify each market and reject duplicate quotes',async()=>{
 const store=new Map([['naver-industries',JSON.stringify({asOf:new Date().toISOString(),byCode:{'005930':{sector:'반도체',market:'KOSPI'},'247540':{sector:'전기제품',market:'KOSDAQ'}}})]]);
 const env={DB:{prepare(){return {bind(){return this;},async first(){return {payload:store.get('naver-industries')};}};}}};
 const fetcher=async path=>{const p=new URL('https://example.test'+path).searchParams;if(p.get('startIdx')!=='0')return [];return [{itemcode:p.get('marketType')==='KOSPI'?'005930':'247540',itemname:'테스트',marketSum:'100,000',prevChangeRate:'-2.1'}];};
 const result=await collectHeatmap(env,date,fetcher);assert.equal(result.stocks.length,2);assert.equal(result.stocks[0].sector,'반도체');assert.equal(result.stocks[1].market,'KOSDAQ');assert.equal(result.stocks[0].changePct,-2.1);
 await assert.rejects(collectHeatmap(env,date,async()=>[{itemcode:'005930',itemname:'테스트',marketSum:'10',prevChangeRate:'1'}]),/DUPLICATE/);
});
