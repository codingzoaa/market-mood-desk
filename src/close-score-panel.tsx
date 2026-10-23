import type {CloseSector} from './close-reviews';
import type {CloseEvidence} from './close-live';
import {mergedCloseInput} from './close-live';
import {scoreSector} from './close-score';
const money=(n:number)=>(n/1e8).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억원';
export default function CloseScorePanel({sector,date,rows}:{sector:CloseSector;date:string;rows:CloseEvidence[]}){
 const input=mergedCloseInput(sector,date,rows),score=scoreSector(input,date),stock=rows.find(s=>s.date===date&&s.symbol===sector.leaderSymbol);
 return <div className="close-score" aria-label={sector.name+' 강도점수'}><div className="close-score-title"><b>강도점수</b><strong>{score.total===null?'총점 미산출':`${score.total} / 100`}</strong><small>{score.known}/5 항목 확인</small></div><div className="close-score-grid">{score.components.map(c=><div key={c.key}><span>{c.label}</span><b>{c.value===null?'미산출':c.value+'점'} <small>/ {c.max}</small></b></div>)}</div>{stock&&<p className="footnote">LS 마감 자료 · {stock.name} · 거래대금 {money(stock.turnover)} / 시가총액 {money(stock.marketCap)} · {stock.streak===null?'상승 이력 부족':`${stock.streak}거래일 연속 상승`}{stock.foreignNet!==undefined&&stock.institutionNet!==undefined&&<> · 외국인 {money(stock.foreignNet)} / 기관 {money(stock.institutionNet)} (집계 갱신 가능)</>}</p>}{!sector.scoreUniverse&&<p className="footnote">동반 상승: 전체 구성종목 확정 대기</p>}{input&&<p className="footnote">확인한 평가 근거: {input.sourceUrls.map((url,j)=><a key={url} href={url} target="_blank" rel="noopener noreferrer">원문 {j+1} ↗ </a>)}</p>}</div>;
}
