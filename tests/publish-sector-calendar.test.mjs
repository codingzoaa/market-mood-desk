import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareEditorial,updateIndex,nextState} from '../scripts/publish-sector-calendar.mjs';

const date='2026-11-09';
const mk=(symbol,name,changePct,turnoverKRW)=>({symbol,name,market:'KOSPI',themes:['기존 LS 테마'],changePct,turnoverKRW,price:10000});
const good={
 date,source:'LS증권 KRX · 정규장',asOf:'2026-11-09T07:00:00Z',
 stocks:[
  mk('005930','삼성전자',5.2,1000000000000),mk('000660','SK하이닉스',4.2,700000000000),
  ...Array.from({length:12},(_,i)=>mk(String(800000+i),'표본'+i,-2,1000000))
 ]};
const mapping=[{symbol:'005930',sector:'반도체',subSector:'메모리 반도체'},{symbol:'000660',sector:'반도체',subSector:'메모리 반도체'},...Array.from({length:60},(_,i)=>({symbol:String(800000+i),sector:'미분류',subSector:'미분류'}))];
const story={day:date,source:'연합뉴스',headline:'반도체 주요 종목 강세 흐름 확인',link:'https://news.google.com/rss/articles/example'};
test('verified close + matching dated news creates only supported sector, no fabricated score',()=>{
 const r=prepareEditorial(date,good,[story],mapping);
 assert.equal(r.sectors.length,1);
 assert.equal(r.sectors[0].name,'반도체');
 assert.equal(r.sectors[0].sourceIds[0],0);
 assert.equal(r.sectors[0].leaderSymbol,'005930');
 assert.equal(r.sectors[0].scoreInput,undefined);
 assert.equal(nextState(date,r,'').status,'published');
});
test('a headline not about the observed sector cannot authorize its review',()=>{
 assert.equal(prepareEditorial(date,good,[{...story,headline:'환율 장중 움직임 점검'}],mapping).sectors.length,0);
});
test('stale/intraday quotes and wrong day cannot be published',()=>{
 for(const broken of [{...good,date:'2026-11-06'}, {...good,asOf:'2026-11-09T05:00:00Z'}]){
  assert.throws(()=>prepareEditorial(date,broken,[story],mapping));
 }
});
test('no trusted headline or missing second gainer stays pending',()=>{
 assert.equal(prepareEditorial(date,good,[],mapping).sectors.length,0);
 const only={...good,stocks:[good.stocks[0],{...good.stocks[1],changePct:-0.3},...good.stocks.slice(2)]};
 assert.equal(prepareEditorial(date,only,[story],mapping).sectors.length,0);
 assert.equal(nextState(date,null,'당일 기사 누락').status,'pending');
});
test('index update is idempotent, never rewrites other dated reviews',()=>{
 const src="import type {ScoreInput} from './close-score';\nconst records=[...historicalReviews,review20261105];\n";
 const next=updateIndex(src,date);
 assert.ok(next.includes("import {review20261109} from './close-review-2026-11-09';"));
 assert.ok(next.includes('review20261105,review20261109];'));
 assert.equal(updateIndex(next,date),next);
});
test('co-rise calendar accepts modest concurrent gains without a +2% or +4% stock',()=>{
 const modest={...good,stocks:good.stocks.map((s,i)=>({...s,changePct:i===0?0.8:i===1?0.3:s.changePct}))};
 assert.equal(prepareEditorial(date,modest,[story],mapping).sectors.length,1);
});

test('broker report attribution is not a financial-sector catalyst',()=>{
 const map=Array.from({length:60},(_,i)=>({symbol:String(100000+i),sector:'금융·증권'}));
 const snapshot={...good,stocks:map.map((s,i)=>({...s,name:'금융종목'+i,changePct:1,turnoverKRW:1000}))};
 const unrelated={...story,headline:"[리포트 브리핑]SFA반도체, 실적 개선 목표가 9000원 - BNK투자증권 - 뉴스핌"};
 assert.equal(prepareEditorial(date,snapshot,[unrelated],map).sectors.length,0);
 assert.equal(prepareEditorial(date,snapshot,[{...story,headline:'은행주 동반 강세, 금융지주 상승'}],map).sectors.length,1);
});
test('foreign defense stock feature alone does not explain Korean defense stocks',()=>{
 const map=Array.from({length:60},(_,i)=>({symbol:String(100000+i),sector:'방산'}));
 const snapshot={...good,stocks:map.map((s,i)=>({...s,name:'국내방산'+i,changePct:1,turnoverKRW:1000}))};
 assert.equal(prepareEditorial(date,snapshot,[{...story,headline:'[인도 특징주] 국영 방산 힌두스탄 항공, 수주 잔고 성장'}],map).sectors.length,0);
});
