import {SignalPanel,signalChartStyle} from './signal-panel';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, ToolboxComponent, MarkAreaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsType, EChartsCoreOption } from 'echarts/core';
import { validateKospiPensionDataset, withWilderRsi, signalDays, visiblePriceBounds, periodStartIndex } from './kospi-pension-signal-data.mjs';

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, ToolboxComponent, MarkAreaComponent, CanvasRenderer]);

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
            (signal ? '<br/><b style="color:#d94d40">음영 구간 · 신호 조건 충족 (클릭)</b>' : '');
        }
      },
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
          showSymbol: false, sampling: 'lttb', lineStyle: {width: 1.7, color: '#2e7860'}, z: 3,
          markArea: {
            silent: false,
            label: {show: false},
            itemStyle: {color: 'rgba(228,93,75,0.18)', borderWidth: 0},
            emphasis: {label: {show: false}, itemStyle: {color: 'rgba(228,93,75,0.34)'}},
            data: signals.map(p => {
              const i = byDate.get(p.date)?.i ?? 0;
              return [{name: p.date, xAxis: p.date}, {xAxis: points[Math.min(i + 1, points.length - 1)].date}];
            })
          }
        }
      ]
    };
    instance.setOption(option);
    const signalSet = new Set(signals.map(p => p.date));
    const chooseSignal = (params: unknown) => {
      const event = params as {componentType?: string; name?: string; dataIndex?: number};
      if (event.componentType === 'markArea' && event.name && signalSet.has(event.name)) setSelectedDate(event.name);
    };
    // Underlying plot clicks may not be delivered to markArea after zoom.
    // Resolve a clicked date from the actual data-axis pixel to preserve selection.
    const choosePlotDate = (event: {offsetX: number; offsetY: number}) => {
      if (!instance.containPixel('grid', [event.offsetX, event.offsetY])) return;
      const axis = instance.convertFromPixel({xAxisIndex: 0}, event.offsetX);
      const idx = typeof axis === 'string' ? byDate.get(axis)?.i : Math.floor(Number(axis));
      if (idx === undefined || !Number.isInteger(idx) || idx < 0 || idx >= points.length) return;
      const date = points[idx].date;
      if (signalSet.has(date)) setSelectedDate(date);
    };
    instance.on('click', chooseSignal);
    instance.getZr().on('click', choosePlotDate);

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
    return () => {observer?.disconnect(); instance.off('datazoom', fitVisible); instance.off('click', chooseSignal); instance.getZr().off('click', choosePlotDate); instance.dispose(); chart.current = null;};
  }, [points, signals, byDate]);

  useEffect(() => {
    const instance = chart.current;
    if (!instance || !points.length) return;
    const first = periodStartIndex(points, period);
    const start = first / Math.max(1, points.length - 1) * 100;
    instance.dispatchAction({type: 'dataZoom', dataZoomIndex: 0, start, end: 100});
  }, [period, points]);

  const selected = selectedDate ? byDate.get(selectedDate) : undefined;
  const returns = selected ? [5,10,20].map(days => {
    const future = points[selected.i + days];
    return {days, value: future ? (future.close / selected.p.close - 1) * 100 : null, date: future?.date};
  }) : [];

  return <>
    <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:10, margin:'4px 12px 6px'}}>
      <div style={{display:'flex', flexWrap:'wrap', gap:6}} role="group" aria-label="차트 조회 기간">
        {ranges.map(p => <button key={p.value} type="button" aria-pressed={period === p.value}
          onClick={() => setPeriod(p.value)} style={{font:'inherit', fontSize:12, padding:'7px 11px', borderRadius:7,
            border:'1px solid #d6e1d9', background:period === p.value?'#215e47':'#fff',
            color:period === p.value?'#fff':'#305c4a', cursor:'pointer'}}>{p.label}</button>)}
      </div>
      <span style={{fontSize:12, color:'#637569'}}>{points.length.toLocaleString('ko-KR')}거래일 · <span style={{background:'rgba(228,93,75,.18)',padding:'3px 5px',borderRadius:3}}>조건 충족 음영</span> {signals.length}일</span>
    </div>
    <div ref={host} role="img" aria-label="코스피 종가 차트, RSI 35 이하이면서 연기금 1,000억원 이상 순매수한 날짜에 세로 음영 표시"
      style={signalChartStyle}/>
    {selected && <section aria-live="polite" style={{margin:'8px 14px 16px',padding:'14px',border:'1px solid #d7e3db',borderRadius:10,background:'#f8fbf8'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <strong>▥ {selected.p.date} 음영 구간 이후 코스피 수익률</strong>
        <button type="button" onClick={() => setSelectedDate(null)} aria-label="선택 해제" style={{cursor:'pointer',background:'transparent',border:0,fontSize:18}}>×</button>
      </div>
      <p style={{fontSize:12,margin:'8px 0',color:'#52645c'}}>신호일 종가 {fmt(selected.p.close)}P · RSI {fmt(selected.p.rsi ?? 0)} · 연기금 +{fmt(selected.p.netBuyBillion * 10,0)}억원</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
        {returns.map(item => <div key={item.days} style={{padding:'12px 8px',background:'#fff',borderRadius:8,border:'1px solid #e3ebe5',textAlign:'center'}}>
          <div style={{fontSize:12,color:'#64776d'}}>{item.days}거래일 후</div>
          <strong style={{fontSize:20,color:item.value===null?'#64776d':item.value>=0?'#c64040':'#2868b0'}}>{item.value===null?'미산출':(item.value>=0?'+':'')+fmt(item.value)+'%'}</strong>
          <div style={{fontSize:11,color:'#7b897f'}}>{item.date ?? '미래 데이터 없음'}</div>
        </div>)}
      </div>
      <p style={{fontSize:11,color:'#7b897f',margin:'9px 0 0'}}>신호 당일 종가 기준, 거래비용 미반영 · 과거 수익률은 미래 성과를 보장하지 않습니다.</p>
    </section>}
    <p style={{fontSize:12, color:'#748077', margin:'0 14px 8px'}}>
      음영 구간 클릭: 5·10·20거래일 후 수익률 · 휠: 확대·축소 · 드래그: 차트 이동 · 하단 슬라이더: 범위 조절
      <br/>확대 시 현재 보이는 날짜의 최고·최저값 기준으로 세로축을 자동 맞춤합니다.
    </p>
    <p style={{fontSize:11, color:'#748077', margin:'0 14px 12px'}}>
      출처: KRX 제공 과거 이력 + LS증권 장 마감 추가분 · 최근 반영일 {latest}
      · 매 거래일 16:30 자동 갱신 · 지연 시 저녁 재시도 및 다음 거래일 아침 재확인 · 화면은 15분마다 새 자료 확인
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
    const load = async () => {
      try {
        const response = await fetch(url, {signal:ctrl.signal, cache:'no-store'});
        if (!response.ok) throw Error('연기금 차트 데이터 갱신 실패 (' + response.status + ')');
        const checked = validateKospiPensionDataset(await response.json());
        if (ctrl.signal.aborted) return;
        setRows(previous => {
          const latest = previous.at(-1);
          const next = checked.at(-1);
          if (latest && next && previous.length === checked.length &&
              latest.date === next.date && latest.close === next.close &&
              latest.netBuyBillion === next.netBuyBillion) return previous;
          return withWilderRsi(checked) as Point[];
        });
        setError('');
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : '데이터 갱신 실패');
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15*60*1000);
    const onVisible = () => {if (document.visibilityState === 'visible') void load();};
    document.addEventListener('visibilitychange', onVisible);
    return () => {ctrl.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  }, [open, url]);
  return <SignalPanel title="코스피 RSI 35 이하 · 연기금 1,000억원 이상 순매수" id="kospi-pension-rsi-panel" open={open} onToggle={()=>setOpen(v=>!v)}>
      {error && <p role="status" className="muted">데이터 갱신 상태: {error} · 마지막 정상 차트는 유지합니다.</p>}
      {rows.length ? <KospiPensionSignalChart points={rows}/> :
       !error && <p className="muted" role="status" aria-busy="true">코스피·연기금 이력 데이터를 불러오는 중…</p>}
    </SignalPanel>;
}
