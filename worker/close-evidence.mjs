import {CLOSE_TARGETS} from '../shared/close-targets.mjs';
import {captureQuote,captureFlow,verifiedEvidence} from '../shared/close-evidence.mjs';
import {accessToken,tr,kst,collectWindow,collectionFetch} from './ls.mjs';
import {createSession} from './tls.mjs';
const key=date=>'close-evidence:'+date;
const read=async(env,date)=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key(date)).first();return r?JSON.parse(r.payload):{date,stocks:{},errors:{}};};
export async function closeEvidencePayload(env,date){const saved=await read(env,date);return {version:1,date,stocks:Object.values(saved.stocks||{}).map(s=>verifiedEvidence(s,date)?s:null).filter(Boolean),errors:saved.errors||{}};}
const pause=()=>new Promise(r=>setTimeout(r,1100));
export async function collectCloseEvidence(env){
 const current=kst();if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow()||current.time<'1530')return false;
 const date=current.date,started=Date.now(),lease='close-evidence-lease';
 await env.DB.prepare('INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)').bind(lease,'0').run();
 const lock=await env.DB.prepare('UPDATE state SET payload=? WHERE id=? AND CAST(payload AS INTEGER) < ? RETURNING id').bind(String(started+180000),lease,started).first();if(!lock)return false;
 let saved,session;
 try{
  saved=await read(env,date);saved.stocks||={};saved.errors||={};saved.attempts||={};
  const latest=await env.DB.prepare('SELECT date FROM snapshots ORDER BY date DESC LIMIT 1').first();if(latest?.date!==date){saved=undefined;return false;}
  // Keep first three-TR capture batches small. Completed fields are not recollected.
  const targets=CLOSE_TARGETS.filter(t=>(!saved.stocks[t.symbol]&&current.time<'1540'||saved.stocks[t.symbol]&&!saved.stocks[t.symbol].flow)&&(saved.attempts[t.symbol]||0)<4).slice(0,2);
  if(!targets.length)return false;
  session=await createSession();const fetcher=collectionFetch(session.fetch),token=await accessToken(env,fetcher,Date.now(),false);
  const request=async(code,body)=>{await pause();return tr(token,code,body,undefined,fetcher);};
  for(const target of targets){
   if(!collectWindow()||kst().date!==date)break;saved.attempts[target.symbol]=(saved.attempts[target.symbol]||0)+1;
   try{
    if(!saved.stocks[target.symbol]){
     if(kst().time>='1540')continue;
     const daily=(await request('t8410',{shcode:target.symbol,gubun:'2',qrycnt:20,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'})).data;
     const quote=(await request('t1102',{shcode:target.symbol,exchgubun:'K'})).data;
     saved.stocks[target.symbol]=captureQuote(quote.t1102OutBlock,daily.t8410OutBlock1,target,date,new Date().toISOString());
    }
    const q=saved.stocks[target.symbol];
    const response=(await request('t1702',{shcode:target.symbol,fromdt:date.replaceAll('-',''),todt:date.replaceAll('-',''),volvalgb:'0',msmdgb:'0',gubun:'0',exchgubun:'K'})).data;
    q.flow=captureFlow(response.t1702OutBlock1,q,date,new Date().toISOString());delete saved.errors[target.symbol];
   }catch(e){saved.errors[target.symbol]=typeof e.message==='string'&&/^CLOSE_[A-Z_]+$/.test(e.message)?e.message:'CLOSE_COLLECTION_PENDING';}
  }
 }catch{if(saved)saved.error='CLOSE_COLLECTION_PENDING';}
 finally{
  if(session)await session.close();
  if(saved&&kst().date===date&&collectWindow())await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key(date),JSON.stringify(saved)).run();
  await env.DB.prepare("UPDATE state SET payload='0' WHERE id=? AND payload=?").bind(lease,String(started+180000)).run();
 }
 return !!saved&&CLOSE_TARGETS.some(t=>(!saved.stocks[t.symbol]&&kst().time<'1540'||saved.stocks[t.symbol]&&!saved.stocks[t.symbol].flow)&&(saved.attempts[t.symbol]||0)<4);
}
export async function safeCollectCloseEvidence(env){try{return await collectCloseEvidence(env);}catch{return false;}}
