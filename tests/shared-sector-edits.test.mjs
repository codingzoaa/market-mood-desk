import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptSharedSectorIssue,applySharedSectorEdits,sharedEditRequest,sharedEditUrl} from '../src/shared-sector-edits.mjs';
import {applySectorEdits} from '../src/sector-edits.mjs';
const stock={symbol:'005930',name:'삼성전자',market:'KOSPI',sector:'반도체',subSector:'메모리 반도체',themes:['DRAM'],breadth:true};
const request=sharedEditRequest(stock,{themes:['DRAM','NAND']});
const event=(r=request)=>({repository:{full_name:'codingzoaa/market-mood-desk',owner:{login:'codingzoaa'}},sender:{login:'codingzoaa'},issue:{title:'[섹터 분류] 삼성전자',user:{login:'codingzoaa'},html_url:'https://github.com/codingzoaa/market-mood-desk/issues/1',body:'```json\n'+JSON.stringify(r)+'\n```'}});
const empty={version:1,entries:[]},now='2026-11-16T10:00:00.000Z';
test('only repository owner confirmation can mutate shared data',()=>{
 assert.equal(acceptSharedSectorIssue(event(),empty,[stock],now).entries.length,1);
 for(const key of ['sender','issue']){const e=event();if(key==='sender')e.sender.login='visitor';else e.issue.user.login='visitor';assert.throws(()=>acceptSharedSectorIssue(e,empty,[stock],now),/OWNER/);}
 const e=event();e.repository.full_name='visitor/copy';assert.throws(()=>acceptSharedSectorIssue(e,empty,[stock]),/OWNER/);
});
test('rejects changed identity, incomplete classifications and stale writes including reset',()=>{
 const saved=acceptSharedSectorIssue(event(),empty,[stock],now);
 assert.throws(()=>acceptSharedSectorIssue(event(),saved,[stock]),/STALE/);
 assert.throws(()=>acceptSharedSectorIssue(event({...request,entry:{...request.entry,name:'다른종목'}}),empty,[stock]),/IDENTITY/);
 assert.throws(()=>acceptSharedSectorIssue(event({...request,entry:{...request.entry,subSector:'세부 분류 검토'}}),empty,[stock]),/INCOMPLETE/);
 const reset={...request,operation:'reset',baseRevision:now};assert.equal(acceptSharedSectorIssue(event(reset),saved,[stock]).entries.length,0);
});
test('shared edits preserve Breadth membership and supersede older local edits',()=>{
 const saved=acceptSharedSectorIssue(event(),empty,[stock],now).entries;
 const applied=applySharedSectorEdits([stock],saved);assert.equal(applied[0].breadth,true);assert.deepEqual(applied[0].themes,['DRAM','NAND']);
 assert.deepEqual(applySectorEdits(applied,[{...request.entry,themes:['old'],editedAt:'2026-11-15T00:00:00Z'}])[0].themes,['DRAM','NAND']);
 assert.equal(applySharedSectorEdits([{...stock,name:'다른종목'}],saved)[0].sharedEditedAt,undefined);
 const url=new URL(sharedEditUrl(request));assert.equal(url.origin,'https://github.com');assert.match(url.searchParams.get('body'),/```json/);
});
