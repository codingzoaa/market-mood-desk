import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, ToolboxComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsType, EChartsCoreOption } from 'echarts/core';
import { validateKospiPensionDataset, withWilderRsi, signalDays, visiblePriceBounds, periodStartIndex } from './kospi-pension-signal-data.mjs';

echarts.use([LineChart, ScatterChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, ToolboxComponent, CanvasRenderer]);

type Point = { date: string; close: number; netBuyBillion: number; rsi: number | null };
type Period = '1M' | '3M' | '1Y' | '5Y' | 'ALL';
const ranges: { label: string; value: Period }[] = [
  {label: '1개월', value: '1M'}, {label: '3개월', value: '3M'},
  {label: '1년', value: '1Y'}, {label: '5년', value: '5Y'}, {label: '전체', value: 'ALL'}
];
const fmt = (value: number, decimals = 2) =>
  value.toLocaleString('ko-KR', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});

function KospiPensionSignalChart({ points }: {points: Point[]}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const [period, setPeriod] = useState<Period>('1Y');
  const signals = useMemo(() => signalDays(points) as Point[], [points]);
  const byDate = useMemo(() => new Map(points.map((p, i) => [p.date, {p, i}])), [points]);
  const latest = points.at(-1)?.date || '';

  useEffect(() => {
    if (!host.current || !points.length) return;
    const instance = echarts.init(host.current, undefined, {renderer: 'canvas'});
    chart.current = instance;
    const startIndex = periodStartIndex(points, '1Y');
    const startPct = startIndex / Math.max(1, points.length - 1) * 100;
    const [minPrice, maxPrice] = visiblePriceBounds(points, startIndex, points.length - 1);
    const option: EChartsCoreOption = {
      animation: false,
      color: ['#35735c', '#e45d4b'],
      grid: {top: 60, left: 17, right: 23, bottom: 95, containLabel: true},
      legend: {top: 8, left: 16, itemWidth: 17, itemHeight: 10, textStyle: {color: '#52645c', fontSize: 12}},
      tooltip: {
        trigger: 'axis', confine: true, backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: '#d9e4dc', textStyle: {color: '#213f34', fontSize: 12},
        axisPointer: {type: 'cross'},
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params as Array<{axisValue?: string; value?: [string, number]}> : [];
          const date = String(list[0]?.axisValue || list[0]?.value?.[0] || '');
          const found = byDate.get(date);
          if (!found) return '';
          const {p, i} = found;
          const previous = i > 0 ? points[i - 1].close : null;
          const change = previous === null ? '' : (p.close / previous - 1) * 100;
          const signal = p.rsi !== null && p.rsi <= 35 && p.netBuyBillion >= 100;
          return '<b>' + date + '</b><br/>' +
            '코스피 ' + fmt(p.close) + 'P' +
            (typeof change === 'number' ? ' (' + (change >= 0 ? '+' : '') + fmt(change) + '%)' : '') +
            '<br/>RSI(14) ' + (p.rsi === null ? '계산 전' : fmt(p.rsi)) +
            '<br/>연기금 등 ' + (p.netBuyBillion >= 0 ? '+' : '') + fmt(p.netBuyBillion * 10, 0) + '억원' +
            (signal ? '<br/><b style="color:#d94d40">▲ 신호 조건 충족</b>' : '');
        }
      },
      toolbox: {right: 12, top: 5, feature: {dataZoom: {yAxisIndex: 'none', title: {zoom: '드래그 영역 확대', back: '이전 확대'}}}},
      xAxis: {type: 'category', boundaryGap: false, data: points.map(p => p.date),
        axisLabel: {color: '#697b71', hideOverlap: true}, axisLine: {lineStyle: {color: '#c9d5cd'}}},
      yAxis: {type: 'value', name: 'KOSPI (P)', nameTextStyle: {color: '#52645c'}, scale: true,
        min: minPrice, max: maxPrice, axisLabel: {color: '#64776d'},
        splitLine: {lineStyle: {color: '#edf1ed'}}},
      dataZoom: [
        {type: 'inside', xAxisIndex: 0, filterMode: 'none', start: startPct, end: 100,
          minValueSpan: 5, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false},
        {type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 27, bottom: 17,
          start: startPct, end: 100, minValueSpan: 5,
          showDetail: true, brushSelect: true,
          borderColor: '#d1ded5', fillerColor: 'rgba(43,123,82,0.16)',
          handleStyle: {color: '#277452', borderColor: '#277452'}}
      ],
      series: [
        {name: '코스피 종가', type: 'line', data: points.map(p => p.close),
          showSymbol: false, sampling: 'lttb', lineStyle: {width: 1.7, color: '#2e7860'}, z: 3},
        {name: 'RSI≤35 · 연기금≥1,000억', type: 'scatter',
          data: signals.map(p => [p.date, p.close]), symbol: 'triangle', symbolSize: 13, symbolOffset: [0, -12],
          itemStyle: {color: '#e45d4b', borderColor: '#fff', borderWidth: 1.4}, z: 7}
      ]
    };
    instance.setOption(option);

    // ECharts keeps Y bounds fixed while dataZoom has filterMode:'none'.
    // Refit from the actual visible rows on every wheel, drag, slider or resize event.
    const fitVisible = () => {
      const zoom = (instance.getOption().dataZoom || [])[0] as {start?: number; end?: number} | undefined;
      const first = Math.floor(Math.max(0, Math.min(100, Number(zoom?.start ?? 0))) / 100 * (points.length - 1));
      const last = Math.ceil(Math.max(0, Math.min(100, Number(zoom?.end ?? 100))) / 100 * (points.length - 1));
      const [min, max] = visiblePriceBounds(points, first, Math.max(first, last));
      instance.setOption({yAxis: {min, max}} as EChartsCoreOption, {silent: true});
    };
    instance.on('datazoom', fitVisible);
    const resize = () => {instance.resize(); fitVisible();};
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(host.current);
    fitVisible();
    return () => {observer?.disconnect(); instance.off('datazoom', fitVisible); instance.dispose(); chart.current = null;};
  }, [points, signals, byDate]);

  useEffect(() => {
    const instance = chart.current;
    if (!instance || !points.length) return;
    const first = periodStartIndex(points, period);
    const start = first / Math.max(1, points.length - 1) * 100;
    instance.dispatchAction({type: 'dataZoom', dataZoomIndex: 0, start, end: 100});
  }, [period, points]);

  return <>
    <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:10, margin:'4px 12px 6px'}}>
      <div style={{display:'flex', flexWrap:'wrap', gap:6}} role="group" aria-label="차트 조회 기간">
        {ranges.map(p => <button key={p.value} type="button" aria-pressed={period === p.value}
          onClick={() => setPeriod(p.value)} style={{font:'inherit', fontSize:12, padding:'7px 11px', borderRadius:7,
            border:'1px solid #d6e1d9', background:period === p.value?'#215e47':'#fff',
            color:period === p.value?'#fff':'#305c4a', cursor:'pointer'}}>{p.label}</button>)}
      </div>
      <span style={{fontSize:12, color:'#637569'}}>{points.length.toLocaleString('ko-KR')}거래일 · 매수 신호 {signals.length}일</span>
    </div>
    <div ref={host} role="img" aria-label="코스피 종가 차트, RSI 35 이하이면서 연기금 1,000억원 이상 순매수한 날짜에 삼각형 신호 표시"
      style={{width:'100%',height:'min(65vh,620px)',minHeight:390}}/>
    <p style={{fontSize:12, color:'#748077', margin:'0 14px 8px'}}>
      휠: 확대·축소 · 드래그: 차트 이동 · 우측 상단 영역 확대 도구로 드래그 구간 선택 · 하단 슬라이더: 범위 조절
      <br/>확대 시 현재 보이는 날짜의 최고·최저값 기준으로 세로축을 자동 맞춤합니다.
    </p>
    <p style={{fontSize:11, color:'#748077', margin:'0 14px 12px'}}>
      원본: 업로드된 KRX 일별 코스피·투자자별 거래실적 · 2006-01-02 ~ {latest} · 정적 데이터(자동 갱신 아님)
      · 연기금 등 1,000억원 = 원자료 100십억원 · RSI(14) Wilder 방식
    </p>
  </>;
}

