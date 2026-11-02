import test from 'node:test';
import assert from 'node:assert/strict';
import {render,main} from '../scripts/telegram-market-close.mjs';
const date='2026-10-28',time='2026-10-28T06:30:00Z';
const valid={date,indices:{
  KOSPI:{value:6012.44,changePct:6.63,advances:582,unchanged:70,declines:290,asOf:time},
  KOSDAQ:{value:771.28,changePct:3.69,advances:1133,unchanged:158,declines:526,asOf:time}
},flows:{unit:'억원',asOf:time,segments:Object.fromEntries(
  ['KOSPI','KOSDAQ','FUTURES','CALL','PUT'].map(k=>[k,{individual:-100,foreign:200,institution:50}]))}};
const env={MARKET_DETAILS_URL:'https://market-note-ls-api.kby0991.workers.dev/api/market-details'};
const dependencies={now:new Date('2026-10-28T07:30:00Z'),readJson:async url=>{
  assert.equal(new URL(url).searchParams.get('date'),date);
  return {details:valid};
}};
test('formats five KRX segments with units, cautious positioning and ETF disclosure',()=>{
 const s=render(date,valid);
 assert.match(s,/코스피: 개인/);
 assert.match(s,/ETF: 투자자별 수급 확인 불가/);
 assert.match(s,/상방 우위/);
 assert.match(s,/OI 미확인/);
 assert.match(s,/확정 여부는 거래소 별도 검증 필요/);
});
test('rejects stale date and missing market indices',()=>{
 assert.throws(()=>render('2026-10-29',valid),/DATE_MISMATCH/);
 assert.throws(()=>render(date,{...valid,indices:{KOSPI:valid.indices.KOSPI}}),/INDEX_MISSING_KOSDAQ/);
});
test('rejects pre-close, wrong unit, missing flow and collector errors',()=>{
 assert.throws(()=>render(date,{...valid,flows:{...valid.flows,asOf:'2026-10-28T05:00:00Z'}}),/FLOW_NOT_CLOSED/);
 assert.throws(()=>render(date,{...valid,flows:{...valid.flows,unit:'백만원'}}),/FLOW_MISSING/);
 assert.throws(()=>render(date,{...valid,flows:{...valid.flows,segments:{...valid.flows.segments,CALL:{individual:0,foreign:null,institution:1}}}}),/FLOW_MISSING_CALL/);
 assert.throws(()=>render(date,{...valid,errors:{flows:'LS_AUTH_FAILED'}}),/COLLECTION_ERRORS/);
});
test('rejects unreasonable values rather than broadcasting corrupted price or counts',()=>{
 assert.throws(()=>render(date,{...valid,indices:{...valid.indices,KOSPI:{...valid.indices.KOSPI,value:-1}}}),/INDEX_RANGE_KOSPI/);
 assert.throws(()=>render(date,{...valid,indices:{...valid.indices,KOSPI:{...valid.indices.KOSPI,advances:1.5}}}),/INDEX_RANGE_KOSPI/);
});
test('dry-run validates live response shape without secrets or outbound Telegram send',async()=>{
 let sent=false;
 const result=await main({...env,TELEGRAM_DRY_RUN:'true'},{
  ...dependencies,deliverMessage:async()=>{sent=true;}
 });
 assert.deepEqual(result,{status:'checked',date});
 assert.equal(sent,false);
});
test('missing credentials prevent real delivery',async()=>{
 let sent=false;
 await assert.rejects(main(env,{...dependencies,deliverMessage:async()=>{sent=true;}}),/MISSING_TELEGRAM_BOT_TOKEN/);
 assert.equal(sent,false);
});
test('real delivery uses verified, same-day data only',async()=>{
 const chunks=[];
 const response=await main({...env,TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'fake'},{
  ...dependencies,deliverMessage:async message=>chunks.push(message)
 });
 assert.deepEqual(response,{status:'delivered',date});
 assert.equal(chunks.length,1);
 assert.match(chunks[0],/6,012\.44/);
});
test('wrong-day data never gets delivered',async()=>{
 let sent=false;
 await assert.rejects(main({...env,TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'fake'},{
  ...dependencies,readJson:async()=>({details:{...valid,date:'2026-10-27'}}),
  deliverMessage:async()=>{sent=true;}
 }),/DATE_MISMATCH/);
 assert.equal(sent,false);
});
test('requires verified time before 16:30 KST and rejects weekend',async()=>{
 await assert.rejects(main({...env,TELEGRAM_DRY_RUN:'true'},{...dependencies,now:new Date('2026-10-28T07:20:00Z')}),/BEFORE_1630/);
 await assert.rejects(main({...env,TELEGRAM_DRY_RUN:'true'},{...dependencies,now:new Date('2026-10-31T08:00:00Z')}),/WEEKEND/);
});
