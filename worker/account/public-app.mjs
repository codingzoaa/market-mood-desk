import {guardStatus,guardSave,guardReset,pollGuard} from './loss-guard.mjs';
import {privateHeaders} from './security.mjs';
export const publicAccountMode=env=>env.ACCOUNT_ACCESS_MODE==='PUBLIC_LOSS_GUARD';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});
// Owner explicitly opted into unauthenticated account display. Expose only the loss-guard projection.
export async function publicAccountFetch(request,env,sessionFactory){
 const url=new URL(request.url);
 if(request.method==='GET'){
  if(url.pathname==='/api/lossguard')try{return reply({...await guardStatus(env),accessMode:'public',legacyDataRemoved:true});}catch{return reply({error:'GUARD_DATA_UNAVAILABLE'},503);}
  if(url.pathname.startsWith('/api/'))return reply({error:'LEGACY_ACCOUNT_REMOVED'},410);
  if(!['/','/index.html','/app.js','/app.css'].includes(url.pathname))return reply({error:'NOT_FOUND'},404);
  const asset=await env.ASSETS.fetch(request),headers=new Headers(asset.headers);for(const[k,v]of Object.entries(privateHeaders))headers.set(k,v);return new Response(asset.body,{status:asset.status,headers});
 }
 if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 if(!['/api/lossguard/poll','/api/lossguard/settings','/api/lossguard/reset'].includes(url.pathname))return reply({error:'LEGACY_ACCOUNT_REMOVED'},410);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'||request.headers.get('Content-Type')!=='application/json')return reply({error:'REQUEST_REJECTED'},403);
 try{
  if(Number(request.headers.get('Content-Length')||0)>4096)return reply({error:'REQUEST_TOO_LARGE'},413);
  const text=await request.text();if(text.length>4096)return reply({error:'REQUEST_TOO_LARGE'},413);const input=JSON.parse(text);
  if(url.pathname==='/api/lossguard/settings')return reply({settings:await guardSave(env,input)});
  if(url.pathname==='/api/lossguard/reset')return reply(await guardReset(env));
  const result=await pollGuard(env,sessionFactory);return reply(result,result.error?503:200);
 }catch{return reply({error:'GUARD_REQUEST_FAILED'},400);}
}
