import {calendarPublicationOutcome} from '../src/operations-outcome.mjs';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const repo='codingzoaa/market-mood-desk';
const names=['Publish verified sector calendar at 17 KST','Update KOSPI pension signal data','Refresh verified KOSPI breadth','Verify missing stock classifications','Relay Naver sector news to Cloudflare','Deploy LS Cloudflare Worker','Build and deploy dashboard','Save shared stock classification'];
export function normalizeRun(run,jobs=[]){return {publicationStatus:calendarPublicationOutcome(run,jobs),id:run.id,name:run.name,event:run.event,branch:run.head_branch,sha:run.head_sha,status:run.status,conclusion:run.conclusion,createdAt:run.created_at,startedAt:run.run_started_at,completedAt:run.status==='completed'?run.updated_at:null,url:run.html_url,jobs:jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,startedAt:j.started_at,completedAt:j.completed_at,stages:(j.steps||[]).filter(s=>/Generate same-day|Validate review|Create reviewed|independent calendar CI|Merge verified|Deploy verified|Deploy dashboard|Check TypeScript/.test(s.name)).map(s=>({name:s.name,status:s.status,conclusion:s.conclusion,startedAt:s.started_at,completedAt:s.completed_at})),steps:(j.steps||[]).filter(s=>s.status==='completed'&&s.conclusion==='failure').map(s=>s.name)}))};}
export async function snapshot(request=fetch){
 const headers={Accept:'application/vnd.github+json',...(process.env.GITHUB_TOKEN?{Authorization:'Bearer '+process.env.GITHUB_TOKEN}:{})};
 const get=async suffix=>{const r=await request('https://api.github.com/repos/'+repo+suffix,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GITHUB_STATUS_HTTP_'+r.status);return r.json();};
 const all=(await get('/actions/runs?per_page=100')).workflow_runs;
 const selected=all.filter(r=>names.includes(r.name));const runs=[];
 for(const name of names){const latest=selected.filter(r=>r.name===name&&(name!=='Build and deploy dashboard'||r.head_branch==='main'&&r.event!=='pull_request')).slice(0,name.includes('calendar')?6:2);for(const r of latest){const jobs=(await get('/actions/runs/'+r.id+'/jobs?per_page=100')).jobs;runs.push(normalizeRun(r,jobs));}}
 const now=new Date().toISOString();return {version:1,observedAt:now,repository:repo,runs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await snapshot();fs.mkdirSync('public',{recursive:true});fs.writeFileSync('public/operations-status.json',JSON.stringify(result,null,2)+'\n');console.log('Operations status: '+result.runs.length+' actual runs');}
