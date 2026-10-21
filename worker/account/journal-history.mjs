import {check,opaqueID,seal} from './security.mjs';
import {readState} from './store.mjs';
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const dayID=async(env,date)=>'journalDay:'+await opaqueID(env,'journal-day:'+date);
/** Caller holds account sync lease. Day and encrypted date index commit in one SQL statement. */
export async function saveJournalDay(env,snapshot){
 check(snapshot?.complete===true&&validDate(snapshot.date)&&Number.isFinite(Date.parse(snapshot.asOf))&&Array.isArray(snapshot.rows),'JOURNAL_ARCHIVE_INVALID');
 const id=await dayID(env,snapshot.date),old=await readState(env,id),index=await readState(env,'journalDates'),dates=index?.dates||[];
 check(Array.isArray(dates)&&dates.every(validDate)&&dates.length<=20000,'JOURNAL_ARCHIVE_INDEX_INVALID');
 const entries=[];
 if(!old||Date.parse(snapshot.asOf)>Date.parse(old.asOf)||!Number.isFinite(Date.parse(old.asOf))){
  entries.push({id,payload:await seal(env,snapshot,'state:'+id)});
 }
 if(!dates.includes(snapshot.date)){
  check(dates.length<20000,'JOURNAL_ARCHIVE_CAPACITY');
  entries.push({id:'journalDates',payload:await seal(env,{version:1,dates:[...dates,snapshot.date].sort().reverse()},'state:journalDates')});
 }
 if(entries.length)await env.PRIVATE_DB.prepare("INSERT INTO account_state(id,payload) SELECT json_extract(value,'$.id'),json_extract(value,'$.payload') FROM json_each(?) WHERE true ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind(JSON.stringify(entries)).run();
 return {saved:entries.length>0};
}
export async function migrateJournalHistory(env){
 // Compatibility copies remain intact for safe rollback. No provider requests.
 for(const key of ['journalPrevious','journal']){const snapshot=await readState(env,key);if(snapshot?.complete&&validDate(snapshot.date))await saveJournalDay(env,snapshot);}
}
export async function journalHistory(env,selected){
 check(!selected||validDate(selected),'INVALID_DATE');
 const index=await readState(env,'journalDates'),legacy=(await Promise.all(['journalPrevious','journal'].map(k=>readState(env,k)))).filter(s=>s?.complete&&validDate(s.date));
 const dates=[...new Set([...(index?.dates||[]),...legacy.map(s=>s.date)])].sort().reverse();
 const date=selected||dates[0]||null;
 const archived=date?await readState(env,await dayID(env,date)):null;
 const entry=[archived,...legacy.filter(s=>s.date===date)].filter(Boolean).sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf))[0]||null;
 return {dates,selectedDate:date,entry};
}
