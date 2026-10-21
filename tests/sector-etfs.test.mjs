import test from 'node:test';import assert from 'node:assert/strict';
import {SECTOR_ETFS,sectorRotation,normalizeDaily} from '../shared/sector-etfs.mjs';
import {sectorEtfPayload,safeCollectSectorEtfs,refreshPhase,mergeDailyHistory} from '../worker/sector-etfs.mjs';
const days=Array.from({length:65},(_,i)=>new Date(Date.UTC(2026,5,1+i)).toISOString().slice(0,10));
// Synthetic data exists only in unit tests; the production collector has no fallback data.
function fixture(){const bars=days.map((date,i)=>({date,close:100+i,turnoverKRW:1e8}));return {benchmark:{bars,asOf:'2026-08-05T08:00:00Z'},quotes:Object.fromEntries(SECTOR_ETFS.map((e,j)=>[e.symbol,{bars:bars.map((b,i)=>({...b,close:100+i*(j+1)})),asOf:'2026-08-05T08:00:00Z'}]))};}
test('exact twenty user-selected ETF codes, no substitutions; price returns and RS percentage points',()=>{
 assert.equal(SECTOR_ETFS.length,20);assert.equal(new Set(SECTOR_ETFS.map(e=>e.symbol)).size,20);assert.equal(SECTOR_ETFS[0].symbol,'396500');assert.equal(SECTOR_ETFS.at(-1).symbol,'228810');
 const saved=fixture(),result=sectorRotation(saved,days.at(-1));assert.equal(result.ready,20);assert.equal(result.top5.length,5);assert.equal(result.top5[0].symbol,SECTOR_ETFS.at(-1).symbol);
 const first=result.rows[0];assert.equal(first.rs5,0);assert.equal(first.rs20,0);assert.equal(first.rsComposite,0);assert.equal(first.avgTurnover20,1e8);
 const last=result.rows.at(-1);assert.ok(Math.abs(last.return20-(1380/980-1)*100)<1e-10);assert.ok(Math.abs(last.rs20-(last.return20-(164/144-1)*100))<1e-10);
});
test('new ETF, absent dates, missing turnover and future requested windows never fabricate returns',()=>{
 const saved=fixture();saved.quotes[SECTOR_ETFS[0].symbol].bars=saved.quotes[SECTOR_ETFS[0].symbol].bars.slice(-5);
 let result=sectorRotation(saved,days.at(-1));assert.equal(result.rows[0].rs20,null);assert.equal(result.rows[0].status,'INSUFFICIENT_DATA');assert.equal(result.ready,19);
 const second=saved.quotes[SECTOR_ETFS[1].symbol];second.bars=second.bars.filter(b=>b.date!==days.at(-3));result=sectorRotation(saved,days.at(-1));assert.equal(result.rows[1].rs5,null);
 saved.quotes[SECTOR_ETFS[2].symbol].bars.at(-1).turnoverKRW=null;assert.equal(sectorRotation(saved,days.at(-1)).rows[2].avgTurnover20,null);
 assert.equal(sectorRotation(fixture(),days.at(-10)).date,days.at(-10));assert.equal(sectorRotation({},days.at(-1)).ready,0);
});
test('daily normalization rejects malformed and duplicate bars and excludes today before close',()=>{
 const rows=[{date:'20261020',close:'100',value:2},{date:'20261021',close:'110',value:3}];
 const result=normalizeDaily(rows,{date:'2026-10-21',closed:false});assert.equal(result.length,1);assert.equal(result[0].turnoverKRW,2e6);
 assert.equal(normalizeDaily(rows,{date:'2026-10-21',closed:true}).length,2);
 for(const bad of [[rows[0],rows[0]],[{date:'20260230',close:1}],[{date:'20261020',close:null}]])assert.throws(()=>normalizeDaily(bad,{date:'2026-10-21'}));
});
test('read-only payload uses one stored-state query and failure isolation protects core collectors',async()=>{
 const queries=[];const env={DB:{prepare(sql){queries.push(sql);return {bind(){return this;},async first(){return {payload:JSON.stringify(fixture())};}};}}};
 assert.equal((await sectorEtfPayload(env,days.at(-1))).ready,20);assert.equal(queries.length,1);assert.match(queries[0],/^SELECT/);
 assert.equal(await safeCollectSectorEtfs({}),undefined);
});

test('five-minute refresh buckets, current-day returns and short updates preserve historical baselines',()=>{
 assert.equal(refreshPhase('2026-10-21','1201'),'2026-10-21:1200');assert.equal(refreshPhase('2026-10-21','1204'),'2026-10-21:1200');assert.equal(refreshPhase('2026-10-21','1205'),'2026-10-21:1205');
 const saved=fixture(),last=saved.quotes[SECTOR_ETFS[0].symbol].bars.at(-1);const merged=mergeDailyHistory(saved.quotes[SECTOR_ETFS[0].symbol].bars,[{...last,close:200}]);assert.equal(merged.length,65);assert.equal(merged.at(-1).close,200);assert.equal(merged[0].close,100);saved.quotes[SECTOR_ETFS[0].symbol].bars=merged;
 const row=sectorRotation(saved,days.at(-1)).rows[0];assert.ok(Math.abs(row.todayChangePct-(200/163-1)*100)<1e-10);assert.ok(row.return20>0);
});
