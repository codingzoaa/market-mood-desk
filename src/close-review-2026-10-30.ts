import type {CloseReview} from './close-reviews';

// 2026-10-30 KRX regular-session close; editorial shortlist, not a computed TOP5 ranking.
// Verified using 2026-10-30 15:55/16:06 KST post-close articles. Prior close is 2026-10-29.
// No NXT/after-hours/live widget quotes or market-wide investor flows are used as sector inputs.
export const review20261030:CloseReview={
  date:'2026-10-30',
  session:'KRX 정규장 마감 · 15:30 KST',
  summary:'코스피 5,730.74(-3.48%), 코스닥 724.38(-3.83%). 미국 빅테크 실적 충격으로 AI·반도체주 급락. 정규장 마감 근거로 제약·바이오와 2차전지 셀 제조사 일부의 상대 강세를 확인. 2개 그룹만 편집 선정.',
  coverageNote:'2026-10-30 연합뉴스 16:06·뉴스투데이 15:55의 KRX 정규장 마감 보도와 10/29 뉴스핌 15:49의 직전 종가를 확인했습니다. 코스피 제약 업종 +4.90%와 삼성바이오로직스 +8.86%, 셀트리온 +1.22%, HLB +0.76%를 확인했습니다. 다만 광의 제약·바이오 STOCK_MAP 12종목 전체의 종가는 확인하지 못했습니다. 2차전지 셀은 STOCK_MAP의 breadth=true 구성종목 2개(삼성SDI·LG에너지솔루션)가 모두 당일 상승했음을 확인했지만 상승폭은 각각 1% 미만이며 소재주 에코프로(-1.50%)·에코프로비엠(-1.20%)은 하락해 전체 2차전지 산업으로 확장할 수 없습니다. 운송·창고(+1.33%), 음식료·담배(+1.08%) 업종 상승도 확인했으나 개별 동반 종목의 같은 날짜 종가가 부족해 선정하지 않았습니다. 당일 신규 공시·공식 발표가 직접적인 상승 촉매라는 근거가 없어 뉴스·공시 점수는 입력하지 않았습니다. 종목별 정규장 거래대금/시가총액, 외국인+기관 순매수, 전체 제약·바이오 breadth, 섹터 평균등락률·거래대금 증감률·신고가 수는 미확인입니다. 확인된 직전 리뷰는 10/29 금융·증권 1개 그룹뿐이며, 해당 리뷰의 미수록만으로 NEW/RE/WEAK를 확정할 수 없어 모두 잠정 상태입니다. 5개 강도점수 구성요소가 완성되지 않아 총점·등급은 미산출입니다. 정치·이슈 테마와 중복 세부 테마는 포함하지 않았습니다.',
  marketFlow:'2026-10-30 KRX 정규장 마감: 코스피 5,730.74(-3.48%), 코스닥 724.38(-3.83%). 외국인 코스피 약 1조6,168억원 순매도(연합뉴스 집계). 시장 전체 수급으로 종목별 수급 점수에 대입하지 않았습니다.',
  sources:[
    {title:'연합뉴스 · 2026-10-30 16:06 · KRX 마감·업종별 등락·대표주 종가',url:'https://www.yna.co.kr/view/AKR20261030131551008'},
    {title:'뉴스투데이 · 2026-10-30 15:55 · KRX 마감·삼성바이오·셀트리온·2차전지 셀 종가',url:'https://www.news2day.co.kr/article/20261030500276'},
    {title:'뉴스핌 · 2026-10-29 15:49 · 직전 정규장 삼성바이오·LG에너지솔루션 종가',url:'https://www.newspim.com/news/view/20261029000947'},
    {title:'Market Mood Desk · STOCK_MAP · 2026-10-30 검토 · 셀 제조사 breadth 2종목 정의',url:'https://github.com/codingzoaa/market-mood-desk/blob/main/src/data/stock-map.json'}
  ],
  sectors:[
    {
      name:'제약·바이오',
      leaderSymbol:'207940',
      breadthGroup:'제약·바이오',
      status:'RE',
      kind:'산업 · 코스피 제약 업종 +4.90% · 대형 실적주 중심 상대 강세 · RE 잠정',
      leader:'삼성바이오로직스 +8.86% (KRX 정규장 종가)',
      companions:'셀트리온 +1.22% · HLB +0.76% (KRX 정규장 종가, 서로 다른 사업모델)',
      reason:'[2026-10-30 언론 마감 보도, 연합뉴스·뉴스투데이] 코스피 제약 업종은 +4.90% 상승했고 삼성바이오로직스(+8.86%)·셀트리온(+1.22%)·HLB(+0.76%)가 플러스 마감했다. 급락장에서 대형 바이오주가 상대적으로 강했으나 당일 공통 신규 수주·임상·공시 등 직접적인 촉매는 확인되지 않았다. 공시 점수로 처리하지 않는다.',
      outlook:'코스피 제약 업종 상승과 3개 대표주의 플러스 종가는 확인했지만 STOCK_MAP 제약·바이오 12종목 전체 상승비율은 미확인. 다음 거래일 업종 확산·대금·종목별 수급을 확인하기 전 지속 주도 판단 보류.',
      change:'10/29 삼성바이오로직스 -0.44% → 10/30 +8.86%(등락률 +9.30%p), 직전 거래일 하락 뒤 하루 반등. 10/29 편집 리뷰에는 제약·바이오가 미수록됐으나 전체 구성종목의 직전 종가를 확인하지 못해 RE 잠정. 대표주 연속 상승일은 1일만 확인.',
      sourceIds:[0,1,2],
      scoreInput:{date:'2026-10-30',streak:1,sourceUrls:['https://www.yna.co.kr/view/AKR20261030131551008','https://www.newspim.com/news/view/20261029000947']}
    },
    {
      name:'2차전지 셀',
      leaderSymbol:'373220',
      breadthGroup:'2차전지 셀',
      status:'RE',
      kind:'산업 · 셀 제조사 2종목 동반 상승 · 소재주 약세 · RE 잠정',
      leader:'LG에너지솔루션 +0.98% (KRX 정규장 종가)',
      companions:'삼성SDI +0.93% (KRX 정규장 종가) · 소재주 에코프로 -1.50%, 에코프로비엠 -1.20%로 차별화',
      reason:'[2026-10-30 언론 마감 보도, 연합뉴스·뉴스투데이] 전체 지수 급락에도 LG에너지솔루션과 삼성SDI가 각각 +0.98%, +0.93% 상승했다. 두 셀 제조사의 제한적인 반등이며, 당일 공통 신규 수주·정책·공시 등 확정 촉매는 확인되지 않았다. 소재 업종까지 동반 상승했다고 해석하지 않는다.',
      outlook:'STOCK_MAP의 2차전지 셀 breadth 대상 2종목 모두 상승(2/2)했지만 절대 상승률은 1% 미만. 전체 셀·소재 산업의 강도나 주도권 회복으로 일반화하지 않고 다음 거래일 대금·수급·상승 지속성을 확인.',
      change:'10/29 LG에너지솔루션 -8.60% → 10/30 +0.98%(등락률 +9.58%p), 직전 거래일 급락 후 반등. 10/29 리뷰에 셀 그룹은 미수록됐고 전체 2차전지 산업 전일 자료는 불완전해 RE 잠정. 대표주 연속 상승일은 1일만 확인.',
      sourceIds:[0,1,2,3],
      scoreInput:{date:'2026-10-30',up:2,members:2,streak:1,sourceUrls:['https://www.yna.co.kr/view/AKR20261030131551008','https://www.newspim.com/news/view/20261029000947','https://github.com/codingzoaa/market-mood-desk/blob/main/src/data/stock-map.json']}
    }
  ]
};
