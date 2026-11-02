import {readFileSync,writeFileSync} from 'node:fs';
const path='public/kospi-pension-rsi.json';
const current=JSON.parse(readFileSync(path,'utf8'));
const endpoint=process.env.PENSION_DAILY_FEED_URL;
const token=process.env.PENSION_DAILY_FEED_TOKEN;
if(!endpoint){console.error('PENSION_DAILY_FEED_URL 미설정: 연기금 공식 일별 수급 소스 연결 전까지 갱신 중지');process.exit(2);}
const url=new URL(endpoint);
if(url.protocol!=='https:')throw Error('HTTPS source required');
const headers={Accept:'application/json'};
if(token)headers.Authorization='Bearer '+token;
const res=await fetch(url,{headers,signal:AbortSignal.timeout(25000),redirect:'error'});
if(!res.ok)throw Error('Daily feed HTTP '+res.status);
const body=await res.json();
// Read-only feed from the existing LS Worker, based on post-15:50 KST t1511/t1601 snapshots.
// The KRX 20:00 consolidated figures may later differ from the LS post-close snapshot.
const {date,kospiClose,pensionNetBuyBillion,regularSessionClosed,source,pensionUnit,observedAt}=body;
if(regularSessionClosed!==true||source!=='LS증권 KRX t1511 + t1601(기금 06)'||pensionUnit!=='십억원'||typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt))||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Unverified LS regular-session close or invalid date');
const observedKst = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(observedAt));
const observedTime = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(observedAt));
if(observedKst!==date||observedTime<'15:50')throw Error('Intraday or mismatched LS data');
if(!Number.isFinite(kospiClose)||kospiClose<=0||kospiClose>100000||!Number.isFinite(pensionNetBuyBillion)||Math.abs(pensionNetBuyBillion)>100000)throw Error('Invalid final KOSPI / pension flow or unit');
if(current.schemaVersion!==1||current.pensionUnit!=='십억원'||!Array.isArray(current.rows))throw Error('Existing data schema invalid');
const last=current.rows.at(-1);
if(date<last[0]){console.log('Historical day ignored: '+date);process.exit(0);}
if(date===last[0]){
 if(last[1]!==kospiClose||last[2]!==pensionNetBuyBillion)throw Error('Historical final data conflict; manual reconciliation required');
 console.log('No new trading day');process.exit(0);
}
const previousDate=new Date(last[0]+'T00:00:00Z');
const newDate=new Date(date+'T00:00:00Z');
if(newDate-previousDate>12*86400000)throw Error('Gap exceeds 12 calendar days: backfill required');
current.rows.push([date,kospiClose,pensionNetBuyBillion]);
current.lastDate=date;
writeFileSync(path,JSON.stringify(current));
console.log('Added LS verified post-close day '+date+'; '+current.rows.length+' rows');
