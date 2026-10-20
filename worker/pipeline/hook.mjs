import {PipelineDB,Meter} from './db.mjs';
import {safeCapture} from './history.mjs';
/** Invoked only after the original latest-snapshot commit succeeds. All failures are isolated. */
export async function captureAfterLatest(env,snapshot,observedAt,trCounts={},availableAt=new Date().toISOString()){
 if(env.ENABLE_HISTORY_PIPELINE!=='true')return {enabled:false};
 const meter=new Meter(new Date(availableAt)),db=new PipelineDB(env.DB,meter,12);
 for(const [tr,count] of Object.entries(trCounts))meter.count('lsTR:'+tr,count);
 let result;
 try{result=await safeCapture(db,snapshot,observedAt,availableAt);await db.flush('capture');}
 catch{meter.count('pipelineFailures');result={ok:false,error:'PIPELINE_STORAGE_FAILED'};}
 return {...result,metrics:meter.snapshot()};
}
export async function persistCollectorMetrics(env,meter,component,trCounts){
 if(env.ENABLE_HISTORY_PIPELINE!=='true')return;
 for(const [tr,count] of Object.entries(trCounts))meter.count('lsTR:'+tr,count);
 try{const db=new PipelineDB(env.DB,meter,1);await db.flush(component);}catch{/* Telemetry is never a collection failure. */}
}
