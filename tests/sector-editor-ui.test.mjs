import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {SECTOR_EDITS_KEY} from '../src/sector-edits.mjs';
await build({entryPoints:['src/stock-sector-map.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/sector-editor-ui.mjs',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<div id="root"></div>',{url:'https://market-note.test/#stockmap'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent','KeyboardEvent','localStorage'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{createRoot}=await import('react-dom/client'),{default:StockSectorMap}=await import('../work/sector-editor-ui.mjs');const {act}=React;
const fixture={symbol:'799998',name:'테스트종목',market:'KOSPI',sector:'미분류',subSector:'세부 분류 검토',themes:[],breadth:false};
globalThis.fetch=async()=>Response.json({version:1,entries:[fixture]});
const click=async el=>{assert.ok(el);await act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
const input=async(label,value)=>{const el=document.querySelector('input[aria-label="'+label+'"]');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});};
const editButton=()=>document.querySelector('[aria-label="테스트종목 분류 수정"]');
test('manual editor saves all three classification fields, survives remount and restores default',async()=>{
 localStorage.clear();let root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(StockSectorMap)));await click(editButton());assert.equal(document.querySelectorAll('[role=dialog]').length,1);
  await input('수정할 대분류','전력기기');await input('수정할 세부 섹터','전선·케이블');await input('수정할 투자 테마','전력망, 전선');
  await act(async()=>document.querySelector('[role=dialog] form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(JSON.parse(localStorage.getItem(SECTOR_EDITS_KEY)).entries[0].subSector,'전선·케이블');
  assert.match(editButton().closest('tr').textContent,/전력기기.*전선·케이블.*전력망.*전선/);
  await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(StockSectorMap)));
  assert.match(editButton().closest('tr').textContent,/전선·케이블/);await click(editButton());await click([...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent==='기본 분류로 복원'));
  assert.equal(JSON.parse(localStorage.getItem(SECTOR_EDITS_KEY)).entries.length,0);assert.match(editButton().closest('tr').textContent,/미분류.*세부 분류 검토/);
 }finally{await act(async()=>root.unmount());}
});
