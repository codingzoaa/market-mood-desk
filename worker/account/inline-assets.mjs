/** Keep private assets behind the same authentication handler, including on workers.dev. */
export function withPrivateAssets(worker,assets){
 return {...worker,fetch(request,env,ctx){
  const binding={async fetch(assetRequest){const path=new URL(assetRequest.url).pathname,key=path==='/'?'/index.html':path,asset=assets[key];return asset?new Response(asset.body,{headers:{'Content-Type':asset.type}}):new Response('Not found',{status:404});}};
  return worker.fetch(request,{...env,ASSETS:binding},ctx);
 }};
}
