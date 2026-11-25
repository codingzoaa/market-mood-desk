import {marketSession,sessionRecoveryAllowed,minutes,timeOf} from '../shared/market-session.mjs';
import {accessToken,tr,kst,number,collectionFetch} from './ls.mjs';
import {createCoordinatedSession as createSession} from './ls-session.mjs';
const pause=()=>new Promise(r=>setTimeout(r,1100));
export function programWindow(now=new Date()){const d=kst(now);return !['Sat','Sun'].includes(d.weekday)&&d.time>=marketSession(d.date).open&&d.time<=marketSession(d.date).flowEnd;}
// Use a backward-only as-of join. No future sample or interpolation is allowed.
// A source observation must be less than one five-minute frame old.
export const PROGRAM_ALIGNMENT_VERSION=2;
export const PROGRAM_MAX_AGE_SECONDS=300;
const seconds=t=>Number(t.slice(0,2))*3600+Number(t.slice(2,4))*60+Number(t.slice(4));
const validTime=t=>typeof t==='string'&&/^([01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(t);
const clock=s=>String(Math.floor(s/3600)).padStart(2,'0')+String(Math.floor(s%3600/60)).padStart(2,'0');
export function normalizeProgram(rows,indexRows,previousClose,{endTime,date}={}){
 if(!Array.isArray(rows)||!Array.isArray(indexRows)||!Number.isFinite(previousClose)||previousClose<=0)throw Error('PROGRAM_SHAPE');
 const seen=new Set(),samples=[];
 for(const r of rows){const t=String(r.time);if(!validTime(t)||t<marketSession(date).open+'00'||t>marketSession(date).flowEnd+'59')continue;
  const net=number(r.bcha3),buy=number(r.bcha1,0),sell=number(r.bcha2,0);if(Math.abs(buy-sell-net)>2)throw Error('PROGRAM_AMOUNT_IDENTITY');
  if(seen.has(t))throw Error('PROGRAM_DUPLICATE_TIME');seen.add(t);samples.push({sourceTime:t,at:seconds(t),netBuy:net/100});
 }
 samples.sort((a,b)=>a.at-b.at);
 const prices=indexRows.filter(r=>validTime(r.time)&&r.time>=marketSession(date).open+'00'&&r.time<=marketSession(date).flowEnd+'59').map(r=>({sourceTime:r.time,at:seconds(r.time),close:number(r.close,0,1e7)})).sort((a,b)=>a.at-b.at);
 if(!samples.length)return [];
 if(endTime!==undefined&&(!/^\d{4}$/.test(endTime)||Number(endTime.slice(2))%5!==0||endTime<marketSession(date).open||endTime>marketSession(date).flowEnd))throw Error('PROGRAM_END_TIME');
 const end=Math.min(minutes(marketSession(date).flowEnd)*60,endTime?seconds(endTime+'00'):Math.floor(samples.at(-1).at/300)*300),points=[];
 let fi=-1,pi=-1;
 for(let at=minutes(marketSession(date).open)*60;at<=end;at+=300){
  while(fi+1<samples.length&&samples[fi+1].at<=at)fi++;
  while(pi+1<prices.length&&prices[pi+1].at<=at)pi++;
  const flow=samples[fi],price=prices[pi];
  if(!flow||at-flow.at>=PROGRAM_MAX_AGE_SECONDS)continue;
  const matched=price&&at-price.at<PROGRAM_MAX_AGE_SECONDS;
  points.push({time:clock(at),netBuy:flow.netBuy,changePct:matched?(price.close/previousClose-1)*100:null,sourceTime:flow.sourceTime,sourceAgeSeconds:at-flow.at,indexSourceTime:matched?price.sourceTime:null});
 }
 return points;
}
export async function collectProgramFlow(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!programWindow()&&!sessionRecoveryAllowed(env))return;
 const day=kst(),id='program-flow:'+day.date,bucket=day.time>marketSession(day.date).flowEnd?marketSession(day.date).flowEnd:day.time.slice(0,2)+String(Math.floor(Number(day.time.slice(2))/5)*5).padStart(2,'0');
 const saved=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();let old;try{old=JSON.parse(saved?.payload||'null');}catch{}
 if(old?.alignmentVersion===PROGRAM_ALIGNMENT_VERSION&&old?.bucket===bucket&&!Object.keys(old.errors||{}).length&&old?.markets?.KOSPI?.length&&old?.markets?.KOSDAQ?.length)return;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('program-lease','0')").run();const now=Date.now(),lease=String(now+90000);
 if(!await env.DB.prepare("UPDATE state SET payload=? WHERE id='program-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(lease,now).first())return;
 let session;const status={date:day.date,asOf:new Date().toISOString(),bucket,alignmentVersion:PROGRAM_ALIGNMENT_VERSION,maxAgeSeconds:PROGRAM_MAX_AGE_SECONDS,unit:'억원',source:'LS증권 KRX · t1662 비차익 누적 금액 / t8409 지수',markets:{...old?.markets},errors:{}};
 try{
  session=await createSession(env);const fetcher=sessionRecoveryAllowed(env)?session.fetch:collectionFetch(session.fetch,()=>new Date(),'1615'),token=await accessToken(env,fetcher,Date.now(),false),request=(c,b)=>tr(token,c,b,undefined,fetcher);
  const daily=(await request('t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:day.date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'})).data;
  if(daily.t8410OutBlock1?.map(r=>r.date).sort().at(-1)!==day.date.replaceAll('-',''))throw Error('TRADE_DATE');
  const details=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+day.date).first(),d=JSON.parse(details?.payload||'{}');
  for(const [market,gubun,upcode] of [['KOSPI','0','001'],['KOSDAQ','1','301']]){
   try{
    await pause();const flow=(await request('t1662',{gubun,gubun1:'0',gubun3:'0',exchgubun:'K'})).data;
    await pause();const index=(await request('t8409',{shcode:upcode,ncnt:5,qrycnt:100,nday:'1',sdate:day.date.replaceAll('-',''),stime:'',edate:day.date.replaceAll('-',''),etime:marketSession(day.date).flowEnd+'00',cts_date:'',cts_time:'',comp_yn:'N'})).data;
    const q=d.indices?.[market],previous=q?.value-q?.change;
    const points=normalizeProgram(flow.t1662OutBlock,(index.t8409OutBlock1||[]).filter(r=>r.date===day.date.replaceAll('-','')),previous,{endTime:bucket,date:day.date});
    if(!points.length)throw Error('PROGRAM_NO_POINTS');status.markets[market]=[...new Map([...(old?.markets?.[market]||[]).filter(p=>p.time>=marketSession(day.date).open&&p.time<=marketSession(day.date).flowEnd),...points].map(p=>[p.time,p])).values()].sort((a,b)=>a.time.localeCompare(b.time));
   }catch(e){status.errors[market]=e.code||String(e.message).slice(0,60);}
  }
 }catch(e){if(e?.code==='LS_SESSION_BUSY')return;status.errors.ls=e.code||String(e.message).slice(0,60);}
 finally{if(session)await session.close();}
 try{if((!programWindow()&&!sessionRecoveryAllowed(env))||kst().date!==day.date)return;await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(status)).run();}
 finally{await env.DB.prepare("UPDATE state SET payload='0' WHERE id='program-lease' AND payload=?").bind(lease).run();}
}

