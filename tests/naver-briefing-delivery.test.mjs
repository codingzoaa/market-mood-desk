import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchNaverBriefingNews} from '../worker/naver-briefing-news.mjs';
import {deliverScheduled,DELIVERY_CRONS,recoverSectorDelivery} from '../worker/telegram-delivery.mjs';
const date='2026-11-10';
const item=(title,url='https://www.hankyung.com/article/1',time='Tue, 10 Nov 2026 07:00:00 GMT')=>`<item><title><![CDATA[${title}]]></title><originallink>${url}</originallink><pubDate>${time}</pubDate></item>`;
const xml='<rss><channel>'+item('코스피 반도체 <b>동반 상승</b> 확인')+item('어제 기사 제외',undefined,'Mon, 09 Nov 2026 07:00:00 GMT')+item('가짜 언론사 기사 제외','https://hankyung.com.evil.test/a')+'</channel></rss>';
const credentials={NAVER_CLIENT_ID:' id ',NAVER_CLIENT_SECRET:' secret '};
test('Naver briefing authenticates in headers, rejects stale/spoofed articles and tolerates a partial query failure',async()=>{
 let calls=0;const news=await fetchNaverBriefingNews(date,['코스피 마감','코스닥 마감','코스닥 마감'],{env:credentials,request:async(url,opts)=>{
  calls++;assert.equal(url.origin,'https://openapi.naver.com');assert.equal(url.pathname,'/v1/search/news.xml');assert.ok(!url.href.includes('secret'));assert.equal(opts.redirect,'error');assert.equal(opts.headers['X-Naver-Client-Secret'],'secret');
  return calls===1?new Response('',{status:503}):new Response(xml);
 }});
 assert.equal(calls,2);assert.equal(news.length,1);assert.equal(news[0].source,'한국경제 · 네이버 뉴스');assert.equal(news[0].title,'코스피 반도체 동반 상승 확인');assert.equal(news[0].link,'https://www.hankyung.com/article/1');
});
test('missing credentials, exhausted Naver requests and empty verified news remain explicit failures',async()=>{
 await assert.rejects(()=>fetchNaverBriefingNews(date,['시장'],{request:()=>{throw Error('not called')}}),/SECRETS_MISSING/);
 await assert.rejects(()=>fetchNaverBriefingNews(date,['시장'],{env:credentials,request:async()=>new Response('',{status:503})}),/NAVER_NEWS_HTTP_503/);
 await assert.rejects(()=>fetchNaverBriefingNews(date,['시장'],{env:credentials,request:async()=>new Response('<rss><channel></channel></rss>')}),/NO_VERIFIED_ARTICLES/);
});
function memoryDb(){
 const states=new Map([['telegram:v3:'+date+':close',{status:'sent',attempts:1}],['sector-news:naver:'+date,{date,provider:'NAVER_NEWS_SEARCH_XML',receivedAt:'2026-11-10T07:20:00Z',news:[{headline:'코스피 반도체 동반 상승 확인',link:'https://www.hankyung.com/article/1',published:'Tue, 10 Nov 2026 07:00:00 GMT',provider:'네이버 뉴스'}]}]]);
 const snapshot={date,asOf:'2026-11-10T06:33:00Z',stocks:[{symbol:'005930',name:'삼성전자',changePct:1,turnoverKRW:1e9},{symbol:'000660',name:'SK하이닉스',changePct:2,turnoverKRW:2e9},...Array.from({length:8},(_,i)=>({symbol:String(600000+i),name:'표본',changePct:-1,turnoverKRW:1e6}))]};
 return {states,prepare(sql){return {bind(...args){return {
  async first(){if(sql.startsWith('SELECT payload FROM state')){const s=states.get(args[0]);return s?{payload:JSON.stringify(s)}:null;}if(sql.includes('FROM snapshots'))return {payload:JSON.stringify(snapshot)};if(sql.startsWith('UPDATE state')){const id=args[1],s=states.get(id);if(s.status==='sent')return null;return {payload:JSON.stringify(s)};}throw Error('unexpected read');},
  async run(){if(sql.startsWith('INSERT')){if(!states.has(args[0]))states.set(args[0],JSON.parse(args[1]));}else states.set(args[1],JSON.parse(args[0]));}
 };}};}};
}
test('scheduled worker builds sector briefing with Naver then sends once, preserving already-sent close report',async()=>{
 const DB=memoryDb(),messages=[];const fetcher=async(url,options)=>{const u=new URL(url);assert.equal(u.hostname,'api.telegram.org');messages.push(JSON.parse(options.body).text);return Response.json({ok:true,result:{message_id:7}});};
 await deliverScheduled({cron:DELIVERY_CRONS[0]},{DB,...credentials,TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'123'},new Date('2026-11-10T07:30:00Z'),{fetcher});
 await deliverScheduled({cron:DELIVERY_CRONS[1]},{DB,...credentials,TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'123'},new Date('2026-11-10T08:00:00Z'),{fetcher});
 assert.equal(messages.length,1);assert.match(messages[0],/네이버 뉴스/);assert.ok(!messages[0].includes('news.google.com'));assert.equal(DB.states.get('telegram:v3:'+date+':sector').status,'sent');assert.equal(DB.states.get('telegram:v3:'+date+':close').attempts,1);
});
test('missing relayed news stops before Telegram and retains a retriable D1 failure',async()=>{
 const DB=memoryDb();DB.states.delete('sector-news:naver:'+date);let sends=0;await deliverScheduled({cron:DELIVERY_CRONS[0]},{DB,...credentials},new Date('2026-11-10T07:30:00Z'),{fetcher:async url=>{if(new URL(url).hostname==='api.telegram.org')sends++;return new Response('',{status:503});}});
 assert.equal(sends,0);assert.equal(DB.states.get('telegram:v3:'+date+':sector').error,'NAVER_NEWS_RELAY_NOT_READY');
});


