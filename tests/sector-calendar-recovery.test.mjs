import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/sector-calendar-publish.yml','utf8');
test('calendar has an independent close-data completion wake-up and preserves trusted main checkout',()=>{
 assert.match(workflow,/workflow_run:\s+workflows: \['Update KOSPI pension signal data', 'Relay Naver sector news to Cloudflare'/);
 assert.match(workflow,/head_repository\.full_name == github\.repository/);
 assert.match(workflow,/head_branch == 'main'/);
 assert.match(workflow,/ref: main/);
 assert.match(workflow,/cron: '0 8 \* \* 1-5'/);
 assert.match(workflow,/cron: '7,37 8,9 \* \* 1-5'/);
});
test('branch date comes from the validated review result and pending is visibly unsuccessful',()=>{
 assert.match(workflow,/sector-calendar-result\.json/);
 assert.ok(!workflow.includes('REVIEW_DATE="$(TZ=Asia/Seoul date +%F)"'));
 assert.match(workflow,/date=\$\{result\.date\}/);
 assert.match(workflow,/if\(r\.status==='pending'\).*process\.exit\(1\)/);
 assert.match(workflow,/GITHUB_STEP_SUMMARY/);
 assert.equal((workflow.match(/changed == 'true' && \(steps.review.outputs.result == 'published' \|\| steps.review.outputs.result == 'pending'\)/g)||[]).length,5);
 assert.ok(!workflow.includes("workflow_run.conclusion == 'success'"));
});

