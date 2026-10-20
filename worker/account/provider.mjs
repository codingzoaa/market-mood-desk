import {check} from './security.mjs';
/** Read-only TRs only. Detailed mapping must match the owner's official LS contract.
 * No guessed execution/fee semantics; a generic order row is not a fill.
 */
export function reviewedContract(env){
 let c;try{c=JSON.parse(env.LS_ACCOUNT_CONTRACT||'null');}catch{throw Error('LS_CONTRACT_REQUIRED');}
 check(c?.reviewed===true&&c.identity==='UNIQUE_TRADE_LEDGER_ROW'&&typeof c.version==='string'&&['CDPCQ04700','CSPAQ13700'].includes(c.tr)&&typeof c.documentationURL==='string'&&c.documentationURL.startsWith('https://openapi.ls-sec.co.kr/')&&Number.isInteger(c.pageLimit)&&c.pageLimit>0&&c.pageLimit<=100&&Number.isInteger(c.maxRangeDays)&&c.maxRangeDays>=1&&c.maxRangeDays<=31,'LS_CONTRACT_REQUIRED');
 check(typeof c.rowsBlock==='string'&&c.rowsBlock.startsWith(c.tr+'OutBlock')&&Array.isArray(c.successCodes)&&c.successCodes.length>0&&c.successCodes.every(s=>typeof s==='string'),'LS_CONTRACT_REQUIRED');
 for(const k of ['id','date','time','symbol','name','side','sequence','quantity','price','grossKRW','feeKRW','taxKRW'])check(typeof c.fields?.[k]==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(c.fields[k]),'LS_CONTRACT_REQUIRED');
 for(const k of ['account','password','from','to'])check(typeof c.inputFields?.[k]==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(c.inputFields[k]),'LS_CONTRACT_REQUIRED');
 check(typeof c.buyValue==='string'&&typeof c.sellValue==='string'&&c.buyValue!==c.sellValue,'LS_CONTRACT_REQUIRED');return c;
}
const base='https://openapi.ls-sec.co.kr:8080';
async function json(response){check(response.ok,'LS_ACCOUNT_UNAVAILABLE');const text=await response.text();check(text.length<1500000,'LS_ACCOUNT_RESPONSE_LIMIT');try{return JSON.parse(text);}catch{throw Error('LS_ACCOUNT_RESPONSE_INVALID');}}
export async function tokenForAccount(env,fetcher){
 check(env.LS_ACCOUNT_APP_KEY&&env.LS_ACCOUNT_APP_SECRET&&env.LS_ACCOUNT_NO&&env.LS_ACCOUNT_PASSWORD,'LS_ACCOUNT_NOT_CONFIGURED');
 const r=await fetcher(base+'/oauth2/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',appkey:env.LS_ACCOUNT_APP_KEY,appsecretkey:env.LS_ACCOUNT_APP_SECRET,scope:'oob'})});
 const data=await json(r);check(typeof data.access_token==='string'&&data.access_token.length>0&&Number.isFinite(Number(data.expires_in))&&Number(data.expires_in)>0,'LS_ACCOUNT_AUTH_FAILED');return {token:data.access_token,expires:Date.now()+Number(data.expires_in)*1000};
}
export async function accountPage(env,{job,token,fetcher}){
 const c=reviewedContract(env);
 const body={...(c.staticInput||{}),[c.inputFields.account]:env.LS_ACCOUNT_NO,[c.inputFields.password]:env.LS_ACCOUNT_PASSWORD,[c.inputFields.from]:job.from.replaceAll('-',''),[c.inputFields.to]:job.to.replaceAll('-','')};
 const response=await fetcher(base+'/stock/accno',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json; charset=utf-8',authorization:'Bearer '+token,tr_cd:c.tr,tr_cont:job.continuation?.flag||'N',tr_cont_key:job.continuation?.key||''},body:JSON.stringify({[c.tr+'InBlock1']:body})});
 const data=await json(response);check(c.successCodes.includes(data.rsp_cd),'LS_ACCOUNT_TR_FAILED');const rows=data[c.rowsBlock];check(Array.isArray(rows)&&rows.length<=c.pageLimit,'LS_ACCOUNT_RESPONSE_INVALID');
 const number=value=>{check(typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value),'LS_ACCOUNT_FIELD_INVALID');const n=Number(value);check(Number.isSafeInteger(n)&&n>=0,'LS_ACCOUNT_FIELD_INVALID');return n;};
 const trades=rows.map(row=>{const f=c.fields,date=String(row[f.date]),time=String(row[f.time]);check(/^\d{8}$/.test(date)&&/^\d{6}$/.test(time),'LS_ACCOUNT_FIELD_INVALID');const side=String(row[f.side]);check(side===c.buyValue||side===c.sellValue,'LS_ACCOUNT_UNSUPPORTED_TRANSACTION');
  check((typeof row[f.id]==='string'&&row[f.id].length>0)||(Number.isSafeInteger(row[f.id])&&row[f.id]>=0),'LS_ACCOUNT_ID_MISSING');
  const symbol=String(row[f.symbol]);return {id:String(row[f.id]),accountRef:env.LS_ACCOUNT_NO,date:date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6),time:time.slice(0,2)+':'+time.slice(2,4)+':'+time.slice(4),symbol:c.stripStockPrefix===true?symbol.replace(/^A(?=[0-9A-Z]{6}$)/,'' ):symbol,name:row[f.name],side:side===c.buyValue?'BUY':'SELL',sequence:number(row[f.sequence]),quantity:number(row[f.quantity]),price:number(row[f.price]),grossKRW:number(row[f.grossKRW]),feeKRW:number(row[f.feeKRW]),taxKRW:number(row[f.taxKRW])};});
 check(trades.every(t=>t.date>=job.from&&t.date<=job.to),'LS_ACCOUNT_RANGE_MISMATCH');
 const continuation={flag:response.headers.get('tr_cont')||'N',key:response.headers.get('tr_cont_key')||''};check(['N','Y'].includes(continuation.flag)&&(continuation.flag!=='Y'||continuation.key&&continuation.key!==job.continuation?.key),'LS_ACCOUNT_CURSOR_INVALID');
 return {trades,continuation,done:continuation.flag!=='Y',contractVersion:c.version};
}
