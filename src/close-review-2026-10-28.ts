import type {CloseReview} from './close-reviews';

// 2026-10-28 KRX regular-session close. Editorial shortlist, not a
// computed market-wide ranking. Unverified rubric inputs are deliberately omitted.
export const review20261028:CloseReview={
  date:'2026-10-28',
  session:'KRX 정규장 마감 · 15:30 KST',
  summary:'코스피 6,012.44(+6.63%), 코스닥 771.28(+3.69%). 메모리 반도체가 주도하고 반도체 장비·로봇 대표주·2차전지 일부가 동반 상승. 확인 가능한 산업 그룹 4개만 수록.',
  coverageNote:'2026-10-28 15:57 발표된 정규장 마감 기사와 10/27 저장 리뷰를 대조한 편집 선정 4개입니다. 당일 KRX 정규장 종가가 명시된 종목만 수치로 기재했습니다. 10/28 LS 원본 snapshot/heatmap과 STOCK_MAP 전체 구성종목 종가, 대표주 당일 거래대금·시가총액·외국인+기관 순매수, 연속 상승 전체 이력, 신고가 종목수는 검증하지 못했습니다. 강도점수 5항목 중 미확인은 생략하며 총점·등급을 계산하지 않습니다. NEW/HOT/RE/WEAK는 직전 리뷰만으로 정량 상태를 확정할 수 없어 잠정입니다. 단기 정치·이슈 테마는 포함하지 않았습니다. 마감 기사 본문의 코스닥 +3.96% 표기는 전일 종가 743.83 대비 +27.45포인트로 계산되는 +3.69%와 불일치하므로 +3.69%를 사용합니다.',
  marketFlow:'10/28 KRX 정규장 마감 보도: 코스피 외국인 8,228억원·기관 9,607억원 순매수, 개인 1조8,016억원 순매도. 시장 전체 수급이며 개별 대표종목 수급 점수에는 사용하지 않았습니다.',
  sources:[
    {title:'뉴시스 · 2026-10-28 15:57 (16:01 수정) · KRX 마감 및 종목별 종가',url:'https://mobile.newsis.com/view_amp.html?ar_id=NISX20261028_0003845065'},
    {title:'뉴시스 · 2026-10-28 16:21 · KOSPI·KOSDAQ 마감 지수',url:'https://www.newsis.com/view/NISX20261028_0003845123'},
    {title:'로이터 · 2026-10-28 · SK하이닉스 실적·AI 투자심리 (시장 재료)',url:'https://www.reuters.com/world/china/global-markets-global-markets-2026-10-28/'},
    {title:'보숲 · 2026-10-27 15:30 · 레인보우로보틱스 직전 정규장 종가',url:'https://www.bosoop.com/stocks/277810/'}
  ],
  sectors:[
    {
      name:'메모리 반도체',
      leaderSymbol:'000660',
      breadthGroup:'메모리 반도체',
      status:'HOT',
      kind:'산업 · 실적·주주환원·대형주 동반 상승 · HOT 잠정',
      leader:'SK하이닉스 +10.89% · 종가 1,487,000원',
      companions:'삼성전자 +9.01% · 종가 242,000원 · SK스퀘어 +11.23% (지주사, breadth 구성에는 미포함)',
      reason:'[언론 보도, 2026-10-28, 뉴시스·로이터] SK하이닉스가 AI 메모리 수요 확대에 따른 3분기 사상 최대 실적과 추가 주주환원 계획을 발표했다는 보도가 나왔다. 미국 반도체주 강세와 함께 삼성전자·SK하이닉스의 정규장 종가가 동반 급등했다. 회사 공시 원문은 별도 확인되지 않아 공시 점수로 분류하지 않는다.',
      outlook:'10/27에 이어 대표 메모리 2종목 상승이 확인됐다. 다만 전체 STOCK_MAP breadth, 10/28 거래대금/시총, 대표주 외국인·기관 수급 및 완전한 연속 상승일 자료가 없어 총점·등급은 미산출.',
      change:'10/27 메모리 반도체 리뷰 존재. SK하이닉스 +5.18% → +10.89%(+5.71%p), 삼성전자 +4.23% → +9.01%(+4.78%p). 2거래일 연속 대표주 상승은 확인되나 섹터 전체 지속성·HOT 확정은 보류.',
      sourceIds:[0,1,2],
      scoreInput:{date:'2026-10-28',news:'reported',sourceUrls:['https://mobile.newsis.com/view_amp.html?ar_id=NISX20261028_0003845065','https://www.reuters.com/world/china/global-markets-global-markets-2026-10-28/']}
    },
    {
      name:'반도체 장비·테스트',
      leaderSymbol:'036930',
      breadthGroup:'반도체 장비·테스트',
      status:'RE',
      kind:'산업 · 소부장 동반 반등 · RE 잠정',
      leader:'주성엔지니어링 +6.12%',
      companions:'이오테크닉스 +5.95% (정규장 마감 기사 확인)',
      reason:'[언론 보도, 2026-10-28, 뉴시스] 메모리 대형주의 급등과 AI 반도체 투자심리 회복이 장비주에도 확산됐다. 주성엔지니어링과 이오테크닉스의 상승 마감은 확인됐으나 두 회사의 당일 신규 수주 공시를 확인한 것은 아니다.',
      outlook:'대표 장비주 2개 상승은 확인됐지만 STOCK_MAP 전체 장비·테스트 종목의 상승비율과 개별 거래대금·수급은 미확인. 반도체 대형주와 중복된 종목은 구성하지 않는다.',
      change:'10/27 동일 산업 리뷰 존재. 주성엔지니어링 +4.30% → +6.12%(+1.82%p). 전일 대표주 네오셈의 10/28 종가는 미확인, 따라서 섹터 전체 지속 여부는 잠정.',
      sourceIds:[0],
      scoreInput:{date:'2026-10-28',news:'reported',sourceUrls:['https://mobile.newsis.com/view_amp.html?ar_id=NISX20261028_0003845065']}
    },
    {
      name:'로봇·자동화',
      leaderSymbol:'277810',
      breadthGroup:'로봇·자동화',
      status:'RE',
      kind:'산업 · 대표주 급등 · 업종 확산 미확인 · RE 잠정',
      leader:'레인보우로보틱스 +15.08%',
      companions:'당일 다른 로봇 구성종목의 KRX 정규장 종가·동반 상승은 미확인',
      reason:'[언론 보도, 2026-10-28, 뉴시스] 레인보우로보틱스가 코스닥 대형주 중 두드러진 상승률로 마감했다. 같은 날 확인된 신규 계약·공식 발표가 없어 상승 원인을 확정하지 않는다.',
      outlook:'단일 대표주의 급등을 전체 로봇 업종 강세로 일반화하지 않는다. 로보티즈·에브리봇 등 구성종목 종가와 거래대금 확인 전 breadth 점수는 미산출.',
      change:'10/26 로봇 리뷰가 존재하고 10/27 TOP5에는 미포함. 레인보우로보틱스는 10/27 +1.15%(15:30 종가 기준)에서 10/28 +15.08%로 상승폭 확대. RE는 잠정.',
      sourceIds:[0,3],
      scoreInput:{date:'2026-10-28',sourceUrls:['https://mobile.newsis.com/view_amp.html?ar_id=NISX20261028_0003845065']}
    },
    {
      name:'2차전지 셀·소재',
      leaderSymbol:'086520',
      breadthGroup:'2차전지 셀·소재',
      status:'RE',
      kind:'산업 · 대형주·소재 선별 반등 · RE 잠정',
      leader:'에코프로 +3.09%',
      companions:'에코프로비엠 +3.07% · LG에너지솔루션 +1.83%',
      reason:'[언론 보도, 2026-10-28, 뉴시스] 코스닥과 유가증권시장 동반 상승 속 2차전지 소재·셀 종목 일부가 플러스 마감했다. 10/28 산업 전체를 움직인 신규 공시나 독립 촉매는 확인되지 않았다.',
      outlook:'동반 상승 3종목은 확인했으나 전체 STOCK_MAP 구성종목 종가와 대표종목 거래대금·수급은 확인되지 않았다. 강한 신규 주도 섹터로 단정하지 않는다.',
      change:'10/27 동일 산업 리뷰 존재. 전일 에코프로는 +6%대, 에코프로비엠 +3%대, LG에너지솔루션 +2.00%였으며 10/28은 각각 +3.09%, +3.07%, +1.83%. 전일 대표주 삼성SDI의 오늘 종가는 미확인.',
      sourceIds:[0],
      scoreInput:{date:'2026-10-28',sourceUrls:['https://mobile.newsis.com/view_amp.html?ar_id=NISX20261028_0003845065']}
    }
  ]
};
