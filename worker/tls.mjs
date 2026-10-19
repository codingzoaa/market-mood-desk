// One verified TLS connection for OAuth and every TR in a collection.
// No IP spoofing, DNS overrides, certificate bypass, or arbitrary upstreams.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const MAX=2000000;
function join(a,b){const out=new Uint8Array(a.length+b.length);out.set(a);out.set(b,a.length);return out;}
export class HTTPReader {
 constructor(reader){this.reader=reader;this.buffer=new Uint8Array();this.ended=false;}
 async fill(n){while(this.buffer.length<n&&!this.ended){const {value,done}=await this.reader.read();if(done){this.ended=true;break;}this.buffer=join(this.buffer,value);if(this.buffer.length>MAX+32768)throw Error('LS_TLS_RESPONSE_TOO_LARGE');}if(this.buffer.length<n)throw Error('LS_TLS_TRUNCATED_RESPONSE');}
 take(n){const part=this.buffer.slice(0,n);this.buffer=this.buffer.slice(n);return part;}
 async line(){for(;;){for(let i=0;i<this.buffer.length-1;i++)if(this.buffer[i]===13&&this.buffer[i+1]===10){const result=decoder.decode(this.take(i));this.take(2);return result;}if(this.buffer.length>16384)throw Error('LS_TLS_HEADER_TOO_LARGE');const before=this.buffer.length;await this.fill(before+1);}}
 async response(){
  const statusLine=await this.line(),match=/^HTTP\/1\.[01] (\d{3})(?: |$)/.exec(statusLine);if(!match)throw Error('LS_TLS_INVALID_HTTP_STATUS');
  const status=Number(match[1]),headers=new Headers();let headerBytes=statusLine.length;
  for(;;){const line=await this.line();if(!line)break;headerBytes+=line.length;if(headerBytes>32768)throw Error('LS_TLS_HEADER_TOO_LARGE');const colon=line.indexOf(':');if(colon<=0)throw Error('LS_TLS_INVALID_HEADER');const name=line.slice(0,colon).toLowerCase(),value=line.slice(colon+1).trim();
   if(['content-type','content-length','transfer-encoding','content-encoding','connection','tr_cont','tr_cont_key','location'].includes(name))headers.append(name,value);
  }
  if(status>=100&&status<200&&status!==101)return this.response();
  if([204,304].includes(status))return new Response(null,{status,headers});
  const encoding=headers.get('content-encoding');if(encoding&&encoding!=='identity')throw Error('LS_TLS_UNSUPPORTED_ENCODING');
  let body=new Uint8Array();
  if(headers.get('transfer-encoding')?.toLowerCase()==='chunked'){
   let total=0;const chunks=[];
   for(;;){const line=await this.line(),hex=line.split(';')[0].trim();if(!/^[0-9a-f]+$/i.test(hex))throw Error('LS_TLS_INVALID_CHUNK');const size=parseInt(hex,16);if(!Number.isSafeInteger(size)||size>MAX||total+size>MAX)throw Error('LS_TLS_RESPONSE_TOO_LARGE');
    if(size===0){let trailers=0;while(await this.line()){if(++trailers>100)throw Error('LS_TLS_INVALID_TRAILER');}break;}
    await this.fill(size+2);chunks.push(this.take(size));if(this.take(2).some((v,i)=>v!==[13,10][i]))throw Error('LS_TLS_INVALID_CHUNK');total+=size;
   }
   body=new Uint8Array(total);let pos=0;for(const chunk of chunks){body.set(chunk,pos);pos+=chunk.length;}
   headers.delete('transfer-encoding');headers.set('content-length',String(total));
  }else if(headers.has('content-length')){
   const raw=headers.get('content-length');if(!/^\d+$/.test(raw))throw Error('LS_TLS_INVALID_LENGTH');const length=Number(raw);if(!Number.isSafeInteger(length)||length>MAX)throw Error('LS_TLS_RESPONSE_TOO_LARGE');await this.fill(length);body=this.take(length);
  }else{
   while(!this.ended){const before=this.buffer.length;try{await this.fill(before+1);}catch(error){if(!this.ended)throw error;}}
   body=this.take(this.buffer.length);if(body.length>MAX)throw Error('LS_TLS_RESPONSE_TOO_LARGE');
  }
  return new Response(body,{status,headers});
 }
}
export async function createSession(connector){
 const connect=connector||(await import('cloudflare:sockets')).connect;
 const socket=connect({hostname:'openapi.ls-sec.co.kr',port:8080},{secureTransport:'on',allowHalfOpen:true});
 socket.closed.catch(()=>{});
 let writer,reader,busy=false,closed=false;
 const close=async()=>{closed=true;try{await socket.close();}catch{}};
 const ready=socket.opened.then(()=>{writer=socket.writable.getWriter();reader=new HTTPReader(socket.readable.getReader());});
 return {
  close,
  fetch:async(url,options={})=>{
   const target=new URL(url);if(target.origin!=='https://openapi.ls-sec.co.kr:8080'||target.username||target.password||options.method!=='POST')throw Error('LS_TLS_TARGET_REJECTED');
   if(closed||busy)throw Error('LS_TLS_CONNECTION_UNAVAILABLE');busy=true;
   let abort;
   try{
    const request=(async()=>{
     await ready;if(closed)throw Error('LS_TLS_CONNECTION_CLOSED');
     const body=encoder.encode(options.body instanceof URLSearchParams?options.body.toString():String(options.body||''));if(body.length>20000)throw Error('LS_TLS_REQUEST_TOO_LARGE');
     const headers=new Headers(options.headers);headers.set('Host',target.host);headers.set('Connection','keep-alive');headers.set('Accept-Encoding','identity');headers.set('Accept','application/json');headers.set('User-Agent','MarketNote/1.0');headers.set('Content-Length',String(body.length));
     let head='POST '+target.pathname+target.search+' HTTP/1.1\r\n';for(const [key,value] of headers)head+=key+': '+value+'\r\n';head+='\r\n';
     await writer.write(join(encoder.encode(head),body));return await reader.response();
    })();
    if(!options.signal)return await request;
    const aborted=new Promise((_,reject)=>{abort=()=>{close();reject(options.signal.reason||new DOMException('Request aborted','AbortError'));};if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});});
    return await Promise.race([request,aborted]);
   }catch(error){await close();throw error;}
   finally{busy=false;if(abort)options.signal.removeEventListener('abort',abort);}
  }
 };
}
