import type {ScoreInput} from './close-score';
import {review20261027} from './close-review-2026-10-27';
export type CloseSector={name:string;status:'NEW'|'HOT'|'RE'|'WEAK';kind:string;leader:string;leaderSymbol?:string;breadthSector?:string;companions:string;reason:string;outlook:string;change:string;sourceIds:number[];scoreInput?:ScoreInput};
export type CloseReview={date:string;session:string;summary:string;coverageNote?:string;marketFlow?:string;sectors:CloseSector[];sources:{title:string;url:string}[]};
// Source-checked editorial records, independent of incomplete live theme tags.
const latestReview:CloseReview[]=[{date:'2026-10-23',session:'KRX 정규장 마감 · 15:30 KST',summary:'코스피 5,550.30 (+0.30%) · 코스닥 751.69 (−1.62%). 대형주 반등과 개별 재료 중심의 선별 장세.',sources:[{title:'유안타증권 · 10/23 마감·특징주 (17:10)',url:'https://www.myasset.com/myasset/research/rs_global/RS_0401000_M.cmd?glblGubun=KS'},{title:'연합뉴스 · 삼성E&A 정규장 마감 (15:39)',url:'https://www.yna.co.kr/view/AKR20261023044651008'},{title:'10/23 정규장 상한가 기록 (15:35)',url:'https://sanghanga365.com/daily/2026-10-23'},{title:'이데일리 · 정치 테마 상승 배경 (장중 기사)',url:'https://www2.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=04605126645615872'},{title:'한국경제 · 10/23 솔리다임 상장 중단',url:'https://www.hankyung.com/article/2026102303026'},{title:'조선비즈 · 10/22 삼성E&A 실적·주주환원',url:'https://biz.chosun.com/real_estate/real_estate_general/2026/10/22/CT257TFLAFHKXOBBP5Q4FJSMLI/'}],sectors:[
{name:'반도체 대형주',scoreInput:{date:'2026-10-23',news:'reported',sourceUrls:['https://www.hankyung.com/article/2026102303026']},status:'RE',kind:'주도 후보 · 대형주 집중',leader:'SK하이닉스 +4.42%',companions:'삼성전자 +0.47% · 관련 지주사 SK스퀘어 +3.20%',reason:'SK하이닉스가 솔리다임의 미국 상장 검토를 중단. 중복상장 우려 완화가 반등 재료로 부각.',outlook:'장비·소재까지 확산됐는지 확인. 반도체 전체의 추세 전환은 판단 보류.',change:'장초반 약세에서 반등 · 전일 섹터 순위 미확인',sourceIds:[4,0]},
{name:'제약·바이오',status:'NEW',kind:'선별 강세 · 개별 재료',leader:'삼성바이오로직스 +7.71%',companions:'퓨쳐켐 +29.91% · 노을 +29.96% (서로 다른 재료)',reason:'실적·수주 기대, 임상 결과, 자금조달 공시가 각각 부각.',outlook:'대형 CDMO와 임상·공시 급등주를 분리해 관찰. 섹터 전체 강세로 일반화하지 않음.',change:'당일 재료 부각 · 전일 대비 확산 수치 미확인',sourceIds:[0,2]},
{name:'건설·플랜트',scoreInput:{date:'2026-10-23',streak:3,news:'reported',sourceUrls:['https://www.yna.co.kr/view/AKR20261023044651008']},status:'HOT',kind:'지속성 후보 · 개별주 집중',leader:'삼성E&A +7.94%',companions:'동일 재료의 동반 강세 종목은 미확인',reason:'3분기 영업이익 5,006억원(+183.6%). 자사주 7,800억원 취득 계획 중 6,900억원은 소각 예정.',outlook:'3거래일 강세는 확인. 업종 주도보다 실적 기반 개별주 성격이 강함.',change:'10/22 +16.14% → 10/23 +7.94% · 3거래일 연속 상승',sourceIds:[5,1]},
{name:'우주항공·위성',scoreInput:{date:'2026-10-23',news:'reported',sourceUrls:['https://www.myasset.com/myasset/research/rs_global/RS_0401000_M.cmd?glblGubun=KS']},status:'NEW',kind:'이벤트형 · 수주 확인 필요',leader:'컨텍 +29.87% (상한가)',companions:'AP위성 · LK삼양 상승 확인 (종가 등락률 미기재)',reason:'태국 사업 기대와 광통신 실증 성공 보도가 부각.',outlook:'실증·기대와 확정 수주를 구분. 다음 거래일 대금 유지 확인.',change:'당일 뉴스 부각 · 전일 순위 미확인',sourceIds:[0,2]},
{name:'정치·인맥 테마',scoreInput:{date:'2026-10-23',news:'reported',sourceUrls:['https://www2.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=04605126645615872']},status:'NEW',kind:'단기 이벤트 · 소멸 위험',leader:'진양화학 +29.81% · 진양산업 +29.79%',companions:'진양폴리 · 진양홀딩스 상승 확인',reason:'오세훈 서울시장 항소심 무죄 판결에 관련주 동반 급등.',outlook:'기업 실적과 직접 연결이 약한 정치 테마. 하루짜리 급등 위험이 높음.',change:'당일 판결 재료 부각 · 전일 순위 미확인',sourceIds:[0,2,3]}
]},
{
  "date": "2026-10-26",
  "session": "KRX 정규장 마감 · 15:30 KST",
  "summary": "코스피 5,469.47 (−1.46%) · 코스닥 727.21 (−3.26%). 의료AI·일부 로봇주만 종가 기준 동반 강세 확인.",
  "coverageNote": "2026-10-26 15:30 정규장 종가를 확인한 산업 그룹 2개만 수록했습니다. 사이버보안은 오전 강세 기사는 있으나 국내 종목의 정규장 종가·동반 상승을 검증하지 못해 TOP5에서 제외했습니다. 구성종목 전체의 거래대금·시총·외국인/기관 수급·상승종목 비율·연속 상승일·신고가 수가 부족해 총점·등급을 산출하지 않습니다. NEW/RE는 10/23 리뷰에서 같은 산업을 확인하지 못해 잠정 분류입니다.",
  "marketFlow": "10/26 15:45 KRX 잠정 집계: 코스피 외국인 약 7,070억원 순매도, 기관 약 6,040억원·개인 약 640억원 순매수. 시장 전체 수급이며 아래 종목의 수급 점수에 사용하지 않았습니다.",
  "sources": [
    {
      "title": "머니투데이 · 2026-10-26 16:22 · 정규장 마감 및 로봇·의료AI 종가",
      "url": "https://www.mt.co.kr/stock/2026/10/26/2026102616101322514"
    },
    {
      "title": "머니 스톰 · 2026-10-26 · 건강관리기술 종가 및 동반주",
      "url": "https://www.moneystorm.kr/news/articleView.html?idxno=7674"
    },
    {
      "title": "뉴스투데이 · 2026-10-26 10:06 · 의료AI 가치평가 및 로봇 실적 전망 (장중 재료만)",
      "url": "https://www.news2day.co.kr/article/20261026500071"
    },
    {
      "title": "뉴스핌 · 2026-10-26 15:58 · ETF 시장 마감·보안 관련 ETF (국내 보안주 종가 아님)",
      "url": "https://www.newspim.com/news/view/20261026001028"
    },
    {
      "title": "뉴스핌 · 2026-10-26 09:49 · 사이버보안 종목 장중 (TOP5 제외 근거)",
      "url": "https://www.newspim.com/news/view/20261026000259"
    }
  ],
  "sectors": [
    {
      "name": "의료 AI·디지털 헬스케어",
      "status": "NEW",
      "kind": "산업 · 다종목 동반 강세 · 지속성 검증 전",
      "leader": "루닛 +30.00% (종가 14,690원)",
      "companions": "뷰노 +29.95% · 씨어스 +17.51% · 뉴로핏 +15.96% · 쓰리빌리언 +13.00% (정규장 종가)",
      "reason": "[언론·증권사 분석, 2026-10-26] NH투자증권이 루닛의 AI 병리·바이오마커 SCOPE 사업가치를 최소 5,000억원으로 평가했다는 보도가 나왔다. 의료 AI 진단·모니터링·유전체 종목으로 매수세가 확산됐지만 기업 공식 공시나 동일한 실적 개선이 확인된 것은 아니다.",
      "outlook": "상한가 종목이 2개 이상이고 동반주가 많아 당일 상대강도는 강하지만, 신규 공시·수급·다음 거래일 거래대금 유지가 검증되기 전까지 지속형 주도 확정은 보류. 단기 급등 후 변동성 유의.",
      "change": "직전 거래일 10/23 리뷰에는 의료AI 독립 그룹이 없고 제약·바이오가 있었음. 10/23 의료AI 전체 구성종목 종가를 확보하지 못해 NEW는 잠정이며 전일 대비 섹터 정량 변화 미산출.",
      "sourceIds": [
        0,
        1,
        2
      ],
      "scoreInput": {
        "date": "2026-10-26",
        "news": "reported",
        "sourceUrls": [
          "https://www.mt.co.kr/stock/2026/10/26/2026102616101322514",
          "https://www.moneystorm.kr/news/articleView.html?idxno=7674",
          "https://www.news2day.co.kr/article/20261026500071"
        ]
      }
    },
    {
      "name": "로봇·자동화",
      "status": "RE",
      "kind": "산업 · 일부 로봇주 강세 · 대형주 확산 제한",
      "leader": "로보티즈 +9.56% (종가 246,500원)",
      "companions": "에브리봇 +6.92% · 티로보틱스 +4.90% · 에스피지 +1.03% (정규장 종가)",
      "reason": "[언론·증권사 분석, 2026-10-26] 10/21 LS증권 보고서에서 로보티즈의 액추에이터 출하 확대와 우즈베키스탄 공장 가동에 따른 2027년 실적 성장 가능성을 제시한 내용이 10/26 다시 부각됐다. 당일 신규 계약 공시로 확인된 상승은 아니다.",
      "outlook": "로보티즈와 일부 부품·서비스 종목이 동반 상승했으나 레인보우로보틱스 등 대형주 전체 확산은 미확인. 중기 수요 기대와 당일 추격 매수는 분리해 판단.",
      "change": "10/23 리뷰에는 로봇 그룹이 없으나 10/19 과거 리뷰에는 포함됨. 10/23 전체 로봇주 종가가 미확인이라 RE는 잠정이며 전일 대비 거래대금 증감률은 미산출.",
      "sourceIds": [
        0,
        2
      ],
      "scoreInput": {
        "date": "2026-10-26",
        "news": "reported",
        "sourceUrls": [
          "https://www.mt.co.kr/stock/2026/10/26/2026102616101322514",
          "https://www.news2day.co.kr/article/20261026500071"
        ]
      }
    }
  ]
}];


