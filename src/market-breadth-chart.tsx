import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, ToolboxComponent, MarkAreaComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { thresholdBands, periodStartIndex, visiblePriceBounds } from './market-breadth-view.mjs';

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, ToolboxComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer]);

export type MarketBreadthPoint = {
  date: string;
  kospiClose: number;
  below20Pct: number | null;
  validStockCount?: number;
};
export type MarketBreadthChartProps = {
  rows: MarketBreadthPoint[];
  height?: number;
  /** Ignore observations after the selected historical date. */
  asOf?: string;
};

type Period = '1M' | '3M' | '1Y' | '5Y' | 'ALL';
const ranges: { label: string; value: Period }[] = [
  {label: '1개월', value: '1M'}, {label: '3개월', value: '3M'},
  {label: '1년', value: '1Y'}, {label: '5년', value: '5Y'},
  {label: '전체', value: 'ALL'}
];
const timeOf = (day: string) => Date.parse(day + 'T00:00:00Z');
const dayOf = (time: number) => new Date(time).toISOString().slice(0, 10);
const number = (value: number, places = 2) =>
  value.toLocaleString('ko-KR', { minimumFractionDigits: places, maximumFractionDigits: places });
const zoomIndex = (percentage: number, length: number, round: 'floor' | 'ceil') => {
  const value = Math.max(0, Math.min(100, percentage)) / 100 * Math.max(0, length - 1);
  return round === 'floor' ? Math.floor(value) : Math.ceil(value);
};

/** Inclusive ranges retained for integrations that need one threshold rather than distinct shade levels. */
export function thresholdRanges(rows: MarketBreadthPoint[], threshold: number): Array<[number, number]> {
  return thresholdBands(rows, threshold);
}

