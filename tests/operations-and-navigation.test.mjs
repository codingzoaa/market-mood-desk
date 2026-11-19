import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeRun} from '../scripts/operations-snapshot.mjs';
import {navigateRange} from '../src/chart-navigation.mjs';
import {acceptSharedSectorIssue,sharedEditRequest,applySharedSectorEdits} from '../src/shared-sector-edits.mjs';
test('queued, failed and successful builds retain actual deploy outcome and timestamps independently',()=>{
 const run={id:1,name:'Build and deploy dashboard',status:'completed',conclusion:'success',updated_at:'2026-11-19T08:10:00Z'};
 const result=normalizeRun(run,[{name:'build',status:'completed',conclusion:'success'},{name:'deploy',status:'completed',conclusion:'skipped'}]);assert.equal(result.jobs[1].conclusion,'skipped');assert.equal(result.completedAt,run.updated_at);
 assert.equal(normalizeRun({...run,status:'queued'}).completedAt,null);
});
test('navigation stays in bounds, zooms visible intervals and restores the full range',()=>{
 for(const command of ['in','out','left','right','reset'])for(const [a,b] of [[0,100],[90,100],[0,1],[50,60]]){const x=navigateRange(a,b,command);assert.ok(x.start>=0&&x.end<=100&&x.start<x.end);}
 assert.ok(navigateRange(20,60,'in').end-navigateRange(20,60,'in').start<40);assert.deepEqual(navigateRange(20,60,'reset'),{start:0,end:100});
});
test('reset revisions and change history prevent stale save requests from resurrecting overwritten shared data',()=>{
 const stock={symbol:'005930',name:'삼성전자',market:'KOSPI',sector:'반도체',subSector:'메모리',themes:['DRAM']};
 const request=sharedEditRequest(stock,{});const event=r=>({repository:{full_name:'codingzoaa/market-mood-desk',owner:{login:'codingzoaa'}},sender:{login:'codingzoaa'},issue:{title:'[섹터 분류] 삼성전자',user:{login:'codingzoaa'},html_url:'https://github.com/codingzoaa/market-mood-desk/issues/1',body:'```json\n'+JSON.stringify(r)+'\n```'}});
 const first=acceptSharedSectorIssue(event(request),{version:1,entries:[]},[stock],'2026-11-19T08:00:00Z');
 const reset=acceptSharedSectorIssue(event({...request,operation:'reset',baseRevision:first.revisions['005930']}),first,[stock],'2026-11-19T09:00:00Z');assert.equal(reset.history.length,2);assert.equal(reset.entries.length,0);
 assert.throws(()=>acceptSharedSectorIssue(event(request),reset,[stock]),/STALE/);
 const current=applySharedSectorEdits([stock],reset.entries,reset.revisions)[0];assert.equal(sharedEditRequest(current,{}).baseRevision,reset.revisions['005930']);
});
