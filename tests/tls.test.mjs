import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HTTPReader,createSession} from '../worker/tls.mjs';
const encode=s=>new TextEncoder().encode(s);
function stream(text,size=7){const bytes=encode(text);return new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.slice(i,i+size));c.close();}});}
function response(body,extra=''){return 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: '+encode(body).length+'\r\n'+extra+'\r\n'+body;}
test('HTTP 길이와 UTF-8을 보존하고 같은 연결의 다음 응답을 남긴다',async()=>{
 const reader=new HTTPReader(stream(response('{"name":"한국"}')+response('{"next":true}')).getReader());
 assert.deepEqual(await (await reader.response()).json(),{name:'한국'});assert.deepEqual(await (await reader.response()).json(),{next:true});
});
test('청크 응답과 연속 응답을 정확히 분리한다',async()=>{
 const reader=new HTTPReader(stream('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\ntest\r\n0\r\n\r\n'+response('{}')).getReader());
 assert.equal(await (await reader.response()).text(),'test');assert.deepEqual(await (await reader.response()).json(),{});
});
test('잘린 응답·과대 길이·잘못된 청크를 거절한다',async()=>{
 await assert.rejects(new HTTPReader(stream('HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nx').getReader()).response(),/TRUNCATED/);
 await assert.rejects(new HTTPReader(stream('HTTP/1.1 200 OK\r\nContent-Length: 99999999\r\n\r\n').getReader()).response(),/TOO_LARGE/);
 await assert.rejects(new HTTPReader(stream('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nGG\r\n').getReader()).response(),/INVALID_CHUNK/);
});
test('OAuth와 TR은 인증서 검증을 켠 한 TLS 연결만 사용한다',async()=>{
 let connections=0,closed=0;const writes=[];
 const session=await createSession((target,options)=>{connections++;assert.deepEqual(target,{hostname:'openapi.ls-sec.co.kr',port:8080});assert.equal(options.secureTransport,'on');return {opened:Promise.resolve(),closed:Promise.resolve(),close:async()=>{closed++;},readable:stream(response('{"access_token":"test-token"}')+response('{"rsp_cd":"00000"}')),writable:new WritableStream({write(v){writes.push(new TextDecoder().decode(v));}})};});
 const first=await session.fetch('https://openapi.ls-sec.co.kr:8080/oauth2/token',{method:'POST',body:new URLSearchParams({grant_type:'client_credentials'})});assert.equal((await first.json()).access_token,'test-token');
 const second=await session.fetch('https://openapi.ls-sec.co.kr:8080/stock/chart',{method:'POST',headers:{authorization:'Bearer test-token',tr_cd:'t8410'},body:'{}'});assert.equal((await second.json()).rsp_cd,'00000');assert.equal(connections,1);assert.equal(writes.length,2);assert.match(writes[0],/connection: keep-alive/);assert.match(writes[1],/authorization: Bearer test-token/);
 await assert.rejects(session.fetch('https://other.test/',{method:'POST'}),/TARGET_REJECTED/);await session.close();assert.equal(closed,1);
});
