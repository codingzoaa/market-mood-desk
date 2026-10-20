# 본인 전용 LS 계좌 분석 — 개발본, 운영 미적용

이 PR은 기존 PR #2를 base로 한 별도 `feature/private-account-dashboard` 브랜치다. 기존 공개 시장 데이터/API/4개 WORKSPACE는 유지하고, 마켓노트 상단 방패 아이콘으로 **별도 보호된 개인 계좌 앱**에 이동한다. 검토 대상 URL은 `https://market-note-private-account.kby0991.workers.dev/`이며 아직 생성/배포하지 않았다.

## 구현한 것

- 별도 Worker·새 PRIVATE_DB·별도 Secret. 기존 공개 시세 DB에 계좌 기록을 섞지 않는다.
- Cloudflare Access JWT의 RS256 서명·고정 issuer·app AUD·시간·본인 이메일을 서버가 검증한다. 이메일 헤더만 신뢰하지 않는다. HTML/JS/CSS/모든 API에 인증을 먼저 수행한다. 서비스 토큰/다른 이메일/다른 앱/직접 미인증 workers.dev 접근도 거절한다.
- 거래 날짜·계좌번호·종목·금액·이름·동기화 cursor·오류 상태를 AES-256-GCM으로 암호화한다. 매 저장마다 새96bit IV, 행 종류/ID를 AAD로 묶어 바꿔치기를 막는다. 별도 HMAC-SHA256 key로 account+tradeDate+fillID 고유 키를 만든다. DB의 plaintext는 opaque ID·암호문과 lease 만료 시각/일회성 owner뿐이다.
- 키/계좌 비밀번호는 Worker Secrets에만 둔다. OAuth는 동일 TLS 연결에서 발급·조회하고 메모리에서만 사용한다. 기존 시세 OAuth·LS allowlist·DB·Cron은 변경하지 않는다. 실제 개인 데이터/키/이메일은 GitHub·공개 bundle·로그에 넣지 않는다.
- 별도 자동 수집기: KRX 정규장09:00~15:30 KST 평일5분마다 최대1페이지/100행. from/to·continuation을 암호화 checkpoint해 과거 기간부터 이어서 수집한다. lease+owner fencing과30초 재시도 간격. 재실행 중복 방지, 같은 체결 ID의 금액 변경은 충돌로 중단한다. 날짜 범위·sequence·가격/체결금액·수수료·세금 누락은 실패로 남기고 가짜0으로 채우지 않는다.
- 자동 수집은 기본 off. 조회 TR allowlist는 CDPCQ04700/CSPAQ13700뿐이다. 주문/정정/취소 endpoint·외부 요청에서 TR/계좌를 지정하는 기능은 없다. 계약의 실제 fill 의미가 확인되지 않으면 호출 전 차단한다.
- 모바일 UI: 누적 실현손익, 확인 가능한 매도 승률, 비용, 매수·매도 대금, 일별 누적 실현손익 차트·날짜 선택, 거래 기록 기반 추정 보유, 최근/날짜별200개 거래, 수집 상태·로그아웃. 공개 시장 UI에 계좌 수치를 가져오지 않는다.

## 손익 의미와 한계

국내 원화 현금주식의 **체결별 이동평균 원가**로 계산한다. 매수 원가는 매수금액+비용, 매도 순수익은 매도금액-비용-배분원가다. 같은 초의 체결도 원천 sequence로 정렬한다. 계좌/종목별로 원가를 분리하며, 주어진 기록에서만 계산한다.

원가 부족 매도는 unknownSells로 표시하고 해당 이익을 합산하지 않는다. 그 뒤 불완전한 보유 원가도 확정하지 않는다. 승률은 손익이 확인된 비보합 매도 체결 기준이다. 전체 계좌 수익률/총자산/평가손익/실제 잔고라고 표시하지 않는다. 이체·기초잔고·분할·배당·신용·공매도·외화/소수점 주식은 현재 분석 범위 밖이다. 이러한 원장 이벤트가 있는 계좌는 별도 조정 입력이 필요하다. 같은 종목을 여러 계좌에서 보유하면 각각 별도 행으로 계산하지만 계좌번호는 API에 내보내지 않는다.