export default function MarketBreadthChart({ rows, height = 520, asOf }: MarketBreadthChartProps) {
  const [period, setPeriod] = useState<Period>('1Y');
  const [showRatio, setShowRatio] = useState(false);
  const [visibleStats, setVisibleStats] = useState({ total: 0, warning: 0, severe: 0 });
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const clean = useMemo(() => {
    const byDate = new Map<string, MarketBreadthPoint>();
    for (const row of rows) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(row.kospiClose) || row.kospiClose <= 0) continue;
      if (row.below20Pct !== null && (!Number.isFinite(row.below20Pct) || row.below20Pct < 0 || row.below20Pct > 100)) continue;
      if (!asOf || row.date <= asOf) byDate.set(row.date, row);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, asOf]);
  const byDate = useMemo(() => new Map(clean.map(row => [row.date, row])), [clean]);

  useEffect(() => {
    if (!host.current || !clean.length) return;
    const instance = echarts.init(host.current, undefined, {renderer: 'canvas'});
    chartRef.current = instance;
    const prices = clean.map(p => [timeOf(p.date), p.kospiClose]);
    const percentages = clean.map(p => [timeOf(p.date), p.below20Pct]);
    const first = periodStartIndex(clean, period);
    const startPct = first / Math.max(1, clean.length - 1) * 100;
    const [minPrice, maxPrice] = visiblePriceBounds(clean, first, clean.length - 1);
    const shade = (lower: number, upper: number, color: string) => ({
      name: lower === 90 ? '90% 이상 음영' : '85% 이상 음영',
      type: 'line',
      yAxisIndex: 0,
      data: prices,
      showSymbol: false,
      symbol: 'none',
      silent: true,
      lineStyle: {opacity: 0, width: 0},
      itemStyle: {opacity: 0},
      tooltip: {show: false},
      markArea: {
        silent: true, label: {show: false},
        itemStyle: {color, borderWidth: 0},
        data: thresholdBands(clean, lower, upper).map(([start, end]: [number, number]) =>
          [{xAxis: start}, {xAxis: end}])
      },
      z: 0
    });
    const option: EChartsCoreOption = {
      animation: false,
      color: ['#2e7860', '#159d8f'],
      grid: {top: 63, left: 18, right: showRatio ? 22 : 18, bottom: 92, containLabel: true},
      legend: {
        top: 9, left: 16, itemWidth: 17, itemHeight: 10,
        data: showRatio ? ['코스피 종가', '20일선 하락비율'] : ['코스피 종가'],
        textStyle: {color: '#52645c', fontSize: 12}
      },
      tooltip: {
        trigger: 'axis', confine: true,
        backgroundColor: 'rgba(255,255,255,0.97)', borderColor: '#d9e4dc',
        textStyle: {color: '#213f34', fontSize: 12},
        axisPointer: {type: 'cross'},
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params as Array<{axisValue?: number | string; data?: [number, number | null]}> : [];
          const value = list[0]?.data?.[0] ?? list[0]?.axisValue;
          if (value === undefined) return '';
          const date = dayOf(Number(value));
          const p = byDate.get(date);
          if (!p) return '';
          const ratio = p.below20Pct === null ? '결측' : number(p.below20Pct, 1) + '%';
          const level = p.below20Pct === null ? '' :
            p.below20Pct >= 90 ? '<br/><b style="color:#c64040">90% 이상 · 극단적 과매도</b>' :
            p.below20Pct >= 85 ? '<br/><b style="color:#cf7459">85% 이상 · 과매도 주의</b>' : '';
          const count = p.validStockCount === undefined ? '' :
            '<br/>유효 종목 ' + p.validStockCount.toLocaleString('ko-KR') + '개';
          return '<b>' + date + '</b><br/>코스피 ' + number(p.kospiClose) +
            'P<br/>20일선 하락비율 ' + ratio + count + level;
        }
      },
      xAxis: {
        type: 'time',
        axisLabel: {color: '#697b71', hideOverlap: true,
          formatter: (value: number) => dayOf(value).slice(0, 7)},
        axisLine: {lineStyle: {color: '#c9d5cd'}}
      },
      yAxis: [
        {type: 'value', name: 'KOSPI (P)', nameTextStyle: {color: '#52645c'},
          scale: true, min: minPrice, max: maxPrice, axisLabel: {color: '#64776d'},
          splitLine: {lineStyle: {color: '#edf1ed'}}},
        {type: 'value', name: '하락비율', position: 'right', show: showRatio,
          min: 0, max: 100, axisLabel: {formatter: '{value}%', color: '#159d8f'},
          splitLine: {show: false}}
      ],
      dataZoom: [
        {type: 'inside', xAxisIndex: 0, filterMode: 'none',
          start: startPct, end: 100, minSpan: 0.05, zoomOnMouseWheel: true,
          moveOnMouseMove: true, moveOnMouseWheel: false},
        {type: 'slider', xAxisIndex: 0, filterMode: 'none',
          start: startPct, end: 100, minSpan: 0.05,
          height: 27, bottom: 16, showDetail: true, brushSelect: true,
          borderColor: '#d1ded5', fillerColor: 'rgba(43,123,82,0.16)',
          handleStyle: {color: '#277452', borderColor: '#277452'}}
      ],
      series: [
        shade(85, 90, 'rgba(228,93,75,0.14)'),
        shade(90, Infinity, 'rgba(228,93,75,0.28)'),
        {name: '코스피 종가', type: 'line', data: prices,
          showSymbol: false, sampling: 'lttb',
          lineStyle: {width: 1.9, color: '#2e7860'}, z: 3},
        ...(showRatio ? [{
          name: '20일선 하락비율', type: 'line', yAxisIndex: 1,
          data: percentages, connectNulls: false, showSymbol: false,
          sampling: 'lttb', lineStyle: {width: 1.2, color: '#159d8f', opacity: 0.65},
          z: 4,
          markLine: {silent: true, symbol: 'none', label: {show: false},
            data: [
              {yAxis: 85, lineStyle: {type: 'dashed', color: '#e99092', width: 1}},
              {yAxis: 90, lineStyle: {type: 'dashed', color: '#cb4555', width: 1}}
            ]}
        }] : [])
      ]
    };
    instance.setOption(option);

    // Refitting after a wheel/drag/slider change is essential: filterMode:none
    // otherwise retains the full-history Y axis and flattens recent movements.
    const fitVisible = () => {
      const zoom = (instance.getOption().dataZoom || [])[0] as
        {start?: number; end?: number} | undefined;
      const from = zoomIndex(Number(zoom?.start ?? 0), clean.length, 'floor');
      const to = Math.max(from, zoomIndex(Number(zoom?.end ?? 100), clean.length, 'ceil'));
      const [min, max] = visiblePriceBounds(clean, from, to);
      instance.setOption({yAxis: [{min, max}, {min: 0, max: 100}]} as EChartsCoreOption, {silent: true});
      const subset = clean.slice(from, to + 1);
      const next = {
        total: subset.length,
        warning: subset.filter(p => p.below20Pct !== null && p.below20Pct >= 85).length,
        severe: subset.filter(p => p.below20Pct !== null && p.below20Pct >= 90).length
      };
      setVisibleStats(previous => previous.total === next.total &&
        previous.warning === next.warning && previous.severe === next.severe ? previous : next);
    };
    const resize = () => {instance.resize(); fitVisible();};
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(host.current);
    instance.on('datazoom', fitVisible);
    fitVisible();
    return () => {
      observer?.disconnect();
      instance.off('datazoom', fitVisible);
      instance.dispose();
      if (chartRef.current === instance) chartRef.current = null;
    };
  }, [clean, showRatio, byDate]);

  useEffect(() => {
    const instance = chartRef.current;
    if (!instance || !clean.length) return;
    const first = periodStartIndex(clean, period);
    instance.dispatchAction({
      type: 'dataZoom', dataZoomIndex: 0,
      start: first / Math.max(1, clean.length - 1) * 100, end: 100
    });
  }, [period, clean, showRatio]);

  return <div className="market-breadth-chart">
    <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:10, margin:'4px 12px 6px'}}>
      <div style={{display:'flex', flexWrap:'wrap', gap:6}} role="group" aria-label="차트 조회 기간">
        {ranges.map(p => <button key={p.value} type="button" aria-pressed={period === p.value}
          onClick={() => setPeriod(p.value)}
          style={{font:'inherit', fontSize:12, padding:'7px 11px', borderRadius:7,
            border:'1px solid #d6e1d9', background: period === p.value ? '#215e47' : '#fff',
            color: period === p.value ? '#fff' : '#305c4a', cursor:'pointer'}}>
          {p.label}
        </button>)}
      </div>
      <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
        <span className="muted" style={{fontSize:12}}>
          {visibleStats.total.toLocaleString('ko-KR')}거래일 · 85% 이상 {visibleStats.warning}일 · 90% 이상 {visibleStats.severe}일
        </span>
        <button type="button" aria-pressed={showRatio} aria-label="하락비율 선 표시 전환"
          onClick={() => setShowRatio(v => !v)}
          style={{fontSize:12, padding:'5px 9px', border:'1px solid #d6e1d9', borderRadius:7,
            background: showRatio ? '#e8f2ed' : '#fff', color:'#305c4a'}}>
          {showRatio ? '하락비율 선 숨기기' : '하락비율 선 보기'}
        </button>
      </div>
    </div>
    <div style={{display:'flex', flexWrap:'wrap', gap:14, alignItems:'center', margin:'4px 14px 0',
      color:'#66776d', fontSize:11}}>
      <span><span aria-hidden="true" style={{display:'inline-block', width:17, height:3, background:'#2e7860', verticalAlign:'middle', marginRight:5}}/>코스피 종가</span>
      <span><span aria-hidden="true" style={{display:'inline-block', width:9, height:9, background:'rgba(228,93,75,0.24)', verticalAlign:'middle', marginRight:5}}/>85% 이상</span>
      <span><span aria-hidden="true" style={{display:'inline-block', width:9, height:9, background:'rgba(228,93,75,0.53)', verticalAlign:'middle', marginRight:5}}/>90% 이상</span>
    </div>
    {clean.length === 0 && <p className="muted">표시할 검증된 일별 데이터가 없습니다.</p>}
    <div ref={host} role="img" aria-label="코스피 종가와 20일선 하락비율 85% 및 90% 이상 구간의 세로 음영 차트"
      style={{width:'100%', height: clean.length ? 'min(65vh, ' + Math.max(390, height) + 'px)' : 0,
        minHeight: clean.length ? 390 : 0}}/>
    <p className="muted" style={{fontSize:11, color:'#748077', margin:'0 14px 8px'}}>
      휠: 확대·축소 · 드래그: 이동 · 하단 슬라이더: 조회 범위 조절
      <span style={{display:'block'}}>확대 시 화면에 표시된 코스피 최고·최저값에 맞춰 세로축이 자동 조정됩니다. 마우스를 올리면 당일 하락비율을 확인할 수 있습니다.</span>
    </p>
  </div>;
}
