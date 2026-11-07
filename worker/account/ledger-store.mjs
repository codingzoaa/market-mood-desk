import {check,opaqueID,seal,open} from './security.mjs';
export async function saveLedger(env,rows){
 check(Array.isArray(rows)&&rows.length<=100,'LEDGER_PAGE_LIMIT');const seen=new Map();
 for(const row of rows){const id=await opaqueID(env,'ledger:'+row.accountRef+':'+row.date+':'+row.id),value=JSON.stringify(row);check(!seen.has(id)||seen.get(id).value===value,'LEDGER_PAGE_CONFLICT');seen.set(id,{value,row});}
 const ids=[...seen.keys()],old=ids.length?(await env.PRIVATE_DB.prepare('SELECT id,revision FROM account_ledger WHERE id IN(SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()).results:[],previous=new Map(old.map(r=>[r.id,r.revision])),entries=[];
 for(const [id,{value,row}] of seen){const revision=await opaqueID(env,'ledger-revision:'+value);if(previous.get(id)===revision)continue;entries.push({id,revision,payload:await seal(env,row,'ledger:'+id+':'+revision)});}
 if(entries.length){const body=JSON.stringify(entries);check(new TextEncoder().encode(body).length<1500000,'LEDGER_BYTES_LIMIT');const select="SELECT json_extract(value,'$.id'),json_extract(value,'$.revision'),json_extract(value,'$.payload') FROM json_each(?)";
  await env.PRIVATE_DB.batch([
   env.PRIVATE_DB.prepare('INSERT OR IGNORE INTO account_ledger_versions '+select).bind(body),
   env.PRIVATE_DB.prepare('INSERT INTO account_ledger '+select+' WHERE 1 ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload').bind(body)
  ]);
 }
 return {received:rows.length,newRows:entries.filter(e=>!previous.has(e.id)).length,revisions:entries.filter(e=>previous.has(e.id)).length};
}
export async function loadLedger(env){const rows=(await env.PRIVATE_DB.prepare('SELECT id,revision,payload FROM account_ledger LIMIT 10001').all()).results;check(rows.length<=10000,'ANALYSIS_CAPACITY_LIMIT');const result=[];for(const row of rows)result.push(await open(env,row.payload,'ledger:'+row.id+':'+row.revision));return result;}
