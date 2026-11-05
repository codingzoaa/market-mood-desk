import {canonical,hash,gzip,gunzip,ensure,iso,slotOf,validDate} from './util.mjs';
const pick=(object,keys)=>Object.fromEntries(keys.filter(k=>object?.[k]!==undefined).map(k=>[k,object[k]]));
function quote(q){
 const result=pick(q,['symbol','name','market','instrumentType','asOf','availableAt','price','previousClose','turnoverKRW','open','high','low']);
 if(q.finality)result.finality=pick(q.finality,['sourceConfirmed','source','confirmedAt','finalPrice','finalTurnover','finalOHLC']);
 if(q.bars)result.bars=q.bars.map(b=>pick(b,['asOf','availableAt','high','low','close']));
 if(q.rvolBaseline)result.rvolBaseline=pick(q.rvolBaseline,['targetDate','symbol','slot','sumTurnover','samples','dates','availableAt','version','timingBasis']);
 result.history=q.history.map(b=>pick(b,['date','availableAt','source','final','adjusted','close','open','high','low','turnoverKRW','cumulative']));return result;
}
function safeShared(shared){return {...pick(shared,['date','asOf','source','universe','isTradingDay','excludedProductSymbols']),calendar:pick(shared.calendar,['verified','tradingDays']),quotes:shared.quotes.map(quote),benchmarks:Object.fromEntries(Object.entries(shared.benchmarks).map(([market,b])=>[market,quote(b)]))};}
function safeScore(score){return pick(score,['id','date','asOf','entityType','entityId','mode','status','score','grade','factors','missingFactors','universe','methodologyVersion']);}
function safeEntity(entity){const e=pick(entity,['type','id']);if(entity.membership)e.membership=pick(entity.membership,['symbols','effectiveDate','knownAt','version']);return e;}
function safeRequest(request){return request.entity?{entity:safeEntity(request.entity),...pick(request,['quoteSymbols','sectorId']),...(request.sectorScore?{sectorScore:safeScore(request.sectorScore)}:{})}:safeEntity(request);}
/** One shared history context per date/universe revision, one compressed frame per cutoff.
 * Never writes one history/score row per stock at every five-minute tick. */
export async function saveReplay(db,{shared,entities,scores,mode,version}){
 shared=safeShared(shared);entities=entities.map(safeRequest);scores=scores.map(safeScore);
 ensure(validDate(shared.date)&&['INTRADAY','EOD'].includes(mode)&&typeof version==='string'&&version.length>0&&entities.length===scores.length,'INVALID_REPLAY');
 const context={calendar:shared.calendar,histories:Object.fromEntries(shared.quotes.map(q=>[q.symbol,q.history])),benchmarkHistories:Object.fromEntries(Object.entries(shared.benchmarks).map(([m,q])=>[m,q.history]))};
 const strip=q=>{const {history,...current}=q;return current;};
 const current={...shared,asOf:iso(shared.asOf),quotes:shared.quotes.map(strip),benchmarks:Object.fromEntries(Object.entries(shared.benchmarks).map(([m,q])=>[m,strip(q)]))};
 const contextText=canonical(context),contextHash=await hash(contextText),body={shared:current,entities,scores,contextHash,mode,version};
 const text=canonical(body),digest=await hash(text),contextBytes=await gzip(contextText),frameBytes=await gzip(text);
 ensure(contextBytes.length<1500000&&frameBytes.length<1500000,'REPLAY_SIZE_LIMIT');
 const key=[shared.date,iso(shared.asOf),mode,version];
 const existing=await db.query('SELECT sha256 FROM replay_frames WHERE date=? AND as_of=? AND mode=? AND version=?',key);
 if(existing.length){ensure(existing[0].sha256===digest,'REPLAY_KEY_CONFLICT');return {reused:true,hash:digest};}
 await db.batch([
  ['INSERT OR IGNORE INTO replay_contexts VALUES(?,?,?)',[contextHash,contextBytes,contextBytes.length]],
  ['INSERT OR IGNORE INTO replay_frames VALUES(?,?,?,?,?,?,?,?)',[shared.date,iso(shared.asOf),slotOf(shared.asOf),mode,version,contextHash,digest,frameBytes]],
 ]);
 const written=await db.query('SELECT sha256 FROM replay_frames WHERE date=? AND as_of=? AND mode=? AND version=?',key);ensure(written[0]?.sha256===digest,'REPLAY_KEY_CONFLICT');
 return {reused:false,hash:digest,compressedBytes:frameBytes.length,contextBytes:contextBytes.length};
}
export async function loadReplay(db,{date,asOf,mode,version}){
 const frames=await db.query('SELECT * FROM replay_frames WHERE date=? AND as_of=? AND mode=? AND version=?',[date,iso(asOf),mode,version]);if(!frames.length)return null;const frame=frames[0];
 const text=new TextDecoder().decode(await gunzip(frame.payload));ensure(await hash(text)===frame.sha256,'REPLAY_HASH_MISMATCH');const body=JSON.parse(text);
 const contexts=await db.query('SELECT payload FROM replay_contexts WHERE hash=?',[body.contextHash]);ensure(contexts.length===1,'REPLAY_CONTEXT_MISSING');const contextText=new TextDecoder().decode(await gunzip(contexts[0].payload));ensure(await hash(contextText)===body.contextHash,'REPLAY_CONTEXT_HASH_MISMATCH');const context=JSON.parse(contextText);
 const shared={...body.shared,calendar:context.calendar,quotes:body.shared.quotes.map(q=>({...q,history:context.histories[q.symbol]})),benchmarks:Object.fromEntries(Object.entries(body.shared.benchmarks).map(([m,q])=>[m,{...q,history:context.benchmarkHistories[m]}]))};
 return {...body,shared};
}
