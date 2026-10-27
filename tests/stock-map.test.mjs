import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

await build({entryPoints:['src/stock-map.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/stock-map.js'});
const {STOCK_MAP,BREADTH_GROUPS,getSectorBreadth,seedStockMapFromHeatmap}=await import('../work/stock-map.js');

const date='2026-10-27';
const heat=(symbol,name,market,changePct,marketCap=100000)=>({symbol,name,market,sector:'원천업종',changePct,marketCap});
const details=stocks=>({date,asOf:date+'T15:35:00+09:00',indices:{},errors:{},heatmap:{asOf:date+'T15:35:00+09:00',source:'네이버 증권 KRX · 네이버 업종',stocks}});

test('curated stock map has unique codes, single score subsector and four initial industries',()=>{
 assert.ok(STOCK_MAP.length>=45);
 assert.equal(new Set(STOCK_MAP.map(x=>x.symbol)).size,STOCK_MAP.length);
 assert.ok(STOCK_MAP.every(x=>/^\d{6}$/.test(x.symbol)&&x.subSector&&x.sector&&x.breadth===true));
 for(const sector of ['반도체','2차전지','로봇','전력기기'])assert.ok(STOCK_MAP.some(x=>x.sector===sector));
 for(const group of ['메모리 반도체','PCB·반도체 기판','반도체 장비·테스트','2차전지 셀·소재','로봇·자동화','전력기기·전력망'])assert.ok(BREADTH_GROUPS[group]);
});

test('breadth uses fixed members, reports strong-up ratio and fails closed on missing quotes',()=>{
 const members=STOCK_MAP.filter(x=>x.subSector==='메모리 반도체');
 const quotes=members.map((x,i)=>heat(x.symbol,x.name,x.market,i===0?5:-1));
 const b=getSectorBreadth(details(quotes),'메모리 반도체');
 assert.equal(b.complete,true);assert.equal(b.members,members.length);assert.equal(b.up,1);assert.equal(b.strongUp,1);
 assert.equal(Math.round(b.upRatio*10)/10,50);
 const incomplete=getSectorBreadth(details(quotes.slice(0,-1)),'메모리 반도체');
 assert.equal(incomplete.complete,false);assert.equal(incomplete.missingSymbols.length,1);
});

test('heatmap auto-seed never enters breadth until curated',()=>{
 const seeded=seedStockMapFromHeatmap(details([
  heat('005930','삼성전자','KOSPI',2),
  heat('123456','신규종목','KOSDAQ',4)
 ]));
 assert.equal(seeded.length,1);
 assert.equal(seeded[0].symbol,'123456');
 assert.equal(seeded[0].breadth,false);
 assert.equal(seeded[0].subSector,'원천업종');
});
