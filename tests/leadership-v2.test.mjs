import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateLeadership,WEIGHTS,METHODOLOGY_VERSION,relativeStrength,relativeVolume,persistence,breadth,priceStructure,grade,rotationState,legacyDataQuality,ScoreLedger,finish} from '../src/analytics/index.ts';
// Explicit synthetic provider evidence, never connected to the production collectors.
const date='2026-10-20',asOf=date+'T10:00:59+09:00';
const days=[];for(let d=new Date('2026-06-01T00:00:00Z');d.toISOString().slice(0,10)<=date;d.setUTCDate(d.getUTCDate()+1))if(![0,6].includes(d.getUTCDay()))days.push(d.toISOString().slice(0,10));
const previous=days.filter(d=>d<date).slice(-80);
function history(base=100,step=1){return previous.map((date,i)=>({date,availableAt:date+'T15:31:00+09:00',source:'LS fixture',final:true,adjusted:true,close:base+i*step,open:base+i*step-.1,high:base+i*step+.5,low:base+i*step-.5,turnoverKRW:100,cumulative:{'1000':50,'1530':100}}));}
function fixture(mode='INTRADAY',type='SECTOR'){
 const q={symbol:'000660',name:'SK하이닉스',market:'KOSPI',instrumentType:'STOCK',asOf:date+'T10:00:00+09:00',availableAt:date+'T10:00:05+09:00',price:200,previousClose:179,turnoverKRW:150,open:185,high:205,low:180,history:history(),bars:[{asOf:date+'T09:55:00+09:00',availableAt:date+'T09:55:01+09:00',high:190,low:185,close:189},{asOf:date+'T10:00:00+09:00',availableAt:date+'T10:00:05+09:00',high:205,low:190,close:200}]};
 const b={...structuredClone(q),symbol:'KOSPI',price:120,previousClose:115.8,open:118,high:121,low:117,history:history(100,.2)};
 const input={date,asOf,source:'LS fixture',universe:'SAMPLED_UNIVERSE',isTradingDay:true,calendar:{verified:true,tradingDays:days},quotes:[q],benchmarks:{KOSPI:b},entity:{type,id:type==='SECTOR'?'반도체':'000660',...(type==='SECTOR'?{membership:{symbols:['000660'],effectiveDate:previous[0],knownAt:previous[0]+'T08:00:00+09:00',version:'fixture-members-v1'}}:{})}};
 if(mode==='EOD'){
  input.asOf=date+'T16:00:00+09:00';
  for(const quote of [q,b]){quote.asOf=date+'T15:30:00+09:00';quote.availableAt=date+'T15:30:10+09:00';quote.turnoverKRW=300;quote.finality={sourceConfirmed:true,source:'provider-final-status fixture',confirmedAt:date+'T15:31:00+09:00',finalPrice:true,finalTurnover:true,finalOHLC:true};}
 }
 if(type==='STOCK'){const sector=fixture(mode,'SECTOR');input.sectorId='반도체';input.sectorScore=calculateLeadership(sector,mode);}
 return input;
}
test('four independent calculators use exact specified weights and bounded scores with distinct keys',()=>{
 const keys=[];
 for(const type of ['SECTOR','STOCK'])for(const mode of ['INTRADAY','EOD']){
  assert.equal(Object.values(WEIGHTS[type][mode]).reduce((a,b)=>a+b,0),100);
  const result=calculateLeadership(fixture(mode,type),mode);assert.equal(result.status,mode==='EOD'?'FINAL':'PROVISIONAL',JSON.stringify(result));assert.ok(result.score>=0&&result.score<=100);assert.equal(result.score,Math.round(Object.values(result.factors).reduce((s,n)=>s+n,0)*100)/100);assert.equal(result.universe,'SAMPLED_UNIVERSE');assert.ok(result.grade);keys.push(result.id);
 }assert.equal(new Set(keys).size,4);assert.equal(WEIGHTS.STOCK.INTRADAY.structure,25);assert.equal(WEIGHTS.STOCK.EOD.structure,20);
});
test('every essential missing feature nulls the total without renormalizing the remaining factors',()=>{
 for(const mode of ['INTRADAY','EOD']){
  const input=fixture(mode);input.quotes[0].history=[];const result=calculateLeadership(input,mode);assert.equal(result.status,'INSUFFICIENT_DATA');assert.equal(result.score,null);assert.equal(result.grade,null);assert.equal(result.factors.rvol,null);assert.ok(result.missingFactors.includes('rvol'));
 }
 const stock=fixture('INTRADAY','STOCK');delete stock.sectorScore;assert.equal(calculateLeadership(stock,'INTRADAY').factors.sector,null);
});
test('intraday RVOL requires all twenty matching slots and never substitutes final daily turnover',()=>{
 const input=fixture();assert.equal(relativeVolume(input,'INTRADAY'),3);assert.equal(relativeVolume(input,'EOD'),1.5);
 const bar=input.quotes[0].history.at(-1);delete bar.cumulative['1000'];assert.equal(relativeVolume(input,'INTRADAY'),null);assert.equal(relativeVolume(input,'EOD'),1.5);
});
test('nineteen trading days, zero denominator and unverified calendars cannot produce RVOL',()=>{
 const input=fixture();input.quotes[0].history=input.quotes[0].history.slice(-19);assert.equal(relativeVolume(input,'INTRADAY'),null);
 const zero=fixture();zero.quotes[0].history.forEach(p=>p.cumulative['1000']=0);assert.equal(relativeVolume(zero,'INTRADAY'),null);
 const cal=fixture();cal.calendar.verified=false;assert.equal(calculateLeadership(cal,'INTRADAY').score,null);
});
test('same-slot and availability alignment reject delayed quotes, missing markets and future values',()=>{
 const input=fixture();input.quotes[0].asOf=date+'T09:55:00+09:00';assert.equal(calculateLeadership(input,'INTRADAY').score,null);
 const future=fixture();future.benchmarks.KOSPI.availableAt=date+'T10:01:00+09:00';assert.equal(calculateLeadership(future,'INTRADAY').score,null);
 const missing=fixture();delete missing.benchmarks.KOSPI;assert.equal(calculateLeadership(missing,'INTRADAY').score,null);
});
test('source finality is mandatory; time alone, partial finality and future confirmation never imply FINAL',()=>{
 for(const mutate of [q=>delete q.finality,q=>q.finality.sourceConfirmed=false,q=>q.finality.finalTurnover=false,q=>q.finality.confirmedAt=date+'T17:00:00+09:00']){
  const input=fixture('EOD');mutate(input.quotes[0]);const score=calculateLeadership(input,'EOD');assert.equal(score.status,'INSUFFICIENT_DATA');assert.equal(score.score,null);assert.equal(score.factors.rs,null);
 }
 const market=fixture('EOD');delete market.benchmarks.KOSPI.finality;assert.equal(calculateLeadership(market,'EOD').status,'INSUFFICIENT_DATA');
 assert.equal(calculateLeadership(fixture('EOD'),'EOD').status,'FINAL');
});
test('KOSPI and KOSDAQ benchmarks mix by fixed member counts, not turnover or positive-only candidates',()=>{
 const input=fixture();const second={...structuredClone(input.quotes[0]),symbol:'005930',name:'삼성전자',market:'KOSDAQ',price:90,previousClose:100};input.quotes.push(second);input.entity.membership.symbols.push(second.symbol);
 input.benchmarks.KOSDAQ={...structuredClone(input.benchmarks.KOSPI),symbol:'KOSDAQ',price:80,previousClose:100};
 const expected=(((200/179-120/115.8)*100)+10)/2;assert.ok(Math.abs(relativeStrength(input)-expected)<1e-9);assert.equal(breadth(input),.5);
 second.turnoverKRW=1e9;assert.ok(Math.abs(relativeStrength(input)-expected)<1e-9);assert.equal(breadth(input),.5);
});
test('future rows and unavailable revisions do not change historical scores or mutate input',()=>{
 const input=fixture('EOD'),baseline=calculateLeadership(input,'EOD');
 input.quotes[0].history.push({...input.quotes[0].history[0],date:'2026-10-21',close:999999,availableAt:'2026-10-21T15:31:00+09:00'});
 input.quotes[0].history.push({...input.quotes[0].history.at(-2),close:999999,availableAt:'2026-10-21T15:31:00+09:00'});
 const before=structuredClone(input);assert.deepEqual(calculateLeadership(input,'EOD'),baseline);assert.deepEqual(input,before);
});
test('duplicate symbols/membership, demo sources and non-trading days are invalidated',()=>{
 const duplicate=fixture();duplicate.quotes.push(structuredClone(duplicate.quotes[0]));assert.equal(calculateLeadership(duplicate,'INTRADAY').status,'INVALIDATED');
 const membership=fixture();membership.entity.membership.symbols.push('000660');assert.equal(calculateLeadership(membership,'INTRADAY').status,'INVALIDATED');
 const demo=fixture();demo.source='시뮬레이션';assert.equal(calculateLeadership(demo,'INTRADAY').status,'INVALIDATED');
 const holiday=fixture();holiday.isTradingDay=false;assert.equal(calculateLeadership(holiday,'INTRADAY').status,'INVALIDATED');
});
test('product types, known ETF identifiers and leverage/inverse names cannot enter a score',()=>{
 for(const change of [{instrumentType:'ETF'},{instrumentType:'ETN'},{name:'KODEX 200'},{name:'인버스 상품'},{name:'레버리지 상품'}]){
  const input=fixture('INTRADAY','STOCK');Object.assign(input.quotes[0],change);assert.equal(calculateLeadership(input,'INTRADAY').score,null);
 }
 const known=fixture('INTRADAY','STOCK');known.excludedProductSymbols=['000660'];assert.equal(calculateLeadership(known,'INTRADAY').score,null);
});
test('old fixed membership is required and cannot be replaced by future theme classification',()=>{
 const input=fixture('EOD');input.entity.membership.effectiveDate=date;assert.equal(calculateLeadership(input,'EOD').factors.rs,null);
 const future=fixture();future.entity.membership.knownAt='2026-10-21T00:00:00+09:00';assert.equal(calculateLeadership(future,'INTRADAY').status,'INVALIDATED');
});
test('price-only or inconsistent candles cannot confirm breakouts; EOD requires sixty actual bars',()=>{
 const input=fixture('INTRADAY','STOCK');delete input.quotes[0].bars;assert.equal(priceStructure(input,'INTRADAY'),null);
 const candles=fixture('INTRADAY','STOCK');candles.quotes[0].bars.at(-1).close=190;assert.equal(priceStructure(candles,'INTRADAY'),null);
 const eod=fixture('EOD','STOCK');eod.quotes[0].history=eod.quotes[0].history.slice(-59);assert.equal(priceStructure(eod,'EOD'),null);
});
test('persistence uses previous five completed returns and does not incorporate today',()=>{
 const input=fixture(),p=persistence(input);input.quotes[0].price=1;assert.equal(persistence(input),p);assert.equal(p,1);
 input.quotes[0].history.at(-1).final=false;assert.equal(persistence(input),null);
});
test('a stock requires the exact precomputed sector date, mode, identity, scope and methodology',()=>{
 for(const change of [{mode:'EOD'},{date:'2026-10-19'},{entityId:'다른 업종'},{universe:'FULL_MARKET'},{asOf:date+'T10:05:00+09:00'},{methodologyVersion:'future-v3'}]){
  const input=fixture('INTRADAY','STOCK');Object.assign(input.sectorScore,change);assert.equal(calculateLeadership(input,'INTRADAY').factors.sector,null);
 }
});
test('ledger prevents duplicate writes, preserves separate modes and versions, and rejects a changed same-key result',()=>{
 const ledger=new ScoreLedger(),a=calculateLeadership(fixture(),'INTRADAY'),b=calculateLeadership(fixture('EOD'),'EOD');
 assert.equal(ledger.append(a),true);assert.equal(ledger.append(a),false);ledger.append(b);
 const input=fixture(),next=finish(input,'INTRADAY',{rs:1,rvol:1,breadth:1,persistence:1,leaders:1},[],METHODOLOGY_VERSION+'-next');ledger.append(next);assert.equal(ledger.all().length,3);
 assert.throws(()=>ledger.append({...a,score:0}),/KEY_CONFLICT/);const result=ledger.all();result[0].score=0;assert.notEqual(ledger.all()[0].score,0);
});
test('grade boundaries and independent neutral rotation thresholds are explicit and configurable',()=>{
 assert.equal(grade(85),'핵심 주도 후보');assert.equal(grade(70),'강세');assert.equal(grade(50),'관찰');assert.equal(grade(49.99),'비주도');assert.equal(grade(null),null);assert.equal(grade(90,{core:95,strong:80,watch:60}),'강세');assert.throws(()=>grade(80,{core:50,strong:70,watch:60}));
 assert.equal(rotationState(1,.5),'강화');assert.equal(rotationState(1,2),'둔화');assert.equal(rotationState(-1,-2),'회복');assert.equal(rotationState(-2,-1),'부진');assert.equal(rotationState(1,1.01),'중립');assert.equal(rotationState(null,1),null);
});
test('legacy quality marks sampled coverage and zero certified history, without fabricating missing fields',()=>{
 const snapshot={date,asOf:date+'T09:40:00+09:00',source:'LS증권 KRX',stocks:[{symbol:'000660',name:'SK하이닉스',market:'KOSPI',themes:['반도체','AI'],price:100,changePct:5,turnoverKRW:100}],metrics:{},note:''};
 const quality=legacyDataQuality(snapshot,{asOf,lastSuccessAt:date+'T11:00:00+09:00'});assert.equal(quality.universe,'SAMPLED_UNIVERSE');assert.equal(quality.stockCount,1);assert.equal(quality.classifiedCount,1);assert.equal(quality.historicalTradingDays,0);assert.equal(quality.lastSuccessAt,null);assert.equal(quality.stale,true);assert.ok(quality.missingFields.includes('sameTimeTurnover20d'));
 assert.ok(legacyDataQuality(null,{asOf}).missingFields.includes('snapshot'));
});
test('KST session boundaries and timezone-equivalent replays yield stable keys',()=>{
 const input=fixture();const before=calculateLeadership(input,'INTRADAY');input.asOf=new Date(input.asOf).toISOString();assert.deepEqual(calculateLeadership(input,'INTRADAY'),before);
 const late=fixture();late.asOf=date+'T15:31:00+09:00';assert.equal(calculateLeadership(late,'INTRADAY').status,'INVALIDATED');
 const early=fixture();early.asOf=date+'T08:59:00+09:00';assert.equal(calculateLeadership(early,'INTRADAY').status,'INVALIDATED');
 const wrong=fixture();wrong.asOf='2026-10-19T10:00:00+09:00';assert.equal(calculateLeadership(wrong,'INTRADAY').status,'INVALIDATED');
});

