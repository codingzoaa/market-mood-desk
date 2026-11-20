import test from 'node:test';
import assert from 'node:assert/strict';
import {previousTradeDate,mergeProgramObservations} from '../worker/previous-intraday-recovery.mjs';
import {validateDetails,demoMarketDetails} from '../src/market-details.ts';
import {flowSeries,personalFlowDeviation} from '../src/flow-series.ts';
import {demoSnapshots} from '../src/market.ts';
test('previous intraday TRs are bound to verified trading dates, including weekends and holidays',()=>{
 assert.equal(previousTradeDate([{date:'20261120'},{date:'20261119'}],'2026-11-20'),'2026-11-19');
 assert.equal(previousTradeDate([{date:'20261120'},{date:'20261123'}],'2026-11-23'),'2026-11-20');
 assert.throws(()=>previousTradeDate([{date:'20261118'},{date:'20261119'}],'2026-11-20'),/UNVERIFIED/);
 assert.throws(()=>previousTradeDate([{date:'20261120'}],'2026-11-20'),/UNVERIFIED/);
});
test('previous program recovery fills missing slots without replacing observed net buys',()=>{
 const old=[{time:'0905',netBuy:10,changePct:null}];
 const added=[{time:'0905',netBuy:99,changePct:1,indexSourceTime:'090500'},{time:'0910',netBuy:20,changePct:null}];
 const result=mergeProgramObservations(old,added);
 assert.equal(result[0].netBuy,10);assert.equal(result[0].changePct,1);assert.equal(result[1].netBuy,20);
 assert.deepEqual(mergeProgramObservations(result,added),result);
});
test('missing index values retain real investor totals and their five-minute deltas, while slope analysis remains unavailable',()=>{
 const date='2026-11-18',raw=demoMarketDetails(demoSnapshots(date).at(-1));
 raw.flowHistory=['0905','0910'].map((time,i)=>({time,asOf:date+'T'+time.slice(0,2)+':'+time.slice(2)+':00+09:00',markets:Object.fromEntries(['KOSPI','KOSDAQ'].map(b=>[b,{individual:100+i*20,foreign:-80-i*10,institution:-20-i*10,changePct:i===0?1:null}]))}));
 const h=validateDetails(raw,date).flowHistory;
 assert.equal(h.length,2);assert.equal(flowSeries(h,'KOSPI',true)[1].individual,20);assert.equal(flowSeries(h,'KOSPI',true)[1].changePct,null);
 assert.equal(personalFlowDeviation(h)[1].deviation,null);
});
