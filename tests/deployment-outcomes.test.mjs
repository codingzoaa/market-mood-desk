import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPublishedManifest} from '../scripts/verify-published-stock-map.mjs';
import {normalizeRun} from '../scripts/operations-snapshot.mjs';
import {operationState,publicationNote} from '../src/operations-outcome.mjs';
const expected={method:'KRX_KIND_IDENTITY_INDUSTRY_V1',checkedAt:'2026-11-20T07:01:46.114Z',sourceSha256:'a'.repeat(64)};
test('deployment verification tolerates propagation and transient failures but requires the exact published manifest',async()=>{
 const responses=[Response.json({verification:{...expected,checkedAt:'old'}}),new Response('',{status:503}),Response.json({verification:expected})],waits=[];
 const result=await verifyPublishedManifest(expected,{request:async()=>responses.shift(),wait:async ms=>waits.push(ms),attempts:3,delayMs:7,log:()=>{}});
 assert.deepEqual(result,expected);assert.deepEqual(waits,[7,7]);
 for(const bad of [{...expected,checkedAt:'old'},{...expected,sourceSha256:'b'.repeat(64)},{...expected,method:'OTHER'}])await assert.rejects(verifyPublishedManifest(expected,{request:async()=>Response.json({verification:bad}),wait:async()=>{},attempts:2,log:()=>{}}),/NOT_CURRENT/);
});
test('a successful calendar invocation without deployment never appears as published',()=>{
 const run={name:'Publish verified sector calendar at 17 KST',status:'completed',conclusion:'success'};
 const normalize=steps=>normalizeRun(run,[{name:'publish',steps}]);
 const waiting=normalize([{name:'Calendar waiting for scheduled review time',conclusion:'success'}]);
 assert.equal(operationState(waiting),'예약 대기');assert.match(publicationNote(waiting),/아직 실행하지/);
 assert.equal(operationState(normalize([{name:'Calendar review already published',conclusion:'success'}])),'변경 없음');
 assert.equal(operationState(normalize([{name:'Deploy verified calendar to Pages',conclusion:'skipped'}])),'배포 미실행');
 assert.equal(operationState(normalize([{name:'Deploy verified calendar to Pages',conclusion:'success'}])),'발행·배포 완료');
 assert.equal(operationState(normalizeRun({...run,conclusion:'failure'},[{name:'publish',steps:[{name:'Deploy verified calendar to Pages',conclusion:'success'}]}])),'실패');
 const pending=[{name:'Calendar review awaiting verified inputs',conclusion:'success'},{name:'Report publication result and expose verification failures',conclusion:'failure'}];
 assert.equal(operationState(normalizeRun({...run,conclusion:'failure'},[{name:'publish',steps:pending}])),'자료 검증 보류');
 assert.equal(operationState(normalizeRun({...run,conclusion:'failure'},[{name:'publish',steps:[...pending,{name:'Run independent calendar CI',conclusion:'failure'}]}])),'실패');
});