test('owner recovery cannot resend successful messages or send a different day',async()=>{
 const DB=memoryDb();DB.states.set('telegram:v3:'+date+':sector',{status:'sent',attempts:2,messageId:9});
 const result=await recoverSectorDelivery({DB},date,new Date('2026-11-10T13:30:00Z'),{fetcher:()=>{throw Error('must not call')}});
 assert.equal(result.status,'already-sent');
 await assert.rejects(()=>recoverSectorDelivery({DB},'2026-11-09',new Date('2026-11-10T13:30:00Z')),/DATE_OR_TIME/);
});
test('owner recovery sends only a failed sector record after the normal cron window',async()=>{
 const DB=memoryDb();DB.states.get('sector-news:naver:'+date).receivedAt='2026-11-10T13:20:00Z';DB.states.set('telegram:v3:'+date+':sector',{status:'failed',attempts:7,error:'NEWS_HTTP_503'});let sent=0;
 const result=await recoverSectorDelivery({DB,...credentials,TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'123'},date,new Date('2026-11-10T13:30:00Z'),{fetcher:async url=>{if(new URL(url).hostname==='openapi.naver.com')return new Response(xml);sent++;return Response.json({ok:true,result:{message_id:8}});}});
 assert.equal(result.status,'sent');assert.equal(sent,1);assert.equal(DB.states.get('telegram:v3:'+date+':sector').attempts,8);assert.equal(DB.states.get('telegram:v3:'+date+':close').attempts,1);
});

test('signed Naver relay sends from verified articles without another Cloudflare-to-Naver request',async()=>{
 const {handleSectorRecovery,sectorRecoverySignature}=await import('../worker/sector-recovery.mjs');const DB=memoryDb();DB.states.set('telegram:v3:'+date+':sector',{status:'failed',attempts:8});
 const now=new Date('2026-11-10T13:30:00Z'),time=String(+now),body=JSON.stringify({news:[{headline:'코스피 반도체 동반 상승 확인',link:'https://www.hankyung.com/article/1',published:'Tue, 10 Nov 2026 07:00:00 GMT',provider:'네이버 뉴스'}]});
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))].map(x=>x.toString(16).padStart(2,'0')).join(''),signature=await sectorRecoverySignature('test',date,time,hash);
 const response=await handleSectorRecovery(new Request('https://worker/internal/sector-recovery',{method:'POST',headers:{'X-Sector-Date':date,'X-Sector-Time':time,'X-Sector-Signature':signature,'X-Sector-Body-SHA256':hash},body}),{DB,TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'123'},now,{fetcher:async url=>{assert.equal(new URL(url).hostname,'api.telegram.org');return Response.json({ok:true,result:{message_id:9}});}});
 assert.equal(response.status,200);assert.equal((await response.json()).messageId,9);assert.equal(DB.states.get('telegram:v3:'+date+':sector').attempts,9);
});
