import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyStocks,classifyReviews} from '../src/classification-sync.mjs';
import {applySectorEdits} from '../src/sector-edits.mjs';
import {rankSectors} from '../src/market.ts';
const original={symbol:'005930',name:'삼성전자',market:'KOSPI',sector:'반도체',subSector:'메모리',themes:['HBM']};
const stock={...original,price:100,changePct:5,turnoverKRW:500,themes:['오래된 테마']};
const patch={...original,sector:'AI 인프라',subSector:'AI 메모리',themes:['AI','HBM'],editedAt:'2026-11-18T01:00:00Z'};
const review={date:'2026-11-17',sources:[{url:'https://example.com/report'}],sectors:[{name:'반도체',status:'HOT',leader:'삼성전자 +5%',companions:'SK하이닉스 +4%',sourceIds:[0],reason:'당시 기사'}]};
test('saved classification updates turnover labels and sector ranks without changing quotes or source data',()=>{
 const registry=applySectorEdits([original],[patch]),result=classifyStocks([stock],registry);
 assert.deepEqual(result[0].themes,['AI 인프라','AI 메모리','AI','HBM']);assert.equal(result[0].sector,patch.sector);
 assert.equal(rankSectors(result)[0].name,patch.sector);assert.equal(rankSectors(result)[0].turnoverKRW,500);assert.equal(result[0].price,100);
 assert.deepEqual(stock.themes,['오래된 테마']);assert.equal(classifyStocks([{...stock,name:'다른회사'}],registry)[0].themes[0],'오래된 테마');
 assert.equal(classifyStocks([stock],applySectorEdits([original],[]))[0].sector,'반도체');
});
test('calendar moves edited member only, preserving dated returns, source links and untouched companions',()=>{
 const rows=classifyReviews([review],applySectorEdits([original],[patch]));
 const moved=rows[0].sectors.find(s=>s.name==='AI 인프라'),kept=rows[0].sectors.find(s=>s.name==='반도체');
 assert.equal(moved.leader,'삼성전자 +5%');assert.equal(kept.leader,'SK하이닉스 +4%');assert.deepEqual(moved.sourceIds,[0]);assert.equal(rows[0].sources[0].url,review.sources[0].url);
 assert.equal(moved.classificationMembers[0].subSector,'AI 메모리');assert.deepEqual(review.sectors[0].companions,'SK하이닉스 +4%');
 const reset=classifyReviews([review],[original]);assert.equal(reset[0].sectors.length,1);assert.equal(reset[0].sectors[0].name,'반도체');
});
test('calendar exact identity matching avoids company-name prefix collisions',()=>{
 const result=classifyReviews([{...review,sectors:[{...review.sectors[0],leader:'삼성전자우 +4%',companions:'동반 상승 미확인'}]}],applySectorEdits([original],[patch]));
 assert.equal(result[0].sectors[0].name,'반도체');
});
