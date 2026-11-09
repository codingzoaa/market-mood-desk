import {readFileSync} from 'node:fs';

const TZ='Asia/Seoul';
const KST=(now)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
const dateOf=f=>f.year+'-'+f.month+'-'+f.day;
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const ensure=(yes,why)=>{if(!yes)throw Error(why);};
const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
const localDate=(iso)=>dateOf(KST(new Date(iso)));
const get=async(url)=>{const response=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'application/json, application/rss+xml, application/xml'}});ensure(response.ok,'HTTP_'+response.status);return response;};
const xmlText=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
const tag=(item,name)=>{const m=item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));return m?xmlText(m[1]):''};
const trusted=/^(연합뉴스|뉴시스|뉴스핌|이데일리|한국경제|매일경제|서울경제|아시아경제|머니투데이|조선비즈|전자신문|파이낸셜뉴스|비즈워치)$/;
export function parseNews(xml,date){
 const entries=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>{
  const v=m[1],headline=tag(v,'title'),source=tag(v,'source'),link=tag(v,'link'),published=tag(v,'pubDate');
  const dt=Date.parse(published);
  return {headline,source,link,published,day:Number.isFinite(dt)?localDate(published):null};
 });
 return entries.filter(n=>n.day===date&&trusted.test(n.source)&&n.headline.length>8&&/^https:\/\//.test(n.link));
}
export function selectLeaders(snapshot,stockMap){
 ensure(snapshot&&snapshot.date,'SECTOR_SNAPSHOT_MISSING');
 const curated=new Map(stockMap.filter(x=>typeof x.sector==='string'&&x.sector!=='분류 대기').map(x=>[x.symbol,x]));
 const groups=new Map();
 for(const s of snapshot.stocks||[]){
  if(!/^\d{6}$/.test(s.symbol)||!valid(s.changePct)||!valid(s.turnoverKRW)||s.turnoverKRW<0)continue;
  if(/^(?:KODEX|TIGER|ACE|RISE|PLUS|SOL|HANARO|KOSEF|ARIRANG|KBSTAR)/i.test(s.name))continue;
  const sector=curated.get(s.symbol)?.sector;
  if(!sector)continue;
  const a=groups.get(sector)||[];
  if(!a.some(p=>p.symbol===s.symbol))a.push(s);
  groups.set(sector,a);
 }
 return [...groups].map(([name,stocks])=>{
  const gainers=stocks.filter(s=>s.changePct>0);
  const avg=stocks.reduce((a,s)=>a+s.changePct,0)/stocks.length;
  const turnover=stocks.reduce((a,s)=>a+s.turnoverKRW,0);
  return {name,stocks,avg,turnover,gainers:gainers.length};
 }).filter(g=>g.stocks.length>=2&&g.gainers>=2&&g.avg>0).sort((a,b)=>b.avg-a.avg||b.turnover-a.turnover).slice(0,5);
}
export function render(date,snapshot,leaders,news){
 ensure(snapshot.date===date,'SECTOR_DATE_MISMATCH');
 ensure(snapshot.asOf&&localDate(snapshot.asOf)===date,'SECTOR_SNAPSHOT_STALE');
 ensure(KST(new Date(snapshot.asOf)).hour+KST(new Date(snapshot.asOf)).minute>='1530','SECTOR_NOT_CLOSED');
 ensure(Array.isArray(snapshot.stocks)&&snapshot.stocks.length>=10,'SECTOR_STOCKS_MISSING');
 ensure(news.length>0,'SECTOR_NEWS_NOT_VERIFIED');
 const marketSamples=snapshot.stocks.filter(x=>/^\d{6}$/.test(x.symbol)).length;
 const sections=[
 date+' 강세·이슈 섹터 브리핑',
 '자료: LS 거래대금 상위 종목 표본 '+marketSamples+'개 / 당일 신뢰매체 뉴스',
 '',
 '1. 강세 섹터 (최대 5개 · 표본 기준)'
 ];
 if(!leaders.length)sections.push('동반 상승이 확인된 섹터 없음 (표본 기준).');
 for(let i=0;i<leaders.length;i++){
  const a=leaders[i];
  const top=[...a.stocks].sort((x,y)=>y.changePct-x.changePct).slice(0,3);
  sections.push((i+1)+'. '+a.name+' · 표본 평균 '+(a.avg>0?'+':'')+fmt(a.avg)+'% ('+a.gainers+'/'+a.stocks.length+'개 상승)\n   '+top.map(s=>s.name+' '+(s.changePct>0?'+':'')+fmt(s.changePct)+'%').join(' · '));
 }
 sections.push('','2. 주요 이슈 섹터 (당일 기사 확인)');
 for(const n of news.slice(0,5))sections.push('- '+n.headline+' ('+n.source+')\n  '+n.link);
 sections.push('','※ 섹터 평균은 LS 거래대금 상위 종목 중 분류 확인된 표본의 단순 평균이며, 거래소 공식 업종지수 등락률이 아님.');
 sections.push('※ 기사 제목은 당일 보도 기준. 뉴스와 주가의 인과관계 및 악재·호재 여부를 단정하지 않음.');
 sections.push('✅ 발송 성공 여부는 Telegram API 응답과 GitHub Actions 기록으로 확인.');
 return sections.join('\n');
}
export async function main(env=process.env,dependencies={}){
 const now=dependencies.now||new Date(),f=KST(now),date=dateOf(f);
 ensure(f.hour+f.minute>='1610','BEFORE_1610');
 ensure(!['Sat','Sun'].includes(new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short'}).format(now)),'WEEKEND');
 const base=env.MARKET_DASHBOARD_URL||'https://market-note-ls-api.kby0991.workers.dev/api/dashboard';
 const url=new URL(base);ensure(url.protocol==='https:','HTTPS_REQUIRED');url.searchParams.set('to',date);
 const payload=await (dependencies.readJson|| (async(u)=>await (await get(u)).json()))(url);
 const snapshots=payload?.snapshots;
 ensure(Array.isArray(snapshots),'SECTOR_SNAPSHOTS_INVALID');
 const snapshot=snapshots.find(s=>s.date===date);
 ensure(snapshot,'SECTOR_TODAY_NOT_SAVED');
 const map=dependencies.stockMap||JSON.parse(readFileSync(new URL('../src/data/stock-map.json',import.meta.url),'utf8'));
 const leaders=selectLeaders(snapshot,map);
 // Fetch time-stamped same-day headlines, not conjectured catalysts.
 const rss=new URL('https://news.google.com/rss/search');
 rss.searchParams.set('q','(코스피 OR 코스닥) (반도체 OR 이차전지 OR 바이오 OR 방산 OR 조선 OR 전력 OR 로봇) when:1d');
 rss.searchParams.set('hl','ko');rss.searchParams.set('gl','KR');rss.searchParams.set('ceid','KR:ko');
 const xml=await (dependencies.readNews || (async(u)=>await (await get(u)).text()))(rss);
 const news=parseNews(xml,date).slice(0,8);
 const report=render(date,snapshot,leaders,news);
 if(env.TELEGRAM_DRY_RUN==='true'){console.log('SECTOR_DRY_RUN_OK '+date);return {status:'checked',date};}
 ensure(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID,'TELEGRAM_CREDENTIALS_MISSING');
 const send=dependencies.deliverMessage|| (async(message)=>{
  const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:message})
  });
  ensure(response.ok,'TELEGRAM_HTTP_'+response.status);
  const data=await response.json();ensure(data.ok,'TELEGRAM_REJECTED');
 });
 for(let i=0;i<report.length;i+=3500)await send(report.slice(i,i+3500));
 console.log('Telegram sector delivery accepted for '+date);
 return {status:'delivered',date};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 main().catch(e=>{console.error('Sector delivery failed:',e.message);process.exitCode=1;});
}
