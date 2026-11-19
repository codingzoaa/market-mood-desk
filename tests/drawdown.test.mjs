import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawdownAnalysis,validatePrices} from '../src/drawdown-data.mjs';
import {priceRows,drawdownScope,validSymbol} from '../worker/drawdown.mjs';
const points=values=>values.map((close,i)=>({date:'2026-01-'+String(i+1).padStart(2,'0'),close}));
test('drawdown uses past peaks, identifies full episodes, recovery and current unrecovered decline',()=>{
 const a=drawdownAnalysis(points([100,80,50,100,120,90]),20);
 assert.equal(a.mdd,-50);assert.equal(a.current,-25);assert.equal(a.worst.peakDate,'2026-01-01');assert.equal(a.worst.troughDate,'2026-01-03');assert.equal(a.worst.recoveryDate,'2026-01-04');assert.equal(a.worst.days,3);assert.equal(a.episodes[1].recoveryDate,null);
 assert.deepEqual(a.points.map(p=>p.drawdown),[0,-19.999999999999996,-50,0,0,-25]);
});
test('period selection resets peak and never uses future prices',()=>{
 const h=[{date:'2010-01-01',close:1000},{date:'2025-01-01',close:100},{date:'2026-01-01',close:80}];
 const a=drawdownAnalysis(h,1);assert.equal(a.mdd,-19.999999999999996);assert.equal(a.points[0].drawdown,0);
 assert.equal(drawdownAnalysis(h,'ALL').mdd,-92);assert.deepEqual(drawdownAnalysis(points([100,80]),20).points,drawdownAnalysis(points([100,80,500]),20).points.slice(0,2));
});
test('new highs and flat series have zero MDD and no decline episodes',()=>{for(const h of [points([100,100,100]),points([100,110,120])]){const a=drawdownAnalysis(h);assert.equal(a.mdd,0);assert.equal(a.worst,null);assert.equal(a.episodes.length,0);}});
test('adjusted price validation rejects duplicates, zero, invalid dates and unadjusted data',()=>{
 const v={adjusted:true,points:points([100,90])};assert.equal(validatePrices(v).length,2);
 for(const raw of [{...v,adjusted:false},{...v,points:[...v.points,v.points[0]]},{...v,points:[{date:'2026-02-30',close:1},v.points[0]]},{...v,points:points([100,0])}])assert.throws(()=>validatePrices(raw));
});
test('LS normalization retains positive daily closes, validates symbols and separates intraday cache',()=>{
 assert.deepEqual(priceRows([{date:'20261113',close:'5000'},{date:'20261112',close:0}]),[{date:'2026-11-13',close:5000}]);
 assert.throws(()=>priceRows([{date:'20260230',close:1}]));assert.equal(validSymbol('../005930'),false);assert.equal(validSymbol('005930'),true);
 assert.notEqual(drawdownScope(new Date('2026-11-16T14:00:00+09:00')).cacheDay,drawdownScope(new Date('2026-11-16T16:00:00+09:00')).cacheDay);
});

test('a response for a different stock cannot be rendered under the selected name',()=>{const p={symbol:'005930',adjusted:true,points:points([100,90])};assert.equal(validatePrices(p,'005930').length,2);assert.throws(()=>validatePrices(p,'000660'),/종목이 다릅니다/);});

test('index prices use point units and cannot bypass adjusted-stock validation',()=>{
 const raw={symbol:'KOSPI',kind:'INDEX',unit:'P',adjusted:false,points:points([3000,2400,2700])};
 assert.equal(validatePrices(raw,'KOSPI').length,3);assert.equal(drawdownAnalysis(validatePrices(raw)).mdd,-19.999999999999996);
 assert.throws(()=>validatePrices(raw,'KOSDAQ'));
 assert.throws(()=>validatePrices({...raw,symbol:'005930'}));assert.throws(()=>validatePrices({...raw,unit:'KRW'}));
 assert.equal(validSymbol('KOSPI'),true);assert.equal(validSymbol('KOSDAQ'),true);assert.equal(validSymbol('INDEX:001'),false);
});

test('index history starts at 1980 with a separate cache and supports over 10000 daily points',()=>{
 const now=new Date('2026-11-19T18:00:00+09:00');const index=drawdownScope(now,'KOSPI'),stock=drawdownScope(now,'005930');
 assert.equal(index.from,'1980-01-01');assert.equal(drawdownScope(now,'KOSDAQ').from,'1980-01-01');assert.notEqual(index.cacheDay,stock.cacheDay);assert.ok(stock.from>'2000-01-01');
 const history=Array.from({length:12000},(_,i)=>({date:new Date(Date.UTC(1980,0,1+i)).toISOString().slice(0,10),close:100+i}));
 assert.equal(validatePrices({symbol:'KOSPI',kind:'INDEX',unit:'P',adjusted:false,points:history},'KOSPI').length,12000);
 assert.throws(()=>validatePrices({symbol:'005930',adjusted:true,points:history},'005930'));
});
