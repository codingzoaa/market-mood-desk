# 운영 활성화 · 롤백 제안 (미실행)

운영 Worker/DB/R2/Secret/스케줄은 이번 작업에서 변경하지 않았다. PR을 병합하거나 아래 절차를 실행하지 않았다.

1. PR #1 및 이 PR의 입력 계약, 코드와 비용 추정을 검토한다. Cloudflare 실제 계정 플랜/남은 D1 한도/기존DB 크기를 관리자 화면에서 확인한다. 이번 개발에서는 운영DB나 계정 사용량을 조회하지 않았다.
2. 별도 스테이징 D1을 만들고 `worker/pipeline/schema.sql`만 검증한다. 현재 스키마에 additive하지만 메모리 테스트가 실제 D1 migration을 대신하지 않는다. 공식 거래일 목록과 정규화된 UTC known_at/source를 검증해 넣는다. 승인 전 seed/백필 금지.
3. 기본 플래그는 미설정(off). 승인 후 `ENABLE_HISTORY_PIPELINE=true`를 스테이징에서만 켠다. 기존 LS 응답을 재활용하고 최신 snapshot 보존, append 실패, daily quota 영향, 숫자/단위/시각을 확인한다. 쿼리·CPU·storage를 Cloudflare meta와 플랫폼 지표에서 실측한다.
4. 장전 cache를 위해 별도08:50 KST Cron `50 23 * * SUN-THU`를 제안한다. 기존2개 정규장 Cron은 유지한다. 이 추가 Cron은 D1만 읽고 LS를 호출하지 않는다. 실제 스케줄/Trigger 개수 한도 검토·승인 전 Wrangler에 추가하지 않았다. 캘린더 부족 또는 기준값 미생성 시 장중에 재집계/LS 재호출하지 않고 null을 반환한다.
5. 선택적으로 private R2 bucket을 `HISTORY_ARCHIVE`로 binding하고 `ENABLE_R2_ARCHIVE=true`를 승인 후 설정한다. 아카이브/정리 runner는 내부관리 작업으로만 연결한다. 현재 공개 GET이나 정규장 core가 R2 쓰기/백필/삭제를 실행하지 않는다. 테스트 runner의 MemoryR2는 실제 R2가 아니다.
6. raw archive는 한 페이지/호출씩 재개하고, 전체 manifest 검증 전에는 삭제하지 않는다. replay도 별도 압축 frame/context를 읽어 검증한다. R2 유무와 관계없이20완료 거래일+당일 raw hot set, 별도30일 분석 cache, 독립 daily_bars의90완료 거래일+당일을 보존한다. 일봉 입력/정리 runner와70k 쓰기 예산을 검증한다.
7. 실제 백필은 PROVIDER-REVIEW.md의 미검증 항목을 해결하고, 대상 종목·기간·페이지 수·rate·시장·총 예상 호출량·실패 정책을 별도 승인받는다. `t8412/t8452` 공식 세부 계약이 확인되지 않아 이번 PR만으로 실행할 수 없다.
8. 성능이 필요한 점수 batch는 분할 스케줄러/유료 Cron에서 관리하고 버전별 context/frame 보존을 검증한다. 기존15:30 종료 정책 변경이나 확정 OHLC 확보를 위한 추가 호출은 별도 승인 대상이다.

## 배포 산출물

현재 소스는 `worker/pipeline/*.mjs`를 import한다. **기존4개 모듈만 올리는 과거 업로드 도구를 그대로 쓰면 안 된다.** `node scripts/build-worker.mjs`는 `cloudflare:sockets`만 external로 둔 로컬 단일 모듈 preview를 `work/`에 생성한다. 이 명령은 업로드하지 않는다. 승인 후 해당 bundle과 기존 D1/DO/Secret/compatibility 설정을 함께 검증하는 별도 배포 절차가 필요하다. 기존 Wrangler 설정은 변경하지 않았다.

## 롤백

- 문제시 `ENABLE_HISTORY_PIPELINE`와 `ENABLE_R2_ARCHIVE`를 끈다. 기존 snapshot/read/수집 주기 경로는 계속 사용한다.
- 필요시 승인된 이전 Worker 버전으로 복귀한다. 저장된 raw/frame/context/R2 객체를 DROP하거나 지우지 않는다.
- 마이그레이션은 additive이며 기존 snapshots/state/themes를 수정하지 않는다. 새 테이블을 삭제하는 rollback은 별도 승인과 백업 검증 후 수행한다.
- 부족 데이터 때문에 점수가 null인 상태는 오류를 숨기기 위해0점·가상데이터·이전 확정값으로 덮어쓰지 않는다.

## PR 관계

PR #1 브랜치를 base로 하는 stacked 검토 PR이다. 기존 Pages workflow는 main 대상 PR만 검사하므로, 이 base의 PR에서는 `pipeline-review.yml`로 test/typecheck/client build/Worker preview build만 실행한다. 배포 job·Cloudflare 토큰 접근·운영 migration 단계는 없다.
