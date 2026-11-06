import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFuturesOi} from '../worker/futures-oi.mjs';

const rows=[
 {dt:'20261105153000',closeopenyak:120000,close:740},
 {dt:'20261106153000',closeopenyak:123200,close:750}
];
test('daily t2424 OI comparison requires exactly matching session and prior close',()=>{
 const o=normalizeFuturesOi({t2424OutBlock1:rows},'2026-11-06','101V6000','2026-11-06T06:30:00Z');
 assert.equal(o.openInterest,123200);
 assert.equal(o.change,3200);
 assert.equal(o.contract,'101V6000');
});
test('OI is absent if no prior close, no same-day close, or invalid futures code',()=>{
 assert.throws(()=>normalizeFuturesOi({t2424OutBlock1:rows.slice(1)},'2026-11-06','101V6000','2026-11-06T06:30:00Z'),/OI_ROWS_INVALID/);
 assert.throws(()=>normalizeFuturesOi({t2424OutBlock1:rows},'2026-11-07','101V6000','2026-11-06T06:30:00Z'),/OI_PREVIOUS_CLOSE_MISSING/);
 assert.throws(()=>normalizeFuturesOi({t2424OutBlock1:rows},'2026-11-06','BAD','2026-11-06T06:30:00Z'),/OI_CONTRACT_INVALID/);
});