test('component normalization stays in range at both extremes and never replaces an unavailable factor by zero',()=>{
 for(const type of ['SECTOR','STOCK'])for(const mode of ['INTRADAY','EOD']){
  const input=fixture(mode,type);
  for(const value of [0,1]){
   const raw=Object.fromEntries(Object.keys(WEIGHTS[type][mode]).map(k=>[k,value]));const result=finish(input,mode,raw,[]);assert.equal(result.score,value*100);for(const [name,weight] of Object.entries(WEIGHTS[type][mode]))assert.equal(result.factors[name],weight*value);
  }
  const raw=Object.fromEntries(Object.keys(WEIGHTS[type][mode]).map(k=>[k,1]));raw.rs=NaN;const result=finish(input,mode,raw,[]);assert.equal(result.factors.rs,null);assert.equal(result.score,null);
 }
});
test('a present sector member with missing data is not silently dropped from the breadth denominator',()=>{
 const input=fixture(),q={...structuredClone(input.quotes[0]),symbol:'005930',name:'삼성전자',price:undefined};input.quotes.push(q);input.entity.membership.symbols.push(q.symbol);assert.equal(breadth(input),null);assert.equal(calculateLeadership(input,'INTRADAY').score,null);
});


test('score results do not copy arbitrary input credentials or raw provider payloads',()=>{
 const input=fixture();input.appkey='private-appkey-sentinel';input.access_token='private-token-sentinel';input.quotes[0].authorization='private-bearer-sentinel';
 const result=JSON.stringify(calculateLeadership(input,'INTRADAY'));assert.doesNotMatch(result,/private-|appkey|access_token|authorization/);
});
test('history cannot claim a final bar was available before its regular-session closing time',()=>{
 const input=fixture();input.quotes[0].history.at(-1).availableAt=input.quotes[0].history.at(-1).date+'T09:00:00+09:00';
 assert.equal(relativeVolume(input,'INTRADAY'),null);assert.equal(persistence(input),null);
});
