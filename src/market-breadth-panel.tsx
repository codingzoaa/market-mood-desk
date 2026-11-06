import {SignalPanel} from './signal-panel';
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
    const refresh = () => loadMarketBreadth(url, ctrl.signal).then(value => {
      setData(value); setError('');
    }).catch(err => {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : '데이터 로딩 실패');
    });
    const visible = () => {if(document.visibilityState === 'visible') void refresh();};
    void refresh();
    const timer = window.setInterval(refresh, 15*60*1000);
    document.addEventListener('visibilitychange', visible);
    return () => {ctrl.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  }, [url]);
  const chartRows = useMemo(() => data?.rows.map(row =>
    (data.excludedDates ? data.excludedDates.includes(row.date) : flaggedDates.has(row.date)) ? {...row, below20Pct: null} : row
  ) ?? [], [data]);
  const lastValid = [...chartRows].reverse().find(row => row.below20Pct !== null)?.date;
  const content = error && !data
    ? <p role="alert" className="muted">{error}</p>
    : !data
      ? <p className="muted" aria-busy="true">코스피 하락비율 데이터를 불러오는 중…</p>
      : <>
        <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', padding:'0 12px 8px',
          fontSize:11, color:'#748077'}}>
          <span>{data.status === 'provisional' ? (data.methodReproduced ? '계산 재현 확인 · 원자료 잠정' : '잠정 데이터 · 검증 전') : '검증 데이터'}</span>
          <span>{data.startDate} ~ {data.endDate}</span>
          <span>{data.rows.length.toLocaleString('ko-KR')}거래일</span>
          <span>하락비율 마지막 유효일 {lastValid ?? '없음'}</span>
          {!!data.sourceLagDays && <span>종목 원자료 공개 시차 {data.sourceLagDays}일</span>}
        </div>
        {error && <p className="muted" role="status">새 자료 확인에 실패해 마지막 정상 자료를 표시합니다.</p>}
        {data.source && <p className="muted" style={{fontSize:11,padding:'0 12px 8px'}}>출처: {data.source} · {data.autoUpdate}{data.updatedAt && ` · 갱신 ${new Date(data.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`}</p>}
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
            원본과 같은 KOSPI 숫자 종목·양의 거래량·직전 20거래일 모두 유효한 종가로 계산합니다.
            {(data.excludedDates ?? [...flaggedDates]).length > 0 && ` ${(data.excludedDates ?? [...flaggedDates]).join(', ')}은 추가 확인이 필요해 하락비율과 음영에서 제외했습니다.`}
          </p>}
        </details>
      </>;
  return <SignalPanel title="코스피와 20일선 하락비율" id="kospi-market-breadth-content" open={expanded} onToggle={()=>setExpanded(v=>!v)}>{content}</SignalPanel>;
}
