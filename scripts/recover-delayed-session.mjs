import {readFileSync} from 'node:fs';
import {sessionRecoverySignature} from '../worker/session-recovery.mjs';
const request=JSON.parse(readFileSync('.github/session-recovery-request.json','utf8'));
if(request.date!=='2026-11-19'||!Number.isFinite(Date.parse(request.requestedAt))||Math.abs(Date.now()-Date.parse(request.requestedAt))>3600000)throw Error('SESSION_REQUEST_EXPIRED');
const time=String(Date.now()),signature=await sessionRecoverySignature(process.env.TELEGRAM_BOT_TOKEN,request.date,time);
const response=await fetch('https://market-note-ls-api.kby0991.workers.dev/internal/session-recovery',{method:'POST',redirect:'error',signal:AbortSignal.timeout(360000),headers:{'X-Session-Date':request.date,'X-Session-Time':time,'X-Session-Signature':signature}});
const body=await response.json();console.log('SESSION_RECOVERY '+JSON.stringify(body));if(!response.ok||body.status!=='complete')throw Error('SESSION_RECOVERY_NOT_COMPLETE');
