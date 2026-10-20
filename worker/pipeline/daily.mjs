import {ensure,validDate,stamp,iso,kstDate} from './util.mjs';
/** Ingest already obtained, confirmed daily bars. No upstream calls or inferred OHLC. */
export async function storeDailyBars(db,bars){
 ensure(Array.isArray(bars)&&bars.length<=100,'DAILY_BATCH_LIMIT');
 const normalized=bars.map(({symbol,date,availableAt,source,version,close,open,high,low,turnoverKRW,final,adjusted})=>{
  ensure(/^(\d{6}|KOSPI|KOSDAQ)$/.test(symbol)&&validDate(date)&&stamp(availableAt)&&kstDate(availableAt)>=date&&typeof source==='string'&&source.length>0&&source.length<=100&&typeof version==='string'&&version.length>0&&version.length<=100&&final===true&&typeof adjusted==='boolean','INVALID_DAILY_BAR');
  ensure([close,open,high,low].every(x=>Number.isFinite(x)&&x>0)&&low<=Math.min(open,close)&&high>=Math.max(open,close)&&Number.isSafeInteger(turnoverKRW)&&turnoverKRW>=0,'INVALID_DAILY_VALUES');
  return {symbol,date,available_at:iso(availableAt),source,version,payload:JSON.stringify({date,availableAt:iso(availableAt),source,close,open,high,low,turnoverKRW,final,adjusted})};
 });
 if(!normalized.length)return;
 await db.batch([[`INSERT OR IGNORE INTO daily_bars SELECT json_extract(value,'$.symbol'),json_extract(value,'$.date'),json_extract(value,'$.available_at'),json_extract(value,'$.source'),json_extract(value,'$.version'),json_extract(value,'$.payload') FROM json_each(?)`,[JSON.stringify(normalized)]]]);
}
/** Known-at selection prevents subsequently corrected daily bars leaking into old scores. */
export async function loadDailyBars(db,{symbol,target,asOf,limit=90}){
 ensure(/^(\d{6}|KOSPI|KOSDAQ)$/.test(symbol)&&validDate(target)&&stamp(asOf)&&Number.isInteger(limit)&&limit>=60&&limit<=90,'INVALID_DAILY_QUERY');
 const rows=await db.query(`SELECT payload FROM (SELECT date,payload,ROW_NUMBER() OVER(PARTITION BY date ORDER BY available_at DESC,version DESC) AS n FROM daily_bars WHERE symbol=? AND date<? AND available_at<=?) WHERE n=1 ORDER BY date DESC LIMIT ?`,[symbol,target,iso(asOf),limit]);
 return rows.reverse().map(r=>JSON.parse(r.payload));
}
/** Independently retain previous90 verified sessions + today, enough for60-day inputs and30-day replay. */
export async function pruneDailyBars(db,{target,verifiedDays,limit=1000}){
 ensure(validDate(target)&&Array.isArray(verifiedDays)&&verifiedDays.every(validDate)&&new Set(verifiedDays).size===verifiedDays.length&&Number.isInteger(limit)&&limit>0&&limit<=1000,'INVALID_DAILY_RETENTION');
 const days=verifiedDays.filter(d=>d<target).sort();if(days.length<=90)return {deleted:0};
 const r=await db.batch([[`DELETE FROM daily_bars WHERE (symbol,date,available_at,version) IN(SELECT symbol,date,available_at,version FROM daily_bars WHERE date<? LIMIT ?)`,[days.at(-90),limit]]]);
 return {deleted:r[0].meta?.changes??null};
}
