# 공통 분류 수정

종목 섹터맵의 분류 수정 창에서 대분류·세부 섹터·투자 테마를 입력하고 **GitHub에서 공통 저장**을 선택한다. 열린 GitHub 요청을 저장소 운영자 계정으로 제출하면 자동 검증·커밋·Worker 및 Pages 배포 후 모든 기기에 반영된다. 방문자의 요청은 실행하지 않는다. API 키나 GitHub 토큰을 웹페이지에 입력하지 않는다.

기존 **이 브라우저에 저장**은 기기별 초안이다. 더 최근의 공통 수정이 있으면 오래된 기기별 수정은 적용하지 않는다. 공통 수정이 존재하면 **공통 수정 해제 요청**으로 자동 분류를 복원할 수 있다. 요청 생성 후 다른 수정이 먼저 저장됐으면 충돌로 중단하며 사이트 새로고침 후 다시 제출한다.

공통 데이터: `src/data/stock-sector-overrides.json`. 자동 수집은 이 파일을 수정하지 않는다. 원래 145종목의 Breadth 편입 여부는 수정 대상이 아니다. 현재 분류를 과거 시세에 소급하지 않는다.

# 2026-11-16 검토

KRX KIND 상장기업 목록 2,769개와 수집 종목 194개를 대조했다. 64개 검토 대기를 모두 해소했다. 기존 검증 완료 130개의 분류는 유지했다. 이전 개별 검토한 이수스페셜티케미컬·후성의 상세 분류는 `stock-sector-reviews.json`에서 우선 적용된다.

- 사업·제품 근거: https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13
- 아주IB투자: https://kind.krx.co.kr/external/2026/03/19/001877/20260319007737/11011.htm
- 앤로보틱스: https://kind.krx.co.kr/external/2026/05/15/002782/20260515006335/11013.htm
- 아리바이오LAB 상호 확인: https://kind.krx.co.kr/external/2026/05/26/000652/20260526001497/70765.htm
- 대한항공 우선주: https://www.koreanair.com/contents/footer/about-us/investor-relations/shareholder-information/details

아리바이오홀딩스는 이름에서 바이오 테마를 추론하지 않고 공식 제품인 LED·조명으로 분류했다. 제품 정보만으로 반도체 노출이 확인되지 않는 세라믹 기판·산업용 배관·원자현미경은 각각 전자부품·기계로 보수적으로 구분했다. 분류는 사업 확인 결과이며 투자 추천이나 매출 비중 평가가 아니다.
