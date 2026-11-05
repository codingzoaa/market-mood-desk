import {validDate,stamp,iso,kstDate,minute,slotOf,slots,ensure} from './util.mjs';
/** History membership only; never mutate or narrow the dashboard snapshot. */
export function historyUniverse(stocks){
 const seen=new Set();
 return ['KOSPI','KOSDAQ'].flatMap(market=>stocks.filter(s=>s.market===market&&Number.isSafeInteger(s.turnoverKRW)&&s.turnoverKRW>=0)
  .sort((a,b)=>b.turnoverKRW-a.turnoverKRW||a.symbol.localeCompare(b.symbol))
  .filter(s=>{if(seen.has(s.symbol))return false;seen.add(s.symbol);return true;}).slice(0,50));
}
export function captureRows(snapshot,observedAt={},availableAt=new Date().toISOString()){
 ensure(validDate(snapshot.date)&&stamp(availableAt),'INVALID_CAPTURE');
 const seen=new Set();return historyUniverse(snapshot.stocks).map(s=>{
  const at=observedAt[s.symbol]||snapshot.asOf;
  ensure(/^\d{6}$/.test(s.symbol)&&!seen.has(s.symbol)&&['KOSPI','KOSDAQ'].includes(s.market),'INVALID_SYMBOL');seen.add(s.symbol);
  ensure(stamp(at)&&kstDate(at)===snapshot.date&&minute(at)>='0900'&&minute(at)<='1530'&&Date.parse(at)<=Date.parse(availableAt),'INVALID_CAPTURE_TIME');
  ensure(typeof s.name==='string'&&s.name.length>0&&s.name.length<=80&&typeof s.price==='number'&&Number.isFinite(s.price)&&s.price>0&&Number.isSafeInteger(s.turnoverKRW)&&s.turnoverKRW>=0&&s.turnoverKRW<=Number.MAX_SAFE_INTEGER/20,'INVALID_QUOTE');
  return {date:snapshot.date,symbol:s.symbol,slot:slotOf(at),observed_at:iso(at),available_at:iso(availableAt),source_quote_at:null,price:s.price,turnover_krw:s.turnoverKRW,market:s.market,name:s.name,source:'LS:t1463:KRX',timing_basis:'RECEIPT_TIME'};
 });
}
export async function insertHistory(db,rows){
 if(!rows.length)return;const date=rows[0].date;
 ensure(validDate(date)&&rows.every(r=>/^\d{6}$/.test(r.symbol)&&Number.isFinite(r.price)&&r.price>0&&Number.isSafeInteger(r.turnover_krw)&&r.turnover_krw>=0&&r.turnover_krw<=Number.MAX_SAFE_INTEGER/20&&stamp(r.observed_at)&&stamp(r.available_at)&&kstDate(r.observed_at)===date&&slotOf(r.observed_at)===r.slot&&Date.parse(r.available_at)>=Date.parse(r.observed_at)&&['KOSPI','KOSDAQ'].includes(r.market)&&['RECEIPT_TIME','SOURCE_TIME'].includes(r.timing_basis)),'INVALID_HISTORY_ROW');
 ensure(rows.length<=1000&&rows.every(r=>r.date===date&&slots.includes(r.slot)),'CAPTURE_LIMIT');
 const payload=JSON.stringify(rows);ensure(new TextEncoder().encode(payload).length<1500000,'CAPTURE_BYTES');
 // One JSON bind avoids the D1 100-bind limit; batch is atomic. First observation wins.
 const sealed=await db.query('SELECT sealed FROM history_days WHERE date=?',[date]);ensure(!sealed[0]?.sealed,'HISTORY_DAY_SEALED');
 await db.batch([
  ['INSERT OR IGNORE INTO history_days(date) VALUES(?)',[date]],
  [`INSERT OR IGNORE INTO history_5m SELECT json_extract(value,'$.date'),json_extract(value,'$.symbol'),json_extract(value,'$.slot'),json_extract(value,'$.observed_at'),json_extract(value,'$.available_at'),json_extract(value,'$.source_quote_at'),json_extract(value,'$.price'),json_extract(value,'$.turnover_krw'),json_extract(value,'$.market'),json_extract(value,'$.name'),json_extract(value,'$.source'),json_extract(value,'$.timing_basis') FROM json_each(?) WHERE (SELECT sealed FROM history_days WHERE date=?)=0`,[payload,date]],
 ]);
}
export async function safeCapture(db,snapshot,observedAt,availableAt){try{await insertHistory(db,captureRows(snapshot,observedAt,availableAt));return {ok:true};}catch{db.meter.count('captureFailures');return {ok:false,error:'HISTORY_CAPTURE_FAILED'};}}
export async function loadHistory(db,{symbol,from,to,slot,limit=2000}){
 ensure(/^\d{6}$/.test(symbol)&&validDate(from)&&validDate(to)&&from<=to&&Number.isInteger(limit)&&limit>0&&limit<=4000&&(!slot||slots.includes(slot)),'INVALID_HISTORY_QUERY');
 return db.query(`SELECT * FROM history_5m WHERE symbol=? ${slot?'AND slot=?':''} AND date>=? AND date<=? ORDER BY ${slot?'date':'date,slot'} LIMIT ?`,[symbol,...(slot?[slot]:[]),from,to,limit]);
}
