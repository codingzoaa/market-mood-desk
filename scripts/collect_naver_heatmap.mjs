import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {collectNaverHeatmap,naverJson} from '../worker/naver-heatmap.mjs';
import {kst} from '../worker/ls.mjs';
// Bootstrap uses the same parser and completeness checks as the Worker. It
// writes one isolated heatmap record; no LS quote or flow field is modified.
const date=kst().date;
const dashboardResponse=await fetch('https://market-note-ls-api.kby0991.workers.dev/api/dashboard?date='+date,{redirect:'error',signal:AbortSignal.timeout(20000)});
if(!dashboardResponse.ok)throw Error('NAVER_TRADING_DAY_UNVERIFIED');
const dashboard=await dashboardResponse.json();
if(dashboard.schemaVersion!==2||!dashboard.snapshots?.some(x=>x.date===date&&String(x.source).startsWith('LS증권 KRX'))){console.log(JSON.stringify({skipped:true,date,reason:'NO_VERIFIED_TRADING_DAY'}));process.exit(0);}
const store=new Map();
const env={DB:{prepare(sql){let args;return {bind(...values){args=values;return this;},async first(){if(sql.startsWith('SELECT date FROM snapshots'))return {date};return store.has(args[0])?{payload:store.get(args[0])}:null;},async run(){if(sql.startsWith('DELETE'))store.delete(args[0]);else store.set(args[0],args[1]);return {success:true};}};}}};
let result,calls=0;
const fetcher=async path=>{calls++;if(calls>180)throw Error('NAVER_REQUEST_LIMIT');const response=await naverJson(path);await new Promise(r=>setTimeout(r,150));return response;};
for(let round=0;round<10;round++){result=await collectNaverHeatmap(env,date,{fetcher});if(result.complete)break;console.log(JSON.stringify({round:round+1,loaded:result.loaded}));}
if(!result?.complete)throw Error('NAVER_BOOTSTRAP_INCOMPLETE');
const heatmap=result.heatmap;
await fs.mkdir('work',{recursive:true});
const json=JSON.stringify(heatmap);
await fs.writeFile('work/naver-heatmap.json',json);
const baseline={date,asOf:heatmap.asOf,sha256:createHash('sha256').update(json).digest('hex'),gzipBase64:gzipSync(json).toString('base64')};
await fs.writeFile('src/data/naver-heatmap-baseline.json',JSON.stringify(baseline)+'\n');
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'ready=true\n');
console.log(JSON.stringify({date,asOf:heatmap.asOf,industries:heatmap.industryCount,stocks:heatmap.stocks.length,KOSPI:heatmap.stocks.filter(x=>x.market==='KOSPI').length,KOSDAQ:heatmap.stocks.filter(x=>x.market==='KOSDAQ').length,requests:calls}));
