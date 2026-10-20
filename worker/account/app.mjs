import {authenticate,check,privateHeaders} from './security.mjs';
import {loadTrades,readState} from './store.mjs';
import {reviewedContract} from './provider.mjs';
import {syncAccount} from './sync.mjs';
import {analyzeAccount} from '../../src/account/analysis.ts';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
export function accountWorker({sessionFactory,verify=authenticate}={}){return {
 async fetch(request,env,ctx){
  try{await verify(request,env);}catch{return json({error:'AUTHENTICATION_REQUIRED'},401);}
  const url=new URL(request.url);
  if(request.method==='POST'){
   if(url.pathname!=='/api/sync')return json({error:'NOT_FOUND'},404);
   if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'||request.headers.get('Content-Type')!=='application/json')return json({error:'REQUEST_REJECTED'},403);
   if(env.ENABLE_ACCOUNT_SYNC!=='true')return json({error:'SYNC_DISABLED'},409);
   try{reviewedContract(env);}catch{return json({error:'LS_CONTRACT_REQUIRED'},409);}
   ctx.waitUntil(syncAccount(env,sessionFactory).catch(()=>{}));return json({accepted:true},202);
  }
  if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
  try{
   if(url.pathname==='/api/account'){
    const trades=await loadTrades(env),summary=analyzeAccount(trades),selected=url.searchParams.get('date');
    check(!selected||/^\d{4}-\d{2}-\d{2}$/.test(selected),'INVALID_DATE');
    const visible=trades.filter(t=>!selected||t.date===selected).sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)||b.id.localeCompare(a.id));
    const recentTrades=visible.slice(0,200).map(({date,time,symbol,name,side,quantity,price,grossKRW,feeKRW,taxKRW})=>({date,time,symbol,name,side,quantity,price,grossKRW,feeKRW,taxKRW}));
    const sync=await readState(env,'sync'),error=await readState(env,'lastError');let ready=true;try{reviewedContract(env);}catch{ready=false;}
    return json({summary,recentTrades,matchedTrades:visible.length,sync:{enabled:env.ENABLE_ACCOUNT_SYNC==='true',contractReady:ready,lastSuccessAt:sync?.lastSuccessAt||null,through:sync?.through||null,more:!!sync?.job,error:error?.code||null}});
   }
   if(url.pathname.startsWith('/api/'))return json({error:'NOT_FOUND'},404);
   if(!['/','/index.html','/app.js','/app.css'].includes(url.pathname))return json({error:'NOT_FOUND'},404);
   const asset=await env.ASSETS.fetch(request),headers=new Headers(asset.headers);for(const [k,v] of Object.entries(privateHeaders))headers.set(k,v);return new Response(asset.body,{status:asset.status,headers});
  }catch{return json({error:'ACCOUNT_DATA_UNAVAILABLE'},503);}
 },
 async scheduled(event,env,ctx){ctx.waitUntil(syncAccount(env,sessionFactory,event.scheduledTime).catch(()=>{}));}
};}
