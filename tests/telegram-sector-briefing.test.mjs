import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNews,selectLeaders,render,main} from '../scripts/telegram-sector-briefing.mjs';

const date='2026-11-09',time='2026-11-09T06:40:00Z';
const stockMap=[{symbol:'005930',sector:'반도체'},{symbol:'000660',sector:'반도체'},{symbol:'006400',sector:'2차전지'},{symbol:'373220',sector:'2차전지'}];
const sample=[
 {symbol:'005930',name:'삼성전자',changePct:3,turnoverKRW:200000000000},
 {symbol:'000660',name:'SK하이닉스',changePct:4,turnoverKRW:100000000000},
 {symbol:'006400',name:'삼성SDI',changePct:-2,turnoverKRW:80000000000},
 {symbol:'373220',name:'LG에너지솔루션',changePct:-3,turnoverKRW:70000000000},
 ...Array.from({length:8},(_,i)=>({symbol:String(100000+i),name:'기타'+i,changePct:0,turnoverKRW:10000000000}))
];
const snapshot={date,asOf:time,stocks:sample};
const xml=`<rss><channel>
<item><title>반도체 장비주 동반 상승 - 연합뉴스</title><link>https://news.google.com/rss/articles/example1</link><pubDate>Mon, 09 Nov 2026 07:05:00 GMT</pubDate><source>연합뉴스</source></item>
<item><title>지난주 이차전지 상승 - 연합뉴스</title><link>https://news.google.com/rss/articles/example2</link><pubDate>Fri, 06 Nov 2026 07:05:00 GMT</pubDate><source>연합뉴스</source></item>
<item><title>오늘 루머 - 미확인블로그</title><link>https://news.google.com/rss/articles/example3</link><pubDate>Mon, 09 Nov 2026 07:05:00 GMT</pubDate><source>미확인블로그</source></item>
</channel></rss>`;
test('sector classification excludes ETF and requires two advancing verified constituents',()=>{
 const leaders=selectLeaders(snapshot,stockMap);
 assert.equal(leaders.length,1);
 assert.equal(leaders[0].name,'반도체');
 assert.equal(leaders[0].avg,3.5);
});
test('news filter rejects stale day and untrusted source',()=>{
 const n=parseNews(xml,date);
 assert.equal(n.length,1);
 assert.match(n[0].headline,/반도체/);
});
test('sector report avoids unverified full market return and uses dated news',()=>{
 const body=render(date,snapshot,selectLeaders(snapshot,stockMap),parseNews(xml,date));
 assert.match(body,/표본 평균 \+3\.5%/);
 assert.match(body,/공식 업종지수 등락률이 아님/);
 assert.doesNotMatch(body,/미확인블로그|지난주/);
 assert.throws(()=>render(date,{...snapshot,date:'2026-11-06'},[],parseNews(xml,date)),/SECTOR_DATE_MISMATCH/);
 assert.throws(()=>render(date,snapshot,[],[]),/SECTOR_NEWS_NOT_VERIFIED/);
});
test('dry run never calls Telegram and still validates stored date',async()=>{
 let sent=false;
 const result=await main({TELEGRAM_DRY_RUN:'true'},{
  now:new Date('2026-11-09T07:15:00Z'),
  stockMap,
  readJson:async()=>({snapshots:[snapshot]}),
  readNews:async()=>xml,
  deliverMessage:async()=>{sent=true;}
 });
 assert.equal(result.status,'checked');
 assert.equal(sent,false);
});
test('real sector report uses Telegram only when same-day data validated',async()=>{
 const messages=[];
 const result=await main({TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'123'},{
  now:new Date('2026-11-09T07:15:00Z'),stockMap,
  readJson:async()=>({snapshots:[snapshot]}),readNews:async()=>xml,
  deliverMessage:async msg=>messages.push(msg)
 });
 assert.equal(result.status,'delivered');
 assert.equal(messages.length,1);
 assert.match(messages[0],/강세·이슈 섹터/);
});
test('co-rise mode requires a positive majority and ranks breadth ahead of one outlier',()=>{
 const stock=(symbol,changePct)=>({symbol,name:symbol,changePct,turnoverKRW:100});
 const groups=[['A',[0.5,0.2]],['B',[20,0.1,-1]],['C',[20,0.1,-1,-1]],['D',[1,-0.2]],['E',[1,1,-5]]];
 const stocks=[],map=[];let i=500000;
 for(const [sector,changes] of groups)for(const pct of changes){const symbol=String(i++);stocks.push(stock(symbol,pct));map.push({symbol,sector});}
 const leaders=selectLeaders({date,stocks},map,{coRise:true});
 assert.deepEqual(leaders.map(x=>x.name),['A','B']);
});
