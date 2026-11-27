import test from 'node:test';
import assert from 'node:assert/strict';
import {FRAMES,summarize,normalizeBars,classify,scannerCandidates} from '../worker/vwma-scanner.mjs';
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
 assert.equal(classify({'5':{gap:1}}),'데이터 부족');
 assert.equal(classify(Object.fromEntries(FRAMES.map((f,i)=>[f,{gap:i===0?1:-1}]))),'초기 반등');
 const stocks=[{symbol:'005930',name:'삼성전자',market:'KOSPI',turnoverKRW:1},{symbol:'069500',name:'KODEX 200',market:'KOSPI',turnoverKRW:100}];
 assert.equal(scannerCandidates({stocks}).length,1);
});

test('four-frame scanner maps patterns without a one-minute dependency',()=>{
 assert.deepEqual(FRAMES,['5','60','240','D']);
 const cases={'1000':'초기 반등','1100':'단기 전환','1110':'중기 전환','1111':'상승 정렬','1011':'눌림목 회복','0111':'눌림목 관찰','0000':'하락 정렬','0101':'혼합'};
 for(const [key,expected] of Object.entries(cases)){
  const data=Object.fromEntries(FRAMES.map((f,i)=>[f,{gap:key[i]==='1'?1:-1}]));
  assert.equal(classify(data),expected);
 }
});
