import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, MarkAreaComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer]);

export type MarketBreadthPoint = {
  date: string; // YYYY-MM-DD (KST trading date)
  kospiClose: number;
  below20Pct: number | null; // 0~100; missing measurements MUST be null
  validStockCount?: number;
};
export type MarketBreadthChartProps = {
  rows: MarketBreadthPoint[];
  height?: number;
  /** ISO date; ignores later observations when viewing a selected historical date */
  asOf?: string;
};

/** Inclusive trading-day regimes. On a UTC timestamp axis, each event-day ends at the next observation's timestamp. */
export function thresholdRanges(rows: MarketBreadthPoint[], threshold: number): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let start: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const point = rows[i];
    const current = Date.parse(`${point.date}T00:00:00Z`);
    const active = point.below20Pct !== null && Number.isFinite(point.below20Pct) && point.below20Pct >= threshold;
    if (active && start === null) start = current;
    const following = rows[i + 1];
    const nextActive = !!following && following.below20Pct !== null && Number.isFinite(following.below20Pct) && following.below20Pct >= threshold;
    if (start !== null && (!nextActive || i === rows.length - 1)) {
      const end = following ? Date.parse(`${following.date}T00:00:00Z`) : current + 86_400_000;
      result.push([start, end]);
      start = null;
    }
  }
  return result;
}

const formatDay = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

export default function MarketBreadthChart({ rows, height = 480, asOf }: MarketBreadthChartProps) {
  const [period, setPeriod] = useState<'1M'|'3M'|'1Y'|'5Y'>('1Y');
  const el = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => chart.resize()) : null;
    observer?.observe(el.current);
    return () => { observer?.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (clean.length === 0) { chart.clear(); return; }
    const points = clean.map(p => [toTime(p.date), p.kospiClose]);
    const breadth = clean.map(p => [toTime(p.date), p.below20Pct]);
    const band = (threshold: number, color: string) => ({
      silent: true,
      label: { show: false },
      itemStyle: { color, borderWidth: 0 },
      data: thresholdRanges(clean, threshold).map(([start, end]) => [
        { xAxis: start }, { xAxis: end }
      ])
    });
    const latest = toTime(clean[clean.length - 1].date);
    const startDate = new Date(latest);
    if (period === '1M') startDate.setUTCMonth(startDate.getUTCMonth() - 1);
    else if (period === '3M') startDate.setUTCMonth(startDate.getUTCMonth() - 3);
    else if (period === '1Y') startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
    else startDate.setUTCFullYear(startDate.getUTCFullYear() - 5);
    const startTime = Math.max(toTime(clean[0].date), startDate.getTime());
    const option: EChartsCoreOption = {
      animation: false,
      color: ['#3474ed', '#159d8f'],
      grid: { top: 68, left: 68, right: 65, bottom: 92, containLabel: false },
      legend: { top: 12, data: ['KOSPI', '20일선 하락비율'] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params as Array<{ data?: [number, number | null]; seriesName?: string; marker?: string }> : [];
          const t = items[0]?.data?.[0];
          if (t === undefined) return '';
          const row = clean.find(p => p.date === formatDay(t));
          const k = row?.kospiClose.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) ?? '—';
          const b = row?.below20Pct == null ? '결측' : `${row.below20Pct.toFixed(1)}%`;
          const n = row?.validStockCount === undefined ? '' : `<br/>유효 종목: ${row.validStockCount.toLocaleString('ko-KR')}개`;
          return `${formatDay(t)}<br/>KOSPI: ${k}<br/>20일선 하락비율: ${b}${n}`;
        }
      },
      xAxis: { type: 'time', axisLabel: { formatter: (v: number) => formatDay(v).slice(2) }, axisLine: { lineStyle: { color: '#b7c1bd' } } },
      yAxis: [
        { type: 'value', scale: true, position: 'left', name: 'KOSPI', axisLabel: { color: '#3474ed' }, splitLine: { lineStyle: { color: '#edf0ed' } } },
        { type: 'value', min: 0, max: 100, position: 'right', name: '하락비율', axisLabel: { formatter: '{value}%' }, splitLine: { show: false } }
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0], filterMode: 'none' },
        { type: 'slider', xAxisIndex: [0], filterMode: 'none', height: 26, bottom: 23, showDetail: false, startValue: startTime, endValue: latest }
      ],
      series: [
        { name: '85% 이상 음영', type: 'line', yAxisIndex: 1, data: breadth, symbol: 'none', showSymbol: false, lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 }, silent: true, tooltip: { show: false }, markArea: band(85, 'rgba(236,116,122,0.13)'), z: 0 },
        { name: '90% 이상 음영', type: 'line', yAxisIndex: 1, data: breadth, symbol: 'none', showSymbol: false, lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 }, silent: true, tooltip: { show: false }, markArea: band(90, 'rgba(202,35,64,0.23)'), z: 1 },
        { name: 'KOSPI', type: 'line', yAxisIndex: 0, data: points, showSymbol: false, lineStyle: { width: 2, color: '#3474ed' }, z: 4 },
        { name: '20일선 하락비율', type: 'line', yAxisIndex: 1, data: breadth, showSymbol: false, connectNulls: false, lineStyle: { width: 2, color: '#159d8f' }, z: 5,
          markLine: { silent: true, symbol: 'none', label: { position: 'insideEndTop', formatter: ({ value }: { value?: number | string }) => `${value}%` }, data: [ { yAxis: 85, lineStyle: { type: 'dashed', color: '#e99092', width: 1 } }, { yAxis: 90, lineStyle: { type: 'dashed', color: '#cb4555', width: 1 } } ] } }
      ]
    };
    chart.setOption(option, { notMerge: true });
  }, [clean, period]);

  return <section className="panel market-breadth-panel" aria-label="코스피 20일선 하락비율">
    <div className="section-title"><div><span className="eyebrow">MARKET BREADTH</span><h2>코스피와 20일선 하락비율</h2></div><span className="muted">85% 주의 · 90% 극단적 과매도</span></div>
    <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:12}} role="group" aria-label="차트 조회 기간">
      {(['1M','3M','1Y','5Y'] as const).map(key => <button
        key={key}
        type="button"
        aria-pressed={period === key}
        onClick={() => setPeriod(key)}
        style={{padding:'6px 12px',border:'1px solid var(--line)',borderRadius:8,
          background: period === key ? 'var(--forest)' : 'var(--paper)',
          color: period === key ? '#fff' : 'var(--ink)',fontSize:12,fontWeight:period === key ? 700 : 400}}
      >{{'1M':'1개월','3M':'3개월','1Y':'1년','5Y':'5년'}[key]}</button>)}
      <span className="muted" style={{fontSize:12,marginLeft:8}}>차트 내부 휠·드래그 및 하단 슬라이더로 확대·축소</span>
    </div>
    {clean.length === 0 && <p className="muted">표시할 검증된 일별 데이터가 없습니다.</p>}
    <div ref={el} style={{ width: '100%', height: clean.length ? height : 0, minHeight: clean.length ? 280 : 0 }} role="img" aria-label="코스피 지수 및 20일선 하락비율 시계열 차트: 마우스 툴팁과 날짜 확대 축소 지원" />
    <p className="muted" style={{ fontSize: 12 }}>빨간 음영은 85% 이상(연한 색), 90% 이상(진한 색)인 거래일을 의미합니다. 현재 표시는 잠정 지표이며 원본 수정주가·종목 분류 검증이 완료되지 않았습니다.</p>
  </section>;
}
