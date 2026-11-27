import {accessToken,tr,kst,collectionFetch} from './ls.mjs';
import {createCoordinatedSession} from './ls-session.mjs';
import {marketSession} from '../shared/market-session.mjs';
import {sectorCandidate} from './stock-verification.mjs';

export const FRAMES=['5','60','240','D'];
const KEY='vwma-scanner:v2', LENGTH=100, LIMIT=20, BATCH=5;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const read=async(env,key)=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key).first();return r?JSON.parse(r.payload):null;};
const save=(env,key,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key,JSON.stringify(value)).run();
export function scannerCandidates(snap){
 const etfs=new Set((snap?.etfs||[]).map(s=>s.symbol));
 return (snap?.stocks||[]).filter(s=>sectorCandidate(s)&&!etfs.has(s.symbol)&&Number.isFinite(s.turnoverKRW)).sort((a,b)=>b.turnoverKRW-a.turnoverKRW||a.symbol.localeCompare(b.symbol)).slice(0,LIMIT);
}
export function normalizeBars(rows,frame,now){
 if(!Array.isArray(rows))throw Error('CHART_SHAPE');
 const k=kst(now), today=k.date.replaceAll('-',''), by=new Map();
 for(const r of rows){
  const d=String(r.date), t=frame==='D'?'153000':String(r.time);
  if(!/^\d{8}$/.test(d)||!/^\d{6}$/.test(t)||d>today||Number(t.slice(0,2))>23||Number(t.slice(2,4))>59||Number(t.slice(4))>59)throw Error('CHART_TIMESTAMP');
  const iso=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8);
  if(frame==='D'&&d===today)continue; // use prior daily close throughout the session
  const clock=frame==='D'?marketSession(iso).close+'00':t;
  if(frame!=='D'&&(clock.slice(0,4)<marketSession(iso).open||clock.slice(0,4)>marketSession(iso).close))continue;
  const at=Date.parse(iso+'T'+clock.slice(0,2)+':'+clock.slice(2,4)+':'+clock.slice(4,6)+'+09:00');
  if(!Number.isFinite(at)||at>now.getTime())continue;
  const p=Number(r.close),v=Number(r.jdiff_vol);
  if(r.close==null||r.jdiff_vol==null||String(r.close).trim()===''||String(r.jdiff_vol).trim()===''||!Number.isFinite(p)||p<=0||!Number.isFinite(v)||v<0)throw Error('CHART_VALUES');
  if(by.has(at))throw Error('CHART_DUPLICATE');
  by.set(at,{at,p,v,day:d});
 }
 const sorted=[...by.values()].sort((a,b)=>a.at-b.at);
 // LS minute timestamp convention and partial-bar status must be live-verified.
 // Conservatively discard the newest same-day intraday bar.
 if(frame!=='D'&&sorted.at(-1)?.day===today)sorted.pop();
 return sorted;
}
export function summarize(bars,length=LENGTH){
 if(bars.length<length+1)return null;
 const gaps=[];
 for(let i=length-1;i<bars.length;i++){
  let pv=0,v=0;
  for(const b of bars.slice(i-length+1,i+1)){pv+=b.p*b.v;v+=b.v;}
  const vw=v>0?pv/v:null;
  gaps.push({at:bars[i].at,vw,gap:vw>0?(bars[i].p/vw-1)*100:null});
 }
 const last=gaps.at(-1),prev=gaps.at(-2);
 if(last.gap===null||prev.gap===null)return null;
 let crossAt=null;
 if(last.gap>=0)for(let i=gaps.length-1;i>0;i--){
  if(gaps[i].gap===null||gaps[i-1].gap===null)break;
  if(gaps[i].gap>=0&&gaps[i-1].gap<0){crossAt=new Date(gaps[i].at).toISOString();break;}
 }
 return {gap:last.gap,vwma:last.vw,state:last.gap>=0?(last.gap>prev.gap?3:2):(last.gap>prev.gap?1:0),barAt:new Date(last.at).toISOString(),crossAt};
}
export function classify(frames){
 if(FRAMES.some(f=>!frames[f]))return '데이터 부족';
 const key=FRAMES.map(f=>frames[f].gap>=0?'1':'0').join('');
 return ({'1000':'초기 반등','1100':'단기 전환','1110':'중기 전환','1111':'상승 정렬','1011':'눌림목 회복','0111':'눌림목 관찰','0000':'하락 정렬'})[key]||'혼합';
}
export async function readVwmaScanner(env){
 const data=await read(env,KEY);
 return data||{date:null,asOf:null,frames:FRAMES,rows:[],status:'not_ready',source:'LS증권 KRX · VWMA 100'};
}
export async function collectVwmaScanner(env,{now=new Date(),clock=()=>new Date(),open=createCoordinatedSession,delay=wait}={}){
 const k=kst(now),market=marketSession(k.date);
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||['Sat','Sun'].includes(k.weekday)||k.time<market.open||k.time>=market.close)return;
 const slot=Math.floor(now.getTime()/300000);
 let old=await readVwmaScanner(env);
 if(old.slot===slot)return;
 const record=await env.DB.prepare('SELECT payload FROM snapshots WHERE date=?').bind(k.date).first();
 if(!record)return;const snap=JSON.parse(record.payload);
 if(!String(snap.source).startsWith('LS증권 KRX'))return;
 const candidates=scannerCandidates(snap);
 if(!candidates.length)return;
 let session;
 try{
  session=await open(env,{attempts:1});
  const fetcher=collectionFetch(session.fetch,clock);
  const token=await accessToken(env,fetcher,now.getTime(),false);
  const rows=new Map((old.date===k.date?old.rows:[]).map(r=>[r.symbol,r]));
  const selected=[...candidates].sort((a,b)=>(Date.parse(rows.get(a.symbol)?.checkedAt||'')||0)-(Date.parse(rows.get(b.symbol)?.checkedAt||'')||0)).slice(0,BATCH);
  const publish=async()=>save(env,KEY,{date:k.date,asOf:clock().toISOString(),slot,frames:FRAMES,status:'pilot',source:'LS증권 KRX · VWMA 100 · 직전 확정 추정봉',candidateCount:candidates.length,rows:candidates.map(s=>({...rows.get(s.symbol),symbol:s.symbol,name:s.name,market:s.market,turnoverKRW:s.turnoverKRW,changePct:s.changePct,sector:s.themes?.[0]||'',frames:rows.get(s.symbol)?.frames||{},pattern:rows.get(s.symbol)?.pattern||'조회 대기'}))});
  await publish();
  for(const s of selected){
   if(clock().getTime()-now.getTime()>30000||Math.floor(clock().getTime()/300000)!==slot||kst(clock()).time>=market.close)break;
   const frames={},errors={};
   for(const f of FRAMES){
    if(kst(clock()).time>=market.close||Math.floor(clock().getTime()/300000)!==slot||clock().getTime()-now.getTime()>45000)break;
    try{
     await delay(1100);
     const code=f==='D'?'t8410':'t8412';
     const body=f==='D'?{shcode:s.symbol,gubun:'2',qrycnt:120,sdate:'',edate:k.date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'}:{shcode:s.symbol,ncnt:Number(f),qrycnt:120,nday:'0',sdate:'',edate:k.date.replaceAll('-',''),cts_date:'',cts_time:'',comp_yn:'N'};
     const response=await tr(token,code,body,undefined,fetcher);
     frames[f]=summarize(normalizeBars(response.data[code+'OutBlock1'],f,clock()));
     if(!frames[f])errors[f]='INSUFFICIENT_BARS';
    }catch(e){frames[f]=null;errors[f]=/^[A-Z_0-9]+$/.test(e?.code||'')?e.code:'CHART_UNAVAILABLE';}
   }
   rows.set(s.symbol,{frames,errors,checkedAt:clock().toISOString(),pattern:classify(frames)});
   await publish();
  }
 }finally{if(session)await session.close();}
}
