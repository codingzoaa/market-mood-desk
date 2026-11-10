import {createSession} from './tls.mjs';
import {accessToken,tr,kst,number} from './ls.mjs';

// t1601 exchange flags K, N and U are candidates only until real LS responses
// pass additive reconciliation. Never advertise inferred combined flow as verified.
const requestBody=exchgubun=>({gubun1:'2',gubun2:'2',gubun3:'',gubun4:'2',exchgubun});
const parties={individual:'08',foreign:'17',institution:'18'};
export function spotFromT1601(data){
 const result={};
 for(const [i,market] of ['KOSPI','KOSDAQ'].entries()){
  const row=data?.['t1601OutBlock'+(i+1)];
  if(!row)throw Error('MISSING_SPOT_'+market);
  result[market]=Object.fromEntries(Object.entries(parties).map(([name,code])=>[name,number(row['svolume_'+code],-1e11,1e11)]));
 }
 return result;
}
export function reconcileVenues(krx,nxt,combined){
 let matched=0,materialNxt=false;
 const differences={};
 for(const market of ['KOSPI','KOSDAQ']){
  differences[market]={};
  for(const party of Object.keys(parties)){
   const k=krx?.[market]?.[party],n=nxt?.[market]?.[party],u=combined?.[market]?.[party];
   if(![k,n,u].every(x=>typeof x==='number'&&Number.isFinite(x)))throw Error('UNVERIFIED_VALUE');
   if(Math.abs(n)>=2)materialNxt=true;
   const difference=u-(k+n);
   differences[market][party]=difference;
   // t1601 numbers are expressed in 억원; permit small quote/rounding drift.
   const tolerance=Math.max(3,Math.min(15,0.003*(Math.abs(k)+Math.abs(n)+Math.abs(u))));
   if(Math.abs(difference)>tolerance)throw Error('INTEGRATED_RECONCILIATION_FAILED');
   matched++;
  }
 }
 if(matched!==6||!materialNxt)throw Error('NXT_DISTINCT_FLOW_NOT_OBSERVED');
 return {scope:'KRX+NXT',status:'verified',unit:'억원',segments:combined,components:{KRX:krx,NXT:nxt},differences};
}
const reason=e=>{
 const code=e?.code||e?.message||'PROBE_ERROR';
 return /^([A-Z0-9_]{3,80})$/.test(String(code))?String(code):'PROBE_ERROR';
};
export async function probeVenueFlows(env,now=new Date(),dependencies={}){
 const t=kst(now),date=t.date;
 if(['Sat','Sun'].includes(t.weekday)||t.time<'1620'||t.time>'1700')return {status:'outside-probe-window'};
 const key='investor-flow-venue:'+date;
 const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key).first();
 if(row?.payload && JSON.parse(row.payload).status==='verified')return {status:'already-verified'};
 // No external/public parameter is allowed to trigger an LS query.
 let session;
 try{
  session=dependencies.session||await createSession();
  const fetcher=dependencies.fetcher||session.fetch;
  const token=dependencies.token||await accessToken(env,fetcher,Date.now(),false);
  const results={};
  for(const flag of ['K','N','U']){
   const response=await (dependencies.request||((code,body)=>tr(token,code,body,undefined,fetcher)))('t1601',requestBody(flag));
   results[flag]=spotFromT1601(response.data);
   if(!dependencies.request)await new Promise(r=>setTimeout(r,1100));
  }
  const verified=reconcileVenues(results.K,results.N,results.U);
  const payload={...verified,date,asOf:new Date(now).toISOString(),source:'LS t1601 K/N/U response; K+N=U reconciliation'};
  await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key,JSON.stringify(payload)).run();
  return {status:'verified'};
 }catch(e){
  const failure={date,status:'unverified',checkedAt:new Date(now).toISOString(),error:reason(e)};
  await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key,JSON.stringify(failure)).run();
  return {status:'unverified',error:failure.error};
 }finally{if(session&&!dependencies.session)await session.close();}
}
