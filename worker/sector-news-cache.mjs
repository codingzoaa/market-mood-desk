import {parseNaverNews} from '../shared/naver-news.mjs';
import {kst} from './ls.mjs';
export const RELAY_KEY=date=>'sector-news:naver:'+date;
export function verifiedRelayNews(rows,date){
 if(!Array.isArray(rows)||!rows.length||rows.length>4||rows.some(n=>!n||n.provider!=='네이버 뉴스'||typeof n.headline!=='string'||n.headline.length<11||n.headline.length>240||typeof n.link!=='string'||n.link.length>500))throw Error('NAVER_NEWS_RELAY_INVALID');
 const escape=x=>String(x||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const xml='<rss><channel>'+rows.map(n=>'<item><title>'+escape(n.headline)+'</title><originallink>'+escape(n.link)+'</originallink><pubDate>'+escape(n.published)+'</pubDate></item>').join('')+'</channel></rss>';
 const news=parseNaverNews(xml,date).map(n=>({...n,title:n.headline,pubDate:n.published,source:n.source+' · 네이버 뉴스'}));
 if(news.length!==rows.length)throw Error('NAVER_NEWS_RELAY_INVALID');return news;
}
export async function storeSectorNews(env,date,rows,now=new Date()){
 const k=kst(now);if(date!==k.date||['Sat','Sun'].includes(k.weekday)||k.time<'1530')throw Error('NAVER_NEWS_RELAY_DATE_INVALID');
 const news=verifiedRelayNews(rows,date),payload={date,provider:'NAVER_NEWS_SEARCH_XML',receivedAt:now.toISOString(),news};
 await env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(RELAY_KEY(date),JSON.stringify(payload)).run();
 return {date,status:'cached',count:news.length,at:payload.receivedAt,telegramSent:false};
}
export async function relayNewsStatus(env,date,now=new Date()){
 const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(RELAY_KEY(date)).first();
 let saved;try{saved=row?.payload?JSON.parse(row.payload):null;}catch{}
 const age=+now-Date.parse(saved?.receivedAt||'');
 const ready=saved?.date===date&&saved.provider==='NAVER_NEWS_SEARCH_XML'&&Number.isFinite(age)&&age>=0&&age<=3600000&&Array.isArray(saved.news)&&saved.news.length>0;
 return {status:ready?'ready':saved?'stale':'not_received',count:ready?saved.news.length:0,at:saved?.receivedAt||null};
}
export async function readSectorNews(env,date,now=new Date()){
 const status=await relayNewsStatus(env,date,now);if(status.status!=='ready')throw Error('NAVER_NEWS_RELAY_NOT_READY');
 const row=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(RELAY_KEY(date)).first();const data=JSON.parse(row.payload);
 return verifiedRelayNews(data.news,date);
}
