import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
export const signalChartStyle:CSSProperties={width:'100%',height:'min(65vh,520px)',minHeight:390};
export function SignalPanel({title,id,open,onToggle,children,className='',headerClassName=''}:{title:string;id:string;open:boolean;onToggle:()=>void;children:ReactNode;className?:string;headerClassName?:string}){
 const [large,setLarge]=useState(false),root=useRef<HTMLElement>(null),expandButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!large)return;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  root.current?.querySelector<HTMLButtonElement>('.signal-large-close')?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setLarge(false);return;}
   if(event.key!=='Tab')return;
   const buttons=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,[tabindex="0"]')||[]).filter(el=>el.getClientRects().length>0);
   const first=buttons[0],last=buttons.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keyboard);expandButton.current?.focus({preventScroll:true});};
 },[large]);
 return <section ref={root} role={large?'dialog':undefined} aria-modal={large?true:undefined} aria-label={large?title+' 크게 보기':undefined} className={'panel signal-panel '+(large?'signal-panel-large ':'')+className} style={{padding:0,overflow:'hidden',margin:'0 0 15px'}}>
  <div style={{display:'flex',alignItems:'center',background:'var(--paper)',flexShrink:0}}>
  <button className={headerClassName} type="button" aria-expanded={open} aria-controls={id} onClick={()=>{if(large)setLarge(false);onToggle();}}
   style={{width:'100%',minWidth:0,display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,padding:'18px 20px',minHeight:58,font:'inherit',fontSize:14,lineHeight:1.55,textAlign:'left',fontWeight:700,color:'var(--ink)',background:'var(--paper)',border:0,cursor:'pointer'}}>
   <span title={title} style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</span>
   <span aria-hidden="true" style={{fontSize:22,color:'var(--green)',fontWeight:400,lineHeight:1,flexShrink:0}}>{open?'−':'+'}</span>
  </button>
  {open&&<button ref={expandButton} type="button" className={large?'signal-large-close':'signal-large-open'} aria-label={title+(large?' 작게 보기':' 크게 보기')} onClick={()=>setLarge(v=>!v)} style={{flexShrink:0,marginRight:16,padding:'7px 10px',border:'1px solid #d6e1d9',borderRadius:7,background:'#fff',color:'var(--green)',font:'inherit',fontSize:12,cursor:'pointer'}}>{large?'작게 보기':'크게 보기'}</button>}
  </div>
  {open&&<div id={id} className="signal-panel-body" style={{padding:'0 12px 14px'}}>{children}</div>}
 </section>;
}
export function SignalPeriods({value,onChange}:{value:string;onChange:(value:string)=>void}){
 return <div role="group" aria-label="차트 조회 기간" style={{display:'flex',flexWrap:'wrap',gap:6}}>
  {[['1M','1개월'],['3M','3개월'],['1Y','1년'],['5Y','5년'],['ALL','전체']].map(([period,label])=><button type="button" key={period} aria-pressed={value===period} onClick={()=>onChange(period)} style={{font:'inherit',fontSize:12,padding:'7px 11px',borderRadius:7,border:'1px solid #d6e1d9',background:value===period?'#215e47':'#fff',color:value===period?'#fff':'#305c4a',cursor:'pointer'}}>{label}</button>)}
 </div>;
}
