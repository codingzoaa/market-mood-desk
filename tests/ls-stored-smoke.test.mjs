import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,run,ENDPOINT,readInput} from '../scripts/ls-stored-smoke.mjs';
const now=new Date('2026-10-20T06:00:00Z');
// Synthetic fixtures are unit tests only, never used by the live CLI.
const fixture=()=>({schemaVersion:2,snapshots:[{date:'2026-10-20',asOf:now.toISOString(),source:'LS증권 KRX',stocks:Array.from({length:8},(_,i)=>({symbol:String(i+1).padStart(6,'0'),name:'단위 테스트 '+i,market:'KOSPI',price:100,changePct:1,turnoverKRW:100000,themes:[]}))}]});
test('at most five real-response rows, engine called, no fabricated history or score',()=>{
 const r=analyze(fixture(),{now,limit:100});assert.equal(r.status,'READ_OK');assert.equal(r.results.length,5);
 for(const s of r.results){assert.equal(s.status,'INSUFFICIENT_DATA');assert.equal(s.engineStatus,'INSUFFICIENT_DATA');assert.equal(s.score,null);assert.equal(s.sourceQuoteAt,null);assert.ok(s.missingFields.includes('sourceQuoteAt'));assert.deepEqual(s.engineInput.quotes[0].history,[]);assert.equal(s.engineInput.calendar.verified,false);}
});
test('single GET only and network failure is not insufficient data',async()=>{
 let calls=0;const r=await run({now,fetcher:async(url,options)=>{calls++;assert.equal(url,ENDPOINT+'?date=2026-10-20');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);throw Error('secret must never be logged');}});
 assert.equal(calls,1);assert.equal(r.status,'FETCH_FAILED');assert.ok(!JSON.stringify(r).includes('secret'));
});
test('successful HTTP response reaches engine; HTTP and JSON failures separate',async()=>{
 assert.equal((await run({now,fetcher:async()=>new Response(JSON.stringify(fixture()))})).status,'READ_OK');
 assert.equal((await run({now,fetcher:async()=>new Response('',{status:403})})).status,'FETCH_FAILED');
 assert.equal((await run({now,fetcher:async()=>new Response('not json')})).status,'INVALID_RESPONSE');
});
test('stale, wrong source, future receipts and malformed prices never score',()=>{
 const stale=fixture();stale.snapshots[0].date='2026-10-19';assert.equal(analyze(stale,{now}).status,'NO_TODAY_DATA');
 for(const source of ['시뮬레이션','LS증권 KRX demo']){const f=fixture();f.snapshots[0].source=source;assert.equal(analyze(f,{now}).status,'INVALID_RESPONSE');}
 const future=fixture();future.snapshots[0].asOf='2026-10-20T06:01:00Z';assert.equal(analyze(future,{now}).status,'INVALID_RESPONSE');
 const invalid=fixture();invalid.snapshots[0].stocks[0].price=null;assert.equal(analyze(invalid,{now}).results[0].status,'INVALID_DATA');
});
test('outside session engine invalidation remains visible and receipt time is not clamped',()=>{
 const f=fixture();f.snapshots[0].asOf='2026-10-20T10:00:00Z';const r=analyze(f,{now:new Date('2026-10-20T11:00:00Z')}).results[0];assert.equal(r.engineStatus,'INVALIDATED');assert.ok(r.engineIssues.includes('OUTSIDE_SESSION'));assert.equal(r.score,null);assert.equal(r.asOf,f.snapshots[0].asOf);
});
test('offline CLI reads supplied response, hashes provenance, and never falls back on bad file',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'stored-ls-test-'));
 try{
  const file=join(dir,'response.json');await writeFile(file,JSON.stringify(fixture()));
  const result=await readInput(file);assert.equal(result.inputMethod,'USER_UPLOADED_API_RESPONSE');assert.equal(result.liveFetchPerformed,false);assert.match(result.inputSHA256,/^[a-f0-9]{64}$/);assert.equal(result.upstreamLSCalls,0);
  const failed=await readInput(join(dir,'missing.json'));assert.equal(failed.status,'INPUT_FILE_FAILED');
 }finally{await rm(dir,{recursive:true,force:true});}
});
