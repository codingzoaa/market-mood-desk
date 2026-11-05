import {hash,gunzip,ensure,iso,kstDate} from './util.mjs';
async function verifyObject(bucket,key,digest,meter){meter.count('r2Get');const obj=await bucket.get(key);ensure(obj,'REPLAY_ARCHIVE_MISSING');const bytes=new Uint8Array(await obj.arrayBuffer());let text;try{text=new TextDecoder().decode(await gunzip(bytes));}catch{throw Error('REPLAY_ARCHIVE_HASH');}ensure(await hash(text)===digest,'REPLAY_ARCHIVE_HASH');return JSON.parse(text);}
export async function archiveReplay(db,bucket,{date,asOf,mode,version,now=new Date().toISOString()}){
 ensure(bucket&&date<kstDate(now),'REPLAY_DAY_NOT_CLOSED');
 const frames=await db.query('SELECT * FROM replay_frames WHERE date=? AND as_of=? AND mode=? AND version=?',[date,iso(asOf),mode,version]);ensure(frames.length===1,'REPLAY_FRAME_MISSING');const frame=frames[0];
 const contexts=await db.query('SELECT * FROM replay_contexts WHERE hash=?',[frame.context_hash]);ensure(contexts.length===1,'REPLAY_CONTEXT_MISSING');const context=contexts[0];
 const contextKey=`replay/contexts/${frame.context_hash}.json.gz`,key=`replay/${date}/${frame.sha256}.json.gz`;
 for(const [objectKey,payload,digest] of [[contextKey,context.payload,frame.context_hash],[key,frame.payload,frame.sha256]]){
  db.meter.count('r2Head');if(!await bucket.head(objectKey)){db.meter.count('r2Put');await bucket.put(objectKey,payload);db.meter.count('r2ObjectsCreated');}
  await verifyObject(bucket,objectKey,digest,db.meter);
 }
 await db.query('INSERT OR IGNORE INTO replay_archives VALUES(?,?,?,?,?,?,?,?,?)',[date,iso(asOf),mode,version,key,frame.sha256,contextKey,frame.context_hash,iso(now)]);
 return {verified:true,key,contextKey};
}
export async function loadArchivedReplay(db,bucket,{date,asOf,mode,version}){
 const records=await db.query('SELECT * FROM replay_archives WHERE date=? AND as_of=? AND mode=? AND version=?',[date,iso(asOf),mode,version]);if(!records.length)return null;const r=records[0];
 const body=await verifyObject(bucket,r.object_key,r.sha256,db.meter),ctx=await verifyObject(bucket,r.context_key,r.context_hash,db.meter);ensure(body.contextHash===r.context_hash,'REPLAY_CONTEXT_MISMATCH');
 return {...body,shared:{...body.shared,calendar:ctx.calendar,quotes:body.shared.quotes.map(q=>({...q,history:ctx.histories[q.symbol]})),benchmarks:Object.fromEntries(Object.entries(body.shared.benchmarks).map(([m,q])=>[m,{...q,history:ctx.benchmarkHistories[m]}]))}};
}
