import fs from 'node:fs';
import {recoverSectorDelivery} from '../worker/telegram-delivery.mjs';
const request=JSON.parse(fs.readFileSync('.github/sector-recovery-request.json','utf8'));
const now=new Date();
if(request.kind!=='sector'||!Number.isFinite(Date.parse(request.requestedAt))||Math.abs(now-Date.parse(request.requestedAt))>3600000)throw Error('SECTOR_RECOVERY_REQUEST_EXPIRED');
const config=JSON.parse(fs.readFileSync('worker/wrangler.jsonc','utf8'));
const token=(process.env.RAW_CLOUDFLARE_TOKEN||'').trim().replace(/^["']|["']$/g,'').replace(/^Bearer\s+/i,'').trim();
if(!token||/\s/.test(token))throw Error('CLOUDFLARE_TOKEN_FORMAT_INVALID');
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+config.account_id+'/d1/database/'+config.d1_databases.find(x=>x.binding==='DB').database_id+'/query';
async function query(sql,params){
 const r=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.success!==true||data.result?.[0]?.success!==true)throw Error('SECTOR_RECOVERY_D1_HTTP_'+r.status);
 return data.result[0];
}
const DB={prepare(sql){return {bind(...params){return {async first(){return (await query(sql,params)).results?.[0]||null;},async run(){return query(sql,params);}};}};}};
const result=await recoverSectorDelivery({...process.env,DB},request.date,now);
console.log('SECTOR_RECOVERY_RESULT '+JSON.stringify({date:request.date,...result}));
if(!['sent','already-sent'].includes(result.status))throw Error('SECTOR_RECOVERY_NOT_ACCEPTED');
const check=await DB.prepare('SELECT payload FROM state WHERE id=?').bind('telegram:v3:'+request.date+':sector').first();
const state=JSON.parse(check.payload);
if(state.status!=='sent'||!Number.isInteger(state.messageId))throw Error('SECTOR_RECOVERY_D1_CONFIRMATION_FAILED');
console.log('SECTOR_RECOVERY_CONFIRMED '+JSON.stringify({date:request.date,status:state.status,attempts:state.attempts,at:state.at,messageId:state.messageId,closeUntouched:true}));
