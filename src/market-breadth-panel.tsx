import { useEffect, useMemo, useState } from 'react';
import MarketBreadthChart from './market-breadth-chart';
import { loadMarketBreadth, type BreadthDataset } from './market-breadth-data';

// Measurements at these dates need independent source verification.
// Preserve the KOSPI price, but never turn an uncertain breadth value into a signal.
const flaggedDates = new Set(['2020-08-18', '2026-03-04', '2026-10-23']);

export default function MarketBreadthPanel({ url, asOf }: {url: string; asOf?: string}) {
  const [data, setData] = useState<BreadthDataset | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setError('');
    loadMarketBreadth(url, ctrl.signal).then(setData).catch(err => {
      if (!ctrl.signal.aborted) {
        setData(null);
        setError(err instanceof Error ? err.message : '데이터 로딩 실패');
      }
    });
    return () => ctrl.abort();
  }, [url]);
  const chartRows = useMemo(() => data?.rows.map(row =>
    flaggedDates.has(row.date) ? {...row, below20Pct: null} : row
  ) ?? [], [data]);
  const lastValid = [...chartRows].reverse().find(row => row.below20Pct !== null)?.date;
  const content = error
    ? <p role="alert" className="muted">{error}</p>
    : !data
      ? <p className="muted" aria-busy="true">코스피 하락비율 데이터를 불러오는 중…</p>
      : <>
        <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', padding:'0 12px 8px',
          fontSize:11, color:'#748077'}}>
          <span>{data.status === 'provisional' ? '잠정 데이터 · 검증 전' : '검증 데이터'}</span>
          <span>{data.startDate} ~ {data.endDate}</span>
          <span>{data.rows.length.toLocaleString('ko-KR')}거래일</span>
          <span>하락비율 마지막 유효일 {lastValid ?? '없음'}</span>
        </div>
        <MarketBreadthChart rows={chartRows} asOf={asOf}/>
        <details style={{margin:'6px 12px 10px', padding:'10px 12px', background:'#f8faf7',
          border:'1px solid #e9eee9', borderRadius:8, color:'#66766c', fontSize:11}}>
          <summary style={{cursor:'pointer', color:'#496755'}}>데이터 검증 및 음영 표시 기준</summary>
          <p style={{marginTop:8}}>
            85% 이상은 연한 빨강, 90% 이상은 진한 빨강으로 표시합니다. 90% 이상 구간에
            85% 음영을 중복해서 칠하지 않습니다. 결측·검증 제외일은 음영으로 표시하지 않습니다.
          </p>
          {data.status === 'provisional' && <p style={{marginTop:7}}>
            과거 종목 구성·수정주가 검증이 끝나지 않은 잠정 지표입니다.
            2020-08-18, 2026-03-04, 2026-10-23의 의심 측정치는
            코스피 가격을 유지한 채 하락비율과 음영에서 제외했습니다.
          </p>}
        </details>
      </>;
  return <section className="panel" style={{padding:0,overflow:'hidden'}}>
    <button type="button" aria-expanded={expanded} aria-controls="kospi-market-breadth-content"
      onClick={() => setExpanded(v => !v)}
      style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14,
        padding:'18px 20px', font:'inherit', textAlign:'left', fontWeight:700,
        color:'var(--ink)', background:'var(--paper)', border:0, cursor:'pointer'}}>
      <span>코스피와 20일선 하락비율</span>
      <span aria-hidden="true" style={{fontSize:22,color:'var(--green)',fontWeight:400,lineHeight:1}}>{expanded?'−':'+'}</span>
    </button>
    {expanded && <div id="kospi-market-breadth-content" style={{padding:'0 12px 14px'}}>{content}</div>}
  </section>;
}
