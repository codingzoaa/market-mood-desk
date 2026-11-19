import {useEffect,useMemo,useState} from 'react';
import {API_URL} from './live';
import {combinedStockMap,type StockMapEntry} from './stock-map';
import {applySharedSectorEdits} from './shared-sector-edits.mjs';
import {useSectorEdits} from './sector-editor';
const EMPTY:StockMapEntry[]=[];
export function useStockClassification(discovered:StockMapEntry[]=EMPTY){
 const local=useSectorEdits();
 const [remote,setRemote]=useState<StockMapEntry[]>([]),[sharedEdits,setSharedEdits]=useState<any[]>([]),[history,setHistory]=useState<any[]>([]),[revisions,setRevisions]=useState<Record<string,string>>({}),[registryError,setRegistryError]=useState(false),[checkedAt,setCheckedAt]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  const refresh=async()=>{try{
   const response=await fetch(API_URL+'/api/stock-map',{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([ctrl.signal,AbortSignal.timeout(12000)])});
   if(!response.ok)throw Error('registry');const body=await response.json();
   if(body.version!==1||!Array.isArray(body.entries)||body.entries.length>5000)throw Error('registry schema');
   if(!ctrl.signal.aborted){setRemote(body.entries);setSharedEdits(Array.isArray(body.sharedEdits)?body.sharedEdits:[]);setHistory(Array.isArray(body.sharedHistory)?body.sharedHistory.slice(-500):[]);setRevisions(body.sharedRevisions&&typeof body.sharedRevisions==='object'?body.sharedRevisions:{});setCheckedAt(typeof body.updatedAt==='string'?body.updatedAt:typeof body.verification?.checkedAt==='string'?body.verification.checkedAt:'');setRegistryError(false);}
  }catch{if(!ctrl.signal.aborted)setRegistryError(true);}};
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};void refresh();const timer=window.setInterval(refresh,300000);document.addEventListener('visibilitychange',visible);
  return()=>{ctrl.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const registry=useMemo(()=>applySharedSectorEdits(combinedStockMap([...discovered,...remote]),sharedEdits,revisions) as StockMapEntry[],[discovered,remote,sharedEdits,revisions]);
 return {registry,registryError,checkedAt,local,history,revisions};
}
export type StockClassification=ReturnType<typeof useStockClassification>;
