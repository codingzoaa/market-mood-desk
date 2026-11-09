import fs from 'node:fs/promises';
import {kst} from '../worker/ls.mjs';
import {NAVER_HEATMAP_REVISION,validateHeatmapCoverage} from '../worker/naver-heatmap.mjs';
const heatmap=JSON.parse(await fs.readFile('work/naver-heatmap.json','utf8'));
if(heatmap.date!==kst().date||heatmap.revision!==NAVER_HEATMAP_REVISION||!Number.isFinite(Date.parse(heatmap.asOf))||Date.parse(heatmap.asOf)>Date.now()+60000||kst(new Date(heatmap.asOf)).date!==heatmap.date)throw Error('NAVER_PUBLICATION_DATE');
validateHeatmapCoverage(heatmap.stocks,heatmap.industryCount);
const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('CLOUDFLARE_TOKEN_MISSING');
const endpoint='https://api.cloudflare.com/client/v4/accounts/78961f2ddb841df708b3a777fdcc94c2/d1/database/1fed3957-6d66-4ee4-8e46-835153d7b8e6/query';
// Bind the large JSON value as a parameter: D1 caps SQL text at100KB, so
// interpolating the complete map into a SQL literal would fail publication.
const sql="INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE COALESCE(json_extract(state.payload,'$.asOf'),'')<json_extract(excluded.payload,'$.asOf')";
for(const [key,payload] of [['naver-heatmap:'+heatmap.date,heatmap],['naver-heatmap-status',{date:heatmap.date,asOf:heatmap.asOf,error:null}]]){
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},redirect:'error',body:JSON.stringify({sql,params:[key,JSON.stringify(payload)]}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok||result.success!==true||!Array.isArray(result.result)||result.result.some(x=>x.success!==true))throw Error('NAVER_STORAGE_HTTP_'+response.status);
}
console.log(JSON.stringify({published:true,date:heatmap.date,stocks:heatmap.stocks.length}));
