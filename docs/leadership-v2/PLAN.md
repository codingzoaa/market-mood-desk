# 운영 적용 준비 및 남은 단계

이 PR의 범위는 Phase 1 감사/품질 모델과 Phase 2 순수 계산 엔진/테스트다. 브라우저 UI, 운영 Worker, 수집 TR, Cron, D1 스키마/데이터, 기존 분석 함수, 배포 워크플로는 변경하지 않는다. `main`에 직접 반영하거나 병합하지 않는다.

## 단계별 상태

| 단계 | 이 PR 결과 | 남은 작업 |
|---|---|---|
| Phase 1 | 코드 감사, 가용성 표, DataQuality 어댑터 | 공급자 문서/운영 데이터의 별도 검증, 실제 품질 UI |
| Phase 2 | 독립4엔진, RS/RVOL/구조/확산/지속성/등급, 입력 시점 검증 | 공식 원천 어댑터 및 데이터 확보 후 교차 검증 |
| Phase 3 | 미착수 | 기존4 WORKSPACE에 읽기 전용 점수/품질/모드 통합 |
| Phase 4 | 중립 임계값 있는 순수 로테이션 상태 helper만 제공 | 점수 기록 기반 지속성·신규/이탈·위험 경고 통합 |
| Phase 5 | 미착수 | 수정주가·상장폐지·실행 가능 가격·비용을 반영한 표본 외 검증 |
| Phase 6 | 로컬 회귀 검사, PR, 변경·롤백 계획 | 승인 후 운영 준비/마이그레이션/배포 |

Phase 2의 숫자 산식은 테스트 입력에서 검증했지만 실제 시장 성과를 검증하지 않았다. 데이터 부족을 해소하기 전에는 운영 점수/랭킹을 표시할 수 없다. 입력의 FULL_MARKET 선언은 수집 어댑터가 전 시장 구성/유효성 검증으로 입증해야 한다. 기존 LS 순위 표본은 항상 SAMPLED_UNIVERSE다.

## 승인용 데이터·저장 확장안 (실행하지 않음)

- `quote_observations`: trading_date, source_quote_at, available_at, symbol, provider, source_revision, payload, quality. 슬롯별 원본은 불변. 전 종목 시각과 수정/확정 여부를 보존. 유니크 키는 원천·종목·원천시각·revision.
- `daily_bars`: 거래일/종목/원천 revision, adjusted 여부, OHLC/대금, source_confirmed_finality와 known_at. 지수도 동일 시간 이력 확보. 미래 기업행동을 과거에 소급 적용하지 않도록 adjustment 버전 관리.
- `sector_memberships`: membership_version, entity_id, symbol, effective_date, known_at. 과거 재현시 당시 효력·인지 시각에 맞는 버전 사용.
- `leadership_scores`: trading_date, as_of, entity_type, entity_id, mode, status, score, grade, factors_json, quality_json, methodology_version, input_digest, computed_at. PK(date, entity_type, entity_id, mode, as_of, methodology_version). 같은 키에 다른 입력/결과가 오면 충돌로 보고 별도 버전/재계산 정책 필요. 장중과 EOD 키는 다르며 이전 결과를 덮어쓰지 않음.
- 실제 마이그레이션 파일 및 서버 저장 adapter는 이 PR에 포함하지 않는다. ScoreLedger는 메모리 테스트용이며 D1 보존 완료로 간주하면 안 된다.
- 계산은 수집 후 분리 배치에서 섹터 → 종목 순서로 실행하고 기존 가격 수집 lease와 별도 처리. 오류 격리, 중복 키 검사, 마지막 정상 버전 유지. 조회 API는 저장 결과만 읽고 날짜·모드·cutoff·페이지 한도를 검사.

## 호출량·용량·성능 검토

정규장 09:00–15:30을5분 간격으로79슬롯 수집한다면 표본200종목은 하루15,800행, 연252거래일 약398만행이다(휴장·수집실패 제외 계산 예). 전 시장3,000종목은 하루237,000행, 같은252일 약5,972만행이다. 점수/수정 이력·업종 구성·인덱스/스토리지 오버헤드는 별도이며 D1 용량·읽기/쓰기 한도를 먼저 확인해야 한다. 이번 PR에서 비용/지연 실측 또는 공급자 요청 한도 검증을 수행하지 않았다.

현재 엔진은 순수 단일 엔터티 함수다. 동일 history 조회/세션별 membership 해석을 캐시하는 배치 adapter, 계산 입력 digest, 거래일/종목 범위별 분할과 retention이 운영 연결 전 필요하다. 대량 엔터티를 브라우저에서 반복 계산하도록 연결하지 않는다. 권장 순서는 표본+점수 null 상태 검증 → 소수 종목의 외부 원천 정답 대조 → 배치 성능/비용 측정 → 점진 확장이다.

## 보안·장애 범위

새 모듈은 네트워크/DB/Secret을 읽지 않고 입력값만 계산한다. score 결과에는 원천 인증정보나 임의 payload를 복사하지 않는다. 점수 엔진은 공개 HTTP나 브라우저 진입점에 import하지 않았다. 현재 상품 분류/캘린더/기업행동 제공원이 미확보여서 신뢰할 수 있는 전체 점수를 보증할 수 없다. 기존 CORS는 사용자 인증이 아니라 브라우저 Origin 제한이라는 기존 특성을 유지한다.

CI의 pull_request 트리거는 검사·빌드만 수행하고 artifact 업로드와 Pages 배포는 건너뛴다. 이번 PR로 운영 서비스가 변경되지는 않는다. 최종 배포는 별도 승인 이후에만 수행한다.

## 승인 전·후 절차 및 롤백

1. 이 PR의 감사·실험 산식·테스트·누락 데이터를 검토한다. Phase 3 UI나 공식 수집 확장이 필요하면 독립 PR로 구체적인 변경과 호출량을 제시한다.
2. DB/수집 변경은 데이터 범위·백필기간·마이그레이션·용량·호출량·복원 절차를 완성해 승인을 받는다. 기존15:30이후 공급자 호출은 별도 정책 승인 대상이다.
3. 승인 후 스테이징 D1에 복제한 최소한의 비민감 샘플로 migration/오류/복원 검증. 운영 backup과 복원 가능성 확인 후 제한 적용.
4. 점수 엔진 버전은 별도 유지, 새 기능 플래그를 기본 off로 배포한 뒤 읽기 검증. 점수 계산 오류가 기존 시세 조회를 중단하지 않도록 격리.
5. 문제시 점수 기능 플래그를 off, 이전 Worker 버전으로 복귀하고 원래 시세·snapshot 테이블을 유지. 새로운 append-only 점수/원본 테이블은 즉시 DROP하지 않고 버전별 접근 중단. 복원·삭제는 별도 승인.

이번 변경은 운영 미적용 상태이므로 롤백을 위해 운영 DB나 Worker를 조작할 필요가 없다. feature PR을 닫으면 기존 서비스는 그대로다.
