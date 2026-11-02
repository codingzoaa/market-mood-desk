import {createSession} from './tls.mjs';
import {accessToken,tr,number,kst} from './ls.mjs';

const state=(env,id,value)=>env.DB.prepare(
 'INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload'
).bind(id,JSON.stringify(value)).run();

export async function recoverPensionAfterClose(env,now=new Date()){
 const day=kst(now);
 if(['Sat','Sun'].includes(day.weekday)||day.time<'2030'||day.time>'2359'||!env.LS_APP_KEY||!env.LS_APP_SECRET)return;
 const date=day.date;
 const detailsRow=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first();
 if(!detailsRow?.payload)return;
 const details=JSON.parse(detailsRow.payload);
 const close=details.indices?.KOSPI?.value;
 if(typeof close!=='number'||!Number.isFinite(close)||close<=0)return;
 const stored=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('pension-recovery:'+date).first();
 if(stored?.payload)return; // successful record is immutable; never poll LS repeatedly.
 const statusId='pension-recovery-status:'+date;
 let session;
 try{
  await state(env,statusId,{date,status:'FETCHING',checkedAt:new Date().toISOString()});
  session=await createSession();
  const token=await accessToken(env,session.fetch,Date.now(),false);
  const d=(await tr(token,'t1601',{gubun1:'2',gubun2:'2',gubun3:'',gubun4:'2',exchgubun:'K'},undefined,session.fetch)).data;
  const raw=d?.t1601OutBlock1?.svolume_06;
  if(raw===null||raw===undefined||raw==='')throw new Error('PENSION_FIELD_MISSING');
  const netBuyEok=number(raw,-1e8,1e8);
  const idx=(await tr(token,'t1511',{upcode:'001'},undefined,session.fetch)).data?.t1511OutBlock;
  const quote=number(idx?.pricejisu,0,1e7);
  if(Math.abs(quote-close)>0.021)throw new Error('KOSPI_CLOSE_MISMATCH');
  if(kst().date!==date)throw new Error('TRADE_DATE_CHANGED');
  const observedAt=new Date().toISOString();
  const result={date,kospiClose:close,pensionNetBuyEok:netBuyEok,observedAt,source:'LS증권 t1601 KOSPI 기금(06) · 정규장 이후 재조회',verifiedAgainst:'LS t1511 + D1 stored KOSPI close'};
  await state(env,'pension-recovery:'+date,result);
  await state(env,statusId,{date,status:'COMPLETE',observedAt});
 }catch(err){
  const code=err?.code||(/^[A-Z_]{3,50}$/.test(String(err?.message))?err.message:'RETRIEVAL_FAILED');
  await state(env,statusId,{date,status:'FAILED',code:String(code).slice(0,60),checkedAt:new Date().toISOString()});
 }finally{
  if(session)await session.close();
 }
}

// The current regular-session archive remains the authority for price/date.
// A pension-only evening correction is composed in memory, not written into
// the existing dashboards' market-details record.
export function composeRecoveredPension(details,recovery){
 if(!details||!recovery||details.date!==recovery.date||recovery.source!=='LS증권 t1601 KOSPI 기금(06) · 정규장 이후 재조회')return null;
 if(typeof recovery.kospiClose!=='number'||Math.abs((details.indices?.KOSPI?.value??NaN)-recovery.kospiClose)>0.021)return null;
 if(typeof recovery.pensionNetBuyEok!=='number'||!Number.isFinite(recovery.pensionNetBuyEok))return null;
 if(!details.flows||details.flows.unit!=='억원'||!details.flows.segments?.KOSPI)return null;
 return {...details,flows:{...details.flows,asOf:recovery.observedAt,
  segments:{...details.flows.segments,KOSPI:{...details.flows.segments.KOSPI,pension:recovery.pensionNetBuyEok}}}};
}
