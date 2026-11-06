import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Telegram close cron starts at 16:10 KST and retries 16:25/16:40',()=>{
 const yaml=readFileSync('.github/workflows/telegram-market-close.yml','utf8');
 for(const tick of ['10 7','25 7','40 7'])
   assert.ok(yaml.includes("cron: '"+tick+" * * 1-5'"));
 assert.doesNotMatch(yaml,/cron: '30 8 \\* \\* 1-5'/);
 assert.match(yaml,/MARKET_DETAILS_URL: https:\/\/market-note-ls-api\.kby0991\.workers\.dev\/api\/market-details/);
 assert.ok(yaml.includes('telegram-market-close-v1-${{ steps.day.outputs.key }}'));
});
