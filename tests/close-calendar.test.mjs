import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

await build({entryPoints:['src/close-calendar.tsx'],bundle:true,platform:'node',format:'esm',outfile:'work/close-calendar.js',packages:'external',jsx:'automatic'});
const {default:Calendar}=await import('../work/close-calendar.js');

test('latest verified close review preserves TOP3 calendar and variable-size TOP5 detail toggle',async()=>{
 const dom=new JSDOM('<div id="root"></div>');
 for(const k of ['window','document','HTMLElement','MouseEvent'])globalThis[k]=dom.window[k];
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'),{createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('root'));
 const click=async selector=>React.act(async()=>document.querySelector(selector).click());
 try{
  await React.act(async()=>root.render(React.createElement(Calendar)));
  assert.match(document.querySelector('h2').textContent,/강세 섹터 캘린더/);
  assert.match(document.querySelector('.close-review h2').textContent,/2026-10-27/);
  assert.equal(document.querySelectorAll('.close-sector').length,5);
  assert.equal(new Set([...document.querySelectorAll('.close-sector h3')].map(x=>x.textContent)).size,5);
  assert.ok(document.querySelector('.close-review').textContent.includes('SK하이닉스 +5.18%'));
  assert.ok(document.querySelector('.close-review').textContent.includes('삼성전자 +4.23%'));
  assert.match(document.querySelector('.close-review').textContent,/총점 미산출/);
  assert.equal(document.querySelectorAll('.close-score-grid').length,5);
  assert.equal(document.querySelector('textarea'),null);
  assert.equal(document.querySelector('.close-session'),null);
  assert.equal(document.querySelector('.close-market'),null);
  assert.equal(document.querySelector('.close-market'),null); // No index-summary header; provenance may mention the index.
  assert.equal(document.querySelector('[aria-label="2026-10-27 장 마감 리뷰"]').querySelectorAll('.close-day-sector').length,3);
  assert.equal(document.querySelector('[aria-label="2026-10-26 장 마감 리뷰"]').querySelectorAll('.close-day-sector').length,2);
  assert.equal(document.querySelector('[aria-label="2026-10-23 장 마감 리뷰"]').querySelectorAll('.close-day-sector').length,3);
  await click('[aria-label="2026-10-27 장 마감 리뷰"]');
  assert.equal(document.querySelector('.close-review'),null);
  assert.equal(document.querySelector('[aria-label="2026-10-27 장 마감 리뷰"]').getAttribute('aria-expanded'),'false');
  await click('[aria-label="2026-10-27 장 마감 리뷰"]');
  assert.equal(document.querySelectorAll('.close-sector').length,5);
  await click('[aria-label="2026-10-26 장 마감 리뷰"]');
  assert.equal(document.querySelectorAll('.close-sector').length,2);
  assert.match(document.querySelector('.close-review').textContent,/루닛 \+30.00%/);
  await click('[aria-label="2026-10-23 장 마감 리뷰"]');
  assert.equal(document.querySelectorAll('.close-sector').length,5);
  assert.match(document.querySelector('.close-review').textContent,/SK하이닉스 \+4.42%/);
  await click('[aria-label="2026-10-15 장 마감 리뷰"]');
  assert.equal(document.querySelectorAll('.close-sector').length,1);
  assert.match(document.querySelector('.close-review').textContent,/확인된 강세 그룹 1개/);
  assert.match(document.querySelector('[aria-label="2026-10-09 리뷰 미등록"]').textContent,/휴장/);
  assert.equal(document.querySelectorAll('.close-day').length,20);
  assert.equal([...document.querySelectorAll('a')].every(x=>x.href.startsWith('https://')),true);
  await click('button[aria-label="이전 4주"]');
  await click('[aria-label="2026-09-28 리뷰 미등록"]');
  assert.equal(document.querySelectorAll('.close-sector').length,0);
  assert.match(document.querySelector('.close-review').textContent,/2026-09-28/);
  await React.act(async()=>[...document.querySelectorAll('button')].find(x=>x.textContent==='최신 리뷰').click());
  assert.equal(document.querySelectorAll('.close-sector').length,5);
  assert.match(document.querySelector('.close-review').textContent,/2026-10-27/);
 }finally{await React.act(async()=>root.unmount());}
});
