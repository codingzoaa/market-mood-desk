import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Telegram close cron runs 16:10 KST with 16:25/16:40 retries',()=>{
 const yaml=readFileSync('.github/workflows/telegram-market-close.yml','utf8');
 assert.match(yaml,/cron: '30 8 \* \* 1-5'/);
 assert.match(yaml,/cron: '0 9 \* \* 1-5'/);
 assert.ok(yaml.includes("cron: '40 7 * * 1-5'"));
 assert.doesNotMatch(yaml,/cron: '30 16 \* \* 1-5'/);
 assert.match(yaml,/MARKET_DETAILS_URL: https:\/\/market-note-ls-api\.kby0991\.workers\.dev\/api\/market-details/);
 assert.doesNotMatch(yaml,/market-note-ls-api\.example/);
 assert.ok(yaml.includes('telegram-market-close-v1-${{ steps.day.outputs.key }}'));
});
