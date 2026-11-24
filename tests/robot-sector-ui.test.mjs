import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
await build({entryPoints:['src/stock-sector-map.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/robot-sector-ui.mjs',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<div id="root"></div>',{url:'https://market-note.test/#stockmap'});
for(const k of ['window','document','HTMLElement','MouseEvent','HashChangeEvent'])globalThis[k]=dom.window[k];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{createRoot}=await import('react-dom/client'),{default:StockSectorMap}=await import('../work/robot-sector-ui.mjs');
const classification={registry:[],history:[],local:{edits:[]}};
const route=async hash=>React.act(async()=>{window.location.hash=hash;window.dispatchEvent(new HashChangeEvent('hashchange'));});
test('robot detail supports navigation, return and direct entry without replacing classification',async()=>{
 const root=createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(StockSectorMap,{classification})));
  assert.equal(document.querySelector('.sector-note-entry[href="#stockmap/robot"]').getAttribute('href'),'#stockmap/robot');
  const mode=[...document.querySelectorAll('button')].find(x=>x.textContent==='섹터별 보기');await React.act(async()=>mode.click());
  await route('#stockmap/robot');assert.ok(document.querySelector('[aria-label="로봇 섹터 상세"]'));assert.equal(document.activeElement.textContent,'휴머노이드 로봇 로드맵');
  assert.equal(document.querySelectorAll('.robot-roadmap').length,4);assert.match(document.querySelector('.robot-sector').textContent,/확정 납품 관계를 뜻하지/);
  assert.equal(document.querySelector('.robot-back').getAttribute('href'),'#stockmap');
  for(const a of document.querySelectorAll('.robot-sources a'))assert.equal(new URL(a.href).protocol,'https:');
  await route('#stockmap');assert.equal(document.querySelector('.robot-sector'),null);assert.equal(mode.getAttribute('aria-pressed'),'true');
  await React.act(async()=>root.unmount());const direct=createRoot(document.getElementById('root'));await route('#stockmap/robot');await React.act(async()=>direct.render(React.createElement(StockSectorMap,{classification})));assert.ok(document.querySelector('.robot-sector'));await React.act(async()=>direct.unmount());
 }finally{dom.window.close();}
});
