// A missing or inconsistent OHLC must never turn a valid close into a fake candle.
export function validOHLC(raw,close){
 if(!raw)return null;
 const fields=['open','high','low','close'];
 if(fields.some(k=>typeof raw[k]!=='number'||!Number.isFinite(raw[k])||raw[k]<=0||raw[k]>1e7))return null;
 if(raw.high<Math.max(raw.open,raw.close)||raw.low>Math.min(raw.open,raw.close)||raw.high<raw.low||Math.abs(raw.close-close)>.000001)return null;
 return Object.fromEntries(fields.map(k=>[k,raw[k]]));
}
const numeric=v=>typeof v==='number'?v:typeof v==='string'&&/^\d+(\.\d+)?$/.test(v.trim())?Number(v):NaN;
export function lsIndexOHLC(row){
 if(!row)return null;
 const close=numeric(row.pricejisu);
 return validOHLC({open:numeric(row.openjisu),high:numeric(row.highjisu),low:numeric(row.lowjisu),close},close);
}
export function archivedIndexCandles(probe,now=new Date()){
 if(probe?.status!=='DONE'||!Number.isFinite(Date.parse(probe.capturedAt))||Date.parse(probe.capturedAt)>now.getTime())return [];
 const page=probe.pages?.find(p=>p.code==='t8429');
 if(!page||page.http!==200||!/^0+$/.test(page.responseCode||'')||page.continuation==='Y'||page.input?.shcode!=='001'||page.input?.gubun!=='2'||!/^sha256:[a-f0-9]{64}$/.test(page.sourceHash||'')||!Array.isArray(page.blocks?.t8429OutBlock1)||page.blocks.t8429OutBlock1.length>500)return [];
 const seen=new Set();const points=[];
 for(const row of page.blocks.t8429OutBlock1){
  if(!/^\d{8}$/.test(row.date))continue;
  const date=row.date.slice(0,4)+'-'+row.date.slice(4,6)+'-'+row.date.slice(6);
  if(!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||Date.parse(date+'T15:30:00+09:00')>Date.parse(probe.capturedAt)||seen.has(date))continue;
  const close=numeric(row.close),ohlc=validOHLC(Object.fromEntries(['open','high','low','close'].map(k=>[k,numeric(row[k])])),close);if(!ohlc)continue;
  seen.add(date);points.push({date,ohlc,ohlcSource:'LS증권 t8429 · KRX 일봉',ohlcAsOf:probe.capturedAt,ohlcHash:page.sourceHash});
 }
 return points;
}
export function attachIndexCandles(points,candles){
 const byDate=new Map();for(const c of candles)if(!byDate.has(c.date))byDate.set(c.date,c);
 return points.map(p=>{if(validOHLC(p.ohlc,p.kospi))return p;const c=byDate.get(p.date);return c&&validOHLC(c.ohlc,p.kospi)?{...p,ohlc:c.ohlc,ohlcSource:c.ohlcSource,ohlcAsOf:c.ohlcAsOf,ohlcHash:c.ohlcHash}:p;});
}
