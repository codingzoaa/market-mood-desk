# 100종목 비용 · 용량 · 성능 보고서

확인일:2026-10-20. 운영 계정 사용량이나 실제 청구서를 조회하지 않은 **가정 기반 추정**이다. 최신 dashboard 수집은 시장별 최대100개를 유지하고, 아래 N=100은5분 이력의 KOSPI50+KOSDAQ50만 뜻한다. 순위는 매 수집마다 갱신되며 고정100종목의 생존 편향 없는 전체 시장 표본이라고 주장하지 않는다.

## 공식 한도 근거

- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): Free 읽기500만행/일, 쓰기10만행/일, 계정5GB. 인덱스·DELETE도 쓰기 과금. UTC 자정 초기화.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): Free DB당500MB, invocation 쿼리50개, bind100개, 행/BLOB2MB.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Free CPU10ms, 메모리128MB. 네트워크 대기와 CPU는 다르다.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard Free 월10GB-month, Class A100만회, Class B1,000만회. 활성화 전에 최신 플랜 한도를 다시 확인한다.

## 100종목 정상 운영 추정

재생성: `node scripts/pipeline-costs.mjs`. [전체 JSON](cost-estimates.json).

가정: 월22거래일, 하루79슬롯, 매 슬롯100종목 이하, 정상 중복 제거·보관 정리. raw는 R2 유무와 관계없이 이전20거래일+당일, cache/replay는30완료일+당일, 독립 daily store는90완료일+당일. raw+index230byte/행, baseline80byte/행, context3,500byte/종목/일, frame100byte/종목/슬롯, 일봉200byte/행이다. 수정 버전·순위 교체·다중 context·재시도·backlog는 추가 용량을 쓴다.

| 항목 | 일 추정 | 월22거래일 추정 |
|---|---:|---:|
| D1 읽기 행 | 202,760 | 4,460,720 |
| D1 쓰기 행 | 52,319 | 1,151,018 |
| 새 raw 행 | 7,900 | 173,800 |
| 새 raw 논리 byte | 1,817,000 | 39,974,000 |
| 기존 LS TR 계획 상한 | 2,449 | 53,878 |
| 이력용 추가 live TR | 0 | 0 |

정상 보관 상태의 D1 예상 용량은 **94.909MB**로 R2 on/off가 같다. 이 중 raw21세션은38.157MB, 나머지는 cache/replay/context/일봉이다. 기준일마다 universe가 바뀌거나 context가 여러 번 생성되면 늘어난다. 정상 정리 이후 raw 순증가는 대략0이고 신규 일별 유입량과 실제 파일 증가량은 다르다. 기존 dashboard 전체 DB·다른 서비스 저장량은 별도다.

쓰기 산식은 raw INSERT+보조 index 및 만료 DELETE+index의4×7,900, baseline 생성·만료의2×7,900, replay frame/index316행, 기존 경로 여유4,000행, 기타 메타/계측316행, 원자 수집 예약79행·정리 예약8행, 일봉 생성·만료200행을 합해52,319행이다. 일봉·벤치마크 추가 심볼/수정본/백필은 별도 증가분이다. 읽기는20×7,900 장전 집계 +4×7,900 조회·정리 여유 + 기존10,000 + 예약/캘린더/정리 쿼리3,160행으로202,760행이다. 인덱스 탐색 등 실제 D1 scanned rows와 완전히 같은 값은 아니다.

기존 수집 TR은31회/슬롯×79를 계획용 여유로 유지했다. 이력을100종목으로 줄였다고 기존 수집 API가 절반으로 줄지는 않는다. 실제 재시도/업종 초기화 등에 따라 달라질 수 있다. t8412/t8452의 제공량/continuation/rate가 미검증이므로 백필 종목당 호출 수는 **null/미확인**이다. 초기100종목×20일 전체 백필은158,000 raw 행, index 포함 최소316,000 쓰기여서 일일 예산 내로 나눠야 한다. 실제 작업은 부족분만 계획하며 승인 없이 호출하지 않는다.

