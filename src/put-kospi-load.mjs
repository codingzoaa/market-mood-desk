// The deadline covers response headers AND the JSON body, even for a stalled fetcher.
export async function fetchPutDaily(url,{fetcher=fetch,signal,timeoutMs=12000}={}){
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const controller=new AbortController();let cancel,timer;
 const stopped=new Promise((_,reject)=>{cancel=reject;});
 const abort=()=>{controller.abort();cancel(new DOMException('Aborted','AbortError'));};
 signal?.addEventListener('abort',abort,{once:true});
 timer=setTimeout(()=>{controller.abort();cancel(Error('PUT_REQUEST_TIMEOUT'));},timeoutMs);
 try{
  return await Promise.race([(async()=>{const r=await fetcher(url,{credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});if(!r.ok)throw Error('PUT_REQUEST_FAILED');const data=await r.json();if(data.unit!=='억원'||!Array.isArray(data.points)||data.points.length>2000)throw Error('PUT_RESPONSE_INVALID');return data.points;})(),stopped]);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
