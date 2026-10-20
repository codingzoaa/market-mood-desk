import {VERSION,validDate,iso,kstDate,minute,ensure} from './util.mjs';
export async function priorSessions(db,target,cutoff,n=20){
 ensure(validDate(target)&&kstDate(cutoff)===target,'INVALID_TARGET');
 const current=await db.query('SELECT * FROM trading_sessions WHERE date=? AND is_open=1 AND known_at<=?',[target,iso(cutoff)]);ensure(current.length===1,'CALENDAR_UNVERIFIED');
 const days=await db.query('SELECT date FROM trading_sessions WHERE date<? AND is_open=1 AND known_at<=? ORDER BY date DESC LIMIT ?',[target,iso(cutoff),n]);
 ensure(days.length===n,'TRADING_DAYS_INSUFFICIENT');return days.map(d=>d.date).sort();
}
export async function prepareRvolDay(db,{target,cutoff,version=VERSION}){
 ensure(minute(cutoff)<'0900','BASELINE_NOT_PREOPEN');
 const existing=await db.query('SELECT * FROM rvol_days WHERE target_date=? AND version=?',[target,version]);
 if(existing[0]?.ready)return {ready:true,reused:true};
 const days=await priorSessions(db,target,cutoff);
 await db.batch([
  [`INSERT OR IGNORE INTO rvol_days(target_date,version,cutoff,days_json) VALUES(?,?,?,?)`,[target,version,iso(cutoff),JSON.stringify(days)]],
  [`INSERT OR IGNORE INTO rvol_baselines SELECT ?,symbol,slot,?,SUM(turnover_krw),COUNT(*),MIN(timing_basis) FROM history_5m WHERE date IN (SELECT value FROM json_each((SELECT days_json FROM rvol_days WHERE target_date=? AND version=?))) AND available_at<=(SELECT cutoff FROM rvol_days WHERE target_date=? AND version=?) AND (SELECT ready FROM rvol_days WHERE target_date=? AND version=?)=0 GROUP BY symbol,slot HAVING COUNT(DISTINCT timing_basis)=1`,[target,version,target,version,target,version,target,version]],
  ['UPDATE rvol_days SET ready=1 WHERE target_date=? AND version=?',[target,version]],
 ]);
 return {ready:true,reused:false};
}
export async function readBaselines(db,{target,symbols,slot,cutoff,version=VERSION}){
 ensure(validDate(target)&&symbols.length<=1000&&symbols.every(s=>/^\d{6}$/.test(s)),'INVALID_BASELINE_QUERY');
 const day=await db.query('SELECT * FROM rvol_days WHERE target_date=? AND version=? AND ready=1 AND cutoff<=?',[target,version,iso(cutoff)]);
 if(!day.length)return {day:null,rows:[],historyStatus:symbols.map(symbol=>({symbol,status:'BACKFILL_REQUIRED',validSamples:0,requiredSamples:20}))};
 const rows=await db.query(`SELECT * FROM rvol_baselines WHERE target_date=? AND version=? AND slot=? AND symbol IN(SELECT value FROM json_each(?))`,[target,version,slot,JSON.stringify([...new Set(symbols)])]);return {day:day[0],rows,historyStatus:[...new Set(symbols)].map(symbol=>{const samples=rows.find(r=>r.symbol===symbol)?.samples||0;return {symbol,status:samples===20?'READY':'BACKFILL_REQUIRED',validSamples:samples,requiredSamples:20};})};
}
