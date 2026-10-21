import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {closingPoints} from '../worker/index.mjs';
mkdirSync('work',{recursive:true});
await build({entryPoints:['src/correlation.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/correlation.js',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<div id="root"></div>',{url:'https://codingzoaa.github.io/market-mood-desk/'});
for(const key of ['window','document','HTMLElement','MouseEvent','KeyboardEvent'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{createRoot}=await import('react-dom/client'),{act}=React;
const {default:Correlation,validateClosePoints,correlationStats}=await import('../work/correlation.js');
const rows=[{date:'2026-10-16',kospi:2700,changePct:-2,individual:10000},{date:'2026-10-19',kospi:2750,changePct:0,individual:0},{date:'2026-10-20',kospi:2800,changePct:2,individual:-10000}];
test('closing points exclude intraday, mismatched-date, future and invalid flows, including enrichment-only updates',()=>{
 const row={...rows[2],indexAt:'2026-10-20T15:30:05+09:00',flowAt:'2026-10-20T15:30:25+09:00'};
 assert.deepEqual(closingPoints([row],new Date('2026-10-20T15:30:45+09:00')),[]);
 assert.deepEqual(closingPoints([row],new Date('2026-10-20T15:31:00+09:00')), [rows[2]]);
 for(const bad of [{flowAt:'2026-10-20T15:25:25+09:00'},{indexAt:'2026-10-20T15:25:05+09:00'},{flowAt:'2026-10-21T15:30:05+09:00'},{individual:null},{kospi:NaN}])assert.deepEqual(closingPoints([{...row,...bad}],new Date('2026-10-20T15:31:00+09:00')),[]);
});
test('Pearson fit and public point validation handle sparse, constant and invalid data',()=>{
 assert.equal(correlationStats(rows).r,-1);assert.equal(correlationStats(rows).slope,-.5);
 assert.equal(correlationStats(rows.slice(0,1)),null);assert.equal(correlationStats(rows.map(p=>({...p,changePct:1}))),null);
 assert.deepEqual(validateClosePoints(rows.slice().reverse()),rows);
 assert.throws(()=>validateClosePoints([...rows,rows[0]]));assert.throws(()=>validateClosePoints([{...rows[0],date:'2026-02-30'}]));assert.throws(()=>validateClosePoints([{...rows[0],individual:Infinity}]));
});
test('toggle loads only on opening; scatter selection highlights the same day in the KOSPI chart',async()=>{
 let calls=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{calls++;return Response.json({points:rows});};
 const root=createRoot(document.getElementById('root'));
 const click=async el=>act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 try{
  await act(async()=>root.render(React.createElement(Correlation)));assert.equal(calls,0);assert.equal(document.querySelector('.correlation-toggle').getAttribute('aria-expanded'),'false');
  await click(document.querySelector('.correlation-toggle'));assert.equal(calls,1);assert.equal(document.querySelectorAll('.correlation-svg').length,2);
  assert.match(document.querySelector('[role=status]').textContent,/2026-10-20/);
  const point=document.querySelectorAll('.correlation-svg')[0].querySelector('[role=button]');await click(point);
  assert.match(document.querySelector('.correlation-selection').textContent,/2026-10-16/);
  assert.match(document.querySelector('.kospi-history [aria-pressed=true]').getAttribute('aria-label'),/2026-10-16/);
  const last=[...document.querySelectorAll('.kospi-history [role=button]')].at(-1);await act(async()=>last.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
  assert.match(document.querySelector('.correlation-selection').textContent,/2026-10-20/);
  await click(document.querySelector('.correlation-toggle'));assert.equal(document.querySelector('.correlation-svg'),null);
 }finally{await act(async()=>root.unmount());globalThis.fetch=previous;}
});
test('verified post-close recovery creates a point with its real timestamp; late intraday/future/mismatched records remain excluded',()=>{const now=new Date('2026-10-20T20:00:00+09:00'),at='2026-10-20T19:34:55+09:00',row={...rows[2],indexAt:at,flowAt:at,recoveryMethod:'LS_KRX_CLOSING_RECOVERY_V1',recoveryDate:'2026-10-20',recoveryAt:at};assert.deepEqual(closingPoints([row],now),[{...rows[2],recoveredAt:at}]);for(const bad of [{recoveryMethod:null},{recoveryDate:'2026-10-19'},{recoveryAt:'2026-10-20T21:00:00+09:00'},{indexAt:'2026-10-20T15:20:00+09:00'},{flowAt:'2026-10-21T19:00:00+09:00'},{recoveryAt:'2026-10-20T18:00:00+09:00'}])assert.deepEqual(closingPoints([{...row,...bad}],now),[]);assert.equal(validateClosePoints([{...rows[2],recoveredAt:at}])[0].recoveredAt,at);});
