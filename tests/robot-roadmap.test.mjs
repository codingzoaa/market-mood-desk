import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {build} from 'esbuild';import {JSDOM} from 'jsdom';
const data=JSON.parse(fs.readFileSync('src/data/robot-2027-roadmap.json','utf8'));
test('curated roadmap preserves all thirteen events and separates official events from user expectations',()=>{
 assert.equal(data.quarters.length,4);assert.equal(data.quarters.flatMap(q=>q.events).length,13);
 const events=data.quarters.flatMap(q=>q.events);for(const e of events){assert.ok(e.status&&e.check&&e.detail);for(const id of e.sources)assert.ok(data.sources.some(s=>s.id===id));}
 for(const s of data.sources)assert.equal(new URL(s.url).protocol,'https:');
 assert.match(events.find(e=>e.name.includes('AI5')).status,/확인 필요/);assert.match(events.find(e=>e.name.includes('에이딘')).status,/미확정/);assert.match(events.find(e=>e.name.includes('Atlas')).detail,/2028/);
});
await build({entryPoints:['src/stock-sector-map.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/robot-roadmap-ui.mjs',packages:'external',jsx:'automatic'});
test('retired paste/review/save route returns to stock map and robot detail renders the curated roadmap',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://market.test/#stockmap/write'});for(const k of ['window','document','HTMLElement','HashChangeEvent'])globalThis[k]=dom.window[k];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),{createRoot}=await import('react-dom/client'),{default:Map}=await import('../work/robot-roadmap-ui.mjs');const root=createRoot(document.getElementById('root'));const classification={registry:[],history:[],local:{edits:[]}};
 try{await React.act(async()=>root.render(React.createElement(Map,{classification})));assert.equal(document.querySelector('textarea'),null);assert.equal(document.querySelector('a[href*="/write"]'),null);assert.ok(document.querySelector('.sector-map-page'));
 await React.act(async()=>{window.location.hash='#stockmap/robot';window.dispatchEvent(new HashChangeEvent('hashchange'));});assert.ok(document.querySelector('[aria-label="2027 로봇 섹터 이벤트 로드맵"]'));assert.equal(document.querySelectorAll('.robot-quarter:not(.robot-outlook)').length,4);assert.equal(document.querySelectorAll('.robot-quarter:not(.robot-outlook) .robot-roadmap').length,13);assert.equal(document.querySelector('a[href*="/write"]'),null);
 const shortcuts=[...document.querySelectorAll('.robot-key-dates button')];assert.equal(shortcuts.length,5);assert.ok(shortcuts.every(b=>document.getElementById(b.getAttribute('aria-controls'))));
 await React.act(async()=>shortcuts[0].click());assert.equal(document.activeElement.id,shortcuts[0].getAttribute('aria-controls'));assert.equal(window.location.hash,'#stockmap/robot');
 assert.ok(![...document.querySelectorAll('h3')].some(h=>h.textContent==='기업별 로드맵'));assert.match(document.querySelector('[aria-label="2028년 이후 계획"]').textContent,/3만 대/);
 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});
