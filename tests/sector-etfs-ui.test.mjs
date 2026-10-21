import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {build} from 'esbuild';import {SECTOR_ETFS} from '../shared/sector-etfs.mjs';
await build({entryPoints:['src/sector-etfs.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/sector-etfs-ui.js',packages:'external',jsx:'automatic'});
const dom=new JSDOM('<div id="root"></div>');for(const k of ['window','document','HTMLElement','MouseEvent','KeyboardEvent'])globalThis[k]=dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react'),{createRoot}=await import('react-dom/client'),{act}=React;
const {SectorEtfPanels,validateSectorPayload}=await import('../work/sector-etfs-ui.js');
const fixture=()=>({methodology:'sector-etf-rs-v1',total:20,benchmark:{symbol:'101'},date:'2026-10-20',rows:SECTOR_ETFS.map((e,i)=>({...e,status:'READY',todayChangePct:0.5,return5:1,return20:2,return60:3,rs5:i-10,rs20:i-10,rs60:1,rsComposite:1,avgTurnover20:1e8}))});
test('payload and UI cover all 20 ETFs, rank by RS20 and support chart selection',async()=>{
 const raw=fixture();assert.equal(validateSectorPayload(raw).top5[0].symbol,SECTOR_ETFS.at(-1).symbol);assert.throws(()=>validateSectorPayload({...raw,rows:raw.rows.slice(1)}));
 const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json(raw);const root=createRoot(document.getElementById('root'));
 try{await act(async()=>root.render(React.createElement(SectorEtfPanels,{date:'2026-10-20'})));assert.equal(document.querySelectorAll('.sector-etf-ranking li').length,5);assert.equal(document.querySelectorAll('tbody tr').length,20);assert.match(document.querySelector('.sector-etf-meta').textContent,/20\/20/);
 assert.match(document.querySelector('.sector-etf-ranking').textContent,/오늘 상승률 \+0.5%/);assert.match(document.querySelector('.sector-etf-dashboard h2').textContent,/섹터 상대강도/);
 const sortButton=document.querySelector('[aria-label="RS20 정렬"]');await act(async()=>sortButton.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(document.querySelector('tbody tr').dataset.sectorSymbol,SECTOR_ETFS.at(-1).symbol);await act(async()=>sortButton.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(document.querySelector('tbody tr').dataset.sectorSymbol,SECTOR_ETFS[0].symbol);
 const sectorButton=[...document.querySelectorAll('tbody .sector-name-button')].find(b=>b.textContent==='반도체');await act(async()=>sectorButton.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(document.querySelector('.selected-sector-row').dataset.sectorSymbol,'396500');assert.equal(document.querySelector('.selected-sector-label').textContent,'반도체');
 const point=document.querySelector('.sector-rotation-svg [role=button]');await act(async()=>point.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));assert.match(document.querySelector('.sector-rotation-selection').textContent,/反|반도체/);
 }finally{await act(async()=>root.unmount());globalThis.fetch=previous;}
});
