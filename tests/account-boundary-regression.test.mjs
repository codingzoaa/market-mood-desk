import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

test('private account Worker is separate and public Worker cannot reference private bindings',async()=>{
 const publicWorker=readFileSync('worker/index.mjs','utf8');
 const privateWorker=readFileSync('worker/account/index.mjs','utf8');
 const config=readFileSync('worker/account/wrangler.example.jsonc','utf8');
 for(const forbidden of ["from './account/",'PRIVATE_DB','ACCOUNT_ENCRYPTION_KEY','LS_ACCOUNT_NO']){
  assert.equal(publicWorker.includes(forbidden),false,'public Worker must not contain '+forbidden);
 }
 assert.ok(privateWorker.includes('accountWorker'));
 assert.ok(config.includes('"PRIVATE_DB"'));
 assert.equal(config.includes('"binding":"DB"'),false);
 assert.ok(config.includes('"ENABLE_ACCOUNT_SYNC":"false"'));
 const result=await build({entryPoints:['worker/account/index.mjs'],bundle:true,platform:'browser',format:'esm',external:['cloudflare:*','node:*'],write:false,logLevel:'silent'});
 assert.ok(result.outputFiles?.[0]?.contents.length>1000);
});
