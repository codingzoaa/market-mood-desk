import { spawnSync } from 'node:child_process';

const checks = [
  ['5분 중복 저장 · 장전 RVOL 캐시', ['--test', '--test-name-pattern=bulk insert uses atomic|pre-open cache freezes', 'tests/pipeline.test.mjs']],
  ['장중/종가 점수 · 부족 데이터 · 확정 검증', ['--test', '--test-name-pattern=four independent calculators|every essential missing feature|intraday RVOL requires|source finality is mandatory', 'tests/leadership-v2.test.mjs']],
];
let failed = false;
console.log('Market Mood Desk — 로컬 핵심 점검 (합성 데이터 전용)\n');
for (const [name, args] of checks) {
  console.log('▶ ' + name);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) { failed = true; console.error('실패: ' + name, result.error?.message ?? ''); }
}
console.log(failed ? '\n핵심 점검 실패: 위 오류를 확인하세요.' : '\n핵심 점검 통과. 실제 LS/Cloudflare 연결 검증은 아닙니다.');
process.exitCode = failed ? 1 : 0;
