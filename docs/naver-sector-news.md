# 네이버 뉴스 수집

네이버 공식 뉴스 검색 API의 RSS(XML) 응답을 사용합니다.
공식 문서: https://developers.naver.com/docs/serviceapi/search/news/news.md

GitHub repository Settings → Secrets and variables → Actions → Repository secrets:
- NAVER_CLIENT_ID
- NAVER_CLIENT_SECRET

네이버 개발자센터 애플리케이션에 검색 API 사용 권한이 필요합니다.
키는 Actions 요청 헤더로만 전달하며 빌드·브라우저·로그에 포함하지 않습니다.

캘린더의 가격 후보 섹터별로 최대 5회 검색하고, 한국시간 당일 뉴스만 사용합니다.
원문 도메인이 허용 언론사와 일치하는 기사만 받아 원문 링크와 언론사를 표시합니다.
네이버 응답의 pubDate는 네이버 제공 시각이며 원문 작성 시각과 다를 수 있습니다.
기사 제목·요약은 상승 원인을 확정하는 증거로 간주하지 않습니다.
구글 RSS와 제목/URL 중복을 제거하며, 키 누락·네이버 장애 시 기존 구글 경로를 유지합니다.
기존 확정 리뷰는 자동으로 덮어쓰지 않습니다.

실행 로그의 NAVER_NEWS_CONFIG=ready는 키가 존재함을 뜻하며 인증 성공을 보장하지 않습니다.
NAVER_SECTOR_NEWS status=ok count=N은 실제 네이버 요청과 RSS 검증 결과입니다.
