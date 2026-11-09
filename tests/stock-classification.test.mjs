import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachStockSectors} from '../worker/stock-registry.mjs';
import worker from '../worker/index.mjs';
const quote=(symbol,market='KOSPI',themes=[])=>({symbol,market,name:symbol,price:1000,changePct:5,turnoverKRW:123456789,themes});
const snapshot=stocks=>({date:'2026-11-09',asOf:'2026-11-09T07:05:23.609Z',source:'LS증권 KRX',stocks,etfs:[],metrics:{kospi:5000},note:'keep note'});
test('missing sectors use the curated map without modifying prices, timestamps or source records',()=>{
 const original=snapshot([quote('036930','KOSDAQ'),quote('222800','KOSDAQ'),quote('180640'),quote('003010'),quote('267850')]);
 const result=attachStockSectors(original);
 assert.deepEqual(result.stocks.map(x=>x.themes),[['반도체'],['반도체'],['운송'],['기계'],['IT서비스']]);
 assert.deepEqual(result.stocks.map(({themes,...rest})=>rest),original.stocks.map(({themes,...rest})=>rest));
 assert.equal(result.asOf,original.asOf);assert.equal(result.note,original.note);
 assert.ok(original.stocks.every(x=>x.themes.length===0));
 assert.deepEqual(attachStockSectors(result),result);
});
test('pending, unreviewed and mismatched registry entries remain unclassified; curated classifications win',()=>{
 const registry={entries:[
  {...quote('005930'),sector:'잘못된 분류',reviewRequired:false},
  {...quote('123450'),sector:'분류 대기',reviewRequired:false},
  {...quote('123451'),sector:'검토 중',reviewRequired:false},
  {...quote('123452'),sector:'운송',reviewRequired:true},
  {...quote('123453','KOSDAQ'),sector:'운송',reviewRequired:false},
  {...quote('123454'),sector:'운송',reviewRequired:false}
 ]};
 const result=attachStockSectors(snapshot(['005930','123450','123451','123452','123453','123454'].map(code=>quote(code))),registry);
 assert.deepEqual(result.stocks.map(x=>x.themes),[['반도체'],[],[],[],[],['운송']]);
});
test('existing historical themes and fund records are preserved',()=>{
 const original=snapshot([quote('005930','KOSPI',['기존 LS 테마']),{...quote('069500'),name:'KODEX 200'},quote('999999')]);
 assert.deepEqual(attachStockSectors(original).stocks.map(x=>x.themes),[['기존 LS 테마'],[],[]]);
});
test('dashboard restores stored empty themes on read without upstream collection or any data write',async()=>{
 const original=snapshot([quote('036930','KOSDAQ'),quote('123454')]),payload=JSON.stringify(original);
 const env={LS_APP_KEY:'test',LS_APP_SECRET:'test',DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return sql.includes('WHERE id=?')&&args[0]==='stock-map:registry'?{payload:JSON.stringify({entries:[{...quote('123454'),sector:'운송',reviewRequired:false}]})}:null},async all(){return {results:[{payload}]}},async run(){throw Error('read endpoint must not write')}}}}};
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not fetch upstream')};
 try{const response=await worker.fetch(new Request('https://worker.test/api/dashboard?date=2026-11-09'),env,{});assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.snapshots[0].stocks.map(x=>x.themes),[['반도체'],['운송']]);assert.deepEqual(data.snapshots[0].stocks.map(({themes,...rest})=>rest),original.stocks.map(({themes,...rest})=>rest));assert.equal(JSON.stringify(original),payload);}finally{globalThis.fetch=previous;}
});
