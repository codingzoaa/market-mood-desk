// Explicit exchange-calendar exception. Other dates retain normal hours.
export const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(2,4));
export const timeOf=value=>String(Math.floor(value/60)).padStart(2,'0')+String(value%60).padStart(2,'0');
export function marketSession(date){
 const shift=date==='2026-11-19'?60:0,at=t=>timeOf(minutes(t)+shift);
 return {date,shift,open:at('0900'),close:at('1530'),derivativesClose:at('1545'),collectEnd:at('1610'),flowEnd:at('1615'),pensionAfter:at('1550'),reviewAt:at('1700'),briefingAt:at('1630'),ticks:['0900','1100','1300','1530','1615'].map(at)};
}
export function sessionRecoveryAllowed(env,now=new Date()){
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replace(':','');
 return date==='2026-11-19'&&env?.RECOVER_SESSION===date&&time>marketSession(date).flowEnd&&time<='2355';
}
