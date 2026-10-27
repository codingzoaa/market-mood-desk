import type {CloseReview} from './close-reviews';

export const review20261027:CloseReview={
  date:'2026-10-27',
  session:'KRX 정규장 마감 · 15:30 KST',
  summary:'10/27 정규장 기준 메모리 반도체·PCB/기판·반도체 장비/테스트·2차전지·제약바이오가 동반 반등. 점수 5요소 미완성으로 총점·등급은 미산출.',
  coverageNote:'10/27 KRX 종가·거래대금·시가총액을 우선 사용하고 장중 기사는 재료·확산 참고용으로만 사용했습니다. 섹터 전체 상승비율과 대표종목 당일 외국인+기관 수급 등 미확인 값은 scoreInput에서 생략했습니다. 따라서 모든 섹터의 총점·등급은 미산출입니다. NEW/RE는 10/26에 동일 섹터가 없어 잠정 상태입니다.',
  marketFlow:'코스피 5,638.34(+3.09%), 코스닥 743.83(+2.29%). 시장 전체 반등이었지만 시장 수급을 개별 섹터 점수에 대입하지 않았습니다.',
  sources:[
    {title:'콕스톡 · 2026-10-27 KRX 종가·거래대금·시가총액',url:'https://www.kokstock.com/stock/search.asp'},
    {title:'한스경제 · 2026-10-27 · 앤트로픽 IPO 기대와 반도체 강세',url:'https://www.hansbiz.co.kr/news/articleView.html?idxno=876549'},
    {title:'머니투데이 · 2026-10-27 · PCB/기판 동반 강세',url:'https://www.mt.co.kr/stock/2026/10/27/2026102709065757624'},
    {title:'전자신문 · 2026-10-26 · 현대차 아틀라스 공급망',url:'https://www.etnews.com/20261026000283'},
    {title:'뉴시스 · 2026-10-27 · AI·반도체 투자심리 회복',url:'https://www.newsis.com/view/NISX20261027_0003842382'}
  ],
  sectors:[
    {
      name:'메모리 반도체',
      leaderSymbol:'000660',
      breadthGroup:'메모리 반도체',
      status:'RE',
      kind:'산업 · 대형주 동반 반등 · RE 잠정',
      leader:'SK하이닉스 +5.18% · 거래대금 3조8,387억원',
      companions:'삼성전자 +4.23% · 거래대금 2조9,738억원 · SK스퀘어 +7.67%',
      reason:'[언론 보도, 2026-10-27] 앤트로픽 IPO 추진과 미국 반도체주 반등으로 AI 투자심리가 회복되며 국내 메모리 대형주가 동반 상승.',
      outlook:'대표주 거래대금은 충분하지만 전체 breadth와 당일 종목별 외국인+기관 수급이 없어 총점 미산출. 다음 거래일 실적 발표와 대금 유지 확인.',
      change:'10/26 동일 그룹 미수록. 10/23 반도체 대형주 RE 기록은 있으나 직전 거래일 비교가 불완전해 RE 잠정.',
      sourceIds:[0,1,4],
      scoreInput:{date:'2026-10-27',turnover:38387,marketCap:9795903,news:'reported',streak:1,sourceUrls:['https://www.kokstock.com/stock/search.asp','https://www.hansbiz.co.kr/news/articleView.html?idxno=876549']}
    },
    {
      name:'PCB·반도체 기판',
      leaderSymbol:'007810',
      breadthGroup:'PCB·반도체 기판',
      status:'RE',
      kind:'산업 · 다종목 확산 · RE 잠정',
      leader:'코리아써키트 +13.40% · 거래대금 669억원',
      companions:'심텍 +9.23% · 대덕전자 +6.68% · 삼성전기 +7.42%',
      reason:'[언론 보도, 2026-10-27] 미국 기술주 반등과 AI 서버 투자 기대가 PCB·기판주로 확산. 신규 수주 공시로 확인된 상승은 아님.',
      outlook:'4개 주요 종목 동반 상승은 확인. 전체 섹터 breadth와 대표주 수급 미확인으로 총점·등급 미산출.',
      change:'10/26 동일 그룹 미수록. 직전 거래일 직접 비교가 없어 RE 잠정.',
      sourceIds:[0,2,4],
      scoreInput:{date:'2026-10-27',turnover:669,marketCap:18059,news:'reported',streak:1,sourceUrls:['https://www.kokstock.com/stock/search.asp','https://www.mt.co.kr/stock/2026/10/27/2026102709065757624']}
    },
    {
      name:'반도체 장비·테스트',
      leaderSymbol:'253590',
      breadthGroup:'반도체 장비·테스트',
      status:'RE',
      kind:'산업 · 소부장 확산 · RE 잠정',
      leader:'네오셈 +13.29% · 거래대금 825억원',
      companions:'주성엔지니어링 +4.30% · 한미반도체 +4.02% · HPSP +2.67%',
      reason:'[언론 보도, 2026-10-27] 미국 AI·반도체주 반등과 앤트로픽 IPO 기대가 국내 장비·테스트주로 확산.',
      outlook:'정규장 동반 상승은 확인했지만 전체 장비주 breadth와 당일 종목별 수급 미확인. 단기 반등인지 주도 복귀인지 추가 확인.',
      change:'10/26 동일 그룹 미수록. 10/23 장비 관련 기록은 있으나 직전 거래일 비교가 없어 RE 잠정.',
      sourceIds:[0,1,4],
      scoreInput:{date:'2026-10-27',turnover:825,marketCap:7515,news:'reported',sourceUrls:['https://www.kokstock.com/stock/search.asp','https://www.hansbiz.co.kr/news/articleView.html?idxno=876549']}
    },
    {
      name:'2차전지 셀·소재',
      leaderSymbol:'006400',
      breadthGroup:'2차전지 셀·소재',
      status:'RE',
      kind:'산업 · 대형주·소재 동반 반등 · RE 잠정',
      leader:'삼성SDI +5.07% · 거래대금 2,348억원',
      companions:'LG에너지솔루션 +2.00% · 에코프로 +6%대 · 에코프로비엠 +3%대',
      reason:'[언론 보도, 2026-10-26] 현대차 아틀라스 공급망에 삼성SDI·LG에너지솔루션이 포함됐다는 보도가 전일 발표됐다. 10/27 당일 공시가 아니므로 뉴스 점수에는 사용하지 않음.',
      outlook:'셀·소재 동반 반등은 확인됐으나 당일 공통 신규 재료와 대표종목 수급 부족으로 총점 미산출.',
      change:'10/26 동일 그룹 미수록. 최근 WEAK 이후 재반등 성격이지만 직전 거래일 비교가 없어 RE 잠정.',
      sourceIds:[0,3],
      scoreInput:{date:'2026-10-27',turnover:2348,marketCap:409374,sourceUrls:['https://www.kokstock.com/stock/search.asp']}
    },
    {
      name:'제약·바이오',
      leaderSymbol:'207940',
      status:'RE',
      kind:'산업 · 선별 반등 · RE 잠정',
      leader:'삼성바이오로직스 +5.37% · 거래대금 1,232억원',
      companions:'엠에스바이오 +8.91% · 셀트리온 +0.74%',
      reason:'정규장 종가 기준 대형주와 일부 중소형주가 동반 반등했지만 10/27 공통 신규 수주·공시나 동일 산업 촉매는 확인되지 않음.',
      outlook:'공통 재료와 전체 breadth가 부족해 반도체 그룹보다 우선순위를 낮게 평가. 수급과 동반주 확대 전 HOT 승격 보류.',
      change:'10/26 의료AI는 별도 그룹이었고 광의 제약·바이오는 미수록. 직전 거래일 비교가 없어 RE 잠정.',
      sourceIds:[0],
      scoreInput:{date:'2026-10-27',turnover:1232,marketCap:636038,sourceUrls:['https://www.kokstock.com/stock/search.asp']}
    }
  ]
};
