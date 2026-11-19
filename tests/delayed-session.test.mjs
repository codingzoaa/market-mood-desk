import {test} from 'node:test';
import assert from 'node:assert/strict';
import {marketSession,sessionRecoveryAllowed} from '../shared/market-session.mjs';
import {collectWindow} from '../worker/ls.mjs';
import {closingFlowWindow} from '../worker/closing-flows.mjs';
import {historicalFlowPoints,verifiedFlowScale} from '../worker/intraday-recovery.mjs';
import {normalizeProgram} from '../worker/program-flow.mjs';
import {handleSessionRecovery,sessionRecoverySignature} from '../worker/session-recovery.mjs';
test('exam session shifts cash open, close, derivatives close and final flows, and next date returns to normal',()=>{
 const s=marketSession('2026-11-19');assert.equal(s.open,'1000');assert.equal(s.close,'1630');assert.equal(s.derivativesClose,'1645');assert.equal(s.collectEnd,'1710');assert.equal(s.flowEnd,'1715');
 assert.equal(collectWindow(new Date('2026-11-19T09:55:00+09:00')),false);assert.equal(collectWindow(new Date('2026-11-19T16:30:00+09:00')),true);assert.equal(closingFlowWindow(new Date('2026-11-19T17:15:00+09:00')),true);assert.equal(closingFlowWindow(new Date('2026-11-19T16:15:00+09:00')),false);assert.equal(marketSession('2026-11-20').open,'0900');
 assert.equal(sessionRecoveryAllowed({RECOVER_SESSION:'2026-11-19'},new Date('2026-11-20T18:00:00+09:00')),false);
});
test('same-date original history restores the delayed closing bars and removes pre-open records',()=>{
 const date='2026-11-19',rows=[{time:'095500',sv_08:0,sv_17:0},{time:'100000',sv_08:10,sv_17:-20},{time:'163000',sv_08:100,sv_17:-200}];
 const flows=Object.fromEntries(['KOSPI','KOSDAQ'].map(b=>[b,{rows,scale:1,header:{svolume_08:100,svolume_17:-200}}]));
 const indices=Object.fromEntries(['KOSPI','KOSDAQ'].map(b=>[b,{quote:{value:1000,change:0},series:rows.map(r=>({time:r.time,value:1000}))}]));
 const h=historicalFlowPoints({date,observedAt:date+'T18:00:00+09:00',flows,indices,previous:[{time:'0955',markets:{KOSPI:{},KOSDAQ:{}}}]});assert.deepEqual(h.map(p=>p.time),['1000','1630']);
 assert.equal(verifiedFlowScale({svolume_08:-153,svolume_17:-4313},{individual:-91,foreign:-4303}),1);
});
test('program as-of normalization accepts delayed session originals without inventing the intervening samples',()=>{
 const rows=[{time:'095500',bcha1:100,bcha2:0,bcha3:100},{time:'100000',bcha1:200,bcha2:0,bcha3:200},{time:'163000',bcha1:300,bcha2:0,bcha3:300}];
 const h=normalizeProgram(rows,rows.map(r=>({time:r.time,close:1000})),1000,{date:'2026-11-19',endTime:'1715'});assert.deepEqual(h.map(p=>p.time),['1000','1630']);
});
test('session recovery requires a fresh path-bound signature and never starts collectors for unauthenticated callers',async()=>{
 const env={TELEGRAM_BOT_TOKEN:'test'},now=new Date('2026-11-19T18:00:00+09:00'),time=String(+now),url='https://test/internal/session-recovery';
 assert.equal((await handleSessionRecovery(new Request(url,{method:'POST'}),env,{},now)).status,401);
 const signature=await sessionRecoverySignature('test','2026-11-19',time);
 const headers={'X-Session-Date':'2026-11-19','X-Session-Time':time,'X-Session-Signature':signature,origin:'https://example.com'};
 assert.equal((await handleSessionRecovery(new Request(url,{method:'POST',headers}),env,{},now)).status,403);delete headers.origin;
 assert.equal((await handleSessionRecovery(new Request(url,{method:'POST',headers}),env,{},new Date(+now+600000))).status,401);
});
