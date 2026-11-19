import {normalizeSectorEdit,pendingClassification} from './sector-edits.mjs';
export const SHARED_TITLE='[섹터 분류] ';
export function sharedEditRequest(item,values,reset=false){
 const entry=normalizeSectorEdit({...item,...values,editedAt:new Date().toISOString()});
 return {version:1,operation:reset?'reset':'save',entry,baseRevision:item.sharedRevision||item.sharedEditedAt||null};
}
export function sharedEditUrl(request){
 const params=new URLSearchParams({title:SHARED_TITLE+request.entry.name,body:'운영자 계정으로 제출하면 검증 후 모든 기기의 공통 분류에 반영됩니다.\n\n```json\n'+JSON.stringify(request,null,2)+'\n```'});
 return 'https://github.com/codingzoaa/market-mood-desk/issues/new?'+params;
}
export function applySharedSectorEdits(rows,entries,revisions={}){
 const byCode=new Map(entries.map(e=>[e.symbol,e]));
 return rows.map(row=>{const edit=byCode.get(row.symbol);if(!edit||edit.market!==row.market||edit.name.replaceAll(' ','')!==row.name.replaceAll(' ',''))return revisions[row.symbol]?{...row,sharedRevision:revisions[row.symbol]}:row;
 return {...row,sector:edit.sector,subSector:edit.subSector,themes:[...edit.themes],reviewRequired:pendingClassification(edit.sector)||pendingClassification(edit.subSector),sharedRevision:revisions[row.symbol]||edit.editedAt,sharedEditedAt:edit.editedAt,manualEditedAt:edit.editedAt,verification:undefined};});
}
export function acceptSharedSectorIssue(event,document,known,now=new Date().toISOString()){
 const owner=event.repository?.owner?.login;
 if(!owner||event.repository?.full_name!=='codingzoaa/market-mood-desk'||event.issue?.user?.login!==owner||event.sender?.login!==owner||event.issue?.pull_request||!event.issue?.title?.startsWith(SHARED_TITLE))throw Error('OWNER_CONFIRMATION_REQUIRED');
 const blocks=[...(event.issue.body||'').matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
 if(blocks.length!==1||blocks[0][1].length>10000)throw Error('REQUEST_FORMAT');
 const request=JSON.parse(blocks[0][1]);
 if(request.version!==1||!['save','reset'].includes(request.operation))throw Error('REQUEST_SCHEMA');
 const entry=normalizeSectorEdit(request.entry),identity=known.find(e=>e.symbol===entry.symbol);
 if(!identity||identity.market!==entry.market||identity.name.replaceAll(' ','')!==entry.name.replaceAll(' ',''))throw Error('STOCK_IDENTITY_MISMATCH');
 if(request.operation==='save'&&(pendingClassification(entry.sector)||pendingClassification(entry.subSector)))throw Error('CLASSIFICATION_INCOMPLETE');
 const previous=document.entries.find(e=>e.symbol===entry.symbol);
 if((request.baseRevision||null)!==(document.revisions?.[entry.symbol]||previous?.editedAt||null))throw Error('STALE_REVISION_REFRESH_REQUIRED');
 const entries=document.entries.filter(e=>e.symbol!==entry.symbol);
 if(request.operation==='save')entries.push({...entry,editedAt:now,sourceUrl:event.issue.html_url});
 const before=previous?{sector:previous.sector,subSector:previous.subSector,themes:previous.themes}:null;
 const after=request.operation==='save'?{sector:entry.sector,subSector:entry.subSector,themes:entry.themes}:null;
 const change={symbol:entry.symbol,name:entry.name,operation:request.operation,at:now,before,after,sourceUrl:event.issue.html_url};
 return {version:1,entries:entries.sort((a,b)=>a.symbol.localeCompare(b.symbol)),revisions:{...(document.revisions||{}),[entry.symbol]:now},history:[...(document.history||[]),change].slice(-500)};
}
