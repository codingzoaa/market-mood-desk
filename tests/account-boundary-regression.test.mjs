import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

test('private account Worker is a separate entry and public Worker never imports account data',async()=>{
 const main=readFileSync('worker/index.mjs','utf8');
 const privateMain=readFileSync('worker/account/index.mjs','utf8');
 const example=readFileSync('worker/account/wrangler.example.jsonc','utf8');
 assert.doesNotMatch(main,/from\\s*['"][^'"]*account\\/|PRIVATE_DB|ACCOUNT_ENCRYPTION_KEY|LS_ACCOUNT_NO/);
 assert.match(privateMain,/accountWorker/);
 assert.match(example,/PRIVATE_DB/);
 assert.doesNotMatch(example,/binding"\\s*:\\s*"DB"/);
 assert.match(example,/ENABLE_ACCOUNT_SYNC"\\s*:\\s*"false"/);
 const result=await build({entryPoints:['worker/account/index.mjs'],bundle:true,platform:'browser',format:'esm',external:['cloudflare:*','node:*'],write:false,logLevel:'silent'});
 assert.ok(result.outputFiles?.[0]?.contents.length>1000);
});
