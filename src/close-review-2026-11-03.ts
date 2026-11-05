import type {CloseReview} from './close-reviews';

// 2026-11-03: dated 16:19 KST closing report. Editorial groups, not scored ranking.
// Holding-company control contest is recorded as an event, not aviation industry-wide strength.
export const review20261103:CloseReview={
 date:'2026-11-03',
 session:'KRX 정규장 마감 · 15:30 KST',
 summary:'코스피 5,648.79(-3.59%), 코스닥 704.39(-4.08%). 반도체·2차전지 급락 속 유통업이 상대 강세. 항공 지주사 경영권 분쟁은 별도 단기 이벤트로 구분.',
 coverageNote:'핀포인트뉴스 2026-11-03 16:19 마감 보도의 15:30 정규장 수치만 사용. 산업 강세로 확인 가능한 유통 그룹 1개만 선정. 한진칼·한진칼우 급등은 경영권 경쟁 이슈로 산업 강세 TOP5에서 제외. 제약·바이오는 삼성바이오로직스 +2.11%, 알테오젠 +0.23%이나 HLB -2.40%로 전체 확산 근거 부족. 전체 STOCK_MAP 구성종목 종가, 거래대금·시총, 상승 비율, 연속 상승일, 대표종목 외국인+기관 수급, 신고가 수 및 독립 신규 공시 원문 미확인. 강도점수·등급 미산출. 11/02 리뷰는 전체 시장을 망라하지 않은 편집 선정이므로 NEW/RE 상태는 잠정.',
 sources:[
  {title:'핀포인트뉴스 · 2026-11-03 16:19 · KRX 정규장 마감 및 유통·항공 종목',url:'https://www.pinpointnews.co.kr/news/articleView.html?idxno=500980'},
  {title:'Market Mood Desk · 2026-11-02 · 직전 거래일 편집 리뷰',url:'https://github.com/codingzoaa/market-mood-desk/blob/main/src/close-review-2026-11-02.ts'}
 ],
 sectors:[{
  name:'유통·소매',
  status:'NEW',
  kind:'산업 · 방어적 상대 강세 · NEW 잠정',
  leader:'BGF리테일 +4.96% (종가 143,900원)',
  leaderSymbol:'282330',
  companions:'롯데쇼핑 +2.46% · 이마트 +1.62% · GS리테일 +0.67% · 호텔신라 +0.84%',
  reason:'[언론 마감 보도, 2026-11-03 16:19] 반도체·2차전지 중심의 급락장에서도 백화점·일반상점 등 유통주에 상대적인 매수세가 유입됐다. 당일 산업 전체를 설명하는 신규 기업 공시·공식 발표는 확인하지 못했다.',
  outlook:'대표 유통주 5종목 상승을 확인했으나 STOCK_MAP 전체 상승 비율·정규장 거래대금·외국인+기관 수급과 연속 상승 여부는 미확인. 방어적 일시 강세인지 다음 거래일 확인.',
  change:'11/02 편집 리뷰에는 유통 그룹이 없지만 11/02 유통업 전체 종가가 확인되지 않아 NEW 잠정. 정량적인 전일 대비 업종 강도 변화는 미산출.',
  sourceIds:[0,1]
 }]
};