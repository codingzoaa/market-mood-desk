import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Cloudflare owns scheduled dual briefings and Github does not schedule delivery',()=>{
 const yaml=readFileSync('.github/workflows/telegram-market-close.yml','utf8');
 const config=JSON.parse(readFileSync('worker/wrangler.jsonc','utf8'));
 const src=readFileSync('worker/index.mjs','utf8');
 assert.ok(!yaml.includes('  schedule:'));
 assert.ok(yaml.includes('  workflow_dispatch:'));
 assert.ok(config.triggers.crons.includes('10,40 7-9 * * MON-FRI'));
 assert.ok(config.triggers.crons.includes('10 10 * * MON-FRI'));
 assert.ok(src.includes('deliverScheduled(event,env)'));
 assert.ok(src.includes('DELIVERY_CRONS.includes(event.cron)'));
 assert.ok(!src.includes('Notify Telegram after successful'));
});
test('Cloudflare deploy provisions Telegram secrets without printing values',()=>{
 const yaml=readFileSync('.github/workflows/deploy-ls-worker.yml','utf8');
 assert.ok(yaml.includes('TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}'));
 assert.ok(yaml.includes('TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}'));
 assert.ok(yaml.includes("'--secrets-file',path"));
 assert.ok(yaml.includes('rmSync(dir,{recursive:true,force:true})'));
});
