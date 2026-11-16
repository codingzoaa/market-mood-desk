import type {CloseReview} from './close-reviews';
// Historical review restored on 2026-11-16; original source dates remain explicit.
export const review20261113:CloseReview={
  "date": "2026-11-13",
  "session": "KRX 정규장 마감 · 과거 종가 사후 대조",
  "summary": "은행·금융지주와 일부 반도체 장비주의 동반 상승을 확인했습니다.",
  "coverageNote": "2026-11-16에 미등록 리뷰를 사후 복원했습니다. 확인한 동반 상승 그룹만 수록하며 시장 전체 공식 순위가 아닙니다. 은행·비은행 금융지주를 함께 묶었으며 반도체 장비 그룹과 구성종목이 겹치지 않습니다. 미확인 원인·점수·수급은 추가하지 않습니다.",
  "sources": [
    {
      "title": "비즈니스포스트 · 2026-11-13 17:09 · 금융주 강세·신한지주 및 피에스케이 정규장 마감",
      "url": "https://admin.businesspost.co.kr/BP?command=mobile_view&num=451995"
    },
    {
      "title": "KB금융 IR 일별 주가 · 2026-11-13 종가 159,000원, +4.74%",
      "url": "https://www.gsifn.co.kr/IR/kbfng/v5/ir_daily.html"
    },
    {
      "title": "한국경제 · 신한지주 일별시세 · 2026-11-13 종가 89,800원, +5.65%",
      "url": "https://markets.hankyung.com/stock/055550/chart"
    }
  ],
  "sectors": [
    {
      "name": "은행·금융지주",
      "status": "NEW",
      "kind": "과거 리뷰 사후 복원 · 종가·원문 대조",
      "leaderSymbol": "055550",
      "leader": "신한지주 +5.65%",
      "companions": "KB금융 +4.74% · 하나금융지주 +3.40% · 우리금융지주 +3.01% · 메리츠금융지주 +5.42%",
      "reason": "당일 보도는 기술주 변동성 확대 속 금융주로의 매수 이동으로 해석했습니다. 은행과 비은행 금융지주를 함께 묶은 편집 그룹이며 각 회사의 동일 신규 재료를 뜻하지 않습니다.",
      "outlook": "정규장 종가와 출처를 사후 대조했습니다. 섹터 전체 거래대금·수급·강도점수는 산출하지 않습니다.",
      "change": "2026-11-16 사후 복원. NEW는 해당 날짜 리뷰에 편입한 표시이며, 실제 신규 추세나 연속 상승 확정이 아닙니다.",
      "sourceIds": [
        0,
        1,
        2
      ]
    },
    {
      "name": "반도체 장비",
      "status": "NEW",
      "kind": "과거 리뷰 사후 복원 · 종가·원문 대조",
      "leaderSymbol": "031980",
      "leader": "피에스케이 +8.91%",
      "companions": "피에스케이홀딩스 +6.74%",
      "reason": "두 반도체 장비주의 동반 상승을 당일 마감 기사로 확인했습니다. 반도체 대형주 전체의 강세나 공통 신규 공시로 일반화하지 않습니다.",
      "outlook": "정규장 종가와 출처를 사후 대조했습니다. 섹터 전체 거래대금·수급·강도점수는 산출하지 않습니다.",
      "change": "2026-11-16 사후 복원. NEW는 해당 날짜 리뷰에 편입한 표시이며, 실제 신규 추세나 연속 상승 확정이 아닙니다.",
      "sourceIds": [
        0
      ]
    }
  ]
};
