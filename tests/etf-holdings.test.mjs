import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeHoldings,fetchHoldings} from '../worker/etf-holdings.mjs';
import {etfHoldingsPayload} from '../worker/sector-etfs.mjs';
const response=()=>({t1904OutBlock:{date:'20261021',etfnum:2},t1904OutBlock1:[{shcode:'005930',hname:'삼성전자',weight:'20.5',profitdate:'20261021'},{shcode:'000660',hname:'SK하이닉스',weight:30,profitdate:'20261021'}]});
test('holdings sort by source weight; date, identity and numeric validation fail closed',()=>{
 const result=normalizeHoldings(response(),'396500','2026-10-21T03:00:00Z');assert.equal(result.holdings[0].symbol,'000660');assert.equal(result.holdings[0].weight,30);assert.equal(result.date,'2026-10-21');assert.equal(result.complete,true);
 for(const mutate of [r=>r.t1904OutBlock1[0].weight='',r=>r.t1904OutBlock1[0].weight=200,r=>r.t1904OutBlock1[0].profitdate='20261020',r=>r.t1904OutBlock.date='20260230',r=>r.t1904OutBlock1.push(r.t1904OutBlock1[0])]){const r=response();mutate(r);assert.throws(()=>normalizeHoldings(r,'396500','2026-10-21T03:00:00Z'));}
});
test('pagination obeys continuation, bounds requests, and rejects repeated cursors',async()=>{
 let count=0;const request=async(code,body,continuation)=>{assert.equal(code,'t1904');assert.equal(body.sgb,'1');assert.equal(body.date,'20261021');assert.equal(body.exchgubun,'K');const d=response();d.t1904OutBlock1=[d.t1904OutBlock1[count]];count++;return {data:d,continuation:count===1?{flag:'Y',key:'next'}:{flag:'N',key:''}};};
 const data=await fetchHoldings(request,'396500','2026-10-21',async()=>{});assert.equal(count,2);assert.equal(data.holdings.length,2);
 await assert.rejects(fetchHoldings(async()=>({data:response(),continuation:{flag:'Y',key:'same'}}),'396500','2026-10-21',async()=>{}),/HOLDINGS_CURSOR/);
});
test('holdings endpoint helper reads saved data only and rejects unknown ETF identifiers',async()=>{
 let reads=0;const env={DB:{prepare(sql){assert.match(sql,/^SELECT/);reads++;return {bind(){return this;},async first(){return {payload:JSON.stringify({holdings:{'396500':normalizeHoldings(response(),'396500','2026-10-21T03:00:00Z')}})};}};}}};
 assert.equal((await etfHoldingsPayload(env,'396500')).status,'READY');assert.equal(reads,1);assert.equal(await etfHoldingsPayload(env,'000000'),null);assert.equal(reads,1);
});

test('source dates accept harmless formatting and empty cash dates without inventing a date',()=>{
 for(const d of ['20261021 ',20261021,'2026-10-21','2026/10/21']){const r=response();r.t1904OutBlock.date=d;r.t1904OutBlock1[0].profitdate='00000000';r.t1904OutBlock1[1].profitdate=' ';assert.equal(normalizeHoldings(r,'396500','2026-10-21T04:00:00Z').date,'2026-10-21');}
 const r=response();r.t1904OutBlock.date='';assert.throws(()=>normalizeHoldings(r,'396500','2026-10-21T04:00:00Z'));
});
