import {estimate} from './costs.mjs';
import {ensure} from './util.mjs';
export const HISTORY_DAILY_WRITE_LIMIT=70000;
/** Conservative application-local forecast, not an account-wide Cloudflare quota oracle.
 * Atomic reservations cover optional raw writes even if their metrics flush later fails.
 * Non-capture actual writes replace (rather than add to) the 4k core allowance.
 * The whole day's maintenance, daily bars, metrics and raw index writes and expiration deletes are reserved.
 */
export async function reserveHistoryWrites(db,{rows,limit=HISTORY_DAILY_WRITE_LIMIT}={}){
 ensure(Number.isInteger(rows)&&rows>=0&&rows<=1000&&limit===HISTORY_DAILY_WRITE_LIMIT,'INVALID_WRITE_RESERVATION');
 const model=estimate({stocks:100}),rawDaily=100*79*4,coreAllowance=model.assumptions.baseWritesPerDay;
 const maintenance=model.daily.rowsWritten-rawDaily-coreAllowance;
 const charge=rows*2+3,utc=db.meter.utcDate;
 // Single statement serializes concurrent collectors. Do not trust a caller-provided forecast.
 const result=await db.query(`INSERT INTO history_write_budget(utc_date,reserved)
 SELECT ?,? WHERE MAX(?,?)+MAX(?,COALESCE((SELECT SUM(rows_written) FROM pipeline_metrics WHERE utc_date=? AND component<>'capture'),0))+?<=?
 ON CONFLICT(utc_date) DO UPDATE SET reserved=reserved+excluded.reserved
 WHERE MAX(?,history_write_budget.reserved+excluded.reserved)+MAX(?,COALESCE((SELECT SUM(rows_written) FROM pipeline_metrics WHERE utc_date=? AND component<>'capture'),0))+?<=?
 RETURNING reserved`,[utc,charge,rawDaily,charge,coreAllowance,utc,maintenance,limit,rawDaily,coreAllowance,utc,maintenance,limit]);
 const allowed=result.length===1;
 return {allowed,warning:allowed?null:'EXPECTED_D1_WRITES_EXCEED_70000',limit,reserved:result[0]?.reserved??null};
}
