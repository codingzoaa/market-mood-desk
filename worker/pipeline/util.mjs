export const VERSION='receipt-5m-v1';
export const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export const stamp=s=>typeof s==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
export const iso=s=>{if(!stamp(s))throw Error('INVALID_TIME');return new Date(s).toISOString();};
export const kstDate=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(s));
export const minute=s=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s)).replace(':','');
export const slotOf=s=>{const m=minute(s);return m.slice(0,2)+String(Math.floor(Number(m.slice(2))/5)*5).padStart(2,'0');};
export const slots=Array.from({length:79},(_,i)=>String(Math.floor((540+i*5)/60)).padStart(2,'0')+String((540+i*5)%60).padStart(2,'0'));
export function canonical(value){
 if(value===undefined)throw Error('UNDEFINED_VALUE');
 if(value===null||typeof value!=='object'){if(typeof value==='number'&&!Number.isFinite(value))throw Error('NON_FINITE');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export async function hash(bytes){const b=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function gzip(bytes){const b=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());}
export async function gunzip(bytes,maxBytes=64*1024*1024){const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();const chunks=[];let n=0;for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>maxBytes){await reader.cancel();throw Error('DECOMPRESSED_LIMIT');}chunks.push(x.value);}const out=new Uint8Array(n);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;}
export const chunks=(rows,n)=>Array.from({length:Math.ceil(rows.length/n)},(_,i)=>rows.slice(i*n,i*n+n));
export function ensure(condition,code){if(!condition)throw Error(code);}
