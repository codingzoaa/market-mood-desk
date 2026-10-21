import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {build} from 'esbuild';
await build({entryPoints:['src/etf-holdings.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/etf-holdings.js',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<button id="trigger">ETF</button><div id="root"></div>');for(const k of ['window','document','HTMLElement','MouseEvent','KeyboardEvent'])globalThis[k]=dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const {default:Dialog}=await import('../work/etf-holdings.js');
test('modal shows source date and descending weights, traps focus and closes with Escape',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json({symbol:'396500',status:'READY',date:'2026-10-21',asOf:'2026-10-21T03:00:00Z',source:'LS증권 t1904',holdings:[{name:'삼성전자',symbol:'005930',weight:20},{name:'SK하이닉스',symbol:'000660',weight:30}]});
 const root=createRoot(document.getElementById('root'));document.getElementById('trigger').focus();let closed=false;
 try{await act(async()=>root.render(React.createElement(Dialog,{etf:{symbol:'396500',name:'TIGER 반도체TOP10',sector:'반도체'},onClose:()=>{closed=true;}})));assert.match(document.querySelector('[role=dialog]').textContent,/구성 기준일 2026-10-21/);assert.match(document.querySelector('.etf-holdings-list li').textContent,/SK하이닉스/);assert.equal(document.body.style.overflow,'hidden');assert.equal(document.activeElement.getAttribute('aria-label'),'ETF 구성종목 닫기');await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(closed,true);
 }finally{await act(async()=>root.unmount());globalThis.fetch=previous;}assert.equal(document.activeElement.id,'trigger');assert.equal(document.body.style.overflow,'');
});
