import {parseNaverNews} from '../shared/naver-news.mjs';
import {recoverSectorDelivery} from './telegram-delivery.mjs';
const encode=new TextEncoder();
const input=(date,time,bodyHash='')=>encode.encode('market-note/sector-recovery/v1|POST|/internal/sector-recovery|'+date+'|'+time+'|'+bodyHash);
const key=secret=>crypto.subtle.importKey('raw',encode.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function sectorRecoverySignature(secret,date,time,bodyHash=''){
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),input(date,time,bodyHash)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function handleSectorRecovery(request,env,now=new Date(),dependencies={}){
 const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST'||request.headers.has('origin'))return reply({error:'RECOVERY_NOT_ALLOWED'},403);
 const date=request.headers.get('X-Sector-Date'),time=request.headers.get('X-Sector-Time'),signature=request.headers.get('X-Sector-Signature');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^\d{13}$/.test(time||'')||Math.abs(+now-Number(time))>300000||!/^[a-f0-9]{64}$/.test(signature||'')||!env.TELEGRAM_BOT_TOKEN)return reply({error:'RECOVERY_AUTH_REQUIRED'},401);
 const bodyHash=request.headers.get('X-Sector-Body-SHA256')||'';
 if(bodyHash&&!/^[a-f0-9]{64}$/.test(bodyHash))return reply({error:'RECOVERY_AUTH_REQUIRED'},401);
 const bytes=Uint8Array.from(signature.match(/../g).map(x=>parseInt(x,16)));
 if(!await crypto.subtle.verify('HMAC',await key(env.TELEGRAM_BOT_TOKEN),bytes,input(date,time,bodyHash)))return reply({error:'RECOVERY_AUTH_REQUIRED'},401);
 try{
  let sectorNews;
  if(bodyHash){
   const reader=request.body?.getReader();if(!reader)return reply({error:'RECOVERY_BODY_REQUIRED'},400);
   const chunks=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16384){await reader.cancel();return reply({error:'RECOVERY_BODY_TOO_LARGE'},413);}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(digest!==bodyHash)return reply({error:'RECOVERY_BODY_MISMATCH'},401);
   const data=JSON.parse(new TextDecoder().decode(bytes));
   if(!Array.isArray(data.news)||!data.news.length||data.news.length>4||data.news.some(n=>n.provider!=='네이버 뉴스'||typeof n.headline!=='string'||n.headline.length>240||typeof n.link!=='string'||n.link.length>500))return reply({error:'RECOVERY_NEWS_INVALID'},400);
   const escape=x=>String(x||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
   const xml='<rss><channel>'+data.news.map(n=>'<item><title>'+escape(n.headline)+'</title><originallink>'+escape(n.link)+'</originallink><pubDate>'+escape(n.published)+'</pubDate></item>').join('')+'</channel></rss>';
   sectorNews=parseNaverNews(xml,date).map(n=>({...n,title:n.headline,pubDate:n.published,source:n.source+' · 네이버 뉴스'}));
   if(sectorNews.length!==data.news.length)return reply({error:'RECOVERY_NEWS_INVALID'},400);
  }
  const result=await recoverSectorDelivery(env,date,now,{...dependencies,...(sectorNews?{sectorNews}:{})});
  if(!['sent','already-sent'].includes(result.status))return reply(result,502);
  const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('telegram:v3:'+date+':sector').first();const state=JSON.parse(row.payload);
  return reply({date,...result,attempts:state.attempts,at:state.at,messageId:state.messageId,closeUntouched:true},200);
 }catch{return reply({error:'SECTOR_RECOVERY_FAILED'},502);}
}
