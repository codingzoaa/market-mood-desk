import {kst} from './ls.mjs';
import {marketSession} from '../shared/market-session.mjs';
const encoder=new TextEncoder(),hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const key=secret=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const message=(date,time,offset)=>encoder.encode('market-note/vwma-bootstrap/v1|'+date+'|'+time+'|'+offset);
export async function vwmaBootstrapSignature(secret,date,time,offset){return hex(await crypto.subtle.sign('HMAC',await key(secret),message(date,time,offset)));}
// Signed CI-only historical initialization. Public scanner GET never collects.
export async function handleVwmaBootstrap(request,env,now=new Date()){
 const reply=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST'||request.headers.has('Origin'))return reply({error:'BOOTSTRAP_NOT_ALLOWED'},403);
 const date=request.headers.get('X-Vwma-Date'),time=request.headers.get('X-Vwma-Time'),offset=request.headers.get('X-Vwma-Offset'),signature=request.headers.get('X-Vwma-Signature');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^\d{13}$/.test(time||'')||Math.abs(+now-Number(time))>300000||!['0','5','10','15'].includes(offset)||!/^[a-f0-9]{64}$/.test(signature||'')||!env.TELEGRAM_BOT_TOKEN)return reply({error:'BOOTSTRAP_AUTH_REQUIRED'},401);
 if(!await crypto.subtle.verify('HMAC',await key(env.TELEGRAM_BOT_TOKEN),Uint8Array.from(signature.match(/../g).map(x=>parseInt(x,16))),message(date,time,offset)))return reply({error:'BOOTSTRAP_AUTH_REQUIRED'},401);
 const k=kst(now),session=marketSession(k.date);if(!['Sat','Sun'].includes(k.weekday)&&k.time>=session.open&&k.time<=session.flowEnd)return reply({error:'BOOTSTRAP_OUTSIDE_SESSION_ONLY'},409);
 const latest=await env.DB.prepare('SELECT date FROM snapshots WHERE date<=? ORDER BY date DESC LIMIT 1').bind(k.date).first();
 if(latest?.date!==date||date>k.date||Date.parse(k.date)-Date.parse(date)>7*86400000)return reply({error:'BOOTSTRAP_LATEST_CLOSE_REQUIRED'},409);
 if(!env.COLLECTOR)return reply({error:'BOOTSTRAP_COORDINATOR_REQUIRED'},503);
 const lease=await env.DB.prepare('INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)').bind('vwma-bootstrap:v1:'+signature,'used').run();if(lease.meta.changes!==1)return reply({error:'BOOTSTRAP_REPLAY'},409);
 const id=env.COLLECTOR.idFromName('vwma-scanner-bootstrap-v1');const result=await env.COLLECTOR.get(id).fetch('https://collector.internal/vwma-bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,offset:Number(offset)})});return reply({date,accepted:result.status===202,offset:Number(offset)},result.status);
}
