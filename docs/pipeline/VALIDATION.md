# 검증 결과

2026-10-20 로컬 실행:

- `npm test` 및 `node --test --test-isolation=none tests/*.test.mjs`: **91개 통과, 실패0** (기존82개 + 100종목 최적화9개)
- `npx tsc --noEmit`: 통과. TS 분석 엔진과 입력/배치 adapter 대상.
- `npm run build`: 통과. 기존 dist/index.html 변경 없음.
- `node scripts/build-worker.mjs`: 통과. 로컬 bundle 생성만, Cloudflare 업로드 없음.
- `git diff --check`: 통과.
- `node scripts/pipeline-costs.mjs`:100종목, R2 on/off 추정 파일 생성.
- `node scripts/benchmark-pipeline.mjs`:100종목 실제 로컬 SQLite/합성 score/MemoryR2 측정 파일 생성.

## 100종목 최적화 검증

시장별 거래대금 top50·동률 순서·원본200종목 불변,22개 이전 거래일+당일에서20+당일만 남는 경계, 당일 대금을 크게 넣어도 RVOL 합계에서 제외, 신규/부족 종목 BACKFILL_REQUIRED, 일봉90일 독립 보관·known-at 수정본 차단,70k 허용/70k+1 거절·동시 예약·최신 snapshot 유지, 동일 cutoff에서INTRADAY/EOD 공존, 성공 hook의 bounded 정리·backlog 삭제 쓰기 예산,100종목 비용 산식을 검증했다.

기본 Node test subprocess 모드가 이 환경에서 파일 단위 합계만 표시하므로 isolation=none으로91개의 개별 테스트를 추가 확인했다.

## 기존 파이프라인 검증

JSON bulk/트랜잭션·중복 PK·원본 불변, flag off DB 미접근, 추가 테이블 실패 때 최신 snapshot 유지,20일 cache/IPO/19개 표본/null/미래 availability 차단, preopen 이외 캐시 생성 거절, R2 hash 불일치/장애시 삭제 중단, sealed day 삽입 거절과 분할 재개, R2 미사용도 이전20거래일+당일 보관, 압축 입력·결과 재현/키 충돌, raw 제거 후 재현, D1 frame/context 제거 후 R2 재현, 백필 검토·승인 gate/진행/재시도 checkpoint·완료 재호출 방지·미충족 terminal PARTIAL, meta 계측 및 SQL budget, 일별 counter 합산, 읽기 API의 공급자 호출·쓰기0, SQLite query plan 인덱스 사용, 자격정보 임의 필드 저장 차단, Free 비용 위험 경고.

기존 UI·수집 종료·TLS/OAuth·출처·복수 테마·상품 제외·모바일 viewport 계산 회귀 검사도 유지했다. 실제 모바일 실기기 픽셀 검증은 하지 않았다.

## 하지 않은 것

운영 D1 조회/스키마 적용/데이터 쓰기·백필, 운영 Worker/Pages/R2 배포, 실제 LS 추가 API 호출, t8412/t8452 세부 계약의 확인 완료, 실제 공급자 단위 검증, 공식 캘린더 수집, 생산 score 생성, Cloudflare CPU/과금 행 수 실측, 운영 스케줄 추가. 비용 파일은 계정 청구서가 아니며 백필 호출 수는 미검증 상태다.
