import type {CSSProperties,ReactNode} from 'react';
export const signalChartStyle:CSSProperties={width:'100%',height:'min(65vh,520px)',minHeight:390};
export function SignalPanel({title,id,open,onToggle,children,className='',headerClassName=''}:{title:string;id:string;open:boolean;onToggle:()=>void;children:ReactNode;className?:string;headerClassName?:string}){
 return <section className={'panel signal-panel '+className} style={{padding:0,overflow:'hidden',margin:'0 0 15px'}}>
  <button className={headerClassName} type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}
   style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,padding:'18px 20px',minHeight:58,font:'inherit',fontSize:14,lineHeight:1.55,textAlign:'left',fontWeight:700,color:'var(--ink)',background:'var(--paper)',border:0,cursor:'pointer'}}>
   <span title={title} style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</span>
   <span aria-hidden="true" style={{fontSize:22,color:'var(--green)',fontWeight:400,lineHeight:1,flexShrink:0}}>{open?'−':'+'}</span>
  </button>
  {open&&<div id={id} style={{padding:'0 12px 14px'}}>{children}</div>}
 </section>;
}
export function SignalPeriods({value,onChange}:{value:string;onChange:(value:string)=>void}){
 return <div role="group" aria-label="차트 조회 기간" style={{display:'flex',flexWrap:'wrap',gap:6}}>
  {[['1M','1개월'],['3M','3개월'],['1Y','1년'],['5Y','5년'],['ALL','전체']].map(([period,label])=><button type="button" key={period} aria-pressed={value===period} onClick={()=>onChange(period)} style={{font:'inherit',fontSize:12,padding:'7px 11px',borderRadius:7,border:'1px solid #d6e1d9',background:value===period?'#215e47':'#fff',color:value===period?'#fff':'#305c4a',cursor:'pointer'}}>{label}</button>)}
 </div>;
}
