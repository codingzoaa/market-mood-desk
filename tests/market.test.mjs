import { test } from 'node:test';import assert from 'node:assert/strict';
import {gainers,rankSectors,fourWeeks,rotations,validateImport,validateSnapshot,parseCSV,demoSnapshots,riskScore,regime,dayKey,rankKodex} from '../src/market.ts';
const stock=(symbol,amount,change=5,themes=['반도체'])=>({symbol,name:'종목 '+symbol,market:'KOSPI',themes,price:50000,changePct:change,turnoverKRW:amount});
const date=dayKey();const snap={date,asOf:date+'T15:30:00+09:00',source:'테스트 실제 입력',stocks:[stock('000660',3e11)],metrics:{},note:''};
test('거래대금 상위 종목군을 먼저 자르고 +4% 조건을 적용한다',()=>{const stocks=[stock('000001',500,3.99),stock('000002',400,4),stock('000003',300,15)];assert.deepEqual(gainers(stocks,2).map(x=>x.symbol),['000002']);assert.equal(stocks[0].changePct,3.99);});
test('시장 구분·미분류·다중 테마의 대금 보존',()=>{const result=rankSectors([stock('000001',200,6,['A','B']),stock('000002',100,9,['A']),stock('000003',50,4,[])]);assert.equal(result.reduce((n,s)=>n+s.turnoverKRW,0),350);assert.equal(result[0].name,'A');assert.equal(result[0].changePct,7.5);assert.equal(gainers([{...stock('000004',800),market:'KOSDAQ'}],50,'KOSPI').length,0);});
test('최근 4주는 윤년·월 경계에서도 정확히 28일이다',()=>{const dates=fourWeeks('2024-03-01');assert.equal(dates.length,28);assert.equal(dates[0],'2024-02-03');assert.ok(dates.includes('2024-02-29'));});
test('섹터 로테이션은 선택일 이후 데이터를 사용하지 않는다',()=>{const records=[{...snap,date:'2026-10-01'},{...snap,date:'2026-10-03',stocks:[stock('000001',100,6,['미래'])]}];assert.deepEqual(rotations(records,'2026-10-01').dates,['2026-10-01']);assert.equal(rotations(records,'2026-10-01').rows.some(x=>x.name==='미래'),false);});
test('CSV의 BOM·따옴표·쉼표·6자리 코드와 원 단위를 유지한다',()=>{const content='\uFEFFdate,asOf,symbol,name,market,themes,price,changePct,turnoverKRW\r\n'+date+','+date+'T15:30:00+09:00,000660,"회사, 이름",KOSPI,반도체|AI,"50,000",4,"100,000,000"\r\n';const [parsed]=parseCSV(content);assert.equal(parsed.stocks[0].symbol,'000660');assert.equal(parsed.stocks[0].name,'회사, 이름');assert.equal(parsed.stocks[0].turnoverKRW,1e8);assert.equal(parsed.stocks[0].price,50000);});
test('잘못된 날짜·중복 종목·불완전 위험점수·비숫자 값을 거절한다',()=>{assert.throws(()=>validateSnapshot({...snap,date:'2026-02-30'}));assert.throws(()=>validateSnapshot({...snap,stocks:[...snap.stocks,...snap.stocks]}));assert.throws(()=>validateSnapshot({...snap,metrics:{riskFactors:{breadth:30}}}));assert.throws(()=>validateSnapshot({...snap,stocks:[{...snap.stocks[0],price:'NaN'}]}));assert.throws(()=>validateSnapshot({...snap,asOf:'2026-01-01T10:00:00+09:00'}));});
test('업로드의 알 수 없는 필드는 제거하고 중복 날짜는 거절한다',()=>{const [parsed]=validateImport({schemaVersion:2,snapshots:[{...snap,appkey:'sensitive',stocks:[{...snap.stocks[0],secret:'private'}]}]});assert.equal('appkey' in parsed,false);assert.equal('secret' in parsed.stocks[0],false);assert.throws(()=>validateImport({schemaVersion:2,snapshots:[snap,snap]}));});
test('위험점수 가중치는 30/25/20/15/10이며 50·75 경계가 정확하다',()=>{assert.equal(riskScore({riskFactors:{breadth:100,vix:0,credit:0,sox:0,treasury:0}}),30);assert.equal(riskScore({}),null);assert.equal(regime(50).name,'경계');assert.equal(regime(75).name,'위험 높음');});
test('예시 전체 기록은 검증 가능하고 시뮬레이션으로 명시한다',()=>{const samples=demoSnapshots(date);assert.ok(samples.length>0);samples.forEach(s=>{validateSnapshot(s);assert.match(s.source,/시뮬레이션/);});});
test('ETF 순위는 KODEX만 포함하고 대금·상승률을 독립 정렬하며 +4% 필터를 쓰지 않는다',()=>{
 const etfs=Array.from({length:6},(_,i)=>({symbol:'10000'+i,name:'KODEX 테스트'+i,price:10000,changePct:2-i,turnoverKRW:100+i}));
 etfs.push({symbol:'200000',name:'TIGER 제외',price:10000,changePct:99,turnoverKRW:99999});
 const before=etfs.map(x=>x.symbol);
 assert.deepEqual(rankKodex(etfs).map(x=>x.symbol),['100005','100004','100003','100002','100001']);
 assert.deepEqual(rankKodex(etfs,'change').map(x=>x.symbol),['100000','100001','100002','100003','100004']);
 assert.deepEqual(etfs.map(x=>x.symbol),before);assert.deepEqual(rankKodex(),[]);
});
test('지수·환율·ETF를 검증하면서 구버전 기록도 읽고 새 영숫자 ETF 코드를 보존한다',()=>{
 const parsed=validateSnapshot({...snap,metrics:{kospi:3123.45,kosdaq:891.25,nasdaqFutures:21845.75,usdKrw:1351.4,kospiChangePct:0.85,usdKrwChangePct:-0.12},etfs:[{symbol:'0241d0',name:'KODEX 신규 ETF',price:10000,changePct:1.4,turnoverKRW:1e8,secret:'exclude'}]});
 assert.equal(parsed.metrics.nasdaqFutures,21845.75);assert.equal(parsed.metrics.usdKrw,1351.4);assert.equal(parsed.etfs[0].symbol,'0241D0');assert.equal('secret' in parsed.etfs[0],false);assert.deepEqual(validateSnapshot(snap).etfs,[]);
});
test('잘못된 새 지표·ETF 중복·거래대금 단위값을 저장 전에 거절한다',()=>{
 const etf={symbol:'069500',name:'KODEX 200',price:10000,changePct:2,turnoverKRW:1e8};
 assert.throws(()=>validateSnapshot({...snap,metrics:{usdKrw:'1350'}}));assert.throws(()=>validateSnapshot({...snap,metrics:{nasdaqFutures:NaN}}));
 assert.throws(()=>validateSnapshot({...snap,etfs:[etf,etf]}));assert.throws(()=>validateSnapshot({...snap,etfs:[{...etf,turnoverKRW:-1}]}));assert.throws(()=>validateSnapshot({...snap,etfs:null}));
});
