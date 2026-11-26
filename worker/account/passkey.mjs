import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';
import {seal,open} from './security.mjs';
import setup from './passkey-setup.json' with {type:'json'};
const ORIGIN='https://codingzoaa.github.io',RP='codingzoaa.github.io',TTL=8*60*60*1000;
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const reply=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store, private','Pragma':'no-cache'}});
export async function authSchema(env){await env.PRIVATE_DB.prepare('CREATE TABLE IF NOT EXISTS account_auth(id TEXT PRIMARY KEY,payload TEXT NOT NULL,expires INTEGER NOT NULL) WITHOUT ROWID').run();}
async function get(env,id){const r=await env.PRIVATE_DB.prepare('SELECT payload FROM account_auth WHERE id=? AND expires>?').bind(id,Date.now()).first();return r?{value:await open(env,r.payload,'auth:'+id),payload:r.payload}:null;}
async function put(env,id,value,expires){await env.PRIVATE_DB.prepare('INSERT INTO account_auth VALUES(?,?,?)').bind(id,await seal(env,value,'auth:'+id),expires).run();}
export async function validSession(request,env){const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return false;await authSchema(env);return !!await get(env,'session:'+await digest(token));}
async function session(env){const token=random(),expiresAt=Date.now()+TTL;await put(env,'session:'+await digest(token),{},expiresAt);return {token,expiresAt};}
async function rate(request,env){const window=Math.floor(Date.now()/300000),id='rate:'+await digest((request.headers.get('CF-Connecting-IP')||'unknown')+':'+window);const r=await env.PRIVATE_DB.prepare("INSERT INTO account_auth VALUES(?,'1',?) ON CONFLICT(id) DO UPDATE SET payload=CAST(CAST(payload AS INTEGER)+1 AS TEXT) RETURNING payload").bind(id,(window+2)*300000).first();return Number(r.payload)<=30;}
export async function passkeyFetch(request,env,verification={verifyRegistrationResponse,verifyAuthenticationResponse},enrollment=setup){
 try{
  if(request.method!=='POST'||request.headers.get('Origin')!==ORIGIN||request.headers.get('Content-Type')!=='application/json')return reply({error:'REQUEST_REJECTED'},403);
  await authSchema(env);if(!await rate(request,env))return reply({error:'AUTH_RATE_LIMIT'},429);
  const text=await request.text();if(text.length>24000)return reply({error:'REQUEST_TOO_LARGE'},413);const input=JSON.parse(text),action=new URL(request.url).pathname.split('/').at(-1);
  if(Math.random()<.02)await env.PRIVATE_DB.prepare('DELETE FROM account_auth WHERE expires<?').bind(Date.now()).run();
  const owner=await get(env,'owner');
  if(action==='status')return reply({registered:!!owner,authenticated:await validSession(request,env)});
  if(action==='logout'){const token=request.headers.get('Authorization')?.slice(7)||'';await env.PRIVATE_DB.prepare('DELETE FROM account_auth WHERE id=?').bind('session:'+await digest(token)).run();return reply({ok:true});}
  if(action==='register-options'){
   if(owner){if(!await validSession(request,env))return reply({error:'AUTHENTICATION_REQUIRED'},401);if(owner.value.credentials.length>=5)return reply({error:'PASSKEY_LIMIT'},409);}
   else if(Date.parse(enrollment.expiresAt)<Date.now()||typeof input.setupCode!=='string'||input.setupCode.length>128||await digest(input.setupCode)!==enrollment.sha256)return reply({error:'SETUP_CODE_REJECTED'},403);
   const options=await generateRegistrationOptions({rpName:'마켓노트 계좌분석',rpID:RP,userName:'Marketnote Owner',userID:new TextEncoder().encode('marketnote-owner-v1'),attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'},supportedAlgorithmIDs:[-7,-257],excludeCredentials:owner?.value.credentials.map(c=>({id:c.id,transports:c.transports}))||[]});
   const id=random();await put(env,'challenge:'+await digest(id),{kind:'register',challenge:options.challenge,first:!owner},Date.now()+300000);return reply({id,options});
  }
  if(action==='login-options'){
   if(!owner)return reply({error:'PASSKEY_NOT_REGISTERED'},409);
   const options=await generateAuthenticationOptions({rpID:RP,userVerification:'required',allowCredentials:owner.value.credentials.map(c=>({id:c.id,transports:c.transports}))});const id=random();await put(env,'challenge:'+await digest(id),{kind:'login',challenge:options.challenge},Date.now()+300000);return reply({id,options});
  }
  if(!['register-verify','login-verify'].includes(action))return reply({error:'NOT_FOUND'},404);
  if(!/^[a-f0-9]{64}$/.test(input.id||''))return reply({error:'AUTH_REJECTED'},400);
  const id='challenge:'+await digest(input.id),raw=await env.PRIVATE_DB.prepare('DELETE FROM account_auth WHERE id=? AND expires>? RETURNING payload').bind(id,Date.now()).first();if(!raw)return reply({error:'CHALLENGE_EXPIRED'},400);
  const challenge=await open(env,raw.payload,'auth:'+id);
  if(action==='register-verify'){
   if(challenge.kind!=='register'||(!challenge.first&&!await validSession(request,env))||(challenge.first&&owner))return reply({error:'AUTH_REJECTED'},403);
   const v=await verification.verifyRegistrationResponse({response:input.response,expectedChallenge:challenge.challenge,expectedOrigin:ORIGIN,expectedRPID:RP,requireUserVerification:true});if(!v.verified||!v.registrationInfo)return reply({error:'AUTH_REJECTED'},403);
   const c=v.registrationInfo.credential,credential={...c,publicKey:Array.from(c.publicKey)},value={credentials:[...(owner?.value.credentials||[]),credential]},payload=await seal(env,value,'auth:owner');
   const r=owner?await env.PRIVATE_DB.prepare('UPDATE account_auth SET payload=? WHERE id=\'owner\' AND payload=?').bind(payload,owner.payload).run():await env.PRIVATE_DB.prepare("INSERT OR IGNORE INTO account_auth VALUES('owner',?,?)").bind(payload,Number.MAX_SAFE_INTEGER).run();if(r.meta.changes!==1)return reply({error:'AUTH_RETRY'},409);
  }else{
   if(challenge.kind!=='login'||!owner)return reply({error:'AUTH_REJECTED'},403);
   const credential=owner.value.credentials.find(c=>c.id===input.response?.id);if(!credential)return reply({error:'AUTH_REJECTED'},403);
   const v=await verification.verifyAuthenticationResponse({response:input.response,expectedChallenge:challenge.challenge,expectedOrigin:ORIGIN,expectedRPID:RP,credential:{...credential,publicKey:new Uint8Array(credential.publicKey)},requireUserVerification:true});if(!v.verified)return reply({error:'AUTH_REJECTED'},403);
   credential.counter=v.authenticationInfo.newCounter;const payload=await seal(env,owner.value,'auth:owner');const r=await env.PRIVATE_DB.prepare("UPDATE account_auth SET payload=? WHERE id='owner' AND payload=?").bind(payload,owner.payload).run();if(r.meta.changes!==1)return reply({error:'AUTH_RETRY'},409);
  }
  return reply(await session(env));
 }catch{return reply({error:'AUTH_REJECTED'},400);}
}
