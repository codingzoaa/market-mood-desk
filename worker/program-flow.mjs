import {accessToken,tr,kst,number,collectionFetch} from './ls.mjs';
import {createSession} from './tls.mjs';
const pause=()=>new Promise(r=>setTimeout(r,1100));
export function programWindow(now=new Date()){const d=kst(now);return !['Sat','Sun'].includes(d.weekday)&&d.time>='0900'&&d.time<='1615';}
// t1662 amount mode is million KRW; preserve cumulative observations, convert to 억원.
export function normalizeProgram(rows,indexRows,previousClose){
 if(!Array.isArray(rows)||!Array.isArray(indexRows)||!Number.isFinite(previousClose)||previousClose<=0)throw Error('PROGRAM_SHAPE');
 const prices=new Map(indexRows.map(r=>[r.time,number(r.close,0,1e7)])),seen=new Set(),points=[];
 for(const r of rows){const t=String(r.time);if(!/^\d{6}$/.test(t)||t<'090000'||t>'161500'||t.slice(4)!=='00'||Number(t.slice(2,4))%5!==0)continue;
 const net=number(r.bcha3),buy=number(r.bcha1,0),sell=number(r.bcha2,0);if(Math.abs(buy-sell-net)>2)throw Error('PROGRAM_AMOUNT_IDENTITY');
 if(seen.has(t))throw Error('PROGRAM_DUPLICATE_TIME');seen.add(t);const price=prices.get(t);
 points.push({time:t.slice(0,4),netBuy:net/100,changePct:price===undefined?null:(price/previousClose-1)*100});
 }return points.sort((a,b)=>a.time.localeCompare(b.time)).slice(-100);
}
export async function collectProgramFlow(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!programWindow())return;
 const day=kst(),id='program-flow:'+day.date,bucket=day.time.slice(0,2)+String(Math.floor(Number(day.time.slice(2))/5)*5).padStart(2,'0');
 const saved=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();let old;try{old=JSON.parse(saved?.payload||'null');}catch{}
 if(old?.bucket===bucket&&!Object.keys(old.errors||{}).length&&old?.markets?.KOSPI?.length&&old?.markets?.KOSDAQ?.length)return;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('program-lease','0')").run();const now=Date.now(),lease=String(now+90000);
 if(!await env.DB.prepare("UPDATE state SET payload=? WHERE id='program-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(lease,now).first())return;
 let session;const status={date:day.date,asOf:new Date().toISOString(),bucket,unit:'억원',source:'LS증권 KRX · t1662 비차익 누적 금액 / t8409 지수',markets:{...old?.markets},errors:{}};
 try{
  session=await createSession();const fetcher=collectionFetch(session.fetch,()=>new Date(),'1615'),token=await accessToken(env,fetcher,Date.now(),false),request=(c,b)=>tr(token,c,b,undefined,fetcher);
  const daily=(await request('t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:day.date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'})).data;
  if(daily.t8410OutBlock1?.map(r=>r.date).sort().at(-1)!==day.date.replaceAll('-',''))throw Error('TRADE_DATE');
  const details=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+day.date).first(),d=JSON.parse(details?.payload||'{}');
  for(const [market,gubun,upcode] of [['KOSPI','0','001'],['KOSDAQ','1','301']]){
   try{
    await pause();const flow=(await request('t1662',{gubun,gubun1:'0',gubun3:'0',exchgubun:'K'})).data;
    await pause();const index=(await request('t8409',{shcode:upcode,ncnt:5,qrycnt:100,nday:'1',sdate:day.date.replaceAll('-',''),stime:'',edate:day.date.replaceAll('-',''),etime:'161500',cts_date:'',cts_time:'',comp_yn:'N'})).data;
    const q=d.indices?.[market],previous=q?.value-q?.change;
    const points=normalizeProgram(flow.t1662OutBlock,(index.t8409OutBlock1||[]).filter(r=>r.date===day.date.replaceAll('-','')),previous);
    if(!points.length)throw Error('PROGRAM_NO_POINTS');status.markets[market]=points;
   }catch(e){status.errors[market]=e.code||String(e.message).slice(0,60);}
  }
 }catch(e){status.errors.ls=e.code||String(e.message).slice(0,60);}
 finally{if(session)await session.close();}
 try{if(!programWindow()||kst().date!==day.date)return;await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(status)).run();}
 finally{await env.DB.prepare("UPDATE state SET payload='0' WHERE id='program-lease' AND payload=?").bind(lease).run();}
}
