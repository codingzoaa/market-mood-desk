import catalog from '../src/data/stock-map.json' with {type:'json'};
import {kst} from './ls.mjs';

export const DELIVERY_CRONS=['10,40 7-9 * * MON-FRI','10 10 * * MON-FRI'];
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const num=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const dateLocal=s=>kst(new Date(s)).date;
const slotMinutes=s=>Number(s.slice(0,2))*60+Number(s.slice(2));
const sanitize=e=>String(e?.message||e).replace(/https?:\/\/\S+/g,'[source]').replace(/[A-Za-z0-9_-]{32,}/g,'[redacted]').slice(0,90);

export function allowedDelivery(event,now=new Date()){
 const k=kst(now);
 return DELIVERY_CRONS.includes(event.cron)&&!['Sat','Sun'].includes(k.weekday)&&slotMinutes(k.time)>=970&&slotMinutes(k.time)<=1165;
}
export function formatClose(date,d){
 assert(d?.date===date,'CLOSE_DATE_MISMATCH');
 assert(!d.errors?.KOSPI&&!d.errors?.KOSDAQ&&!d.errors?.flows&&!d.errors?.ls,'CLOSE_COLLECTION_ERROR');
 const i=d.indices||{},f=d.flows;
 assert(f?.unit==='억원'&&f.segments&&dateLocal(f.asOf)===date,'CLOSE_FLOWS_INVALID');
 assert(slotMinutes(kst(new Date(f.asOf)).time)>=930,'CLOSE_FLOWS_PRE_CLOSE');
 for(const market of ['KOSPI','KOSDAQ']){
  const x=i[market];
  assert(x&&dateLocal(x.asOf)===date&&slotMinutes(kst(new Date(x.asOf)).time)>=930,'CLOSE_INDEX_STALE');
  assert(['value','changePct','advances','unchanged','declines'].every(v=>valid(x[v])),'CLOSE_INDEX_INVALID');
 }
 for(const market of ['KOSPI','KOSDAQ','FUTURES','CALL','PUT'])
  assert(['individual','foreign','institution'].every(w=>valid(f.segments?.[market]?.[w])),'CLOSE_FLOW_MISSING_'+market);
 const index=k=>{const a=i[k];return k+' '+num(a.value)+' ('+(a.changePct>0?'+':'')+num(a.changePct)+'%) · 상승 '+a.advances+' / 보합 '+a.unchanged+' / 하락 '+a.declines;};
 const flow=k=>{const a=f.segments[k];return k+' 개인 '+num(a.individual)+' / 외국인 '+num(a.foreign)+' / 기관 '+num(a.institution)+'억';};
 const foreignSpot=f.segments.KOSPI.foreign+f.segments.KOSDAQ.foreign,future=f.segments.FUTURES.foreign;
 const direction=foreignSpot>0&&future>0?'상방 우위':foreignSpot<0&&future<0?'하방 우위':'현물·선물 혼조';
 const oi=d.oi?.futures;
 const oiValid=oi?.source==='LS t2424'&&dateLocal(oi.asOf)===date&&slotMinutes(kst(new Date(oi.asOf)).time)>=930&&valid(oi.openInterest)&&Number.isInteger(oi.change)&&/^[A-Z0-9]{8}$/.test(oi.contract||'');
 return [
  date+' 국내 증시 장 마감·수급 브리핑','',
  index('KOSPI'),index('KOSDAQ'),'',
  '개인 / 외국인 / 기관 순매수 (억원)',
  ...['KOSPI','KOSDAQ','FUTURES','CALL','PUT'].map(flow),'',
  '단기 방향: '+direction,
  '외국인 현물 '+num(foreignSpot)+'억 · KOSPI200 선물 '+num(future)+'억',
  oiValid?'선물 근월물 '+oi.contract+' OI '+num(oi.openInterest)+'계약 (전일 대비 '+(oi.change>0?'+':'')+num(oi.change)+')':'선물 미결제약정(OI): 확인 불가',
  '※ 옵션 수급 및 OI만으로 신규 숏·숏커버 여부를 확정할 수 없음. ETF 제외.'
 ].join('\n');
}
const sectorMap=new Map(catalog.filter(x=>x?.sector&&/^\d{6}$/.test(x.symbol)).map(x=>[x.symbol,x.sector]));
export function sectorGroups(snapshot){
 assert(snapshot&&Array.isArray(snapshot.stocks),'SECTOR_SNAPSHOT_INVALID');
 const groups=new Map();
 for(const s of snapshot.stocks){
  if(!/^\d{6}$/.test(s.symbol)||!valid(s.changePct)||!valid(s.turnoverKRW)||/^(KODEX|TIGER|ACE|RISE|PLUS|SOL|HANARO|KOSEF)/i.test(s.name||''))continue;
  const sector=sectorMap.get(s.symbol);if(!sector)continue;
  if(!groups.has(sector))groups.set(sector,new Map());
  groups.get(sector).set(s.symbol,s);
 }
 return [...groups].map(([sector,map])=>{
  const stocks=[...map.values()],gainers=stocks.filter(s=>s.changePct>0);
  return {sector,stocks,gainers:gainers.length,avg:stocks.reduce((a,s)=>a+s.changePct,0)/stocks.length,turnover:stocks.reduce((a,s)=>a+s.turnoverKRW,0)};
 }).filter(x=>x.stocks.length>=2&&x.gainers>=2&&x.avg>0)
 .sort((a,b)=>b.avg-a.avg||b.turnover-a.turnover).slice(0,5);
}
const extract=(text,key)=>{const match=text.match(new RegExp('<'+key+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+key+'>','i'));return match?match[1].replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim():'';};
const newsSource=/^(연합뉴스|뉴시스|뉴스핌|이데일리|한국경제|매일경제|서울경제|아시아경제|머니투데이|조선비즈|전자신문|파이낸셜뉴스)$/;
export function filterNews(xml,date){
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(x=>{
  const x1=x[1],title=extract(x1,'title'),source=extract(x1,'source'),link=extract(x1,'link'),pubDate=extract(x1,'pubDate');
  return {title,source,link,pubDate};
 }).filter(x=>x.title.length>10&&newsSource.test(x.source)&&/^https:\/\//.test(x.link)&&Number.isFinite(Date.parse(x.pubDate))&&dateLocal(x.pubDate)===date).slice(0,4);
}
export function formatSector(date,snapshot,news){
 assert(snapshot?.date===date&&dateLocal(snapshot.asOf)===date&&slotMinutes(kst(new Date(snapshot.asOf)).time)>=930,'SECTOR_NOT_CLOSED');
 assert(snapshot.stocks?.length>=10,'SECTOR_STOCKS_MISSING');
 assert(news.length>0,'SECTOR_NEWS_MISSING');
 const groups=sectorGroups(snapshot);
 const parts=[date+' 강세·이슈 섹터 브리핑','','1. 강세 섹터 (LS 거래대금 상위 표본 기준)'];
 if(!groups.length)parts.push('동반 상승으로 확인된 섹터 없음');
 groups.forEach((g,i)=>{
  const leaders=[...g.stocks].sort((a,b)=>b.changePct-a.changePct).slice(0,3);
  parts.push((i+1)+'. '+g.sector+' · 표본 평균 '+(g.avg>0?'+':'')+num(g.avg)+'%, '+g.gainers+'/'+g.stocks.length+'개 상승');
  parts.push(leaders.map(s=>s.name+' '+(s.changePct>0?'+':'')+num(s.changePct)+'%').join(' · ').slice(0,220));
 });
 parts.push('','2. 오늘 주요 이슈·뉴스 (당일 기사)');
 news.forEach((n,i)=>parts.push((i+1)+'. '+n.title.slice(0,110)+' ('+n.source+')\n'+n.link));
 parts.push('','※ LS 거래대금 상위·분류 종목 표본이며 전체 업종 상승률이 아님. 기사와 주가의 인과관계는 별도 검증 필요.');
 const report=parts.join('\n');
 assert(report.length<=3800,'SECTOR_REPORT_TOO_LONG');
 return report;
}
async function readPayload(env,kind,date,fetcher=fetch){
 if(kind==='close'){
  const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind('details:'+date).first();
  assert(r?.payload,'CLOSE_STORED_DATA_MISSING');
  return formatClose(date,JSON.parse(r.payload));
 }
 const r=await env.DB.prepare('SELECT payload FROM snapshots WHERE date=?').bind(date).first();
 assert(r?.payload,'SECTOR_STORED_DATA_MISSING');
 const snapshot=JSON.parse(r.payload);
 const rss=new URL('https://news.google.com/rss/search');
 rss.searchParams.set('q','(코스피 OR 코스닥) (반도체 OR 이차전지 OR 바이오 OR 방산 OR 조선 OR 로봇) when:1d');
 rss.searchParams.set('hl','ko');rss.searchParams.set('gl','KR');rss.searchParams.set('ceid','KR:ko');
 const response=await fetcher(rss,{signal:AbortSignal.timeout(15000)});
 assert(response.ok,'NEWS_HTTP_'+response.status);
 const news=filterNews(await response.text(),date);
 return formatSector(date,snapshot,news);
}
async function transmit(env,message,fetcher=fetch){
 assert(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID,'TELEGRAM_SECRETS_MISSING');
 assert(message.length<=4000,'MESSAGE_TOO_LONG');
 const r=await fetcher('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{
  method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},
  body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:message})
 });
 assert(r.ok,'TELEGRAM_HTTP_'+r.status);
 const data=await r.json();assert(data.ok===true&&Number.isInteger(data.result?.message_id),'TELEGRAM_API_NOT_ACCEPTED');
 return data.result.message_id;
}
async function write(env,id,obj){await env.DB.prepare('UPDATE state SET payload=? WHERE id=?').bind(JSON.stringify(obj),id).run();}
async function attempt(env,kind,date,now,dependencies={}){
 const id='telegram:v3:'+date+':'+kind,timestamp=now.getTime(),leaseUntil=timestamp+180000;
 await env.DB.prepare("INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)").bind(id,JSON.stringify({status:'pending',attempts:0})).run();
 const claim=await env.DB.prepare("UPDATE state SET payload=json_set(payload,'$.leaseUntil',?,'$.status','sending') WHERE id=? AND json_extract(payload,'$.status')!='sent' AND COALESCE(json_extract(payload,'$.leaseUntil'),0)<? RETURNING payload").bind(leaseUntil,id,timestamp).first();
 if(!claim)return {kind,status:'already-sent-or-in-progress'};
 const attempts=Number(JSON.parse(claim.payload).attempts||0)+1;
 try{
  const message=await readPayload(env,kind,date,dependencies.fetcher);
  const messageId=await transmit(env,message,dependencies.fetcher);
  await write(env,id,{status:'sent',attempts,at:new Date(timestamp).toISOString(),messageId});
  console.log('TELEGRAM_SENT',date,kind,messageId);
  return {kind,status:'sent'};
 }catch(error){
  const reason=sanitize(error);
  await write(env,id,{status:'failed',attempts,at:new Date(timestamp).toISOString(),error:reason});
  console.log('TELEGRAM_FAILED',date,kind,reason);
  return {kind,status:'failed',error:reason};
 }
}
export async function deliverScheduled(event,env,now=new Date(),dependencies={}){
 if(!allowedDelivery(event,now))return {status:'outside-window'};
 const k=kst(now),results=[];
 for(const kind of ['close','sector'])results.push(await attempt(env,kind,k.date,now,dependencies));
 if(slotMinutes(k.time)>=1150&&results.some(r=>r.status==='failed')){
  try{await transmit(env,'🚨 '+k.date+' 브리핑 최종 발송 실패: '+results.filter(r=>r.status==='failed').map(r=>r.kind==='close'?'장 마감·수급':'강세·이슈 섹터').join(', ')+'. Cloudflare D1 발송기록 확인.',dependencies.fetcher);}
  catch(error){console.log('TELEGRAM_FAILURE_ALERT_UNAVAILABLE',sanitize(error));}
 }
 return {date:k.date,results};
}
