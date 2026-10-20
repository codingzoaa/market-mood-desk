# 본인 전용 LS 계좌 분석 — 운영 미적용

PR #4, 브랜치 `feature/private-account-dashboard`. 기존 PR #2 위에 개인 전용 Worker/D1/모바일 앱을 추가한다. 기존 공개 Worker·DB·시세 수집·4개 WORKSPACE는 유지하고, 공개 화면의 방패 아이콘은 별도 보호된 계좌 앱으로 이동한다. 검토 대상 URL은 `https://market-note-private-account.kby0991.workers.dev/`이며 아직 배포하지 않았다.

## 첨부 명세 반영

2026-10-20 사용자가 제공한 CDPCQ04700 공식 카탈로그 출력의 본문을 읽었다. [원문 보관](cdpcq04700.source.json), catalogVersion `20261012053652748`, documentId `819f29badcdddce05dd9fa26e6a03302e15b98a52cfbc4a7e84c4659fed71d32`, version `8d1dbe291a94e08661c5cd30d19a6267416be7bf4b8787e7c3c2224bd7bb78d8`. 원래 첨부 파일 SHA256은 `9a5655222518c91901c72bf1e941f28e83fb132d7445c0e660f9496c4f92b093`. 인터넷으로 재조회해 진위를 독립 검증한 것은 아니다.

확인한 구조:

- POST `https://openapi.ls-sec.co.kr:8080/stock/accno`, TR CDPCQ04700, 호출 제한1초당1회.
- InputBlock1 필드는 `RecCnt,QryTp,QrySrtDt,QryEndDt,SrtNo,PdptnCode,IsuLgclssCode,IsuNo`. **계좌번호/비밀번호는 입력 필드에 없다.** 반환 OutBlock1의 `AcntNo/Pwd`를 요청 필드로 잘못 사용하지 않는다. LS_ACCOUNT_PASSWORD Secret도 이 기본 어댑터에는 필요 없다.
- 요청은 RecCnt=1(input record 수), QryTp=0(전체), 상품01·종목분류01(주식), 종목 빈값으로 고정한다. 입출고/정정이 손익에서 누락되지 않도록 원장 종류를 임의로 매매만 골라 버리지 않는다.
- 거래 원장은 OutBlock3, 날짜는 TrdDt, 거래번호는 TrdNo. 계좌+날짜+번호를 저장 ID 후보로 사용하고 내용 변경은 암호화 버전으로 보존한다. 동일 페이지의 동일 키에 다른 내용이 있으면 충돌로 중단한다.
- 수량 TrdQty, 단가 TrdUprc(13.2), 금액 TrdAmt, 수수료 CmsnAmt. 세금 관련 필드는 Trtax/TaxSumAmt/EvrTax/Ictax/Ihtax가 따로 있다.
- **TrxTime은 길이9의 ‘처리시각’이다. 체결시각으로 표시하지 않는다.** 매수/매도 enum·취소 값·세금 합계와 개별 세금의 포함 관계·원장 순서·시각 표현 형식은 이 문서에 명시되지 않았다.
- 연속조회는 응답의 tr_cont/tr_cont_key를 그대로 전달한다. SrtNo를 TrdNo에서 임의로 계산하지 않는다. 필수 종료 헤더가 없거나 Y 응답이 같은 페이지를 새 키로 반복하면 체크포인트를 진전시키지 않고 오류로 남긴다.
- catalog-default required는 개별 필수 여부 검증이 아니라 출력 도구의 기본값이다. 이를 모든 반환 필드가 항상 존재한다는 증거로 사용하지 않는다.

maxRangeDays=1, 수신100행/1.5MB, 실행당1페이지, 최대1,000개의 연속 페이지 지문은 **앱의 보수적 제한**이며 공급자 최대 기간/건수라고 주장하지 않는다. 범위/건수를 벗어나면 조용히 잘라 저장하지 않고 실패한다. 성공코드 all-zero 판별은 기존 LS 전송 규칙을 재사용하며 첨부 문서에는 성공 코드 enum이 없다. 개인 계좌용이며 법인 mac_address 지원은 별도 검토 대상이다.

## 수집과 분석을 분리

기본 제공 `CDPCQ04700_LEDGER_V1` 어댑터는 별도 가짜 필드 매핑 없이 작동한다. LS_ACCOUNT_CONTRACT는 생략할 수 있으며 명시적으로 version pin을 넣으려면 contract.example.json을 사용한다. 과거 개발 fixture용 사용자 지정 매핑 경로도 유지하지만 이 예제를 CSPAQ13700의 실제 명세로 사용하면 안 된다.

