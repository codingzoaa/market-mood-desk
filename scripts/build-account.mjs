import {build} from 'esbuild';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
await mkdir('work/account-assets',{recursive:true});
await build({entryPoints:['src/account/main.tsx'],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},outfile:'work/account-assets/app.js'});
await copyFile('src/account/style.css','work/account-assets/app.css');
await writeFile('work/account-assets/index.html','<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>계좌 분석 — 마켓노트</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><noscript>개인 계좌 분석에는 JavaScript가 필요합니다.</noscript><script src="/app.js" defer></script></body></html>');
await build({entryPoints:['worker/account/index.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:sockets'],outfile:'work/account-worker-preview.mjs'});
console.log('Private account UI and Worker built locally; no deployment.');
