import {normalizeFuturesOi} from './futures-oi.mjs';
import {archivePutClose} from './put-daily.mjs';
import {appendFlowHistory} from './flow-history.mjs';
import {lsIndexOHLC} from './index-ohlc.mjs';
import {createSession} from './tls.mjs';
import {accessToken,tr,number,signed,kst,collectWindow,collectionFetch,LSFailure} from './ls.mjs';
const pause=()=>new Promise(r=>setTimeout(r,1100));
const put=(env,id,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
export function indexQuote(row){
 if(!row)throw new Error('INDEX_SHAPE');
 const ohlc=lsIndexOHLC(row);
 return {...(ohlc?{ohlc}:{}),value:number(row.pricejisu,0,1e7),changePct:signed(row.diffjisu,row.sign),change:signed(row.change,row.sign),advances:number(row.highjo,0,10000),unchanged:number(row.unchgjo,0,10000),declines:number(row.lowjo,0,10000)};
}
export function indexSeries(rows,date){
 if(!Array.isArray(rows))throw new Error('CHART_SHAPE');
 const points=rows.filter(r=>r.date===date.replaceAll('-','')).map(r=>{if(!/^\d{6}$/.test(r.time))throw new Error('CHART_TIME');return {time:r.time,value:number(r.close,0,1e7)};}).filter(p=>p.time<='161000').sort((a,b)=>a.time.localeCompare(b.time));
 if(!points.length)throw new Error('CHART_DATE');return points;
}
export function rawFlows(data){
 return Object.fromEntries(['KOSPI','KOSDAQ','FUTURES','CALL','PUT'].map((key,i)=>{
  const row=data['t1601OutBlock'+(i+1)];if(!row)throw new Error('FLOW_SHAPE');
  const flows=Object.fromEntries([['foreign','17'],['institution','18'],['individual','08'],['financial','01']].map(([name,code])=>[name,number(row['svolume_'+code],-1e13,1e13)]));
  // Keep all existing investor flows if LS omits the optional KOSPI pension field.
  // Missing pension always fails closed for the pension-specific signal.
  if(key==='KOSPI'&&row.svolume_06!==undefined&&row.svolume_06!==null)
   flows.pension=number(row.svolume_06,-1e13,1e13);
  return [key,flows];
 }));
}
const numeric=v=>{if(!['string','number'].includes(typeof v))throw new Error('NAVER_NUMBER');if(typeof v==='string')v=v.replaceAll(',','').trim();if(v===''||v===null||v===undefined||!Number.isFinite(Number(v)))throw new Error('NAVER_NUMBER');return Number(v);};
// Core quote/flow sampling is always first; enrichment has its own lease.
export function flowBucket(now=new Date()){
 const k=kst(now);if(!collectWindow(now))return null;
 const minute=Math.floor(Number(k.time.slice(2))/5)*5;
 return {date:k.date,time:k.time.slice(0,2)+String(minute).padStart(2,'0')};
}
export function flowBucketNeeded(old,bucket){return !!bucket&&!(old.flowHistory||[]).some(p=>p.time===bucket.time);}
export async function collectDetails(env){
 const bucket=flowBucket();if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!bucket)return;
 const date=bucket.date,now=Date.now(),oldRow=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first();
 const old=oldRow?JSON.parse(oldRow.payload):{};
 if(!flowBucketNeeded(old,bucket))return;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('details-lease','0')").run();
 const lease=String(now+120000),lock=await env.DB.prepare("UPDATE state SET payload=? WHERE id='details-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(lease,now).first();if(!lock)return;
 let session;
 const details={date,collectorRevision:'clock-aligned-flow-v1',asOf:new Date(now).toISOString(),checkedAt:new Date(now).toISOString(),indices:{...(old.indices||{})},...(old.flows?{flows:old.flows}:{}),...(old.oi?{oi:old.oi}:{}),errors:{}};
 try{
  session=await createSession();const fetcher=collectionFetch(session.fetch),token=await accessToken(env,fetcher,Date.now(),false),request=(code,body)=>tr(token,code,body,undefined,fetcher);
  const daily=(await request('t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'})).data;
  if(daily.t8410OutBlock1?.map(r=>r.date).sort().at(-1)!==date.replaceAll('-',''))throw new Error('TRADE_DATE');
  for(const [code,market] of [['001','KOSPI'],['301','KOSDAQ']]){
   try{const quote=indexQuote((await request('t1511',{upcode:code})).data.t1511OutBlock);details.indices[market]={...quote,series:old.indices?.[market]?.series||[],asOf:details.asOf};}catch(e){details.errors[market]=e instanceof LSFailure?e.code:String(e.message).slice(0,80);}
   await pause();
  }
  try{details.flows={asOf:details.asOf,unit:'억원',source:'LS증권 KRX · t1601 금액 순매수',segments:rawFlows((await request('t1601',{gubun1:'2',gubun2:'2',gubun3:'',gubun4:'2',exchgubun:'K'})).data)};}catch(e){details.errors.flows=e instanceof LSFailure?e.code:String(e.message).slice(0,80);}
  // Optional OI: disabled unless the actual 8-character near-month KOSPI200 contract is configured.
  // Never reuse an old-contract observation when the futures contract rolls.
  if(typeof env.LS_KOSPI200_FUTURES_CODE==='string' && /^[0-9A-Z]{8}$/.test(env.LS_KOSPI200_FUTURES_CODE)){
   try{
    await pause();
    const result=await request('t2424',{focode:env.LS_KOSPI200_FUTURES_CODE,bdgubun:'2',nmin:0,tcgubun:'0',cnt:12});
    details.oi={futures:normalizeFuturesOi(result.data,date,env.LS_KOSPI200_FUTURES_CODE,details.asOf)};
   }catch(e){details.errors.oi=e instanceof LSFailure?e.code:String(e.message).slice(0,80);delete details.oi;}
  }

 }catch(e){details.errors.ls=e instanceof LSFailure?e.code:String(e.message).slice(0,80);}
 finally{if(session)await session.close();}
 try{
  if(!collectWindow())return;
  // Do not label a request that overran into the next bucket as the old slot.
  const current=flowBucket();if(current?.date!==bucket.date||current.time!==bucket.time)return;
  const latestRow=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first(),latest=latestRow?JSON.parse(latestRow.payload):old;
  const merged={...latest,...details,errors:{...latest.errors,...details.errors}};
  for(const key of ['KOSPI','KOSDAQ','flows','ls'])if(!details.errors[key])delete merged.errors[key];
  merged.flowHistory=appendFlowHistory(latest.flowHistory,details);
  const incoming=appendFlowHistory([],details),patch={...details,indices:{...details.indices},errors:{...details.errors}};
  for(const key of ['KOSPI','KOSDAQ','flows','ls'])if(!details.errors[key])patch.errors[key]=null;
  for(const market of ['KOSPI','KOSDAQ'])if(patch.indices[market]){patch.indices[market]={...patch.indices[market]};delete patch.indices[market].series;}
  // Atomic history merge prevents a concurrent backfill from being overwritten.
  const points=JSON.stringify(incoming);
  await env.DB.prepare(`INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=json_set(
   json_patch(state.payload,json(?)),
   '$.flowHistory',json((SELECT json_group_array(json(value)) FROM (
    SELECT e.value AS value,json_extract(e.value,'$.time') AS slot FROM json_each(state.payload,'$.flowHistory') e WHERE NOT EXISTS(SELECT 1 FROM json_each(?) i WHERE json_extract(i.value,'$.time')=json_extract(e.value,'$.time'))
    UNION ALL SELECT value,json_extract(value,'$.time') AS slot FROM json_each(?) ORDER BY slot))),
   '$.indices.KOSPI.series',json(COALESCE(json_extract(state.payload,'$.indices.KOSPI.series'),'[]')),
   '$.indices.KOSDAQ.series',json(COALESCE(json_extract(state.payload,'$.indices.KOSDAQ.series'),'[]')))
  `).bind('details:'+date,JSON.stringify(merged),JSON.stringify(patch),points,points).run();
  try{await archivePutClose(env,merged);}catch{/* Existing live closing observations remain available for retry. */}
  await put(env,'flow-attempt:'+date+':'+bucket.time,{date,time:bucket.time,requestedAt:details.asOf,completedAt:new Date().toISOString(),status:merged.flowHistory.some(p=>p.time===bucket.time)?'COMPLETE':'FAILED',errors:details.errors});
 }finally{await env.DB.prepare("UPDATE state SET payload='0' WHERE id='details-lease' AND payload=?").bind(lease).run();}
}

