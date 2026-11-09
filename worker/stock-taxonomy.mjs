// The original 145-stock catalog is the naming baseline. These rules translate
// verified business/product evidence into that same three-level presentation.
// New industries extend it explicitly; an exchange industry is never a theme.
export const TAXONOMY_VERSION=2;
export const ISSUER_ALIASES={
 '000810':{market:'KOSPI',quote:'삼성화재',issuer:'삼성화재해상보험'},
 '015760':{market:'KOSPI',quote:'한국전력',issuer:'한국전력공사'},
 '030200':{market:'KOSPI',quote:'KT',issuer:'케이티'},
 '033780':{market:'KOSPI',quote:'KT&G',issuer:'케이티앤지'},
 '445680':{market:'KOSDAQ',quote:'큐리옥스바이오시스템',issuer:'큐리옥스바이오시스템즈'}
};
export const SHARE_LINKS={
 '005935':{name:'삼성전자우',market:'KOSPI',issuerSymbol:'005930',issuerName:'삼성전자',sourceUrl:'https://www.samsung.com/global/ir/stock-information/listing-Info/'}
};
const r=(id,pattern,sector,subSector,themes)=>({id,pattern,sector,subSector,themes});
// First matching product rule wins. Specific products precede broad industries.
const PRODUCTS=[
 r('security-network',/통합 네트워크 보안/,'사이버보안','사이버보안',['네트워크보안']),
 r('security-link',/망간자료전송/,'사이버보안','사이버보안',['망연계','데이터보안']),
 r('security-chip',/PUF반도체|보안반도체/,'반도체','반도체 설계',['보안반도체','PUF']),
 r('conglomerate-electronics',/동박적층판/,'전자부품','전자부품·소재',['동박적층판','산업장비']),
 r('power-cable',/전력용전선/,'전력기기','전선·케이블',['전선','전력망']),
 r('consumer-electronics',/세탁기/,'전자부품','가전·전자기기',['가전','전자기기']),
 r('aerospace-parts',/우주항공산업 관련 부품/,'우주항공','항공우주 부품',['항공부품']),
 r('semiconductor-controller',/SSD 컨트롤러/,'반도체','반도체 설계',['SSD','컨트롤러']),
 r('semiconductor-memory-module',/메모리 모듈/,'반도체','메모리 반도체',['메모리모듈']),
 r('semiconductor-memory',/LP DDR|CRAM|SRAM/,'반도체','메모리 반도체',['DRAM','SRAM']),
 r('semiconductor-package',/반도체패키지|반도체패키징/,'반도체','후공정·테스트',['반도체패키징']),
 r('semiconductor-socket',/반도체 소켓|반도체 검사용 소켓|Burn-In Socket|Test Socket|Probe Card/i,'반도체','후공정·테스트',['테스트','테스트소켓']),
 r('semiconductor-tester',/반도체테스트핸들러|반도체 검사장비/,'반도체','후공정·테스트',['테스트','검사장비']),
 r('semiconductor-pcb',/DRAM Module PCB|SSD Module/i,'반도체','PCB·반도체 기판',['PCB','메모리모듈']),
 r('semiconductor-reflow',/Descum|Reflow/i,'반도체','반도체 장비',['후공정장비','리플로우']),
 r('semiconductor-deposition',/LP-CVD|화학증착장비/i,'반도체','반도체 장비',['증착','전공정']),
 r('semiconductor-etch',/Poly Etch/i,'반도체','반도체 장비',['식각','전공정']),
 r('semiconductor-laser',/레이저 마커/,'반도체','반도체 장비',['레이저','공정장비']),
 r('semiconductor-inspection',/반도체 외관검사|3차원 납도포검사/,'반도체','반도체 장비',['검사장비','공정장비']),
 r('semiconductor-control',/반도체 습도제어|정전척|THC, XPS/,'반도체','반도체 장비',['공정제어','공정장비']),
 r('semiconductor-plasma',/플라즈마 세정기/,'반도체','반도체 장비',['세정','플라즈마']),
 r('semiconductor-gas',/가스캐비닛/,'반도체','반도체 소재·부품',['가스공급장치']),
 r('semiconductor-material',/반도체 CMP|반도체용 박리액/,'반도체','반도체 소재·부품',['공정소재']),
 r('pcb-equipment',/PCB 자동화 설비/,'반도체','PCB·반도체 기판',['PCB','자동화설비']),
 r('battery-precursor',/전구체/,'2차전지','2차전지 소재',['전구체']),
 r('battery-anode',/이차전지용음극재료/,'2차전지','2차전지 소재',['음극재']),
 r('battery-parts',/2차전지부품/,'2차전지','동박·부품',['배터리부품']),
 r('capacitor',/슈퍼커패시터/,'전자부품','커패시터·전원부품',['슈퍼커패시터']),
 r('optical-network',/광섬유|광케이블|통신용 AWG|데이터센터용 AWG/,'통신','광통신·네트워크',['광통신','네트워크']),
 r('rf-network',/GaN 트랜지스터|RF통신용|전력증폭기 모듈|무선통신장비/,'통신','통신장비·RF부품',['RF','통신장비']),
 r('display',/디스플레이 제품|강화유리|LCDBLU/,'전자부품','디스플레이·소재',['디스플레이']),
 r('power-component',/전원공급장치|필름콘덴서/,'전자부품','커패시터·전원부품',['전원공급장치','콘덴서']),
 r('wind-energy',/풍력발전타워/,'신재생에너지','풍력·기자재',['풍력','풍력타워']),
 r('generator',/비상발전기|열병합발전설비/,'기계','건설기계·동력장비',['발전기','발전설비']),
 r('plant-boiler',/산업용 보일러/,'기계','플랜트·산업설비',['산업용보일러','플랜트']),
 r('plant-piping',/계장용 피팅 및 밸브/,'기계','플랜트·산업설비',['피팅','밸브']),
 r('building-material',/샌드위치 패널|데크플레이트/,'건설·EPC','건자재',['건자재','건축구조재']),
 r('renewable-epc',/신재생에너지 발전소 공사|신재생에너지 발전 공사/,'건설·EPC','플랜트·EPC',['신재생에너지','발전소EPC']),
 r('auto-parts',/자동차 부품|전기 수소차 부품|상용차 실린더/,'자동차','자동차 부품',['자동차부품']),
 r('gear',/유성감속기/,'기계','기어·동력전달',['기어','감속기']),
 r('food-noodles',/라면/,'음식료','가공식품',['라면','식품']),
 r('food-snack',/스낵 등 과자류/,'음식료','가공식품',['제과','식품']),
 r('tobacco',/제조담배|잎담배/,'음식료','담배·건강기능식품',['담배','홍삼']),
 r('paper',/화장지|판지원지/,'소재','제지·생활용품',['제지','생활용품']),
 r('stationery',/다이어리/,'소비재','문구·인쇄',['문구','인쇄']),
 r('steel',/열연코일|냉연강판/,'소재','철강',['철강','강판']),
 r('petrochemical',/LDPE|합성수지|석유정제|카본블랙/,'소재','정유·화학',['석유화학']),
 r('venture',/벤처기업 투자/,'금융·증권','벤처투자',['벤처캐피탈','기업투자']),
 r('holding',/지주회사/,'지주사','복합지주',['지주회사']),
 r('airline',/여객운송|화물운송/,'운송','항공운송',['항공','항공화물']),
 r('car-rental',/렌터카|카셰어링/,'운송','렌터카·모빌리티',['렌터카','카셰어링']),
 r('telecom',/이동전화|유무선통신사업/,'통신','통신서비스',['통신서비스']),
 r('electric-utility',/전력자원개발/,'유틸리티','전력공급',['전력판매','전력망']),
 r('insurance-nonlife',/손해보험/,'금융·증권','보험',['손해보험']),
 r('insurance-life',/생명보험/,'금융·증권','보험',['생명보험']),
 r('internet-ad',/포털 서비스|인터넷 서비스\(인터넷 광고\)/,'인터넷','포털·플랫폼',['플랫폼','온라인광고']),
 r('game',/한게임/,'인터넷','게임·콘텐츠',['게임']),
 r('music',/오디오물 출판/,'엔터·콘텐츠','음악·엔터테인먼트',['음악','콘텐츠']),
 r('bio-drug',/siRNA|항암면역세포|대사성질환 치료|발기부전증치료제/,'바이오','신약·제약',['신약']),
 r('bio-analysis',/바이오마커|세포 전처리/,'바이오','바이오 플랫폼',['바이오분석']),
 r('bio-regenerative',/재생의약품|인체조직/,'바이오','재생의료',['재생의료']),
 r('bio-diagnostic',/병원체 검사|체성분 분석|심전도검사/,'바이오','진단·의료기기',['진단','의료기기']),
 r('medical-surgery',/복강경 수술/,'바이오','진단·의료기기',['수술기구','의료기기']),
 r('cloud-it',/CLOUD|gDaaS|클라우드/i,'IT서비스','시스템통합·IT아웃소싱',['IT서비스','클라우드']),
 r('system-it',/IT서비스|시스템 구축/,'IT서비스','시스템통합·IT아웃소싱',['IT서비스','시스템통합']),
 r('ai-video',/AI 관제/,'IT서비스','AI 소프트웨어',['AI','영상관제']),
 r('golf',/골프 론치모니터/,'소비재','스포츠·레저',['골프','스포츠기기'])
];
const INDUSTRIES=[
 r('industry-semiconductor',/^반도체 제조업$/,'반도체','반도체 소자',['반도체소자']),
 r('industry-pharma',/^의약품 제조업$/,'바이오','신약·제약',['의약품']),
 r('industry-it',/컴퓨터 프로그래밍|시스템 통합/,'IT서비스','시스템통합·IT아웃소싱',['IT서비스','시스템통합']),
 r('industry-electronics',/^전자부품 제조업$/,'전자부품','전자부품·소재',['전자부품']),
 r('industry-electrical',/전동기, 발전기/,'전력기기','변압기·전력기기',['전력기자재']),
 r('industry-telecom',/^전기 통신업$/,'통신','통신서비스',['통신서비스']),
 r('industry-chemical',/^기초 화학물질|^기타 화학제품/,'소재','정유·화학',['화학소재']),
 r('industry-lighting',/^전구 및 조명장치/,'전자부품','조명·LED',['LED','조명']),
 r('industry-construction',/^건물 건설업$/,'건설·EPC','종합건설',['건설','개발'])
];
// Extra company-specific primary sources resolve business portfolios that the
// listing's legacy product field cannot describe adequately. Exact symbol,
// issuer name AND unchanged official industry remain mandatory.
const REVIEWS={
 '011070':{name:'LG이노텍',industry:'전자부품 제조업',sector:'전자부품',subSector:'광학·전자소재',themes:['카메라모듈','패키지기판','전장'],sourceUrl:'https://www.lginnotek.com/product/intro.do'},
 '006260':{name:'LS',industry:'기타 금융업',sector:'지주사',subSector:'복합지주',themes:['전력망','전선','에너지'],sourceUrl:'https://lsholdings.co.kr/ko'},
 '010060':{name:'OCI홀딩스',industry:'기타 금융업',sector:'지주사',subSector:'복합지주',themes:['태양광','화학소재'],sourceUrl:'https://www.oci-holdings.co.kr/'},
 '328130':{name:'루닛',industry:'소프트웨어 개발 및 공급업',sector:'바이오',subSector:'진단·의료기기',themes:['의료AI','암진단'],sourceUrl:'https://www.lunit.io/en/about/'},
 '475150':{name:'SK이터닉스',industry:'건물 건설업',sector:'신재생에너지',subSector:'발전개발·운영',themes:['태양광','풍력','ESS'],sourceUrl:'https://www.sketernix.com/company/overview.do'},
 '028260':{name:'삼성물산',industry:'기타 전문 도매업',sector:'건설·EPC',subSector:'종합건설',themes:['건설','상사','패션','리조트'],sourceUrl:'https://www.samsungcnt.com/about-us/overview.do'},
 '034730':{name:'SK',industry:'기타 금융업',sector:'지주사',subSector:'복합지주',themes:['지주회사','IT서비스'],sourceUrl:'https://www.sk-inc.co.kr/'},
 '178320':{name:'서진시스템',industry:'기타 전기장비 제조업',sector:'2차전지',subSector:'ESS 장비·부품',themes:['ESS','반도체장비','통신장비'],sourceUrl:'https://seojinsystem.net/business/sector.php'}
};
export function businessTaxonomy(issuer){
 const review=REVIEWS[issuer.symbol];
 if(review&&review.name===issuer.name&&review.industry===issuer.industry)return {...review,businessReviewedAt:'2026-11-09',ruleId:'review-'+issuer.symbol};
 // Products referring to unrelated legacy businesses must not generate an
 // investment exposure merely from the current company name.
 if(['290690','475150'].includes(issuer.symbol))return null;
 const rule=PRODUCTS.find(x=>x.pattern.test(issuer.products))||INDUSTRIES.find(x=>x.pattern.test(issuer.industry));
 return rule?{sector:rule.sector,subSector:rule.subSector,themes:[...rule.themes],ruleId:rule.id}:null;
}
