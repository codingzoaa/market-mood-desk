import {readFile,writeFile} from 'node:fs/promises';
import {validateHistoricalCloseRecord} from '../worker/correlation-history.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/prepare-correlation-history-import.mjs verified-records.json output.json');
const parsed=JSON.parse(await readFile(input,'utf8')),raw=Array.isArray(parsed)?parsed:parsed.records;if(!Array.isArray(raw)||raw.length>31)throw Error('MONTH_RECORD_LIMIT');
const seen=new Map();for(const record of raw){const r=validateHistoricalCloseRecord(record,{from:'2026-10-01',to:'2026-10-19'});if(seen.has(r.date)&&JSON.stringify(seen.get(r.date))!==JSON.stringify(r))throw Error('CONFLICTING_HISTORY_DATE');seen.set(r.date,r);}
// Prepare reviewable parameterized statements only; never contact a provider or DB.
const statements=[...seen.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(record=>({sql:'INSERT OR IGNORE INTO state(id,payload) VALUES(?,?)',params:['correlation-history:'+(record.method==='LS_KOSPI_DAILY_V1'?'LS':'NAVER')+':KOSPI:'+record.date,JSON.stringify(record)]}));
await writeFile(output,JSON.stringify({month:'2026-10',records:statements.length,statements},null,2));console.log(JSON.stringify({preparedRecords:statements.length,providerCalls:0,databaseWrites:0}));
