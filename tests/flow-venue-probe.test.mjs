import test from 'node:test';
import assert from 'node:assert/strict';
import {spotFromT1601,reconcileVenues} from '../worker/flow-venue-probe.mjs';
import {formatClose} from '../worker/telegram-delivery.mjs';
const party=(a,b,c)=>({individual:a,foreign:b,institution:c});
const k={KOSPI:party(-100,50,50),KOSDAQ:party(-40,20,20)};
const n={KOSPI:party(-20,10,10),KOSDAQ:party(15,-10,-5)};
const u={KOSPI:party(-120,60,60),KOSDAQ:party(-25,10,15)};
test('t1601 blocks 1 and 2 represent spot-only venues',()=>{
 const data={t1601OutBlock1:{svolume_08:'-120',svolume_17:'60',svolume_18:'60'},t1601OutBlock2:{svolume_08:'-25',svolume_17:'10',svolume_18:'15'}};
 assert.deepEqual(spotFromT1601(data),u);
 assert.throws(()=>spotFromT1601({}),/MISSING_SPOT_KOSPI/);
});
test('integrated K+N=U reconciliation verifies spot investors without futures double-count',()=>{
 const out=reconcileVenues(k,n,u);
 assert.equal(out.scope,'KRX+NXT');
 assert.deepEqual(out.segments,u);
 assert.deepEqual(out.components.NXT,n);
 assert.throws(()=>reconcileVenues(k,n,{...u,KOSPI:party(-1,60,60)}),/INTEGRATED_RECONCILIATION_FAILED/);
 assert.throws(()=>reconcileVenues(k,{KOSPI:party(0,0,0),KOSDAQ:party(0,0,0)},k),/NXT_DISTINCT_FLOW_NOT_OBSERVED/);
});
test('telegram close selects verified integrated spot flows, but keeps KRX futures',()=>{
 const date='2026-11-10',asOf='2026-11-10T06:40:00Z';
 const markets=Object.fromEntries(['KOSPI','KOSDAQ'].map(m=>[m,{value:5000,changePct:1,advances:800,unchanged:30,declines:400,asOf}]));
 const segments={KOSPI:{...k.KOSPI},KOSDAQ:{...k.KOSDAQ},FUTURES:party(80,-80,0),CALL:party(1,2,3),PUT:party(1,2,3)};
 const d={date,indices:markets,flows:{unit:'억원',asOf,segments},errors:{}};
 const integrated={...reconcileVenues(k,n,u),date,asOf};
 const out=formatClose(date,d,integrated);
 assert.match(out,/KRX\+NXT 통합/);
 assert.match(out,/외국인 현물 70억 \(KRX\+NXT\)/);
 assert.match(out,/KOSPI 5,000/);
 assert.match(out,/FUTURES 개인 80 \/ 외국인 -80/);
 const fallback=formatClose(date,d,{...integrated,status:'unverified'});
 assert.match(fallback,/현물: LS KRX 전용/);
 assert.match(fallback,/외국인 현물 70억 \(KRX\)/);
});
