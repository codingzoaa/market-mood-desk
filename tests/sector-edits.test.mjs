import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSectorEdit,parseSectorEdits,applySectorEdits,pendingClassification} from '../src/sector-edits.mjs';
import {readStockRegistry,top100Missing} from '../worker/stock-registry.mjs';
const base={symbol:'093370',name:'후성',market:'KOSPI',sector:'2차전지',subSector:'세부 분류 검토',themes:['2차전지'],breadth:false,verification:{status:'verified'}};
const edit={...base,subSector:'전해질·전해질염',themes:['전해질','LiPF6','전해질'],editedAt:'2026-11-16T08:00:00Z'};
test('manual edits normalize themes, require fields and reject duplicate imports',()=>{
 assert.deepEqual(normalizeSectorEdit(edit).themes,['전해질','LiPF6']);assert.throws(()=>normalizeSectorEdit({...edit,sector:''}));assert.throws(()=>normalizeSectorEdit({...edit,themes:Array(13).fill('x')}));assert.throws(()=>parseSectorEdits({version:1,entries:[edit,edit]}));
});
test('manual edits override refreshed classification only for matching stock identity and preserve breadth',()=>{
 const patch=normalizeSectorEdit(edit),edited=applySectorEdits([base],[patch])[0];assert.equal(edited.subSector,'전해질·전해질염');assert.equal(edited.manualEditedAt,patch.editedAt);assert.equal(edited.breadth,false);assert.equal(edited.verification,undefined);assert.equal(edited.reviewRequired,false);
 assert.equal(applySectorEdits([{...base,name:'다른회사'}],[patch])[0].subSector,base.subSector);assert.equal(applySectorEdits([{...base,market:'KOSDAQ'}],[patch])[0].subSector,base.subSector);assert.equal(applySectorEdits([base],[])[0],base);
});
test('missing subsector remains eligible for automated review even with a known broad sector',()=>{
 const stock={symbol:'799998',name:'추가종목',market:'KOSPI',price:100,changePct:1,turnoverKRW:100,themes:[]};
 assert.equal(top100Missing([stock],[],[{...base,symbol:stock.symbol,name:stock.name,reviewRequired:false}]).length,1);
 assert.equal(pendingClassification('세부 분류 검토'),true);
});
test('company business review resolves the pictured stocks globally with primary-source provenance',async()=>{
 const env={DB:{prepare:()=>({bind(){return this;},first:async()=>({payload:JSON.stringify({entries:[base]})})})}};
 const r=await readStockRegistry(env);const f=r.entries.find(e=>e.symbol==='093370'),i=r.entries.find(e=>e.symbol==='457190');
 assert.equal(f.subSector,'전해질·전해질염');assert.equal(i.subSector,'전고체전지 소재');assert.equal(f.verification.method,'COMPANY_BUSINESS_REVIEW_V1');assert.ok(f.verification.sourceUrl.startsWith('https://www.foosungchem.com/'));assert.equal(i.breadth,false);
});
