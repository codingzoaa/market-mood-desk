# 비용 · 용량 · 성능 보고서

확인일: 2026-10-20. **추정·로컬 실측·운영 과금은 서로 다르다.** 이번 작업은 실제 LS/Cloudflare D1/R2 사용량을 만들거나 운영 계정의 사용량을 조회하지 않았다.

## 공식 한도 근거

- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): Free 일일 읽기500만행/쓰기10만행, 계정 저장5GB. 인덱스 갱신과 DELETE도 쓰기 비용에 포함된다. UTC 자정에 일일 한도가 초기화된다.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): Free DB당500MB, invocation 쿼리50개, statement 바인딩100개, 행/BLOB2MB. batch의 개별 statement에도 제한이 적용된다.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Free CPU10ms, 메모리128MB. 유료5분 Cron의 CPU 한도와 wall-time15분은 다른 개념이다. 네트워크 대기는 CPU 시간이 아니다.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard Free 월10GB-month, Class A100만/월, Class B1,000만/월. Infrequent Access에는 동일 무료 조건을 적용하지 않는다.

## 월간 운영량 추정

재생성: `node scripts/pipeline-costs.mjs`. 기계 판독용 가정/경고/전체 결과: [cost-estimates.json](cost-estimates.json).

가정: 월22거래일, 하루79슬롯, 고정 관측 종목 수, 중복 없는 정상 실행, 정상 보관/정리 완료. 원시+인덱스230byte/행, baseline80byte/행, context3,500byte/종목/일, frame100byte/종목/슬롯, 보수적인30완료 거래일+당일 분석 cache. R2가 켜지면 원시만20완료 거래일+당일이다. 과거 context는 기본1개/일이지만 당일 universe/수정자료 변화시 여러 버전이 생겨 용량이 증가한다. 정리 backlog·재시도·신규 symbol 증가·재현 조회 트래픽은 별도다.

기존 수집/상세/기타에 일일 읽기10,000·쓰기4,000행을 가정하고, 수집 TR은 회차당31회×79회로 계획용 상한 시나리오를 넣었다. 이는 계정 실측이 아니다. 최초 업종 구성 보강·재시도나 공급자 동작에 따라 더 클 수 있다. 현 수집기는 최대200개이며500/1,000은 **저장 계층 용량 시나리오**다. 수집 범위를 확대하지 않았고 TR 수가 모든 N에서 실제로 같다고 주장하지 않는다. 기존 응답을 재활용하는 추가 live 중복 TR은0이다.

행수 모델:

- 새 원시 `N×79`, 원시 INSERT+보조 인덱스와 정상 만료 DELETE+인덱스로 총4배 쓰기.
- baseline INSERT+만료로2배 쓰기.
- 점수는 종목별 행을 만들지 않고 slot별 frame/context-reference로 묶는다. 부가 계측·기존 경로 비용을 합산한다.
- 장전 집계는20일 원시를 한 번 읽고 장중은 캐시를 읽는다. index 탐색/삭제/측정 여유를 더한 추정이며 D1 실제 scanned rows를 대신하지 않는다.

| 종목 수 | 일 읽기 추정 | 일 쓰기 추정 | 월 읽기 추정 | 월 쓰기 추정 | D1 보관 MB(R2 없음 / 있음) |
|---:|---:|---:|---:|---:|---:|
| 200 | 389,200 | 99,432 | 8,562,400 | 2,187,504 | 222.5 / 186.2 |
| 500 | 958,000 | 241,632 | 21,076,000 | 5,315,904 | 556.3 / 465.4 |
| 1,000 | 1,906,000 | 478,632 | 41,932,000 | 10,529,904 | 1112.6 / 930.9 |

**200종목도 쓰기 한도에 여유가 거의 없고, 500·1,000종목은 추정 일일 쓰기가 Free 한도를 넘는다.** R2를 써도 raw INSERT/DELETE 및 baseline 쓰기는 없어지지 않는다. 500종목 R2 미사용·1,000종목은 DB당 저장 한도 위험도 있다. 이 값만 믿고 무료 플랜을 활성화하면 안 된다.

| 종목 수 | 월 새 원시 행 | 월 원시 논리 증가 MB | 기존 TR 계획용 월 횟수 | 추가 live 중복 TR |
|---:|---:|---:|---:|---:|
| 200 | 347,600 | 79.9 | 53,878 | 0 |
| 500 | 869,000 | 199.9 | 53,878 | 0 |
| 1,000 | 1,738,000 | 399.7 | 53,878 | 0 |

백필 종목당 실제 호출 수는 **미확인**이다. 공식 제공 건수·continuation·기간·rate를 검증하기 전 임의의 페이지 수를 정답처럼 넣지 않았으며 JSON 값은 null이다. 검증 후 P페이지/대상 종목을 입력하면 `대상 수×P`로 추가 횟수를 계산한다. 초기200종목 전체20일×79슬롯을 모두 백필하면 원시만316,000행이고 index 포함 최소632,000행 쓰기여서 별도 일일 예산으로 분산해야 한다. 실제 계획은 이미 가진 슬롯을 제외한 신규/부족 종목만 대상이다.

