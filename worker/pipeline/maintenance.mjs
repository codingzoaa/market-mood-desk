import {PipelineDB,Meter} from './db.mjs';
import {prepareRvolDay} from './rvol.mjs';
import {kstDate,minute} from './util.mjs';
/** Future approved pre-open Cron must call this handler; current production Cron is unchanged. */
export async function preopenMaintenance(env,now=new Date().toISOString()){
 if(env.ENABLE_HISTORY_PIPELINE!=='true'||minute(now)>='0900')return {enabled:false};
 const db=new PipelineDB(env.DB,new Meter(new Date(now)),12);
 try{const result=await prepareRvolDay(db,{target:kstDate(now),cutoff:now});await db.flush('preopen');return {...result,metrics:db.meter.snapshot()};}
 catch{db.meter.count('preopenFailures');try{await db.flush('preopen');}catch{}return {ready:false,error:'BASELINE_UNAVAILABLE',metrics:db.meter.snapshot()};}
}
