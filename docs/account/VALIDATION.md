# 개인 계좌 검증 결과

2026-10-20 KST. 실제 운영 계좌/공급자 호출 없이 검증했다.

- **115개 개별 테스트 통과**: 기존104 + CDPCQ04700 명세 검증10 + 원장 검토 대기 UI1. `node --test --test-isolation=none tests/*.test.mjs`.
- `npm test`, `npx tsc --noEmit`, `npm run build`, `node scripts/build-worker.mjs`, `node scripts/build-account.mjs`, `git diff --check` 통과.
- 공개 사이트 산출물은 개인 계좌 링크를 추가한 이전 PR #4 커밋 대비 변경 없음.

## 이번 명세 반영 검증

1. 첨부 source의 version/documentId/요청 필드·route·1TPS와 내장 어댑터 비교. 입력에 없는 계좌번호·비밀번호를 보내지 않음.
2. 실제 OutBlock3 필드의 선택/정밀도/처리시각 보존, OutBlock1 비밀번호·계좌명·상대 계좌·임의 속성 제거.
3. 정확한 continuation 헤더 전달·종료 헤더 누락 차단·계좌 불일치 거절·unsafe 숫자 거절·null/빈값 보존.
4. 암호화 current/audit2테이블의 중복 쓰기0·변경 버전 보존, SQLite 실제 트랜잭션 rollback.
5. 검토된 exact tuple 규칙으로만 매매 변환, TrdAmt 기반 원가(평균 단가와 곱이 달라도 재구성하지 않음), aggregate tax 선택 시 component 중복 합산 방지, 순서 검토 후 TrdNo 기준 계산. 검토된 원금 입출금은 손익에서 분리하고 주식 이체·배당은 조용히 무시하지 않음.
6. 규칙 미확인/외화/취소 관련/비용 누락은 분석 보류. API의 손익 null·원장/검토 상태·식별자 비노출, UI ‘—’/검토 목록/영구 저장0.
7. 계좌 비밀번호 없는 내장 수집 경로, 반복 Y 페이지는 checkpoint를 진전시키지 않고 오류로 남김.
8. JSON16자리 숫자/소수 토큰을 JS 반올림 전에 보존하고, 분석 안전 범위를 넘는 금액을 손익에 넣지 않음.

기존 검증도 유지: Access JWT 서명/이메일/AUD/만료·미인증 DB 접근0·CSRF·기존 원가/기초원가 부족·같은 초 순서·암호화/중복·2페이지 checkpoint/lease·오류 비밀 비노출·15:30 이후 공급자 호출0·주문 TR 차단. 기존 공개 UI/API/시세 수집/TLS/상품 제외/이력·RVOL/70k 보호 회귀 통과.

## 확인한 사실과 남은 확인

공식 카탈로그 출력 본문은 사용자 첨부로 확보했다. [원문](cdpcq04700.source.json)과 버전을 저장했다. 웹/CLI 접속 제한을 우회하거나 실제 계좌 API를 조회하지 않았다. 기본 CDPCQ04700의 요청/응답 구조는 반영했지만, 원문에 없는 매수·매도/취소 enum·세금 포함 관계·처리시각 형식·원가 계산용 순서는 임의로 확정하지 않았다. 분석 규칙은 reviewed=false 예제로 남겼다.

현재 연결된 Cloudflare token의 Access organization read는 이전 확인에서403이었다. 본인 이메일 전용 Access 정책, 신규 private D1/Secret, 실제 키의 계좌 바인딩, 소량 조회·페이지/rate·CPU/과금, JSON parse source context 런타임 지원, 모바일 실기기 검증이 필요하다. 생성/배포/실계좌 조회/스키마 적용은 아직 실행하지 않았다. 자동 수집 플래그는 기본 off이며 사용자 승인 전 운영 Worker·DB·사이트를 변경하지 않는다.

## 로그인 복구 검증 (2026-10-20)

전체119개 테스트·타입 검사·사이트 빌드·개인 Worker inline 번들·diff 검사 통과. 추가 검증: 미인증 HTML의 고정 로그인 redirect, 외부 return URL/쿼리 비전달, API와 자산401, 인증 전 DB 읽기0, 쿠키의 서명/본인 이메일 검증, 중복 쿠키 거절, 잘못된 assertion header를 쿠키로 우회 불가. 사용자 승인으로 별도 D1·암호화 Secret·개인 Worker 및15분 이메일 OTP 단일 허용 Access 정책을 생성했다. 이전 미배포/403 기록은 초기 검토 시점의 상태다. 로그인 진입 오류 수정본 배포 완료. 실제 브라우저 로그인·LS 계좌 수집 검증은 미완료이고 자동 수집은 off다.
