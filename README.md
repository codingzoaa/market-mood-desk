# 마켓노트 — 투자 관제실

Market Mood Desk 원본 프런트엔드를 바탕으로 만든 별도 브라우저용 주식 대시보드입니다. 원본 사이트와 서버·계정·데이터를 공유하지 않습니다.

## 바로 실행

`dist/index.html`을 브라우저에서 열면 됩니다. 외부 CDN이나 서버 없이 실행하는 단일 HTML입니다. 정적 호스팅에도 그대로 올릴 수 있습니다.

첫 화면의 숫자는 **가상 시세**입니다. 실제 시세 API나 자동 수집은 연결되어 있지 않습니다.

## 기능

- 주도섹터, 거래대금 상위 중 +4% 강세 종목, 종목 상세
- 시장·테마 필터, 종목 검색·정렬, 관심종목
- 날짜별 28일 캘린더, 섹터 자금 흐름, 시장 환경
- KODEX ETF 거래대금·등락률 TOP5
- CSV/JSON 가져오기와 교체 전 확인, JSON 백업
- 가져온 날짜별 메모와 관심종목의 브라우저 저장
- 휴대폰 대응 메뉴와 레이아웃, 키보드 모달 탐색

나의 데이터는 현재 브라우저의 localStorage에 저장됩니다. 기기 간 동기화나 로그인 기능은 없습니다. 브라우저 데이터를 지우기 전에 백업하세요. 파일을 직접 열 때 저장 지원 여부는 브라우저에 따라 다릅니다. 안정적인 보관은 같은 주소의 정적 호스팅에서 사용하세요.

CSV 필수 열: `date,asOf,symbol,name,market,themes,price,changePct,turnoverKRW`. 종목코드는 6자리 문자열, 시장은 KOSPI/KOSDAQ, themes는 `|` 구분입니다. 날짜는 한국 거래일, asOf는 시간대를 포함합니다. 화면의 데이터 관리에서 양식을 받을 수 있습니다.

JSON 형식: `{ "schemaVersion": 2, "snapshots": [...] }`. 가상 시세는 실제 기록으로 가져올 수 없습니다. 최대 파일 2MB, 파일당 60일, 저장 365일입니다. 백업에 포함된 watchlist는 보관용이며 가져오기는 날짜별 시세·메모만 복원합니다.

## 개발

Node.js 24 이상에서 `npm install`, `npm test`, `npm run build`를 실행하세요. 빌드 결과는 `dist/index.html`입니다.

## GitHub 연결 및 배포

저장소: https://github.com/codingzoaa/market-mood-desk

GitHub Actions는 main 변경 시 의존성 설치 → 테스트 → TypeScript 검사 → 단일 HTML 빌드 → GitHub Pages 배포를 수행합니다. Pull Request에서는 검사와 빌드만 실행합니다.

최초 1회 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정하세요.
설정 페이지: https://github.com/codingzoaa/market-mood-desk/settings/pages

설정 후 Actions → Build and deploy dashboard → Run workflow를 실행하거나 실패한 배포 작업을 다시 실행하세요.
배포 성공 후 주소: https://codingzoaa.github.io/market-mood-desk/

설정 전에는 이 주소에서 사이트가 열리지 않을 수 있습니다. 실제 시세 연동에는 별도 제공자와 서버 구성이 필요합니다.
