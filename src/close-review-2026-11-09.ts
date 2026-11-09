import type {CloseReview} from './close-reviews';
// Verified same-day LS quote sample + dated news headlines; missing measurements are not inferred.
export const review20261109:CloseReview={
  "date": "2026-11-09",
  "session": "KRX 정규장 마감 · LS 저장 종목 검증",
  "summary": "거래대금 상위 LS 표본·당일 신뢰매체 기사로 교차확인한 강세 섹터 1개",
  "coverageNote": "정규장 종가 확인, LS 표본에서 동반 상승한 종목에 한해 당일 매체 기사와 교차검증. 순서는 표본 평균등락률 순의 후보 선정이며 KRX 공식 섹터 TOP5 순위가 아닙니다. 당일 시가총액·섹터 전체 Breadth·대표종목 기관/외국인 수급·확정 지속일 등 미확인 값은 강도점수 미산출. 기사 제목만으로 인과관계를 확정하지 않음. 검증 가능한 1개만 등록.",
  "marketFlow": "종목별 수급 원자료 미확인 · 섹터 수급 점수 미산출",
  "sources": [
    {
      "title": "뉴스핌 · 2026-11-09 · 코스피·코스닥 동반 상승 전환…기관 매수에 반도체주 반등 - 뉴스핌",
      "url": "https://news.google.com/rss/articles/CBMiXEFVX3lxTE5KQUFyV2FFR1BmbUMya1UtcjVuZU9PeWpfOFFJQ2tYQTVZY0hMRWJzZTdVT3JDX3I0M29hR0RWaGQwcDhaQ2lkc1VQLVcwLU5mY3RkZlZWb0VWdVBs?oc=5"
    }
  ],
  "sectors": [
    {
      "name": "반도체",
      "status": "NEW",
      "kind": "정규장 LS 표본 + 당일 매체 기사 · NEW 잠정",
      "leaderSymbol": "036930",
      "leader": "주성엔지니어링 +5.27%",
      "companions": "대덕전자 +3.65% · 심텍 +5.45% · HPSP +1.50% · 피에스케이 +2.18%",
      "reason": "[뉴스핌 · 2026-11-09 보도] 코스피·코스닥 동반 상승 전환…기관 매수에 반도체주 반등 - 뉴스핌. 기사 제목과 종가 동반 상승은 확인했으나 상승 원인·공통 공시 간 인과관계는 별도 검증이 필요합니다.",
      "outlook": "LS 거래대금 상위 표본에서 11/16개 종목 상승. 섹터 전체 종목 전수·기관/외국인 수급·신고가와 재료 지속성은 추가 확인이 필요합니다.",
      "change": "직전 거래일 동일 구성종목·거래대금 비교 미확인. NEW는 당일 편집 선정의 잠정 분류이며 신규 추세 확정을 뜻하지 않습니다.",
      "sourceIds": [
        0
      ]
    }
  ]
};
