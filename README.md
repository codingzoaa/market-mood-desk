# 마켓노트 — 국장

Market Mood Desk 원본 프런트엔드를 바탕으로 만든 별도 브라우저용 주식 대시보드입니다. 원본 사이트와 서버·계정·데이터를 공유하지 않습니다.

## 바로 실행

`dist/index.html`을 브라우저에서 열면 됩니다. 외부 CDN이나 서버 없이 실행하는 단일 HTML입니다. 정적 호스팅에도 그대로 올릴 수 있습니다.

첫 화면의 숫자는 **가상 시세**입니다. LS증권 실제 시세는 Cloudflare Secret 등록 후 데이터 관리에서 별도로 연결합니다. [LS + Cloudflare 설정 안내](docs/LS_CLOUDFLARE.md)를 따르세요.

## 기능

- 모바일 WORKSPACE 4개: 국장 / 주도 섹터 / 거래대금 / 주도주 캘린더
- 한 줄 지수 요약, 화면 전체로 펼치는 업종 히트맵·투자자별 수급, X/ESC 닫기
- 거래대금 전체 종목과 +4% 강세 필터, 종목 상세
- 시장·테마 필터, 종목 검색·정렬, 관심종목
- 날짜별 28일 캘린더, 선택일 주도주·관찰 메모, 섹터 자금 흐름
- KODEX ETF 거래대금·등락률 TOP5
- CSV/JSON 가져오기와 교체 전 확인, JSON 백업
- 가져온 날짜별 메모와 관심종목의 브라우저 저장
- 모바일 하단 탭 4개와 화면 크기에 맞춰 재배치되는 히트맵, 키보드 모달 탐색
- 국내 데이터는 평일 KST 09:00–15:30에만 수집하며 마감 이후에는 저장 기록만 조회

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

설정 전에는 이 주소에서 사이트가 열리지 않을 수 있습니다. LS증권 연결은 별도 Cloudflare Worker가 담당합니다. 앱키·시크릿은 Cloudflare Secret에만 보관합니다. 화면은 접속 코드 없이 저장 시세를 자동 조회합니다.

## Leadership V2 개발 브랜치

운영 미연결 Phase 1·2 구현은 `feature/leadership-scoring-v2` PR에서 검토합니다. [코드·데이터 감사](docs/leadership-v2/AUDIT.md), [실험 점수 산식](docs/leadership-v2/METHODOLOGY.md), [운영 확장·롤백 계획](docs/leadership-v2/PLAN.md)을 참고하세요. 새 순수 계산 모듈은 기존 UI/Worker에 연결하지 않으며 운영 배포·DB 변경은 별도 승인 대상입니다.

## 5분 이력·RVOL 저장 파이프라인

PR #1 위에 쌓는 `feature/history-rvol-pipeline`의 [구현 설명](docs/pipeline/README.md), [비용·로컬 측정](docs/pipeline/COSTS.md), [LS 백필 검토 상태](docs/pipeline/PROVIDER-REVIEW.md), [활성화·롤백 계획](docs/pipeline/ACTIVATION.md)을 참고하세요. 운영 DB/Worker/R2/스케줄은 미변경이며 기본 플래그는 off입니다.

## 개인 계좌 분석 (검토용)

별도 인증·암호화 저장·LS 조회 전용 자동 연동 구조는 [개인 계좌 문서](docs/account/README.md)를 참고하세요. 실제 계좌 연동과 운영 배포는 아직 비활성입니다.
