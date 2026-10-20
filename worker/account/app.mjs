import {loadLedger} from './ledger-store.mjs';
import {readLedgerRules,ledgerToTrade} from './cdpcq04700.mjs';
import {authenticate,browserLogin,check,privateHeaders} from './security.mjs';
import {loadTrades,readState} from './store.mjs';
import {reviewedContract} from './provider.mjs';
import {runScheduledAccountSync,accountSyncWindow} from './sync.mjs';
import {checkAccountConnection} from './connection.mjs';
import {analyzeAccount} from '../../src/account/analysis.ts';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
export function accountWorker({sessionFactory,verify=authenticate}={}){return {
 async fetch(request,env,ctx){
  try{await verify(request,env,fetch,Date.now(),ctx);}catch(error){
   const reason=['AUTH_NOT_CONFIGURED','AUTH_APPLICATION_MISMATCH','AUTH_OWNER_MISMATCH','AUTH_UNAVAILABLE'].includes(error?.message)?error.message:'AUTH_TOKEN_REJECTED';
   return browserLogin(request,env)||json({error:'AUTHENTICATION_REQUIRED',reason},401);
  }
  const url=new URL(request.url);
  if(request.method==='POST'){
   if(!['/api/sync','/api/connection-test'].includes(url.pathname))return json({error:'NOT_FOUND'},404);
   if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'||request.headers.get('Content-Type')!=='application/json')return json({error:'REQUEST_REJECTED'},403);
   if(url.pathname==='/api/connection-test'){
    try{const result=await checkAccountConnection(env,sessionFactory);return json(result,result.ok?200:409);}catch{return json({ok:false,error:'ACCOUNT_CONNECTION_UNAVAILABLE'},503);}
   }
   if(env.ENABLE_ACCOUNT_SYNC!=='true')return json({error:'SYNC_DISABLED'},409);
   if(!accountSyncWindow(env))return json({error:'ACCOUNT_SYNC_WINDOW_CLOSED'},409);
   try{reviewedContract(env);}catch{return json({error:'LS_CONTRACT_REQUIRED'},409);}
   ctx.waitUntil(runScheduledAccountSync(env,sessionFactory).catch(()=>{}));return json({accepted:true},202);
  }
  if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
  try{
   if(url.pathname==='/api/account'){
    const contract=reviewedContract(env),ledgerMode=contract.mode==='CDPCQ04700_LEDGER_V1',ledger=ledgerMode?await loadLedger(env):[];
    let rules=null,rulesError=false;try{rules=readLedgerRules(env);}catch{rulesError=true;}
    const mapped=ledger.map(row=>({row,...ledgerToTrade(row,rules)})),trades=ledgerMode?mapped.flatMap(x=>x.trade?[x.trade]:[]):await loadTrades(env),summary=analyzeAccount(trades),selected=url.searchParams.get('date');
    if(ledger.length){const dates=ledger.map(r=>r.date).sort();summary.from=dates[0];summary.to=dates.at(-1);}
    const blocked=mapped.filter(x=>x.issue),blockedAnalysis=blocked.length>0;
    if(blockedAnalysis)Object.assign(summary,{realizedKRW:null,feesKRW:null,buyKRW:null,sellKRW:null,winRate:null,complete:false,daily:[],holdings:[]});
    const reviewGroups=[...new Map(blocked.map(x=>{const f=x.row.fields,key=JSON.stringify([f.TpCodeNm,f.SmryNo,f.SmryNm,f.CancTpNm,f.CrcyCode,x.issue]);return [key,{type:f.TpCodeNm||'',summaryCode:f.SmryNo||'',summary:f.SmryNm||'',cancellation:f.CancTpNm||'',currency:f.CrcyCode||'',issue:x.issue}];})).values()].slice(0,100);
    const ledgerStatus={mode:ledgerMode?'LEDGER':'CUSTOM_MAPPING',records:ledger.length,cashMovements:mapped.filter(x=>x.cashMovement).length,blockedRecords:blocked.length,analysisBlocked:blockedAnalysis,rulesReady:!!rules&&!rulesError,rulesError,reviewGroups};
    check(!selected||/^\d{4}-\d{2}-\d{2}$/.test(selected),'INVALID_DATE');
    const visible=trades.filter(t=>!selected||t.date===selected).sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)||b.id.localeCompare(a.id));
    const recentTrades=visible.slice(0,200).map(({date,time,symbol,name,side,quantity,price,grossKRW,feeKRW,taxKRW,orderingBasis})=>({date,time,symbol,name,side,quantity,price,grossKRW,feeKRW,taxKRW,timeBasis:orderingBasis==='LEDGER_SEQUENCE'?'PROCESSING':'EXECUTION'}));
    const sync=await readState(env,'sync'),error=await readState(env,'lastError');let ready=true;try{reviewedContract(env);}catch{ready=false;}
    const ledgerRecords=mapped.filter(x=>!selected||x.row.date===selected).sort((a,b)=>b.row.date.localeCompare(a.row.date)||Number(b.row.id)-Number(a.row.id)).slice(0,200).map(x=>({date:x.row.date,name:x.row.fields.IsuNm||'',type:x.row.fields.TpCodeNm||'',summary:x.row.fields.SmryNm||'',status:x.issue?'REVIEW_REQUIRED':'MAPPED'}));
    return json({summary,ledgerStatus,ledgerRecords,recentTrades,matchedTrades:visible.length,connection:await readState(env,'connectionCheck'),sync:{enabled:env.ENABLE_ACCOUNT_SYNC==='true',contractReady:ready,lastSuccessAt:sync?.lastSuccessAt||null,through:sync?.through||null,more:!!sync?.job,error:error?.code||null}});
   }
   if(url.pathname.startsWith('/api/'))return json({error:'NOT_FOUND'},404);
   if(!['/','/index.html','/app.js','/app.css'].includes(url.pathname))return json({error:'NOT_FOUND'},404);
   const asset=await env.ASSETS.fetch(request),headers=new Headers(asset.headers);for(const [k,v] of Object.entries(privateHeaders))headers.set(k,v);return new Response(asset.body,{status:asset.status,headers});
  }catch{return json({error:'ACCOUNT_DATA_UNAVAILABLE'},503);}
 },
 async scheduled(event,env,ctx){ctx.waitUntil(runScheduledAccountSync(env,sessionFactory).catch(()=>{}));}
};}
