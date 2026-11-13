import {accessToken,tr,kst,collectionFetch} from './ls.mjs';
import {archivePutClose} from './put-daily.mjs';
import {appendFlowHistory} from './flow-history.mjs';
import {rawFlows,indexQuote} from './details.mjs';
import {createSession} from './tls.mjs';

// Capture the final flow/index sample; today alone can recover a missed closing sample.
export function closingFlowRecoveryWindow(now=new Date()){
 const k=kst(now);return k.date==='2026-11-13'&&k.time>'1615'&&k.time<='2359';
}
export function closingFlowWindow(now=new Date()){
 const k=kst(now);return !['Sat','Sun'].includes(k.weekday)&&k.time==='1615';
}
export async function collectClosingFlows(env,{clock=()=>new Date(),openSession=createSession}={}){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!(closingFlowWindow(clock())||closingFlowRecoveryWindow(clock())))return;
 const date=kst(clock()).date,id='details:'+date;
 const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();
 if(!row)return;
 const old=JSON.parse(row.payload);
 const recovery=closingFlowRecoveryWindow(clock());
 if(recovery&&old.closingRecovery?.tradeDate===date)return;
 if(old.flows?.asOf&&kst(new Date(old.flows.asOf)).date===date&&kst(new Date(old.flows.asOf)).time==='1615')return;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('closing-flow-lease','0')").run();
 const now=clock().getTime(),lease=String(now+60000);
 if(!await env.DB.prepare("UPDATE state SET payload=? WHERE id='closing-flow-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(lease,now).first())return;
 let session;
 try{
  session=await openSession();const fetcher=recovery?session.fetch:collectionFetch(session.fetch,clock,'1615');
  const token=await accessToken(env,fetcher,clock().getTime(),false);
  const daily=(await tr(token,'t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'},undefined,fetcher)).data;
  if(daily.t8410OutBlock1?.map(r=>r.date).sort().at(-1)!==date.replaceAll('-',''))throw Error('TRADE_DATE');
  const data=(await tr(token,'t1601',{gubun1:'2',gubun2:'2',gubun3:'',gubun4:'2',exchgubun:'K'},undefined,fetcher)).data;
  const indices={};
  const observedAt=clock().toISOString();
  for(const [code,market] of [['001','KOSPI'],['301','KOSDAQ']]){
   if(market==='KOSDAQ')await new Promise(resolve=>setTimeout(resolve,1100));
   const quote=indexQuote((await tr(token,'t1511',{upcode:code},undefined,fetcher)).data.t1511OutBlock);
   indices[market]={...old.indices?.[market],...quote,asOf:observedAt};
  }
  if(kst(clock()).date!==date||!(closingFlowWindow(clock())||closingFlowRecoveryWindow(clock())))return;
  const flows={asOf:observedAt,unit:'억원',source:'LS증권 KRX · t1601 금액 순매수'+(recovery?' · 마감 후 재조회':''),segments:rawFlows(data)};
  const merged={...old,asOf:flows.asOf,checkedAt:flows.asOf,flows,indices,errors:{...old.errors}};
  for(const key of ['flows','ls','KOSPI','KOSDAQ'])delete merged.errors[key];
  if(recovery)merged.closingRecovery={method:'LS_KRX_CLOSING_RECOVERY_V1',tradeDate:date,observedAt:flows.asOf,targetClose:'16:15 KST',note:'마감 이후 재조회 · 실제 관측 시각 보존'};
  else merged.flowHistory=appendFlowHistory(old.flowHistory,merged);
  // JSON patch preserves independently enriched charts and history on a late recovery.
  const patch={asOf:merged.asOf,checkedAt:merged.checkedAt,flows,indices,errors:{flows:null,ls:null,KOSPI:null,KOSDAQ:null},...(recovery?{closingRecovery:merged.closingRecovery}:{flowHistory:merged.flowHistory})};
  await env.DB.prepare("UPDATE state SET payload=json_patch(payload,json(?)) WHERE id=?").bind(JSON.stringify(patch),id).run();
  await archivePutClose(env,merged,clock());
 }catch(e){
  await env.DB.prepare("INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind('closing-flow-attempt:'+date,JSON.stringify({date,checkedAt:clock().toISOString(),error:e.code||'CLOSING_FLOW_FAILED'})).run();
 }finally{
  if(session)await session.close();
  await env.DB.prepare("UPDATE state SET payload='0' WHERE id='closing-flow-lease' AND payload=?").bind(lease).run();
 }
}
