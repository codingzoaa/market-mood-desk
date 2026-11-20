import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export async function verifyPublishedManifest(expected,{request=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),attempts=12,delayMs=5000,log=console.log}={}){
 if(!expected?.checkedAt||!expected?.sourceSha256||!expected?.method)throw Error('REGISTRY_EXPECTED_VERSION_INVALID');
 let last='NOT_CURRENT';
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const response=await request('https://market-note-ls-api.kby0991.workers.dev/api/stock-map?verification='+Date.now()+'-'+attempt,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('HTTP_'+response.status);
   const actual=(await response.json()).verification;
   if(actual?.checkedAt===expected.checkedAt&&actual?.sourceSha256===expected.sourceSha256&&actual?.method===expected.method){log('REGISTRY_DEPLOYMENT_VERIFIED '+JSON.stringify({attempt,verified:actual.verified,pending:actual.pending,checkedAt:actual.checkedAt}));return actual;}
   last='NOT_CURRENT';
  }catch{last='HTTP_OR_RESPONSE_ERROR';}
  log('REGISTRY_PROPAGATION_WAIT '+JSON.stringify({attempt,attempts,reason:last}));
  if(attempt<attempts)await wait(delayMs);
 }
 throw Error('REGISTRY_DEPLOYMENT_NOT_CURRENT: '+last);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyPublishedManifest(JSON.parse(fs.readFileSync('src/data/stock-map-verified.json','utf8')));
