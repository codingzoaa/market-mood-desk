import test from 'node:test';
import assert from 'node:assert/strict';
import {FRAMES,summarize,normalizeBars,classify,scannerCandidates,regularDailyBars,resampleSession,loadSessionBars} from '../worker/vwma-scanner.mjs';
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
test('a provider silently returning shorter intervals cannot masquerade as 240-minute data',()=>{const rows=Array.from({length:5},(_,i)=>({date:'20261126',time:String(100000+i*10000),close:100,jdiff_vol:10}));assert.throws(()=>normalizeBars(rows,'240',new Date('2026-11-28T00:00:00+09:00')),/CHART_INTERVAL_MISMATCH/);});
test('invalid dates fail, normal session flags survive, explicit adjustment rates require review',()=>{assert.throws(()=>normalizeBars([{date:'20260230',time:'100000',close:100,jdiff_vol:10}],'5',new Date('2026-11-28')),/CHART_TIMESTAMP/);assert.equal(normalizeBars([{date:'20261126',time:'100000',close:100,jdiff_vol:10,jongchk:2162688,rate:'0.00'}],'5',new Date('2026-11-28')).length,1);assert.throws(()=>summarize([{at:1,p:100,v:1,adjustmentRate:0},{at:2,p:100,v:1,adjustmentRate:0},{at:3,p:50,v:2,adjustmentRate:-50}],2),/CORPORATE_ACTION_REVIEW/);});

test('daily VWMA uses only complete regular-session pairs and excludes aftermarket volume',()=>{const rows=[{date:'20261126',time:'130000',close:100,jdiff_vol:10,jongchk:2097152,rate:'0.00'},{date:'20261126',time:'153000',close:110,jdiff_vol:20,jongchk:2162688,rate:'0.00'},{date:'20261126',time:'200000',close:500,jdiff_vol:999,jongchk:2162688,rate:'0.00'}],now=new Date('2026-11-28');const daily=regularDailyBars(normalizeBars(rows,'240',now),now);assert.equal(daily.length,1);assert.equal(daily[0].p,110);assert.equal(daily[0].v,30);assert.equal(regularDailyBars(normalizeBars(rows.slice(1),'240',now),now).length,0);});

test('opening auction is included when LS supplies a separate session-open bar',()=>{const now=new Date('2026-11-28'),rows=[{date:'20261126',time:'090000',close:100,jdiff_vol:7},{date:'20261126',time:'130000',close:105,jdiff_vol:10},{date:'20261126',time:'153000',close:110,jdiff_vol:20},{date:'20261126',time:'200000',close:900,jdiff_vol:999}];const daily=regularDailyBars(normalizeBars(rows,'240',now),now);assert.equal(daily.length,1);assert.equal(daily[0].v,37);assert.equal(daily[0].p,110);});

test('delayed-session 60/240-minute reconstruction conserves volume and uses the actual close',()=>{const date='2026-11-19',bars=Array.from({length:78},(_,i)=>({day:'20261119',at:Date.parse(date+'T10:05:00+09:00')+i*300000,p:100+i,v:10,adjustmentRate:0})),hours=resampleSession(bars,date,'60'),four=resampleSession(bars,date,'240');assert.equal(hours.length,7);assert.equal(four.length,2);assert.equal(new Date(four[0].at).toISOString(),'2026-11-19T05:00:00.000Z');assert.equal(new Date(four[1].at).toISOString(),'2026-11-19T07:30:00.000Z');assert.equal(four.reduce((a,b)=>a+b.v,0),780);assert.equal(regularDailyBars(four,new Date('2026-11-28'))[0].v,780);assert.throws(()=>resampleSession(bars.slice(0,-1),date,'240'),/CHART_SPECIAL_SESSION_INCOMPLETE/);});

test('an isolated auction or partial interval does not reject a correctly spaced provider series',()=>{const times=['100000','110000','113000','120000','130000','140000','150000','153000'],rows=times.map(time=>({date:'20261126',time,close:100,jdiff_vol:10}));assert.equal(normalizeBars(rows,'60',new Date('2026-11-28')).length,8);});

test('historical five-minute pagination joins a truncated day without counting a repeated boundary twice',async()=>{const raw=Array.from({length:78},(_,i)=>{const t=605+i*5;return{date:'20261119',time:String(Math.floor(t/60)).padStart(2,'0')+String(t%60).padStart(2,'0')+'00',close:100+i,jdiff_vol:10,rate:'0.00'};}),page={data:{t8412OutBlock1:raw.slice(34),t8412OutBlock:{cts_date:'20261119',cts_time:raw[34].time}},continuation:{flag:'Y',key:'synthetic'}};let calls=0;const result=await loadSessionBars(page,'2026-11-19',new Date('2026-11-28'),async(date,time,continuation)=>{calls++;assert.equal(date,'20261119');assert.equal(time,raw[34].time);assert.equal(continuation.key,'synthetic');return{data:{t8412OutBlock1:raw.slice(0,35)}};});assert.equal(calls,1);assert.equal(result.bars.length,78);assert.equal(result.bars.reduce((s,b)=>s+b.v,0),780);});
