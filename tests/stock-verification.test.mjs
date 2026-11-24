import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseKindCompanies,officialSector,verifyKindIdentity,sectorCandidate,VERIFICATION_METHOD,KIND_SOURCE} from '../worker/stock-verification.mjs';
import {verifyRegistry} from '../scripts/verify_stock_sectors.mjs';
import {attachStockSectors,top100Missing,syncStockRegistry} from '../worker/stock-registry.mjs';
const now='2026-11-09T09:00:00.000Z';
const quote=(symbol='035420',name='NAVER',market='KOSPI')=>({symbol,name,market,themes:[],price:12345,turnoverKRW:123456789,changePct:5});
const issuer=(symbol='035420',name='NAVER',market='KOSPI')=>({symbol,name,market,industry:'자료처리, 호스팅, 포털 및 기타 인터넷 정보매개 서비스업',products:'포털 서비스 및 온라인 광고'});
const html=(rows)=>'<table><tr><th>업종</th><th>종목코드</th><th>주요제품</th><th>시장구분</th><th>회사명</th></tr>'+rows.map(r=>'<tr>'+[r.industry,r.symbol,r.products,r.market==='KOSPI'?'유가':'코스닥',r.name].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</table>';
function fixture(){return {dashboard:{schemaVersion:2,snapshots:[{date:'2026-11-09',asOf:now,source:'LS증권 KRX',stocks:[quote('005930','삼성전자'),quote(),quote('005935','삼성전자우'),quote('069500','KODEX 200')]}]},registry:{version:1,entries:[]},catalog:[{symbol:'005930'}],previous:{version:1,method:VERIFICATION_METHOD,entries:[]},issuers:[issuer()],checkedAt:now,sourceHash:'a'.repeat(64)}}
test('official listing parser uses named columns, supports current alphanumeric issues, and validates full-source coverage',()=>{
 const rows=[issuer(),issuer('0015S0','신규기업','KOSDAQ')];const parsed=parseKindCompanies(html(rows),{minRows:1});assert.equal(parsed.length,2);assert.equal(parsed[0].symbol,'035420');assert.equal(parsed[1].symbol,'0015S0');
 assert.throws(()=>parseKindCompanies(html(rows)),/COVERAGE/);assert.throws(()=>parseKindCompanies(html([rows[0],rows[0]]),{minRows:1}),/IDENTITY/);assert.throws(()=>parseKindCompanies('<html>로그인</html>',{minRows:1}),/HEADER/);assert.throws(()=>parseKindCompanies(html(rows)+'\ufffd',{minRows:1}),/ENCODING/);
});
test('three identity fields must agree; names are normalized without borrowing common-share identities for preferred shares',()=>{
 const ok=verifyKindIdentity(quote('035420','㈜ Naver'),issuer(),now);assert.equal(ok.verification.status,'verified');assert.equal(ok.sector,'인터넷');assert.equal(ok.breadth,false);assert.equal(ok.verification.sourceUrl,KIND_SOURCE);
 assert.equal(verifyKindIdentity(quote(),issuer('035420','NAVER','KOSDAQ'),now).verification.reason,'ISSUER_IDENTITY_MISMATCH');
 assert.equal(verifyKindIdentity(quote('005935','삼성전자우'),undefined,now).verification.reason,'NO_OFFICIAL_ISSUER');
 assert.equal(verifyKindIdentity(quote(),issuer('035420','다른회사'),now).reviewRequired,true);
});
test('ambiguous industries remain pending; broad official industries never create speculative trading themes',()=>{
 assert.equal(officialSector({...issuer(),industry:'기타 전문 도매업',products:'건설, 도소매, 의복'}),null);
 assert.equal(officialSector({...issuer(),industry:'소프트웨어 개발 및 자동차 제조업',products:'확인되지 않은 사업'}),null);
 assert.equal(officialSector({...issuer(),industry:'기타 금융업',products:'지주회사'}),'지주사');
 const x=verifyKindIdentity(quote(),{...issuer(),industry:'기타 전문 도매업',products:'확인되지 않은 사업'},now);assert.equal(x.verification.status,'pending');assert.deepEqual(x.themes,[]);assert.ok(!('price' in x));
});
test('funds, leveraged instruments and SPACs are excluded from the classification queue',()=>{
 for(const name of ['KODEX 200','TIGER 반도체','TIME 미국AI','테스트 ETN','테스트 인버스','테스트스팩1호'])assert.equal(sectorCandidate(quote('123456',name)),false);
 assert.equal(sectorCandidate(quote()),true);
});
test('pending candidates are revisited while curated members and quote records stay unchanged',()=>{
 const f=fixture(),saved=structuredClone(f.dashboard);f.previous.entries=[{...quote(),sector:'분류 대기',reviewRequired:true}];
 const {output,report}=verifyRegistry(f);assert.equal(output.entries.length,2);assert.equal(report.verified,1);assert.equal(report.pending,1);assert.ok(output.entries.every(x=>x.breadth===false));assert.ok(!output.entries.some(x=>x.symbol==='005930'||x.symbol==='069500'));assert.deepEqual(f.dashboard,saved);
 assert.equal(output.entries.find(x=>x.symbol==='035420').verification.status,'verified');
});
test('same-day stable data avoids commits, and a failed prior deployment is retried without creating a new data commit',()=>{
 const f=fixture(),first=verifyRegistry(f);f.previous=first.output;f.registry={version:1,entries:first.output.entries,verification:{checkedAt:first.output.checkedAt,sourceSha256:first.output.sourceSha256}};
 let r=verifyRegistry({...f,checkedAt:'2026-11-09T10:00:00.000Z'});assert.equal(r.changed,false);assert.equal(r.report.deployNeeded,false);
 f.registry.verification.checkedAt='2026-11-08T09:00:00.000Z';r=verifyRegistry(f);assert.equal(r.changed,false);assert.equal(r.report.deployNeeded,true);
});
test('wrong source/date/schema cannot replace the verified manifest',()=>{
 const f=fixture();assert.throws(()=>verifyRegistry({...f,registry:{version:2,entries:[]}}),/REGISTRY_SCHEMA/);
 const bad=structuredClone(f);bad.dashboard.snapshots[0].date='2026-11-10';assert.throws(()=>verifyRegistry(bad),/SOURCE_OR_DATE/);
});
test('runtime applies official classifications to current quotes and withholds unresolved or identity-mismatched entries',()=>{
 const stock=quote(),verified=verifyKindIdentity(stock,issuer(),now),snapshot={date:'2026-11-09',stocks:[{...stock,themes:['임시 LS 테마']}]};
 assert.deepEqual(attachStockSectors(snapshot,{entries:[verified]}).stocks[0].themes,['인터넷']);
 assert.deepEqual(attachStockSectors(snapshot,{entries:[{...verified,verification:{...verified.verification,status:'pending'},reviewRequired:true}]}).stocks[0].themes,[]);
 assert.deepEqual(attachStockSectors(snapshot,{entries:[{...verified,name:'다른회사'}]}).stocks[0].themes,[]);
 assert.deepEqual(attachStockSectors({...snapshot,date:'2026-11-08'},{entries:[verified]}).stocks[0].themes,['임시 LS 테마']);
});
test('an existing pending entry is not mistaken for resolved and retries upsert rather than duplicate it',async()=>{
 const stock=quote('123450','미분류기업');let stored={entries:[{...stock,sector:'분류 대기',reviewRequired:false}]},calls=0;
 assert.equal(top100Missing([stock],[],stored.entries).length,1);
 const env={DB:{prepare(sql){return {bind(...args){this.args=args;return this},async first(){return {payload:JSON.stringify(stored)}},async run(){stored=JSON.parse(this.args[1]);return {success:true}}}}}};
 const request=async()=>{calls++;return {data:{t1532OutBlock:[]}}};
 await syncStockRegistry(env,{date:'2026-11-09',stocks:[stock],etfs:[]},request,async()=>{});
 assert.equal(stored.entries.filter(x=>x.symbol===stock.symbol).length,1);const row=stored.entries.find(x=>x.symbol===stock.symbol);assert.equal(row.reviewRequired,true);assert.ok(Date.parse(row.nextRetryAt)>Date.now());
 await syncStockRegistry(env,{date:'2026-11-09',stocks:[stock],etfs:[]},request,async()=>{});assert.equal(calls,1);
});

test('new product evidence resolves robot, precision component and platform listings without relaxing identity checks',()=>{
 const cases=[['090710','휴림로봇','특수 목적용 기계 제조업','제조업용로봇및서비스로봇','로봇'],['466100','클로봇','소프트웨어 개발 및 공급업','로봇 소프트웨어(카멜레온, 크롬스)','로봇'],['232680','라온로보틱스','특수 목적용 기계 제조업','반도체 및 FPD용 로봇시스템','로봇'],['448900','한국피아이엠','자동차 신품 부품 제조업','내연기관 부품(터보차저), IT 부품(스마트워치)','자동차'],['293490','카카오게임즈','소프트웨어 개발 및 공급업','모바일, PC게임 퍼블리싱','인터넷'],['439960','코스모로보틱스','의료용 기기 제조업','웨어러블 로봇','로봇']];
 for(const [symbol,name,industry,products,sector] of cases){const evidence={symbol,name,industry,products,market:'KOSDAQ'};const result=verifyKindIdentity(quote(symbol,name,'KOSDAQ'),evidence,now);assert.equal(result.sector,sector);assert.equal(result.reviewRequired,false);assert.ok(result.subSector&&result.themes.length);assert.equal(verifyKindIdentity(quote(symbol,'다른회사','KOSDAQ'),evidence,now).reviewRequired,true);}
});
test('legacy product overrides require exact issuer identity and retain primary business provenance',()=>{
 const evidence={symbol:'037270',name:'YG PLUS',market:'KOSPI',industry:'자료처리, 호스팅, 포털 및 기타 인터넷 정보매개 서비스업',products:'광고대행,광고물 제작'};
 const result=verifyKindIdentity(quote('037270','YG PLUS'),evidence,now);assert.equal(result.sector,'엔터·콘텐츠');assert.equal(result.verification.businessSourceUrl,'https://www.ygplus.com/business/music');
 assert.equal(verifyKindIdentity(quote('037270','YG PLUS'),{...evidence,industry:'변경된 업종'},now).reviewRequired,true);
});
test('documented truncated issuer alias is exact and never enables arbitrary prefix matches',()=>{
 const evidence={symbol:'950260',name:'인제니아테라퓨틱스',market:'KOSDAQ',industry:'자연과학 및 공학 연구개발업',products:'IGT-427(안구망막질환 치료제)'};
 const result=verifyKindIdentity(quote('950260','인제니아테라퓨틱스(R','KOSDAQ'),evidence,now);assert.equal(result.sector,'바이오');assert.equal(result.verification.identityAlias,true);
 assert.equal(verifyKindIdentity(quote('950260','인제니아','KOSDAQ'),evidence,now).reviewRequired,true);
});
