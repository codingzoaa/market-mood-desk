import {fetchNaverBriefingNews} from '../worker/naver-briefing-news.mjs';
import {sectorRecoverySignature} from '../worker/sector-recovery.mjs';
import {kst} from '../worker/ls.mjs';
const now=new Date(),k=kst(now);
if(['Sat','Sun'].includes(k.weekday)||k.time<'1530'||process.env.GITHUB_EVENT_NAME==='schedule'&&k.time>'1930'){
 console.log('NAVER_RELAY_OUTSIDE_WINDOW '+k.date+' '+k.time);process.exit(0);
}
if(!process.env.TELEGRAM_BOT_TOKEN)throw Error('NAVER_RELAY_SIGNING_KEY_MISSING');
const news=await fetchNaverBriefingNews(k.date,['코스피 마감','코스닥 마감'],{env:process.env});
const body=JSON.stringify({operation:'cache',news});const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const time=String(Date.now()),signature=await sectorRecoverySignature(process.env.TELEGRAM_BOT_TOKEN,k.date,time,hash);
const r=await fetch('https://market-note-ls-api.kby0991.workers.dev/internal/sector-recovery',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','X-Sector-Date':k.date,'X-Sector-Time':time,'X-Sector-Signature':signature,'X-Sector-Body-SHA256':hash},body});
const result=await r.json().catch(()=>({}));
if(!r.ok||result.status!=='cached'||result.date!==k.date||result.telegramSent!==false)throw Error('NAVER_RELAY_CACHE_HTTP_'+r.status);
console.log('NAVER_RELAY_CACHE_CONFIRMED '+JSON.stringify(result));
const status=await fetch('https://market-note-ls-api.kby0991.workers.dev/api/telegram-delivery-status?date='+k.date,{redirect:'error',signal:AbortSignal.timeout(15000)});
const state=await status.json();if(!status.ok||state.sectorNews?.mode!=='GITHUB_RELAY'||state.sectorNews?.relay?.status!=='ready')throw Error('NAVER_RELAY_STATUS_NOT_READY');
console.log('NAVER_RELAY_READY '+JSON.stringify({date:k.date,count:state.sectorNews.relay.count,sectorDelivery:state.reports?.sector?.status,telegramSent:false}));
