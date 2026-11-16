import {test} from 'node:test';import assert from 'node:assert/strict';
import {storeSectorNews,readSectorNews,relayNewsStatus,RELAY_KEY} from '../worker/sector-news-cache.mjs';
import {handleSectorRecovery,sectorRecoverySignature} from '../worker/sector-recovery.mjs';
const date='2026-11-10',now=new Date('2026-11-10T07:20:00Z');
const news=[{headline:'코스피 반도체 동반 상승 확인',link:'https://www.hankyung.com/article/1',published:'Tue, 10 Nov 2026 07:00:00 GMT',provider:'네이버 뉴스'}];
const db=()=>{const data=new Map();return {data,prepare(){return {bind(id,payload){return {run:async()=>data.set(id,payload),first:async()=>data.has(id)?{payload:data.get(id)}:null};}};}};};
test('verified same-day relay is readable at the 16:30 send slot, but stale or future receipts cannot be used',async()=>{
 const DB=db(),env={DB};await storeSectorNews(env,date,news,now);
 assert.equal((await relayNewsStatus(env,date,new Date('2026-11-10T07:30:00Z'))).status,'ready');
 assert.equal((await readSectorNews(env,date,new Date('2026-11-10T07:30:00Z')))[0].source,'한국경제 · 네이버 뉴스');
 for(const at of ['2026-11-10T08:20:01Z','2026-11-10T07:19:59Z'])await assert.rejects(()=>readSectorNews(env,date,new Date(at)),/NOT_READY/);
 await assert.rejects(()=>readSectorNews(env,'2026-11-11',now),/NOT_READY/);
});
test('wrong day and spoofed publisher cannot be inserted into the relay cache',async()=>{
 const env={DB:db()};await assert.rejects(()=>storeSectorNews(env,'2026-11-09',news,now),/DATE_INVALID/);
 await assert.rejects(()=>storeSectorNews(env,date,[{...news[0],link:'https://hankyung.com.evil.test/a'}],now),/INVALID/);
});
test('signed cache operation stores validated news without creating a delivery record or sending a message',async()=>{
 const DB=db(),secret='test-secret',time=String(+now),body=JSON.stringify({operation:'cache',news});
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))].map(x=>x.toString(16).padStart(2,'0')).join(''),signature=await sectorRecoverySignature(secret,date,time,hash);
 const r=await handleSectorRecovery(new Request('https://worker/internal/sector-recovery',{method:'POST',headers:{'X-Sector-Date':date,'X-Sector-Time':time,'X-Sector-Signature':signature,'X-Sector-Body-SHA256':hash},body}),{DB,TELEGRAM_BOT_TOKEN:secret},now,{fetcher:()=>{throw Error('no Telegram allowed')}});
 assert.equal(r.status,200);assert.equal((await r.json()).telegramSent,false);assert.deepEqual([...DB.data.keys()],[RELAY_KEY(date)]);
});