현재 엔진 조회 상한은10,000개 거래다. 이를 넘으면 조용히 잘라 손익을 계산하지 않고 실패한다. 큰 계좌에는 암호화 lot snapshot/증분 집계·페이지 조회·장기 보관 설계가 추가로 필요하다. private API는 결과/트래픽을 외부 분석 도구로 전송하지 않는다.

## 안전 장치

모든 응답 no-store/private, no CORS, self-only CSP, frame-ancestors none, no-referrer. 동기화 POST는 인증+same-Origin+JSON content-type을 모두 요구한다. 응답에는 계좌번호·fillID·OAuth·cursor·LS 오류 원문을 넣지 않는다. 거래 기록은 React 메모리에만 두며 local/sessionStorage/IndexedDB에 저장하지 않는다. 탭이 숨겨지면 화면 데이터를 지우고 다시 열릴 때 재인증해 읽는다. Worker observability는 템플릿에서 off다. Cloudflare 관리자가 배포/Secret을 변경할 수 있다는 신뢰 경계는 남아 있으며 브라우저 악성코드·로그인한 PC의 화면 캡처까지 방어하는 것은 아니다.

암호화 키를 잃으면 거래 기록을 복호화할 수 없다. 키는 오프라인/비밀번호 관리자에 별도 백업하고 D1 암호문 백업과 분리해야 한다. v1 단일 키이므로 기존 Secret을 무작정 바꾸지 말고 검토된 재암호화/검증 절차를 거친다. 데이터 보관·삭제 UI는 이 개발본에 포함하지 않았다.

## LS 공식 규격 확인 상태 — 아직 실연결 아님

