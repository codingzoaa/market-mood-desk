import {validateDetails,type MarketDetails} from './market-details.ts';
export type Stock = { symbol: string; name: string; market: 'KOSPI' | 'KOSDAQ'; themes: string[]; price: number; changePct: number; turnoverKRW: number; instrumentType?: 'STOCK' | 'ETF' | 'ETN' };
export type Etf = { symbol: string; name: string; price: number; changePct: number; turnoverKRW: number };
export type Metrics = { kospi?: number; kospiChangePct?: number; kosdaq?: number; kosdaqChangePct?: number; nasdaqFutures?: number; nasdaqFuturesChangePct?: number; usdKrw?: number; usdKrwChangePct?: number; sox?: number; soxChangePct?: number; soxRs20d?: number; yield2y?: number; yield10y?: number; yield2yChangeBp?: number; yield10yChangeBp?: number; breadthAbove50?: number; advances?: number; declines?: number; vix?: number; creditSpreadBp?: number; riskFactors?: { breadth: number; vix: number; credit: number; sox: number; treasury: number } };
export type Snapshot = { date: string; asOf: string; source: string; stocks: Stock[]; etfs?: Etf[]; metrics: Metrics; note: string; details?:MarketDetails; stockAsOf?:string; marketUpdate?:{collectedAt:string;source:string;quoteTimes:{kospi:string;kosdaq:string;nasdaqFutures:string;usdKrw:string}} };
export const FACTORS = [{key:'breadth',name:'Breadth',weight:30},{key:'vix',name:'VIX',weight:25},{key:'credit',name:'Credit Spread',weight:20},{key:'sox',name:'SOX RS',weight:15},{key:'treasury',name:'Treasury',weight:10}] as const;
export function dayKey(date = new Date()) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function validDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
export function shiftDay(date: string, offset: number) { const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10); }
export function fourWeeks(end: string) { return Array.from({length:28},(_,i)=>shiftDay(end,i-27)); }
export function riskScore(metrics?: Metrics) { const f=metrics?.riskFactors; return f && FACTORS.every(x=>Number.isFinite(f[x.key])) ? Math.round(FACTORS.reduce((sum,x)=>sum+f[x.key]*x.weight/100,0)*10)/10 : null; }
export function regime(score: number|null) { return score===null ? {name:'판단 대기',tone:'muted',description:'구성 위험점수 5개가 필요합니다.'} : score>=75 ? {name:'위험 높음',tone:'red',description:'75 이상 · 포지션과 진입 조건을 점검'} : score>=50 ? {name:'경계',tone:'amber',description:'50–75 · 선별적인 관찰'} : {name:'위험 낮음',tone:'green',description:'50 미만 · 주도섹터의 확산 확인'}; }
// Product identifiers take precedence; name rules also cover legacy snapshots/CSV.
const FUND_BRANDS=/^(?:1Q|KTOP|WOORI|KODEX|TIGER|ACE|KINDEX|RISE|KBSTAR|PLUS|ARIRANG|SOL|HANARO|KIWOOM|KOSEF|KOACT|TIMEFOLIO|TIME|WON|BNK|FOCUS|VITA|TREX|POWER|HK|ITF|MASTER|UNICORN|TRUSTON|마이티|에셋플러스|히어로즈|파워|마이다스)(?=\s|[0-9가-힣])/i;
export function eligibleStocks(stocks:Stock[],etfs:Etf[]=[]){
 const fundIds=new Set(etfs.map(s=>s.symbol));
 return stocks.filter(s=>s.instrumentType!=='ETF'&&s.instrumentType!=='ETN'&&!fundIds.has(s.symbol)&&!FUND_BRANDS.test(s.name.trim())&&!/(?:ETF|ETN|레버리지|인버스|LEVERAGE(?:D)?|INVERSE)/i.test(s.name));
}
export function turnoverLeaders(stocks:Stock[],topN=50,market='ALL',etfs:Etf[]=[]){return eligibleStocks(stocks,etfs).filter(s=>market==='ALL'||s.market===market).sort((a,b)=>b.turnoverKRW-a.turnoverKRW||a.symbol.localeCompare(b.symbol)).slice(0,topN);}
export function gainers(stocks: Stock[], topN=50, market='ALL',etfs:Etf[]=[]) { return turnoverLeaders(stocks,topN,market,etfs).filter(s=>s.changePct>=4); }
export function kodexEtfs(etfs: Etf[] = []) { return etfs.filter(etf=>/^KODEX/i.test(etf.name.trim())); }
export function rankKodex(etfs: Etf[] = [], by:'turnover'|'change'='turnover') {
 return kodexEtfs(etfs).slice().sort((a,b)=>(by==='change'?b.changePct-a.changePct:b.turnoverKRW-a.turnoverKRW)||a.symbol.localeCompare(b.symbol)).slice(0,5);
}
export function rankSectors(stocks: Stock[],etfs:Etf[]=[]) {
 const map=new Map<string,{name:string;turnoverKRW:number;weighted:number;count:number;leaders:Stock[]}>();
 for(const s of eligibleStocks(stocks,etfs)) for(const theme of (s.themes.length?s.themes:['미분류'])) { const group=map.get(theme)||{name:theme,turnoverKRW:0,weighted:0,count:0,leaders:[]}; const amount=s.turnoverKRW/(s.themes.length||1);group.turnoverKRW+=amount;group.weighted+=s.changePct*amount;group.count++;group.leaders.push(s);map.set(theme,group); }
 const total=[...map.values()].reduce((a,b)=>a+b.turnoverKRW,0);
 return [...map.values()].map(s=>({...s,changePct:s.turnoverKRW?s.weighted/s.turnoverKRW:0,share:total?s.turnoverKRW/total*100:0,leaders:s.leaders.sort((a,b)=>b.turnoverKRW-a.turnoverKRW)})).sort((a,b)=>b.turnoverKRW-a.turnoverKRW);
}
export function rotations(snapshots: Snapshot[], end:string, topN=50, market='ALL') {
 const start=shiftDay(end,-27), recent=snapshots.filter(s=>s.date>=start&&s.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
 const map=new Map<string,{name:string;values:(number|null)[];appearances:number;total:number}>();
 recent.forEach((snap,i)=>{ for(const sector of rankSectors(gainers(snap.stocks,topN,market,snap.etfs))) { const row=map.get(sector.name)||{name:sector.name,values:Array(recent.length).fill(null),appearances:0,total:0};row.values[i]=sector.share;row.appearances++;row.total+=sector.turnoverKRW;map.set(row.name,row); } });
 return {dates:recent.map(s=>s.date),rows:[...map.values()].sort((a,b)=>b.total-a.total).slice(0,8)};
}
const text = (v:unknown,label:string,max=100) => { if(typeof v!=='string'||!v.trim()||v.length>max) throw new Error(label+' 형식을 확인하세요.');return v.trim(); };
const num=(v:unknown,label:string,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(label+' 범위를 확인하세요.');return v;};
export function validateSnapshot(raw: any, today=dayKey()): Snapshot {
 if(!raw||!validDate(raw.date)||raw.date>today) throw new Error('날짜는 오늘까지의 YYYY-MM-DD 형식이어야 합니다.');
 const asOf=text(raw.asOf,'시세 기준 시각',80); if(!/(Z|[+-]\d{2}:\d{2})$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||dayKey(new Date(asOf))!==raw.date) throw new Error('asOf에 시간대와 해당 날짜의 기준 시각을 넣으세요.');
 if(!Array.isArray(raw.stocks)||raw.stocks.length>3000) throw new Error('종목은 날짜당 3,000개 이하로 입력하세요.');
 const ids=new Set<string>();const stocks=raw.stocks.map((s:any)=>{const symbol=text(s.symbol,'종목코드',6);if(!/^\d{6}$/.test(symbol)||ids.has(symbol)) throw new Error('종목코드는 중복 없는 6자리 숫자여야 합니다.');ids.add(symbol);if(!['KOSPI','KOSDAQ'].includes(s.market))throw new Error('시장은 KOSPI 또는 KOSDAQ입니다.');if(!Array.isArray(s.themes)||s.themes.length>5)throw new Error('테마는 5개 이하 배열로 입력하세요.');if(s.instrumentType!==undefined&&!['STOCK','ETF','ETN'].includes(s.instrumentType))throw Error('종목 유형을 확인하세요.');return {symbol,...(s.instrumentType?{instrumentType:s.instrumentType}:{}),name:text(s.name,'종목명',80),market:s.market,themes:[...new Set<string>(s.themes.map((t:any)=>text(t,'테마',40)))],price:num(s.price,'가격',0,1e9),changePct:num(s.changePct,'등락률',-100,10000),turnoverKRW:num(s.turnoverKRW,'거래대금(원)',0,1e15)};});
 const etfIds=new Set<string>();
 if(raw.etfs!==undefined&&(!Array.isArray(raw.etfs)||raw.etfs.length>2000))throw new Error('ETF는 날짜당 2,000개 이하 배열로 입력하세요.');
 const etfs:Etf[]=(raw.etfs||[]).map((item:any)=>{const symbol=text(item.symbol,'ETF 종목코드',6).toUpperCase();if(!/^[0-9A-Z]{6}$/.test(symbol)||etfIds.has(symbol))throw new Error('ETF 코드는 중복 없는 6자리 영문·숫자여야 합니다.');etfIds.add(symbol);return {symbol,name:text(item.name,'ETF명',100),price:num(item.price,'ETF 가격',0,1e9),changePct:num(item.changePct,'ETF 등락률',-100,10000),turnoverKRW:num(item.turnoverKRW,'ETF 거래대금(원)',0,1e15)};});
 const metrics:Metrics={};const r=raw.metrics||{};const ranges:Record<string,[number,number]>={kospi:[0,1e7],kospiChangePct:[-100,10000],kosdaq:[0,1e7],kosdaqChangePct:[-100,10000],nasdaqFutures:[0,1e8],nasdaqFuturesChangePct:[-100,10000],usdKrw:[0,1e6],usdKrwChangePct:[-100,10000],sox:[0,1e7],soxChangePct:[-100,100],soxRs20d:[-100,10000],yield2y:[-10,100],yield10y:[-10,100],yield2yChangeBp:[-10000,10000],yield10yChangeBp:[-10000,10000],breadthAbove50:[0,100],advances:[0,100000],declines:[0,100000],vix:[0,1000],creditSpreadBp:[0,10000]};
 for(const [key,range] of Object.entries(ranges)) if(r[key]!==undefined&&r[key]!==null) (metrics as any)[key]=num(r[key],key,...range);
 if(r.riskFactors!==undefined&&r.riskFactors!==null) { const f:any={};FACTORS.forEach(x=>{f[x.key]=num(r.riskFactors[x.key],x.name+' 위험점수',0,100);});metrics.riskFactors=f; }
 const stockAsOf=raw.stockAsOf;if(stockAsOf!==undefined&&(typeof stockAsOf!=='string'||!Number.isFinite(Date.parse(stockAsOf))||dayKey(new Date(stockAsOf))!==raw.date))throw new Error('개별 종목 기준 시각을 확인하세요.');
 return {...(raw.details?{details:validateDetails(raw.details,raw.date)}:{}),date:raw.date,asOf,source:text(raw.source,'출처',120),stocks,etfs,metrics,...(stockAsOf?{stockAsOf}:{}),note:typeof raw.note==='string'?raw.note.slice(0,3000):''};
}
export function validateImport(raw:any,today=dayKey()) { if(raw?.schemaVersion!==2||!Array.isArray(raw.snapshots)||!raw.snapshots.length||raw.snapshots.length>60)throw new Error('schemaVersion: 2와 1–60개 snapshots가 필요합니다.');const snapshots=raw.snapshots.map((x:any)=>validateSnapshot(x,today));if(new Set(snapshots.map((s:Snapshot)=>s.date)).size!==snapshots.length)throw new Error('파일 안에 중복 날짜가 있습니다.');return snapshots as Snapshot[]; }
export function parseCSV(content:string,source='CSV 업로드'): Snapshot[] {
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;const input=content.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else if(!quoted&&field.length)throw new Error('CSV 따옴표 위치를 확인하세요.');else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw new Error('CSV 따옴표가 닫히지 않았습니다.');row.push(field);if(row.some(Boolean))rows.push(row);const headers=rows.shift()?.map(x=>x.trim())||[];const required=['date','asOf','symbol','name','market','themes','price','changePct','turnoverKRW'];if(required.some(x=>!headers.includes(x)))throw new Error('CSV 필수 헤더: '+required.join(','));const grouped=new Map<string,any>();
 for(const cells of rows){if(cells.length!==headers.length)throw new Error('CSV 열 개수를 확인하세요.');const r:any=Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));let s=grouped.get(r.date);if(!s){s={date:r.date,asOf:r.asOf,source:r.source||source,stocks:[],metrics:{},note:''};grouped.set(r.date,s);}if(s.asOf!==r.asOf)throw new Error('같은 날짜의 asOf는 동일해야 합니다.');for(const k of ['price','changePct','turnoverKRW']){if(!r[k].trim())throw new Error(k+' 값을 넣으세요.');r[k]=Number(r[k].replace(/,/g,''));}s.stocks.push({...r,themes:r.themes.split('|').map((x:string)=>x.trim()).filter(Boolean)});}
 return validateImport({schemaVersion:2,snapshots:[...grouped.values()]});
}
export function demoSnapshots(end=dayKey()):Snapshot[] {
 const pool=[['000660','SK하이닉스','KOSPI',['반도체']],['005930','삼성전자','KOSPI',['반도체']],['010120','LS ELECTRIC','KOSPI',['AI 전력']],['042700','한미반도체','KOSPI',['반도체','반도체 장비']],['298040','효성중공업','KOSPI',['AI 전력']],['230360','에코마케팅','KOSDAQ',['광고']],['079550','LIG넥스원','KOSPI',['방산']],['189300','인텔리안테크','KOSDAQ',['우주·통신']],['267260','HD현대일렉트릭','KOSPI',['AI 전력']],['329180','HD현대중공업','KOSPI',['조선']]];
 const etfPool=[['069500','KODEX 200'],['229200','KODEX 코스닥150'],['122630','KODEX 레버리지'],['091160','KODEX 반도체'],['379800','KODEX 미국S&P500'],['379810','KODEX 미국나스닥100']];
 return fourWeeks(end).filter(d=>![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay())).map((date,i)=>({date,asOf:date+'T15:30:00+09:00',source:'시뮬레이션 · 실제 시세 아님',note:'학습용 예시입니다. 거래대금과 등락률은 가상 수치입니다.',stocks:pool.map((p,j)=>({symbol:p[0] as string,name:p[1] as string,market:p[2] as Stock['market'],themes:p[3] as string[],price:Math.round((70000+j*31000+i*1300)/100)*100,changePct:+(j===1?2.3:3.2+((i*3+j*5)%18)/3).toFixed(2),turnoverKRW:(700+((i*137+j*321)%3000))*1e8})),etfs:etfPool.map(([symbol,name],j)=>({symbol,name,price:12000+j*5500+i*125,changePct:+(0.7+((i*3+j*7)%24)/4).toFixed(2),turnoverKRW:(60+((i*23+j*89)%900))*1e8})),metrics:{kospi:2750+i*9,kospiChangePct:0.83,kosdaq:850+i*2,kosdaqChangePct:1.24,nasdaqFutures:21000+i*45,nasdaqFuturesChangePct:-0.32,usdKrw:1350+i*0.3,usdKrwChangePct:0.18,sox:5100+i*17,soxChangePct:1.28,soxRs20d:6.8,yield2y:4.08,yield10y:4.43,yield2yChangeBp:2,yield10yChangeBp:6,breadthAbove50:47+i%17,advances:1300,declines:980,vix:19.4,creditSpreadBp:320,riskFactors:{breadth:38+i%10,vix:28,credit:36,sox:25,treasury:65}}}));
}
