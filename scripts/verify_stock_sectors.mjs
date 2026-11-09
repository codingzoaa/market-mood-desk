import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {KIND_SOURCE,VERIFICATION_METHOD,parseKindCompanies,sectorCandidate,verifyKindIdentity} from '../worker/stock-verification.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),API='https://market-note-ls-api.kby0991.workers.dev';
const kstDay=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,list)=>{if(v.startsWith('--'))a.push([v.slice(2),list[i+1]]);return a},[]));
async function jsonFile(file){return JSON.parse(await fs.readFile(file,'utf8'))}
async function download(url,maxBytes){const r=await fetch(url,{redirect:'error',headers:{Accept:'application/json,text/html','User-Agent':'MarketNote-SectorVerification/1.0'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('SOURCE_HTTP_'+r.status);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>maxBytes)throw Error('SOURCE_TOO_LARGE');return bytes;}
export function verifyRegistry({dashboard,registry,catalog,previous,issuers,checkedAt,sourceHash}){
 if(previous.version!==1||previous.method!==VERIFICATION_METHOD||registry.version!==1||!Array.isArray(registry.entries))throw Error('REGISTRY_SCHEMA');
 const now=new Date(checkedAt),today=kstDay(now),byIssuer=new Map(issuers.map(x=>[x.symbol,x]));
 if(dashboard.schemaVersion!==2||!Array.isArray(dashboard.snapshots)||dashboard.snapshots.length>28)throw Error('DASHBOARD_SCHEMA');
 const latest=[...dashboard.snapshots].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 if(!latest||!/^\d{4}-\d{2}-\d{2}$/.test(latest.date)||latest.date>today||now-Date.parse(latest.date+'T00:00:00+09:00')>30*86400000||!String(latest.source).startsWith('LS증권 KRX')||!Array.isArray(latest.stocks)||latest.stocks.length>3000)throw Error('DASHBOARD_SOURCE_OR_DATE');
 const curated=new Set(catalog.map(x=>x.symbol)),queue=new Map();
 // Persist pending candidates too: an unresolved result is retried, not treated
 // as permanently classified. Curated entries remain entirely outside this job.
 for(const x of [...(previous.entries||[]),...(registry.entries||[]),...latest.stocks])if(sectorCandidate(x)&&!curated.has(x.symbol))queue.set(x.symbol,{symbol:x.symbol,name:x.name,market:x.market});
 if(queue.size>5000)throw Error('CLASSIFICATION_QUEUE_TOO_LARGE');
 const entries=[...queue.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol)).map(stock=>verifyKindIdentity(stock,byIssuer.get(stock.symbol),checkedAt));
 const verified=entries.filter(x=>x.verification.status==='verified').length;
 const semantic=v=>JSON.stringify((v.entries||[]).map(x=>({symbol:x.symbol,name:x.name,market:x.market,sector:x.sector,subSector:x.subSector,themes:x.themes,breadth:x.breadth,reviewRequired:x.reviewRequired,verification:{...x.verification,checkedAt:undefined}})));
 const changed=previous.checkedDate!==today||semantic(previous)!==semantic({entries});
 const output={version:1,method:VERIFICATION_METHOD,checkedDate:today,checkedAt,quoteDate:latest.date,sourceUrl:KIND_SOURCE,sourceSha256:sourceHash,listingCount:issuers.length,entries,summary:{examined:entries.length,verified,pending:entries.length-verified}};
 const target=changed?output:previous;
 const deployNeeded=changed||registry.verification?.checkedAt!==target.checkedAt||registry.verification?.sourceSha256!==target.sourceSha256;
 const report={deployNeeded,checkedAt,quoteDate:latest.date,source:KIND_SOURCE,sourceSha256:sourceHash,listingCount:issuers.length,changed,...output.summary,pendingReasons:Object.fromEntries([...new Set(entries.filter(x=>x.reviewRequired).map(x=>x.verification.reason))].map(reason=>[reason,entries.filter(x=>x.verification.reason===reason).length]))};
 return {output,report,changed};
}
async function main(){
 const now=new Date(args.now||Date.now()),date=kstDay(now),outputPath=path.resolve(ROOT,args.output||'src/data/stock-map-verified.json');
 const previous=await jsonFile(outputPath),catalog=await jsonFile(path.join(ROOT,'src/data/stock-map.json'));
 const dashboard=args.dashboard?await jsonFile(path.resolve(ROOT,args.dashboard)):JSON.parse(new TextDecoder().decode(await download(API+'/api/dashboard?date='+date,6000000)));
 const registry=args.registry?await jsonFile(path.resolve(ROOT,args.registry)):JSON.parse(new TextDecoder().decode(await download(API+'/api/stock-map',6000000)));
 const bytes=args.listing?new Uint8Array(await fs.readFile(path.resolve(ROOT,args.listing))):await download(KIND_SOURCE,4000000);
 const decoded=spawnSync('python3',['-c','import sys;sys.stdout.write(sys.stdin.buffer.read().decode("cp949"))'],{input:bytes,encoding:'utf8',maxBuffer:6000000,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
 if(decoded.status!==0||decoded.error)throw Error('KIND_ENCODING_INVALID');
 const issuers=parseKindCompanies(decoded.stdout);
 const result=verifyRegistry({dashboard,registry,catalog,previous,issuers,checkedAt:now.toISOString(),sourceHash:createHash('sha256').update(bytes).digest('hex')});
 if(result.changed)await fs.writeFile(outputPath,JSON.stringify(result.output,null,2)+'\n');
 const reportPath=path.resolve(ROOT,args.report||'work/stock-verification-report.json');await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))await main();
