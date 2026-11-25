import {legacyDeleteSQL,legacyCountsSQL} from './legacy-cleanup.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
// A short-lived deployment-only secret permits exactly one kind of operation, never returned to clients.
export async function removeLegacyAccount(request,env,now=Date.now()){
 const expected=env.ACCOUNT_MAINTENANCE_KEY,provided=request.headers.get('X-Account-Maintenance')||'';
 if(request.method!=='POST'||typeof expected!=='string'||expected.length<32||provided.length!==expected.length||!Number.isFinite(Number(env.ACCOUNT_MAINTENANCE_EXPIRES))||now>=Number(env.ACCOUNT_MAINTENANCE_EXPIRES))return json({error:'REQUEST_REJECTED'},403);
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^provided.charCodeAt(i);if(diff)return json({error:'REQUEST_REJECTED'},403);
 let input;try{const text=await request.text();if(text.length>128)return json({error:'REQUEST_REJECTED'},403);input=JSON.parse(text);}catch{return json({error:'REQUEST_REJECTED'},403);}
 if(input?.purpose!=='DELETE_PRE_LOSS_GUARD_V1')return json({error:'REQUEST_REJECTED'},403);
 const owner='legacy-cleanup:'+crypto.randomUUID(),db=env.PRIVATE_DB;
 const claimed=await db.prepare("UPDATE account_lease SET expires=?,owner=? WHERE id='sync' AND expires<=? RETURNING id").bind(now+120000,owner,now).first();if(!claimed)return json({busy:true},409);
 try{const before=await db.prepare(legacyCountsSQL).first();await db.batch(legacyDeleteSQL.map(sql=>db.prepare(sql)));const remaining=await db.prepare(legacyCountsSQL).first();if(Object.values(remaining).some(n=>n!==0))return json({error:'LEGACY_REMOVAL_INCOMPLETE'},503);return json({removed:before,remaining:0,lossGuardPreserved:true});}
 finally{await db.prepare("UPDATE account_lease SET expires=0,owner=NULL WHERE id='sync' AND owner=?").bind(owner).run();}
}
