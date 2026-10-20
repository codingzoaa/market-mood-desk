import {validateHistoricalCloseRecord} from './correlation-history.mjs';
const fail=code=>{throw Error(code);};
const num=value=>{if(!['number','string'].includes(typeof value)||!/^[-+]?\d+(?:\.\d+)?$/.test(String(value).trim()))fail('INVALID_BACKFILL_NUMBER');const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e12)fail('INVALID_BACKFILL_NUMBER');return n;};
const date=value=>{if(typeof value!=='string'||!/^\d{8}$/.test(value))fail('INVALID_BACKFILL_DATE');const s=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6);if(new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)fail('INVALID_BACKFILL_DATE');return s;};
const mapRows=rows=>{if(!Array.isArray(rows)||rows.length>500)fail('BACKFILL_ROWS_REQUIRED');const map=new Map();for(const row of rows){const d=date(row.date);if(map.has(d))fail('DUPLICATE_BACKFILL_DATE');map.set(d,row);}return map;};
export function normalizeLSCorrelationBackfill(probe,{now=new Date(),from='2026-10-01',to='2026-10-19',referenceDate='2026-10-20'}={}){
 if(probe?.status!=='DONE'||!Array.isArray(probe.pages))fail('BACKFILL_NOT_READY');
 const page=code=>{const p=probe.pages.find(p=>p.code===code);if(!p||p.http!==200||!/^0+$/.test(p.responseCode||'')||p.continuation==='Y')fail('INCOMPLETE_BACKFILL_'+code);return p;};
 const chart=page('t8429'),flow=page('t1665'),reference=page('t1601');
 if(chart.input.shcode!=='001'||chart.input.gubun!=='2'||flow.input.market!=='1'||flow.input.upcode!=='001'||flow.input.gubun2!=='1'||flow.input.gubun3!=='1'||flow.input.exchgubun!=='K'||reference.input.gubun1!=='2'||reference.input.gubun2!=='2'||reference.input.gubun4!=='2'||reference.input.exchgubun!=='K')fail('WRONG_BACKFILL_MARKET');
 const prices=mapRows(chart.blocks.t8429OutBlock1),flows=mapRows(flow.blocks.t1665OutBlock1),ref=reference.blocks.t1601OutBlock1;
 const overlap=flows.get(referenceDate);if(!overlap||!ref)fail('UNIT_REFERENCE_MISSING');
 const groups=['08','17','18'],expected=groups.map(g=>num(ref['svolume_'+g]));
 if(expected.filter(n=>Math.abs(n)>10).length<2)fail('UNIT_REFERENCE_INSUFFICIENT');
 const scales=[1,0.01].filter(factor=>groups.every((g,i)=>Math.abs(num(overlap['sa_'+g])*factor-expected[i])<=Math.max(5,Math.abs(expected[i])*.0005)));
 if(scales.length!==1)fail('INVESTOR_AMOUNT_UNIT_MISMATCH');const factor=scales[0];
 const indexScales=[1,100].filter(scale=>[...flows].filter(([d])=>prices.has(d)).every(([d,row])=>Math.abs(num(row.jisu)/scale-num(prices.get(d).close))<=.011));
 if(indexScales.length!==1)fail('INDEX_HISTORY_MISMATCH');
 const days=[...prices.keys()].sort(),records=[];
 for(let i=0;i<days.length;i++){
  const d=days[i];if(d<from||d>to)continue;
  const row=flows.get(d);if(!row||i===0)fail('HISTORY_PAIR_MISSING');
  const close=num(prices.get(d).close),previous=num(prices.get(days[i-1]).close);if(close<=0||previous<=0)fail('INVALID_INDEX_CLOSE');
  const record={date:d,method:'LS_KOSPI_DAILY_V1',market:'KOSPI',unit:'억원',final:true,kospi:close,changePct:Math.round((close/previous-1)*10000)/100,individual:num(row.sa_08)*factor,indexSource:'https://openapi.ls-sec.co.kr:8080/indtp/chart',flowSource:'https://openapi.ls-sec.co.kr:8080/stock/chart',indexHash:chart.sourceHash,flowHash:flow.sourceHash,fetchedAt:probe.capturedAt,unitVerification:{method:'T1665_VS_T1601_3_GROUPS',date:referenceDate,factorToEok:factor,referenceHash:reference.sourceHash},indexVerification:'T1665_VS_T8429'};
  records.push(validateHistoricalCloseRecord(record,{from,to,now}));
 }
 if(!records.length)fail('NO_BACKFILL_RECORDS');return {records,validation:{dates:records.map(r=>r.date),amountFactorToEok:factor,indexDivisor:indexScales[0],referenceGroups:3,sourceTRs:['t8429','t1665','t1601']}};
}
