import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
await build({entryPoints:['src/account/main.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/account-ui-test.mjs',packages:'external',jsx:'automatic'});
const {default:Account}=await import('../work/account-ui-test.mjs');
test('private dashboard renders known PnL, date drilldown and pending LS status without persisting account data',async()=>{
 const keys=['window','document','HTMLElement','Event','MouseEvent','localStorage','IS_REACT_ACT_ENVIRONMENT'],previous=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const dom=new JSDOM('<div id="test-account"></div>',{url:'https://private.test/'});
 for(const k of ['window','document','HTMLElement','Event','MouseEvent','localStorage'])globalThis[k]=dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const original=globalThis.fetch;let requested=[];const payload={summary:{tradeCount:2,from:'2026-10-19',to:'2026-10-20',realizedKRW:725,feesKRW:40,buyKRW:3020,sellKRW:1500,winRate:100,complete:true,unknownSells:0,holdings:[],daily:[{date:'2026-10-19',realizedKRW:0},{date:'2026-10-20',realizedKRW:725}]},recentTrades:[],matchedTrades:0,sync:{enabled:false,contractReady:false}};
 globalThis.fetch=async(url,options)=>{requested.push(String(url));assert.equal(options.cache,'no-store');return Response.json(payload);};
 const root=createRoot(document.getElementById('test-account'));
 try{await act(async()=>root.render(React.createElement(Account)));assert.match(document.body.textContent,/누적 실현손익/);assert.match(document.body.textContent,/725/);assert.match(document.body.textContent,/조회 규격 확인/);const point=document.querySelector('[aria-label="2026-10-20 거래 보기"]');assert.ok(point);await act(async()=>point.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.ok(requested.includes('/api/account?date=2026-10-20'));assert.match(document.body.textContent,/2026-10-20의 거래/);assert.equal(localStorage.length,0);assert.ok(document.querySelector('a[href="/cdn-cgi/access/logout"]'));}finally{await act(async()=>root.unmount());globalThis.fetch=original;for(const [k,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}dom.window.close();}
});
test('unclassified real-ledger mode shows withheld PnL and raw review records instead of fabricated zero profit',async()=>{
 const keys=['window','document','HTMLElement','Event','MouseEvent','localStorage','IS_REACT_ACT_ENVIRONMENT'],previous=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),original=globalThis.fetch;
 const dom=new JSDOM('<div id="ledger-test"></div>',{url:'https://private.test/'});for(const k of keys.filter(k=>k!=='IS_REACT_ACT_ENVIRONMENT'))globalThis[k]=dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const root=createRoot(document.getElementById('ledger-test'));
 globalThis.fetch=async()=>Response.json({summary:{tradeCount:0,from:'2026-10-20',to:'2026-10-20',realizedKRW:null,feesKRW:null,buyKRW:null,sellKRW:null,winRate:null,complete:false,unknownSells:0,holdings:[],daily:[]},recentTrades:[],matchedTrades:0,ledgerStatus:{mode:'LEDGER',records:1,blockedRecords:1,analysisBlocked:true,reviewGroups:[{type:'fixture-type',summaryCode:'0001',summary:'fixture-summary',cancellation:'',currency:'KRW'}]},ledgerRecords:[{date:'2026-10-20',name:'합성 원장 종목',type:'fixture-type',summary:'fixture-summary',status:'REVIEW_REQUIRED'}],sync:{enabled:false,contractReady:true}});
 try{await act(async()=>root.render(React.createElement(Account)));assert.match(document.querySelector('.balance').textContent,/—/);assert.match(document.body.textContent,/계좌 손익 계산을 보류/);assert.match(document.body.textContent,/합성 원장 종목/);assert.match(document.body.textContent,/검토 대기/);assert.match(document.body.textContent,/분류 검토 항목/);assert.equal(localStorage.length,0);}finally{await act(async()=>root.unmount());globalThis.fetch=original;for(const [k,d] of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}dom.window.close();}
});
