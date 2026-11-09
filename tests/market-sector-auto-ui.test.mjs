import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';


test('Today’s Market precedes the 5-minute index and flow chart in the Korean tab',()=>{
 const contents=readFileSync('src/market-panels.tsx','utf8');
 const a=contents.indexOf('<div className="today-flow-card">');
 const b=contents.indexOf('<button className="today-card"',a);
 const c=contents.indexOf('<FlowChart details={details}/>',a);
 assert.ok(a>=0&&b>a&&c>b);
});
test('An LS snapshot cannot replace an independently verified editorial calendar review',async()=>{
 await build({entryPoints:['src/close-calendar.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/close-calendar-dynamic.mjs',packages:'external',jsx:'automatic'});
 const {default:Calendar}=await import('../work/close-calendar-dynamic.mjs');
 await build({entryPoints:['src/close-reviews.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/close-review-dynamic.mjs'});
 const {closeReviews}=await import('../work/close-review-dynamic.mjs');
 const latest=closeReviews.at(-1);
 const dom=new JSDOM('<main id="root"></main>');
 for(const k of ['window','document','HTMLElement','MouseEvent'])globalThis[k]=dom.window[k];
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),{createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('root'));
 const date='2026-11-05';
 const snap={date,asOf:'2026-11-05T06:45:00Z',source:'LS증권 KRX · 검증된 시세',note:'',metrics:{},stocks:[{symbol:'005930',name:'삼성전자',market:'KOSPI',themes:['메모리 반도체'],price:110000,changePct:6,turnoverKRW:1000000000000}]};
 try{
  await React.act(async()=>root.render(React.createElement(Calendar,{snapshots:[snap]})));
  assert.match(document.querySelector('.close-review h2').textContent,new RegExp(latest.date));
  assert.ok(document.querySelectorAll('.close-sector').length>=1);
  assert.doesNotMatch(document.querySelector('.close-review').textContent,/LS 자동 집계/);
 }finally{await React.act(async()=>root.unmount());}
});
