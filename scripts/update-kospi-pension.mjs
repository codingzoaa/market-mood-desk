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
// Trusted feed contract: {date:"YYYY-MM-DD",kospiClose:5730.74,pensionNetBuyBillion:893,final:true}
// Source must provide final KRX regular-session pension flows, not intraday or inferred flows.
const {date,kospiClose,pensionNetBuyBillion,final}=body;
if(final!==true||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Missing verified final trading date');
if(!Number.isFinite(kospiClose)||kospiClose<=0||kospiClose>100000||!Number.isInteger(pensionNetBuyBillion)||Math.abs(pensionNetBuyBillion)>100000)throw Error('Invalid final KOSPI / pension flow or unit');
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
console.log('Added final KRX day '+date+'; '+current.rows.length+' rows');
