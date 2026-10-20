# 5분 이력 · RVOL · 재현 파이프라인 (운영 비활성)

기반: PR #1 `f2ecfbcf6aef7005c6aec9b101190e2b4377c215`.
개발 브랜치: `feature/history-rvol-pipeline`. 이 문서의 코드/스키마는 검토 대상이며 운영 D1·Worker·R2에는 적용하지 않았다. 기본 플래그가 없으면 기존 수집·공개 화면은 기존대로 동작한다.

## 구현 범위

| 요구 | 구현 | 활성화 전 조건 |
|---|---|---|
| 기존 수집 재사용 | core LS 응답의 수신 시각을 기록하고 기존 snapshot UPSERT 성공 이후 optional hook 실행 | `ENABLE_HISTORY_PIPELINE=true`, 별도 스키마 승인 |
| 5분 이력 | `(date,symbol,slot)` WITHOUT ROWID PK, JSON 한 바인딩으로 batch INSERT OR IGNORE | 초기 과거 이력은 없음, 미래 수집부터 축적 |
| 장전 RVOL | 검증된 직전20거래일의 동일 슬롯 SUM/COUNT를 날짜·버전별 동결 | 실제 캘린더와 추가08:50 유지보수 Cron 승인 |
| 신규 상위 종목 | 표본 수19이하/분모0/슬롯·버전 불일치는 null | 전일 최종 대금이나0으로 채우지 않음 |
| 엔진 입력 | 누락 필드 보고, 캐시 RVOL, 별도 확정 OHLC/벤치마크 주입, 분리된 INTRADAY/EOD 호출 가능 | 이전 PR의 실제 필수 데이터 확보는 여전히 필요 |
| 백필 | gaps-only 계획, 검토·승인 잠금, 1페이지/실행, rate lease, 응답 checkpoint, 진행/안전 오류/해시 | t8412/t8452의 실제 스키마·한도·제공 범위 미검증, 실제 adapter 없음 |
| R2 | 날짜별 gz JSON 분할, 원본 건수/해시/가용 시각, read-back 검증 및 재개 | 선택 binding/플래그/비용 검토 승인 |
| 과거 점수 재현 | 공통 과거 context 1개 + 시점별 압축 frame, 모드·시각·버전별 불변 저장 | 실제 점수는 데이터 충족 시에만, 자동 대량 계산은 연결 안 함 |
| 비용 계측 | D1 meta, UTC 일별 집계, TR별 시도 횟수, backfill 종목별 횟수, R2 ops, scoreBatch 시간 | 실제 Cloudflare 과금/CPU는 staging과 플랫폼 지표에서 확인 |

## 1. 실제 수집 경로

`collect()` → 기존 LS 조회 → 기존 원자적 `snapshots`/테마 저장 → 기존 sync/DONE 성공 → `captureAfterLatest()`.

같은 시세를 다시 요청하지 않는다. 종목별 `observed_at`은 t1463 응답 수신 시각이며 `available_at`은 history hook이 데이터를 사용할 수 있게 된 시각이다. 현재 t1463 정규화 데이터에는 원천 체결/시세 시각이 없으므로 **source_quote_at=null, timing_basis=RECEIPT_TIME**이다. 이를 거래소 원천5분봉이라고 표시하면 안 된다. 수신 시간이 다른5분 슬롯으로 넘어가면 그 실제 슬롯에 저장하며 시작 시각으로 소급하지 않는다.

이력 insert 실패, 미적용 테이블, telemetry 실패는 모두 격리한다. 최신 스냅샷을 rollback하거나 수집 실패로 덮어쓰지 않는다. 다만 **같은 계정의 D1 일일 quota 자체를 소진하면 이후 최신 조회도 영향을 받는다**. try/catch로 quota를 격리할 수 없으므로 무료 한도 검토 없이 활성화하면 안 된다. COSTS.md 참고.

core/details 계측은 기존 D1 호출의 meta를 수집한다. 공급자 호출 직전 TR별 횟수를 증가시키므로 실패 시도도 포함한다. OAuth는 TR 집계와 다르고, 네이버 요청 수는 LS TR 수가 아니다. 공개 읽기에서 공급자·알람·캐시 생성·백필은 실행하지 않는다.

