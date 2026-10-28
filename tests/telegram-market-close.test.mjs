import test from 'node:test';
import assert from 'node:assert/strict';
import {render} from '../scripts/telegram-market-close.mjs';
const date='2026-10-28',time='2026-10-28T06:30:00Z';
const v={date,indices:{KOSPI:{value:6012.44,changePct:6.63,advances:582,unchanged:70,declines:290,asOf:time},KOSDAQ:{value:771.28,changePct:3.69,advances:1133,unchanged:158,declines:526,asOf:time}},flows:{unit:'억원',asOf:time,segments:Object.fromEntries(['KOSPI','KOSDAQ','FUTURES','CALL','PUT'].map(k=>[k,{individual:-100,foreign:200,institution:50}]))}};
test('formats verified data',()=>{const s=render(date,v);assert.match(s,/코스피: 개인/);assert.match(s,/ETF: 투자자별 수급 확인 불가/);assert.match(s,/상방 우위/);});
test('rejects stale date',()=>assert.throws(()=>render('2026-10-29',v),/DATE_MISMATCH/));
test('rejects before close',()=>assert.throws(()=>render(date,{...v,flows:{...v.flows,asOf:'2026-10-28T05:00:00Z'}}),/FLOW_NOT_CLOSED/));
test('rejects missing fields',()=>assert.throws(()=>render(date,{...v,flows:{...v.flows,segments:{...v.flows.segments,CALL:{individual:0,foreign:null,institution:1}}}}),/FLOW_MISSING_CALL/));
