import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('work',{recursive:true});
await build({entryPoints:['src/live.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/live-adapter.js',packages:'external'});
const dom=new JSDOM('',{url:'https://codingzoaa.github.io/market-mood-desk/'});
globalThis.sessionStorage=dom.window.sessionStorage;globalThis.localStorage=dom.window.localStorage;
const {liveDashboard,API_URL}=await import('../work/live-adapter.js');
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const snapshot={date:today,asOf:today+'T09:30:00+09:00',source:'LS증권 KRX · 테스트 응답',stocks:[{symbol:'005930',name:'테스트 종목',market:'KOSPI',themes:[],price:80000,changePct:4.5,turnoverKRW:1e9}],metrics:{kospi:2800},note:'',access_token:'must-be-stripped'};
test('시세 요청은 전용 Worker로만 보내고 검증한 필드만 캐시하며 장애 시 정상 값을 유지한다',async()=>{
 const oldFetch=globalThis.fetch;let mode='ok';
 globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).origin,API_URL);assert.equal(options.headers,undefined);assert.equal(options.credentials,'omit');if(mode==='down')throw Error('Network down');return Response.json({schemaVersion:2,snapshots:[snapshot],feed:{configured:true,lastSuccessAt:new Date().toISOString()}});};
 try{
  let r=await liveDashboard(today);assert.equal(r.snapshots[0].stocks[0].symbol,'005930');assert.equal(r.snapshots[0].access_token,undefined);assert.doesNotMatch(localStorage.getItem('market-note:ls-cache'),/must-be-stripped|site-access-code/);
  mode='down';r=await liveDashboard(today);assert.equal(r.feed.failed,true);assert.equal(r.snapshots[0].metrics.kospi,2800);

 }finally{globalThis.fetch=oldFetch;}
});
