// Public account facade. Only the user's Marketnote origin may read it cross-origin.
const get=new Set(['/','/index.html','/app.js','/app.css','/api/lossguard','/api/lossguard/push/key']);
const post=new Set(['/api/lossguard/poll','/api/lossguard/settings','/api/lossguard/reset','/api/lossguard/push/subscribe','/api/lossguard/push/status','/api/lossguard/push/unsubscribe','/api/lossguard/push/test']);
export const MARKETNOTE_ORIGIN='https://codingzoaa.github.io';
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname,origin=request.headers.get('Origin'),allowed=origin===MARKETNOTE_ORIGIN||origin===url.origin;
 if(request.method==='GET'&&['/','/index.html'].includes(path))return new Response(null,{status:302,headers:{Location:'https://codingzoaa.github.io/market-mood-desk/#account','Cache-Control':'no-store'}});
 const reply=(data,status)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(origin&&!allowed)return reply({error:'ORIGIN_REJECTED'},403);
 if(request.method==='OPTIONS'){
  if(!allowed||!post.has(path))return reply({error:'REQUEST_REJECTED'},403);
  return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store'}});
 }
 if(env.ACCOUNT_ALLOW_MAINTENANCE==='true'&&path==='/api/_maintenance/clear-legacy'&&request.method==='POST')return env.ACCOUNT_BACKEND.fetch(request);
 if(!(request.method==='GET'&&get.has(path)||request.method==='POST'&&post.has(path)))return reply({error:path.startsWith('/api/')?'LEGACY_ACCOUNT_REMOVED':'NOT_FOUND'},path.startsWith('/api/')?410:404);
 const response=await env.ACCOUNT_BACKEND.fetch(request),headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Vary','Origin');if(allowed&&origin)headers.set('Access-Control-Allow-Origin',origin);return new Response(response.body,{status:response.status,headers});
}};
