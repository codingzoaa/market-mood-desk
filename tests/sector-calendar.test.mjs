import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {build} from 'esbuild';
await build({entryPoints:['src/sector-calendar.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/sector-calendar.js',packages:'external',jsx:'automatic'});
const {calendarRows,default:Calendar}=await import('../work/sector-calendar.js');
const stock=(symbol,name,turnover=1e10)=>({symbol,name,market:'KOSPI',themes:[name],price:1000,changePct:5,turnoverKRW:turnover});
const snap=(date,stocks)=>({date,asOf:date+'T06:30:00Z',source:'테스트',stocks,metrics:{},note:''});
const snapshots=[snap('2026-10-21',[stock('000001','반도체')]),snap('2026-10-22',[stock('000002','바이오')]),snap('2026-10-23',[stock('000001','반도체'),stock('000003','우주')])];
test('missing dates stay empty; missing prior history never implies NEW',()=>{assert.equal(calendarRows(snapshots,'2026-10-20').rows.length,0);assert.equal(calendarRows(snapshots,'2026-10-21').rows[0].status,'판단 대기');});
test('observed re-entry and newly observed theme are distinguished',()=>{const r=calendarRows(snapshots,'2026-10-23');assert.equal(r.previous.date,'2026-10-22');assert.equal(r.rows[0].status,'RE');assert.equal(r.rows[1].status,'NEW');});
test('clicking a date changes detail and absent dates do not retain old sector cards',async()=>{
 const dom=new JSDOM('<div id="root"></div>');for(const k of ['window','document','HTMLElement','MouseEvent'])globalThis[k]=dom.window[k];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),{createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 function Harness(){const [selected,setSelected]=React.useState('2026-10-23');return React.createElement(Calendar,{snapshots,selected,end:'2026-10-23',today:'2026-10-23',topN:50,market:'ALL',onSelect:setSelected,onEnd:()=>{}});}
 try{await React.act(async()=>root.render(React.createElement(Harness)));assert.match(document.querySelector('[aria-label="선택 날짜 섹터 상세"]').textContent,/반도체/);await React.act(async()=>document.querySelector('[data-date="2026-10-22"]').click());assert.match(document.querySelector('[aria-label="선택 날짜 섹터 상세"]').textContent,/바이오/);assert.equal(document.querySelector('[data-date="2026-10-22"]').getAttribute('aria-pressed'),'true');await React.act(async()=>document.querySelector('[data-date="2026-10-20"]').click());assert.equal(document.querySelectorAll('.sector-review-card').length,0);assert.match(document.querySelector('[aria-label="선택 날짜 섹터 상세"]').textContent,/자료가 없습니다/);}finally{await React.act(async()=>root.unmount());}
});
