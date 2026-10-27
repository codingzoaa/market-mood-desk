'use client';
import {useMemo,useState} from 'react';
import {Search,Layers3,ListFilter,CheckCircle2} from 'lucide-react';
import {STOCK_MAP,type StockMapEntry} from './stock-map';

type Mode='stocks'|'sectors';

const uniq=(xs:string[])=>[...new Set(xs)].sort((a,b)=>a.localeCompare(b,'ko'));
const normalize=(v:string)=>v.trim().toLowerCase();

export default function StockSectorMap(){
 const [mode,setMode]=useState<Mode>('stocks');
 const [query,setQuery]=useState('');
 const [sector,setSector]=useState('ALL');
 const [subSector,setSubSector]=useState('ALL');
 const [breadthOnly,setBreadthOnly]=useState(true);

 const sectors=useMemo(()=>uniq(STOCK_MAP.map(x=>x.sector)),[]);
 const subSectors=useMemo(()=>uniq(STOCK_MAP.filter(x=>sector==='ALL'||x.sector===sector).map(x=>x.subSector)),[sector]);
 const filtered=useMemo(()=>{
  const q=normalize(query);
  return STOCK_MAP.filter(x=>{
   if(sector!=='ALL'&&x.sector!==sector)return false;
   if(subSector!=='ALL'&&x.subSector!==subSector)return false;
   if(breadthOnly&&!x.breadth)return false;
   if(!q)return true;
   return normalize([x.name,x.symbol,x.market,x.sector,x.subSector,...x.themes].join(' ')).includes(q);
  }).sort((a,b)=>a.sector.localeCompare(b.sector,'ko')||a.subSector.localeCompare(b.subSector,'ko')||a.name.localeCompare(b.name,'ko'));
 },[query,sector,subSector,breadthOnly]);

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
   <div><span className="eyebrow">STOCK SECTOR MAP</span><h2>종목과 섹터 분류 기준</h2><p>강세 섹터 breadth 계산에 사용하는 고정 종목군을 확인합니다.</p></div>
   <div className="sector-map-count"><strong>{filtered.length}</strong><span>/ {STOCK_MAP.length} 종목</span></div>
  </div>

  <div className="panel sector-map-controls">
   <div className="stock-scope-tabs" aria-label="섹터맵 보기 방식">
    <button className={mode==='stocks'?'active':''} aria-pressed={mode==='stocks'} onClick={()=>setMode('stocks')}><ListFilter size={13}/>종목별 보기</button>
    <button className={mode==='sectors'?'active':''} aria-pressed={mode==='sectors'} onClick={()=>setMode('sectors')}><Layers3 size={13}/>섹터별 보기</button>
   </div>
   <div className="sector-map-filter-row">
    <div className="search"><Search size={16}/><input aria-label="섹터맵 검색" placeholder="종목명 · 코드 · 섹터 · 테마 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <select aria-label="대분류 선택" value={sector} onChange={e=>resetSub(e.target.value)}><option value="ALL">전체 대분류</option>{sectors.map(x=><option key={x} value={x}>{x}</option>)}</select>
    <select aria-label="세부섹터 선택" value={subSector} onChange={e=>setSubSector(e.target.value)}><option value="ALL">전체 세부섹터</option>{subSectors.map(x=><option key={x} value={x}>{x}</option>)}</select>
    <label className="sector-map-check"><input type="checkbox" checked={breadthOnly} onChange={e=>setBreadthOnly(e.target.checked)}/><span>Breadth 구성만</span></label>
   </div>
  </div>

  {mode==='stocks'?<div className="panel sector-map-table-panel">
   <div className="table-scroll"><table className="sector-map-table"><thead><tr><th>종목</th><th>대분류</th><th>세부섹터</th><th>테마</th><th>Breadth</th></tr></thead><tbody>{filtered.map(item=><tr key={item.symbol}>
    <td><div className="sector-stock-name"><strong>{item.name}</strong><small>{item.symbol} · {item.market}</small></div></td>
    <td><span className="sector-chip">{item.sector}</span></td>
    <td><strong className="sector-subsector">{item.subSector}</strong></td>
    <td><div className="theme-tags">{item.themes.length?item.themes.map(t=><span key={t}>{t}</span>):<span>미분류</span>}</div></td>
    <td>{item.breadth?<span className="breadth-ok"><CheckCircle2 size={14}/>포함</span>:<span className="muted">제외</span>}</td>
   </tr>)}</tbody></table></div>
   {!filtered.length&&<p className="sector-map-empty">조건에 맞는 종목이 없습니다.</p>}
  </div>:<div className="sector-group-list">
   {grouped.map(([sectorName,subs])=><section className="panel sector-group" key={sectorName}><div className="sector-group-head"><div><span className="eyebrow">SECTOR</span><h3>{sectorName}</h3></div><span>{[...subs.values()].reduce((n,x)=>n+x.length,0)}종목</span></div>
    <div className="sector-subgroups">{[...subs.entries()].map(([sub,items])=><div className="sector-subgroup" key={sub}><div className="sector-subgroup-title"><strong>{sub}</strong><span>{items.length}종목</span></div><div className="sector-member-grid">{items.map(item=><article key={item.symbol}><div><strong>{item.name}</strong><small>{item.symbol} · {item.market}</small></div><div className="theme-tags">{item.themes.slice(0,3).map(t=><span key={t}>{t}</span>)}</div><span className={item.breadth?'breadth-ok':'muted'}>{item.breadth?<><CheckCircle2 size={13}/>Breadth</>:'제외'}</span></article>)}</div></div>)}</div>
   </section>)}
   {!grouped.length&&<section className="panel sector-map-empty">조건에 맞는 섹터가 없습니다.</section>}
  </div>}
 </section>;
}
