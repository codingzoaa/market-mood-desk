import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

test('breadth backfill Python code parses and remains review-only',()=>{
 const py=spawnSync('python3',['-c','import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8").read())','scripts/refresh_kospi_breadth.py'],{encoding:'utf8'});
 assert.equal(py.status,0,py.stderr||'Python syntax failure');
 const workflow=readFileSync('.github/workflows/breadth-refresh.yml','utf8');
 assert.match(workflow,/gh pr create/);
 assert.doesNotMatch(workflow,/gh pr merge|git push origin main/);
 const dataset=JSON.parse(readFileSync('public/market-breadth.json','utf8'));
 assert.equal(dataset.schemaVersion,1);
 assert.equal(dataset.status,'provisional');
});
