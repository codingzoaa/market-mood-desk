# LS증권 + Cloudflare 연결

## 준비된 구성

- 웹사이트: https://codingzoaa.github.io/market-mood-desk/
- 전용 Worker: `market-note-ls-api` (기존 market-brief-api와 별도)
- 시세 API: https://market-note-ls-api.kby0991.workers.dev
- D1: `market-note-ls` / 바인딩 `DB`, 스키마 적용 완료
- GitHub에는 서버 소스와 프런트엔드만 저장합니다. LS 키·시크릿·접속 코드는 포함하지 않습니다.

## 최초 설정: Cloudflare에 Secret 3개 등록

Cloudflare 대시보드 → Workers & Pages → **market-note-ls-api** → Settings → Variables and Secrets → Add.
아래 항목을 모두 **Secret** 유형으로 등록하고 적용/배포합니다.

| 이름 | 값 |
| --- | --- |
| `LS_APP_KEY` | 발급받은 LS OPEN API 앱키 |
| `LS_APP_SECRET` | 발급받은 LS OPEN API 시크릿 |
| `DASHBOARD_TOKEN` | 직접 생성한 32~256자 무작위 사이트 접속 코드 |

설정 바로가기:
https://dash.cloudflare.com/78961f2ddb841df708b3a777fdcc94c2/workers/services/view/market-note-ls-api/production/settings

LS 앱키·시크릿은 채팅, GitHub, 웹사이트 입력란에 넣지 않습니다. 접속 코드는 LS 키와 다른 값을 사용합니다. 접속 코드를 아는 사람은 이 서버의 저장 시세를 조회할 수 있습니다. 웹사이트 시세 데이터 공개 권한은 공급자 약관을 확인하세요.

## 웹사이트 연결

1. 웹사이트 → **데이터 관리** → **LS증권 시세 연결**.
2. `DASHBOARD_TOKEN`에 등록한 사이트 접속 코드를 입력하고 **시세 연결**.
3. 처음에는 서버 연결/수집 대기가 표시될 수 있습니다. 장중 5분 이내 첫 수집 후 화면은 60초마다 저장 결과를 확인합니다.
4. 접속 코드는 현재 탭의 sessionStorage에 보관합니다. LS 키는 브라우저로 전달하지 않습니다. 탭을 새로 열면 다시 입력할 수 있습니다.
5. 연결 해제 시 파일 기반 기록으로 돌아갑니다. LS 연결 중 파일 가져오기는 중지합니다.

## 수집 범위와 한계

- KRX 기준 코스피·코스닥의 거래대금 순위: t1463, 시장별 최대100개 / 최대5페이지. 회당 응답 크기에 따라 실제 종목 수가 적을 수 있습니다. 전체 상장종목 수집이 아닙니다. ETF 등이 포함된 LS 반환 범위를 기준으로 합니다.
- `value`는 백만원 → 원으로 변환합니다. `sign`으로 하락 등락률 부호를 적용합니다.
- 코스피·코스닥 지수: t1511, 001/301. 해외 지수·환율·SOX·금리·위험점수는 만들지 않고 빈 상태로 둡니다.
- 테마: t1532. +4% 종목 중 미보강 종목을 대금 순으로 최대12개/회 조회합니다. 하루 캐시를 사용하며 미수집 종목은 미분류입니다.
- ETF 패널은 위 수집 결과에 들어온 KODEX만 대상으로 합니다. 전체 KODEX 시장 순위가 아닙니다.
- 5분 수집 크론: 평일 UTC 00~07시(KST 09~16시). 코드에서 KST 09:00~16:30만 허용합니다. t8451 삼성전자 KRX 일봉의 최신 날짜와 장시작 시간을 확인해 휴장일·개장 전 값을 오늘 날짜로 저장하지 않습니다. LS 응답 형식 변경·거래정지·특수 일정 등은 실응답으로 검증이 필요합니다.
- 같은 날의 최신 관측 스냅샷을 갱신하며 과거 날짜는 365일 보관합니다. 기존 28일 기록을 소급 생성하지 않습니다. 정규장 최종 확정 데이터라고 표시하지 않습니다. 연결 시점부터 캘린더가 쌓입니다.
- 웹사이트가 닫혀 있어도 Cloudflare 크론은 실행됩니다. 무료/유료 사용량 한도는 계정 설정을 따릅니다.
- DB 전역 lease는 요청·크론을 합쳐 최대5분당 한 수집으로 제한합니다. 실패도 이 간격을 사용합니다. OAuth 토큰은 서버 DB에만 캐시합니다. 수집 오류 시 정상 시세를 삭제하지 않습니다.

## 운영 확인

`/health`는 Worker 설정 여부만 알려주며 LS 인증 성공을 의미하지 않습니다. 실제 인증·TR 응답·단위·화면 값은 Secret 등록 후 확인해야 합니다. `/api/status`는 접속 코드를 Authorization Bearer 헤더로 보낸 요청만 허용합니다. 키나 토큰을 URL 쿼리에 넣지 마세요.

프런트엔드 변경은 GitHub Actions를 통해 GitHub Pages로 자동 배포합니다. Worker 변경은 별도 배포 대상입니다. 현재 초기 Worker는 직접 배포되어 있으며 GitHub 자동 배포와 연결되어 있지 않습니다. 로컬에서 Cloudflare 인증 후 다음을 실행할 수 있습니다.

```sh
npx wrangler@4.92.0 deploy --config worker/wrangler.jsonc
```

기존 Secret을 삭제하거나 코드·설정 파일에 넣지 마세요. 소스의 `worker/schema.sql`은 현재 DB에 적용된 테이블 정의입니다.

## 검증 근거

- LS 공식 이용·인증 안내: https://openapi.ls-sec.co.kr/howto-use
- LS 공식 TR 목록: https://openapi.ls-sec.co.kr/apiservice
- 요청·필드 교차확인: ProgramGarden SDK의 t1463, t1511, t1532, t8451 및 config.py. 구현 코드는 복사하지 않고 필드와 단위를 확인했습니다.
  https://github.com/programgarden/programgarden/tree/main/src/finance/programgarden_finance/ls
- Workers 사용자 지정 포트 지원: https://developers.cloudflare.com/workers/configuration/compatibility-flags/#allow-specifying-a-custom-port-when-making-a-subrequest-with-the-fetch-api

키 등록 전 자동 테스트는 모의 응답과 인증 경계·단위 변환을 검사합니다. 실제 LS 인증·수집과 실제 브라우저 화면 검수는 아직 미완료입니다.
