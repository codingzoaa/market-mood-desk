import {PipelineDB,Meter} from './db.mjs';
import {loadHistory} from './history.mjs';
import {readBaselines} from './rvol.mjs';
import {loadReplay} from './replay.mjs';
import {loadArchivedReplay} from './replay-archive.mjs';
import {validDate,stamp,slots,ensure} from './util.mjs';
/** Read-only stored-data API. No provider fetch, collection wake, backfill, cache fill or D1 write. */
export async function pipelineRead(request,env){
 if(env.ENABLE_HISTORY_PIPELINE!=='true')return {status:404,data:{error:'NOT_FOUND'}};
 if(request.method!=='GET')return {status:405,data:{error:'METHOD_NOT_ALLOWED'}};
 const u=new URL(request.url),p=u.searchParams,db=new PipelineDB(env.DB,new Meter(),8);
 try{
  let data;
  if(u.pathname==='/api/history')data={rows:await loadHistory(db,{symbol:p.get('symbol'),from:p.get('from'),to:p.get('to'),slot:p.get('slot')||undefined,limit:Number(p.get('limit')||4000)})};
  else if(u.pathname==='/api/rvol'){
   const target=p.get('date'),cutoff=p.get('asOf'),slot=p.get('slot');ensure(validDate(target)&&stamp(cutoff)&&slots.includes(slot),'INVALID_QUERY');data=await readBaselines(db,{target,cutoff,slot,symbols:(p.get('symbols')||'').split(',')});
  }else if(u.pathname==='/api/replay'){
   const key={date:p.get('date'),asOf:p.get('asOf'),mode:p.get('mode'),version:p.get('version')};ensure(validDate(key.date)&&stamp(key.asOf)&&['INTRADAY','EOD'].includes(key.mode)&&key.version?.length>0&&key.version.length<=100,'INVALID_QUERY');
   data=await loadReplay(db,key);
   if(!data&&env.ENABLE_R2_ARCHIVE==='true'&&env.HISTORY_ARCHIVE)data=await loadArchivedReplay(db,env.HISTORY_ARCHIVE,key);
  }else return {status:404,data:{error:'NOT_FOUND'}};
  return {status:200,data:{data,metrics:db.meter.snapshot()}};
 }catch{return {status:400,data:{error:'PIPELINE_QUERY_UNAVAILABLE'}};}
}
