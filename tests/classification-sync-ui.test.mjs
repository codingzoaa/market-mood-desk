import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {resolve} from 'node:path';
await build({entryPoints:['src/desk.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/classification-desk.mjs',packages:'external',jsx:'automatic',plugins:[{name:'fixed-calendar-fixture',setup(builder){builder.onLoad({filter:/\/close-reviews\.ts$/},()=>({contents:"import {review20261116} from './close-review-2026-11-16';export const closeReviews=[review20261116];",resolveDir:resolve('src'),loader:'ts'}));}}]});
const dom=new JSDOM('<div id="root"></div>',{url:'https://market-note.test/#stockmap'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent','KeyboardEvent','localStorage','location'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),{default:Desk}=await import('../work/classification-desk.mjs');
const fixture={symbol:'003230',name:'삼양식품',market:'KOSPI',sector:'음식료',subSector:'식품',themes:['라면'],breadth:false};
const snapshot={date:'2026-11-16',asOf:'2026-11-16T15:30:00+09:00',source:'LS증권 KRX · 테스트',stocks:[{...fixture,price:100000,changePct:6.2,turnoverKRW:500e8}],metrics:{},note:''};
let shared=[];
globalThis.fetch=async url=>Response.json(String(url).includes('stock-map')?{version:1,entries:[fixture],sharedEdits:shared}:String(url).includes('market-details')?{details:null}:String(url).includes('sector-review-status')?{}:{schemaVersion:2,snapshots:[snapshot],feed:{}});
const click=async el=>{assert.ok(el);await act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
const input=async(label,value)=>{const el=document.querySelector('input[aria-label="'+label+'"]');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});};
test('only published common classifications propagate to all views; browser drafts do not shadow them',async()=>{
 let root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(Desk)));
  await click(document.querySelector('[aria-label="삼양식품 분류 수정"]'));
  await input('수정할 대분류','검증용 식품');await input('수정할 세부 섹터','검증용 라면');await input('수정할 투자 테마','수출 검증');
  await act(async()=>document.querySelector('[role=dialog] form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await click(document.querySelector('nav a[href="#stocks"]'));assert.doesNotMatch(document.querySelector('.turnover-list').textContent,/검증용/);
  shared=[{...fixture,sector:'검증용 식품',subSector:'검증용 라면',themes:['수출 검증'],editedAt:'2026-11-16T11:00:00Z'}];
  await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Desk)));
  await click(document.querySelector('nav a[href="#sectors"]'));assert.match(document.querySelector('.sector-items').textContent,/검증용 식품/);
  await click(document.querySelector('nav a[href="#stocks"]'));assert.match(document.querySelector('.turnover-list').textContent,/검증용 식품.*검증용 라면.*수출 검증/);
  await click(document.querySelector('nav a[href="#calendar"]'));if(document.querySelector('[aria-label="2026-11-16 장 마감 리뷰"]').getAttribute('aria-expanded')!=='true')await click(document.querySelector('[aria-label="2026-11-16 장 마감 리뷰"]'));assert.match(document.querySelector('.close-sector-list').textContent,/검증용 식품/);assert.match(document.querySelector('.calendar-classification').textContent,/검증용 라면.*수출 검증/);assert.match(document.querySelector('.close-sector-list').textContent,/삼양식품 \+6.20%/);
  await click(document.querySelector('nav a[href="#stockmap"]'));await click(document.querySelector('[aria-label="삼양식품 분류 수정"]'));await click([...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent==='초안 삭제'));
  shared=[];await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Desk)));
  await click(document.querySelector('nav a[href="#stocks"]'));assert.doesNotMatch(document.querySelector('.turnover-list').textContent,/검증용/);
  await click(document.querySelector('nav a[href="#calendar"]'));if(document.querySelector('[aria-label="2026-11-16 장 마감 리뷰"]').getAttribute('aria-expanded')!=='true')await click(document.querySelector('[aria-label="2026-11-16 장 마감 리뷰"]'));assert.doesNotMatch(document.querySelector('.close-sector-list').textContent,/검증용/);
 }finally{await act(async()=>root.unmount());}
});

