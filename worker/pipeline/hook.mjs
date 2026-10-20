import {PipelineDB,Meter} from './db.mjs';
import {reserveHistoryWrites} from './write-budget.mjs';
import {priorSessions} from './rvol.mjs';
import {pruneHistory} from './retention.mjs';
import {safeCapture} from './history.mjs';
/** Invoked only after the original latest-snapshot commit succeeds. All failures are isolated. */
export async function captureAfterLatest(env,snapshot,observedAt,trCounts={},availableAt=new Date().toISOString()){
 if(env.ENABLE_HISTORY_PIPELINE!=='true')return {enabled:false};
 const meter=new Meter(new Date(availableAt)),db=new PipelineDB(env.DB,meter,12);
 for(const [tr,count] of Object.entries(trCounts))meter.count('lsTR:'+tr,count);
 let result;
 try{
  const guard=await reserveHistoryWrites(db,{rows:Math.min(100,snapshot.stocks.length)});
  if(!guard.allowed){meter.count('historyWriteLimitWarnings');console.warn('HISTORY_WRITE_LIMIT: optional history skipped; latest quotes already saved');result={ok:false,error:'HISTORY_WRITE_LIMIT',warning:guard.warning};}
  else {
   result=await safeCapture(db,snapshot,observedAt,availableAt);
   if(result.ok)try{
    const verifiedDays=await priorSessions(db,snapshot.date,availableAt,21);
    result.retention=await pruneHistory(db,{target:snapshot.date,verifiedDays,r2Enabled:env.ENABLE_R2_ARCHIVE==='true',bucket:env.HISTORY_ARCHIVE||null});
    if(result.retention.error)meter.count('retentionWarnings');
   }catch{meter.count('retentionDeferred');result.retention={error:'VERIFIED_RETENTION_UNAVAILABLE'};}
  }
  await db.flush('capture');
 }
 catch{meter.count('pipelineFailures');result={ok:false,error:'PIPELINE_STORAGE_FAILED'};}
 return {...result,metrics:meter.snapshot()};
}
export async function persistCollectorMetrics(env,meter,component,trCounts){
 if(env.ENABLE_HISTORY_PIPELINE!=='true')return;
 for(const [tr,count] of Object.entries(trCounts))meter.count('lsTR:'+tr,count);
 try{const db=new PipelineDB(env.DB,meter,1);await db.flush(component);}catch{/* Telemetry is never a collection failure. */}
}