## 2. D1 키·인덱스·실행 제한

리뷰 전용 DDL: `worker/pipeline/schema.sql`. 기존 `worker/schema.sql`이나 Wrangler migrations에는 연결하지 않았다.

- history PK `(date,symbol,slot)`는 거래일별 아카이브/삭제/특정 종목 조회를 지원한다. `history_symbol_slot_date(symbol,slot,date)`만 추가해 동일 시각 조회를 줄인다. 인덱스에는 추가 쓰기 비용이 있다.
- 한5분 슬롯에서 같은 종목은 첫 관측만 저장한다. 동일 키 재시도는 INSERT OR IGNORE, 수정 값으로 과거 관측을 덮어쓰지 않는다. 임의 revision을 기존 키에 끼워 넣지 않는다.
- capture 최대1,000행/JSON1.5MB, JSON 바인딩1개, 트랜잭션 batch. 원래 core 수집은 현재 시장별100개 범위다. 500/1,000은 저장 계층의 용량 시나리오이며 기존 LS 수집 범위를 변경하지 않았다.
- `PipelineDB`는 invocation별 SQL 예산(기본24개, 수집 hook12개, read8개, preopen12개)을 강제한다. 기존 수집의 쿼리도 합산해 플랜 한도와 비교해야 한다. SQL batch도 statement별로 예산 차감한다.
- R2 원시 archive는 실행당 최대1,000행(기본500) 한 페이지만 처리하고 cursor/part/lease를 저장한다. 모든 원본을 메모리에 올리거나 한 번의 Cron에서 전체 날짜를 반복하지 않는다.
- 백필 계획은 실행당 최대20종목×20일×79슬롯. 실제 페이지는 최대1,000행·3거래일·1.5MB. 더 큰 범위는 외부 작업 스케줄러가 분할해야 한다.
- scoreBatch는 재현 가능한 순수 라이브러리이며 기존 Cron에서 자동 실행하지 않는다. 로컬 CPU 측정상 대량 계산은 Free10ms에 적합하다고 볼 수 없다. 유료 Cron 또는 별도 승인된 분할 job 설계가 필요하다.

## 3. RVOL 장전 캐시와 시점 일관성

`trading_sessions`는 실제 제공원이 확인한 open/휴장 날짜와 당시 알게 된 known_at/source를 받는다. **평일 배열을 운영 캘린더로 자동 생성하지 않는다.** 모든 저장 시각은 UTC ISO `...sssZ`로 정규화해야 한다. 거래일/슬롯은 KST다.

08:50에 `prepareRvolDay()`를 호출하면 target_date 이전의 검증된20거래일만 고른다. 그 시각 이전에 확보된 이력만 집계한다. `rvol_days`에 cutoff/dates/version을 기록하고, `rvol_baselines`에 target_date/symbol/slot/version, sum_turnover/samples/timing_basis를 기록한다. batch가 완료되면 ready=1이고 이후 재실행은 재사용한다. 동시 실행도 첫 cutoff 이후의 자료를 섞지 않도록 SQL이 저장된 cutoff/days를 사용한다.

장중 `/api/rvol`은 위 캐시만 읽는다. 표본20개가 정확히 있고 기간·슬롯·가용시각·버전·timing_basis가 맞아야 엔진에서 사용한다. 동일 시각 누락/신규 상장/새 순위 진입은 부족으로 남긴다. 장마감 대금으로 장중 RVOL을 대체하지 않는다. 후행 백필은 실제 fetch 시각을 available_at으로 저장하므로 과거에 동결된 기준값이나 점수로 소급 유입되지 않는다.

현재 live의 RECEIPT_TIME 표본과 향후 SOURCE_TIME 백필은 동일하다고 추정하지 않는다. 한 캐시 기간에 두 basis가 섞이면 계산을 막는다. source-time 제공원으로 전환하려면 독립 버전과 원천 계약 검증이 필요하다. cached Baseline과 기존20일 원시 계산은 같은 산식이며 캐시 증거가 잘못되면 원시 경로로 우회하지 않고 null이다.

