import {useEffect,useState} from 'react';
import {API_URL} from './live';
import {validOHLC} from '../worker/index-ohlc.mjs';
type Point={date:string;kospi:number;changePct:number;individual:number;foreign:number;ohlc?:{open:number;high:number;low:number;close:number}};
const signed=(n:number)=>`${n>0?'+':''}${n.toLocaleString('ko-KR',{maximumFractionDigits:2})}`;
export function validatePutPoints(raw:any):Point[]{
 if(!Array.isArray(raw)||raw.length>365)throw Error('데이터 형식 오류');const seen=new Set();
 return raw.map(p=>{if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date+'T00:00:00Z'))||new Date(p.date+'T00:00:00Z').toISOString().slice(0,10)!==p.date||seen.has(p.date)||![p.kospi,p.changePct,p.individual,p.foreign].every(v=>typeof v==='number'&&Number.isFinite(v))||p.kospi<=0||p.kospi>1e7||Math.abs(p.changePct)>100||Math.max(Math.abs(p.individual),Math.abs(p.foreign))>1e10)throw Error('데이터 수치 오류');seen.add(p.date);const ohlc=validOHLC(p.ohlc,p.kospi);return {date:p.date,kospi:p.kospi,changePct:p.changePct,individual:p.individual,foreign:p.foreign,...(ohlc?{ohlc}:{})};}).sort((a,b)=>a.date.localeCompare(b.date));
}
export function PutKospiCharts({points}:{points:Point[]}){
 const [period,setPeriod]=useState(3),[picked,setPicked]=useState<string|null>(null),[visible,setVisible]=useState({individual:true,foreign:true});
 const latest=points.at(-1),cutoff=latest?new Date(latest.date+'T00:00:00Z'):new Date();cutoff.setUTCMonth(cutoff.getUTCMonth()-period);
 const rows=points.filter(p=>!period||p.date>=cutoff.toISOString().slice(0,10)),selected=rows.find(p=>p.date===picked)||rows.at(-1);
 const color={individual:'#df8250',foreign:'#3275d6'},names={individual:'개인',foreign:'외국인'};
 const W=760,L=70,R=28,end=W-R,step=(end-L)/Math.max(rows.length,1),x=(i:number)=>L+step*(i+.5),width=Math.max(1,Math.min(12,step*.55));
 const lows=rows.map(p=>p.ohlc?.low??p.kospi),highs=rows.map(p=>p.ohlc?.high??p.kospi),lo=Math.min(...lows),hi=Math.max(...highs),pad=Math.max((hi-lo)*.12,hi*.005),min=lo-pad,max=hi+pad;
 const priceY=(v:number)=>35+(max-v)/(max-min)*175;
 const keys=(['individual','foreign'] as const).filter(k=>visible[k]),amount=Math.max(1,...rows.flatMap(p=>keys.map(k=>Math.abs(p[k]))))*1.15,flowY=(v:number)=>332-v/amount*70;
 const selectedIndex=rows.findIndex(p=>p.date===selected?.date);
 const labels=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>v>=0&&a.indexOf(v)===i);
 return <><div className="flow-chart-mode" style={{flexWrap:'wrap',marginBottom:12}}><div className="flow-chart-tabs">{[[1,'1개월'],[3,'3개월'],[12,'1년'],[0,'전체']].map(([v,name])=><button type="button" key={v} aria-pressed={period===v} onClick={()=>{setPeriod(Number(v));setPicked(null);}}>{name}</button>)}</div><div className="flow-chart-tabs">{(['individual','foreign'] as const).map(k=><button type="button" key={k} aria-pressed={visible[k]} onClick={()=>setVisible(v=>({...v,[k]:!v[k]}))}>{names[k]} {visible[k]?'ON':'OFF'}</button>)}</div></div>
 {!selected?<p className="correlation-empty">아직 확보된 풋옵션 마감 기록이 없습니다. 개인·외국인 풋 수급과 코스피 종가가 함께 검증된 날짜부터 표시합니다.</p>:<>
 <div className="correlation-selection" role="status"><strong>{selected.date}</strong><span>코스피 {selected.kospi.toLocaleString('ko-KR')} ({signed(selected.changePct)}%)</span><span style={{color:color.individual}}>개인 풋 {signed(selected.individual)}억원</span><span style={{color:color.foreign}}>외국인 풋 {signed(selected.foreign)}억원</span></div>
 <svg viewBox={`0 0 ${W} 440`} className="correlation-svg" role="group" aria-label="코스피 일봉과 개인·외국인 풋옵션 일별 순매수 연동 차트" onMouseLeave={()=>setPicked(null)}>
 <text x={L} y="19">코스피 일봉 · 포인트</text><text x={L} y="242">풋옵션 순매수 · 억원</text>
 {[0,.5,1].map(t=>{const v=min+(max-min)*t;return <g key={t}><line x1={L} x2={end} y1={priceY(v)} y2={priceY(v)} stroke="#e6ede7"/><text x={L-9} y={priceY(v)+4} textAnchor="end">{Math.round(v).toLocaleString()}</text></g>;})}
 {[-1,0,1].map(t=><g key={t}><line x1={L} x2={end} y1={flowY(t*amount)} y2={flowY(t*amount)} stroke={t===0?'#aabbb0':'#e6ede7'}/><text x={L-9} y={flowY(t*amount)+4} textAnchor="end">{Math.round(t*amount).toLocaleString()}</text></g>)}
 {selectedIndex>=0&&<line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="28" y2="408" stroke="#92a69a" strokeDasharray="4 3"/>}
 {rows.map((p,i)=><g key={p.date}>{p.ohlc?<g stroke={p.ohlc.close>=p.ohlc.open?'#dc5555':'#3275d6'} fill={p.ohlc.close>=p.ohlc.open?'#dc5555':'#3275d6'}><line x1={x(i)} x2={x(i)} y1={priceY(p.ohlc.high)} y2={priceY(p.ohlc.low)}/><rect x={x(i)-width/2} y={Math.min(priceY(p.ohlc.open),priceY(p.ohlc.close))} width={width} height={Math.max(1,Math.abs(priceY(p.ohlc.open)-priceY(p.ohlc.close)))}/></g>:<circle cx={x(i)} cy={priceY(p.kospi)} r="3" fill="#173c32"/>}{keys.map((k,j)=>{const bw=Math.max(.6,Math.min(10,step*.32)),bx=x(i)+(j-(keys.length-1)/2)*(bw+1);return <rect key={k} x={bx-bw/2} y={Math.min(flowY(p[k]),flowY(0))} width={bw} height={Math.max(.5,Math.abs(flowY(p[k])-flowY(0)))} fill={color[k]}/>;})}<rect x={x(i)-step/2} y="28" width={step} height="380" fill="transparent" role="button" tabIndex={0} aria-label={`${p.date} 코스피 ${p.kospi}, 개인 풋 ${signed(p.individual)}억원, 외국인 풋 ${signed(p.foreign)}억원`} onMouseEnter={()=>setPicked(p.date)} onFocus={()=>setPicked(p.date)} onClick={()=>setPicked(p.date)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setPicked(p.date);}}}><title>{p.date} · 코스피 {p.kospi} · 개인 {signed(p.individual)}억 · 외국인 {signed(p.foreign)}억</title></rect></g>)}
 {labels.map(i=><text key={i} x={x(i)} y="430" textAnchor="middle">{rows[i].date.slice(5)}</text>)}
 </svg><p className="correlation-help">{rows[0]?.date} ~ {rows.at(-1)?.date} · {rows.length}거래일 · 일봉 {rows.filter(p=>p.ohlc).length}일. 시가·고가·저가가 없는 날은 종가 점으로 표시합니다.</p>

 </>}
 <p className="footnote">LS증권 · 풋옵션 금액 순매수(매수−매도). 동일 거래일 15:45~16:10에 확인한 마감 관측 자료를 사용합니다. 장중 값은 제외하며 누락 수급은 추정하지 않습니다. 순매수는 신규 포지션이나 보유 잔고를 뜻하지 않습니다.</p></>;
}
export default function PutKospiPanel(){
 const [open,setOpen]=useState(true),[points,setPoints]=useState<Point[]>([]),[status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!open)return;const controller=new AbortController();const load=async()=>{try{setStatus('마감 수급을 불러오는 중…');const r=await fetch(API_URL+'/api/put-kospi-daily',{credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!r.ok)throw Error();const data=await r.json();if(data.unit!=='억원')throw Error();const checked=validatePutPoints(data.points);if(!controller.signal.aborted){setPoints(checked);setStatus('');}}catch{if(!controller.signal.aborted)setStatus('마감 수급을 불러오지 못했습니다.');}};load();const timer=setInterval(load,300000);return()=>{controller.abort();clearInterval(timer);};},[open,retry]);
 return <section className="panel correlation-panel"><button type="button" className="correlation-toggle" aria-expanded={open} aria-controls="put-kospi-daily" onClick={()=>setOpen(v=>!v)}><span>개인·외국인 풋옵션 수급과 코스피 일봉</span><span aria-hidden="true">{open?'−':'+'}</span></button>{open&&<div id="put-kospi-daily">{status&&<p className="correlation-help" role="status">{status}{status.includes('못했습니다')&&<button className="text-link" onClick={()=>setRetry(v=>v+1)}>다시 시도</button>}</p>}{(!status||points.length>0)&&<PutKospiCharts points={points}/>}</div>}</section>;
}