export async function enrichDetails(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow())return;
 const date=kst().date,now=Date.now(),row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first();if(!row)return;
 const old=JSON.parse(row.payload);
 if(old.enrichedBucket===flowBucket()?.time)return;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('details-enrichment-lease','0')").run();
 const lease=String(now+120000),lock=await env.DB.prepare("UPDATE state SET payload=? WHERE id='details-enrichment-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(lease,now).first();if(!lock)return;
 let session;const patch={},errors={};
 try{
  session=await createSession();const fetcher=collectionFetch(session.fetch),token=await accessToken(env,fetcher,Date.now(),false);
  for(const [code,market] of [['001','KOSPI'],['301','KOSDAQ']]){
   try{const r=await tr(token,'t8409',{shcode:code,ncnt:5,qrycnt:100,nday:'1',sdate:date.replaceAll('-',''),stime:'',edate:date.replaceAll('-',''),etime:'161000',cts_date:'',cts_time:'',comp_yn:'N'},undefined,fetcher);patch[market]=indexSeries(r.data.t8409OutBlock1,date);}catch(e){errors['chart'+market]=e.code||String(e.message).slice(0,80);}
   await pause();
  }
 }catch(e){errors.enrichment=e.code||String(e.message).slice(0,80);}finally{if(session)await session.close();}
 try{
  try{patch.heatmap=await collectHeatmap(env,date);}catch(e){errors.heatmap=String(e.message).slice(0,80);}
  if(!collectWindow())return;
  // JSON path updates preserve a newer core collection and its history.
  const paths=[],values=[];
  for(const market of ['KOSPI','KOSDAQ'])if(patch[market]){paths.push("'$.indices."+market+".series',json(?)");values.push(JSON.stringify(patch[market]));}
  if(patch.heatmap){paths.push("'$.heatmap',json(?)");values.push(JSON.stringify(patch.heatmap));}
  for(const key of ['chartKOSPI','chartKOSDAQ','heatmap','enrichment']){if(errors[key]){paths.push("'$.errors."+key+"',json(?)");values.push(JSON.stringify(errors[key]));}}
  paths.push("'$.enrichedBucket',?");values.push(flowBucket()?.time||'');
  const cleared=['chartKOSPI','chartKOSDAQ','heatmap','enrichment'].filter(k=>!errors[k]).map(k=>"'$.errors."+k+"'");
  const base=cleared.length?'json_remove(payload,'+cleared.join(',')+')':'payload';
  await env.DB.prepare('UPDATE state SET payload=json_set('+base+','+paths.join(',')+") WHERE id=?").bind(...values,'details:'+date).run();
  return errors.heatmap==='CLASSIFICATION_LOADING';
 }finally{await env.DB.prepare("UPDATE state SET payload='0' WHERE id='details-enrichment-lease' AND payload=?").bind(lease).run();}
}

