import {vwmaBootstrapSignature} from '../worker/vwma-bootstrap.mjs';
const base='https://market-note-ls-api.kby0991.workers.dev',secret=process.env.TELEGRAM_BOT_TOKEN;
if(!secret)throw Error('VWMA_VERIFICATION_SECRET_MISSING');
const get=async path=>{const r=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('VWMA_HTTP_'+r.status);return r.json();};
const k=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(':','');
const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short'}).format(new Date());
if(!['Sat','Sun'].includes(weekday)&&clock>='0900'&&clock<='1715'){console.log('VWMA_WARMUP_DEFERRED_UNTIL_OUTSIDE_SESSION');process.exit(0);}
const d=await get('/api/dashboard'),date=d.snapshots?.map(s=>s.date).sort().at(-1);if(!date)throw Error('VWMA_LATEST_SNAPSHOT_MISSING');
let result;
for(const offset of ['0','5','10','15']){
 const time=String(Date.now()),signature=await vwmaBootstrapSignature(secret,date,time,offset);
 const r=await fetch(base+'/internal/vwma-bootstrap',{method:'POST',redirect:'error',headers:{'X-Vwma-Date':date,'X-Vwma-Time':time,'X-Vwma-Offset':offset,'X-Vwma-Signature':signature},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('VWMA_WARMUP_HTTP_'+r.status);
 let completed=false;for(let attempt=0;attempt<60;attempt++){await new Promise(r=>setTimeout(r,2000));result=await get('/api/vwma-scanner');const expected=result.rows.slice(Number(offset),Number(offset)+5);if(expected.length&&expected.every(row=>Date.parse(row.checkedAt)>=Number(time))){completed=true;break;}}
 console.log('VWMA_HISTORY_BATCH '+JSON.stringify({date,offset:Number(offset),completed,rows:result.rows?.length,verifiedFrames:Object.fromEntries(['5','60','240','D'].map(f=>[f,result.rows?.filter(r=>r.frames?.[f]).length||0])),errors:result.rows?.flatMap(r=>Object.entries(r.errors||{}).map(([frame,error])=>({frame,error}))).slice(0,8)}));if(!completed)throw Error('VWMA_WARMUP_INCOMPLETE');
}
if(!['5','60','240','D'].every(f=>result.rows.some(r=>r.frames?.[f])))throw Error('VWMA_FRAME_VERIFICATION_INCOMPLETE');
console.log('VWMA_FOUR_FRAMES_VERIFIED '+JSON.stringify({date,rows:result.rows.length,complete:result.rows.filter(r=>['5','60','240','D'].every(f=>r.frames?.[f])).length}));
