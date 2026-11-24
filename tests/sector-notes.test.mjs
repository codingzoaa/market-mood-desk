import {test} from 'node:test';
import assert from 'node:assert/strict';
import {organizeSectorText,normalizeNote,sourceUrls,noteIssueBody,acceptNoteIssue,sectorNoteHref} from '../src/sector-notes.mjs';
const raw='로봇 로드맵\n삼성전자, 2027년 CES 휴머노이드 공개 예정\n부품 공급 계약 검토\n관련주: 로보티즈\nhttps://example.com/news/robot';
const note=organizeSectorText(raw,'로봇',[{symbol:'108490',name:'로보티즈'}],new Date('2026-11-24T00:00:00Z'));
const event={repository:{full_name:'codingzoaa/market-mood-desk',owner:{login:'codingzoaa'}},sender:{login:'codingzoaa'},issue:{number:123,user:{login:'codingzoaa'},title:'[섹터 자료] 로봇',body:noteIssueBody(note)}};
test('paste organization preserves source, extracts dated lines and never fetches or fabricates evidence',()=>{
 assert.equal(note.title,'로봇 로드맵');assert.match(note.timeline,/2027년 CES/);assert.match(note.stocks,/로보티즈 \(108490\)/);assert.equal(note.raw,raw);assert.deepEqual(normalizeNote(note).sources,['https://example.com/news/robot']);assert.equal(note.referenceDate,'2026-11-24');
 assert.deepEqual(sourceUrls('javascript:alert(1) https://user:secret@example.com/ https://example.com/a).'),['https://example.com/a']);assert.equal(sectorNoteHref('전력 기기'),'#stockmap/sector/%EC%A0%84%EB%A0%A5%20%EA%B8%B0%EA%B8%B0');
});
test('owner-confirmed requests publish idempotently, preserve original and update only the same issue',()=>{
 const first=acceptNoteIssue(event,{version:1,entries:[]},'2026-11-24T01:00:00Z');assert.equal(first.entries.length,1);assert.equal(first.entries[0].provenance,'USER_REVIEWED');assert.equal(first.entries[0].raw,raw);
 const second=acceptNoteIssue(event,first,'2026-11-24T02:00:00Z');assert.equal(second.entries.length,1);assert.equal(second.entries[0].createdAt,first.entries[0].createdAt);assert.equal(second.entries[0].updatedAt,'2026-11-24T02:00:00Z');
 assert.throws(()=>acceptNoteIssue({...event,sender:{login:'someone-else'}},first),/OWNER/);assert.throws(()=>acceptNoteIssue({...event,issue:{...event.issue,user:{login:'someone-else'}}},first),/OWNER/);
});
test('invalid requests, unsafe links and oversized material cannot enter shared notes',()=>{
 assert.throws(()=>normalizeNote({...note,summary:''}));assert.throws(()=>normalizeNote({...note,raw:'a'.repeat(12001)}));assert.throws(()=>normalizeNote({...note,sources:'javascript:alert(1)'}));assert.throws(()=>acceptNoteIssue({...event,issue:{...event.issue,body:event.issue.body+'\n```json\n{}\n```'}},{version:1,entries:[]}));
});
