import {test} from 'node:test';import assert from 'node:assert/strict';
import {handleSectorRecovery,sectorRecoverySignature} from '../worker/sector-recovery.mjs';
const now=new Date('2026-11-10T13:30:00Z'),date='2026-11-10',time=String(+now),env={TELEGRAM_BOT_TOKEN:'test-secret',DB:{prepare(){throw Error('unauthorized DB access')}}};
test('recovery rejects unsigned, wrong-signature, expired and browser requests before reading D1',async()=>{
 const signature=await sectorRecoverySignature(env.TELEGRAM_BOT_TOKEN,date,time);
 for(const headers of [{},{'X-Sector-Date':date,'X-Sector-Time':time,'X-Sector-Signature':'0'.repeat(64)},{'X-Sector-Date':date,'X-Sector-Time':String(+now-300001),'X-Sector-Signature':signature},{'X-Sector-Date':date,'X-Sector-Time':time,'X-Sector-Signature':signature,Origin:'https://codingzoaa.github.io'}]){
 const r=await handleSectorRecovery(new Request('https://worker/internal/sector-recovery',{method:'POST',headers}),env,now);assert.ok([401,403].includes(r.status));}
});
test('valid scoped request confirms the existing sent receipt without sending again',async()=>{
 const state={status:'sent',attempts:8,messageId:99,at:now.toISOString()};const DB={prepare(){return {bind(){return {first:async()=>({payload:JSON.stringify(state)})};}};}};
 const signature=await sectorRecoverySignature(env.TELEGRAM_BOT_TOKEN,date,time);const r=await handleSectorRecovery(new Request('https://worker/internal/sector-recovery',{method:'POST',headers:{'X-Sector-Date':date,'X-Sector-Time':time,'X-Sector-Signature':signature}}),{...env,DB},now);
 assert.equal(r.status,200);const result=await r.json();assert.equal(result.status,'already-sent');assert.equal(result.messageId,99);assert.equal(result.closeUntouched,true);
});

test('signed body hash cannot be replayed with altered article content',async()=>{
 const body='{"news":[]}',hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))].map(x=>x.toString(16).padStart(2,'0')).join(''),signature=await sectorRecoverySignature(env.TELEGRAM_BOT_TOKEN,date,time,hash);
 const r=await handleSectorRecovery(new Request('https://worker/internal/sector-recovery',{method:'POST',headers:{'X-Sector-Date':date,'X-Sector-Time':time,'X-Sector-Signature':signature,'X-Sector-Body-SHA256':hash},body:body+' '}),env,now);
 assert.equal(r.status,401);
});
