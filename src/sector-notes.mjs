export const NOTE_TITLE='[섹터 자료] ';
export const NOTE_DRAFT_KEY='marketnote-sector-note-draft-v1';
const field=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('입력 길이 또는 형식을 확인하세요.');const s=v.trim();if(required&&!s)throw Error('섹터·제목·핵심 요약을 입력하세요.');return s;};
export function sourceUrls(text){
 const matches=String(text||'').match(/https?:\/\/[^\s<>"']+/g)||[];
 return [...new Set(matches.map(x=>x.replace(/[),.;\]}>]+$/g,'')))].filter(x=>{try{const u=new URL(x);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}});
}
export function normalizeNote(value){
 if(!value||typeof value!=='object')throw Error('자료 형식을 확인하세요.');
 const note={sector:field(value.sector,60,true),title:field(value.title,120,true),summary:field(value.summary,1500,true),drivers:field(value.drivers||'',2500),stocks:field(value.stocks||'',2000),timeline:field(value.timeline||'',2500),raw:field(value.raw||'',12000)};
 const input=Array.isArray(value.sources)?value.sources.join('\n'):field(value.sources||'',4000);
 const sources=sourceUrls(input);if(sources.length>20||sources.some(x=>x.length>1500))throw Error('출처는 20개 이하로 입력하세요.');
 if(input.trim()&&!sources.length)throw Error('출처에는 http 또는 https 기사 링크를 입력하세요.');
 return {...note,sources};
}
export function organizeSectorText(raw,sector,registry=[],now=new Date()){
 field(raw,12000,true);
 const lines=raw.split(/\n+/).map(x=>x.replace(/^\s*(?:#{1,6}\s*|[■●•]\s*|\d+[.)]\s*)/,'').trim()).filter(Boolean);
 const narrative=lines.filter(x=>!/^https?:\/\//.test(x)&&!/^기업별|관련주 요약|출처$/.test(x));
 const stocks=registry.filter(x=>x.name&&raw.includes(x.name)).map(x=>x.name+' ('+x.symbol+')');
 const dates=lines.filter(x=>/(?:20\d{2}|내년|올해|\d+분기|예정|목표|양산|공개)/.test(x));
 const drivers=lines.filter(x=>/수주|실적|공급|계약|투자|수요|정책|증설|협력|개발|매출/.test(x));
 const title=(narrative[0]||sector+' 자료').slice(0,120);
 return {sector,title,summary:narrative.slice(1,4).join('\n').slice(0,1500)||title,drivers:drivers.slice(0,12).join('\n').slice(0,2500),stocks:[...new Set(stocks)].join(' · ').slice(0,2000),timeline:dates.slice(0,12).join('\n').slice(0,2500),sources:sourceUrls(raw).join('\n'),raw,referenceDate:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now)};
}
export const sectorNoteHref=sector=>sector==='로봇'?'#stockmap/robot':'#stockmap/sector/'+encodeURIComponent(sector);
export function noteIssueBody(note){return '운영자가 검토한 섹터 자료입니다. 게시 후에도 원문 및 출처를 보존합니다.\n\n```json\n'+JSON.stringify({version:1,note:normalizeNote(note)},null,2)+'\n```';}
export function noteIssueUrl(note,body=true){return 'https://github.com/codingzoaa/market-mood-desk/issues/new?'+new URLSearchParams({title:NOTE_TITLE+note.title,...(body?{body:noteIssueBody(note)}:{})});}
export function acceptNoteIssue(event,document,now=new Date().toISOString()){
 const owner=event.repository?.owner?.login,issue=event.issue;
 if(!owner||event.repository?.full_name!=='codingzoaa/market-mood-desk'||issue?.user?.login!==owner||event.sender?.login!==owner||issue.pull_request||!issue.title?.startsWith(NOTE_TITLE))throw Error('OWNER_CONFIRMATION_REQUIRED');
 if(!Number.isSafeInteger(issue.number)||issue.number<1)throw Error('ISSUE_ID_INVALID');
 const blocks=[...(issue.body||'').matchAll(/```json\s*\n([\s\S]*?)\n```/g)];if(blocks.length!==1||blocks[0][1].length>30000)throw Error('NOTE_REQUEST_FORMAT');
 const request=JSON.parse(blocks[0][1]);if(request.version!==1)throw Error('NOTE_REQUEST_VERSION');
 if(document.version!==1||!Array.isArray(document.entries))throw Error('NOTE_STORE_VERSION');
 const note=normalizeNote(request.note),id='issue-'+issue.number,previous=document.entries.find(x=>x.id===id);
 // The issue is the durable identity: retries and edits update one entry.
 const entry={...note,id,createdAt:previous?.createdAt||now,updatedAt:now,provenance:'USER_REVIEWED',requestUrl:'https://github.com/codingzoaa/market-mood-desk/issues/'+issue.number};
 return {version:1,entries:[...document.entries.filter(x=>x.id!==id),entry].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};
}