| 종목 수 | R2 월 객체 증가 | Class A 추정 | Class B 추정 | 첫 달 보관 증가 MB(압축 가정) |
|---:|---:|---:|---:|---:|
| 200 | 2,486 | 2,486 | 12,232 | 70.1 |
| 500 | 3,520 | 3,520 | 14,828 | 175.4 |
| 1,000 | 5,258 | 5,258 | 19,162 | 350.7 |

R2는500행/원시 part + 일별manifest +79 replay frame +1 context를 가정한다. GET/HEAD 검증과 정상 만료 삭제 전 재확인을 포함하며 사용자 재현 조회/실패 재시도/LIST 요청은 별도다. 첫 달 보관 증가량은 GB-month 청구액이 아니고, 장기 객체를 계속 보관하면 누적된다. context가 자주 바뀌거나 실제 시계열 압축률이 나쁘면 증가량도 더 커진다.

## 로컬 실측

재생성: `node scripts/benchmark-pipeline.mjs`. [local-benchmark.json](local-benchmark.json)은 Node24 + 실제 SQLite + 합성 입력 + MemoryR2의 측정이다. 운영 데이터, Cloudflare billing/Workers CPU, 실제 R2 latency가 아니다. 공식 거래일 대신 테스트용 평일 fixture를 사용했다.

- 원시 보관 용량: 정확히 한 세션의79슬롯을 실제 SQLite에 넣고 page_count×page_size 증가량을 측정했다.
- RVOL:20세션 중 마지막 날은79슬롯, 앞19일은10:00 한 슬롯만 넣은 제한된 측정이다. 전체20일×79슬롯 집계 성능으로 확대 해석하지 않는다.
- 점수: 필수 이력이 갖춰진 합성 sector→stock 장중 배치의 wall/프로세스 CPU 시간이다. 종목 이력이 매우 반복적이라 압축률도 실제보다 좋을 수 있다.
- R2: 로컬 메모리 bucket에서 해시·read-back·분할 및 요청 수를 측정했다. 실제 네트워크 지연은 없다.

| 종목 수 | 하루 원시 행 | SQLite 증가 MB | byte/행 | 제한 RVOL 집계 ms | 장중 배치 wall ms / CPU ms | frame/context 압축 KB |
|---:|---:|---:|---:|---:|---:|---:|
| 200 | 15,800 | 3.15 | 199.1 | 22.17 | 1294.58 / 1328.78 | 7.3 / 34.6 |
| 500 | 39,500 | 7.95 | 201.3 | 61.90 | 3482.78 / 3577.67 | 16.0 / 80.5 |
| 1,000 | 79,000 | 15.90 | 201.3 | 112.19 | 6759.65 / 6872.40 | 30.4 / 156.9 |

이 측정으로 Workers Free CPU 제한에 들어간다고 판단할 수 없습니다. 대량 점수 계산은 기존 정규장 Cron에 연결하지 않았고, 활성화 전에 Workers 프로파일링과 분할/유료 플랜 검토가 필요합니다.

## 계측 해석

`PipelineDB`는 D1 응답 meta.rows_read/rows_written/size_after를 수집한다. 결과 행 수를 scanned rows로 가장하지 않는다. meta가 없으면 unknownMeta를 증가시키고, 로컬 SQLite 보고서의 Cloudflare 과금 값은 null이다. size_after는 DB 크기 gauge이며 변화량을 비교해야 한다.

UTC 일자·컴포넌트별 집계를 invocation마다 한 번 UPSERT하고 종목별/쿼리별 metric 행은 만들지 않는다. core/details TR 시도 횟수, backfill 심볼별 호출 수, R2 PUT/GET/HEAD/새 객체 수를 숫자로 보관한다. `scoreBatch()`는 함수 실행 소요 시간을 반환한다. 공개 read API는 계측을 응답하지만 이 계측 때문에 D1 쓰기를 추가하지 않는다.

metric UPSERT 자체의 meta는 실행 후 로컬 meter에 포함되지만, 같은 UPSERT 안에 자기 결과를 정확히 다시 저장할 수는 없다. persisted 합계에는 마지막 flush 자체가 빠지므로 metricFlushes/실행 반환값으로 보정하고, **계정 전체 확정 사용량(공개 GET·다른 Worker 포함)은 Cloudflare 플랫폼 지표가 기준**이다. 같은 데이터를 scope별 중복 합산하지 않도록 core/details와 추가 capture의 DB binding을 구분했다. 플랫폼 CPU·쿼리 quota·저장 gauge는 운영 활성화 후 별도로 관찰해야 한다.

보관/수집 실패·R2 장애·백필·추가 UI 트래픽이 있으면 추정치와 달라진다. quota 소진은 기존 최신 시세에도 영향을 주므로 데이터 보존을 위해 무검증 삭제를 하거나 데이터 부족을 숨겨서는 안 된다.
