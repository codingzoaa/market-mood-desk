import test from 'node:test';
import assert from 'node:assert/strict';
import {pensionDailyFeed} from '../worker/pension-signal.mjs';
import {rawFlows} from '../worker/details.mjs';
import worker from '../worker/index.mjs';

const asOf='2026-11-02T07:02:00.000Z'; // 16:02 KST
function fixture(amount=8930){
 return {date:'2026-11-02',indices:{KOSPI:{value:5730.74,asOf}},
  flows:{asOf,unit:'억원',source:'LS증권 KRX · t1601 금액 순매수',segments:{KOSPI:{pension:amount}}}};
}

test('LS t1601 기금 06, not 기관계 or 국가, becomes pension (억원)',()=>{
 const block={svolume_17:-10,svolume_18:110,svolume_08:-100,svolume_01:0,svolume_06:120,svolume_11:90};
 const data=Object.fromEntries(Array.from({length:5},(_,i)=>['t1601OutBlock'+(i+1),block]));
 assert.equal(rawFlows(data).KOSPI.pension,120);
 assert.notEqual(rawFlows(data).KOSPI.pension,210); // 국가 11 excluded
});

test('LS post-close snapshot gives rounded 십억원 and verified date',()=>{
 const out=pensionDailyFeed(fixture());
 assert.equal(out.date,'2026-11-02');
 assert.equal(out.kospiClose,5730.74);
 assert.equal(out.pensionNetBuyBillion,893);
 assert.equal(out.regularSessionClosed,true);
 assert.equal(out.pensionUnit,'십억원');
});

test('missing, intraday, mismatched, or non-LS pension feeds are withheld',()=>{
 assert.equal(pensionDailyFeed({...fixture(),flows:{...fixture().flows,asOf:'2026-11-02T06:40:00Z'}}),null);
 assert.equal(pensionDailyFeed({...fixture(),indices:{KOSPI:{value:5730.74,asOf:'2026-10-30T07:02:00Z'}}}),null);
 assert.equal(pensionDailyFeed({...fixture(),flows:{...fixture().flows,unit:'백만원'}}),null);
 assert.equal(pensionDailyFeed({...fixture(),flows:{...fixture().flows,segments:{KOSPI:{institution:8930}}}}),null);
 assert.equal(pensionDailyFeed({...fixture(),flows:{...fixture().flows,source:'MANUAL'}}),null);
});

test('read-only public endpoint returns LS day without LS secrets',async()=>{
 const env={LS_APP_KEY:'secret-key',LS_APP_SECRET:'secret-value',DB:{prepare(sql){
  return {async first(){
   if(sql.includes("id='sync'"))return null;
   if(sql.includes("id LIKE 'details:%'"))return {payload:JSON.stringify(fixture())};
   throw Error('unexpected storage statement');
  }};
 }}};
 const response=await worker.fetch(new Request('https://worker.test/api/pension-kospi-daily'),env,{});
 assert.equal(response.status,200);
 const json=await response.json();
 assert.equal(json.pensionNetBuyBillion,893);
 assert.doesNotMatch(JSON.stringify(json),/secret-key|secret-value/);
});
