import { build } from 'esbuild';
import {
  readFile,
  writeFile,
  mkdir,
  copyFile
} from 'node:fs/promises';
await mkdir('dist', { recursive: true });
const result = await build({ entryPoints: ['src/main.tsx'], bundle: true, minify: true, write: false, format: 'iife', jsx: 'automatic', target: ['es2022'], define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof' });
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile('src/style.css', 'utf8');
await writeFile('dist/index.html', `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#173c32"><meta name="description" content="주도섹터, 거래대금, 28일 캘린더를 연결하는 개인 주식 대시보드"><title>마켓노트 — 투자 관제실</title><style>${css}</style></head><body><div id="root"></div><noscript>대시보드를 보려면 JavaScript를 켜주세요.</noscript><script>${js}</script></body></html>`);
console.log('Built dist/index.html (self-contained; no CDN or server required)');
await copyFile(
  'public/market-breadth.json',
  'dist/market-breadth.json'
);

console.log('Copied Market Breadth JSON');