import type {CloseReview} from './close-reviews';

// 2026-10-27: regular-session close only. Never substitute intraday or ATS quotes.
export const review20261027:CloseReview={
  date:'2026-10-27',
  session:'KRX 정규장 마감 · 15:30 KST',
  summary:'코스피 5,638.34 (+3.09%, AP 종가 보도). 반도체 대형주 동반 반등; 그 밖의 산업군은 당일 정규장 종가 근거 부족.',
  coverageNote:'2026-10-27 정규장 마감 확인: AP의 코스피 5,638.34(+3.1% 반올림) 및 SK하이닉스·삼성전자 종가 등락률. 동일 날짜의 일부 다른 웹페이지에는 5,680.30(+3.85%) 등 장중 수치가 표시되므로 종가로 사용하지 않았습니다. 코스닥 마감지수, 다른 산업의 당일 정규장 종가·거래대금·시가총액·구성종목 전체 상승 비율·종목별 외국인/기관 수급·연속 상승일·신고가 수를 충분히 검증하지 못했습니다. 이에 산업 그룹 1개만 수록하며 TOP5를 채우지 않고 강도 총점·등급을 미산출합니다. NEW/RE/HOT/WEAK는 직전 거래일 전체 구성종목 종가 비교가 없어 잠정입니다.',
  sources:[
    {title:'AP · 2026-10-27 · 아시아 증시 마감, 코스피·삼성전자·SK하이닉스 정규장 종가',url:'https://apnews.com/article/stocks-markets-ai-earnings-oil-e11a2240fc3283c4507d44b9833f30a2'},
    {title:'Reuters · 2026-10-27 · 한국 3분기 GDP·반도체 수출 (경제지표 보도, 종가 자료 아님)',url:'https://www.reuters.com/world/asia-pacific/south-koreas-economy-grows-faster-than-expected-third-quarter-2026-10-26/'},
    {title:'Reuters · 2026-10-26 · SK하이닉스 주주환원 검토 보도 (전일 재료, 공식 확정 공시 아님)',url:'https://www.reuters.com/world/asia-pacific/sk-hynix-announce-steps-boost-shareholder-returns-wednesday-2026-10-26/'},
    {title:'머니투데이 · 2026-10-27 09:18 · 반도체 장비주 장중 상승 (정규장 종가 미확인, TOP5 제외)',url:'https://www.mt.co.kr/stock/2026/10/27/2026102709152566936'}
  ],
  sectors:[{
    name:'메모리 반도체',
    status:'RE',
    kind:'산업 · 대형주 동반 상승 · RE 잠정 · 정량 주도 확정 전',
    leader:'SK하이닉스 +5.2% (AP 정규장 마감 보도, 반올림)',
    companions:'삼성전자 +4.2% (AP 정규장 마감 보도, 반올림). 반도체 장비주는 장중 강세만 확인돼 종가 동반주로 포함하지 않음.',
    reason:'[언론 보도, AP 2026-10-27] 미국 AI·반도체주 반등과 양사 실적 발표 기대 속에 SK하이닉스·삼성전자가 동반 상승했다. [언론 보도, Reuters 2026-10-27] 한국 3분기 GDP 성장률이 예상보다 높았고 반도체 수출·설비투자가 기여했으나, 이는 신규 기업 공시가 아니다.',
    outlook:'반도체 대형주의 지수 반등 기여는 확인되지만 외국인·기관 종목별 순매수, 정규장 거래대금과 전체 장비·소재 확산은 미확인. 주도 재진입 후보로만 관찰하고 다음 거래일 종가·대금 유지 및 실적·주주환원 공식 발표를 검증. 하루짜리 반등 가능성 배제 불가.',
    change:'직전 거래일 10/26 리뷰의 의료AI·로봇과 달리 10/27에는 메모리 대형주 동반 상승이 확인됨. 10/26 메모리 반도체 전체 종가가 리뷰에 없어 RE 확정 불가; 10/23 리뷰에는 반도체 대형주 RE가 있었으나 중간 거래일의 주도 지속성 미검증.',
    sourceIds:[0,1,2,3],
    scoreInput:{
      date:'2026-10-27',
      news:'reported',
      sourceUrls:[
        'https://apnews.com/article/stocks-markets-ai-earnings-oil-e11a2240fc3283c4507d44b9833f30a2',
        'https://www.reuters.com/world/asia-pacific/south-koreas-economy-grows-faster-than-expected-third-quarter-2026-10-26/'
      ]
    }
  }]
};