## 4. 20일 원시 vs R2 없이30일 분석

두 요구를 안전하게 함께 만족하려면 모드를 구분해야 한다.

- R2 사용: 직전20완료 거래일 + 당일을 D1 원시 hot set으로 유지. 그보다 오래된 날짜는 sealed 상태이고 R2 manifest 검증 기록이 있어야 정리한다. 삭제 직전 manifest 접근/해시를 다시 확인하며 R2 장애면 삭제하지 않는다.
- R2 미사용: 직전30완료 거래일 + 당일을 D1에 유지한다. R2 없이20일을 강제로 지우면서30일 원시 조회를 보장할 수는 없기 때문이다. 이 차이는 명시적인 안전 보관 정책이다.
- frozen RVOL·압축 점수 frame/context는 별도로30완료 거래일 보관 가능. 오래된 R2-backed frame은 R2 원본/context를 다시 검증한 뒤에만 삭제하며, R2 미사용 모드의 명시된30일 분석 창 밖은 제한된 batch로 정리한다.
- 원시/점수/context 삭제 모두 한 번에 제한된 행만 처리한다. 지워지지 않는 R2 장애에서는 용량이 증가할 수 있으므로 경고·업무 중단/스토리지 확보가 필요하다. 공간을 맞추려고 검증되지 않은 데이터를 삭제하지 않는다.
- 확정 daily OHLC/60일 RS 자료는 이 원시5분 hot set과 다르다. 기존 LS 데이터만으로 이를 새로 만들어 넣지 않는다.

## 5. 압축 점수 재현

`saveReplay()`는 common calendar/종목·벤치마크 과거 이력을 context hash로 분리해 같은 내용은 한 번만 저장한다. 시점별 current quotes/캐시 증거/엔터티 요청/결과는 gzip frame으로 묶어 종목마다 반복되는5분 점수 행을 줄인다. shared context는 관측 범위/수정 이력 변화가 있을 때 새 hash가 된다. 이력 배열의 동적 수정으로 과거 frame을 덮어쓰지 않는다.

키는 `(date,as_of,mode,methodology_version)`이다. 같은 키·같은 해시는 재사용하고 같은 키의 다른 결과는 충돌로 거절한다. `loadReplay()`와 `replayScores()`가 저장된 입력을 복구해 당시 엔진으로 재계산한다. 실행 당시 코드 버전도 보관해야 하므로 방법론 버전별 코드 배포 artifact를 별도로 보존해야 한다. R2에 frame과 context를 검증 보관하면 D1의 원시/점수 데이터 정리 후에도 `loadArchivedReplay()`로 복원할 수 있다.

재현 payload는 타입 계약의 필드만 선택 저장하고 메모·앱키·OAuth 응답 같은 임의 필드를 복사하지 않는다. 임의 대형 context/frame은 각각 gzip1.5MB를 넘으면 저장을 거절한다. 새로운 역사 데이터를 추가해 다른 결과를 얻으려면 새 버전/새 cutoff에서 계산해야 한다.

## 6. 선택적 읽기 API

플래그가 off면 모두404, 기존 API는 그대로다. 켜진 경우:

- `GET /api/history?symbol=005930&from=YYYY-MM-DD&to=YYYY-MM-DD&slot=1000&limit=4000`
- `GET /api/rvol?date=YYYY-MM-DD&asOf=ISO&slot=1000&symbols=005930,000660`
- `GET /api/replay?date=YYYY-MM-DD&asOf=ISO&mode=INTRADAY&version=...`

D1 meta 계측과 함께 저장 데이터만 반환한다. 현재 CORS/GET 제한을 그대로 적용하고 공급자 호출/DB 쓰기를 하지 않는다. UI에는 연결하지 않았다. 요청 한도·페이지·캐시/접근 정책도 운영 활성화 전에 검토해야 한다. R2 replay fallback은 `ENABLE_R2_ARCHIVE=true`와 `HISTORY_ARCHIVE` binding이 모두 있을 때만 읽는다.
