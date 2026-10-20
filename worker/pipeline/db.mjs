export class Meter {
 constructor(now=new Date()){this.utcDate=now.toISOString().slice(0,10);this.rowsRead=0;this.rowsWritten=0;this.sizeAfter=null;this.queries=0;this.counters={};this.unknownMeta=0;}
 add(result){const meta=result?.meta;this.queries++;if(typeof meta?.rows_read==='number')this.rowsRead+=meta.rows_read;else this.unknownMeta++;if(typeof meta?.rows_written==='number')this.rowsWritten+=meta.rows_written;if(typeof meta?.size_after==='number')this.sizeAfter=meta.size_after;}
 count(key,n=1){this.counters[key]=(this.counters[key]||0)+n;}
 snapshot(){return {utcDate:this.utcDate,rowsRead:this.rowsRead,rowsWritten:this.rowsWritten,sizeAfter:this.sizeAfter,queries:this.queries,unknownMeta:this.unknownMeta,counters:{...this.counters}};}
}
/** Each instance is one invocation budget, inclusive of batches. Existing collector needs its own reserved budget. */
export class PipelineDB {
 constructor(db,meter=new Meter(),queryBudget=24){this.db=db;this.meter=meter;this.remaining=queryBudget;}
 reserve(n){if(n>this.remaining)throw Error('QUERY_BUDGET_EXCEEDED');this.remaining-=n;}
 async query(sql,params=[]){this.reserve(1);const r=await this.db.prepare(sql).bind(...params).all();if(r.success===false)throw Error('D1_QUERY_FAILED');this.meter.add(r);return r.results||[];}
 async batch(statements){this.reserve(statements.length);const result=await this.db.batch(statements.map(([sql,args=[]])=>this.db.prepare(sql).bind(...args)));for(const r of result){if(r.success===false)throw Error('D1_BATCH_FAILED');this.meter.add(r);}return result;}
 async flush(component){
  // One daily aggregate write per invocation, not per stock/query. Meta of this write is retained in the local meter.
  this.meter.count('metricFlushes');this.meter.count('unknownMeta',this.meter.unknownMeta);
  await this.query(`INSERT INTO pipeline_metrics VALUES(?,?,?,?,?,?) ON CONFLICT(utc_date,component) DO UPDATE SET rows_read=rows_read+excluded.rows_read,rows_written=rows_written+excluded.rows_written,size_after=excluded.size_after,counters_json=(SELECT json_group_object(key,total) FROM (SELECT key,SUM(value) AS total FROM (SELECT key,value FROM json_each(pipeline_metrics.counters_json) UNION ALL SELECT key,value FROM json_each(excluded.counters_json)) GROUP BY key))`,[this.meter.utcDate,component,this.meter.rowsRead,this.meter.rowsWritten,this.meter.sizeAfter,JSON.stringify(this.meter.counters)]);
 }
}
/** Scoped collector instrumentation. No SQL text, bound values, credentials or raw responses are logged. */
export function meteredD1(binding,meter){
 const unwrap=new WeakMap();
 function wrap(statement){
  const result={bind(...values){return wrap(statement.bind(...values));},async all(){const r=await statement.all();meter.add(r);return r;},async run(){const r=await statement.run();meter.add(r);return r;},async first(column){const r=await statement.all();meter.add(r);const row=r.results?.[0]??null;return column&&row?row[column]:row;}};
  unwrap.set(result,statement);return result;
 }
 return {prepare(sql){return wrap(binding.prepare(sql));},async batch(statements){const rows=await binding.batch(statements.map(s=>unwrap.get(s)||s));rows.forEach(r=>meter.add(r));return rows;}};
}
