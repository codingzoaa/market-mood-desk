import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('market-note pension refresh starts at 16:30 KST every KRX weekday',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/kospi-pension-daily.yml',import.meta.url),'utf8');
 // GitHub cron is UTC; KST = UTC+9 with no daylight saving adjustment.
 assert.match(workflow,/^\s+- cron: '30 7 \* \* 1-5'\s*$/m);
 assert.match(workflow,/^\s+- cron: '40 9 \* \* 1-5'\s*$/m);
 assert.match(workflow,/run: node scripts\/update-kospi-pension\.mjs|node scripts\/update-kospi-pension\.mjs/);
 assert.match(workflow,/git push origin HEAD:main/);
 assert.match(workflow,/concurrency:[\s\S]*?cancel-in-progress: false/);
});

test('a successful LS pension import triggers a GitHub Pages deployment',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_run:/);
 assert.match(workflow,/workflows: \['Update KOSPI pension signal data'\]/);
 assert.match(workflow,/types: \[completed\]/);
 assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/);
 assert.match(workflow,/uses: actions\/deploy-pages@v4/);
});
