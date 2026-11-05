import {reserveHistoryWrites} from './write-budget.mjs';
import {hash} from './util.mjs';
import {loadArchivedReplay} from './replay-archive.mjs';
import {ensure,validDate} from './util.mjs';
export async function pruneHistory(db,{target,verifiedDays,r2Enabled=false,bucket=null,limit=1000}){
 ensure(validDate(target)&&Array.isArray(verifiedDays)&&new Set(verifiedDays).size===verifiedDays.length&&verifiedDays.every(validDate)&&Number.isInteger(limit)&&limit>0&&limit<=5000,'INVALID_RETENTION_PLAN');
 const days=verifiedDays.filter(d=>d<target).sort(),keep=20;
 if(days.length<=keep)return {deleted:0,retainedTradingDays:keep};const cutoff=days.at(-keep);
 // R2 mode fails closed: only sealed dates with verified manifest/count can be pruned.
 const candidates=await db.query(`SELECT h.date ${r2Enabled?',a.object_key,a.sha256':''} FROM history_days h ${r2Enabled?'JOIN archive_days a ON a.date=h.date':''} WHERE h.date<? AND EXISTS(SELECT 1 FROM history_5m r WHERE r.date=h.date) ${r2Enabled?'AND h.sealed=1 AND EXISTS(SELECT 1 FROM history_5m r WHERE r.date=h.date)':''} ORDER BY h.date LIMIT 1`,[cutoff]);
 if(!candidates.length)return {deleted:0,retainedTradingDays:keep};const date=candidates[0].date;
 if(r2Enabled){try{ensure(bucket,'ARCHIVE_BUCKET_UNAVAILABLE');db.meter.count('r2Get');const object=await bucket.get(candidates[0].object_key);ensure(object&&await hash(await object.text())===candidates[0].sha256,'MANIFEST_VERIFICATION_FAILED');}catch{return {deleted:0,error:'ARCHIVE_UNAVAILABLE'};}}
 const keys=await db.query('SELECT symbol,slot FROM history_5m WHERE date=? ORDER BY symbol,slot LIMIT ?',[date,Math.min(limit,1000)]);
 const guard=await reserveHistoryWrites(db,{rows:keys.length});if(!guard.allowed){db.meter.count('historyWriteLimitWarnings');return {deleted:0,error:'HISTORY_WRITE_LIMIT'};}
 const results=await db.batch([[`DELETE FROM history_5m WHERE date=? AND (symbol,slot) IN(SELECT json_extract(value,'$.symbol'),json_extract(value,'$.slot') FROM json_each(?))`,[date,JSON.stringify(keys)]]]);
 return {deleted:results[0].meta?.changes??null,date,retainedTradingDays:keep};
}
export async function pruneAnalysis(db,{target,verifiedDays,r2Enabled=false,bucket=null,limit=100}){
 ensure(validDate(target)&&Array.isArray(verifiedDays)&&new Set(verifiedDays).size===verifiedDays.length&&verifiedDays.every(validDate)&&Number.isInteger(limit)&&limit>0&&limit<=1000,'INVALID_RETENTION_PLAN');
 const days=verifiedDays.filter(d=>d<target).sort();if(days.length<=30)return {done:true};const cutoff=days.at(-30);
 let keys=[];
 if(r2Enabled){
  if(!bucket)return {changes:[],error:'ARCHIVE_UNAVAILABLE'};
  const frames=await db.query('SELECT f.date,f.as_of,f.mode,f.version FROM replay_frames f WHERE f.date<? AND EXISTS(SELECT 1 FROM replay_archives a WHERE a.date=f.date AND a.as_of=f.as_of AND a.mode=f.mode AND a.version=f.version AND a.sha256=f.sha256 AND a.context_hash=f.context_hash) ORDER BY f.date LIMIT 1',[cutoff]);
  for(const f of frames){try{if(await loadArchivedReplay(db,bucket,{date:f.date,asOf:f.as_of,mode:f.mode,version:f.version}))keys.push([f.date,f.as_of,f.mode,f.version]);}catch{return {changes:[],error:'ARCHIVE_UNAVAILABLE'};}}
 }
 const result=await db.batch([
  [`DELETE FROM rvol_baselines WHERE (target_date,symbol,slot,version) IN(SELECT target_date,symbol,slot,version FROM rvol_baselines WHERE target_date<? LIMIT ?)`,[cutoff,limit]],
  [r2Enabled?`DELETE FROM replay_frames WHERE (date,as_of,mode,version) IN(SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]') FROM json_each(?))`:`DELETE FROM replay_frames WHERE (date,as_of,mode,version) IN(SELECT date,as_of,mode,version FROM replay_frames WHERE date<? LIMIT ?)`,r2Enabled?[JSON.stringify(keys)]:[cutoff,limit]],
  [`DELETE FROM replay_contexts WHERE hash IN(SELECT c.hash FROM replay_contexts c WHERE NOT EXISTS(SELECT 1 FROM replay_frames f WHERE f.context_hash=c.hash) LIMIT ?)`,[limit]],
 ]);return {changes:result.map(r=>r.meta?.changes??null)};
}
