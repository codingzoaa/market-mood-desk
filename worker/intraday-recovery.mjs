import {createSession} from './tls.mjs';
import {accessToken,tr,number,kst,collectWindow,collectionFetch} from './ls.mjs';
import {indexQuote,indexSeries,rawFlows} from './details.mjs';
const pause=()=>new Promise(r=>setTimeout(r,1100));
const put=(env,id,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
export function sourceTime(value){
 const s=String(value||'').trim();if(!/^([01]\d|2[0-3])[0-5]\d[0-5]\d(?:\d{2})?$/.test(s))throw Error('FLOW_HISTORY_TIME');return s.slice(0,6);
}
export function verifiedFlowScale(header,reference){
 const raw=[number(header?.svolume_08),number(header?.svolume_17)],ref=[reference.individual,reference.foreign];
 // A zero/near-zero market cannot establish currency units unambiguously.
 if(ref.some(x=>!Number.isFinite(x))||Math.max(...ref.map(Math.abs))<100)throw Error('FLOW_HISTORY_UNIT_UNVERIFIED');
 const scales=[1,.01,.0001].filter(scale=>raw.every((v,i)=>Math.abs(v*scale-ref[i])<=Math.max(20,Math.abs(ref[i])*.02)));
 if(scales.length!==1)throw Error('FLOW_HISTORY_UNIT_UNVERIFIED');return scales[0];
}
export function historicalFlowPoints({date,observedAt,flows,indices,previous=[]}){
 const existing=new Set(previous.map(p=>p.time)),boards={};
 for(const b of ['KOSPI','KOSDAQ']){
  const {rows,scale,header}=flows[b],q=indices[b].quote,base=q.value-q.change;if(!(base>0))throw Error('FLOW_HISTORY_INDEX_BASE');
  const sorted=[...rows].sort((a,b)=>sourceTime(a.time).localeCompare(sourceTime(b.time)));
  const last=sorted.at(-1);if(!last)throw Error('FLOW_HISTORY_EMPTY');
  // Blank gubun3 requests cumulative values. Never accept incremental rows as cumulative.
  if(['08','17'].some(code=>Math.abs(number(last['sv_'+code])-number(header['svolume_'+code]))*scale>Math.max(30,Math.abs(number(header['svolume_'+code])*scale)*.03)))throw Error('FLOW_HISTORY_NOT_CUMULATIVE');
  const chart=new Map(indices[b].series.map(p=>[p.time,p.value])),map=new Map();
  for(const r of sorted){const time=sourceTime(r.time),minute=Number(time.slice(0,2))*60+Number(time.slice(2,4));
   if(time.slice(4)!=='00'||minute%5!==0||time<'090000'||time>'161000'||!chart.has(time))continue;
   const asOf=date+'T'+time.slice(0,2)+':'+time.slice(2,4)+':00+09:00';if(Date.parse(asOf)>Date.parse(observedAt))continue;
   const point={individual:number(r.sv_08)*scale,foreign:number(r.sv_17)*scale,changePct:(chart.get(time)/base-1)*100};
   if(!Object.values(point).every(Number.isFinite)||Math.abs(point.changePct)>100)throw Error('FLOW_HISTORY_RANGE');
   if(map.has(time))throw Error('FLOW_HISTORY_DUPLICATE');map.set(time,point);
  }boards[b]=map;
 }
 const added=[];for(const [time,kospi] of boards.KOSPI){const short=time.slice(0,4),kosdaq=boards.KOSDAQ.get(time);if(!kosdaq||existing.has(short))continue;
  added.push({time:short,asOf:date+'T'+time.slice(0,2)+':'+time.slice(2,4)+':00+09:00',markets:{KOSPI:kospi,KOSDAQ:kosdaq},source:'LS증권 KRX · t1602 누적 금액 + t8409 동일 시각 지수',recoveredAt:observedAt});
 }return [...previous,...added].sort((a,b)=>a.time.localeCompare(b.time));
}
export async function recoverIntradayFlows(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow())return;
 const date=kst().date,row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first();if(!row)return;
 const old=JSON.parse(row.payload);if(!old.flows||old.errors?.ls||old.errors?.flows)return;
 const statusId='intraday-recovery:'+date,statusRow=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(statusId).first(),status=statusRow?JSON.parse(statusRow.payload):{};
 if(status.checkedAt&&Date.now()-Date.parse(status.checkedAt)<600000)return;
 const leaseId='intraday-recovery-lease',now=Date.now(),lease=String(now+120000);
 await env.DB.prepare('INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)').bind(leaseId,'0').run();
 const lock=await env.DB.prepare('UPDATE state SET payload=? WHERE id=? AND CAST(payload AS INTEGER) < ? RETURNING id').bind(lease,leaseId,now).first();if(!lock)return;
 let session;const checkedAt=new Date().toISOString();let stage='AUTH';
 try{
  await put(env,statusId,{date,status:'RUNNING',checkedAt});
  session=await createSession();const fetcher=collectionFetch(session.fetch),token=await accessToken(env,fetcher,Date.now(),false),request=(c,b,cont)=>tr(token,c,b,cont,fetcher);
  const flows={},indices={};
  for(const [b,market,upcode] of [['KOSPI','1','001'],['KOSDAQ','3','301']]){
   stage='HISTORY_'+b;await pause();const reference=rawFlows((await request('t1601',{gubun1:'2',gubun2:'2',gubun3:'',gubun4:'2',exchgubun:'K'})).data);const rows=[];let cursor='',continuation,header,scale,complete=false;const seen=new Set();
   for(let page=0;page<20;page++){
    const r=await request('t1602',{market,upcode,gubun1:'2',gubun2:'0',cts_time:cursor||' ',cts_idx:0,cnt:100,gubun3:'',exchgubun:'K'},continuation);
    if(!Array.isArray(r.data.t1602OutBlock1))throw Error('FLOW_HISTORY_SHAPE');
    if(page===0){header=r.data.t1602OutBlock;scale=verifiedFlowScale(header,reference[b]);}
    rows.push(...r.data.t1602OutBlock1);const next=String(r.data.t1602OutBlock?.cts_time||'').trim();
    if(!next||!r.data.t1602OutBlock1.length||sourceTime(next)<='090000'){complete=true;break;}
    if(seen.has(next))throw Error('FLOW_HISTORY_CURSOR');seen.add(next);cursor=next;continuation=r.continuation;await pause();
   }
   if(!complete)throw Error('FLOW_HISTORY_INCOMPLETE');flows[b]={rows,header,scale};
   stage='INDEX_'+b;const quote=indexQuote((await request('t1511',{upcode})).data.t1511OutBlock);await pause();
   const chart=await request('t8409',{shcode:upcode,ncnt:5,qrycnt:100,nday:'1',sdate:date.replaceAll('-',''),stime:'',edate:date.replaceAll('-',''),etime:'161000',cts_date:'',cts_time:'',comp_yn:'N'});
   indices[b]={quote,series:indexSeries(chart.data.t8409OutBlock1,date)};
  }
  if(kst().date!==date||!collectWindow())throw Error('FLOW_HISTORY_DATE_CHANGED');
  const latestRow=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first(),latest=latestRow?JSON.parse(latestRow.payload):old;
  const history=historicalFlowPoints({date,observedAt:new Date().toISOString(),flows,indices,previous:latest.flowHistory||[]});
  const report={date,status:'COMPLETE',checkedAt,completedAt:new Date().toISOString(),added:history.length-(latest.flowHistory||[]).length,total:history.length,units:{KOSPI:flows.KOSPI.scale,KOSDAQ:flows.KOSDAQ.scale}};
  // Only update history: never replace a newer live quote or live investor totals.
  await env.DB.prepare(`UPDATE state SET payload=json_set(payload,'$.flowHistory',json((SELECT json_group_array(json(value)) FROM (
   SELECT value,json_extract(value,'$.time') AS slot FROM json_each(state.payload,'$.flowHistory')
   UNION ALL SELECT i.value AS value,json_extract(i.value,'$.time') AS slot FROM json_each(?) i WHERE NOT EXISTS(SELECT 1 FROM json_each(state.payload,'$.flowHistory') e WHERE json_extract(e.value,'$.time')=json_extract(i.value,'$.time'))
   ORDER BY slot))),'$.intradayRecovery',json(?)) WHERE id=?`).bind(JSON.stringify(history),JSON.stringify(report),'details:'+date).run();
  await put(env,statusId,report);
 }catch(e){const report={date,status:'FAILED',checkedAt,stage,code:String(e.code||e.message||'FLOW_HISTORY_FAILED').replace(/[^A-Z0-9_]/g,'').slice(0,80)};await put(env,statusId,report);await env.DB.prepare("UPDATE state SET payload=json_set(payload,'$.intradayRecovery',json(?)) WHERE id=?").bind(JSON.stringify(report),'details:'+date).run();}
 finally{if(session)await session.close();await env.DB.prepare("UPDATE state SET payload='0' WHERE id=? AND payload=?").bind(leaseId,lease).run();}
}
