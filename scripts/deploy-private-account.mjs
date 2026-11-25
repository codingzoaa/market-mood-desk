// No-login loss guard: coordinate existing LS credentials with the quote collector. No account data deletion.
// Keep LS secrets on the existing backend; expose a narrow public service facade.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {build} from 'esbuild';

const sha=s=>createHash('sha256').update(s).digest('hex');
const token=(process.env.RAW_CLOUDFLARE_TOKEN||'').trim().replace(/^["']|["']$/g,'').replace(/^Bearer\s+/i,'').trim();if(!token||/\s/.test(token))throw Error('ACCOUNT_DEPLOY_TOKEN_MISSING');
const account='https://api.cloudflare.com/client/v4/accounts/78961f2ddb841df708b3a777fdcc94c2',name='market-note-private-account',root=account+'/workers/scripts/'+name,publicName='market-note-account',origin='https://market-note-account.kby0991.workers.dev';
const api=async(url,init={})=>{const r=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...init.headers},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('ACCOUNT_DEPLOY_HTTP_'+r.status);return r;};
const json=async(url,init={})=>{const d=await(await api(url,init)).json();if(!d.success)throw Error('ACCOUNT_API_REJECTED');return d.result;};
async function source(url){const r=await api(url);let s='';if((r.headers.get('content-type')||'').includes('multipart/')){for(const[n,f]of await r.formData())if(n!=='metadata')s+=typeof f==='string'?f:await f.text();}else s=await r.text();return s;}
const before=await json(root+'/settings'),old=await source(root),next=await fs.readFile('work/account-deploy/worker.mjs','utf8');
for(const n of ['ACCOUNT_ENCRYPTION_KEY','ACCOUNT_INDEX_KEY','PRIVATE_DB','LS_ACCOUNT_APP_KEY','LS_ACCOUNT_APP_SECRET','LS_ACCOUNT_NO'])if(!before.bindings.some(b=>b.name===n))throw Error('ACCOUNT_BINDINGS_INCOMPLETE');
if(!next.includes('PUBLIC_LOSS_GUARD')||!next.includes('LEGACY_ACCOUNT_REMOVED'))throw Error('ACCOUNT_PUBLIC_MODE_MISSING');
const expected=(await fs.readFile('worker/account/deployed-source.sha256','utf8')).trim();if(sha(old)!==expected&&sha(old)!==sha(next))throw Error('ACCOUNT_LIVE_SOURCE_CHANGED_REVIEW_REQUIRED');
// Public quote collectors must deploy the shared session gate before account monitoring can use it.
let coordination;for(let n=0;n<40;n++){const settings=await json(account+'/workers/scripts/market-note-ls-api/settings'),code=await source(account+'/workers/scripts/market-note-ls-api');const binding=settings.bindings.find(b=>b.name==='COLLECTOR'&&b.type==='durable_object_namespace');if(code.includes('LS_SESSION_COORDINATOR_V1')&&binding?.namespace_id){coordination=binding;break;}await new Promise(r=>setTimeout(r,5000));}if(!coordination)throw Error('LS_SHARED_COORDINATOR_DEPLOYMENT_REQUIRED');
const sharedBinding={name:'LS_SESSION_COORDINATOR',type:'durable_object_namespace',namespace_id:coordination.namespace_id,class_name:'CollectorAlarm',script_name:'market-note-ls-api'};
const overrides={LS_SESSION_POLICY:'COORDINATED_V1',ACCOUNT_ACCESS_MODE:'PUBLIC_LOSS_GUARD',ENABLE_ACCOUNT_SYNC:'false',ENABLE_T0150:'false',JOURNAL_BACKFILL_DATE:''};
const needsSettings=Object.entries(overrides).some(([n,v])=>!before.bindings.some(b=>b.name===n&&b.text===v));
if(sha(old)!==sha(next)||needsSettings){
 const keep=[...new Set(before.bindings.map(b=>b.type))];if(keep.some(t=>!['secret_text','plain_text','d1','durable_object_namespace'].includes(t)))throw Error('ACCOUNT_UNREVIEWED_BINDING_TYPE');
 const metadata={main_module:'worker.mjs',keep_bindings:keep,bindings:[...Object.entries(overrides).map(([name,text])=>({name,text,type:'plain_text'})),sharedBinding],compatibility_date:before.compatibility_date,compatibility_flags:before.compatibility_flags||[],annotations:{'workers/message':'Owner requested public loss guard only; disable original account history'}};
 for(const n of ['usage_model','limits','logpush','tail_consumers','observability','placement','tags'])if(before[n]!==undefined)metadata[n]=before[n];
 const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('worker.mjs',new Blob([next],{type:'application/javascript+module'}),'worker.mjs');await json(root,{method:'PUT',body:form});
}
const after=await json(root+'/settings');
for(const a of before.bindings){const b=after.bindings.find(b=>b.name===a.name);if(!b||b.type!==a.type)throw Error('ACCOUNT_BINDING_LOST');if(a.type!=='secret_text'&&!Object.hasOwn(overrides,a.name)&&a.name!=='LS_SESSION_COORDINATOR'&&JSON.stringify(a)!==JSON.stringify(b))throw Error('ACCOUNT_UNRELATED_BINDING_CHANGED');}
for(const[n,v]of Object.entries(overrides))if(!after.bindings.some(b=>b.name===n&&b.text===v))throw Error('ACCOUNT_PUBLIC_SETTING_VERIFICATION_FAILED');
if(sha(await source(root))!==sha(next))throw Error('ACCOUNT_SOURCE_VERIFICATION_FAILED');
// Stop old cron triggers as well as the code-level scheduled guard.
await json(root+'/schedules',{method:'PUT',headers:{'Content-Type':'application/json'},body:'[]'});
// New public hostname needs no changes to unrelated Access apps or account-wide rules.
const existingProxy=await fetch(account+'/workers/scripts/'+publicName,{headers:{Authorization:'Bearer '+token}});if(existingProxy.status!==404){if(!existingProxy.ok)throw Error('ACCOUNT_PUBLIC_WORKER_CHECK_FAILED');const previousProxy=await existingProxy.text();if(!previousProxy.includes('ACCOUNT_BACKEND')||!previousProxy.includes('LEGACY_ACCOUNT_REMOVED'))throw Error('ACCOUNT_PUBLIC_WORKER_NAME_ALREADY_USED');}
await build({entryPoints:['worker/account/public-proxy.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'work/account-deploy/public-proxy.mjs'});
const proxySource=await fs.readFile('work/account-deploy/public-proxy.mjs','utf8');
async function uploadProxy(allowMaintenance){const form=new FormData();form.set('metadata',JSON.stringify({main_module:'proxy.mjs',compatibility_date:after.compatibility_date,bindings:[{type:'service',name:'ACCOUNT_BACKEND',service:name},...(allowMaintenance?[{type:'plain_text',name:'ACCOUNT_ALLOW_MAINTENANCE',text:'true'}]:[])]}));form.set('proxy.mjs',new Blob([proxySource],{type:'application/javascript+module'}),'proxy.mjs');await json(account+'/workers/scripts/'+publicName,{method:'PUT',body:form});}
await uploadProxy(false);await json(account+'/workers/scripts/'+publicName+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
let verified=false;for(let n=0;n<12;n++){const r=await fetch(origin+'/api/lossguard',{redirect:'manual',signal:AbortSignal.timeout(20000)});if(r.status===200){const d=await r.json();if(d.accessMode==='public'&&d.legacyDataRemoved===true){verified=true;break;}}await new Promise(r=>setTimeout(r,2500));}
if(!verified)throw Error('ACCOUNT_PUBLIC_ENDPOINT_NOT_READY');
const retiredMaintenance=await fetch(origin+'/api/_maintenance/clear-legacy',{method:'POST',body:'{}'});if(retiredMaintenance.status!==410)throw Error('ACCOUNT_MAINTENANCE_ROUTE_MUST_STAY_CLOSED');
const liveMode=await fetch(origin+'/api/lossguard',{redirect:'manual'});const mode=await liveMode.json();if(mode.sessionPolicy!=='shared-serialized'||mode.intradayReady!==true||mode.pollIntervalSeconds!==30)throw Error('LS_SHARED_SESSION_NOT_ACTIVE');
const embeddedOrigin='https://codingzoaa.github.io';const preflight=await fetch(origin+'/api/lossguard/poll',{method:'OPTIONS',headers:{Origin:embeddedOrigin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});if(preflight.status!==204||preflight.headers.get('Access-Control-Allow-Origin')!==embeddedOrigin)throw Error('ACCOUNT_EMBEDDED_CORS_FAILED');
for(const path of ['/','/app.js','/app.css']){const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});if(r.status!==200)throw Error('ACCOUNT_PUBLIC_ASSET_FAILED');}
for(const path of ['/api/account','/api/sync','/api/connection-test','/api/journal-previous']){const r=await fetch(origin+path,{redirect:'manual'});if(r.status!==410)throw Error('ACCOUNT_LEGACY_ROUTE_NOT_REMOVED');}
let collection={verified:false,error:null};try{const r=await fetch(origin+'/api/lossguard/poll',{method:'POST',redirect:'manual',headers:{Origin:embeddedOrigin,'Sec-Fetch-Site':'cross-site','Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(100000)});const d=await r.json();collection={verified:r.ok&&typeof d.state?.pnlKRW==='number'&&typeof d.state?.sample?.equityKRW==='number',error:typeof d.error==='string'&&/^GUARD_[A-Z_]+$/.test(d.error)?d.error:null,busy:!!(d.busy||d.throttled)};}catch{collection={verified:false,error:'GUARD_VERIFICATION_UNAVAILABLE'};}
const report={collection,worker:name,publicWorker:publicName,url:origin,sourceSha256:sha(next),authenticationRequired:false,embeddedWorkspaceEnabled:true,corsAllowedOrigin:embeddedOrigin,lsSecretsRetainedOnBackend:true,legacySyncDisabled:true,existingAppKeyEnabled:true,sharedSessionGateEnabled:true,pollIntervalSeconds:30,accountRecordsPreserved:true,lossGuardPreserved:true,verifiedAt:new Date().toISOString()};await fs.mkdir('work',{recursive:true});await fs.writeFile('work/private-account-deploy-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