분류 규칙을 모르더라도 확인된 원장 필드만 **암호화 저장**할 수 있다. 상대 계좌/이름·의뢰인명·계좌명·응답 비밀번호·임의 속성은 보관하지 않는다. 수신 JSON의 숫자는 parse reviver의 source context로 원래 숫자 토큰을 보존한 후 문자열로 정규화한다. source context가 없는 런타임은 해당 응답을 거절한다. 이미 반올림된 unsafe JS 숫자는 직접 정규화에 넣어도 거절하며, 원가 계산의 안전 정수 범위를 넘는 원장은 보관하되 분석하지 않는다. 원본의 null/빈값을0으로 만들지 않는다. selected fields 기반 원장이며 전체 응답/전체80여 필드를 보관하는 무차별 원문 로그가 아니다.

`account_ledger`는 현재값, `account_ledger_versions`는 변경 이력이며 batch로 함께 갱신한다. 동일 재수신은 추가 쓰기를 하지 않고, 취소/세금 변경은 이전 암호문을 보존한다. 해당 테이블은 **새 private D1에만** 적용한다. 기존 공개 시세 DB의 스키마는 변경하지 않는다.

실제 원장 의미 검토 후 `LS_LEDGER_RULES` Secret으로 다음을 지정한다.

1. TpCodeNm·SmryNo·SmryNm·CancTpNm·CrcyCode의 **정확한 조합**별 BUY/SELL 또는 원금 DEPOSIT/WITHDRAWAL 매핑. 문자열 ‘매수’ 포함 여부 같은 추측 금지.
2. 원장 TrdNo 순서가 원가 계산에 적절한지, 처리시각이 HHmmssSSS인지, 종목번호가 KRX6자리인지 A+6자리인지 검토.
3. 세금 합계/개별 필드의 포함 관계를 확인하고 중복 합산하지 않을 taxFields 선택. 누락 값은0으로 보충하지 않는다.

`ledger-rules.example.json`은 reviewed=false·taxFields/rules 빈 배열이다. 실제 enum을 추측해 넣지 않았다. 원금 입출금은 검토된 exact rule에 더해 종목 없음·수량0·비용/선택 세금0·배당 아님을 확인한 경우에만 매매 손익에서 분리한다. 입출금 보정 수익률을 계산하는 것은 아니다. OrgTrdNo가0이 아니거나 대출일이 있는 행, 취소/주식 입출고·배당·외화·미분류·누락/불일치 금액이 있으면 계좌 손익을 보류한다. 일부 매매만 골라 계좌 전체 손익처럼 표시하지 않는다. 화면에는 **‘— / 원장 검토 대기’**, 수집 원장 수와 검토할 코드 조합을 표시한다.

확인된 원화 현금주식 원장은 이동평균 원가로 실현손익을 계산한다. 원장 단가가 평균값일 수 있으므로 `수량×단가`로 금액을 재구성하지 않고 **TrdAmt를 취득/매도 대금으로 사용**한다. 분석은 검토한 원장 순서를 따른다. 계좌별 원가를 분리하고, 과거 매수가 없는 매도는 별도 원가 부족으로 표시한다. 입출금 보정 수익률·총자산·실시간 잔고·평가손익을 제공하는 기능이 아니다. 이체/분할/배당/신용/공매도/기초잔고 조정은 별도 구현이 필요하다.

## 인증·비밀·개인정보

- 별도 Worker·PRIVATE_DB·Secret. 공개 시세 응답/DB/bundle에 계좌 자료를 넣지 않는다.
- HTML/JS/CSS/모든 API에서 Access RS256 서명·고정 issuer·앱 AUD·만료·발급시각·사용자 이메일1개를 검증한다. 인증 전 DB 접근0. 이메일 헤더만 신뢰하거나 직접 workers.dev 경로를 우회로로 사용하지 않는다.
- AES-256-GCM, 매 저장 랜덤96bit IV, 행 ID/용도/버전을 AAD로 결합. 별도 HMAC-SHA256 key로 ID/버전을 불투명하게 만든다. 평문 DB에는 opaque ID·암호문·lease 시각/owner만 존재한다.
- API 키와 기대 계좌번호는 Secrets. OAuth는 같은 TLS 연결에서 발급/사용 후 폐기하고 D1/브라우저에 저장하지 않는다. 응답 OutBlock1의 비밀번호도 보관하지 않는다. 계좌번호·번호 ID·cursor·상위 오류 원문은 개인 API에도 내보내지 않는다.
- 모든 응답 no-store/private·no CORS, self-only CSP·frame 차단·no-referrer. sync POST는 인증/Origin/JSON content-type 검사. 영구 브라우저 저장0, 탭을 숨길 때 화면 기록 제거. Worker observability off.
- Cloudflare 관리자/배포 권한은 여전히 신뢰 경계다. 로그인 PC의 악성코드나 화면 캡처까지 막지 못한다. 키를 잃으면 복호화할 수 없으므로 키/암호문 백업을 분리한다. v1 단일 키를 무작정 교체하지 말고 재암호화/검증 절차가 필요하다.

