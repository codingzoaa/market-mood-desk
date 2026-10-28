import assert from 'node:assert/strict';

const TZ = 'Asia/Seoul';
const formatKst = (d) => new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).reduce((o,p)=>(o[p.type]=p.value,o),{});
const datePart = (x) => x.year+'-'+x.month+'-'+x.day;
const num = (n) => Number.isFinite(n) ? n.toLocaleString('ko-KR',{maximumFractionDigits:2}) : '확인 불가';
const signed = (n) => (n>0?'+':'')+num(n);
const flow = (n) => Number.isFinite(n) ? num(Math.abs(n))+'억 '+(n>0?'순매수':n<0?'순매도':'보합') : '확인 불가';
const valid = (n) => typeof n==='number' && Number.isFinite(n);
const ensure = (condition,why) => { if(!condition) throw new Error(why); };
const kstStamp = (iso) => {
  ensure(typeof iso==='string' && Number.isFinite(Date.parse(iso)), 'INVALID_TIMESTAMP');
  const f=formatKst(new Date(iso));return {date:datePart(f),hhmm:f.hour+f.minute};
};
const fetchJson = async (url) => {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    ensure(r.ok,'DATA_HTTP_'+r.status);
    return await r.json();
  } finally { clearTimeout(timeout); }
};
const rec = (g,who) => g?.[who];
export function render(date,details) {
  ensure(details && details.date===date,'DATE_MISMATCH');
  const i=details.indices||{}, f=details.flows;
  for(const market of ['KOSPI','KOSDAQ']){
    ensure(i[market] && ['value','changePct','advances','unchanged','declines'].every(k=>valid(i[market][k])),'INDEX_MISSING_'+market);
    const t=kstStamp(i[market].asOf);
    ensure(t.date===date && t.hhmm>='1530','INDEX_NOT_CLOSED_'+market);
  }
  ensure(f && f.unit==='억원' && f.segments,'FLOW_MISSING');
  const stamp=kstStamp(f.asOf);
  ensure(stamp.date===date && stamp.hhmm>='1530','FLOW_NOT_CLOSED');
  for(const market of ['KOSPI','KOSDAQ','FUTURES','CALL','PUT']){
    const g=f.segments[market];
    ensure(g && ['individual','foreign','institution'].every(w=>valid(g[w])),'FLOW_MISSING_'+market);
  }
  const idx=(k,n)=>{
    const q=i[k];return k+' '+num(q.value)+' '+signed(q.changePct)+'% (상승 '+num(q.advances)+', 보합 '+num(q.unchanged)+', 하락 '+num(q.declines)+')';
  };
  const row=(key,label)=>{const s=f.segments[key];return '- '+label+': 개인 '+flow(s.individual)+' / 외국인 '+flow(s.foreign)+' / 기관 '+flow(s.institution);};
  const foreign=f.segments.KOSPI.foreign+f.segments.KOSDAQ.foreign;
  const futures=f.segments.FUTURES.foreign;
  const call=f.segments.CALL.foreign,put=f.segments.PUT.foreign;
  const sign=(n)=>n>0?'순매수':n<0?'순매도':'보합';
  const bullish=foreign>0&&futures>0, bearish=foreign<0&&futures<0;
  const direction=bullish?'상방 우위':bearish?'하방 우위':'중립 (현물·선물 수급 혼조)';
  return [
    date+' 국내 증시 장 마감 브리핑',
    '',
    '1. 국내 증시',
    idx('KOSPI'),idx('KOSDAQ'),
    '',
    '2. 국내 증시 투자자별 수급',
    '현물 수급',row('KOSPI','코스피'),row('KOSDAQ','코스닥'),
    '- ETF: 투자자별 수급 확인 불가 (금융투자 수급으로 대체하지 않음)',
    '',
    '파생상품 수급 (KOSPI200)',
    row('FUTURES','선물'),row('CALL','콜옵션'),row('PUT','풋옵션'),
    '',
    '3. 시장 방향성 판단',
    '단기 방향성: '+direction+' (변동성 경계)',
    '① 외국인 현물: 코스피 '+flow(f.segments.KOSPI.foreign)+', 코스닥 '+flow(f.segments.KOSDAQ.foreign)+'.',
    '② 외국인 선물: '+flow(futures)+'. OI 미확인으로 신규 포지션/청산 구분 불가.',
    '③ 외국인 옵션: 콜 '+flow(call)+', 풋 '+flow(put)+'. 헤지 및 기존 포지션 미확인으로 방향 단정 불가.',
    '',
    '※ LS증권 KRX t1511·t1601 저장자료 ('+stamp.hhmm.slice(0,2)+':'+stamp.hhmm.slice(2)+' KST 확인). 확정 여부는 거래소 별도 검증 필요.'
  ].join('\n');
}
export async function main(env=process.env) {
  for(const key of ['MARKET_DETAILS_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID']) ensure(env[key],'MISSING_'+key);
  const now=formatKst(new Date()), date=datePart(now);
  ensure(now.hour+now.minute>='1630','BEFORE_1630');
  ensure(!['Sat','Sun'].includes(new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short'}).format(new Date())),'WEEKEND');
  const url=new URL(env.MARKET_DETAILS_URL);
  ensure(url.protocol==='https:','HTTPS_REQUIRED');
  url.searchParams.set('date',date);
  const payload=await fetchJson(url);
  const report=render(date,payload.details);
  // Send only after strict data validation; no stale or estimated figures.
  const token=env.TELEGRAM_BOT_TOKEN;
  for(let p=0;p<report.length;p+=3500){
    const resp=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:report.slice(p,p+3500)})
    });
    ensure(resp.ok,'TELEGRAM_HTTP_'+resp.status);
    const out=await resp.json();ensure(out.ok,'TELEGRAM_REJECTED');
  }
  console.log('Telegram delivery accepted for '+date);
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  main().catch(e=>{console.error('Market close delivery failed:',e.message);process.exitCode=1;});
}
