import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leadershipGroups,classificationCoverage,breadthSummary} from '../src/leadership.ts';
const stock=(symbol,amount,themes)=>({symbol,name:symbol,market:'KOSPI',themes,turnoverKRW:amount,changePct:5,price:100});
test('one stock with five themes occupies one row while allocated turnover is conserved',()=>{
 const stocks=[stock('000660',500,['A','B','C','D','E']),stock('000001',100,['F'])];
 const rows=leadershipGroups(stocks);
 assert.equal(rows.length,2);assert.equal(rows[0].aliases.length,5);
 assert.equal(rows[0].turnoverKRW,500);assert.equal(rows[0].dominance,100);
 assert.equal(rows.reduce((sum,s)=>sum+s.turnoverKRW,0),600);
 assert.ok(Math.abs(rows.reduce((sum,s)=>sum+s.share,0)-100)<1e-10);
});
test('overlapping themes remain distinct; unknown classification never merges with a named theme',()=>{
 const rows=leadershipGroups([stock('000001',300,['A','B']),stock('000002',100,['A']),stock('000003',50,[])]);
 assert.equal(rows.length,3);assert.equal(rows.find(s=>s.name==='A').count,2);
 assert.equal(rows.find(s=>s.name==='A').dominance,75);
 assert.deepEqual(leadershipGroups([]),[]);
 const unknown=leadershipGroups([stock('000004',10,['A','미분류'])]);assert.equal(unknown.length,2);
});
test('classification coverage excludes funds and treats empty and unknown themes as unclassified',()=>{
 assert.deepEqual(classificationCoverage([stock('000001',1,[]),stock('000002',1,['미분류']),stock('000003',1,['A']),{...stock('000004',1,['A']),instrumentType:'ETF'}]),{total:3,classified:1,pct:1/3*100});
 assert.equal(classificationCoverage([]).pct,null);
});
test('breadth uses supplied counts, handles divergence and does not infer missing data',()=>{
 assert.equal(breadthSummary({changePct:0.3,advances:170,declines:721}),'지수 상승에도 하락 종목 우세');
 assert.equal(breadthSummary({changePct:-1,advances:721,declines:170}),'지수 하락에도 상승 종목 우세');
 assert.equal(breadthSummary(), '시장 폭 데이터 대기');
 assert.equal(breadthSummary({changePct:1,advances:0,declines:0}),'상승·하락 종목 집계 대기');
});
