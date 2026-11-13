import {accessToken,tr,kst,collectionFetch} from './ls.mjs';
import {rawFlows} from './details.mjs';
import {createSession} from './tls.mjs';

// A separate closing sample extends only the investor card, not quote/chart history.
export function closingFlowWindow(now=new Date()){
 const k=kst(now);return !['Sat','Sun'].includes(k.weekday)&&k.time==='1615';
}
export async function collectClosingFlows(env,{clock=()=>new Date(),openSession=createSession}={}){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!closingFlowWindow(clock()))return;
 const date=kst(clock()).date,id='details:'+date;
 const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();
 if(!row)return;
 const old=JSON.parse(row.payload);
 if(old.flows?.asOf&&kst(new Date(old.flows.asOf)).date===date&&kst(new Date(old.flows.asOf)).time==='1615')return;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('closing-flow-lease','0')").run();
 const now=clock().getTime(),lease=String(now+60000);
 if(!await env.DB.prepare("UPDATE state SET payload=? WHERE id='closing-flow-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(lease,now).first())return;
 let session;
 try{
  session=await openSession();const fetcher=collectionFetch(session.fetch,clock,'1615');
  const token=await accessToken(env,fetcher,clock().getTime(),false);
  const daily=(await tr(token,'t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'},undefined,fetcher)).data;
  if(daily.t8410OutBlock1?.map(r=>r.date).sort().at(-1)!==date.replaceAll('-',''))throw Error('TRADE_DATE');
  const data=(await tr(token,'t1601',{gubun1:'2',gubun2:'2',gubun3:'',gubun4:'2',exchgubun:'K'},undefined,fetcher)).data;
  if(!closingFlowWindow(clock()))return;
  const flows={asOf:clock().toISOString(),unit:'억원',source:'LS증권 KRX · t1601 금액 순매수',segments:rawFlows(data)};
  await env.DB.prepare("UPDATE state SET payload=json_set(json_remove(payload,'$.errors.flows'),'$.flows',json(?)) WHERE id=?").bind(JSON.stringify(flows),id).run();
 }catch(e){
  await env.DB.prepare("INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind('closing-flow-attempt:'+date,JSON.stringify({date,checkedAt:clock().toISOString(),error:e.code||'CLOSING_FLOW_FAILED'})).run();
 }finally{
  if(session)await session.close();
  await env.DB.prepare("UPDATE state SET payload='0' WHERE id='closing-flow-lease' AND payload=?").bind(lease).run();
 }
}