## 70,000행 보호 정책

Free100,000보다 낮은 **예상70,000행/일**에서 추가 live history와 승인된 백필도 제한한다. SQL의 원자 예약으로 동시 실행을 조정하며 raw/index 생성·만료 하루분과 유지보수 비용을 선반영한다. 실제 core/기타 누적 쓰기가4,000행 여유를 넘으면 실제 값으로 대체한다. 예약은 중복 재시도/실패 시 환불하지 않아 보수적으로 조기 중단할 수 있다. 임계값70,000은 허용하고70,001 예상은 거절한다. latest snapshot 저장 후 검사하므로 추가 이력 실패가 기존 성공을 덮어쓰지 않는다. DB/계측 조회 실패도 추가 저장을 막는다.

이는 애플리케이션 내부 예측이며 같은 계정의 다른 Worker나 미계측 writes를 완전히 알 수 없다. Free 한도 여유나 정확한 계정 전역 quota 보장을 뜻하지 않는다. 플랫폼 지표를 별도로 확인하고 archive/maintenance runner도 예산 안에서 분할해야 한다. 200종목 이상을 모델에 넣으면100개 범위 초과와70k 보호 정책 경고가 나오지만 실제 live scope를 확대하지 않는다.

## 선택 R2

월22거래일 기준 예상 새 객체2,134개, Class A2,134회, Class B11,352회, 첫 달 보관 증가35.0735MB(압축 가정). 원시500행/part + 일별manifest +79 frame +1 context를 가정하며 read-back/삭제 전 검증을 포함한다. 재현 조회·실패 재시도·추가 context·LIST·장기 누적은 별도다. 객체 증가 byte를 GB-month 청구액으로 간주하면 안 된다. R2 장애 시 검증되지 않은 raw를 지우지 않아 D1 backlog가 증가한다.

## 로컬 실측

`node scripts/benchmark-pipeline.mjs`가 실제 SQLite·합성 입력·MemoryR2로 생성한 [결과](local-benchmark.json)다. 공식 거래일이 아닌 테스트 평일, 실제 네트워크/Cloudflare 과금/Workers CPU가 아닌 Node 측정이다.

| 측정 | 100종목 결과 |
|---|---:|
| raw 한 세션 행 | 7,900 |
| SQLite 파일 증가 | 1,544,192byte |
| raw 한 행 파일 증가 | 195.5byte |
| 제한 RVOL 집계 | 12.46ms |
| 장중 점수 배치 wall / process CPU | 521.73 / 558.55ms |
| replay frame / context 압축 | 4,391 / 19,199byte |

RVOL 벤치마크는20일 중 마지막 날79슬롯, 앞19일은10:00 한 슬롯만 들어있는9,800행이다. 전체20일×79슬롯 성능으로 확대 해석하지 않는다. 점수 이력이 반복적인 합성 fixture라 압축률이 실제보다 좋을 수 있다. **100종목도 Workers Free CPU10ms 안에 들어간다고 판단할 수 없다.** 자동 대량 점수 계산은 기존 Cron에 연결하지 않았으며 분할/플랜 검토와 staging 프로파일링이 필요하다.

## 계측 해석

PipelineDB는 meta.rows_read/rows_written/size_after를 측정한다. 결과 행 수로 scanned rows를 만들어내지 않으며 없는 meta는 unknownMeta로 남긴다. UTC 일자·컴포넌트별 집계, TR별/백필 심볼별 시도 횟수, R2 요청/객체 수, scoreBatch 실행 시간을 제공한다. 공개 읽기는 metrics를 응답하되 저장 쓰기를 추가하지 않는다. 최종 metric UPSERT 자신의 결과는 그 UPSERT에 포함할 수 없으므로 metricFlushes/반환 meter로 보정하고, 계정 전체 사용량의 기준은 Cloudflare 플랫폼 지표다. 로컬 SQLite의 Cloudflare 과금 행 수는 null이다.
