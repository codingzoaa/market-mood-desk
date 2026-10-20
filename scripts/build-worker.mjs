import {build} from 'esbuild';
await build({entryPoints:['worker/index.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:sockets'],outfile:'work/pipeline-worker-preview.mjs'});
console.log('Built local Worker preview only; no upload or deployment.');
