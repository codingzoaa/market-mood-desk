import {createSession} from './tls.mjs';
import {accessToken,tr,number,kst} from './ls.mjs';
const key='breadth-close:progress',pause=()=>new Promise(r=>setTimeout(r,1150));
const put=(env,id,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
const get=async(env,id)=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(id).first();return r?JSON.parse(r.payload):null;};
export function breadthCloseWindow(now=new Date()){const d=kst(now);return !['Sat','Sun'].includes(d.weekday)&&d.time>='1640'&&d.time<='2355';}
export function breadthMaster(rows){if(!Array.isArray(rows))throw Error('BREADTH_MASTER_SHAPE');const seen=new Set();const symbols=[];for(const r of rows){const code=String(r.shcode||'');if(String(r.gubun)!=='1'||String(r.etfgubun)!=='0'||!/^\d{6}$/.test(code))continue;if(seen.has(code))throw Error('BREADTH_MASTER_DUPLICATE');seen.add(code);symbols.push(code);}if(symbols.length<700||symbols.length>1500)throw Error('BREADTH_MASTER_COVERAGE');return symbols.sort();}
export function breadthBars(rows,date){if(!Array.isArray(rows))throw Error('BREADTH_HISTORY_SHAPE');const seen=new Set();return rows.map(r=>{const d=String(r.date||'');if(!/^\d{8}$/.test(d)||d>date.replaceAll('-','')||!Number.isFinite(Date.parse(d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6)+'T00:00:00Z'))||new Date(d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6)+'T00:00:00Z').toISOString().slice(0,10).replaceAll('-','')!==d||seen.has(d))throw Error('BREADTH_HISTORY_DATE');seen.add(d);const close=number(r.close,0,1e9),volume=number(r.jdiff_vol,0,1e14);if(volume>0&&close<=0)throw Error('BREADTH_HISTORY_PRICE');return {date:d,close,volume};}).sort((a,b)=>a.date.localeCompare(b.date)).slice(-65);}
export function appendBreadthQuotes(previous,rows,symbols,date){if(!Array.isArray(rows)||rows.length!==symbols.length)throw Error('BREADTH_BULK_COVERAGE');const wanted=new Set(symbols),out=[];for(const r of rows){if(!wanted.delete(r.shcode))throw Error('BREADTH_BULK_SYMBOL');const close=number(r.price,0,1e9),volume=number(r.volume,0,1e14);if(close<=0&&volume>0)throw Error('BREADTH_BULK_PRICE');const map=new Map((previous[r.shcode]?.bars||[]).map(p=>[p.date,p]));map.set(date.replaceAll('-',''),{date:date.replaceAll('-',''),close,volume});out.push({symbol:r.shcode,market:'KOSPI',collectedFor:date,bars:[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-65)});}return out;}
export async function collectBreadthClose(env){
 if(!breadthCloseWindow()||!env.LS_APP_KEY||!env.LS_APP_SECRET)return 0;const date=kst().date;let p=await get(env,key);if(p?.date!==date)p=null;if(p?.date===date&&['COMPLETE','MARKET_CLOSED'].includes(p.status))return 0;
 const now=Date.now(),lease=String(now+150000);await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('breadth-close:lease','0')").run();const lock=await env.DB.prepare("UPDATE state SET payload=? WHERE id='breadth-close:lease' AND CAST(payload AS INTEGER)<? RETURNING id").bind(lease,now).first();if(!lock)return 20000;
 let session,stage='AUTH';try{
  session=await createSession();const token=await accessToken(env,session.fetch,Date.now(),false),request=async(code,input)=>{await pause();return tr(token,code,input,undefined,session.fetch);};
  if(p?.date!==date||!Array.isArray(p?.symbols)||!Array.isArray(p?.indices)){
   stage='TRADING_DATE';const sample=await request('t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'});
   if(sample.data.t8410OutBlock1?.map(r=>r.date).sort().at(-1)!==date.replaceAll('-','')){await put(env,key,{date,status:'MARKET_CLOSED',checkedAt:new Date().toISOString()});return 0;}
   stage='INDEX';const index=await request('t8429',{shcode:'001',gubun:'2',qrycnt:90,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N'});const indices=(index.data.t8429OutBlock1||[]).map(r=>({date:String(r.date),close:number(r.close,1,1e7)})).sort((a,b)=>a.date.localeCompare(b.date));if(indices.at(-1)?.date!==date.replaceAll('-',''))throw Error('BREADTH_INDEX_DATE');
   stage='MASTER';const master=await request('t8436',{gubun:'1'}),symbols=breadthMaster(master.data.t8436OutBlock),last=await get(env,'breadth-close:last');
   p={date,status:'RUNNING',mode:last?.date?.replaceAll('-','')===indices.at(-2)?.date?'bulk':'seed',symbols,next:0,total:symbols.length,indices,startedAt:new Date().toISOString(),checkedAt:new Date().toISOString(),method:'LS_KRX_DAILY_RAW_CLOSE_V1'};await put(env,key,p);
  }
  p.status='RUNNING';delete p.code;stage=p.mode==='seed'?'SEED_HISTORY':'BULK_CLOSE';
  if(p.mode==='seed'){
   for(let j=0;j<45&&p.next<p.total;j++){
    const symbol=p.symbols[p.next],old=await get(env,'breadth-prices:'+symbol);
    if(old?.collectedFor!==date){const result=await request('t8410',{shcode:symbol,gubun:'2',qrycnt:65,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'});const bars=breadthBars(result.data.t8410OutBlock1||[],date);await put(env,'breadth-prices:'+symbol,{symbol,market:'KOSPI',collectedFor:date,bars});}
    p.next++;if(p.next%5===0)await put(env,key,{...p,checkedAt:new Date().toISOString()});
   }
  }else{
   for(let j=0;j<5&&p.next<p.total;j++){
    const symbols=p.symbols.slice(p.next,p.next+50),previous={};for(const symbol of symbols)previous[symbol]=await get(env,'breadth-prices:'+symbol);
    const result=await request('t8407',{nrec:symbols.length,shcode:symbols.join('')});for(const item of appendBreadthQuotes(previous,result.data.t8407OutBlock1,symbols,date))await put(env,'breadth-prices:'+item.symbol,item);p.next+=symbols.length;await put(env,key,{...p,checkedAt:new Date().toISOString()});
   }
  }
  if(kst().date!==date)throw Error('BREADTH_DAY_CHANGED');p.checkedAt=new Date().toISOString();
  if(p.next===p.total){p.status='COMPLETE';p.completedAt=p.checkedAt;await put(env,'breadth-close:last',p);}
  await put(env,key,p);return p.status==='COMPLETE'?0:1000;
 }catch(e){await put(env,key,{...p,date,status:'FAILED',stage,checkedAt:new Date().toISOString(),code:String(e.code||e.message).replace(/[^A-Z0-9_]/g,'').slice(0,80)});return 60000;}
 finally{if(session)await session.close();await env.DB.prepare("UPDATE state SET payload='0' WHERE id='breadth-close:lease' AND payload=?").bind(lease).run();}
}
export async function breadthCloseFeed(env){
 const p=await get(env,key),last=await get(env,'breadth-close:last');const progress=p?{date:p.date,status:p.status,mode:p.mode,received:p.next||0,total:p.total||0,checkedAt:p.checkedAt,stage:p.stage,code:p.code}:{status:'PENDING'};
 if(!last)return {progress,record:null};const rows=await env.DB.prepare("SELECT payload FROM state WHERE id LIKE 'breadth-prices:%' ORDER BY id").all(),allowed=new Set(last.symbols),records=rows.results.flatMap(r=>{try{const x=JSON.parse(r.payload);return allowed.has(x.symbol)&&x.collectedFor===last.date?[x]:[];}catch{return [];}});
 if(records.length!==last.total)return {progress,record:null};return {progress,record:{date:last.date,status:'COMPLETE',method:last.method,mode:last.mode,unit:'KRW',source:'LS증권 KRX · t8436 시장 전체 · t8410 무수정 일봉 / t8407 마감 시세 · t8429 코스피',observedAt:last.completedAt,expected:last.total,indices:last.indices,stocks:records}};
}
