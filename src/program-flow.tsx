import {useState} from 'react';
import type {Board,MarketDetails} from './market-details';
const minute=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(2));
const label=(t:string)=>t.slice(0,2)+':'+t.slice(2,4)+(t.length===6?':'+t.slice(4):'');
const fmt=(v:number|null|undefined,unit='억')=>v===null||v===undefined?'—':(v>0?'+':'')+v.toLocaleString('ko-KR',{maximumFractionDigits:2})+unit;
export default function ProgramFlow({details,board}:{details?:MarketDetails;board:Board}){
 const [delta,setDelta]=useState(false),[hover,setHover]=useState<string|null>(null),[visible,setVisible]=useState({netBuy:true,changePct:true});
 const feed=details?.programFlow,history=feed?.markets[board]||[];
 const points=history.map((p,i)=>({...p,netBuy:delta?(i>0&&minute(p.time)-minute(history[i-1].time)===5?p.netBuy-history[i-1].netBuy:null):p.netBuy}));
 const picked=points.find(p=>p.time===hover)||points.at(-1),amount=Math.max(1,...points.map(p=>Math.abs(p.netBuy||0)))*1.12,percent=Math.max(.1,...points.map(p=>Math.abs(p.changePct||0)))*1.12;
 const x=(t:string)=>64+(minute(t)-540)/435*632,y=(v:number,max:number)=>126-v/max*84;
 return <section className="flow-chart program-flow" aria-label="비차익 프로그램 흐름" style={{borderTop:'1px solid #dde7df',marginTop:20,paddingTop:18}}>
 <div className="flow-chart-heading"><div><span className="eyebrow">NON-ARBITRAGE · 5 MIN</span><h3>비차익 프로그램 흐름</h3></div><span className="muted">{board==='KOSPI'?'코스피':'코스닥'}</span></div>
 <div className="flow-chart-mode"><div className="flow-chart-tabs">{[false,true].map(d=><button key={String(d)} type="button" aria-pressed={d===delta} onClick={()=>setDelta(d)}>{d?'5분 변화량':'누적 순매수'}</button>)}</div><span>지수: 전일 종가 대비</span></div>
 <div className="flow-chart-readout" style={{flexWrap:'wrap'}} aria-live="polite"><span>{picked?label(picked.time):'수집 대기'}</span>{(['netBuy','changePct'] as const).map(k=><button type="button" key={k} aria-pressed={visible[k]} onClick={()=>setVisible(v=>({...v,[k]:!v[k]}))} style={{border:0,background:'transparent',font:'inherit',padding:'7px 0',cursor:'pointer',color:k==='netBuy'?'#df8250':'#173c32',opacity:visible[k]?1:.4}}>{k==='netBuy'?'비차익':'지수'} <b>{fmt(picked?.[k],k==='netBuy'?'억':'%')}</b></button>)}{picked?.sourceTime&&<span title="5분 기준 시각 이전의 가장 최근 실제 관측값">원본 {label(picked.sourceTime)}{picked.sourceAgeSeconds?' · '+picked.sourceAgeSeconds+'초 전':''}</span>}</div>
 {points.length?<svg viewBox="0 0 760 248" className="flow-chart-svg" role="group" aria-label={`${board} 비차익 ${delta?'5분 변화량':'누적 순매수'}와 지수`} onMouseLeave={()=>setHover(null)}>
 <text x="8" y="16">억원</text><text x="708" y="16">%</text>{[-1,-.5,0,.5,1].map(t=><g key={t}><line x1="64" x2="696" y1={y(t,1)} y2={y(t,1)} stroke={t===0?'#bccbc3':'#e6ede7'} strokeDasharray={t===0?undefined:'3 4'}/><text x="55" y={y(t,1)+4} textAnchor="end">{Math.round(t*amount).toLocaleString()}</text><text x="705" y={y(t,1)+4}>{(t*percent).toFixed(2)}</text></g>)}
 {(['netBuy','changePct'] as const).filter(k=>visible[k]).map(k=><g key={k}>{points.map((p,i)=>{const v=p[k],prev=points[i-1],pv=prev?.[k],max=k==='netBuy'?amount:percent,color=k==='netBuy'?'#df8250':'#173c32';return v===null?null:<g key={p.time}>{prev&&pv!==null&&pv!==undefined&&minute(p.time)-minute(prev.time)===5&&<line x1={x(prev.time)} x2={x(p.time)} y1={y(pv,max)} y2={y(v,max)} stroke={color} strokeWidth="2" strokeDasharray={k==='changePct'?'5 3':undefined}/>}<circle cx={x(p.time)} cy={y(v,max)} r={p.time===picked?.time?3:1.5} fill={color}/></g>;})}</g>)}
 {picked&&<line x1={x(picked.time)} x2={x(picked.time)} y1="33" y2="215" stroke="#95a99b" strokeDasharray="3 3"/>}{points.map(p=><rect key={p.time} x={x(p.time)-3.6} y="32" width="7.2" height="185" fill="transparent" tabIndex={0} role="button" aria-label={`${label(p.time)} 비차익 ${fmt(p.netBuy)} 지수 ${fmt(p.changePct,'%')}`} onMouseEnter={()=>setHover(p.time)} onFocus={()=>setHover(p.time)} onClick={()=>setHover(p.time)}/>)}
 {['0900','1100','1300','1530','1615'].map(t=><text key={t} x={x(t)} y="238" textAnchor="middle">{label(t)}</text>)}</svg>:<div className="flow-chart-empty" role="status">비차익 프로그램 데이터를 수집하고 있습니다.<small>확인된 5분 관측값부터 표시됩니다.</small></div>}
 {!!Object.keys(feed?.errors||{}).length&&<p className="flow-chart-note" role="status">비차익 수급 갱신 지연 · 마지막 정상 수집 값을 표시합니다.</p>}
 <p className="flow-chart-note">KRX 기준 · 비차익: 왼쪽 축(억원) · 점선 지수: 오른쪽 축(%)<br/>{delta?'각 5분 기준에 대응한 최신 관측값 간 차이입니다. 첫 관측·누락 구간은 계산하지 않습니다.':'당일 비차익 누적 순매수입니다. 각 5분 시각 이전의 최신 관측값을 사용하며, 5분 이상 오래된 값은 제외합니다.'}{feed?' · 갱신 '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(feed.asOf))+' KST':''}</p>
 </section>;
}
