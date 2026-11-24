import Robot2027Roadmap from './robot-2027-roadmap';
import {SectorNoteFeed} from './sector-note-pages';
import {useEffect,useRef} from 'react';
const sources=[
 {name:'삼성전자 뉴스룸 · 2024-12-31',title:'레인보우로보틱스 지분 35% 확보·미래로봇 개발',url:'https://news.samsung.com/global/samsung-electronics-to-become-largest-shareholder-in-rainbow-robotics-accelerating-future-robot-development'},
 {name:'서울경제 · 2026-09-07',title:'CES 2027 휴머노이드 공개 보도 · 회사 공식 확인 필요',url:'https://en.sedaily.com/business/2026/09/07/samsung-to-unveil-first-humanoid-robot-at-ces-2027'},
 {name:'LG전자 보도자료 · 2026-08-14',title:'NVIDIA Isaac GR00T 기반 차세대 휴머노이드',url:'https://www.prnewswire.com/news-releases/lg-to-unveil-its-next-gen-humanoid-robot-built-on-nvidia-isaac-gr00t-302851652.html'},
 {name:'현대차그룹 · CES 2026',title:'AI 로보틱스 전략·2028년 생산 체계 목표',url:'https://www.hyundai.com/content/hyundai/worldwide/en/newsroom/detail/hyundai-motor-group-announces-ai-robotics-strategy-to-lead-human-centered-robotics-era-at-ces-2026-0000001100.html'},
 {name:'현대차그룹 · 2026-07-16',title:'보스턴다이나믹스·2028년 HMGMA 투입 계획',url:'https://www.hyundai.com/worldwide/en/newsroom/detail/0000001225.html'},
 {name:'테슬라 · 2026년 3분기',title:'공식 실적 자료·Optimus 생산 현황',url:'https://assets-ir.tesla.com/tesla-contents/IR/TSLA-Q3-2026-Update.pdf'}
];
const roadmaps=[
 {company:'삼성전자',when:'2027년 CES',status:'보도 · 공식 확인 필요',body:'자체 휴머노이드 공개 계획 보도. 레인보우로보틱스 지분 35% 확보와 미래로봇 개발 추진은 공식 발표 사항입니다.',check:'공개 일정 확정·부품 채택',refs:[0,1]},
 {company:'LG전자',when:'2027년 1분기',status:'공식 발표 · 공개 예정',body:'NVIDIA Isaac GR00T·Jetson Thor를 활용한 차세대 휴머노이드 공개 계획. LG전자·LG이노텍·LG에너지솔루션의 구동·센서·배터리 역량을 연계합니다.',check:'실제 공개·공장 실증·공급 구조',refs:[2]},
 {company:'현대차그룹',when:'2028년',status:'공식 발표 · 목표',body:'연간 3만 대 생산 능력을 갖춘 체계와 미국 조지아 HMGMA 공장 투입을 추진합니다. 생산 능력 목표는 실제 생산량과 구분합니다.',check:'생산시설 가동·현장 투입·실제 물량',refs:[3,4]},
 {company:'테슬라',when:'초기 생산 확대',status:'공식 자료 · 초기 단계',body:'2026년 3분기 공식 자료 기준 프리몬트 초기 생산 단계, 텍사스 생산시설 건설 중입니다.',check:'2027년 하반기·연 50만~100만 대 수치는 별도 근거 확인 필요',refs:[5]}
];
const companies=[
 ['삼성','레인보우로보틱스, 에스피지, 이랜시스, 인탑스, KH바텍, 삼성SDI, 에브리봇, 에스비비테크, 아진엑스텍, 우림피티에스'],
 ['LG','LG전자, 로보티즈, LG씨엔에스, LG이노텍, 로보스타, 엔젤로보틱스, LG에너지솔루션, 하이젠알앤엠'],
 ['현대차그룹','현대모비스, 현대오토에버, 비에이치, HL만도, 나무가, 엠씨넥스, 에스엘, 클로봇'],
 ['테슬라','삼현, 디케이티, LG에너지솔루션, 한라캐스트, 한국피아이엠']
];
const parts=[
 ['액추에이터·구동','로보티즈, 삼현, 현대모비스, HL만도','고객사 채택·공급 계약·양산 물량'],
 ['감속기','에스피지, 에스비비테크','휴머노이드용 제품 채택·매출'],
 ['손·손가락','원익홀딩스, 로보티즈','실제 공급 주체·정밀 조작 기술'],
 ['경량화·정밀 부품','한라캐스트, 한국피아이엠','로봇용 수주·매출 비중'],
 ['전고체 배터리·소재','이수스페셜티케미컬, 삼성SDI','상용화 일정·로봇 적용 여부']
];
export default function RobotSector(){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();},[]);
 return <article className="robot-sector" aria-label="로봇 섹터 상세">
  <nav aria-label="섹터 상세 경로"><a href="#stockmap">종목 섹터맵</a><span>/</span><span>로봇 · 휴머노이드</span></nav>
  <header className="panel robot-intro"><span className="eyebrow">SECTOR NOTE · ROBOTICS</span><h2 ref={heading} tabIndex={-1}>휴머노이드 로봇 로드맵</h2><p>제품 공개에서 공장 실증, 양산 확대로. 기업별 일정과 핵심 부품을 함께 살펴봅니다.</p><small>자료 정리 기준일 <time dateTime="2026-11-24">2026. 11. 24.</time> · 사용자 제공 자료와 기업 발표 기반</small></header>
  <section className="panel robot-section"><h3>핵심 요약</h3><p>2027년 공개 일정과 2028년 공장 투입·생산 체계 목표를 연결해 관찰합니다. 관련 종목은 실제 부품 채택, 공급 계약, 로봇 매출 발생 여부를 확인합니다.</p></section>
  <Robot2027Roadmap/>
  <section className="robot-section"><h3>기업별 로드맵</h3><div className="robot-roadmaps">{roadmaps.map(r=><article className="panel robot-roadmap" key={r.company}><div className="robot-card-top"><h4>{r.company}</h4><span className="robot-status">{r.status}</span></div><strong className="robot-date">{r.when}</strong><p>{r.body}</p><p className="robot-check"><b>확인할 내용</b> {r.check}</p><div className="robot-links">{r.refs.map(i=><a key={i} href={sources[i].url} target="_blank" rel="noopener noreferrer">{sources[i].name}</a>)}</div></article>)}</div></section>
  <section className="panel robot-section"><h3>기업별 관심 종목</h3><p className="robot-note">사용자가 제공한 관심 목록입니다. 기업별 연결은 확정 납품 관계를 뜻하지 않으며, 기존 종목 분류를 변경하지 않습니다.</p><dl className="robot-companies">{companies.map(([name,stocks])=><div key={name}><dt>{name}</dt><dd>{stocks}</dd></div>)}</dl><p className="robot-note">보스턴다이나믹스는 현대차그룹 로봇 사업의 핵심 기업으로 별도 관찰합니다. 국내 상장 종목 목록에는 포함하지 않습니다.</p></section>
  <section className="panel robot-section"><h3>핵심 부품별 관심 목록</h3><div className="robot-parts">{parts.map(([name,stocks,check])=><article key={name}><h4>{name}</h4><p>{stocks}</p><small>확인할 내용 · {check}</small></article>)}</div></section>
  <section className="panel robot-section"><h3>추가 검증할 내용</h3><ul><li>KH바텍의 삼성 휴머노이드용 힌지 기술 적용 여부는 공식 근거 확인이 필요합니다.</li><li>최대주주·2대주주 등 지분 관계는 기준일과 공시를 확인한 뒤 표시합니다.</li><li>전고체 배터리는 장기 기술 테마이며, 실제 휴머노이드 납품 여부와 구분합니다.</li><li>같은 종목이 여러 기업·부품 관심 목록에 등장할 수 있습니다.</li></ul></section>
  <section className="panel robot-section"><h3>출처·자료 이력</h3><p className="robot-note">2026. 11. 24. · 로봇 로드맵과 관심 목록 최초 정리. 공식 발표와 보도·미확인 내용을 구분했습니다.</p><ul className="robot-sources">{sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name} · {s.title}</a></li>)}</ul></section>
  <SectorNoteFeed sector="로봇"/>
  <a className="robot-back" href="#stockmap">종목 섹터맵으로 돌아가기</a>
 </article>;
}
