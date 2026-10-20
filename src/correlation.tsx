import {useEffect,useState} from 'react';
import {validOHLC} from '../worker/index-ohlc.mjs';
import {API_URL} from './live';
export type IndexOHLC={open:number;high:number;low:number;close:number};
export type ClosePoint={ohlc?:IndexOHLC;ohlcSource?:string;ohlcAsOf?:string;date:string;kospi:number;changePct:number;individual:number;recoveredAt?:string;source?:'NAVER'|'LS_HISTORY'};
export function validateClosePoints(raw:any):ClosePoint[]{
 if(!Array.isArray(raw)||raw.length>365)throw Error('상관관계 데이터 형식 오류');
 const seen=new Set<string>();return raw.map(p=>{if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||seen.has(p.date)||!Number.isFinite(Date.parse(p.date+'T00:00:00Z'))||new Date(p.date+'T00:00:00Z').toISOString().slice(0,10)!==p.date||typeof p.kospi!=='number'||!Number.isFinite(p.kospi)||p.kospi<=0||p.kospi>1e7||typeof p.changePct!=='number'||!Number.isFinite(p.changePct)||Math.abs(p.changePct)>100||typeof p.individual!=='number'||!Number.isFinite(p.individual)||Math.abs(p.individual)>1e10)throw Error('상관관계 수치 오류');seen.add(p.date);if(p.recoveredAt!==undefined&&(typeof p.recoveredAt!=='string'||!Number.isFinite(Date.parse(p.recoveredAt))||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(p.recoveredAt))!==p.date))throw Error('상관관계 보충 시각 오류');const ohlc=validOHLC(p.ohlc,p.kospi);return {...(ohlc?{ohlc,...(typeof p.ohlcSource==='string'?{ohlcSource:p.ohlcSource.slice(0,150)}:{}),...(typeof p.ohlcAsOf==='string'&&Number.isFinite(Date.parse(p.ohlcAsOf))?{ohlcAsOf:p.ohlcAsOf}:{})}:{}),date:p.date,kospi:p.kospi,changePct:p.changePct,individual:p.individual,...(p.recoveredAt?{recoveredAt:p.recoveredAt}:{}),...(['NAVER','LS_HISTORY'].includes(p.source)?{source:p.source as 'NAVER'|'LS_HISTORY'}:{})};}).sort((a,b)=>a.date.localeCompare(b.date));
}
export function correlationStats(points:ClosePoint[]){
 const n=points.length;if(n<2)return null;const mx=points.reduce((s,p)=>s+p.changePct,0)/n,my=points.reduce((s,p)=>s+p.individual/10000,0)/n;let xx=0,yy=0,xy=0;for(const p of points){const x=p.changePct-mx,y=p.individual/10000-my;xx+=x*x;yy+=y*y;xy+=x*y;}return xx>0&&yy>0?{r:xy/Math.sqrt(xx*yy),slope:xy/xx,intercept:my-xy/xx*mx}:null;
}
const signed=(n:number,d=2)=>(n>0?'+':'')+n.toLocaleString('ko-KR',{maximumFractionDigits:d});
const short=(date:string)=>date.slice(5).replace('-','/');
export function CorrelationCharts({points}:{points:ClosePoint[]}){
 const [picked,setPicked]=useState<string|null>(null);const selected=points.find(p=>p.date===picked)||points.at(-1);if(!selected)return <p className="correlation-empty">아직 장 마감 데이터가 없습니다. 장 마감 후 확인한 코스피 지수와 개인 수급이 함께 있는 날짜부터 점이 쌓입니다.</p>;
 const stats=correlationStats(points),W=600,H=330,L=62,R=22,T=24,B=48,pw=W-L-R,ph=H-T-B;
 const xr=Math.max(1,...points.map(p=>Math.abs(p.changePct)))*1.15,yr=Math.max(.1,...points.map(p=>Math.abs(p.individual/10000)))*1.15;
 const sx=(v:number)=>L+(v+xr)/(2*xr)*pw,sy=(v:number)=>T+(yr-v)/(2*yr)*ph;
 const candleCount=points.filter(p=>p.ohlc).length;
 const min=Math.min(...points.map(p=>p.ohlc?.low??p.kospi)),max=Math.max(...points.map(p=>p.ohlc?.high??p.kospi)),pad=Math.max((max-min)*.12,max*.005),low=min-pad,high=max+pad;
 const tx=(i:number)=>L+(i+.5)/points.length*pw,ty=(v:number)=>T+(high-v)/(high-low)*ph;
 const candleWidth=Math.max(1,Math.min(22,pw/points.length*.6));
 const selectedIndex=points.indexOf(selected);const color=(p:ClosePoint)=>p.changePct>0&&p.individual>0?'#e7863a':p.changePct<0&&p.individual<0?'#e8b518':'#899db7';
 const choose=(p:ClosePoint)=>setPicked(p.date);
 return <><div className="correlation-meta"><span>최근 {points.length}거래일 · 코스피 개인 수급</span><strong>{stats?'상관계수 r = '+stats.r.toFixed(2):'상관계수: 표본 부족'}</strong></div><p className="correlation-help">점을 누르면 아래 코스피 차트에서 같은 날짜를 보여줍니다.</p>
 <svg viewBox={`0 0 ${W} ${H}`} className="correlation-svg" role="group" aria-label="개인 순매수와 코스피 일간 등락률 산점도">
 <defs><clipPath id="correlation-plot"><rect x={L} y={T} width={pw} height={ph}/></clipPath></defs>
 {[0,1,2,3,4].map(i=>{const x=-xr+i*xr/2,y=-yr+i*yr/2;return <g key={i}><line x1={sx(x)} x2={sx(x)} y1={T} y2={H-B} stroke="#e6ebef"/><line x1={L} x2={W-R} y1={sy(y)} y2={sy(y)} stroke="#e6ebef"/><text x={sx(x)} y={H-B+19} textAnchor="middle">{signed(x,1)}</text><text x={L-8} y={sy(y)+4} textAnchor="end">{signed(y,2)}</text></g>;})}
 <line x1={sx(0)} x2={sx(0)} y1={T} y2={H-B} stroke="#919da9"/><line x1={L} x2={W-R} y1={sy(0)} y2={sy(0)} stroke="#919da9"/>
 <text x={L} y={14}>개인 순매수 (조원)</text><text x={W-R} y={H-7} textAnchor="end">코스피 일간 등락률 (%)</text>
 {stats&&<line clipPath="url(#correlation-plot)" x1={sx(-xr)} x2={sx(xr)} y1={sy(stats.intercept-stats.slope*xr)} y2={sy(stats.intercept+stats.slope*xr)} stroke="#3977e8" strokeWidth="2" strokeDasharray="3 4"/>}
 {points.map(p=><g key={p.date} role="button" tabIndex={0} aria-label={`${p.date} 코스피 ${signed(p.changePct)}%, 개인 ${signed(p.individual,0)}억원`} aria-pressed={p.date===selected.date} onClick={()=>choose(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(p);}}}><title>{p.date} · {signed(p.changePct)}% · {signed(p.individual,0)}억원</title><circle cx={sx(p.changePct)} cy={sy(p.individual/10000)} r="12" fill="transparent"/><circle cx={sx(p.changePct)} cy={sy(p.individual/10000)} r={p.date===selected.date?6:4} fill={color(p)} stroke={p.date===selected.date?'#172f46':'#62798e'} strokeWidth={p.date===selected.date?2:1}/></g>)}
 <text x={Math.max(L+22,Math.min(W-R-22,sx(selected.changePct)))} y={Math.max(T+12,sy(selected.individual/10000)-12)} textAnchor="middle" className="correlation-selected-label">{short(selected.date)}</text>
 </svg>
 <div className="correlation-selection" role="status"><strong>{selected.date}</strong><span>코스피 {selected.kospi.toLocaleString('ko-KR',{maximumFractionDigits:2})} <b className={selected.changePct>=0?'flow-positive':'flow-negative'}>{signed(selected.changePct)}%</b></span><span>개인 {signed(selected.individual,0)}억원</span><span>출처: {selected.source==='NAVER'?'네이버 금융':selected.source==='LS_HISTORY'?'LS증권 · 과거 조회':'LS증권'}</span>{selected.ohlc&&<span className="correlation-ohlc">시가 {selected.ohlc.open.toLocaleString('ko-KR')} · 고가 {selected.ohlc.high.toLocaleString('ko-KR')} · 저가 {selected.ohlc.low.toLocaleString('ko-KR')} · 종가 {selected.ohlc.close.toLocaleString('ko-KR')}</span>}{selected.ohlcSource&&<span>일봉 출처: {selected.ohlcSource}</span>}{!selected.ohlc&&<span>시가·고가·저가 미확보 · 종가만 표시</span>}{selected.recoveredAt&&<span>마감 후 보충 · {new Date(selected.recoveredAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})} 조회</span>}</div>
 <svg viewBox={`0 0 ${W} ${H}`} className="correlation-svg kospi-history" role="group" aria-label="선택 날짜가 표시된 코스피 일봉·종가 차트">
 <text x={L} y={14}>코스피 일봉 · 종가</text>
 {[0,1,2,3,4].map(i=>{const v=low+(high-low)*i/4;return <g key={i}><line x1={L} x2={W-R} y1={ty(v)} y2={ty(v)} stroke="#e6ebef"/><text x={L-8} y={ty(v)+4} textAnchor="end">{Math.round(v).toLocaleString('ko-KR')}</text></g>;})}
 <path d={points.map((p,i)=>(i?'L':'M')+tx(i)+','+ty(p.kospi)).join(' ')} fill="none" stroke="#8998a6" strokeWidth="1.5" strokeDasharray={candleCount?"3 3":undefined}/>
 <line x1={tx(selectedIndex)} x2={tx(selectedIndex)} y1={T} y2={H-B} stroke="#26876d" strokeDasharray="4 4"/>
 {points.map((p,i)=>{const c=p.ohlc,active=p.date===selected.date,tone=c?(c.close>c.open?'#eb4052':c.close<c.open?'#326fe4':'#64748b'):'#8998a6';return <g key={p.date} data-date={p.date} data-candle={c?'true':'false'} role="button" tabIndex={0} aria-label={`${p.date} 코스피 종가 ${p.kospi}${c?`, 시가 ${c.open}, 고가 ${c.high}, 저가 ${c.low}`:', OHLC 미확보'}`} aria-pressed={active} onClick={()=>choose(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(p);}}}>
 <title>{p.date} · 종가 {p.kospi}{c?` · 시가 ${c.open} · 고가 ${c.high} · 저가 ${c.low}`:' · 종가만 확보'}</title>
 {active&&<rect x={tx(i)-candleWidth/2-4} y={T} width={candleWidth+8} height={ph} fill="#26876d" opacity="0.09"/>}
 {c?<><line className="candle-wick" x1={tx(i)} x2={tx(i)} y1={ty(c.high)} y2={ty(c.low)} stroke={tone} strokeWidth={active?2.5:1.5}/><rect className="candle-body" x={tx(i)-candleWidth/2} y={Math.min(ty(c.open),ty(c.close))} width={candleWidth} height={Math.max(1.5,Math.abs(ty(c.open)-ty(c.close)))} fill={tone} stroke={active?'#172f46':tone} strokeWidth={active?2:1}/></>:<circle data-date={p.date} cx={tx(i)} cy={ty(p.kospi)} r={active?6:3} fill={tone} stroke={active?'#172f46':tone}/>}
 <rect x={tx(i)-Math.max(12,candleWidth/2)} y={T} width={Math.max(24,candleWidth)} height={ph} fill="transparent"/>
 </g>;})}
 {[0,Math.floor((points.length-1)/2),points.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=><text key={i} x={tx(i)} y={H-B+20} textAnchor="middle">{short(points[i].date)}</text>)}
 <text x={tx(selectedIndex)} y={Math.max(T+12,ty(selected.kospi)-13)} textAnchor="middle" className="correlation-selected-label">{short(selected.date)}</text>
 </svg><p className="correlation-help">일봉 {candleCount}일 · 종가만 {points.length-candleCount}일. 빨강은 시가 대비 상승, 파랑은 하락, 회색은 보합입니다. OHLC가 없는 날은 종가 점으로 표시합니다.</p><div className="correlation-legend"><span><i style={{background:'#e7863a'}}/>상승 · 개인 순매수</span><span><i style={{background:'#e8b518'}}/>하락 · 개인 순매도</span><span><i style={{background:'#899db7'}}/>그 외</span></div><p className="footnote">KRX 정규장 마감 기록과 검증된 과거 일봉을 표시합니다. 점 하나는 한 거래일이며 개인 수급은 코스피 현물 기준입니다. 점선은 선형 추세선입니다. 상관관계는 인과관계를 뜻하지 않습니다.</p></>;
}
export default function Correlation(){
 const [open,setOpen]=useState(false),[points,setPoints]=useState<ClosePoint[]>([]),[status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!open)return;const abort=new AbortController();const load=async()=>{setStatus('장 마감 기록을 불러오는 중…');try{const response=await fetch(API_URL+'/api/correlation',{credentials:'omit',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(12000)]),redirect:'error'});if(!response.ok)throw Error();const text=await response.text();if(text.length>150000)throw Error();const raw=JSON.parse(text);const data=validateClosePoints(raw.points);if(!abort.signal.aborted){setPoints(data);setStatus('');}}catch{if(!abort.signal.aborted)setStatus('장 마감 기록을 불러오지 못했습니다.');}};load();const timer=setInterval(load,300000);return()=>{abort.abort();clearInterval(timer);};},[open,retry]);
 return <section className="panel correlation-panel"><button className="correlation-toggle" aria-expanded={open} aria-controls="individual-correlation" onClick={()=>setOpen(v=>!v)}><span>개인 수급과 코스피 등락률 상관관계</span><span aria-hidden="true">{open?'−':'+'}</span></button>{open&&<div id="individual-correlation">{status&&<p role="status" className="correlation-help">{status}{status.includes('못했습니다')&&<button className="text-link" onClick={()=>setRetry(v=>v+1)}>다시 시도</button>}</p>}{(!status||points.length>0)&&<CorrelationCharts points={points}/>}</div>}</section>;
}