// Historical coverage stops at the latest completed session; holidays are separate.
const historicalReviews:CloseReview[]=[
  {
    "date": "2026-10-01",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 6,971.35 (+1.95%) · 코스닥 894.29 (+4.48%). 반도체와 성장주 동반 반등.",
    "marketFlow": "",
    "coverageNote": "종가와 마감 기사를 확인한 편집 선정 5개입니다. 거래대금 기반 확정 순위는 아닙니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/01 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2112834"
      }
    ],
    "sectors": [
      {
        "name": "반도체",
        "status": "NEW",
        "kind": "주도 후보 · 확산 확인",
        "leader": "리노공업 +10.90%",
        "companions": "SK하이닉스 +3.21% · 삼성전자 +2.79% · 원익IPS +9.13%",
        "reason": "마이크론 실적과 반도체 수출 호조.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "제약·바이오",
        "status": "NEW",
        "kind": "주도 후보 · 확산 확인",
        "leader": "삼천당제약 +15.39%",
        "companions": "알테오젠 +4.13% · 펩트론 +8.28%",
        "reason": "10월 바이오 행사 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "2차전지·ESS",
        "status": "NEW",
        "kind": "주도 후보 · 확산 확인",
        "leader": "에코프로 +5.58%",
        "companions": "에코프로비엠 +5.13% · 솔브레인 +5.39%",
        "reason": "성장주 투자심리 회복. 공통 신규 공시는 미확인.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "로봇",
        "status": "NEW",
        "kind": "주도 후보 · 확산 확인",
        "leader": "레인보우로보틱스 +5.02%",
        "companions": "로보티즈 +3.67%",
        "reason": "기술주 반등 동참. 별도 공통 재료 미확인.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "자동차",
        "status": "NEW",
        "kind": "주도 후보 · 확산 확인",
        "leader": "현대모비스 +4.09%",
        "companions": "현대차 +1.16%",
        "reason": "현대모비스 램프사업 매각 관련 평가.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-02",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 7,003.74 (+0.46%). 에너지와 개별 테마 강세.",
    "marketFlow": "",
    "coverageNote": "종가와 마감 기사를 확인한 편집 선정 5개입니다. 거래대금 기반 확정 순위는 아닙니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/02 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2114469"
      }
    ],
    "sectors": [
      {
        "name": "정유",
        "status": "NEW",
        "kind": "유가 연동 · 단기 변동",
        "leader": "S-Oil +11.69%",
        "companions": "SK이노베이션 +10.32% · GS +4.11%",
        "reason": "국제유가 급등.",
        "outlook": "유가와 정제마진 확인. 지정학 뉴스 반전 주의.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "광통신·통신장비",
        "status": "NEW",
        "kind": "뉴스형 · 단기 테마",
        "leader": "머큐리 +29.80%",
        "companions": "와이어블 +17.58%",
        "reason": "미국 광통신주 강세와 데이터센터 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "우주항공·위성",
        "status": "NEW",
        "kind": "이벤트형 · 수주 확인",
        "leader": "나라스페이스테크놀로지 +22.95%",
        "companions": "LK삼양 +17.61%",
        "reason": "스페이스X 우주정거장 도킹 소식.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "2차전지·ESS",
        "status": "HOT",
        "kind": "주도 후보 · 확산 확인",
        "leader": "대주전자재료 +11.88%",
        "companions": "에코프로 +4.47% · LG에너지솔루션 +2.91%",
        "reason": "나트륨 배터리·ESS 사업 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "로봇",
        "status": "HOT",
        "kind": "주도 후보 · 확산 확인",
        "leader": "로보티즈 +4.89%",
        "companions": "레인보우로보틱스 +2.39%",
        "reason": "전일 반등 지속. 공통 신규 재료 미확인.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-06",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 6,941.39 (−0.89%) · 코스닥 919.92 (+2.98%). 코스닥 중심 차별화.",
    "marketFlow": "",
    "coverageNote": "확인된 강세 그룹 4개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/06 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2117187"
      }
    ],
    "sectors": [
      {
        "name": "사이버보안",
        "status": "NEW",
        "kind": "뉴스형 · 다종목 확산",
        "leader": "샌즈랩 +30.00%",
        "companions": "라온시큐어 +29.98% · 아톤 +26.91% · 지니언스 +20.83%",
        "reason": "금융권 해킹과 AI 보안 수요.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "2차전지·ESS",
        "status": "HOT",
        "kind": "주도 후보 · 확산 확인",
        "leader": "에코프로비엠 +11.41%",
        "companions": "삼성SDI +8.70% · 에코프로 +7.31% · LG에너지솔루션 +5.12%",
        "reason": "ESS 수요 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "제약·바이오",
        "status": "NEW",
        "kind": "주도 후보 · 확산 확인",
        "leader": "HLB +17.18%",
        "companions": "삼천당제약 +16.43% · 디앤디파마텍 +10.58%",
        "reason": "바이오 종목군 강세. 공통 신규 재료 미확인.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "반도체 장비",
        "status": "NEW",
        "kind": "대형주와 차별화",
        "leader": "주성엔지니어링 +17.51%",
        "companions": "티에스이 +7.92% · HPSP +5.04%",
        "reason": "설비투자 확대 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-07",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 6,803.90 (−1.98%) · 코스닥 898.43 (−2.34%). 실적 경계감 속 선별 강세.",
    "marketFlow": "코스피 외국인 2조6,117억원·기관 6,745억원 순매도. 시장 전체 수급이며 섹터 수급은 아닙니다.",
    "coverageNote": "종가와 마감 기사를 확인한 편집 선정 5개입니다. 거래대금 기반 확정 순위는 아닙니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/07 마감체크",
        "url": "https://www.infostockdaily.co.kr/news/articleView.html?idxno=218295"
      }
    ],
    "sectors": [
      {
        "name": "화장품",
        "status": "NEW",
        "kind": "주도 후보 · 확산 확인",
        "leader": "에이피알 +4.99%",
        "companions": "한국콜마 +4.82% · 아모레퍼시픽 +3.98%",
        "reason": "수출과 실적 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "자산 재평가",
        "status": "NEW",
        "kind": "정책 기대 · 단기 테마",
        "leader": "동양고속 +30.00%",
        "companions": "천일고속 +29.99% · 대성산업 상승",
        "reason": "토지 보유가치 재평가 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "정유",
        "status": "RE",
        "kind": "유가 연동 · 재부각",
        "leader": "GS +3.88%",
        "companions": "S-Oil +3.21% · SK이노베이션 +1.01%",
        "reason": "홍해 확전 우려와 유가 상승.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "감염병·진단",
        "status": "NEW",
        "kind": "뉴스형 · 소멸 위험",
        "leader": "코미팜 +5.47%",
        "companions": "씨젠 +4.43% · 국제약품·휴마시스 상승",
        "reason": "해외 감염병 유출 가능성 보도. 사실 확정과 구분.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "반도체 장비",
        "status": "WEAK",
        "kind": "선별 강세 · 확산 약함",
        "leader": "케이씨텍 +14.53%",
        "companions": "PSK홀딩스 +3.55% · 티에스이 +0.80%",
        "reason": "일부 설비투자 수혜주 차별화. 업종 다수는 하락.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-08",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 6,625.93 (−2.62%) · 코스닥 892.27 (−0.69%). 대형주 약세 속 일부 종목만 상승.",
    "marketFlow": "",
    "coverageNote": "확인된 강세 그룹 2개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/08 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2120269"
      }
    ],
    "sectors": [
      {
        "name": "2차전지·ESS",
        "status": "RE",
        "kind": "선별 강세 · 재부각",
        "leader": "동국산업 +22.34%",
        "companions": "LG에너지솔루션 +2.56% · 삼성SDI +1.25%",
        "reason": "46파이 배터리와 ESS 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "반도체 소부장",
        "status": "WEAK",
        "kind": "선별 강세 · 업종 약세",
        "leader": "제너셈 +10.19%",
        "companions": "아스플로 +6.60% · 뉴파워프라즈마 +6.14%",
        "reason": "일부 장비·부품 강세. 대형 반도체와 차별화.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-12",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 6,384.24 (−3.65%) · 코스닥 849.19 (−4.83%). AI 수익성 우려로 급락.",
    "marketFlow": "코스피 외국인 2조201억원·기관 1,236억원 순매도. 섹터 수급으로 해석하지 않습니다.",
    "coverageNote": "확인된 강세 그룹 2개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/12 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2123211"
      }
    ],
    "sectors": [
      {
        "name": "광주 반도체 산단·건설",
        "status": "NEW",
        "kind": "정책 기대 · 단기 테마",
        "leader": "금호건설 (상승 확인 · 대장 미확정)",
        "companions": "남화토건 · 서산 · 유신 상승 (종가율 미확인)",
        "reason": "광주·전남 반도체 산업단지 투자 발언.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "반도체 검사장비",
        "status": "WEAK",
        "kind": "개별 강세 · 업종 약세",
        "leader": "엑시콘 +6.38%",
        "companions": "디아이 +0.59%",
        "reason": "검사장비 성장·실적 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-13",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 6,035.35 (−5.46%). 급락 속 장비와 경협 테마 일부 차별화.",
    "marketFlow": "",
    "coverageNote": "확인된 강세 그룹 2개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/13 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2124616"
      }
    ],
    "sectors": [
      {
        "name": "반도체 장비",
        "status": "RE",
        "kind": "선별 반등 · 확산 확인",
        "leader": "PSK홀딩스 +7.20%",
        "companions": "티에스이 +6.98% · PSK +6.50% · 주성엔지니어링 +3.56%",
        "reason": "일부 장비주 반등. 대형 메모리는 약세.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "남북경협",
        "status": "NEW",
        "kind": "이벤트형 · 소멸 위험",
        "leader": "양지사 (상승 확인 · 대장 미확정)",
        "companions": "인디에프 · 현대엘리베이터 상승 (종가율 미확인)",
        "reason": "북미 회담 가능성 보도.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-14",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 6,008.81 (−0.44%). 배터리·해운 중심 선별 반등.",
    "marketFlow": "",
    "coverageNote": "확인된 강세 그룹 3개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/14 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2126309"
      }
    ],
    "sectors": [
      {
        "name": "2차전지·ESS",
        "status": "RE",
        "kind": "반등 후보 · 확산 확인",
        "leader": "삼성SDI +5.54%",
        "companions": "포스코퓨처엠 +4.63% · LG에너지솔루션 +2.93%",
        "reason": "ESS 수요와 유럽 배터리 정책 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "해운",
        "status": "NEW",
        "kind": "업황형 · 지속성 확인",
        "leader": "팬오션 +10.53%",
        "companions": "STX그린로지스 · HMM 상승 (종가율 미확인)",
        "reason": "해운 업황 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "정유·LPG",
        "status": "RE",
        "kind": "유가 연동 · 재부각",
        "leader": "SK이노베이션 (상승 확인 · 대장 미확정)",
        "companions": "대성산업 · 중앙에너비스 상승 (종가율 미확인)",
        "reason": "국제유가 상승 영향.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-15",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 5,554.22 (−7.57%) · 코스닥 760.82 (−7.65%). 서킷브레이커가 발동한 급락일.",
    "marketFlow": "코스피 외국인 3조7,590억원 순매도. 개인 1조4,263억원·기관 1조6,796억원 순매수. 시장 전체 기준.",
    "coverageNote": "확인된 강세 그룹 1개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/15 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2127828"
      }
    ],
    "sectors": [
      {
        "name": "제약·바이오 대형주",
        "status": "NEW",
        "kind": "방어적 차별화 · 추세 보류",
        "leader": "삼성바이오로직스 +5.50%",
        "companions": "셀트리온 +1.28%",
        "reason": "시장 급락 속 상대 강세. 공통 신규 재료 미확인.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-16",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 5,668.05 (+2.05%). 낙폭 과대 반등과 미국 금리 하락 영향.",
    "marketFlow": "",
    "coverageNote": "종가와 마감 기사를 확인한 편집 선정 5개입니다. 거래대금 기반 확정 순위는 아닙니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/16 마감체크",
        "url": "https://www.infostockdaily.co.kr/news/articleView.html?idxno=218449"
      }
    ],
    "sectors": [
      {
        "name": "반도체",
        "status": "RE",
        "kind": "낙폭 과대 반등",
        "leader": "한미반도체 +9.26%",
        "companions": "삼성전자 +2.62% · SK하이닉스 +0.79%",
        "reason": "급락 이후 저가 매수.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "자동차",
        "status": "RE",
        "kind": "낙폭 과대 반등",
        "leader": "현대차 +5.58%",
        "companions": "기아 +4.06%",
        "reason": "급락 이후 저가 매수.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "제약·바이오",
        "status": "HOT",
        "kind": "주도 후보 · 확산 확인",
        "leader": "셀트리온 +6.53%",
        "companions": "삼성바이오로직스 +4.09%",
        "reason": "대형 바이오 강세 지속.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "방산",
        "status": "NEW",
        "kind": "반등 후보",
        "leader": "한화에어로스페이스 +7.77%",
        "companions": "한화시스템 +5.19%",
        "reason": "낙폭 과대 반등. 공통 신규 재료 미확인.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "전력·원전",
        "status": "NEW",
        "kind": "반등 후보",
        "leader": "HD현대일렉트릭 +5.95%",
        "companions": "두산에너빌리티 +2.05%",
        "reason": "금리 부담 완화 속 반등.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-19",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 5,768.01 (+1.76%) · 코스닥 808.89 (+1.78%). 장초반 급락을 되돌린 반등.",
    "marketFlow": "코스피 기관 6,555억원 순매수, 외국인 1,140억원 순매도. 섹터별 수급은 미확인.",
    "coverageNote": "종가와 마감 기사를 확인한 편집 선정 5개입니다. 거래대금 기반 확정 순위는 아닙니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/19 마감체크",
        "url": "https://www.infostockdaily.co.kr/news/articleView.html?idxno=218473"
      }
    ],
    "sectors": [
      {
        "name": "2차전지·ESS",
        "status": "RE",
        "kind": "정책 기대 · 확산 확인",
        "leader": "삼성SDI +11.70%",
        "companions": "에코프로 +11.19% · 포스코퓨처엠 +10.90% · LG에너지솔루션 +7.20%",
        "reason": "중국 ESS 업체 미국 철수설과 반사이익 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "제약·바이오",
        "status": "HOT",
        "kind": "주도 후보 · 확산 확인",
        "leader": "삼성바이오로직스 +9.94%",
        "companions": "리가켐바이오 +3.81% · 셀트리온 +2.16%",
        "reason": "저가 매수와 대형 바이오 강세 지속.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "자동차",
        "status": "HOT",
        "kind": "주도 후보 · 확산 확인",
        "leader": "기아 +5.26%",
        "companions": "현대차 +4.49% · 현대모비스 +3.69%",
        "reason": "낙폭 과대 반등 지속.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "로봇",
        "status": "RE",
        "kind": "반등 후보",
        "leader": "레인보우로보틱스 +7.23%",
        "companions": "로보티즈 +4.78%",
        "reason": "성장주 저가 매수. 공통 신규 재료 미확인.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "태양광",
        "status": "NEW",
        "kind": "정책 기대 · 수주 확인",
        "leader": "OCI홀딩스 (상승 확인 · 대장 미확정)",
        "companions": "한화솔루션 · HD현대에너지솔루션 상승 (종가율 미확인)",
        "reason": "미국 비중국 공급망 정책 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-20",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 5,552.74 (−3.73%) · 코스닥 781.97 (−3.33%). 대부분 업종 하락, 소형 테마 일부 강세.",
    "marketFlow": "코스피 외국인 5,393억원·기관 9,977억원 순매도. 섹터 매수 유입으로 일반화하지 않습니다.",
    "coverageNote": "확인된 강세 그룹 2개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/20 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2132754"
      }
    ],
    "sectors": [
      {
        "name": "로봇 일부",
        "status": "NEW",
        "kind": "이벤트형 · 대형주 약세",
        "leader": "에브리봇 (상승 확인 · 대장 미확정)",
        "companions": "앤로보틱스 · 티로보틱스 · 삼현 상승 (종가율 미확인)",
        "reason": "삼성전자 CES 휴머노이드 공개 가능성 보도.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "탈모 치료",
        "status": "NEW",
        "kind": "해외 뉴스형 · 소멸 위험",
        "leader": "TS트릴리온 (상승 확인 · 대장 미확정)",
        "companions": "현대약품 · 삼익제약 상승 (종가율 미확인)",
        "reason": "미국 베라더믹스 임상 결과에 관련주 반응.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-21",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 5,735.66 (+3.29%) · 코스닥 792.76 (+1.38%). 반도체·전력 등 반등.",
    "marketFlow": "",
    "coverageNote": "종가와 마감 기사를 확인한 편집 선정 5개입니다. 거래대금 기반 확정 순위는 아닙니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/21 마감체크",
        "url": "https://www.infostockdaily.co.kr/news/articleView.html?idxno=218519"
      }
    ],
    "sectors": [
      {
        "name": "반도체",
        "status": "RE",
        "kind": "반등 후보 · 대형주",
        "leader": "SK하이닉스 +5.81%",
        "companions": "삼성전자 +5.67% · DB하이텍 +3.18%",
        "reason": "외국인 매수와 대형 반도체 반등.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "전력설비",
        "status": "RE",
        "kind": "주도 후보 · 동반 확산",
        "leader": "LS ELECTRIC +7.02%",
        "companions": "LS +5.47% · 가온전선 +4.96% · HD현대일렉트릭 +2.36%",
        "reason": "실적 기대와 전력 투자 수요.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "건설·플랜트",
        "status": "NEW",
        "kind": "정책·실적 후보",
        "leader": "삼성E&A +9.40%",
        "companions": "전진건설로봇 · 유신 · GS건설 상승",
        "reason": "중동 중재 기대와 사업 모멘텀.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "우주항공·위성",
        "status": "RE",
        "kind": "이벤트형 · 수주 확인",
        "leader": "켄코아에어로스페이스 +7.92%",
        "companions": "스피어 +3.23% · 와이제이링크 +3.03%",
        "reason": "스페이스X 실적 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "태양광",
        "status": "RE",
        "kind": "정책 기대 · 재부각",
        "leader": "OCI홀딩스 +4.73%",
        "companions": "SK이터닉스 +2.48% · HD현대에너지솔루션 +1.16%",
        "reason": "미국의 중국 공급망 제한 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  },
  {
    "date": "2026-10-22",
    "session": "KRX 정규장 마감 · 15:30 KST · 과거일 재검토",
    "summary": "코스피 5,533.77 (−3.52%) · 코스닥 764.10 (−3.62%). 금리와 AI 투자 우려 속 개별 재료 차별화.",
    "marketFlow": "코스피 외국인 1,131억원·기관 3,071억원 순매도. 시장 전체 기준.",
    "coverageNote": "확인된 강세 그룹 4개만 수록했습니다. TOP5를 채우기 위한 약세·중복 테마는 추가하지 않았습니다.",
    "sources": [
      {
        "title": "인포스탁데일리 · 10/22 마감체크",
        "url": "https://kr.investing.com/news/stock-market-news/article-2136715"
      }
    ],
    "sectors": [
      {
        "name": "건설·플랜트",
        "status": "HOT",
        "kind": "실적 기반 · 개별주 집중",
        "leader": "삼성E&A +16.14%",
        "companions": "동일 재료 동반 강세 미확인",
        "reason": "3분기 실적 호조와 자사주 취득·소각.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "전력케이블",
        "status": "NEW",
        "kind": "개별 강세 · 업종 확산 약함",
        "leader": "LS에코에너지 +9.96%",
        "companions": "업종 동반 강세 미확인 · LS ELECTRIC은 하락",
        "reason": "실적 호조와 신사업 재평가 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "연료전지·SOFC",
        "status": "NEW",
        "kind": "뉴스형 · 실적 확인",
        "leader": "비나텍 (상승 확인 · 대장 미확정)",
        "companions": "미코 · 코세스 · 아모센스 상승 (종가율 미확인)",
        "reason": "전력 병목 발언과 블룸에너지 실적 기대.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      },
      {
        "name": "방산 소형 테마",
        "status": "NEW",
        "kind": "이벤트형 · 소멸 위험",
        "leader": "빅텍 (상승 확인 · 대장 미확정)",
        "companions": "스페코 · 휴니드 · 한일단조 상승 (종가율 미확인)",
        "reason": "북한 관련 긴장 보도. 미확인 사망설은 사실로 취급하지 않음.",
        "outlook": "다음 거래일 동반 강세와 거래대금 유지 확인. 추세 확정은 보류.",
        "change": "전일 정량 순위 미산출",
        "sourceIds": [
          0
        ]
      }
    ]
  }
];
const records=[...historicalReviews,...latestReview,review20261027];
export const closeReviews:CloseReview[]=records.map((review,index)=>({...review,sectors:review.sectors.map(sector=>{
 if(index===0||!historicalReviews.includes(review))return sector;
 const previous=records[index-1],match=previous.sectors.find(s=>s.name===sector.name);
 return {...sector,change:match?`${previous.date.slice(5)} 편집 선정에도 포함 · 이전 ${match.status}. 정량 순위 변화는 미산출.`:`${previous.date.slice(5)} 편집 선정에는 미포함 · 실제 업종 강세 전환 확정은 아님.`};
})}));
