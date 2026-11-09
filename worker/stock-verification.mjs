// Business classifications only: never infer an investment theme from a name,
// price change, or a loosely matched theme word.
export const KIND_SOURCE='https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13';
export const VERIFICATION_METHOD='KRX_KIND_IDENTITY_INDUSTRY_V1';
const FUNDS=/^(?:1Q|KTOP|WOORI|KODEX|TIGER|ACE|KINDEX|RISE|KBSTAR|PLUS|ARIRANG|SOL|HANARO|KIWOOM|KOSEF|KOACT|TIMEFOLIO|TIME|WON|BNK|FOCUS|VITA|TREX|POWER|HK|ITF|MASTER|UNICORN|TRUSTON|마이티|에셋플러스|히어로즈|파워|마이다스)(?=\s|[0-9가-힣])/i;
export const pendingSector=value=>typeof value!=='string'||!value.trim()||/분류\s*대기|검토|미분류/.test(value);
export function sectorCandidate(x){return !!x&&/^\d{6}$/.test(x.symbol)&&['KOSPI','KOSDAQ'].includes(x.market)&&typeof x.name==='string'&&!!x.name.trim()&&x.name.length<=80&&x.instrumentType!=='ETF'&&x.instrumentType!=='ETN'&&!FUNDS.test(x.name.trim())&&!/(?:ETF|ETN|레버리지|인버스|기업인수목적|스팩|LEVERAGE(?:D)?|INVERSE)/i.test(x.name);}
export const identityName=value=>String(value||'').normalize('NFKC').replace(/\(주\)|주식회사/g,'').replace(/\s+/g,'').toUpperCase();
function unescapeHtml(text){return text.replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();}
export function parseKindCompanies(html,{minRows=2000}={}){
 if(typeof html!=='string'||html.length>6000000||/\ufffd/.test(html))throw Error('KIND_ENCODING_OR_SIZE');
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>unescapeHtml(c[1])));
 const required=['회사명','시장구분','종목코드','업종','주요제품'];
 const headerIndex=rows.findIndex(r=>required.every(h=>r.includes(h)));if(headerIndex<0)throw Error('KIND_HEADER_MISSING');
 const header=rows[headerIndex],columns=required.map(h=>header.indexOf(h)),seen=new Set(),out=[];
 for(const row of rows.slice(headerIndex+1)){
  if(row.length!==header.length)throw Error('KIND_ROW_SHAPE');
  const [name,marketText,symbol,industry,products]=columns.map(i=>row[i]);
  if(!/^[0-9A-Z]{6}$/.test(symbol)||!name||name.length>80||!industry||industry.length>120||products.length>1000||seen.has(symbol))throw Error('KIND_ROW_IDENTITY');
  seen.add(symbol);const market=['유가','유가증권','코스피'].includes(marketText)?'KOSPI':marketText==='코스닥'?'KOSDAQ':marketText==='코넥스'?'KONEX':null;if(!market)throw Error('KIND_MARKET_UNKNOWN');
  out.push({symbol,name,market,industry,products});
 }
 if(out.length<minRows||out.length>6000||minRows>=2000&&(out.filter(x=>x.market==='KOSPI').length<500||out.filter(x=>x.market==='KOSDAQ').length<1000))throw Error('KIND_COVERAGE_INCOMPLETE');
 return out;
}
export function officialSector(issuer){
 const i=issuer.industry,p=issuer.products;
 if(/기타 금융업/.test(i)&&/^(?:비금융)?지주회사$/.test(p.replace(/\s/g,'')))return '지주사';
 const rules=[
  [/반도체 제조|전자 집적회로 제조/,'반도체'],
  [/컴퓨터 프로그래밍|시스템 통합|소프트웨어 개발/,'IT서비스'],
  [/포털|인터넷 정보매개/,'인터넷'],
  [/일차전지|이차전지 제조/,'2차전지'],
  [/자동차|트레일러/,'자동차'],
  [/선박 및 보트 건조|선박 건조/,'조선'],
  [/운송업|운송관련|운송 관련|보관 및 창고/,'운송'],
  [/화장품 제조/,'화장품'],
  [/전동기|발전기 및 전기|전기 변환|전기 공급 및 제어/,'전력기기'],
  [/목적용 기계 제조/,'기계'],
  [/전자부품 제조/,'전자부품'],
  [/통신 및 방송 장비/,'통신장비'],
  [/의약품 제조|기초 의약물질|생물학적 제제/,'바이오'],
  [/은행 및 저축기관|금융 지원 서비스|금융 및 보험 관련 서비스/,'금융·증권'],
  [/보험업|재 보험업/,'보험'],
  [/기초 화학물질|합성고무|화학제품 제조/,'화학']
 ];
 const matches=[...new Set(rules.filter(([re])=>re.test(i)).map(([,sector])=>sector))];
 if(matches.length>1)return null;
 if(matches.length===1)return matches[0];
 if(/^(?:기타|그 외)|분류|금융업$/.test(i)||i.length>40)return null;
 return i; // Exact exchange industry, rather than a guessed theme.
}
export function verifyKindIdentity(stock,issuer,checkedAt){
 const verifiedDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checkedAt));
 const reject=reason=>({symbol:stock.symbol,name:stock.name,market:stock.market,updatedAt:verifiedDay,sector:'분류 대기',subSector:'분류 대기',themes:[],breadth:false,reviewRequired:true,verification:{status:'pending',method:VERIFICATION_METHOD,reason,checkedAt,sourceUrl:KIND_SOURCE,...(issuer?{industry:issuer.industry,products:issuer.products}: {})}});
 if(!issuer)return reject('NO_OFFICIAL_ISSUER');
 if(stock.symbol!==issuer.symbol||stock.market!==issuer.market||identityName(stock.name)!==identityName(issuer.name))return reject('ISSUER_IDENTITY_MISMATCH');
 const sector=officialSector(issuer);if(!sector)return reject('INDUSTRY_REQUIRES_REVIEW');
 return {symbol:stock.symbol,name:stock.name,market:stock.market,sector,subSector:issuer.industry,themes:[sector],breadth:false,reviewRequired:false,source:'KRX KIND · 코드·시장·회사명·공식 업종 확인',updatedAt:verifiedDay,verification:{status:'verified',method:VERIFICATION_METHOD,checkedAt,sourceUrl:KIND_SOURCE,issuerName:issuer.name,industry:issuer.industry,products:issuer.products}};
}
