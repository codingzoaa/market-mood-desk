import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('two independent Telegram briefings retry every 30 minutes from 16:10 to 19:10 KST',()=>{
 const y=readFileSync('.github/workflows/telegram-market-close.yml','utf8');
 assert.match(y,/cron: '10,40 7-9 \\* \\* 1-5'/);
 assert.match(y,/cron: '10 10 \\* \\* 1-5'/);
 assert.match(y,/kind: close/);
 assert.match(y,/kind: sector/);
 assert.match(y,/scripts\/telegram-market-close\.mjs/);
 assert.match(y,/scripts\/telegram-sector-briefing\.mjs/);
 assert.match(y,/telegram-delivered-v2-\$\{\{ matrix\.kind \}\}/);
 assert.match(y,/steps\.once\.outputs\.cache-hit != 'true'/);
 assert.match(y,/steps\.send\.outcome == 'success'/);
 assert.match(y,/Telegram-delivery-status|telegram-delivery-status/);
 assert.match(y,/github\.event\.schedule == '10 10 \* \* 1-5'/);
 assert.doesNotMatch(y,/cron: '25 7/);
});