export default function KospiPensionSignalPanel({url = './kospi-pension-rsi.json'}: {url?: string}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Point[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setError('');
    fetch(url, {signal: ctrl.signal}).then(async response => {
      if (!response.ok) throw Error('연기금 신호 데이터 다운로드 오류 (' + response.status + ')');
      return response.json();
    }).then(json => {
      const checked = validateKospiPensionDataset(json);
      if (!ctrl.signal.aborted) setRows(withWilderRsi(checked) as Point[]);
    }).catch(err => {
      if (!ctrl.signal.aborted) {setRows([]);setError(err instanceof Error ? err.message : '데이터 로딩 실패');}
    });
    return () => ctrl.abort();
  }, [open, url]);
  return <section className="panel" style={{padding:0, overflow:'hidden'}}>
    <button type="button" aria-expanded={open} aria-controls="kospi-pension-rsi-panel" onClick={() => setOpen(v => !v)}
      style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14,
        padding:'18px 20px', font:'inherit', textAlign:'left', fontWeight:700,
        color:'var(--ink)', background:'var(--paper)', border:0, cursor:'pointer'}}>
      <span>코스피 RSI 35 이하 · 연기금 1,000억원 이상 순매수</span>
      <span aria-hidden="true" style={{fontSize:22,color:'var(--green)',fontWeight:400,lineHeight:1}}>{open?'−':'+'}</span>
    </button>
    {open && <div id="kospi-pension-rsi-panel" style={{padding:'0 12px 14px'}}>
      {error ? <p role="alert" className="muted">{error}</p> :
       rows.length ? <KospiPensionSignalChart points={rows}/> :
       <p className="muted" role="status" aria-busy="true">코스피·연기금 이력 데이터를 불러오는 중…</p>}
    </div>}
  </section>;
}
