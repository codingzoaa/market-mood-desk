import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
mkdirSync('work', { recursive: true });
await build({ entryPoints: ['src/desk.tsx', 'src/storage.ts', 'src/market.ts', 'src/market-details.ts'], bundle: true, platform: 'node', format: 'esm', outdir: 'work', packages: 'external', jsx: 'automatic' });
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: 'https://market-note.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'File', 'location', 'localStorage']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = React;
const { default: Desk } = await import('../work/desk.js');
const { localApi } = await import('../work/storage.js');
const {demoMarketDetails}=await import('../work/market-details.js');
const { dayKey, demoSnapshots } = await import('../work/market.js');
const click = async el => { assert.ok(el, 'click target exists'); await act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));

test('automatic live data, compact heading date, workspace separation and fullscreen restoration',async()=>{
 localStorage.clear();const previous=globalThis.fetch;const record={...demoSnapshots(new Date(Date.now()-86400000).toISOString().slice(0,10)).at(-1),source:'LS증권 KRX · 테스트',note:''};
 record.details=demoMarketDetails(record);
 globalThis.fetch=async url=>Response.json(String(url).includes('market-details')?{details:record.details}:{schemaVersion:2,snapshots:[record],feed:{}});
 let root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(Desk)));
  assert.equal(document.querySelector('.mode-banner'),null);
  assert.deepEqual([...document.querySelectorAll('nav[aria-label="WORKSPACE"] a')].map(a=>a.textContent),['국장','주도 섹터','거래대금','주도주 캘린더','계좌 분석']);
  const accountLink=document.querySelector('a[aria-label="계좌 분석 · 본인 로그인 필요"]');assert.equal(accountLink.href,'https://market-note-private-account.kby0991.workers.dev/');assert.ok(accountLink.querySelector('svg'));assert.equal(document.querySelector('iframe'),null);
  assert.ok(document.querySelector('.page-heading [aria-label="조회 기준일"]'));
  assert.equal(document.querySelector('.shared-toolbar'),null);
  assert.doesNotMatch(document.body.textContent,/접속 코드|실시간 시세 연결 없음|투자 관제실/);
  assert.equal(document.querySelector('.error-banner')?.textContent,undefined);assert.notEqual(document.querySelector('.index-value').textContent,'—');
  const card=document.querySelector('[aria-label="코스피 섹터 히트맵 열기"]');card.focus();await click(card);
  assert.ok(document.querySelector('[role="dialog"].fullscreen-panel'));assert.equal(document.body.style.overflow,'hidden');
  const canvas=document.querySelector('.heatmap-scroll');canvas.getBoundingClientRect=()=>({width:360,height:520});await act(async()=>window.dispatchEvent(new Event('resize')));
  assert.equal(document.querySelector('.sector-heatmap').getAttribute('viewBox'),'0 0 360 520');
  await click(document.querySelector('.fullscreen-close'));assert.equal(document.activeElement,card);assert.equal(document.body.style.overflow,'');
  await click(document.querySelector('nav a[href="#sectors"]'));assert.ok(document.querySelector('.rotation-panel'));assert.equal(document.querySelector('.market-summary'),null);
  await click(document.querySelector('nav a[href="#stocks"]'));assert.equal(document.querySelectorAll('.etf-panel').length,2);
  await click(document.querySelector('nav a[href="#calendar"]'));assert.equal(document.querySelectorAll('.calendar-grid .day').length,28);
  await click(document.querySelector('[aria-label="데이터 관리"]'));assert.match(document.body.textContent,/5分|5분/);assert.equal(document.querySelector('input[type=password]'),null);
 }finally{await act(async()=>root.unmount());globalThis.fetch=previous;}
 // Keep file import validation independent of the automatic quote feed.
 localStorage.removeItem('market-note:ls-cache');globalThis.fetch=async()=>{throw Error('offline');};
 await localApi('/api/import',{schemaVersion:2,snapshots:[{...record,source:'사용자가 확인한 파일'}]});
});

test('duplicate dates require explicit overwrite; invalid and demo imports preserve records', async () => {
  const before = localStorage.getItem('market-note:v1');
  const saved = (await localApi('/api/dashboard')).snapshots[0];
  await assert.rejects(localApi('/api/import', { schemaVersion: 2, snapshots: [saved] }), /同じ|같은 날짜/);
  await assert.rejects(localApi('/api/import', { schemaVersion: 2, snapshots: [demoSnapshots().at(-1)] }), /가상 시세/);
  await assert.rejects(localApi('/api/import', { schemaVersion: 2, snapshots: [{ ...saved, stocks: [{ ...saved.stocks[0], price: -1 }] }] }), /가격/);
  assert.equal(localStorage.getItem('market-note:v1'), before);
  await localApi('/api/import', { schemaVersion: 2, snapshots: [{ ...saved, note: '교체한 메모' }], overwrite: true });
  assert.equal((await localApi('/api/dashboard')).snapshots[0].note, '교체한 메모');
});
