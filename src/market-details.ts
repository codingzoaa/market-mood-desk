export type Board='KOSPI'|'KOSDAQ';
export type IndexDetail={value:number;change:number;changePct:number;advances:number;unchanged:number;declines:number;asOf:string;series:{time:string;value:number}[]};
export type Flow={foreign:number;institution:number;individual:number;financial:number};
export type HeatStock={symbol:string;name:string;market:Board;sector:string;changePct:number;marketCap:number};
export type MarketDetails={date:string;asOf:string;indices:Partial<Record<Board,IndexDetail>>;flows?:{asOf:string;unit:'억원';source:string;segments:Record<'KOSPI'|'KOSDAQ'|'FUTURES'|'CALL'|'PUT',Flow>};heatmap?:{asOf:string;source:string;stocks:HeatStock[]};errors:Record<string,string>};
const num=(v:any,min=-1e15,max=1e17)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('시장 상세 수치 오류');return v;};
const str=(v:any,max=120)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('시장 상세 문자 오류');return v;};
const timestamp=(v:any,date:string)=>{str(v,40);if(!/(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v))||(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(v))<date||Date.parse(v)-Date.parse(date+'T00:00:00+09:00')>8*86400000||Date.parse(v)>Date.now()+60000))throw Error('시장 상세 날짜 오류');return v as string;};
export function validateDetails(raw:any,date:string):MarketDetails{
 if(!raw||raw.date!==date)throw Error('시장 상세 기준일 오류');
 const result:MarketDetails={date,asOf:timestamp(raw.asOf,date),indices:{},errors:{}};
 for(const market of ['KOSPI','KOSDAQ'] as const){const q=raw.indices?.[market];if(!q)continue;if(!Array.isArray(q.series)||q.series.length>500)throw Error('지수 추이 오류');const times=new Set<string>();result.indices[market]={value:num(q.value,0,1e7),change:num(q.change,-1e7,1e7),changePct:num(q.changePct,-100,10000),advances:num(q.advances,0,10000),unchanged:num(q.unchanged,0,10000),declines:num(q.declines,0,10000),asOf:timestamp(q.asOf,date),series:q.series.map((p:any)=>{if(!/^([01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(p.time)||times.has(p.time))throw Error('지수 시각 오류');times.add(p.time);return {time:p.time,value:num(p.value,0,1e7)};}).sort((a:any,b:any)=>a.time.localeCompare(b.time))};}
 if(raw.flows){if(raw.flows.unit!=='억원')throw Error('수급 단위 오류');const segments={} as NonNullable<MarketDetails['flows']>['segments'];for(const key of ['KOSPI','KOSDAQ','FUTURES','CALL','PUT'] as const){const f=raw.flows.segments?.[key];segments[key]={foreign:num(f?.foreign),institution:num(f?.institution),individual:num(f?.individual),financial:num(f?.financial)};}result.flows={asOf:timestamp(raw.flows.asOf,date),unit:'억원',source:str(raw.flows.source),segments};}
 if(raw.heatmap){const ids=new Set();if(!Array.isArray(raw.heatmap.stocks)||raw.heatmap.stocks.length>6000)throw Error('히트맵 종목 오류');result.heatmap={asOf:timestamp(raw.heatmap.asOf,date),source:str(raw.heatmap.source),stocks:raw.heatmap.stocks.map((s:any)=>{const symbol=str(s.symbol,6);if(!/^[0-9A-Z]{6}$/.test(symbol)||ids.has(symbol)||!['KOSPI','KOSDAQ'].includes(s.market))throw Error('히트맵 종목코드 오류');ids.add(symbol);return {symbol,name:str(s.name,80),market:s.market,sector:str(s.sector,60),changePct:num(s.changePct,-100,10000),marketCap:num(s.marketCap,1,1e17)};})};}
 for(const [key,value] of Object.entries(raw.errors||{}).slice(0,10))result.errors[str(key,30)]=str(value,100);
 return result;
}
// Binary partition preserves areas exactly and keeps each market's hierarchy intact.
export function tileLayout<T>(items:T[],weight:(item:T)=>number,x=0,y=0,w=1000,h=620):{item:T;x:number;y:number;w:number;h:number}[]{
 if(!items.length)return [];if(items.length===1)return [{item:items[0],x,y,w,h}];
 const total=items.reduce((s,t)=>s+weight(t),0);let sum=0,split=1;
 for(let i=0;i<items.length-1;i++){sum+=weight(items[i]);split=i+1;if(sum>=total/2)break;}
 const ratio=sum/total;
 return w>=h?[...tileLayout(items.slice(0,split),weight,x,y,w*ratio,h),...tileLayout(items.slice(split),weight,x+w*ratio,y,w*(1-ratio),h)]:[...tileLayout(items.slice(0,split),weight,x,y,w,h*ratio),...tileLayout(items.slice(split),weight,x,y+h*ratio,w,h*(1-ratio))];
}
export const heatColor=(n:number)=>n>=3?'#ef283a':n>=2?'#d3293b':n>=1?'#a53846':n>0?'#79414a':n===0?'#414954':n> -1?'#3b5275':n> -2?'#315c9d':n> -3?'#245cca':'#1764ed';
export function demoMarketDetails(s:{date:string;asOf:string;metrics:any;stocks:any[]}):MarketDetails{
 const indices:MarketDetails['indices']={};for(const [board,key,offset] of [['KOSPI','kospi',0],['KOSDAQ','kosdaq',1]] as const){const value=s.metrics[key];indices[board]={value,change:value-value/(1+s.metrics[key+'ChangePct']/100),changePct:s.metrics[key+'ChangePct'],advances:630+offset*310,unchanged:41+offset*17,declines:267+offset*89,asOf:s.asOf,series:Array.from({length:79},(_,i)=>({time:String(9+Math.floor(i*5/60)).padStart(2,'0')+String(i*5%60).padStart(2,'0')+'00',value:value*(0.99+i/7800+Math.sin(i*0.8)*0.0008)}))};}
 const flow=(a:number,b:number,c:number,d:number):Flow=>({foreign:a,institution:b,individual:c,financial:d});
 return {date:s.date,asOf:s.asOf,indices,errors:{},flows:{asOf:s.asOf,unit:'억원',source:'시뮬레이션 · 실제 수급 아님',segments:{KOSPI:flow(-360,5782,-10895,1389),KOSDAQ:flow(-1437,669,640,704),FUTURES:flow(-2234,2153,257,0),CALL:flow(9,-2,-6,0),PUT:flow(-21,4,13,0)}},heatmap:{asOf:s.asOf,source:'시뮬레이션 · 가상 업종·시가총액',stocks:s.stocks.map((item,i)=>({symbol:item.symbol,name:item.name,market:item.market,sector:item.themes[0]||'기타',changePct:i%4===0?-1.5-item.changePct/4:item.changePct,marketCap:(15-i)*1e12}))}};
}
