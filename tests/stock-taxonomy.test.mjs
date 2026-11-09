import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessTaxonomy,TAXONOMY_VERSION} from '../worker/stock-taxonomy.mjs';
import {verifyKindIdentity,resolveListedIssuer} from '../worker/stock-verification.mjs';
import catalog from '../src/data/stock-map.json' with {type:'json'};
import manifest from '../src/data/stock-map-verified.json' with {type:'json'};
const now='2026-11-09T10:00:00.000Z';
const issuer=(symbol,name,industry,products)=>({symbol,name,market:'KOSPI',industry,products});
test('product evidence resolves the semiconductor machine industry to the existing peer hierarchy',()=>{
 const x=businessTaxonomy(issuer('123450','테스트','특수 목적용 기계 제조업','반도체장비(화학증착장비)'));
 assert.equal(x.sector,'반도체');assert.equal(x.subSector,'반도체 장비');assert.deepEqual(x.themes,['증착','전공정']);
 assert.ok(catalog.some(peer=>peer.sector===x.sector&&peer.subSector===x.subSector));
 const y=businessTaxonomy(issuer('123450','테스트','특수 목적용 기계 제조업','Descum, Reflow'));assert.ok(!y.themes.includes('증착'));
 assert.equal(businessTaxonomy(issuer('123450','테스트','특수 목적용 기계 제조업','확인되지 않은 장비')),null);
});
test('themes require the matching business evidence and do not copy the broad sector',()=>{
 for(const [industry,products,expected,absent] of [
 ['기타 식품 제조업','라면,스낵',['라면','식품'],'음식료'],
 ['기초 화학물질 제조업','반도체 CMP Slurry',['공정소재'],'공정가스'],
 ['소프트웨어 개발 및 공급업','망간자료전송',['망연계','데이터보안'],'네트워크보안'],
 ['특수 목적용 기계 제조업','실리콘질화막증착용LP-CVD',['증착','전공정'],'후공정장비']
 ]){const x=businessTaxonomy(issuer('123450','테스트',industry,products));assert.deepEqual(x.themes,expected);assert.ok(!x.themes.includes(absent));}
});
test('documented aliases are limited to the exact issuer code and market',()=>{
 const official=issuer('000810','삼성화재해상보험','보험업','손해보험의 원수');
 const stock={symbol:'000810',name:'삼성화재',market:'KOSPI'};
 const x=verifyKindIdentity(stock,official,now);assert.equal(x.sector,'금융·증권');assert.equal(x.subSector,'보험');assert.equal(x.verification.identityAlias,true);
 assert.equal(verifyKindIdentity({...stock,symbol:'000811'},official,now).reviewRequired,true);
 assert.equal(verifyKindIdentity({...stock,market:'KOSDAQ'},official,now).reviewRequired,true);
 assert.equal(verifyKindIdentity(stock,{...official,name:'다른보험사'},now).reviewRequired,true);
});
test('only explicitly evidenced preferred shares inherit a parent identity',()=>{
 const parent=issuer('005930','삼성전자','통신 및 방송 장비 제조업','반도체 제조(메모리) 제품');
 const map=new Map([[parent.symbol,parent]]),stock={symbol:'005935',name:'삼성전자우',market:'KOSPI'};
 const x=verifyKindIdentity(stock,resolveListedIssuer(stock,map),now);assert.equal(x.subSector,'메모리 반도체');assert.match(x.verification.shareSourceUrl,/samsung.com/);assert.equal(x.breadth,false);
 assert.equal(resolveListedIssuer({...stock,symbol:'005936'},map),undefined);
 assert.equal(resolveListedIssuer({...stock,name:'다른종목'},map),undefined);
 assert.equal(resolveListedIssuer(stock,new Map([['005930',{...parent,name:'다른회사'}]])),undefined);
});
test('reviewed complex portfolios keep evidence, one scoring subsector and multiple business themes',()=>{
 const x=businessTaxonomy(issuer('028260','삼성물산','기타 전문 도매업','도소매, 건설'));
 assert.equal(x.sector,'건설·EPC');assert.equal(x.subSector,'종합건설');assert.ok(x.themes.includes('상사'));assert.match(x.sourceUrl,/samsungcnt.com/);
 assert.equal(businessTaxonomy(issuer('028260','다른회사','기타 전문 도매업','모르는사업')),null);
 assert.equal(businessTaxonomy(issuer('290690','아리바이오홀딩스','전구 및 조명장치 제조업','실내등')),null);
});
test('published taxonomy uses three distinct fields and keeps every original member and Breadth membership unchanged',()=>{
 assert.ok(catalog.length>=145);
 assert.equal(catalog.find(x=>x.symbol==='005930').subSector,'메모리 반도체');
 const known=new Set(catalog.map(x=>x.symbol));
 for(const x of manifest.entries){assert.equal(known.has(x.symbol),false);assert.equal(x.breadth,false);if(x.verification.status==='verified'){
 assert.equal(x.verification.taxonomyVersion,TAXONOMY_VERSION);assert.ok(x.subSector.length<25);assert.ok(x.themes.length>0);assert.ok(!(x.themes.length===1&&x.themes[0]===x.sector));assert.ok(!x.sector.endsWith('제조업'));
 }}
 assert.equal(new Set(manifest.entries.map(x=>x.symbol)).size,manifest.entries.length);
});
