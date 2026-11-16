import {recoverSectorDelivery} from './telegram-delivery.mjs';
const encode=new TextEncoder();
const input=(date,time)=>encode.encode('market-note/sector-recovery/v1|POST|/internal/sector-recovery|'+date+'|'+time);
const key=secret=>crypto.subtle.importKey('raw',encode.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function sectorRecoverySignature(secret,date,time){
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),input(date,time)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function handleSectorRecovery(request,env,now=new Date(),dependencies={}){
 const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST'||request.headers.has('origin'))return reply({error:'RECOVERY_NOT_ALLOWED'},403);
 const date=request.headers.get('X-Sector-Date'),time=request.headers.get('X-Sector-Time'),signature=request.headers.get('X-Sector-Signature');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^\d{13}$/.test(time||'')||Math.abs(+now-Number(time))>300000||!/^[a-f0-9]{64}$/.test(signature||'')||!env.TELEGRAM_BOT_TOKEN)return reply({error:'RECOVERY_AUTH_REQUIRED'},401);
 const bytes=Uint8Array.from(signature.match(/../g).map(x=>parseInt(x,16)));
 if(!await crypto.subtle.verify('HMAC',await key(env.TELEGRAM_BOT_TOKEN),bytes,input(date,time)))return reply({error:'RECOVERY_AUTH_REQUIRED'},401);
 try{
  const result=await recoverSectorDelivery(env,date,now,dependencies);
  if(!['sent','already-sent'].includes(result.status))return reply(result,502);
  const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('telegram:v3:'+date+':sector').first();const state=JSON.parse(row.payload);
  return reply({date,...result,attempts:state.attempts,at:state.at,messageId:state.messageId,closeUntouched:true},200);
 }catch{return reply({error:'SECTOR_RECOVERY_FAILED'},502);}
}
