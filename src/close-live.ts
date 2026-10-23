import {verifiedEvidence} from '../shared/close-evidence.mjs';
import {API_URL} from './live';
import type {ScoreInput} from './close-score';
import type {CloseSector} from './close-reviews';
export type CloseEvidence={symbol:string;name:string;date:string;asOf:string;turnover:number;marketCap:number;close:number;changePct:number|null;streak:number|null;foreignNet?:number;institutionNet?:number;flowAsOf?:string;sourceUrls:string[]};
export function validateCloseEvidence(raw:any,date:string):CloseEvidence[]{
 if(raw?.version!==1||raw.date!==date||!Array.isArray(raw.stocks)||raw.stocks.length>100)throw Error('LS 마감 자료 형식 오류');
 const seen=new Set<string>();return raw.stocks.map((row:any)=>{const parsed=verifiedEvidence(row,date);if(!parsed||seen.has(parsed.symbol))throw Error('LS 마감 자료 검증 대기');seen.add(parsed.symbol);return parsed;});
}
export async function loadCloseEvidence(date:string,signal:AbortSignal){
 const response=await fetch(API_URL+'/api/close-evidence?date='+encodeURIComponent(date),{credentials:'omit',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
 if(response.status===404)throw Error('LS 점수 수집기 배포 대기');if(!response.ok)throw Error('LS 마감 자료 연결 대기');
 const text=await response.text();if(text.length>1000000)throw Error('LS 마감 자료 크기 오류');return validateCloseEvidence(JSON.parse(text),date);
}
export function mergedCloseInput(sector:CloseSector,date:string,rows:CloseEvidence[]):ScoreInput|undefined{
 const manual=sector.scoreInput?.date===date?sector.scoreInput:undefined;
 const stock=rows.find(s=>s.symbol===sector.leaderSymbol&&s.date===date);if(!stock)return manual;
 const result:ScoreInput={...manual,date,turnover:stock.turnover,marketCap:stock.marketCap,sourceUrls:[...new Set([...(manual?.sourceUrls||[]),...stock.sourceUrls])]};
 if(stock.streak!==null)result.streak=stock.streak;
 if(stock.foreignNet!==undefined&&stock.institutionNet!==undefined){result.foreignNet=stock.foreignNet;result.institutionNet=stock.institutionNet;}
 const members=sector.scoreUniverse;
 if(members&&members.length>=2&&new Set(members).size===members.length){const cohort=members.map(symbol=>rows.find(s=>s.symbol===symbol&&s.date===date));if(cohort.every(s=>s&&typeof s.changePct==='number')){result.members=cohort.length;result.up=cohort.filter(s=>s!.changePct!>0).length;}}
 return result;
}
