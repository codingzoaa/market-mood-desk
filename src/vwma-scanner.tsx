import {useEffect,useState} from 'react';
import {API_URL} from './live';
const frames=['1','5','60','240','D'];
const labels=['1분','5분','1시간','4시간','일봉'];
const colors=['#c64b50','#e6b454','#91c9a5','#25865e'];
const patterns=['전체','초기 반등','단기 전환','중기 전환','중장기 전환','상승 정렬','눌림목 회복','하락 정렬','혼합','데이터 부족','조회 대기'];
const format=(t?:string)=>t?new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
export default function VwmaScanner(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[mode,setMode]=useState('전체'),[minimum,setMinimum]=useState(500),[fresh,setFresh]=useState(false),[tick,setTick]=useState(Date.now());
 useEffect(()=>{let active=true;let controller:AbortController|undefined;
  async function load(){controller?.abort();controller=new AbortController();try{const r=await fetch(API_URL+'/api/vwma-scanner',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]),credentials:'omit',redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!Array.isArray(d.rows)||d.rows.length>20)throw Error('형식 오류');if(active){setData(d);setError('');setTick(Date.now());}}catch(e){if(active)setError('검색기 연결 실패 · 마지막 저장값은 실시간 신호가 아닙니다.');}}
  load();const id=setInterval(load,60000);return()=>{active=false;controller?.abort();clearInterval(id);};
 },[]);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(tick));
 const recent=(row:any)=>{const t=Date.parse(row.frames?.['1']?.crossAt||'');return !error&&data?.date===today&&Number.isFinite(t)&&tick>=t&&tick-t<300000;};
 const rows=(data?.rows||[]).filter((r:any)=>r.turnoverKRW>=minimum*1e8&&(mode==='전체'||r.pattern===mode)&&(!fresh||recent(r)));
 return <section className="panel" aria-label="거가중 100선 검색기">
  <div className="section-title"><div><span className="eyebrow">MTF VWMA 100 · PILOT</span><h2>거가중 추세 전환 검색기</h2></div><span className="muted">{format(data?.asOf)} KST</span></div>
  <p className="footnote">KRX 거래대금 상위 20종목 순환 조회 · ETF/ETN 제외 · 5분 수집 슬롯당 최대 5종목 · 종목별 조회시각 확인</p>
  <div className="filters" style={{display:'flex',flexWrap:'wrap',gap:8}}>
   <select aria-label="추세 유형" value={mode} onChange={e=>setMode(e.target.value)}>{patterns.map(x=><option key={x}>{x}</option>)}</select>
   <select aria-label="최소 거래대금" value={minimum} onChange={e=>setMinimum(Number(e.target.value))}>{[0,100,500,1000].map(x=><option key={x} value={x}>{x?x+'억원 이상':'거래대금 전체'}</option>)}</select>
   <label><input type="checkbox" checked={fresh} onChange={e=>setFresh(e.target.checked)}/> 최근 5분 내 1분봉 상향 돌파</label>
  </div>
  {error&&<p role="alert" className="negative">{error}</p>}
  {data?.date&&data.date!==today&&<p role="status" className="muted">지난 거래일 저장값 ({data.date}) · 실시간 아님</p>}
  <p className="footnote">조회 {data?.rows?.filter((r:any)=>r.checkedAt).length||0}/{data?.candidateCount||0} · 표시 {rows.length}종목 · 진초록 상회/확대 · 연초록 상회/축소 · 노랑 하회/회복 · 빨강 하회/약화 · 회색 미확인</p>
  <div className="table-scroll"><table><thead><tr><th>종목 / 거래대금</th>{labels.map(x=><th key={x}>{x}</th>)}<th>유형</th><th>1분 돌파</th><th>조회 시각</th></tr></thead><tbody>
   {rows.map((r:any)=><tr key={r.symbol}><td><a href={'https://finance.naver.com/item/main.naver?code='+r.symbol} target="_blank" rel="noopener noreferrer">{r.name}</a><br/><small>{r.sector} · {Math.round(r.turnoverKRW/1e8).toLocaleString()}억</small></td>
   {frames.map(f=>{const v=r.frames?.[f];return <td key={f}><span title={v?'봉 시각 '+format(v.barAt)+' · VWMA '+v.vwma.toFixed(2):r.errors?.[f]||'조회 대기'} style={{display:'inline-block',minWidth:52,padding:'5px 6px',borderRadius:4,textAlign:'center',background:v?colors[v.state]:'#e5e7eb',color:v&&(v.state===0||v.state===3)?'white':'#17202a'}}>{v?((v.gap>=0?'+':'')+v.gap.toFixed(2)+'%'):'—'}</span></td>;})}
   <td>{r.pattern}</td><td>{format(r.frames?.['1']?.crossAt)}{recent(r)&&<strong> NEW</strong>}</td><td>{format(r.checkedAt)}{r.checkedAt&&tick-Date.parse(r.checkedAt)>600000&&<small> · 지연</small>}</td></tr>)}
   {!rows.length&&<tr><td colSpan={9}>{data?'조건에 맞는 저장 결과 없음':'첫 검색 데이터 대기'}</td></tr>}
  </tbody></table></div>
  <p className="footnote">일봉은 전 거래일 확정 종가, 분봉은 최신 당일 봉을 보수적으로 제외합니다. LS 봉 시각/4시간 지원은 운영 확인 전이며 회색은 하락으로 간주하지 않습니다. 순환 수집은 1분 실시간 스캔이 아닙니다.</p>
 </section>;
}
