# LS 분봉 백필 검토 상태 — 실제 실행 차단

2026-10-20 공개 공식 페이지 확인:

- [LS API 서비스 목록](https://openapi.ls-sec.co.kr/apiservice): t8412(주식 N분 차트), t8452(통합 주식 N분 차트)가 목록에 있다.
- [LS 공식 서비스/공지 페이지](https://openapi.ls-sec.co.kr/apiservice?api_id=d61d4f85-9845-41ef-b915-4efa8fd0aad1): 통합 주식 차트 관련 필드 변경 공지가 검색되지만 공개 텍스트에서 필요한 전체 request/response 계약·제공 기간·초당 제한을 확보하지 못했다.

이름을 확인한 것은 세부 계약 검증이 아니다. 실제 t8412/t8452 호출, 로그인, 키 조회, 고객센터 문의는 하지 않았다. 외부 예제의 필드나 단위를 사실로 복사하지 않았으며 `worker/ls.mjs`의 허용 TR/URL도 추가하지 않았다.

## 승인 전에 필요한 증거

| 항목 | 현재 상태 |
|---|---|
| input/output 정확한 필드명/자료형/블록 | 미검증 |
| KRX/NXT/통합 시장 구분과 KRX-only 설정 | 미검증 |
| 분봉 시작/종료 시각과 종가 동시호가 처리 | 미검증 |
| 거래대금 단위, 봉별/누적 금액 의미 | 미검증 |
| 과거 제공 기간·최대 건수·continuation 방식 | 미검증 |
| TR별 초당 제한과 동시 작업 제한 | 미검증 |
| 세션 첫 봉부터 누적 복원이 가능한 범위 | 미검증 |
| 수정주가/기업행동/거래정지/무체결 구간 의미 | 미검증 |

위 항목이 공식 문서로 확인되기 전 `PROVIDER_REVIEW`는 verified=false이며, 실제 LS adapter는 제공하지 않는다. 테스트는 명시적인 가짜 adapter만 사용한다.

## 구현한 백필 작업 모델

1. 현재 수집 종목 코드 목록만 주입하고 필요한20거래일/슬롯과 기존 PK를 비교한다. 없는 키가 있는 종목만 job을 만들며 같은 계획/계약 hash는 INSERT OR IGNORE한다.
2. 실행은 approved=true뿐 아니라 job ID·종목·TR 범위, 유효기간, 페이지 한도, 일치하는 계약 식별자를 요구한다. provider 계약은 verified/KRX-only/세션 시작 기준 누적 의미/문서 URL/검토된 rate를 가져야 한다.
3. 한 번에 한 페이지를 요청하고 TR 전체 rate lease와 job lease를 사용한다. response를 canonical rows로 검증·필드 제한한 후 pending_page_json에 checkpoint한다. D1 이력 반영/최종 cursor 갱신이 실패하면 저장된 page로 재시도해 공급자 요청을 줄인다.
4. timeout으로 응답 자체를 받지 못한 경우에는 원천 receipt가 없으므로 재조회가 필요할 수 있다. 공급자 호출과 D1 commit 사이의 장애까지 exactly-once라고 주장하지 않는다.
5. 날짜·종목·슬롯·원천이 요청 범위를 벗어나면 거절한다. rows는 현재 fetch available_at을 유지한다. 완료 job은 재호출하지 않는다. 실패 원문 대신 안전한 error_code, 시도/완료 페이지/cursor/계약 식별자/정규화 행 해시/가용 시각을 남긴다.
6. 이미 R2 아카이브로 sealed 된 날짜는 삽입하지 않는다. 새로운 수정 이력은 승인된 별도 revision/재검증 정책이 필요하다.

계약 식별자(contract_hash)는 승인된 외부 검토 manifest의 content hash로 관리해야 한다. 코드의 boolean이나 문자열이 검토/사용자 승인을 자동으로 증명하지는 않는다. 이 함수는 공개 API에 연결하지 않았고 관리자용 내부 runner와 실제 adapter를 추가할 때도 별도 검토가 필요하다.

과거 API 대금이 봉별 금액이라면 **일부 후반 봉의 합만 누적대금으로 사용하는 것은 금지**다. 모든 앞선 세션 봉과 단위/연속성 증거가 확보되지 않으면 해당 슬롯은 불완전 표본으로 남긴다. 현재 adapter 경계에서 이 검증을 요구하며 검증되지 않은 필드 변환 코드는 만들지 않았다.
