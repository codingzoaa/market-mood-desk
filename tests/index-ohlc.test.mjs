import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{closingPoints} from '../worker/index.mjs';
import {validOHLC,lsIndexOHLC,archivedIndexCandles,attachIndexCandles} from '../worker/index-ohlc.mjs';
const now=new Date('2026-10-20T12:00:00Z');
const ohlc={open:100,high:110,low:95,close:105};
const archive=()=>({status:'DONE',capturedAt:'2026-10-20T11:00:00Z',pages:[{code:'t8429',http:200,responseCode:'00000',continuation:'N',sourceHash:'sha256:'+'a'.repeat(64),input:{shcode:'001',gubun:'2'},blocks:{t8429OutBlock1:[{date:'20261019',open:'100',high:'110',low:'95',close:'105'}]}}]});
test('OHLC rejects incomplete, zero, inverted, nonfinite and different-close candles without fabricating values',()=>{
 assert.deepEqual(validOHLC(ohlc,105),ohlc);
 for(const bad of [{open:undefined},{high:104},{low:101},{close:106},{open:0},{high:Infinity}])assert.equal(validOHLC({...ohlc,...bad},105),null);
 assert.deepEqual(lsIndexOHLC({openjisu:'100',highjisu:110,lowjisu:'95',pricejisu:105}),ohlc);
 assert.equal(lsIndexOHLC({pricejisu:105}),null);
});
test('archived LS daily OHLC checks KOSPI/daily scope, continuation, provenance and close cutoff',()=>{
 assert.deepEqual(archivedIndexCandles(archive(),now)[0].ohlc,ohlc);
 for(const change of [p=>p.pages[0].input.shcode='301',p=>p.pages[0].input.gubun='1',p=>p.pages[0].continuation='Y',p=>p.pages[0].sourceHash='',p=>p.capturedAt='2026-10-19T06:29:00Z',p=>p.pages[0].blocks.t8429OutBlock1[0].high=104]){const p=archive();change(p);assert.deepEqual(archivedIndexCandles(p,now),[]);}
});
test('joining uses date and exact close, preserves live flow and never overwrites live OHLC',()=>{
 const point={date:'2026-10-19',kospi:105,individual:-123,changePct:1};
 const candles=archivedIndexCandles(archive(),now),joined=attachIndexCandles([point],candles)[0];
 assert.deepEqual(joined.ohlc,ohlc);assert.equal(joined.individual,-123);
 assert.equal(attachIndexCandles([{...point,kospi:106}],candles)[0].ohlc,undefined);
 assert.equal(attachIndexCandles([{...point,date:'2026-10-16'}],candles)[0].ohlc,undefined);
 const live={...point,ohlc:{...ohlc,open:101}};assert.equal(attachIndexCandles([live],candles)[0],live);
});
test('regular close collection carries validated daily OHLC but intraday rows cannot leak into the chart',()=>{
 const row={date:'2026-10-19',kospi:105,changePct:1,individual:-123,ohlc,indexAt:'2026-10-19T06:35:00Z',flowAt:'2026-10-19T06:35:00Z'};
 assert.deepEqual(closingPoints([row],now)[0].ohlc,ohlc);
 assert.deepEqual(closingPoints([{...row,indexAt:'2026-10-19T06:25:00Z'}],now),[]);
});
test('correlation API attaches already archived candles read-only with no provider call',async()=>{
 const point={date:'2026-10-19',kospi:105,changePct:1,individual:-123,indexAt:'2026-10-19T06:35:00Z',flowAt:'2026-10-19T06:35:00Z'};
 const sql=[];const env={LS_APP_KEY:'unit-test',LS_APP_SECRET:'unit-test',DB:{prepare(query){sql.push(query);return {async first(){return null;},async all(){return {results:query.includes('backfill-probe')?[{payload:JSON.stringify(archive())}]:query.includes('correlation-history')?[]:[point]};}};}}};
 const response=await worker.fetch(new Request('https://example.test/api/correlation'),env,{});
 assert.equal(response.status,200);assert.deepEqual((await response.json()).points[0].ohlc,ohlc);
 assert.ok(sql.every(q=>q.startsWith('SELECT')));
});
