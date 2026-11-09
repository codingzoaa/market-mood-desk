import test from 'node:test';
import assert from 'node:assert/strict';
import {DELIVERY_CRONS,allowedDelivery,formatClose,sectorGroups,filterNews,formatSector} from '../worker/telegram-delivery.mjs';

const day='2026-11-10',asOf='2026-11-10T06:33:00Z';
const indices=Object.fromEntries(['KOSPI','KOSDAQ'].map(k=>[k,{value:5100,changePct:-0.5,advances:300,unchanged:30,declines:600,asOf}]));
const segments=Object.fromEntries(['KOSPI','KOSDAQ','FUTURES','CALL','PUT'].map(k=>[k,{individual:-100,foreign:-200,institution:300}]));
const close={date:day,indices,flows:{unit:'억원',asOf,segments},errors:{}};
test('Cloudflare scheduled times use UTC 07:10 / 07:40 and block dawn or weekends',()=>{
 assert.equal(DELIVERY_CRONS.length,2);
 assert.equal(allowedDelivery({cron:DELIVERY_CRONS[0]},new Date('2026-11-10T07:10:00Z')),true);
 assert.equal(allowedDelivery({cron:DELIVERY_CRONS[0]},new Date('2026-11-10T07:40:00Z')),true);
 assert.equal(allowedDelivery({cron:DELIVERY_CRONS[1]},new Date('2026-11-10T10:10:00Z')),true);
 assert.equal(allowedDelivery({cron:DELIVERY_CRONS[0]},new Date('2026-11-10T02:10:00Z')),false);
 assert.equal(allowedDelivery({cron:'*/5 7 * * MON-FRI'},new Date('2026-11-10T07:10:00Z')),false);
 assert.equal(allowedDelivery({cron:DELIVERY_CRONS[0]},new Date('2026-11-14T07:10:00Z')),false);
});
test('close briefing validates current day's five LS segments and excludes ETF',()=>{
 const s=formatClose(day,close);
 assert.match(s,/외국인/);assert.match(s,/KOSPI/);assert.match(s,/FUTURES/);
 assert.doesNotMatch(s,/ETF 수급/);
 assert.throws(()=>formatClose('2026-11-09',close),/CLOSE_DATE_MISMATCH/);
 assert.throws(()=>formatClose(day,{...close,flows:{...close.flows,unit:'백만원'}}),/CLOSE_FLOWS_INVALID/);
 assert.throws(()=>formatClose(day,{...close,flows:{...close.flows,segments:{...segments,FUTURES:{foreign:null,individual:1,institution:0}}}}),/CLOSE_FLOW_MISSING_FUTURES/);
});
const stocks=[
 {symbol:'005930',name:'삼성전자',changePct:3.4,turnoverKRW:5000000000},
 {symbol:'000660',name:'SK하이닉스',changePct:4.6,turnoverKRW:7000000000},
 {symbol:'006400',name:'삼성SDI',changePct:-2.5,turnoverKRW:2000000000},
 {symbol:'373220',name:'LG에너지솔루션',changePct:-3.3,turnoverKRW:2000000000},
 ...Array.from({length:8},(_,i)=>({symbol:String(600000+i),name:'기타'+i,changePct:0,turnoverKRW:10000000}))
];
const snapshot={date:day,asOf,stocks};
const xml='<rss><channel><item><title>반도체 장비 동반 상승과 시장 영향 분석</title><link>https://news.google.com/rss/articles/x</link><source>연합뉴스</source><pubDate>Tue, 10 Nov 2026 07:00:00 GMT</pubDate></item></channel></rss>';
test('sector report uses identified rising constituents and same-day trusted news',()=>{
 const groups=sectorGroups(snapshot);assert.equal(groups.length,1);assert.equal(groups[0].sector,'반도체');
 const news=filterNews(xml,day);assert.equal(news.length,1);
 const s=formatSector(day,snapshot,news);
 assert.match(s,/반도체/);assert.match(s,/표본 평균/);
 assert.throws(()=>formatSector(day,snapshot,[]),/SECTOR_NEWS_MISSING/);
 assert.throws(()=>formatSector(day,{...snapshot,date:'2026-11-09'},news),/SECTOR_NOT_CLOSED/);
});
