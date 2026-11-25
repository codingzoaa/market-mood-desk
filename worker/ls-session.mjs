import {createSession as openTLS} from './tls.mjs';
export class LSSessionBusy extends Error{constructor(){super('LS_SESSION_BUSY');this.code='LS_SESSION_BUSY';}}
export const sharedSessionReady=env=>!!(env.LS_SESSION_COORDINATOR||env.COLLECTOR);
const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function createCoordinatedSession(env,{open=openTLS,delay=ms=>new Promise(r=>setTimeout(r,ms)),attempts=4}={}){
 const ns=env.LS_SESSION_COORDINATOR||env.COLLECTOR,key=env.LS_APP_KEY||env.LS_ACCOUNT_APP_KEY;
 if(!ns||typeof key!=='string'||!key)throw Error('LS_SESSION_COORDINATOR_NOT_CONFIGURED');
 const stub=ns.get(ns.idFromName('ls-session-v1:'+await digest(key))),owner=crypto.randomUUID();
 const call=path=>stub.fetch('https://ls-session.internal/ls-session/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner})});
 let acquired=false;for(let i=0;i<attempts;i++){const r=await call('acquire');if(r.ok){acquired=true;break;}if(r.status!==409)throw Error('LS_SESSION_COORDINATOR_UNAVAILABLE');if(i+1<attempts)await delay(1000);}
 if(!acquired)throw new LSSessionBusy();
 let session,closed=false;const release=async()=>{try{await call('release');}catch{}};
 try{session=await open();}catch(e){await release();throw e;}
 const close=async()=>{if(closed)return;closed=true;try{await session.close();}finally{await release();}};
 return {close,async fetch(url,options){if(closed)throw Error('LS_SESSION_CLOSED');const renewed=await call('renew');if(!renewed.ok){await close();throw Error('LS_SESSION_LEASE_LOST');}try{return await session.fetch(url,options);}catch(e){await close();throw e;}}};
}
