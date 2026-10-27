import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

await build({entryPoints:['src/close-score-input.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/close-score-input.js'});
const {buildAutoScoreInput,mergeScoreInput}=await import('../work/close-score-input.js');

const date='2026-10-27';
const stock=(symbol,changePct,turnoverKRW)=>({symbol,name:symbol,market:'KOSPI',themes:[],price:10000,changePct,turnoverKRW});
const snapshots=[
 {date:'2026-10-23',asOf:'2026-10-23T15:30:00+09:00',source:'LS증권 KRX',stocks:[stock('000660',2,1e12)],metrics:{},note:''},
 {date:'2026-10-26',asOf:'2026-10-26T15:30:00+09:00',source:'LS증권 KRX',stocks:[stock('000660',3,2e12)],metrics:{},note:''},
 {date,asOf:date+'T15:30:00+09:00',source:'LS증권 KRX',stocks:[stock('000660',5,3e12)],metrics:{},note:''}
];
const details={date,asOf:date+'T15:35:00+09:00',indices:{},errors:{},heatmap:{asOf:date+'T15:35:00+09:00',source:'네이버 증권 KRX · 네이버 업종',stocks:[
 {symbol:'000660',name:'SK하이닉스',market:'KOSPI',sector:'반도체와반도체장비',changePct:5,marketCap:6000000},
 {symbol:'005930',name:'삼성전자',market:'KOSPI',sector:'반도체와반도체장비',changePct:4,marketCap:7000000},
 {symbol:'042700',name:'한미반도체',market:'KOSPI',sector:'반도체와반도체장비',changePct:-1,marketCap:100000}
]}};

test('stored LS turnover joins same-date heatmap market cap and verified close streak',()=>{
 const x=buildAutoScoreInput({date,leaderSymbol:'000660'},snapshots,details);
 assert.equal(x.turnover,30000);
 assert.equal(x.marketCap,6000000);
 assert.equal(x.streak,3);
 assert.equal(x.up,undefined);
 assert.ok(x.sourceUrls.every(url=>url.includes('2026-10-27')));
});

test('curated STOCK_MAP breadth is used only when every mapped member is present',()=>{
 const x=buildAutoScoreInput({date,leaderSymbol:'000660',breadthGroup:'메모리 반도체'},snapshots,details);
 assert.equal(x.members,2);assert.equal(x.up,2);
 const incomplete={...details,heatmap:{...details.heatmap,stocks:details.heatmap.stocks.filter(x=>x.symbol!=='005930')}};
 const missing=buildAutoScoreInput({date,leaderSymbol:'000660',breadthGroup:'메모리 반도체'},snapshots,incomplete);
 assert.equal(missing.members,undefined);assert.equal(missing.up,undefined);
});

test('legacy heatmap sector breadth remains available only when explicitly requested',()=>{
 const x=buildAutoScoreInput({date,leaderSymbol:'000660',breadthSector:'반도체와반도체장비'},snapshots,details);
 assert.equal(x.members,3);assert.equal(x.up,2);
 const absent=buildAutoScoreInput({date,leaderSymbol:'000660',breadthSector:'HBM'},snapshots,details);
 assert.equal(absent.members,undefined);assert.equal(absent.up,undefined);
});

test('missing prior leader snapshot stops persistence rather than inventing history',()=>{
 const partial=[snapshots[0],snapshots[2]];
 const x=buildAutoScoreInput({date,leaderSymbol:'000660'},partial,details);
 assert.equal(x.streak,1);
});

test('editorial evidence keeps news and flow while stored market fields replace manual quote fields',()=>{
 const auto=buildAutoScoreInput({date,leaderSymbol:'000660'},snapshots,details);
 const merged=mergeScoreInput({date,turnover:1,marketCap:1,news:'reported',foreignNet:20,institutionNet:10,sourceUrls:['https://example.com/news']},auto,date);
 assert.equal(merged.turnover,30000);assert.equal(merged.marketCap,6000000);assert.equal(merged.news,'reported');assert.equal(merged.foreignNet,20);assert.equal(merged.institutionNet,10);
 assert.equal(new Set(merged.sourceUrls).size,merged.sourceUrls.length);
});
