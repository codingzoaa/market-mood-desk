# 강세 섹터 캘린더 17:00 자동 발행

- 실행: GitHub Actions **Publish verified sector calendar at 17 KST**. UTC 월–금 08:00, 08:30, 09:00 (KST 17:00, 17:30, 18:00); 첫 배포 시 설치 검증을 위해 한 번 실행됨.
- 기존 ChatGPT의 강세·이슈 섹터 **웹 브리핑**은 별개이며, 사이트 발행 예약을 중복 생성하지 않음.
- 동일 날짜의 LS `/api/dashboard?date=YYYY-MM-DD`에서 15:30 이후 수집된 저장 종가와 `src/data/stock-map.json` 분류만 사용함. 개별 ETF는 제외하고 섹터별 상승종목 2개 이상, +4% 이상 상승종목 1개 이상, 표본 평균 양수의 근거가 필요함.
- Google 뉴스 RSS에서 매체 및 발행일을 확인한 **당일 기사 제목에 해당 종목/섹터가 등장**해야 리뷰 후보로 등록함. 출처 URL이 Google 뉴스 경유일 수 있음; 뉴스 제목은 상승 원인의 확정 증거가 아님. 공시나 공식 발표로 격상하지 않음.
- 검증한 섹터가 1개만 있으면 1개만 등록. 미확인 시가총액·전체 Breadth·연속 상승일·종목 수급은 미산출. 0개면 새 리뷰 파일 없이 `public/sector-review-status.json`에 `pending` 사유만 남김.
- 변경 사항이 있으면 `automation/verified-sector-calendar-YYYY-MM-DD` 브랜치와 PR을 생성. 먼저 **npm test, tsc, build**를 실행하고, `pages.yml`을 PR 브랜치에서 별도 수동 dispatch하여 CI 성공까지 대기. 실패 시 병합하지 않음.
- CI 통과 후 PR 병합, `pages.yml`을 main에서 dispatch, **실제 deploy 잡 성공**을 확인할 때만 성공 로그 `SECTOR_PAGES_DEPLOYED` 출력. GitHub의 `GITHUB_TOKEN`으로 생성된 PR/커밋은 기본 push/PR 워크플로가 트리거되지 않으므로 수동 dispatch가 필요함.
- 작업에 `contents:write`, `pull-requests:write`, `actions:write` 권한이 필요. 저장소 Settings → Actions → General → Workflow permissions에서 **Allow GitHub Actions to create and approve pull requests**가 꺼져 있으면 PR 생성이 차단되며, 이때 **배포 성공으로 보고하지 않음**.
- 당일 변경사항이 없으면 중복 PR·중복 배포하지 않음. 기존 캘린더 TOP3/상세 TOP5, 검증 리뷰와 디자인은 변경하지 않음.
- 스케줄은 GitHub 호스팅 플랫폼에서 지연되거나 누락될 수 있어 보조 시각 17:30, 18:00을 둠.