export async function naverMarket(path,fetcher=fetch){
 const r=await collectionFetch(fetcher)('https://stock.naver.com/api/domestic/market'+path,{headers:{Accept:'application/json','User-Agent':'MarketNote/1.0'},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('NAVER_HTTP_'+r.status);const s=await r.text();if(s.length>3000000)throw new Error('NAVER_SIZE');return JSON.parse(s);
}
export function heatStock(row,market,sector){
 const symbol=row.itemcode,name=row.itemname;
 if(typeof symbol!=='string'||!/^[0-9A-Z]{6}$/.test(symbol)||typeof name!=='string'||!name.trim()||name.length>80)throw new Error('HEATMAP_ID');
 const marketCap=numeric(row.marketSum),changePct=numeric(row.prevChangeRate);
 if(marketCap<=0||marketCap>1e17||changePct< -100||changePct>10000)throw new Error('HEATMAP_RANGE');
 return {symbol,name,market,sector,changePct,marketCap};
}
export async function collectHeatmap(env,date,fetcher=naverMarket){
 const cached=await env.DB.prepare("SELECT payload FROM state WHERE id='naver-industries'").first();
 let membership=cached?JSON.parse(cached.payload):null;
 if(!membership||Date.now()-Date.parse(membership.asOf)>86400000){
  const saved=await env.DB.prepare("SELECT payload FROM state WHERE id='naver-industry-progress'").first();
  let progress=saved?JSON.parse(saved.payload):null;
  if(!progress||progress.date!==date){
   const categories=[],ids=new Set();let finished=false;
   for(let page=0;page<20;page++){
    const rows=await fetcher('/upjong/list?startIdx='+page+'&pageSize=100&sortType=changeRate');if(!Array.isArray(rows))throw new Error('INDUSTRY_SHAPE');
    if(!rows.length){finished=true;break;}
    for(const row of rows){const id=String(row.no);if(!/^\d{1,5}$/.test(id)||ids.has(id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>60)throw new Error('INDUSTRY_ID');if(row.thistime&&String(row.thistime).slice(0,8)!==date.replaceAll('-',''))throw new Error('INDUSTRY_DATE');ids.add(id);categories.push({id,name:row.name});}
   }
   if(!finished||!categories.length)throw new Error('INDUSTRY_INCOMPLETE');
   progress={date,categories,byCode:{},category:0,market:0,cursor:''};
  }
  let requests=0;
  while(progress.category<progress.categories.length){
   const category=progress.categories[progress.category],market=['KOSPI','KOSDAQ'][progress.market];
   const params=new URLSearchParams({marketType:market,sortType:'tradingVolume',sortDirection:'desc',size:'100',...(progress.cursor?{cursor:progress.cursor}:{})});
   const data=await fetcher('/upjong/'+category.id+'/stocklist?'+params);requests++;
   if(!Array.isArray(data.items)||typeof data.hasNext!=='boolean')throw new Error('MEMBERS_SHAPE');
   for(const row of data.items){if(!/^[0-9A-Z]{6}$/.test(row.itemCode)||progress.byCode[row.itemCode])throw new Error('MEMBERS_DUPLICATE');progress.byCode[row.itemCode]={sector:category.name,market};}
   if(data.hasNext){if(typeof data.cursor!=='string'||!data.cursor||data.cursor===progress.cursor)throw new Error('MEMBERS_CURSOR');progress.cursor=data.cursor;}
   else{progress.cursor='';progress.market++;if(progress.market===2){progress.market=0;progress.category++;}}
   if(requests>=24&&progress.category<progress.categories.length){await put(env,'naver-industry-progress',progress);throw new Error('CLASSIFICATION_LOADING');}
   await new Promise(r=>setTimeout(r,350));
  }
  const byCode=progress.byCode;
  membership={asOf:new Date().toISOString(),byCode};await put(env,'naver-industries',membership);await env.DB.prepare("DELETE FROM state WHERE id='naver-industry-progress'").run();throw new Error('CLASSIFICATION_LOADING');
 }
 const stocks=[],seen=new Set();
 for(const market of ['KOSPI','KOSDAQ']){
  let ended=false;
  for(let page=0;page<200;page++){
   const rows=await fetcher('/stock/default?tradeType=KRX&marketType='+market+'&orderType=marketSum&startIdx='+page+'&pageSize=200');
   if(!Array.isArray(rows))throw new Error('QUOTES_SHAPE');if(!rows.length){ended=true;break;}
   for(const row of rows){const symbol=row.itemcode;if(seen.has(symbol))throw new Error('QUOTES_DUPLICATE');seen.add(symbol);const group=membership.byCode[symbol];if(group&&group.market!==market)throw new Error('QUOTES_MARKET');stocks.push(heatStock(row,market,group?.sector||'업종 미분류'));}
   await new Promise(r=>setTimeout(r,350));
  }
  if(!ended)throw new Error('QUOTES_INCOMPLETE');
 }
 if(!stocks.length||stocks.length>6000)throw new Error('QUOTES_COUNT');
 return {asOf:new Date().toISOString(),source:'네이버 증권 KRX · 네이버 업종 · 수집 시각 기준',stocks};
}


