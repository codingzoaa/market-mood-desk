import {Meter,meteredD1} from './pipeline/db.mjs';
import {persistCollectorMetrics} from './pipeline/hook.mjs';
import {createSession} from './tls.mjs';
import {accessToken,tr,number,signed,kst,collectWindow,collectionFetch,LSFailure} from './ls.mjs';
const pause=()=>new Promise(r=>setTimeout(r,1100));
const put=(env,id,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(value)).run();
export function indexQuote(row){
 if(!row)throw new Error('INDEX_SHAPE');
 return {value:number(row.pricejisu,0,1e7),changePct:signed(row.diffjisu,row.sign),change:signed(row.change,row.sign),advances:number(row.highjo,0,10000),unchanged:number(row.unchgjo,0,10000),declines:number(row.lowjo,0,10000)};
}
export function indexSeries(rows,date){
 if(!Array.isArray(rows))throw new Error('CHART_SHAPE');
 const points=rows.filter(r=>r.date===date.replaceAll('-','')).map(r=>{if(!/^\d{6}$/.test(r.time))throw new Error('CHART_TIME');return {time:r.time,value:number(r.close,0,1e7)};}).filter(p=>p.time<='153000').sort((a,b)=>a.time.localeCompare(b.time));
 if(!points.length)throw new Error('CHART_DATE');return points;
}
export function rawFlows(data){
 return Object.fromEntries(['KOSPI','KOSDAQ','FUTURES','CALL','PUT'].map((key,i)=>{
  const row=data['t1601OutBlock'+(i+1)];if(!row)throw new Error('FLOW_SHAPE');
  return [key,Object.fromEntries([['foreign','17'],['institution','18'],['individual','08'],['financial','01']].map(([name,code])=>[name,number(row['svolume_'+code],-1e13,1e13)]))];
 }));
}
const numeric=v=>{if(!['string','number'].includes(typeof v))throw new Error('NAVER_NUMBER');if(typeof v==='string')v=v.replaceAll(',','').trim();if(v===''||v===null||v===undefined||!Number.isFinite(Number(v)))throw new Error('NAVER_NUMBER');return Number(v);};
export async function collectDetails(env){
 if(!env.LS_APP_KEY||!env.LS_APP_SECRET||!collectWindow())return;
 const originalEnv=env,collectionMeter=new Meter(),trCounts={};
 if(env.ENABLE_HISTORY_PIPELINE==='true')env={...env,DB:meteredD1(env.DB,collectionMeter)};
 try{
 const latest=await env.DB.prepare('SELECT date FROM snapshots ORDER BY date DESC LIMIT 1').first();if(!latest||Date.parse(kst().date)-Date.parse(latest.date)>7*86400000)return;
 const current=kst();if(latest.date!==current.date&&current.time>='0900'&&!['Sat','Sun'].includes(current.weekday))return;
 const date=latest.date,now=Date.now(),oldRow=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first();
 const old=oldRow?JSON.parse(oldRow.payload):{};
 if(old.checkedAt&&now-Date.parse(old.checkedAt)<((old.errors?.heatmap==='CLASSIFICATION_LOADING'||old.errors?.flows==='UNIT_VERIFICATION_PENDING')?1000:300000))return;
 if(!collectWindow()&&old.flows&&old.heatmap&&Object.keys(old.indices||{}).length===2&&!Object.keys(old.errors||{}).length)return;
 // Independent enrichment lease; never changes or replaces the core quote snapshot.
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES('details-lease','0')").run();
 const lock=await env.DB.prepare("UPDATE state SET payload=? WHERE id='details-lease' AND CAST(payload AS INTEGER) < ? RETURNING id").bind(String(now+300000),now).first();if(!lock)return;
 const details={collectorRevision:'krx-close-1530-v3',date,asOf:new Date(now).toISOString(),checkedAt:new Date(now).toISOString(),indices:old.indices||{},...(old.flows?{flows:old.flows}:{}),errors:{}};
 let session;
 try{
  session=await createSession();const fetcher=collectionFetch(session.fetch);const token=await accessToken(env,fetcher,Date.now(),false);const request=(code,body)=>{trCounts[code]=(trCounts[code]||0)+1;return tr(token,code,body,undefined,fetcher);};
  const daily=(await request('t8410',{shcode:'005930',gubun:'2',qrycnt:2,sdate:'',edate:date.replaceAll('-',''),cts_date:'',comp_yn:'N',sujung:'N'})).data;
  await put(env,'details-diagnostic',{date,chartDates:daily.t8410OutBlock1?.map(r=>r.date)||[],checkedAt:new Date().toISOString()});
  if(daily.t8410OutBlock1?.map(r=>r.date).sort().at(-1)!==date.replaceAll('-',''))throw new Error('TRADE_DATE');
  for(const [code,market] of [['001','KOSPI'],['301','KOSDAQ']]){
   try{
    const quote=indexQuote((await request('t1511',{upcode:code})).data.t1511OutBlock);await pause();
    let series=[];
    try{const r=await request('t8409',{shcode:code,ncnt:5,qrycnt:100,nday:'1',sdate:date.replaceAll('-',''),stime:'',edate:date.replaceAll('-',''),etime:'153000',cts_date:'',cts_time:'',comp_yn:'N'});series=indexSeries(r.data.t8409OutBlock1,date);}catch(e){details.errors['chart'+market]=e instanceof LSFailure?e.code:e.message;}
    details.indices[market]={...quote,series,asOf:details.asOf};
   }catch(e){details.errors[market]=e instanceof LSFailure?e.code:e.message;}
  }
  try{
   // Amount mode is already in 억원; do not multiply by the stock-ranking 백만원 scale.
   // 2026-10-19 live cross-check: LS foreign net buy 947 = Naver index flow +947억원.
   details.flows={asOf:details.asOf,unit:'억원',source:'LS증권 KRX · t1601 금액 순매수',segments:rawFlows((await request('t1601',{gubun1:'2',gubun2:'2',gubun3:'',gubun4:'2',exchgubun:'K'})).data)};
  }catch(e){details.errors.flows=e instanceof LSFailure?e.code:e.message;}
 }catch(e){details.errors.ls=e instanceof LSFailure?e.code:e.message;}finally{if(session)await session.close();}
 if(!collectWindow())return;
 try{details.heatmap=await collectHeatmap(env,date);}catch(e){details.errors.heatmap=String(e.message).slice(0,80);if(old.heatmap)details.heatmap=old.heatmap;}
 if(!collectWindow())return;
 await put(env,'details:'+date,details);
 await env.DB.prepare("DELETE FROM state WHERE id LIKE 'details:%' AND id < 'details:' || date('now','-365 day')").run();
 await env.DB.prepare("UPDATE state SET payload='0' WHERE id='details-lease' AND payload=?").bind(String(now+300000)).run();
 return collectWindow()&&details.errors.heatmap==='CLASSIFICATION_LOADING';
 }finally{await persistCollectorMetrics(originalEnv,collectionMeter,'details',trCounts);}
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
