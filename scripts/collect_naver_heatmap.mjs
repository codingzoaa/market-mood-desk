import fs from 'node:fs/promises';
import {collectNaverHeatmap,naverJson} from '../worker/naver-heatmap.mjs';
import {kst} from '../worker/ls.mjs';
// Bootstrap uses the same parser and completeness checks as the Worker. It
// writes one isolated heatmap record; no LS quote or flow field is modified.
const store=new Map();
const env={DB:{prepare(sql){let args;return {bind(...values){args=values;return this;},async first(){return store.has(args[0])?{payload:store.get(args[0])}:null;},async run(){if(sql.startsWith('DELETE'))store.delete(args[0]);else store.set(args[0],args[1]);return {success:true};}};}}};
const date=kst().date;let result,calls=0;
const fetcher=async path=>{calls++;if(calls>180)throw Error('NAVER_REQUEST_LIMIT');const response=await naverJson(path);await new Promise(r=>setTimeout(r,150));return response;};
for(let round=0;round<10;round++){result=await collectNaverHeatmap(env,date,{fetcher});if(result.complete)break;console.log(JSON.stringify({round:round+1,loaded:result.loaded}));}
if(!result?.complete)throw Error('NAVER_BOOTSTRAP_INCOMPLETE');
const heatmap=result.heatmap;
await fs.mkdir('work',{recursive:true});
await fs.writeFile('work/naver-heatmap.json',JSON.stringify(heatmap));
console.log(JSON.stringify({date,asOf:heatmap.asOf,industries:heatmap.industryCount,stocks:heatmap.stocks.length,KOSPI:heatmap.stocks.filter(x=>x.market==='KOSPI').length,KOSDAQ:heatmap.stocks.filter(x=>x.market==='KOSDAQ').length,requests:calls}));
