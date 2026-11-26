import {createCoordinatedSession} from './ls-session.mjs';
import {accessToken} from './ls.mjs';
const ENDPOINT='wss://openapi.ls-sec.co.kr:9443/websocket',API='https://market-note-ls-api.kby0991.workers.dev/api/sector-stock-news';
const parts=now=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
export function stockNewsWindow(now=new Date()){const p=parts(now),t=p.hour+p.minute;return ![0,6].includes(new Date(p.year+'-'+p.month+'-'+p.day).getUTCDay())&&t>='0850'&&t<='1700';}
export function parseLSHeadline(message,date,receivedAt=new Date().toISOString()){
 let v;try{v=typeof message==='string'?JSON.parse(message):message;}catch{return null;}
 if(v?.header?.tr_cd!=='NWS'||!v.body)return null;const b=v.body,id=String(b.realkey||''),headline=String(b.title||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(),rawDate=String(b.date||date.replaceAll('-',''));
 if(!/^[a-zA-Z0-9]{24}$/.test(id)||headline.length<9||headline.length>240||rawDate!==date.replaceAll('-','')||!/^(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(String(b.time||'')))return null;
 const time=String(b.time),published=date+'T'+time.slice(0,2)+':'+time.slice(2,4)+':'+time.slice(4,6)+'+09:00';if(Date.parse(published)>Date.parse(receivedAt)+60000)return null;
 return {id,headline,day:date,published,source:'LS증권',provider:'LS증권 종목뉴스',symbols:[...new Set(String(b.code||'').match(/\d{6}/g)||[])],link:API+'?date='+date+'&id='+id};
}
const read=async(env,key)=>{const r=await env.DB.prepare('SELECT payload FROM state WHERE id=?').bind(key).first();return r?JSON.parse(r.payload):null;};
const write=(env,key,value)=>env.DB.prepare('INSERT INTO state(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(key,JSON.stringify(value)).run();
export async function readStockNews(env,date,id){const row=await read(env,'stock-news:'+date);const items=row?.items||[];return {date,provider:'LS증권 종목뉴스',coverage:'실시간 수신 표본 · 연결 공백 및 수집 시작 전 기사는 포함하지 않음',status:row?.status||'not_collected',checkedAt:row?.checkedAt||null,items:id?items.filter(x=>x.id===id):items};}
// Dedicated alarm: OAuth uses the shared gate briefly; the read-only NWS socket
// never blocks price/account sessions, subscribes to orders, or exposes a token.
export async function collectStockNews(env,{now=new Date(),open=createCoordinatedSession,Socket=WebSocket,duration=285000}={}){
 const p=parts(now),date=p.year+'-'+p.month+'-'+p.day,key='stock-news:'+date;if(!stockNewsWindow(now)||!env.LS_APP_KEY||!env.LS_APP_SECRET)return;
 let transport,token,socket,chain=Promise.resolve();const previous=await readStockNews(env,date),items=new Map(previous.items.map(x=>[x.id,x]));let accepted=false;
 try{
  transport=await open(env);token=await accessToken(env,transport.fetch,Date.now(),false);await transport.close();transport=null;
  await new Promise((resolve,reject)=>{let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);try{socket?.close(1000,'window completed');}catch{}error?reject(error):resolve();};const timer=setTimeout(()=>finish(),duration);
   socket=new Socket(ENDPOINT);socket.addEventListener('open',()=>socket.send(JSON.stringify({header:{token,tr_type:'3'},body:{tr_cd:'NWS',tr_key:'NWS001'}})));
   socket.addEventListener('message',event=>{let payload;try{payload=JSON.parse(event.data);}catch{return;}if(payload?.header?.rsp_cd&&payload.header.rsp_cd!=='00000'&&payload.header.rsp_cd!=='0000'){finish(Error('LS_NEWS_SUBSCRIPTION_REJECTED'));return;}
    const item=parseLSHeadline(payload,date);if(!item)return;accepted=true;items.set(item.id,item);while(items.size>1000)items.delete(items.keys().next().value);chain=chain.then(()=>write(env,key,{date,status:'receiving',checkedAt:new Date().toISOString(),items:[...items.values()]}));chain.catch(()=>finish(Error('LS_NEWS_STORAGE_FAILED')));
   });socket.addEventListener('error',()=>finish(Error('LS_NEWS_CONNECTION_FAILED')));socket.addEventListener('close',()=>finish());
  });
  await chain;await write(env,key,{date,status:accepted?'received':'no_verified_messages',checkedAt:new Date().toISOString(),items:[...items.values()]});
 }catch{await chain.catch(()=>{});await write(env,key,{date,status:'unavailable',checkedAt:new Date().toISOString(),items:[...items.values()]});}
 finally{await transport?.close();try{socket?.close();}catch{}token=null;}
}
