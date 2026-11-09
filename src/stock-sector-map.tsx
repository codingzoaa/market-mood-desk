'use client';
import {useEffect,useId,useMemo,useState} from 'react';
import {API_URL} from './live';
import {Search,Layers3,ListFilter,ChevronDown} from 'lucide-react';
import {combinedStockMap,STOCK_MAP,type StockMapEntry} from './stock-map';

type Mode='stocks'|'sectors';

const uniq=(xs:string[])=>[...new Set(xs)].sort((a,b)=>a.localeCompare(b,'ko'));
const normalize=(v:string)=>v.trim().toLowerCase();
const businessSources=new Set(['www.samsungcnt.com','www.sk-inc.co.kr','seojinsystem.net','www.lunit.io','www.sketernix.com','lsholdings.co.kr','www.oci-holdings.co.kr','www.lginnotek.com']);
function businessSource(url?:string){try{const u=new URL(url||'');return u.protocol==='https:'&&businessSources.has(u.hostname)?u.href:null;}catch{return null;}}


export default function StockSectorMap({discovered=[]}:{discovered?:StockMapEntry[]}){
 const [remote,setRemote]=useState<StockMapEntry[]>([]),[registryError,setRegistryError]=useState(false),[checkedAt,setCheckedAt]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  const refresh=async()=>{try{
   const response=await fetch(API_URL+'/api/stock-map',{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([ctrl.signal,AbortSignal.timeout(12000)])});
   if(!response.ok)throw Error('registry');const body=await response.json();
   if(body.version!==1||!Array.isArray(body.entries)||body.entries.length>5000)throw Error('registry schema');
   if(!ctrl.signal.aborted){setRemote(body.entries);setCheckedAt(typeof body.verification?.checkedAt==='string'?body.verification.checkedAt:'');setRegistryError(false);}
  }catch{if(!ctrl.signal.aborted)setRegistryError(true);}};
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};void refresh();const timer=window.setInterval(refresh,300000);document.addEventListener('visibilitychange',visible);
  return()=>{ctrl.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const registry=useMemo(()=>combinedStockMap([...discovered,...remote]),[discovered,remote]);
 const autoVerified=registry.filter(x=>x.verification?.status==='verified').length;
 const pending=registry.filter(x=>x.reviewRequired||/분류\s*대기|검토|미분류/.test(x.sector)).length;
 const [mode,setMode]=useState<Mode>('stocks');
 const [query,setQuery]=useState('');
 const [sector,setSector]=useState('ALL');
 const [subSector,setSubSector]=useState('ALL');
 const groupId=useId();
 const [closedSectors,setClosedSectors]=useState<Set<string>>(()=>new Set());
 const [closedSubs,setClosedSubs]=useState<Set<string>>(()=>new Set());
 const toggle=(setter:React.Dispatch<React.SetStateAction<Set<string>>>,key:string)=>setter(old=>{const next=new Set(old);next.has(key)?next.delete(key):next.add(key);return next;});

 const sectors=useMemo(()=>uniq(registry.map(x=>x.sector)),[registry]);
 const subSectors=useMemo(()=>uniq(registry.filter(x=>sector==='ALL'||x.sector===sector).map(x=>x.subSector)),[sector,registry]);
 const filtered=useMemo(()=>{
  const q=normalize(query);
  return registry.filter(x=>{
   if(sector!=='ALL'&&x.sector!==sector)return false;
   if(subSector!=='ALL'&&x.subSector!==subSector)return false;
   if(!q)return true;
   return normalize([x.name,x.symbol,x.market,x.sector,x.subSector,...x.themes].join(' ')).includes(q);
  }).sort((a,b)=>a.sector.localeCompare(b.sector,'ko')||a.subSector.localeCompare(b.subSector,'ko')||a.name.localeCompare(b.name,'ko'));
 },[query,sector,subSector,registry]);

 const grouped=useMemo(()=>{
  const map=new Map<string,Map<string,StockMapEntry[]>>();
  for(const item of filtered){
   if(!map.has(item.sector))map.set(item.sector,new Map());
   const subs=map.get(item.sector)!;
   if(!subs.has(item.subSector))subs.set(item.subSector,[]);
   subs.get(item.subSector)!.push(item);
  }
  return [...map.entries()];
 },[filtered]);

 const resetSub=(next:string)=>{setSector(next);setSubSector('ALL');};

 return <section className="sector-map-page" aria-label="종목 섹터맵">
  <div className="sector-map-summary">
   <div><span className="eyebrow">STOCK SECTOR MAP</span><h2>종목과 섹터 분류 기준</h2><p>기존 {STOCK_MAP.length}종목의 분류 체계를 기준으로 대분류 · 세부섹터 · 투자 테마를 정리합니다. 추가 종목은 거래소 사업·제품과 기업 공식 자료를 확인해 같은 체계에 연결합니다.</p></div>
   <div className="sector-map-count"><strong>{filtered.length}</strong><span>/ {registry.length} 종목</span></div>
  </div>

  <p className="muted" role="status" style={{fontSize:11,margin:'0 0 14px'}}>기존 분류 {STOCK_MAP.length}종목 · 동일 체계 추가 분류 {autoVerified}종목 · 검토 대기 {pending}종목{checkedAt&&Number.isFinite(Date.parse(checkedAt))&&` · 확인 ${new Date(checkedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`}{registryError&&' · 자동 분류 연결 지연, 마지막 정상 분류 표시'}</p>
  <div className="panel sector-map-controls">
   <div className="stock-scope-tabs" aria-label="섹터맵 보기 방식">
    <button className={mode==='stocks'?'active':''} aria-pressed={mode==='stocks'} onClick={()=>setMode('stocks')}><ListFilter size={13}/>종목별 보기</button>
    <button className={mode==='sectors'?'active':''} aria-pressed={mode==='sectors'} onClick={()=>setMode('sectors')}><Layers3 size={13}/>섹터별 보기</button>
   </div>
   <div className="sector-map-filter-row">
    <div className="search"><Search size={16}/><input aria-label="섹터맵 검색" placeholder="종목명 · 코드 · 섹터 · 테마 검색" value={query} onChange={e=>{setQuery(e.target.value);setClosedSectors(new Set());setClosedSubs(new Set());}}/></div>
    <select aria-label="대분류 선택" value={sector} onChange={e=>resetSub(e.target.value)}><option value="ALL">전체 대분류</option>{sectors.map(x=><option key={x} value={x}>{x}</option>)}</select>
    <select aria-label="세부섹터 선택" value={subSector} onChange={e=>setSubSector(e.target.value)}><option value="ALL">전체 세부섹터</option>{subSectors.map(x=><option key={x} value={x}>{x}</option>)}</select>
    
   </div>
  </div>

  {mode==='stocks'?<div className="panel sector-map-table-panel">
   <div className="table-scroll"><table className="sector-map-table"><thead><tr><th>종목</th><th>대분류</th><th>세부섹터</th><th>투자 테마</th></tr></thead><tbody>{filtered.map(item=><tr key={item.symbol}>
    <td><div className="sector-stock-name"><strong>{item.name}</strong><small>{item.symbol} · {item.market}</small></div></td>
    <td><span className="sector-chip">{item.sector}</span>{item.verification?.status==='verified'&&<small style={{display:'block',marginTop:4,fontSize:9}}><a title={`공식 업종: ${item.verification.industry||'확인'} · 사업·제품 기반 분류`} href="https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage" target="_blank" rel="noopener noreferrer">분류 근거</a></small>}{businessSource(item.verification?.businessSourceUrl)&&<small style={{display:'block',marginTop:4,fontSize:9}}><a href={businessSource(item.verification?.businessSourceUrl)!} target="_blank" rel="noopener noreferrer" title={item.verification?.businessReviewedAt?`사업 확인 ${item.verification.businessReviewedAt}`:undefined}>기업 사업소개</a></small>}{item.reviewRequired&&<small style={{display:'block',marginTop:4,fontSize:9}}>분류 검토 대기</small>}</td>
    <td><strong className="sector-subsector">{item.subSector}</strong></td>
    <td><div className="theme-tags">{item.themes.length?item.themes.map(t=><span key={t}>{t}</span>):<span>미분류</span>}</div></td>
   </tr>)}</tbody></table></div>
   {!filtered.length&&<p className="sector-map-empty">조건에 맞는 종목이 없습니다.</p>}
  </div>:<div className="sector-group-list">
   {grouped.map(([sectorName,subs])=>{
    const closed=closedSectors.has(sectorName),sectorId=groupId+'-sector-'+encodeURIComponent(sectorName);
    return <section className="panel sector-group" key={sectorName}>
     <div className="sector-group-head"><h3><button className="sector-toggle" aria-expanded={!closed} aria-controls={sectorId} aria-label={`${sectorName} 대분류 ${closed?'펼치기':'접기'}`} onClick={()=>toggle(setClosedSectors,sectorName)}><span><span className="eyebrow">SECTOR</span><strong>{sectorName}</strong></span><span className="sector-toggle-meta">{[...subs.values()].reduce((n,x)=>n+x.length,0)}종목<ChevronDown size={17} className={closed?'is-closed':''}/></span></button></h3></div>
     <div id={sectorId} className="sector-subgroups" hidden={closed}>{[...subs.entries()].map(([sub,items])=>{
      const key=JSON.stringify([sectorName,sub]),subClosed=closedSubs.has(key),subId=groupId+'-sub-'+encodeURIComponent(key);
      return <div className="sector-subgroup" key={sub}><h4 className="sector-subgroup-title"><button className="sector-toggle" aria-expanded={!subClosed} aria-controls={subId} aria-label={`${sectorName} ${sub} 세부섹터 ${subClosed?'펼치기':'접기'}`} onClick={()=>toggle(setClosedSubs,key)}><strong>{sub}</strong><span className="sector-toggle-meta">{items.length}종목<ChevronDown size={15} className={subClosed?'is-closed':''}/></span></button></h4><div id={subId} className="sector-member-grid" hidden={subClosed}>{items.map(item=><article key={item.symbol}><div><strong>{item.name}</strong><small>{item.symbol} · {item.market}</small></div><div className="theme-tags">{item.themes.slice(0,3).map(t=><span key={t}>{t}</span>)}</div></article>)}</div></div>;
     })}</div>
    </section>;
   })}
   {!grouped.length&&<section className="panel sector-map-empty">조건에 맞는 섹터가 없습니다.</section>}
  </div>}
 </section>;
}
