import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
export default function FullscreenPanel({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const panel=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';panel.current?.querySelector<HTMLButtonElement>('.fullscreen-close')?.focus();
  const keyboard=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();close.current();return;}
   if(e.key!=='Tab')return;
   const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')||[]).filter(node=>typeof node.focus==='function'),first=nodes[0],last=nodes.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keyboard);if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 return createPortal(<section ref={panel} className="fullscreen-panel" role="dialog" aria-modal="true" aria-labelledby="fullscreen-title"><header className="fullscreen-header"><div><small>MARKETNOTE</small><h2 id="fullscreen-title">{title}</h2></div><button className="icon-btn fullscreen-close" aria-label={title+' 닫기'} onClick={onClose}><X size={22}/></button></header><div className="fullscreen-content">{children}</div></section>,document.body);
}
