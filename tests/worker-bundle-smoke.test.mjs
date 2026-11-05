import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

test('Cloudflare Worker entry resolves and bundles independently of the Pages build',async()=>{
 const result=await build({entryPoints:['worker/index.mjs'],bundle:true,platform:'browser',format:'esm',target:['es2022'],external:['cloudflare:*','node:*'],write:false,logLevel:'silent'});
 assert.ok(result.outputFiles?.[0]?.contents.length>1000);
});
