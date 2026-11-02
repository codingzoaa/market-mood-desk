import type {CloseReview} from './close-reviews';

// 2026-11-02 KRX regular-session close; source-checked editorial selection, NOT a quantitative TOP5.
// Closing news was published 15:34-16:15 KST on 2026-11-02.
// MBN quote pages are used only where the individual symbol explicitly shows 2026.11.02 15:30.
// Earlier intraday MBN values for steel and other stocks are excluded.
// All statuses are provisional: 2026-10-30's two editorial groups do not establish
// the full prior-session sector roster, and missing groups cannot prove a NEW/RE transition.
export const review20261102:CloseReview={
  date:'2026-11-02',
  session:'KRX 정규장 마감 · 15:30 KST',
  summary:'코스피 5,859.08(+2.24%), 코스닥 734.36(+1.38%). 기관·기타법인 매수와 저PBR 공표 첫 거래일의 가치주 반등. 전력기기·조선·철강·메모리·반도체 장비 등 근거가 확인된 5개 산업 그룹을 편집 선정했으며 강도점수 순위는 아니다.',
  coverageNote:'2026-11-02 15:53 이데일리 정규장 마감 보도와 16:15 뉴데일리 마감 보도를 확인했습니다. 효성중공업·LS ELECTRIC·HD현대일렉트릭·한화오션·HD현대중공업은 MBN 종목 페이지에 2026.11.02 15:30으로 명시된 가격만 사용했습니다. 현대제철(+11.61%)은 이데일리·뉴데일리의 마감 기사로 확인했고, MBN의 15:11 가격(+11.41%)은 종가가 아니므로 배제했습니다. POSCO홀딩스 MBN 14:09, 삼성중공업 MBN 11:13 시세 역시 종가로 사용하지 않았습니다. 이데일리 업종 분류 기준 전기장비 +6.77%, 조선 +6.06%, 철강 +4.63%이며 뉴데일리의 업종 분류(+6.56% 조선 등)와 수치가 달라 섞어 계산하지 않았습니다. 철강 개별 동반 종목의 마감 등락률은 확보하지 못해 업종 상승만 기재했습니다. 전력기기·조선·철강·메모리·장비는 별도 산업 그룹이며 동일 종목을 두 그룹에 중복 사용하지 않았습니다. 단기 정치 테마는 제외했습니다. 10/30의 제약·바이오 및 2차전지 셀 편집 리뷰에 위 그룹들이 미수록된 사실은 전일 업종 약세의 증거가 아니므로 NEW/RE는 모두 잠정입니다. 전일 대비 섹터 정량 변화, 전체 STOCK_MAP 구성종목 종가, 시가총액 대비 대표주 거래대금, 전체 breadth, 연속 상승일, 대표주 외국인+기관 순매수, 신고가 종목 수는 확인하지 못했습니다. MBN 화면의 거래대금도 당일 시총·수급과 세트로 검증되지 않아 점수에 입력하지 않았습니다. 뉴스·공시 항목은 당일 언론이 직접 상승 재료로 연결한 보도만 reported로 입력했으며 공시·공식발표 점수로 간주하지 않았습니다. 5개 점수 요소가 완성되지 않아 총점과 등급은 미산출입니다.',
  marketFlow:'2026-11-02 KRX 정규장 마감: 코스피 5,859.08(+2.24%), 코스닥 734.36(+1.38%). 코스피 기관 약 1조2,329억원 순매수는 시장 전체 수급이며 개별 종목 수급 점수에 사용하지 않았습니다.',
  sources:[
    {title:'이데일리 · 2026-11-02 15:34, 수정 15:53 · KRX 정규장 마감·업종·대표주',url:'https://marketin.edaily.co.kr/News/ReadE?newsId=03709686645641784'},
    {title:'뉴데일리 · 2026-11-02 16:14, 수정 16:15 · KRX 정규장·저PBR 종목',url:'https://biz.newdaily.co.kr/site/data/html/2026/11/02/2026110200325.html'},
    {title:'MBN 증권 · 2026-11-02 15:30 · 효성중공업 KRX 정규장 종가',url:'https://mbnmoney.mbn.co.kr/stock/item?code=298040'},
    {title:'MBN 증권 · 2026-11-02 15:30 · LS ELECTRIC KRX 정규장 종가',url:'https://mbnmoney.mbn.co.kr/stock/item?code=010120'},
    {title:'MBN 증권 · 2026-11-02 15:30 · HD현대일렉트릭 KRX 정규장 종가',url:'https://mbnmoney.mbn.co.kr/stock/item?code=267260'},
    {title:'MBN 증권 · 2026-11-02 15:30 · 한화오션 KRX 정규장 종가',url:'https://mbnmoney.mbn.co.kr/stock/item?code=042660'},
    {title:'MBN 증권 · 2026-11-02 15:30 · HD현대중공업 KRX 정규장 종가',url:'https://mbnmoney.mbn.co.kr/stock/item?code=329180'},
    {title:'Market Mood Desk · 2026-10-30 · 확인된 직전 거래일 편집 리뷰',url:'https://github.com/codingzoaa/market-mood-desk/blob/main/src/close-review-2026-10-30.ts'}
  ],
  sectors:[
    {
      name:'전력기기·전력망',
      leaderSymbol:'298040',
      breadthGroup:'전력기기·전력망',
      status:'RE',
      kind:'산업 · 전기장비 업종 +6.77% · 대표 3종목 동반 급등 · RE 잠정',
      leader:'효성중공업 +13.32% (종가 2,050,000원)',
      companions:'LS ELECTRIC +7.35% (160,600원) · HD현대일렉트릭 +5.18% (446,500원), 모두 11/02 15:30',
      reason:'[2026-11-02 이데일리 언론 마감 보도] 최근 낙폭이 컸던 전력기기에 저가 매수세가 유입됐고 전기장비 업종이 +6.77% 상승했다. 3개 대표주의 종가 강세는 확인됐으나 당일 공통 신규 수주·공식 공시를 확인한 것은 아니다.',
      outlook:'대표 3종목 동반 상승이 강하지만 STOCK_MAP 전체 전력기기 구성종목의 종가와 거래대금·수급·연속 상승일이 미확인. 다음 거래일 업종 확산과 대금 유지 검증 필요.',
      change:'10/30 편집 리뷰에 전력기기 그룹이 없으나 전체 구성종목의 10/30 종가가 없어 RE는 잠정. 섹터 평균등락률·거래대금 증감률의 전일 대비 비교는 미산출.',
      sourceIds:[0,2,3,4,7]
    },
    {
      name:'조선·기자재',
      leaderSymbol:'042660',
      breadthGroup:'조선·기자재',
      status:'RE',
      kind:'산업 · 조선 업종 +6.06% · 대형 조선사 동반 상승 · RE 잠정',
      leader:'한화오션 +9.80% (종가 54,900원)',
      companions:'HD현대중공업 +5.11% (288,000원), 11/02 15:30 · 삼성중공업 장중 가격은 종가로 사용하지 않음',
      reason:'[2026-11-02 이데일리 언론 마감 보도] 한화오션이 첫 미국 해군 함정 건조 수주 소식에 +9.80% 마감했고, 조선 업종은 +6.06% 올랐다. 수주 내용은 언론 보도로 확인한 것이며 기업 공시 원문을 검증한 것은 아니다.',
      outlook:'대형 조선사 2종목의 정규장 상승 확인. 조선 기자재까지 전체 상승비율·거래대금 증감률·개별 수급은 확인하지 못해 지속형 주도 판단 보류.',
      change:'10/30 편집 리뷰에 조선 그룹 미수록. 전일 전체 조선주 종가가 없어 RE 잠정이며 당일 반등을 연속 강세로 확정하지 않음.',
      sourceIds:[0,5,6,7],
      scoreInput:{date:'2026-11-02',news:'reported',sourceUrls:['https://marketin.edaily.co.kr/News/ReadE?newsId=03709686645641784','https://mbnmoney.mbn.co.kr/stock/item?code=042660']}
    },
    {
      name:'철강',
      leaderSymbol:'004020',
      status:'NEW',
      kind:'산업 · 철강 업종 +4.63% · 저PBR 가치주 반등 · NEW 잠정',
      leader:'현대제철 +11.61% (정규장 마감 보도)',
      companions:'철강 업종 +4.63% · 개별 동반 종목의 11/02 정규장 종가 미확인',
      reason:'[2026-11-02 이데일리·뉴데일리 언론 마감 보도] KRX 저PBR 기업 첫 공표 이후 기업가치 개선 기대가 부각되며 현대제철이 +11.61% 급등했다. 제도 시행은 보도로 확인했으며 현대제철의 별도 신규 공시나 주주환원 확약으로 간주하지 않는다.',
      outlook:'업종 상승과 대표주 급등은 확인했으나 다른 철강주 종가와 STOCK_MAP 구성종목 범위가 미확인. 단일 대표주 주도 가능성도 남아 섹터 전체 동반상승 점수는 미산출.',
      change:'10/30 편집 리뷰에 철강 미수록. 직전 거래일 철강 업종의 전체 종가가 없어 NEW는 잠정. 전일 대비 거래대금 증감률 미확인.',
      sourceIds:[0,1,7],
      scoreInput:{date:'2026-11-02',news:'reported',sourceUrls:['https://marketin.edaily.co.kr/News/ReadE?newsId=03709686645641784','https://biz.newdaily.co.kr/site/data/html/2026/11/02/2026110200325.html']}
    },
    {
      name:'메모리 반도체',
      leaderSymbol:'000660',
      breadthGroup:'메모리 반도체',
      status:'RE',
      kind:'산업 · 반도체 대형주 동반 반등 · RE 잠정',
      leader:'SK하이닉스 +3.81% (종가 1,472,000원)',
      companions:'삼성전자 +1.78% (229,000원), 11/02 정규장 마감',
      reason:'[2026-11-02 이데일리·뉴데일리 언론 마감 보도] 미국 인텔·AI주 급락 여파로 약세 출발했으나 기관·자사주 매수와 저가 매수세가 유입되며 삼성전자와 SK하이닉스가 동반 상승했다. 메모리 업종에 공통 신규 기업 공시가 확인된 것은 아니다.',
      outlook:'대표 대형주 2종목 동반 반등 확인. 10/30 급락 이후의 하루 반등이며 수급·거래대금·지속성을 검증하기 전 추세 회복 단정 보류.',
      change:'10/30 편집 리뷰에 메모리 미수록, 10/28 리뷰에는 포함. 직전 거래일 메모리 전체 종가가 미확인이라 RE 잠정; 전일 대비 섹터 점수 변화는 미산출.',
      sourceIds:[0,1,7]
    },
    {
      name:'반도체 장비·테스트',
      leaderSymbol:'240810',
      breadthGroup:'반도체 장비·테스트',
      status:'RE',
      kind:'산업 · 코스닥 소부장 대표주 동반 반등 · RE 잠정',
      leader:'원익IPS +2.82% (11/02 정규장 마감)',
      companions:'주성엔지니어링 +1.82% · 이오테크닉스 +0.77% · 리노공업 +1.60% (장비·부품 인접주)',
      reason:'[2026-11-02 이데일리·뉴데일리 언론 마감 보도] 코스닥이 장중 약세에서 반등하면서 반도체 소부장 대표주로 매수세가 유입됐다. 당일 전체 장비 업종에 공통된 신규 수주·공시 재료는 확인되지 않았다.',
      outlook:'장비·테스트 일부 대표주 상승은 확인했지만 STOCK_MAP 전체 구성종목의 동반상승 비율·대금·수급 미확인. 메모리 대형주와는 별도 그룹으로 관리.',
      change:'10/30 편집 리뷰에 장비 그룹 미수록, 10/28 리뷰에는 포함. 직전 거래일 전체 장비 종가가 없어 RE 잠정.',
      sourceIds:[0,1,7]
    }
  ]
};
