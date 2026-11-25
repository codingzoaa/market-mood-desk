import {guardClock,guardSettings} from '../../src/account/loss-guard.mjs';
import {marketSession} from '../../shared/market-session.mjs';
export function monitorWindow(now=Date.now()){const c=guardClock(now),d=new Date(c.date+'T00:00:00Z'),session=marketSession(c.date),time=c.time.replace(':','');return ![0,6].includes(d.getUTCDay())&&time>=session.open&&time<=session.flowEnd;}
export function nextMonitorAt(now=Date.now()){if(monitorWindow(now))return now+30000;const c=guardClock(now);for(let n=0;n<8;n++){const date=new Date(Date.parse(c.date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),day=new Date(date+'T00:00:00Z').getUTCDay();if([0,6].includes(day))continue;const open=marketSession(date).open,at=Date.parse(date+'T'+open.slice(0,2)+':'+open.slice(2)+':00+09:00');if(at>now)return at;}throw Error('MONITOR_CALENDAR_INVALID');}
export function pushDecision(snapshot,previous,raw,now=Date.now()){
 if(!snapshot||!Number.isFinite(Date.parse(snapshot.lastSampleAt))||Math.abs(now-Date.parse(snapshot.lastSampleAt))>90000||!Number.isFinite(snapshot.ratio)||snapshot.ratio<0)return {kind:null,notificationState:previous||null};
 const c=guardSettings(raw),s=previous?.date===snapshot.date?{...previous}:{date:snapshot.date,warned:false,limited:false,lastLimitAt:null};
 if(snapshot.ratio<c.warnPercent/200)Object.assign(s,{warned:false,limited:false,lastLimitAt:null});
 let kind=null;if(snapshot.ratio>=1){if(!s.limited||c.repeatMinutes>0&&now-(s.lastLimitAt||0)>=c.repeatMinutes*60000){kind='LIMIT';s.lastLimitAt=now;}Object.assign(s,{warned:true,limited:true});}else if(snapshot.ratio>=c.warnPercent/100&&!s.warned){kind='WARNING';s.warned=true;}
 return {kind,notificationState:s};
}
