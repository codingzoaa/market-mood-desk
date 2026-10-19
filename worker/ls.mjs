const BASE = 'https://openapi.ls-sec.co.kr:8080';
const ROUTES = { t1463:'/stock/high-item', t1511:'/indtp/market-data', t1532:'/stock/sector', t8451:'/stock/chart' };
export class LSFailure extends Error { constructor(code){ super(code); this.code=code; } }
export function networkFailure(error,phase='AUTH',secrets=[]) {
 const message=String(error?.message||'').toLowerCase();
 const kind=error?.name==='TimeoutError'||/timeout|timed out/.test(message)?'TIMEOUT':/ssl|tls|certificate/.test(message)?'TLS_FAILED':/port/.test(message)?'PORT_REJECTED':/dns|resolve|hostname/.test(message)?'DNS_FAILED':/connection/.test(message)?'CONNECTION_FAILED':/url|invalid|protocol/.test(message)?'REQUEST_REJECTED':/internal/.test(message)?'EDGE_INTERNAL':'NETWORK_FAILED';
 const result=new LSFailure('LS_'+phase+'_'+kind);
 let detail=String(error?.message||'');for(const secret of secrets){if(typeof secret==='string'&&secret)detail=detail.split(secret).join('[redacted]');}
 detail=detail.replace(/https?:\/\/[^\s]+/gi,'[upstream]').replace(/(?:appkey|appsecretkey|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi,'[redacted]').slice(0,220);
 result.safeDetail=detail;return result;
}

async function json(response) {
 if(response.status>=300&&response.status<400){const error=new LSFailure('LS_REDIRECT_REJECTED');let origin='unknown';try{origin=new URL(response.headers.get('location')).origin;}catch{}error.safeDetail='HTTP '+response.status+' redirect to '+origin;throw error;}
 if (!response.ok) throw new LSFailure(response.status===401||response.status===403?'LS_AUTH_FAILED':'LS_HTTP_FAILED');
 const text=await response.text(); if(text.length>2000000) throw new LSFailure('LS_RESPONSE_INVALID');
 try { return JSON.parse(text); } catch { throw new LSFailure('LS_RESPONSE_INVALID'); }
}
export async function accessToken(env, fetcher=fetch, now=Date.now()) {
 const row=await env.DB.prepare("SELECT payload FROM state WHERE id='oauth'").first();
 if(row){const saved=JSON.parse(row.payload);if(saved.expires>now+120000)return saved.token;}
 const response=await fetcher(BASE+'/oauth2/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',appkey:env.LS_APP_KEY,appsecretkey:env.LS_APP_SECRET,scope:'oob'})}).catch(error=>{throw networkFailure(error,'AUTH',[env.LS_APP_KEY,env.LS_APP_SECRET,env.DASHBOARD_TOKEN]);});
 const data=await json(response),ttl=Number(data.expires_in);
 if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(ttl)||ttl<=0)throw new LSFailure('LS_AUTH_FAILED');
 await env.DB.prepare("INSERT INTO state(id,payload) VALUES('oauth',?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind(JSON.stringify({token:data.access_token,expires:now+ttl*1000})).run();
 return data.access_token;
}
export async function tr(token,code,body,continuation={flag:'N',key:''},fetcher=fetch){
 if(!ROUTES[code])throw new LSFailure('TR_NOT_ALLOWED');
 const response=await fetcher(BASE+ROUTES[code],{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json; charset=utf-8',authorization:'Bearer '+token,tr_cd:code,tr_cont:continuation.flag,tr_cont_key:continuation.key},body:JSON.stringify({[code+'InBlock']:body})}).catch(error=>{throw networkFailure(error,'TR');});
 const data=await json(response);
 if(typeof data.rsp_cd!=='string'||!/^0+$/.test(data.rsp_cd))throw new LSFailure('LS_TR_FAILED');
 return {data,continuation:{flag:response.headers.get('tr_cont')||'N',key:response.headers.get('tr_cont_key')||''}};
}
export function number(value,min=-1e15,max=1e15){
 if(typeof value!=='number'&&typeof value!=='string'||typeof value==='string'&&!value.trim())throw new LSFailure('LS_RESPONSE_INVALID');
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new LSFailure('LS_RESPONSE_INVALID');return n;
}
export function signed(value,sign){const n=number(value,-100,10000);if(['4','5'].includes(String(sign)))return -Math.abs(n);if(['1','2'].includes(String(sign)))return Math.abs(n);return n;}
export function normalizeStock(row,market,themes=[]){
 if(!/^\d{6}$/.test(row.shcode)||typeof row.hname!=='string'||!row.hname.trim()||row.hname.length>80)throw new LSFailure('LS_RESPONSE_INVALID');
 return {symbol:row.shcode,name:row.hname.trim(),market,themes:themes.slice(0,5),price:number(row.price,0,1e9),changePct:signed(row.diff,row.sign),turnoverKRW:number(row.value,0,1e9)*1000000};
}
export function kst(now=new Date()){return {date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),time:new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replace(':',''),weekday:new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short'}).format(now)};}
export function collectWindow(now=new Date()){const k=kst(now);return !['Sat','Sun'].includes(k.weekday)&&k.time>='0900'&&k.time<='1630';}
export function verifySession(data,now=new Date()){
 const rows=data.t8451OutBlock1;if(!Array.isArray(rows)||!rows.length)throw new LSFailure('LS_RESPONSE_INVALID');
 const latest=rows.map(x=>x.date).sort().at(-1);const k=kst(now);if(latest!==k.date.replaceAll('-',''))return false;
 const start=data.t8451OutBlock?.s_time;if(typeof start!=='string'||!/^\d{6}$/.test(start))throw new LSFailure('LS_RESPONSE_INVALID');
 return k.time>=start.slice(0,4);
}
