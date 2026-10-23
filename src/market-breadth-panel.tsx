import { useEffect, useState } from 'react';
import MarketBreadthChart from './market-breadth-chart';
import { loadMarketBreadth, type BreadthDataset } from './market-breadth-data';

export default function MarketBreadthPanel({ url, asOf }: {url: string; asOf?: string}) {
  const [data, setData] = useState<BreadthDataset | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const ctrl = new AbortController();
    setError('');
    loadMarketBreadth(url, ctrl.signal).then(setData).catch(err => {
      if (!ctrl.signal.aborted) {setData(null);setError(err instanceof Error ? err.message : '데이터 로딩 실패');}
    });
    return () => ctrl.abort();
  }, [url]);
  if (error) return <section className="panel" role="alert"><h2>코스피 20일선 하락비율</h2><p>{error}</p></section>;
  if (!data) return <section className="panel" aria-busy="true">코스피 하락비율 데이터를 불러오는 중…</section>;
  return <div>
    <p className="muted" style={{marginBottom:8,fontSize:12}}>
      {data.status === 'provisional' ? '잠정 데이터 · 종목 분류/수정주가 검증 전' : '검증 데이터'} · {data.startDate} ~ {data.endDate} · {data.rows.length.toLocaleString('ko-KR')}거래일
    </p>
    <MarketBreadthChart rows={data.rows} asOf={asOf} />
  </div>;
}
