// Only the existing private account Worker is updated. Authentication and bindings are retained.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const token=(process.env.RAW_CLOUDFLARE_TOKEN||'').trim().replace(/^["']|["']$/g,'').replace(/^Bearer\s+/i,'').trim();if(!token||/\s/.test(token))throw Error('PRIVATE_DEPLOY_TOKEN_MISSING');
const root='https://api.cloudflare.com/client/v4/accounts/78961f2ddb841df708b3a777fdcc94c2/workers/scripts/market-note-private-account';
const api=async(path,init={})=>{const r=await fetch(root+path,{...init,headers:{Authorization:'Bearer '+token,...init.headers},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('PRIVATE_DEPLOY_HTTP_'+r.status);return r;};
async function source(){const r=await api('');let s='';if((r.headers.get('content-type')||'').includes('multipart/')){for(const [name,file]of await r.formData())if(name!=='metadata')s+=typeof file==='string'?file:await file.text();}else s=await r.text();return s;}
const settings=async()=>{const r=await(await api('/settings')).json();if(!r.success)throw Error('PRIVATE_SETTINGS_REJECTED');return r.result;};
const before=await settings(),old=await source(),next=await fs.readFile('work/account-deploy/worker.mjs','utf8');
const required=['ACCESS_AUD','ACCESS_ISSUER','OWNER_EMAIL','ACCOUNT_ENCRYPTION_KEY','ACCOUNT_INDEX_KEY','PRIVATE_APP_ORIGIN','PRIVATE_DB','LS_ACCOUNT_APP_KEY','LS_ACCOUNT_APP_SECRET','LS_ACCOUNT_NO'];
if(required.some(name=>!before.bindings.some(b=>b.name===name)))throw Error('PRIVATE_BINDINGS_INCOMPLETE');
for(const marker of ['AUTHENTICATION_REQUIRED','ACCOUNT_SYNC_WINDOW_CLOSED','journalArchive','journalPrevious','analysisBlocked'])if(!old.includes(marker)||!next.includes(marker))throw Error('PRIVATE_FEATURE_REGRESSION');
if(!next.includes('GUARD_DEDICATED_KEY_REQUIRED')||!next.includes('/api/lossguard'))throw Error('PRIVATE_GUARD_MISSING');
const expected=(await fs.readFile('worker/account/deployed-source.sha256','utf8')).trim();if(sha(old)!==expected&&sha(old)!==sha(next))throw Error('PRIVATE_LIVE_SOURCE_CHANGED_REVIEW_REQUIRED');
if(sha(old)!==sha(next)){
 const keep=[...new Set(before.bindings.map(b=>b.type))];if(keep.some(t=>!['secret_text','plain_text','d1'].includes(t)))throw Error('PRIVATE_UNREVIEWED_BINDING_TYPE');
 const metadata={main_module:'worker.mjs',keep_bindings:keep,compatibility_date:before.compatibility_date,compatibility_flags:before.compatibility_flags||[],annotations:{'workers/message':'LS read-only loss guard; preserve existing private access'}};
 for(const name of ['usage_model','limits','logpush','tail_consumers','observability','placement','tags'])if(before[name]!==undefined)metadata[name]=before[name];
 const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('worker.mjs',new Blob([next],{type:'application/javascript+module'}),'worker.mjs');
 const uploaded=await(await api('',{method:'PUT',body:form})).json();if(!uploaded.success)throw Error('PRIVATE_UPLOAD_REJECTED');
}
const after=await settings(),live=await source();const names=s=>s.bindings.map(b=>b.type+':'+b.name).sort().join('|');if(names(before)!==names(after)||before.compatibility_date!==after.compatibility_date||JSON.stringify(before.compatibility_flags)!==JSON.stringify(after.compatibility_flags))throw Error('PRIVATE_BINDING_VERIFICATION_FAILED');
for(const a of before.bindings.filter(b=>b.type!=='secret_text')){const b=after.bindings.find(b=>b.name===a.name);if(JSON.stringify(a)!==JSON.stringify(b))throw Error('PRIVATE_BINDING_VALUE_CHANGED');}
if(sha(live)!==sha(next))throw Error('PRIVATE_SOURCE_VERIFICATION_FAILED');
const origin='https://market-note-private-account.kby0991.workers.dev';
for(const path of ['/api/lossguard','/api/account','/app.js','/app.css']){const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});if(![302,401,403].includes(r.status))throw Error('PRIVATE_AUTH_BOUNDARY_FAILED');}
const report={worker:'market-note-private-account',sourceSha256:sha(live),bindingsPreserved:true,authenticationRequired:true,lossGuardInstalled:true,intradayKeyConfigured:after.bindings.some(b=>b.name==='LS_GUARD_APP_KEY'),verifiedAt:new Date().toISOString()};await fs.mkdir('work',{recursive:true});await fs.writeFile('work/private-account-deploy-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
