export const SECTOR_EDITS_KEY='market-note:sector-edits:v1';
export const pendingClassification=v=>!v||/미분류|검토|분류\s*대기/.test(v);
const text=(v,label,max=60)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw Error(label+'을(를) 1~'+max+'자로 입력하세요.');return v.trim();};
export function normalizeSectorEdit(raw){
 if(!raw||!/^\d{6}$/.test(raw.symbol)||!['KOSPI','KOSDAQ'].includes(raw.market))throw Error('종목 정보가 올바르지 않습니다.');
 const name=text(raw.name,'종목명',80),sector=text(raw.sector,'대분류'),subSector=text(raw.subSector,'세부 섹터');
 if(!Array.isArray(raw.themes)||raw.themes.length>12)throw Error('투자 테마는 최대 12개까지 입력하세요.');
 const themes=[...new Set(raw.themes.map(t=>text(t,'투자 테마',40)))];
 if(typeof raw.editedAt!=='string'||!Number.isFinite(Date.parse(raw.editedAt)))throw Error('수정 시각이 올바르지 않습니다.');
 if(raw.baseRevision!==undefined&&raw.baseRevision!==null&&(typeof raw.baseRevision!=='string'||!Number.isFinite(Date.parse(raw.baseRevision))))throw Error('초안 기준 버전이 올바르지 않습니다.');
 return {symbol:raw.symbol,name,market:raw.market,sector,subSector,themes,editedAt:raw.editedAt,...(raw.baseRevision!==undefined?{baseRevision:raw.baseRevision}:{})};
}
export function parseSectorEdits(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>5000)throw Error('분류 파일 형식이 올바르지 않습니다.');
 const seen=new Set();return raw.entries.map(e=>{const v=normalizeSectorEdit(e);if(seen.has(v.symbol))throw Error('중복된 종목코드가 있습니다.');seen.add(v.symbol);return v;});
}
export function applySectorEdits(registry,edits){
 const map=new Map(edits.map(e=>[e.symbol,e]));
 return registry.map(row=>{const e=map.get(row.symbol);if(!e||row.sharedEditedAt&&e.editedAt<=row.sharedEditedAt||e.market!==row.market||e.name.replaceAll(' ','')!==row.name.replaceAll(' ',''))return row;
  return {...row,sector:e.sector,subSector:e.subSector,themes:[...e.themes],manualEditedAt:e.editedAt,reviewRequired:pendingClassification(e.sector)||pendingClassification(e.subSector),verification:undefined};
 });
}
