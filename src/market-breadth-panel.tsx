import { useEffect, useState } from 'react';
import MarketBreadthChart from './market-breadth-chart';
import { loadMarketBreadth, type BreadthDataset } from './market-breadth-data';

export default function MarketBreadthPanel({ url, asOf }: {url: string; asOf?: string}) {
  const [data, setData] = useState<BreadthDataset | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setError('');
    loadMarketBreadth(url, ctrl.signal).then(setData).catch(err => {
      if (!ctrl.signal.aborted) {setData(null);setError(err instanceof Error ? err.message : '데이터 로딩 실패');}
    });
    return () => ctrl.abort();
  }, [url]);
  // These dates require source-level verification. Exclude their breadth readings
  // from chart thresholds without altering the original data file.
  const flaggedDates = new Set(['2020-08-18', '2026-03-04']);
  const chartRows = data?.rows.map(row =>
    flaggedDates.has(row.date) ? { ...row, below20Pct: null } : row
  ) ?? [];
  const lastValid = [...chartRows].reverse().find(row => row.below20Pct !== null)?.date;
  const content = error
    ? <p role="alert" className="muted">{error}</p>
    : !data
      ? <p className="muted" aria-busy="true">코스피 하락비율 데이터를 불러오는 중…</p>
      : <>
          <p className="muted" style={{marginBottom:8,fontSize:12}}>
            {data.status === 'provisional' ? '잠정 데이터 · 종목 분류/수정주가 검증 전' : '검증 데이터'} · {data.startDate} ~ {data.endDate} · {data.rows.length.toLocaleString('ko-KR')}거래일
          </p>
          <p className="muted" style={{marginBottom:8,fontSize:12}}>
            주의: 원본 수정주가·과거 구성종목 검증 전이므로 모든 하락비율은 잠정치입니다.
            의심 날짜 2020-08-18, 2026-03-04는 표시에서 제외하고, 원본 결측값은 그대로 유지합니다.
            마지막 유효 하락비율 날짜: {lastValid ?? '없음'}
          </p>
          <MarketBreadthChart rows={chartRows} asOf={asOf} />
        </>;
  return <section className="panel correlation-panel market-breadth-accordion">
    <button type="button" className="correlation-toggle" aria-expanded={expanded} aria-controls="kospi-market-breadth-content" onClick={()=>setExpanded(v=>!v)}>
      <span>코스피와 20일선 하락비율</span>
      <span aria-hidden="true">{expanded?'−':'+'}</span>
    </button>
    {expanded && <div id="kospi-market-breadth-content" style={{padding:'0 12px 14px'}}>{content}</div>}
  </section>;
}
