import {readFile,writeFile,mkdir} from 'node:fs/promises';
const fail=m=>{throw Error('CLOSE_REVIEW_BLOCKED: '+m)};
const date=process.env.REVIEW_DATE||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))fail('invalid date');
const source=process.env.CLOSE_REVIEW_CANDIDATE_URL;
if(!source)fail('CLOSE_REVIEW_CANDIDATE_URL is not configured; no unverified review will be published');
const u=new URL(source);if(u.protocol!=='https:')fail('candidate URL must use HTTPS');
const response=await fetch(u,{signal:AbortSignal.timeout(20000)});
if(!response.ok)fail('candidate HTTP '+response.status);
const data=await response.json();
if(data.date!==date||data.sessionDate!==date||data.market!=='KRX'||data.session!=='regular-close'||data.verifiedClose!==true)fail('same-day KRX regular-session close not verified');
if(typeof data.closedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(data.closedAt)||!Number.isFinite(Date.parse(data.closedAt)))fail('close timestamp missing');
const localDate=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
if(localDate(data.closedAt)!==date)fail('close timestamp not same KST day');
const src=data.sources;
if(!Array.isArray(src)||!src.length||!src.every(s=>typeof s.title==='string'&&s.title.trim()&&typeof s.url==='string'&&/^https:\/\//.test(s.url)&&typeof s.publishedAt==='string'&&Number.isFinite(Date.parse(s.publishedAt))&&localDate(s.publishedAt)===date))fail('dated source URLs missing');
if(!Array.isArray(data.sectors)||!data.sectors.length||data.sectors.length>5)fail('sector count must be 1..5');
const seen=new Set();
for(const s of data.sectors){
 if(!s||typeof s.name!=='string'||!s.name.trim()||seen.has(s.name))fail('duplicate/invalid sector');
 seen.add(s.name);
 if(!['NEW','HOT','RE','WEAK'].includes(s.status)||!['kind','leader','companions','reason','outlook','change'].every(k=>typeof s[k]==='string'&&s[k].trim()))fail('sector fields missing');
 if(!Array.isArray(s.sourceIds)||!s.sourceIds.length||!s.sourceIds.every(i=>Number.isInteger(i)&&i>=0&&i<src.length))fail('invalid sector provenance');
 if(s.statusConfirmed===true&&data.previousSessionVerified!==true)fail('unverified previous session status');
 if(!data.previousSessionVerified&&!/잠정/.test(s.kind+' '+s.change))fail('provisional status not marked');
 if(s.scoreInput){
  const x=s.scoreInput;
  if(x.date!==date||!Array.isArray(x.sourceUrls)||!x.sourceUrls.length||!x.sourceUrls.every(url=>src.some(z=>z.url===url)))fail('score evidence mismatch');
  if(x.news==='disclosure'&&!s.sourceIds.some(i=>src[i].sourceType==='disclosure'))fail('unverified disclosure score');
  if(x.news==='official'&&!s.sourceIds.some(i=>['official','disclosure'].includes(src[i].sourceType)))fail('unverified official score');
  const complete=['turnover','marketCap','up','members','news','streak','foreignNet','institutionNet'].every(k=>x[k]!==undefined);
  if(!complete&&(s.total!==undefined||s.grade!==undefined))fail('incomplete score with total/grade');
 }
}
const file='src/close-review-'+date+'.ts';
const ident='review'+date.replaceAll('-','');
const payload={date,session:'KRX 정규장 마감 · 15:30 KST',summary:String(data.summary||''),coverageNote:String(data.coverageNote||'검증된 원자료 범위만 반영. 결측 지표 미산출.'),sources:src.map(({title,url})=>({title,url})),sectors:data.sectors.map(({name,status,kind,leader,leaderSymbol,companions,reason,outlook,change,sourceIds,scoreInput})=>({name,status,kind,leader,...(leaderSymbol?{leaderSymbol}:{}),companions,reason,outlook,change,sourceIds,...(scoreInput?{scoreInput}:{})}))};
if(!payload.summary)fail('summary missing');
try{await readFile(file);fail('review already exists; manual update required')}catch(e){if(e.code!=='ENOENT')throw e}
await writeFile(file,"import type {CloseReview} from './close-reviews';\nexport const "+ident+":CloseReview="+JSON.stringify(payload,null,2)+";\n");
const registry='src/close-reviews.ts',old=await readFile(registry,'utf8');
if(old.includes(ident))fail('date already registered');
const marker='export type CloseSector=';
if(!old.includes(marker))fail('registry schema changed');
let next=old.replace(marker,"import {"+ident+"} from './close-review-"+date+"';\n"+marker);
const match=next.match(/const records=\[([^\]]+)\];/);
if(!match)fail('registry records marker missing');
next=next.replace(match[0],'const records=['+match[1]+','+ident+'];');
await writeFile(registry,next);
console.log('Validated candidate and staged '+date);
