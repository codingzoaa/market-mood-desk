import {check,seal,open,opaqueID} from './security.mjs';
export function normalizeTrade(raw){
 const {id,accountRef,date,time,symbol,name,side,sequence,quantity,price,grossKRW,feeKRW,taxKRW}=raw;
 check(typeof id==='string'&&id.length>0&&id.length<=160&&typeof accountRef==='string'&&accountRef.length>0&&accountRef.length<=80,'INVALID_TRADE_ID');
 check(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date&&/^\d{2}:\d{2}:\d{2}$/.test(time)&&Number(time.slice(0,2))<24&&Number(time.slice(3,5))<60&&Number(time.slice(6))<60,'INVALID_TRADE_TIME');
 check(/^[0-9A-Z]{6}$/.test(symbol)&&typeof name==='string'&&name.length>0&&name.length<=80&&['BUY','SELL'].includes(side),'INVALID_TRADE');
 check(Number.isSafeInteger(sequence)&&sequence>=0,'INVALID_TRADE_SEQUENCE');
 check([quantity,price,grossKRW,feeKRW,taxKRW].every(Number.isSafeInteger)&&quantity>0&&price>0&&grossKRW>0&&quantity<=100000000&&price<=1000000000&&feeKRW>=0&&taxKRW>=0&&feeKRW+taxKRW<=grossKRW&&quantity*price===grossKRW,'INVALID_TRADE_AMOUNT');
 return {id,accountRef,date,time,symbol,name,side,sequence,quantity,price,grossKRW,feeKRW,taxKRW};
}
export async function saveTrades(env,rawRows){
 check(Array.isArray(rawRows)&&rawRows.length<=100,'TRADE_BATCH_LIMIT');
 const normalized=rawRows.map(normalizeTrade),seen=new Map();
 for(const row of normalized){const id=await opaqueID(env,row.accountRef+':'+row.date+':'+row.id);check(!seen.has(id)||JSON.stringify(seen.get(id))===JSON.stringify(row),'DUPLICATE_TRADE_CONFLICT');seen.set(id,row);}
 const entries=[],ids=[...seen.keys()];
 const existing=ids.length?(await env.PRIVATE_DB.prepare('SELECT id,payload FROM account_trades WHERE id IN(SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()).results:[];
 const existingMap=new Map(existing.map(row=>[row.id,row.payload]));
 for(const [id,row] of seen){const old=existingMap.get(id);if(old){check(JSON.stringify(await open(env,old,'trade:'+id))===JSON.stringify(row),'STORED_TRADE_CONFLICT');continue;}entries.push({id,payload:await seal(env,row,'trade:'+id)});}
 if(entries.length)await env.PRIVATE_DB.prepare("INSERT OR IGNORE INTO account_trades SELECT json_extract(value,'$.id'),json_extract(value,'$.payload') FROM json_each(?)").bind(JSON.stringify(entries)).run();return {received:normalized.length,newRows:entries.length};
}
export async function loadTrades(env){
 const rows=await env.PRIVATE_DB.prepare('SELECT id,payload FROM account_trades LIMIT 10001').all();check(rows.results.length<=10000,'ANALYSIS_CAPACITY_LIMIT');
 const trades=[];for(const row of rows.results)trades.push(await open(env,row.payload,'trade:'+row.id));return trades;
}
export async function readState(env,id){const row=await env.PRIVATE_DB.prepare('SELECT payload FROM account_state WHERE id=?').bind(id).first();return row?open(env,row.payload,'state:'+id):null;}
export async function writeState(env,id,data){await env.PRIVATE_DB.prepare('INSERT INTO account_state VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,await seal(env,data,'state:'+id)).run();}
