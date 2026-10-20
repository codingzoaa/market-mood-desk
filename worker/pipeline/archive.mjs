import {canonical,hash,gzip,gunzip,validDate,kstDate,iso,ensure} from './util.mjs';
/** One bounded, resumable page per invocation. No manifest means no permission to delete. */
export async function archiveDay(db,bucket,{date,now=new Date().toISOString(),pageSize=500}){
 ensure(bucket&&validDate(date)&&date<kstDate(now)&&Number.isInteger(pageSize)&&pageSize>0&&pageSize<=1000,'ARCHIVE_NOT_CLOSED');
 const time=iso(now),lease=new Date(Date.parse(now)+60000).toISOString();
 await db.batch([['UPDATE history_days SET sealed=1 WHERE date=?',[date]],['INSERT OR IGNORE INTO archive_jobs(date) VALUES(?)',[date]]]);
 const day=await db.query('SELECT sealed FROM history_days WHERE date=?',[date]);ensure(day[0]?.sealed===1,'ARCHIVE_DAY_MISSING');
 const claim=await db.query('UPDATE archive_jobs SET lease_until=? WHERE date=? AND done=0 AND (lease_until IS NULL OR lease_until<=?) RETURNING *',[lease,date,time]);
 if(!claim.length){const jobs=await db.query('SELECT done FROM archive_jobs WHERE date=?',[date]);return {done:jobs[0]?.done===1,waiting:jobs[0]?.done!==1};}
 const job=claim[0];
 const rows=await db.query('SELECT * FROM history_5m WHERE date=? AND (symbol,slot)>(?,?) ORDER BY symbol,slot LIMIT ?',[date,job.cursor_symbol,job.cursor_slot,pageSize]);
 if(rows.length){
  const text=canonical(rows),digest=await hash(text),bytes=await gzip(text),key=`history/${date}/part-${String(job.next_part).padStart(4,'0')}-${digest}.json.gz`;
  db.meter.count('r2Head');const head=await bucket.head(key);
  if(!head){db.meter.count('r2Put');await bucket.put(key,bytes,{httpMetadata:{contentType:'application/gzip'},customMetadata:{sha256:digest,count:String(rows.length)}});db.meter.count('r2ObjectsCreated');}
  db.meter.count('r2Get');const read=await bucket.get(key);ensure(read,'ARCHIVE_READ_FAILED');const restored=await gunzip(new Uint8Array(await read.arrayBuffer()));ensure(await hash(restored)===digest&&JSON.parse(new TextDecoder().decode(restored)).length===rows.length,'ARCHIVE_VERIFICATION_FAILED');
  const max=rows.reduce((m,r)=>!m||r.available_at>m?r.available_at:m,null);
  await db.batch([
   ['INSERT OR IGNORE INTO archive_parts VALUES(?,?,?,?,?,?,?)',[date,job.next_part,key,digest,rows.length,bytes.length,max]],
   ['UPDATE archive_jobs SET cursor_symbol=?,cursor_slot=?,next_part=next_part+1,lease_until=NULL WHERE date=? AND lease_until=?',[rows.at(-1).symbol,rows.at(-1).slot,date,lease]],
  ]);
  if(rows.length===pageSize)return {done:false,processed:rows.length};
 }
 const parts=await db.query('SELECT * FROM archive_parts WHERE date=? ORDER BY part',[date]);
 const manifest={schemaVersion:1,date,source:'row-level LS TR provenance',timingBasis:'ROW_LEVEL',count:parts.reduce((s,p)=>s+p.row_count,0),maxAvailableAt:parts.reduce((m,p)=>!m||p.max_available_at>m?p.max_available_at:m,null),parts};
 const text=canonical(manifest),digest=await hash(text),key=`history/${date}/manifest-${digest}.json`;
 db.meter.count('r2Head');if(!await bucket.head(key)){db.meter.count('r2Put');await bucket.put(key,text,{customMetadata:{sha256:digest}});db.meter.count('r2ObjectsCreated');}db.meter.count('r2Get');const object=await bucket.get(key);ensure(object&&await hash(await object.text())===digest,'MANIFEST_VERIFICATION_FAILED');
 await db.batch([
  ['INSERT OR IGNORE INTO archive_days VALUES(?,?,?,?,?,?,?)',[date,key,digest,manifest.count,manifest.maxAvailableAt,time,text]],
  ['UPDATE archive_jobs SET done=1,lease_until=NULL WHERE date=?',[date]],
 ]);
 return {done:true,manifest};
}
