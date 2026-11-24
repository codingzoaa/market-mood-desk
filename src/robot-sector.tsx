import Robot2027Roadmap,{RobotKeyDates} from './robot-2027-roadmap';
import roadmap from './data/robot-2027-roadmap.json';
import {useEffect,useRef} from 'react';
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
  <RobotKeyDates/>
  <Robot2027Roadmap/>
  <section className="panel robot-section"><h3>기업별 관심 종목</h3><p className="robot-note">사용자가 제공한 관심 목록입니다. 기업별 연결은 확정 납품 관계를 뜻하지 않으며, 기존 종목 분류를 변경하지 않습니다.</p><dl className="robot-companies">{companies.map(([name,stocks])=><div key={name}><dt>{name}</dt><dd>{stocks}</dd></div>)}</dl><p className="robot-note">보스턴다이나믹스는 현대차그룹 로봇 사업의 핵심 기업으로 별도 관찰합니다. 국내 상장 종목 목록에는 포함하지 않습니다.</p></section>
  <section className="panel robot-section"><h3>핵심 부품별 관심 목록</h3><div className="robot-parts">{parts.map(([name,stocks,check])=><article key={name}><h4>{name}</h4><p>{stocks}</p><small>확인할 내용 · {check}</small></article>)}</div></section>
  <section className="panel robot-section"><h3>추가 검증할 내용</h3><ul><li>KH바텍의 삼성 휴머노이드용 힌지 기술 적용 여부는 공식 근거 확인이 필요합니다.</li><li>최대주주·2대주주 등 지분 관계는 기준일과 공시를 확인한 뒤 표시합니다.</li><li>전고체 배터리는 장기 기술 테마이며, 실제 휴머노이드 납품 여부와 구분합니다.</li><li>같은 종목이 여러 기업·부품 관심 목록에 등장할 수 있습니다.</li></ul></section>
  <section className="panel robot-section"><h3>출처·자료 이력</h3><p className="robot-note">2026. 11. 24. · 기업별 로드맵과 2027년 이벤트를 통합했습니다. 중요한 일정 5개를 상단에 모으고 2028년 계획은 별도로 구분했습니다.</p><ul className="robot-sources">{roadmap.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></section>
  
  <a className="robot-back" href="#stockmap">종목 섹터맵으로 돌아가기</a>
 </article>;
}
