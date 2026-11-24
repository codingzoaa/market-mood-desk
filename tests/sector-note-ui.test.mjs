import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {build} from 'esbuild';
await build({entryPoints:['src/stock-sector-map.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/sector-note-ui.mjs',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<div id="root"></div>',{url:'https://market.test/#stockmap/write'});
for(const k of ['window','document','HTMLElement','HTMLTextAreaElement','Event','MouseEvent','HashChangeEvent','localStorage'])globalThis[k]=dom.window[k];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{createRoot}=await import('react-dom/client'),{default:Map}=await import('../work/sector-note-ui.mjs');
const classification={registry:[{name:'로보티즈',symbol:'108490',market:'KOSDAQ',sector:'로봇',subSector:'로봇·자동화',themes:['액추에이터']}],history:[],local:{edits:[]}};
const click=async text=>React.act(async()=>[...document.querySelectorAll('button')].find(n=>n.textContent===text).click());
const fill=async(label,text)=>React.act(async()=>{const el=document.querySelector('textarea[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));});
test('paste, review, edit and save request keep public pages separate from browser drafts',async()=>{
 const root=createRoot(document.getElementById('root'));let opened='';window.open=url=>{opened=url;};
 try{await React.act(async()=>root.render(React.createElement(Map,{classification})));assert.ok(document.querySelector('[aria-label="섹터 자료 등록"]'));
 await fill('섹터 자료 원문','로봇 로드맵\n로보티즈 2027년 공개 예정\nhttps://example.com/news');await click('정리 초안 만들기');assert.match(document.querySelector('textarea[aria-label="자료 관련 종목"]').value,/로보티즈/);assert.match(document.querySelector('textarea[aria-label="자료 일정·확인할 조건"]').value,/2027년/);
 await fill('자료 핵심 요약','검토한 요약');await click('검토 초안 보관');assert.match(localStorage.getItem('marketnote-sector-note-draft-v1'),/검토한 요약/);await click('검토 완료 · 공통 저장');assert.match(opened,/github.com\/codingzoaa\/market-mood-desk\/issues\/new/);assert.match(new URL(opened).searchParams.get('body'),/검토한 요약/);
 await React.act(async()=>{window.location.hash='#stockmap/sector/반도체';window.dispatchEvent(new HashChangeEvent('hashchange'));});assert.match(document.querySelector('.sector-note-detail').textContent,/반도체 자료 모음/);assert.match(document.querySelector('.sector-note-detail').textContent,/아직 등록된 자료가 없습니다/);
 await React.act(async()=>{window.location.hash='#stockmap/robot';window.dispatchEvent(new HashChangeEvent('hashchange'));});assert.ok(document.querySelector('[aria-label="로봇 등록 자료"]'));
 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});
