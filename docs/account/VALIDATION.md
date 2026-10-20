# 개인 계좌 검증 결과

2026-10-20, 실제 운영 데이터와 공급자 호출 없이 실행했다.

- 기존91개 + 계좌13개 = **104개 테스트 통과**: `node --test --test-isolation=none tests/*.test.mjs`.
- `npm test` 통과. 이 환경의 기본 subprocess 출력은 파일 단위 합계이므로 위 명령으로 개별 테스트도 확인했다.
- `npx tsc --noEmit`, `npm run build`, `node scripts/build-worker.mjs`, `node scripts/build-account.mjs`, `git diff --check` 통과.
- 실제 SQLite의 암호화 저장/중복·충돌·날짜별 fill ID/범위·원가 계산과 합성 RSA 키의 JWT 서명 검증, JSDOM의 날짜 drilldown·영구저장0을 검증했다.
- 자동 수집 합성 테스트:2페이지 continuation 복구, lease 동안 중복 호출 차단, OAuth 같은 연결 사용/영구 저장0, raw error 비노출,15:30 이후 추가 조회0, 주문 TR 차단.
- 기존 공개 UI/API/수집/TLS/상품 제외/이력·RVOL/70k 보호 회귀 유지. 공개 UI 변경은 개인 앱으로 이동하는 상단 방패 링크뿐이다.

운영에 적용하지 않은 것: 새 D1 생성/스키마 적용, 새 Worker/Access 앱·정책/Secret 생성, Worker/Pages 배포, 실제 개인 계좌 API 조회, 실제 거래내역 수집. 기존 PR #1·#2 및 운영 설정은 변경하지 않았다.

외부 read-only 확인: 계정 Worker subdomain 조회 성공. Access organization 조회403으로, 현재 연결된 API token으로 Access 설정을 자동화할 권한이 확인되지 않았다. 실제 LS 상세 TR 필드·원장 의미·fee/tax 확정 시점·rate/제공기간은 미확인이라 reviewed=false, sync=false다. 예제 field names는 명세로 사용할 수 없다.

실제 인증 화면/이메일 OTP/모바일 실기기/Cloudflare Workers CPU·실제 과금 행 수는 검증하지 않았다. 신규 앱 전체 hostname 보호와 토큰 서명·대상·이메일 거절을 staging에서 검증한 후에만 활성화한다.
