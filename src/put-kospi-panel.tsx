import {fetchPutDaily} from './put-kospi-load.mjs';
import {SignalPanel,signalChartStyle} from './signal-panel';
import {useEffect,useRef,useState} from 'react';
import * as echarts from 'echarts/core';
import {LineChart,BarChart} from 'echarts/charts';
import {GridComponent,LegendComponent,TooltipComponent,DataZoomComponent,ToolboxComponent,MarkAreaComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import type {EChartsType,EChartsCoreOption} from 'echarts/core';
import {putKospiOption,putVisibleBounds,putSeriesNames,putShadeMatch} from './put-kospi-options.mjs';
import {periodStartIndex} from './kospi-pension-signal-data.mjs';
echarts.use([LineChart,BarChart,GridComponent,LegendComponent,TooltipComponent,DataZoomComponent,ToolboxComponent,MarkAreaComponent,CanvasRenderer]);
import {API_URL} from './live';
import {validOHLC} from '../worker/index-ohlc.mjs';
type Point={date:string;kospi:number;changePct:number;individual:number;foreign:number;ohlc?:{open:number;high:number;low:number;close:number}};
const signed=(n:number)=>`${n>0?'+':''}${n.toLocaleString('ko-KR',{maximumFractionDigits:2})}`;
export function validatePutPoints(raw:any):Point[]{
 if(!Array.isArray(raw)||raw.length>2000)throw Error('데이터 형식 오류');const seen=new Set();
 return raw.map(p=>{if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date+'T00:00:00Z'))||new Date(p.date+'T00:00:00Z').toISOString().slice(0,10)!==p.date||seen.has(p.date)||![p.kospi,p.changePct,p.individual,p.foreign].every(v=>typeof v==='number'&&Number.isFinite(v))||p.kospi<=0||p.kospi>1e7||Math.abs(p.changePct)>100||Math.max(Math.abs(p.individual),Math.abs(p.foreign))>1e10)throw Error('데이터 수치 오류');seen.add(p.date);const ohlc=validOHLC(p.ohlc,p.kospi);return {date:p.date,kospi:p.kospi,changePct:p.changePct,individual:p.individual,foreign:p.foreign,...(ohlc?{ohlc}:{})};}).sort((a,b)=>a.date.localeCompare(b.date));
}
const cacheKey='marketnote:put-close:v1';
function cachedPutPoints():Point[]{try{const raw=localStorage.getItem(cacheKey);if(!raw||raw.length>1000000)return [];const data=JSON.parse(raw);return data.version===1&&data.unit==='억원'?validatePutPoints(data.points):[];}catch{return [];}}
export function PutKospiCharts({points}:{points:Point[]}){
 const host=useRef<HTMLDivElement>(null),chart=useRef<EChartsType|null>(null),periodRef=useRef('1Y'),selectedRef=useRef<Record<string,boolean>>({});
 const [period,setPeriod]=useState('1Y'),[picked,setPicked]=useState<string|null>(null),[visible,setVisible]=useState({individual:true,foreign:true});
 const selected=points.find(p=>p.date===picked)||points.at(-1),latest=points.at(-1)?.date||'';
 useEffect(()=>{
  if(!host.current||!points.length)return;
  const instance=echarts.init(host.current,undefined,{renderer:'canvas'});chart.current=instance;
  instance.setOption(putKospiOption(points,periodRef.current,selectedRef.current) as EChartsCoreOption);
  const fitVisible=()=>{const zoom=(instance.getOption().dataZoom||[])[0] as {start?:number;end?:number};const bounds=putVisibleBounds(points,Number(zoom?.start??0),Number(zoom?.end??100),selectedRef.current);instance.setOption({yAxis:[{min:bounds.price[0],max:bounds.price[1]},{min:bounds.flow[0],max:bounds.flow[1]}]} as EChartsCoreOption,{silent:true});};
  const legend=(event:{selected:Record<string,boolean>})=>{selectedRef.current=event.selected;setVisible({individual:event.selected[putSeriesNames.individual]!==false,foreign:event.selected[putSeriesNames.foreign]!==false});fitVisible();};
  const pointer=(event:{axesInfo?:{axisDim?:string;value?:number|string}[]})=>{const axis=event.axesInfo?.find(a=>a.axisDim==='x');if(!axis)return;const p=typeof axis.value==='string'?points.find(p=>p.date===axis.value):points[Math.round(Number(axis.value))];if(p)setPicked(p.date);};
  const choose=(event:{offsetX:number;offsetY:number})=>{if(!instance.containPixel('grid',[event.offsetX,event.offsetY]))return;const axis=instance.convertFromPixel({xAxisIndex:0},event.offsetX);const p=typeof axis==='string'?points.find(p=>p.date===axis):points[Math.round(Number(axis))];if(p)setPicked(p.date);};
  instance.on('datazoom',fitVisible);instance.on('legendselectchanged',legend);instance.on('updateAxisPointer',pointer);instance.getZr().on('click',choose);
  const resize=()=>{instance.resize();fitVisible();},observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(host.current);window.addEventListener('resize',resize);
  return()=>{observer?.disconnect();window.removeEventListener('resize',resize);instance.off('datazoom',fitVisible);instance.off('legendselectchanged',legend);instance.off('updateAxisPointer',pointer);instance.getZr().off('click',choose);instance.dispose();chart.current=null;};
 },[points]);
 useEffect(()=>{periodRef.current=period;const first=periodStartIndex(points,period);chart.current?.dispatchAction({type:'dataZoom',dataZoomIndex:0,start:first/Math.max(1,points.length-1)*100,end:100});},[period,points]);
 const toggle=(key:'individual'|'foreign')=>{const name=putSeriesNames[key],next=!visible[key];selectedRef.current={...selectedRef.current,[name]:next};setVisible(v=>({...v,[key]:next}));chart.current?.dispatchAction({type:next?'legendSelect':'legendUnSelect',name});const zoom=(chart.current?.getOption().dataZoom||[])[0] as {start?:number;end?:number};const bounds=putVisibleBounds(points,Number(zoom?.start??0),Number(zoom?.end??100),selectedRef.current);chart.current?.setOption({yAxis:[{min:bounds.price[0],max:bounds.price[1]},{min:bounds.flow[0],max:bounds.flow[1]}]} as EChartsCoreOption,{silent:true});};
 return <>
  <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:10,margin:'4px 12px 6px'}}>
   <div role="group" aria-label="차트 조회 기간" style={{display:'flex',flexWrap:'wrap',gap:6}}>{[['1M','1개월'],['3M','3개월'],['1Y','1년'],['5Y','5년'],['ALL','전체']].map(([value,label])=><button key={value} type="button" aria-pressed={period===value} onClick={()=>setPeriod(value)} style={{font:'inherit',fontSize:12,padding:'7px 11px',borderRadius:7,border:'1px solid #d6e1d9',background:period===value?'#215e47':'#fff',color:period===value?'#fff':'#305c4a',cursor:'pointer'}}>{label}</button>)}</div>
   <span style={{fontSize:12,color:'#637569'}}>{points.length.toLocaleString('ko-KR')}거래일 · 음영 {points.filter(putShadeMatch).length}일</span>
  </div>
  <p style={{fontSize:11,color:'#748077',margin:'4px 14px 8px'}}><span style={{background:'rgba(228,93,75,.18)',padding:'3px 5px',borderRadius:3}}>음영</span> 개인 풋 ≥ +50억원 · 외국인 풋 ≤ −50억원 · 두 조건 동시 충족</p>
  {points.length?<><div ref={host} role="img" aria-label="코스피 종가와 개인·외국인 풋옵션 마감 수급 차트, 휠 확대·축소 및 하단 슬라이더로 두 차트의 날짜 범위를 함께 조절" style={signalChartStyle}/>
   <section aria-live="polite" style={{margin:'8px 14px 16px',padding:14,border:'1px solid #d7e3db',borderRadius:10,background:'#f8fbf8',fontSize:12,color:'#52645c'}}>
    <strong style={{color:'#213f34'}}>{selected.date} · 코스피 {selected.kospi.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})}P ({signed(selected.changePct)}%)</strong>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:8}}>{(['individual','foreign'] as const).map(key=><button key={key} type="button" aria-pressed={visible[key]} onClick={()=>toggle(key)} style={{font:'inherit',border:0,background:'transparent',padding:'4px 0',color:key==='individual'?'#b96a3c':'#3275d6',cursor:'pointer',opacity:visible[key]?1:.4,textDecoration:visible[key]?'none':'line-through'}}>{key==='individual'?'개인':'외국인'} 풋 {signed(selected[key])}억원 · {visible[key]?'ON':'OFF'}</button>)}</div>
   </section></>:<p className="muted">아직 확보된 풋옵션 마감 기록이 없습니다.</p>}
  <p style={{fontSize:12,color:'#748077',margin:'0 14px 8px'}}>휠: 확대·축소 · 드래그: 차트 이동 · 우측 상단 영역 확대 도구 · 하단 슬라이더: 범위 조절<br/>두 차트의 날짜 범위를 함께 조절하며, 확대 시 보이는 구간에 맞춰 세로축을 자동으로 맞춥니다. 범례 또는 수급 금액 클릭: ON/OFF</p>
  <p style={{fontSize:11,color:'#748077',margin:'0 14px 12px'}}>원본: LS증권 일별 풋옵션 금액 순매수·코스피 종가 · {points[0]?.date||'—'} ~ {latest||'—'}<br/>장 마감 자료만 사용하며 누락 수급을 추정하지 않습니다. 순매수는 신규 포지션이나 보유 잔고를 뜻하지 않습니다.</p>
 </>;
}
export default function PutKospiPanel(){
 const [open,setOpen]=useState(false),[points,setPoints]=useState<Point[]>(cachedPutPoints),[status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!open)return;const controller=new AbortController();let running=false;
  const load=async()=>{if(running)return;running=true;setStatus('최신 마감 수급을 확인하는 중…');try{const raw=await fetchPutDaily(API_URL+'/api/put-kospi-daily',{signal:controller.signal});const checked=validatePutPoints(raw);if(!controller.signal.aborted){setPoints(previous=>JSON.stringify(previous)===JSON.stringify(checked)?previous:checked);try{localStorage.setItem(cacheKey,JSON.stringify({version:1,unit:'억원',points:checked}));}catch{}setStatus('');}}catch(error){if(!controller.signal.aborted)setStatus(error instanceof Error&&error.message==='PUT_REQUEST_TIMEOUT'?'수급 연결이 지연되고 있습니다. 다시 불러오기를 눌러 주세요.':'마감 수급을 불러오지 못했습니다. 마지막 정상 자료를 유지합니다.');}finally{running=false;}};
  void load();const timer=setInterval(()=>void load(),300000);return()=>{controller.abort();clearInterval(timer);};
 },[open,retry]);
 return <SignalPanel title="개인·외국인 풋옵션 수급과 코스피 종가" id="put-kospi-daily" open={open} onToggle={()=>setOpen(v=>!v)}>{status&&<p className="muted" role="status">{status}<button type="button" className="text-link" style={{marginLeft:8}} onClick={()=>setRetry(v=>v+1)}>다시 불러오기</button></p>}{(!status||points.length>0)&&<PutKospiCharts points={points}/>}</SignalPanel>;
}
