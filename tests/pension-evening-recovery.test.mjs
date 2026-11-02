import test from 'node:test';
import assert from 'node:assert/strict';
import {composeRecoveredPension} from '../worker/pension-evening-recovery.mjs';
import {pensionDailyFeed} from '../worker/pension-signal.mjs';

const date='2026-11-02';
const asOf='2026-11-02T07:10:27.742Z';
const recoveryAt='2026-11-02T12:10:00Z';
const fixture=()=>({date,indices:{KOSPI:{value:5859.08,asOf}},flows:{
  asOf,unit:'억원',source:'LS증권 KRX · t1601 금액 순매수',
  segments:{KOSPI:{foreign:-100,institution:200,individual:-100,financial:0}}
}});
const recovery=()=>({date,kospiClose:5859.08,pensionNetBuyEok:1234,observedAt:recoveryAt,source:'LS증권 t1601 KOSPI 기금(06) · 정규장 이후 재조회'});

test('LS evening pension reconciliation keeps existing market details immutable',()=>{
 const original=fixture();
 const composed=composeRecoveredPension(original,recovery());
 const payload=pensionDailyFeed(composed);
 assert.equal(payload.date,date);
 assert.equal(payload.kospiClose,5859.08);
 assert.equal(payload.pensionNetBuyBillion,123.4);
 assert.equal(payload.pensionUnit,'십억원');
 assert.equal(original.flows.segments.KOSPI.pension,undefined);
 assert.equal(original.flows.asOf,asOf);
});

test('LS evening mismatch or unknown source can never publish a pension signal',()=>{
 const d=fixture(),r=recovery();
 assert.equal(composeRecoveredPension(d,{...r,date:'2026-10-30'}),null);
 assert.equal(composeRecoveredPension(d,{...r,kospiClose:5858.99}),null);
 assert.equal(composeRecoveredPension(d,{...r,source:'unverified'}),null);
 assert.equal(composeRecoveredPension(d,{...r,pensionNetBuyEok:NaN}),null);
 assert.equal(pensionDailyFeed({...d,flows:{...d.flows,segments:{KOSPI:{...d.flows.segments.KOSPI,pension:1234}},asOf:'2026-11-02T06:30:00Z'}}),null);
});