## 수집·비용 경계

정규장 평일09:00~15:30 KST 5분마다1페이지. 동시 실행 owner-fenced lease와30초 재호출 간격, 날짜별 checkpoint·암호화 continuation/페이지 지문을 저장한다. 운영 크론·플래그는 아직 적용하지 않았다. 최대79 조회 TR+79 OAuth/일 계획이며 실제 초기 백필/수동 재시도는 추가다. 기존 시세와 같은 앱키를 쓰면 IP/동시 발급 제약·토큰 무효화 영향을 확인해야 한다.

신규/변경 원장당 current+audit2행 쓰기. 중복이면0행이며 회차별 lease/state 쓰기는 별도다. 기존 시세 DB와 물리적으로 분리해도 Cloudflare 계정 무료 할당량은 공유한다. 개인 화면은 최대10,001행 읽고10,000개 초과 시 잘라서 잘못 계산하지 않고 제한 오류를 반환한다. 대규모 원장에는 증분 lot 집계/페이지 분석과 archive 설계가 추가로 필요하다. Free CPU10ms 적합성을 주장하지 않으며 staging 실측 후 실행 크기/플랜을 정한다.

## 활성화 절차 — 아직 미실행

1. 새 private D1을 만들고 이 디렉터리 schema.sql을 그 DB에만 적용한다. 기존 market-note-ls DB 재사용 금지.
2. example config를 gitignored wrangler.local.jsonc로 복사하고 새 database_id를 넣는다. `node scripts/build-account.mjs`로 로컬 빌드한다.
3. Access에서 새 앱 전체 hostname을 본인 이메일1개만 허용한다. Everyone/Bypass/서비스 토큰 정책 금지, preview URLs off·run_worker_first=true, 짧은 세션(예15분). 현재 연결된 Cloudflare token의 Access organization 조회는403이어서 관리자 설정/적절한 권한이 필요하다.
4. Secrets: ACCESS_ISSUER, ACCESS_AUD, OWNER_EMAIL, 독립32byte random base64의 ACCOUNT_ENCRYPTION_KEY/ACCOUNT_INDEX_KEY, LS_ACCOUNT_APP_KEY/LS_ACCOUNT_APP_SECRET, LS_ACCOUNT_NO(반환 계좌 일치 검사), ACCOUNT_START_DATE. **기본 CDPCQ04700에 계좌 비밀번호를 등록할 필요는 없다.** 실제 키/계좌번호/비밀번호를 채팅·GitHub·HTML에 넣지 않는다.
5. 수신 구조 검증을 마친 뒤 수집 플래그 ENABLE_ACCOUNT_SYNC=true 활성화 대상으로 검토한다. 분류 규칙 검증 전에는 원장만 보관하고 손익은 보류한다. 실제 코드/세금/순서 확인 후 LS_LEDGER_RULES를 검토해 설정한다.
6. 미인증/다른 이메일/다른AUD/만료·위조 토큰/교차 Origin 거절과 소량 계좌 조회·원장 정확성·CPU/과금을 staging에서 확인한 뒤 배포 승인한다. 개인 앱이 보호된 후 공개 사이트 링크를 배포한다.

실제 계좌 조회·D1 생성/적용·Access 정책/Secret·Worker/Pages 배포는 이번 작업에서 실행하지 않았다. 롤백은 계좌 수집 off/새 Worker 비활성으로 하고 DB/키를 삭제하거나 앱을 공개로 바꾸지 않는다.

근거: [사용자가 제공한 상세 명세](https://openapi.ls-sec.co.kr/api/apis/public/assistant/tr?product=openapi&code=CDPCQ04700&documentId=819f29badcdddce05dd9fa26e6a03302e15b98a52cfbc4a7e84c4659fed71d32), [Cloudflare Access JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/). [검증 결과](VALIDATION.md).
