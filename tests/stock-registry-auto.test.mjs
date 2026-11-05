import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inferCuratedSector,top100Missing,readStockRegistry,syncStockRegistry} from '../worker/stock-registry.mjs';
import {build} from 'esbuild';
await build({entryPoints:['src/stock-map.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/stock-map-registry-test.mjs'});
const {STOCK_MAP,combinedStockMap,stockMapThemes}=await import('../work/stock-map-registry-test.mjs');
const stock=(symbol,i=10,market='KOSPI')=>({symbol,name:symbol,market,turnoverKRW:i,price:100,changePct:5,themes:['기존 LS 단기테마']});
test('LS theme only maps uniquely to established curated taxonomy, ambiguous leaves review queue',()=>{
 const name=STOCK_MAP.find(x=>x.themes.length>0).themes[0];
 const a=inferCuratedSector([name]);
 assert.ok(a.sector);
 assert.equal(inferCuratedSector(['확인되지 않은 테마']).sector,'분류 대기');
 assert.deepEqual(inferCuratedSector(['확인되지 않은 테마']).themes,[]);
});
test('top100 includes exactly top hundred and skips known codes, ETFs and repeats',()=>{
 const pool=Array.from({length:115},(_,i)=>stock(String(700000+i),200-i));
 pool.push({...stock(STOCK_MAP[0].symbol,300),name:STOCK_MAP[0].name},stock('799999',400));
 const got=top100Missing(pool,[{symbol:'799999'}],[]);
 assert.equal(got.length,99);
 assert.ok(!got.some(x=>x.symbol===STOCK_MAP[0].symbol||x.symbol==='799999'));
 assert.ok(!got.some(x=>x.symbol==='700110'));
});
test('legacy LS themes vanish, map themes authoritative and no stock duplicates',()=>{
 const known=STOCK_MAP[0];
 const rows=stockMapThemes([{...stock(known.symbol),name:known.name},stock('799998')],[{symbol:'799998',name:'신규',market:'KOSPI',sector:'분류 대기',subSector:'분류 대기',themes:[],breadth:false}]);
 assert.deepEqual(rows[0].themes,known.themes);
 assert.deepEqual(rows[1].themes,[]);
 assert.equal(combinedStockMap([{symbol:known.symbol,name:'duplicate',market:known.market,sector:'다른',subSector:'다른',themes:['오염'],breadth:false}]).find(x=>x.symbol===known.symbol).sector,known.sector);
});
test('new top100 candidates are classified once and persisted independently of breadth',async()=>{
 const data=new Map();
 const env={DB:{prepare(sql){return {bind(...args){this.args=args;return this;},async first(){return data.has(this.args[0])?{payload:data.get(this.args[0])}:null;},async run(){data.set(this.args[0],this.args[1]);}};}}};
 const quote=stock('799997');
 const request=async()=>({data:{t1532OutBlock:[{tmname:'확인되지 않은 테마'}]}});
 await syncStockRegistry(env,{date:'2026-11-05',stocks:[quote],etfs:[]},request,async()=>{});
 const value=await readStockRegistry(env);
 assert.equal(value.entries.length,1);
 assert.equal(value.entries[0].breadth,false);
 assert.equal(value.entries[0].sector,'분류 대기');
 await syncStockRegistry(env,{date:'2026-11-06',stocks:[quote],etfs:[]},async()=>{throw Error('duplicate re-fetch');},async()=>{});
 assert.equal((await readStockRegistry(env)).entries.length,1);
});
test('Worker entry bundles with curated JSON for Cloudflare; no legacy theme cache read',async()=>{
 const out=await build({entryPoints:['worker/index.mjs'],platform:'browser',bundle:true,format:'esm',write:false,external:['node:*','cloudflare:*']});
 assert.ok(out.outputFiles[0].contents.length>1000);
});
