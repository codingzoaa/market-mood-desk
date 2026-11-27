import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,normalizeBars,classify,scannerCandidates} from '../worker/vwma-scanner.mjs';
test('VWMA weights volume and records cross',()=>{
 const b=[{at:1,p:10,v:1},{at:2,p:8,v:10},{at:3,p:12,v:1}];
 const s=summarize(b,2);assert.ok(Math.abs(s.vwma-92/11)<1e-9);assert.equal(s.state,3);assert.equal(s.crossAt,new Date(3).toISOString());
 assert.equal(summarize(b,3),null);
});
test('partial intraday and current daily are excluded',()=>{
 const now=new Date('2026-11-27T10:10:00+09:00');
 const rows=[{date:'20261127',time:'100000',close:10,jdiff_vol:2},{date:'20261127',time:'100500',close:11,jdiff_vol:3}];
 assert.equal(normalizeBars(rows,'5',now).length,1);
 assert.equal(normalizeBars(rows.slice(0,1),'D',now).length,0);
});
test('missing is not bearish and candidate funds excluded',()=>{
 assert.equal(classify({'1':{gap:1}}),'데이터 부족');
 assert.equal(classify(Object.fromEntries(['1','5','60','240','D'].map((f,i)=>[f,{gap:i===0?1:-1}]))),'초기 반등');
 const stocks=[{symbol:'005930',name:'삼성전자',market:'KOSPI',turnoverKRW:1},{symbol:'069500',name:'KODEX 200',market:'KOSPI',turnoverKRW:100}];
 assert.equal(scannerCandidates({stocks}).length,1);
});
