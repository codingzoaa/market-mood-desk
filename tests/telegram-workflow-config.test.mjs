import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('two independent Telegram briefings retry every 30 minutes from 16:10 to 19:10 KST',()=>{
 const y=readFileSync('.github/workflows/telegram-market-close.yml','utf8');
 assert.ok(y.includes("cron: '10,40 7-9 * * 1-5'"));
 assert.ok(y.includes("cron: '10 10 * * 1-5'"));
 for(const part of [
  'kind: close','kind: sector',
  'scripts/telegram-market-close.mjs',
  'scripts/telegram-sector-briefing.mjs',
  'telegram-delivered-v2-',
  "steps.once.outputs.cache-hit != 'true'",
  "steps.send.outcome == 'success'",
  'telegram-delivery-status.mjs',
  "github.event.schedule == '10 10 * * 1-5'"
 ])assert.ok(y.includes(part),part);
 assert.ok(!y.includes("cron: '25 7 * * 1-5'"));
});
