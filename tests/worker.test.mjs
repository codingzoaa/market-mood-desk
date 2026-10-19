import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';
import {normalizeStock,signed,verifySession,collectWindow,tr,accessToken} from '../worker/ls.mjs';
const sample={shcode:'005930',hname:'테스트 종목',price:'80000',diff:'1.23',sign:'5',value:'1234'};
test('LS 백만원 거래대금은 원 단위로 변환하고 하락 부호·종목코드를 보존한다',()=>{
 const s=normalizeStock(sample,'KOSPI',['검증 테마']);assert.equal(s.turnoverKRW,1234000000);assert.equal(s.changePct,-1.23);assert.equal(s.symbol,'005930');
 assert.throws(()=>normalizeStock({...sample,value:''},'KOSPI'));assert.throws(()=>normalizeStock({...sample,shcode:'5930'},'KOSPI'));assert.throws(()=>normalizeStock({...sample,price:-1},'KOSPI'));assert.equal(signed('-2.5','2'),2.5);
});
test('휴장일·개장 전 시세를 오늘 거래일로 저장하지 않는다',()=>{
 const now=new Date('2026-10-19T00:30:00Z');
 assert.equal(verifySession({t8410OutBlock1:[{date:'20261016'}],t8410OutBlock:{s_time:'090000'}},now),false);
 assert.equal(verifySession({t8410OutBlock1:[{date:'20261019'}],t8410OutBlock:{s_time:'100000'}},now),false);
 assert.equal(verifySession({t8410OutBlock1:[{date:'20261019'}],t8410OutBlock:{s_time:'090000'}},now),true);
 assert.equal(collectWindow(new Date('2026-10-18T01:30:00Z')),false);
});
test('접속 코드·Origin 검증 전에 DB 또는 LS API를 호출하지 않는다',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('not expected');};
 const env={LS_APP_KEY:'test-appkey',LS_APP_SECRET:'test-appsecret',DASHBOARD_TOKEN:'x'.repeat(40),DB:{prepare(){throw Error('DB not expected');}}};
 try{
  let r=await worker.fetch(new Request('https://worker.test/api/dashboard'),env,{});assert.equal(r.status,401);
  r=await worker.fetch(new Request('https://worker.test/api/market-details?date=2026-10-19'),env,{});assert.equal(r.status,401);
  r=await worker.fetch(new Request('https://worker.test/api/dashboard',{headers:{Origin:'https://evil.test',Authorization:'Bearer '+env.DASHBOARD_TOKEN}}),env,{});assert.equal(r.status,403);
  r=await worker.fetch(new Request('https://worker.test/api/dashboard',{method:'OPTIONS',headers:{Origin:'https://codingzoaa.github.io'}}),env,{});assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://codingzoaa.github.io');
  r=await worker.fetch(new Request('https://worker.test/api/dashboard',{headers:{Authorization:'Bearer '+env.DASHBOARD_TOKEN}}),{...env,LS_APP_SECRET:''},{});assert.equal(r.status,503);assert.equal((await r.json()).error,'LS_KEYS_REQUIRED');assert.equal(calls,0);
  r=await worker.fetch(new Request('https://worker.test/health'),env,{});const text=await r.text();assert.doesNotMatch(text,/test-appkey|test-appsecret|xxxxxxxx/);
 }finally{globalThis.fetch=previous;}
});
test('LS 에러 원문·인증정보는 반환하지 않고 허용한 시세 TR만 호출한다',async()=>{
 let calls=0;const mock=async()=>{calls++;return Response.json({rsp_cd:'9999',rsp_msg:'secret-app-key diagnostic'});};
 await assert.rejects(tr('token','t1463',{},undefined,mock),e=>e.message==='LS_TR_FAILED'&&!e.message.includes('secret'));
 await assert.rejects(tr('token','CSPAT00601',{},undefined,mock),/TR_NOT_ALLOWED/);assert.equal(calls,1);
});
test('서버 저장 토큰을 재사용하고 OAuth 응답을 클라이언트로 넘기지 않는다',async()=>{
 const env={DB:{prepare:()=>({first:async()=>({payload:JSON.stringify({token:'server-only-token',expires:Date.now()+3600000})})})}};
 assert.equal(await accessToken(env,()=>{throw Error('must not issue a new token');}),'server-only-token');
});

test('OAuth 타임아웃은 키 오류와 구분하고 오류 원문을 노출하지 않는다',async()=>{
 const env={LS_APP_KEY:'test-key',LS_APP_SECRET:'test-secret',DB:{prepare:()=>({first:async()=>null})}};
 await assert.rejects(accessToken(env,async()=>{throw new DOMException('private diagnostics','TimeoutError');}),e=>e.message==='LS_AUTH_TIMEOUT');
});

test('네트워크 진단은 Secret과 상위 URL을 제거한다',async()=>{
 const {networkFailure}=await import('../worker/ls.mjs');
 const error=networkFailure(new TypeError('Invalid request for https://example.test/oauth2/token key=private-key secret=private-secret'),'AUTH',['private-key','private-secret']);
 assert.equal(error.code,'LS_AUTH_REQUEST_REJECTED');assert.doesNotMatch(error.safeDetail,/private-key|private-secret|https:\/\//);
});

test('인증 리다이렉트는 따라가지 않고 주소의 쿼리와 경로를 진단에서 제외한다',async()=>{
 const env={LS_APP_KEY:'test-key',LS_APP_SECRET:'test-secret',DB:{prepare:()=>({first:async()=>null})}};
 await assert.rejects(accessToken(env,async(url,options)=>{assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://other.test/private-path?token=private-value'}});}),e=>e.code==='LS_REDIRECT_REJECTED'&&e.safeDetail==='HTTP 302 redirect to https://other.test');
});

test('LS HTTP 오류 코드와 안내에서 인증정보를 제거한다',async()=>{
 await assert.rejects(tr('private-credential','t8410',{},undefined,async()=>Response.json({error:'IGW00216',error_description:'유효하지 않은 tr_cd 입니다. private-credential'},{status:500})),e=>e.code==='LS_HTTP_500'&&e.safeDetail.includes('IGW00216')&&e.safeDetail.includes('tr_cd')&&!e.safeDetail.includes('private'));
});

test('알람 예약은 HTTP 요청에서 수집하지 않고 중복 예약을 합친다',async()=>{
 const {CollectorAlarm}=await import('../worker/index.mjs');let scheduled=null,sets=0;
 const alarm=new CollectorAlarm({storage:{getAlarm:async()=>scheduled,setAlarm:async value=>{scheduled=value;sets++;}}},{});
 let r=await alarm.fetch(new Request('https://collector.internal/wake',{method:'POST'}));assert.equal(r.status,202);
 r=await alarm.fetch(new Request('https://collector.internal/wake',{method:'POST'}));assert.equal(r.status,202);assert.equal(sets,1);
 r=await alarm.fetch(new Request('https://collector.internal/wake'));assert.equal(r.status,405);
});

test('동일 TLS 수집은 다른 IP에서 발급한 DB 토큰을 재사용하지 않는다',async()=>{
 let calls=0;
 const env={LS_APP_KEY:'test-key',LS_APP_SECRET:'test-secret',DB:{prepare(){throw Error('TLS session must not read or write the shared OAuth cache');}}};
 const token=await accessToken(env,async()=>{calls++;return Response.json({access_token:'same-connection-token',expires_in:86400});},Date.now(),false);
 assert.equal(token,'same-connection-token');assert.equal(calls,1);
});