2026-10-20 [LS 공식 API 목록](https://openapi.ls-sec.co.kr/apiservice)에서 CDPCQ04700 계좌 거래내역과 CSPAQ13700 주문체결 조회의 존재를 확인했다. 공개 목록은 실제 block/필드·체결/누적 주문 의미·수수료/세금 단위·순서·보관 기간·페이지 제한을 입증하지 않는다. 주문의 누적 체결수량을 개별 fill처럼 반복 저장하면 수익이 잘못 계산된다.

따라서 contract.example.json의 reviewed=false를 유지했다. 공식 로그인 API가이드의 상세 명세를 받아 아래를 확인해야 자동 연동을 켤 수 있다.

1. 실제 계좌 거래 원장/개별 체결의 고유 ID, 일별 ID 재사용, sequence·날짜·시간 의미
2. 실행 수량·정수 원화 가격·gross=quantity×price, commission/tax 필드와 포함/별도 여부
3. 입출금/배당/정정/취소를 구별하는 방식. 현재 정규화는 BUY/SELL 확정 체결만 허용하고 그 밖의 transaction은 중단한다. 혼합 원장이면 검토된 event 분류를 추가해야 한다.
4. InputBlock1·OutBlock·필수 조건·account/password·날짜 범위·응답 성공 코드·tr_cont 헤더 방식과 최대100행 내 페이지 조건
5. API key 계좌 조회 권한·실전/모의 구분, 토큰의 IP/동시 발급 제약. 기존 공개 시세와 같은 앱키 사용 시 서로 토큰을 무효화하는지 확인하고 필요시 독립 앱키/수집기 조정을 검토한다.

계약은 LS_ACCOUNT_CONTRACT Secret에 저장한다. 임의로 reviewed만 true로 바꾸지 않는다. 실제 키나 비밀번호, 개인 거래내역 없이 **공식 TR 상세 명세**만 공유하면 이 mapping을 마무리할 수 있다. 이번 작업은 실제 LS 계좌 API를 호출하거나 실제 거래내역을 조회하지 않았다.

## 활성화 절차 — 실행하지 않음

이전 운영 변경 금지 지시에 따라 기존 Worker·DB·사이트는 변경하지 않았고 새 리소스도 만들지 않았다. 연결된 Cloudflare token은 Worker subdomain 조회는 가능하지만 Access organization 조회는403이었다. Access 앱/본인 이메일 정책은 별도 관리자 설정 또는 적절한 Access 권한이 필요하다.

1. 별도 private D1 생성, schema.sql을 그 DB에만 적용. 기존 market-note-ls DB 재사용 금지.
2. example config를 gitignored wrangler.local.jsonc로 복사해 새 database_id를 넣는다. `node scripts/build-account.mjs`로 private assets/Worker를 빌드한다.
3. Cloudflare Access self-hosted 앱으로 새 Worker **전체 hostname**을 보호한다. 사용자에게 받은 본인 이메일1개만 Allow하고 Everyone/Bypass/서비스 토큰 정책을 넣지 않는다. Email OTP 또는 본인 IdP를 사용한다. 세션 유효기간은 짧게(예:15분) 설정한다. preview URLs는 off, 인증 전에 자산을 반환하지 않도록 run_worker_first=true를 유지한다.
4. Worker Secrets: ACCESS_ISSUER(`https://<team>.cloudflareaccess.com`), ACCESS_AUD(해당 앱 AUD), OWNER_EMAIL(사용자가 지정한 이메일), ACCOUNT_ENCRYPTION_KEY와 ACCOUNT_INDEX_KEY(각각 독립32byte random base64).
5. 별도 Secrets: LS_ACCOUNT_APP_KEY, LS_ACCOUNT_APP_SECRET, LS_ACCOUNT_NO, LS_ACCOUNT_PASSWORD, ACCOUNT_START_DATE(YYYY-MM-DD), 검토 완료 LS_ACCOUNT_CONTRACT. 키/비밀번호를 채팅·GitHub·공개 HTML에 넣지 않는다. 키는 비밀번호 관리자에서 생성하거나 로컬 `openssl rand -base64 32`로 독립 생성 후 별도 백업한다.
6. 실제 source mapping·소량 모의/조회 데이터·D1 quota/CPU를 검증하고 ENABLE_ACCOUNT_SYNC=true 활성화. 인증 없는 HTML/자산/API, 다른 이메일·다른AUD·위조/만료 JWT·교차 Origin 요청이 거절되는지 먼저 확인한다.
7. 개인 앱과 Access 보호가 준비된 뒤에만 공개 마켓노트 상단 링크를 포함한 사이트 변경을 배포한다. 계좌 설정 전 public site 링크를 배포하지 않는다.

롤백: 계좌 동기화 플래그 off → 새 계좌 Worker 비활성/이전 버전 복귀. 공개 시세 Worker·DB는 그대로다. DB/키를 삭제하지 않으며 계좌 Worker를 공개로 바꿔 접근 장애를 해결하지 않는다.

## 운영량과 검증

79회/일 정상 수집 기준 최대79 조회 TR+79 OAuth다. 실제 거래 조회 pagination/재시도/동일 앱키 제약에 따라 달라진다. source당1페이지를 제한하며 key/암호화/lease/read-back/checkpoint 때문에 회차당 대략10~15 D1 statement, 새 거래당1행 쓰기와 중복 확인 JSON1회 조회가 추가된다. 기존 시장 DB와 물리적으로 분리해도 Cloudflare 계정 무료 할당량은 공유되므로 합산해야 한다. private API는 호출마다 최대10,001행을 읽으며 대규모 분석/100행 암호화의 Free CPU10ms 적합성을 주장하지 않는다. staging 실제 meta/CPU 측정 후 실행 크기/플랜을 정한다.

로컬 검증: 실제 Node SQLite와 합성 거래로 암호문/중복/변경 충돌·날짜별 ID·금액 누락·이동평균/원가 부족·계좌 분리·동일초 sequence·서명/이메일/AUD/만료·인증 없는 DB 접근0·CSRF·자동 수집·오류 비노출·JS DOM 날짜 drilldown/영구 저장0을 테스트한다. 실제 LS/Cloudflare Access 로그인을 대체하는 검증은 아니다. CI는 테스트·타입검사·일반/개인 앱·Worker 빌드만 수행하며 배포하지 않는다.

공식 인증 근거: [Cloudflare Access JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
