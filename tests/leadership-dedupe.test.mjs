import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['src/leadership.ts'],bundle:true,platform:'node',format:'esm',outfile:'work/leadership-tests.mjs',packages:'external'});
const {leadershipGroups}=await import('../work/leadership-tests.mjs');
const stock=(symbol,amount,themes)=>({symbol,name:symbol,market:'KOSPI',themes,turnoverKRW:amount,changePct:5,price:100});
test('one stock with five identical-constituent themes occupies one group; money preserved',()=>{
 const rows=leadershipGroups([stock('000660',500,['A','B','C','D','E']),stock('000001',100,['F'])]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].aliases.length,5);
 assert.equal(rows[0].turnoverKRW,500);
 assert.equal(rows[0].dominance,100);
 assert.equal(rows.reduce((s,r)=>s+r.turnoverKRW,0),600);
 assert.ok(Math.abs(rows.reduce((s,r)=>s+r.share,0)-100)<1e-10);
});
test('overlapping but nonidentical themes stay distinct and unclassified does not merge',()=>{
 const rows=leadershipGroups([stock('000001',300,['A','B']),stock('000002',100,['A']),stock('000003',50,[])]);
 assert.equal(rows.length,3);
 assert.equal(rows.find(r=>r.name==='A').count,2);
 assert.equal(rows.find(r=>r.name==='A').dominance,75);
 assert.equal(leadershipGroups([]).length,0);
 assert.equal(leadershipGroups([stock('000004',10,['A','미분류'])]).length,2);
});
