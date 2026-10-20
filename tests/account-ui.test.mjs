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
