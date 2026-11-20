import {accessToken,tr,kst,collectWindow,collectionFetch} from './ls.mjs';
import {createSession} from './tls.mjs';
import {historicalFlowPoints,verifiedFlowScale,sourceTime} from './intraday-recovery.mjs';
import {indexSeries} from './details.mjs';
import {normalizeProgram,PROGRAM_ALIGNMENT_VERSION} from './program-flow.mjs';
import {marketSession} from '../shared/market-session.mjs';
const put=(env,id,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
const read=async(env,id)=>{const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();return row?{text:row.payload,value:JSON.parse(row.payload)}:null;};
export function previousTradeDate(rows,today){
 const dates=[...new Set((rows||[]).map(r=>r.date))].sort();
 if(dates.at(-1)!==today.replaceAll('-','')||dates.length<2)throw Error('PREVIOUS_TRADE_DATE_UNVERIFIED');
 const raw=dates.at(-2);if(!/^\d{8}$/.test(raw))throw Error('PREVIOUS_TRADE_DATE_INVALID');
 return raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6);
}
export function mergeProgramObservations(old=[],incoming=[]){
 const map=new Map(old.map(p=>[p.time,p]));
 for(const p of incoming){const prior=map.get(p.time);if(!prior)map.set(p.time,p);else if(prior.changePct===null&&Number.isFinite(p.changePct))map.set(p.time,{...prior,changePct:p.changePct,indexSourceTime:p.indexSourceTime});}
 return [...map.values()].sort((a,b)=>a.time.localeCompare(b.time));
}
// t1602 / t1662 expose only today and the preceding trading session.
// Resolve that session from an independently dated daily chart, never from a calendar subtraction.
export async function recoverPreviousIntraday(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow())return;
 const today=kst().date,statusId='previous-intraday-recovery:'+today,saved=await read(env,statusId);
 if(saved?.value.status==='COMPLETE'||saved?.value.checkedAt&&Date.now()-Date.parse(saved.value.checkedAt)<600000)return;
 const lease=String(Date.now()+240000),leaseId='previous-intraday-lease';
 await env.DB.prepare('INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)').bind(leaseId,'0').run();
 if(!await env.DB.prepare('UPDATE state SET payload=? WHERE id=? AND CAST(payload AS INTEGER)<? RETURNING id').bind(lease,leaseId,Date.now()).first())return;
 let session,date,stage='DATE';const checkedAt=new Date().toISOString();
 try{
  await put(env,statusId,{status:'RUNNING',checkedAt});
  session=await createSession();const fetcher=collectionFetch(session.fetch),token=await accessToken(env,fetcher,Date.now(),false);
  const request=async(code,input,continuation)=>{await new Promise(r=>setTimeout(r,1150));return tr(token,code,input,continuation,fetcher);};
  const daily=(await request('t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:today.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'})).data;
  date=previousTradeDate(daily.t8410OutBlock1,today);
  const original=await read(env,'details:'+date);if(!original)throw Error('PREVIOUS_DETAILS_MISSING');
  const d=original.value,flows={},indices={},programs={},programErrors={};
  for(const [board,market,upcode,gubun] of [['KOSPI','1','001','0'],['KOSDAQ','3','301','1']]){
   stage='FLOWS_'+board;const rows=[];let cursor='',continuation,header,scale,complete=false;const cursors=new Set();
   for(let page=0;page<20;page++){
    const result=await request('t1602',{market,upcode,gubun1:'2',gubun2:'1',cts_time:cursor||' ',cts_idx:0,cnt:100,gubun3:'',exchgubun:'K'},continuation);
    if(!Array.isArray(result.data.t1602OutBlock1))throw Error('PREVIOUS_FLOW_SHAPE');
    if(page===0){header=result.data.t1602OutBlock;scale=verifiedFlowScale(header,d.flows?.segments?.[board]||{});}
    rows.push(...result.data.t1602OutBlock1);
    const next=String(result.data.t1602OutBlock?.cts_time||'').trim();
    if(!next||!result.data.t1602OutBlock1.length||sourceTime(next)<=marketSession(date).open+'00'){complete=true;break;}
    if(cursors.has(next))throw Error('PREVIOUS_FLOW_CURSOR');cursors.add(next);cursor=next;continuation=result.continuation;
   }
   if(!complete)throw Error('PREVIOUS_FLOW_INCOMPLETE');flows[board]={rows,header,scale};
   stage='INDEX_'+board;
   const chart=(await request('t8409',{shcode:upcode,ncnt:5,qrycnt:100,nday:'1',sdate:date.replaceAll('-',''),stime:'',edate:date.replaceAll('-',''),etime:marketSession(date).flowEnd+'00',cts_date:'',cts_time:'',comp_yn:'N'})).data;
   const indexRows=(chart.t8409OutBlock1||[]).filter(r=>r.date===date.replaceAll('-',''));
   indices[board]={quote:d.indices?.[board],series:indexSeries(indexRows,date)};
   if(!indices[board].quote||!d.indices[board].asOf||kst(new Date(d.indices[board].asOf)).date!==date)throw Error('PREVIOUS_INDEX_DATE');
   try{
    const response=(await request('t1662',{gubun,gubun1:'0',gubun3:'1',exchgubun:'K'})).data;
    programs[board]=normalizeProgram(response.t1662OutBlock,indexRows,d.indices[board].value-d.indices[board].change,{date,endTime:marketSession(date).flowEnd});if(!programs[board].length)throw Error('PROGRAM_NO_POINTS');
   }catch(e){programErrors[board]=String(e.code||e.message).replace(/[^A-Z0-9_]/g,'').slice(0,80);}
  }
  if(kst().date!==today||!collectWindow())throw Error('PREVIOUS_DATE_CHANGED');
  // Archive actual response fields before writing derived points; no credentials are stored.
  await put(env,'intraday-originals:'+date,{date,observedAt:new Date().toISOString(),method:'LS_PREVIOUS_SESSION_V1',flows:Object.fromEntries(Object.entries(flows).map(([b,f])=>[b,{scale:f.scale,header:{svolume_08:f.header.svolume_08,svolume_17:f.header.svolume_17},rows:f.rows.map(r=>({time:r.time,sv_08:r.sv_08,sv_17:r.sv_17,sv_18:r.sv_18}))}])),indices,programs});
  let merged=false,report;
  for(let attempt=0;attempt<5;attempt++){
   const latest=await read(env,'details:'+date);if(!latest)throw Error('PREVIOUS_DETAILS_MISSING');
   const history=historicalFlowPoints({date,observedAt:new Date().toISOString(),flows,indices,previous:latest.value.flowHistory||[]});
   report={date,status:Object.keys(programErrors).length?'PARTIAL':'COMPLETE',checkedAt,completedAt:new Date().toISOString(),method:'LS_PREVIOUS_SESSION_V1',added:history.length-(latest.value.flowHistory||[]).length,institutionEnriched:history.filter(p=>['KOSPI','KOSDAQ'].some(b=>Number.isFinite(p.markets[b].institution)&&!(latest.value.flowHistory||[]).some(o=>o.time===p.time&&Number.isFinite(o.markets?.[b]?.institution)))).length,total:history.length,programErrors};
   const update=await env.DB.prepare("UPDATE state SET payload=json_set(payload,'$.flowHistory',json(?),'$.previousSessionBackfill',json(?)) WHERE id=? AND payload=? RETURNING id").bind(JSON.stringify(history),JSON.stringify(report),'details:'+date,latest.text).first();
   if(update){merged=true;break;}
  }
  if(!merged)throw Error('PREVIOUS_WRITE_CONFLICT');
  report.programAdded={};
  for(const board of ['KOSPI','KOSDAQ']){if(!programs[board]?.length)continue;let written=false;
   for(let attempt=0;attempt<5;attempt++){
    const old=await read(env,'program-flow:'+date),p=old?.value||{date,asOf:new Date().toISOString(),unit:'억원',markets:{},errors:{}};
    const points=mergeProgramObservations(p.markets?.[board],programs[board]);report.programAdded[board]=points.length-(p.markets?.[board]?.length||0);
    const value={...p,alignmentVersion:PROGRAM_ALIGNMENT_VERSION,previousSessionBackfillAt:new Date().toISOString(),markets:{...p.markets,[board]:points}};
    const q=old?await env.DB.prepare('UPDATE state SET payload=? WHERE id=? AND payload=? RETURNING id').bind(JSON.stringify(value),'program-flow:'+date,old.text).first():await env.DB.prepare('INSERT OR IGNORE INTO state(id,payload) VALUES(?,?) RETURNING id').bind('program-flow:'+date,JSON.stringify(value)).first();
    if(q){written=true;break;}
   }if(!written)throw Error('PREVIOUS_PROGRAM_WRITE_CONFLICT');
  }
  await put(env,statusId,report);
 }catch(e){await put(env,statusId,{date,status:'FAILED',checkedAt,stage,code:String(e.code||e.message).replace(/[^A-Z0-9_]/g,'').slice(0,80)});}
 finally{if(session)await session.close();await env.DB.prepare("UPDATE state SET payload='0' WHERE id=? AND payload=?").bind(leaseId,lease).run();}
}
