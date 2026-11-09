import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectNaverHeatmap,naverHeatStock,naverHeatmapWindow,naverJson,readNaverHeatmap} from '../worker/naver-heatmap.mjs';
const date='2026-11-09',at=new Date(date+'T10:00:00+09:00');
const row=(symbol='005930',market='KOSPI')=>({itemCode:symbol,itemName:symbol==='005930'?'삼성전자':'테스트',marketType:market,stockEndType:'stock',krx:{marketCap:'100000000000',changeRate:'-2.1'},nxt:{marketCap:'999999',changeRate:'8.8'}});
function database(){const values=new Map();return {values,DB:{prepare(sql){let args;return {bind(...v){args=v;return this},async first(){if(sql.startsWith('SELECT date FROM snapshots'))return {date};return values.has(args[0])?{payload:values.get(args[0])}:null},async run(){if(sql.startsWith('DELETE'))values.delete(args[0]);else values.set(args[0],args[1]);return {success:true}}}}}};}
const listing=()=>({hasNext:false,items:Array.from({length:50},(_,i)=>({code:String(i+1),name:'업종'+i,updatedAt:at.toISOString()}))});
const source=async path=>path.includes('rankings')?listing():{hasNext:false,items:path.includes('/upjong/1/')?[row(),row('247540','KOSDAQ')]:[]};
test('new Naver schema uses KRX prices and market-cap won values, excluding NXT, funds and KONEX',()=>{
 const x=naverHeatStock(row(),'반도체');assert.equal(x.marketCap,100000000000);assert.equal(x.changePct,-2.1);assert.equal(x.sector,'반도체');
 assert.equal(naverHeatStock({...row(),stockEndType:'etf'},'업종'),null);assert.equal(naverHeatStock({...row(),marketType:'KONEX'},'업종'),null);
 assert.throws(()=>naverHeatStock({...row(),krx:{marketCap:'',changeRate:'1'}},'업종'),/NUMBER/);
 assert.equal(naverHeatStock({...row(),krx:null},'업종'),null);
});
test('incremental collection resumes within request budget and never publishes a partial map',async t=>{
 t.mock.timers.enable({apis:['Date'],now:at.getTime()});const env=database();
 let result=await collectNaverHeatmap(env,date,{fetcher:source,requestLimit:20,minimumStocks:1});assert.equal(result.complete,false);assert.equal(result.requests,20);assert.equal(await readNaverHeatmap(env,date),null);
 for(let i=0;i<3&&!result.complete;i++)result=await collectNaverHeatmap(env,date,{fetcher:source,requestLimit:20,minimumStocks:1});
 assert.equal(result.complete,true);assert.equal(result.heatmap.stocks.length,2);assert.equal((await readNaverHeatmap(env,date)).date,date);
 let calls=0;result=await collectNaverHeatmap(env,date,{fetcher:async()=>{calls++;throw Error('duplicate');},minimumStocks:1});assert.equal(result.skipped,true);assert.equal(calls,0);
 assert.equal(await readNaverHeatmap(env,'2026-11-06'),null);
});
test('broken sources, duplicate rows, repeated cursors, stale dates and incomplete coverage cannot replace the last good map',async t=>{
 t.mock.timers.enable({apis:['Date'],now:at.getTime()});const env=database();
 for(let i=0;i<3;i++)await collectNaverHeatmap(env,date,{fetcher:source,minimumStocks:1});
 const previous=env.values.get('naver-heatmap:'+date);t.mock.timers.tick(300000);
 await assert.rejects(collectNaverHeatmap(env,date,{fetcher:async()=>({items:[],hasNext:false})}),/INDUSTRIES/);assert.equal(env.values.get('naver-heatmap:'+date),previous);
 const dupe=async path=>path.includes('rankings')?listing():{hasNext:false,items:[row()]};
 await assert.rejects(collectNaverHeatmap(database(),date,{fetcher:dupe,minimumStocks:1}),/DUPLICATE/);
 const cursor=async path=>path.includes('rankings')?listing():{hasNext:true,cursor:'same',items:[row(path.includes('cursor')?'005931':'005930')]};
 await assert.rejects(collectNaverHeatmap(database(),date,{fetcher:cursor,minimumStocks:1}),/CURSOR/);
 const stale=listing();stale.items[0].updatedAt='2026-11-06T10:00:00+09:00';await assert.rejects(collectNaverHeatmap(database(),date,{fetcher:async()=>stale}),/DATE/);
 const missing=async path=>path.includes('rankings')?listing():{hasNext:false,items:[]};const empty=database();let r;
 await assert.rejects(async()=>{for(let i=0;i<4;i++)r=await collectNaverHeatmap(empty,date,{fetcher:missing});},/COVERAGE/);assert.equal(await readNaverHeatmap(empty,date),null);
});
test('Naver refresh window and fixed public paths do not open arbitrary proxy access or LS requests',async()=>{
 for(const [time,expected] of [['08:59',false],['09:00',true],['16:30',true],['20:00',true],['20:01',false]])assert.equal(naverHeatmapWindow(new Date(date+'T'+time+':00+09:00')),expected);
 assert.equal(naverHeatmapWindow(new Date('2026-11-08T10:00:00+09:00')),false);
 let called=0;await assert.rejects(naverJson('/api/private',async()=>{called++;}),/PATH/);assert.equal(called,0);
});
test('after-hours Naver alarms use their own state and never call LS or alter flow/quote records',async t=>{
 const now=new Date(date+'T19:00:00+09:00');t.mock.timers.enable({apis:['Date'],now:now.getTime()});
 const env=database();const {NAVER_HEATMAP_REVISION}=await import('../worker/naver-heatmap.mjs');
 env.values.set('naver-heatmap:'+date,JSON.stringify({date,revision:NAVER_HEATMAP_REVISION,asOf:now.toISOString(),stocks:[naverHeatStock(row(),'반도체')]}));
 env.values.set('details:'+date,JSON.stringify({flows:{important:'keep'},indices:{KOSPI:{value:123}}}));const before=env.values.get('details:'+date);
 const {CollectorAlarm}=await import('../worker/index.mjs');const flags=new Map();let alarm=null;
 const coordinator=new CollectorAlarm({storage:{async put(k,v){flags.set(k,v)},async get(k){return flags.get(k)},async getAlarm(){return alarm},async setAlarm(at){alarm=at}}},env);
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('no upstream expected for fresh map')};
 try{const response=await coordinator.fetch(new Request('https://collector.internal/naver',{method:'POST'}),now);assert.equal(response.status,202);assert.equal(flags.get('naver-only'),true);await coordinator.alarm();assert.equal(env.values.get('details:'+date),before);}finally{globalThis.fetch=previous;}
});
test('verified deployment snapshot serves the requested date and persists through the existing binding only',async t=>{
 const fs=await import('node:fs/promises');const header=JSON.parse(await fs.readFile('src/data/naver-heatmap-baseline.json','utf8'));
 t.mock.timers.enable({apis:['Date'],now:Date.parse(header.asOf)+1000});const env=database();
 const loaded=await readNaverHeatmap(env,header.date);assert.ok(loaded.stocks.length>=2000);assert.equal(loaded.asOf,header.asOf);
 assert.equal(await readNaverHeatmap(env,'2020-01-01'),null);
 const {safeCollectNaverHeatmap}=await import('../worker/naver-heatmap.mjs');await safeCollectNaverHeatmap(env);
 const saved=JSON.parse(env.values.get('naver-heatmap:'+header.date));assert.equal(saved.asOf,header.asOf);assert.equal(saved.stocks.length,loaded.stocks.length);
 assert.deepEqual([...env.values.keys()].sort(),['naver-heatmap:'+header.date,'naver-heatmap-status'].sort());
});
