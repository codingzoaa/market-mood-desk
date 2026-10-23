import {breadthSummary,classificationCoverage} from './leadership';
import type {Snapshot,Stock} from './market';

export default function MarketSummary({snap,stocks}:{snap?:Snapshot;stocks:Stock[]}){
 if(!snap)return null;
 const coverage=classificationCoverage(snap.stocks,snap.etfs);
 const total=stocks.reduce((sum,s)=>sum+s.turnoverKRW,0);
 const lead=stocks[0];
 return <section className="panel leadership-summary" aria-label="오늘의 시장 요약">
  <div className="section-title"><h2>오늘의 시장 요약</h2><span className="badge">{snap.date} 기준</span></div>
  <div className="market-summary-grid">
   {(['KOSPI','KOSDAQ'] as const).map(board=>{
    const index=snap.details?.indices[board];
    return <div key={board}><strong>{board==='KOSPI'?'코스피':'코스닥'} · {breadthSummary(index)}</strong><p>{index?`상승 ${index.advances.toLocaleString('ko-KR')} · 하락 ${index.declines.toLocaleString('ko-KR')}`:'확보된 지수 상세로만 판단합니다.'}</p></div>;
   })}
   <div><strong>강세 종목 대금 집중도</strong><p>{lead&&total?`${lead.name} ${(lead.turnoverKRW/total*100).toFixed(1)}% · ${stocks.length}개 강세 종목 내`:'선택 범위에 +4% 강세 종목 없음'}</p></div>
   <div><strong>테마 분류 {coverage.classified}/{coverage.total}종목</strong><p>{coverage.pct===null?'수집 종목 없음':`수집 일반주 기준 ${coverage.pct.toFixed(1)}% · 미분류 ${coverage.total-coverage.classified}개`}</p></div>
  </div>
  <p className="footnote">대금 집중도는 선택한 시장·상위 범위의 +4% 종목 기준입니다. 시장 전체 자금 유입을 뜻하지 않습니다. 테마 분류율이 낮으면 섹터 해석에 제약이 있습니다.</p>
 </section>;
}
