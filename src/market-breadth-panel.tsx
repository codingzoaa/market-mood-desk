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
  const content = error
    ? <p role="alert" className="muted">{error}</p>
    : !data
      ? <p className="muted" aria-busy="true">코스피 하락비율 데이터를 불러오는 중…</p>
      : <>
          <p className="muted" style={{marginBottom:8,fontSize:12}}>
            {data.status === 'provisional' ? '잠정 데이터 · 종목 분류/수정주가 검증 전' : '검증 데이터'} · {data.startDate} ~ {data.endDate} · {data.rows.length.toLocaleString('ko-KR')}거래일
          </p>
          <MarketBreadthChart rows={data.rows} asOf={asOf} />
        </>;
  return <section className="panel" style={{padding:0,overflow:'hidden'}}>
    <button type="button" aria-expanded={expanded} aria-controls="kospi-market-breadth-content" onClick={()=>setExpanded(v=>!v)}
      style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,
        padding:'18px 20px',font:'inherit',textAlign:'left',fontWeight:700,
        color:'var(--ink)',background:'var(--paper)',border:0,cursor:'pointer'}}>
      <span>코스피와 20일선 하락비율</span>
      <span aria-hidden="true" style={{fontSize:22,color:'var(--green)',fontWeight:400,lineHeight:1}}>{expanded?'−':'+'}</span>
    </button>
    {expanded && <div id="kospi-market-breadth-content" style={{padding:'0 12px 14px'}}>{content}</div>}
  </section>;
}
