import type {CloseReview} from './close-reviews';
// 2026-11-09: verified regular-session closes; incomplete score components intentionally omitted.
export const review20261109:CloseReview={
 date:'2026-11-09',
 session:'KRX 정규장 마감 · 15:30 KST',
 summary:'반도체 소재·부품·장비가 상대강세. 이차전지·바이오는 약세. 확인된 강세 산업군 1개만 수록.',
 coverageNote:'2026-11-09 정규장 마감 기사(16:03) 및 종가 보도 대조. 16:10 이후 보도는 사후 교차확인으로만 사용. 종목별 정규장 거래대금·당일 시총·섹터 고정 구성종목 전수·대표종목 연속 상승일·외국인 및 기관 종목 수급은 검증되지 않아 scoreInput에 입력하지 않고 총점·등급을 산출하지 않음. 11/06 검증 리뷰 부재로 상태 NEW/HOT/RE/WEAK는 잠정. 반도체 대형주와 소부장을 중복 섹터로 선정하지 않음. 의료·정밀기기·종이목재 업종의 지수 상승은 확인되나 대표·동반 종목 종가 검증 부족으로 TOP5 미선정. 이차전지·바이오 악재는 강세 TOP5에 포함하지 않음.',
 sources:[
 {title:'뉴스핌 · 2026-11-09 16:03 · KRX 정규장 마감·반도체 및 약세 종목',url:'https://www.newspim.com/news/view/20261109001082'},
 {title:'아주경제 · 2026-11-09 16:08 · 반도체 상대강세 마감',url:'https://www.ajunews.com/amp/20261109155831044'},
 {title:'뉴시스 · 2026-11-09 16:11 · 정규장 종가·업종별 마감 (16:10 이후 사후 대조)',url:'https://nwww.newsis.com/view/NISX20261109_0003860817'}
 ],
 sectors:[{
 name:'반도체·소재·부품·장비',
 status:'RE',
 kind:'산업 · 상대강세 · RE 잠정 (직전 거래일 리뷰 미검증)',
 leaderSymbol:'036540',
 leader:'심텍 +6.84%',
 companions:'주성엔지니어링 +6.70% · 이오테크닉스 +6.00% · HPSP +3.30% · ISC +3.22% · 삼성전자 +0.64% · SK하이닉스 +0.35%',
 reason:'[언론 보도 · 2026-11-09 16:03] 지난주 급락에 따른 저가매수세와 미국 반도체주 반등이 국내 반도체 종목에 긍정적으로 작용했다는 증권사 해석. 당일 신규 기업 공시나 업종 공통 수주가 확인된 것은 아님.',
 outlook:'장중 지수 상승분 반납과 외국인 매도 지속으로 반등 지속성 미확정. 다음 거래일 장비·부품주 동반 상승과 거래대금 확인 필요.',
 change:'11/06 검증된 강세 섹터 리뷰가 없어 직전 거래일 대비 주도력·RE 상태 확정 불가. 11/05 리뷰에서는 반도체가 TOP5에 없었으나 이를 직전 거래일 비교로 간주하지 않음.',
 sourceIds:[0,1,2],
 scoreInput:{date:'2026-11-09',news:'reported',sourceUrls:['https://www.newspim.com/news/view/20261109001082']}
 }]
};
