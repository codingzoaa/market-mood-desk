import {businessTaxonomy,TAXONOMY_VERSION,ISSUER_ALIASES,SHARE_LINKS} from './stock-taxonomy.mjs';
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
export const officialSector=issuer=>businessTaxonomy(issuer)?.sector||null;
export function resolveListedIssuer(stock,byIssuer){
 const direct=byIssuer.get(stock.symbol);if(direct)return direct;
 const link=SHARE_LINKS[stock.symbol];
 if(!link||stock.name!==link.name||stock.market!==link.market)return undefined;
 const issuer=byIssuer.get(link.issuerSymbol);
 return issuer?.name===link.issuerName&&issuer.market===link.market?{...issuer,shareLink:link}:undefined;
}
export function verifyKindIdentity(stock,issuer,checkedAt){
 const verifiedDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checkedAt));
 const reject=reason=>({symbol:stock.symbol,name:stock.name,market:stock.market,updatedAt:verifiedDay,sector:'분류 대기',subSector:'분류 대기',themes:[],breadth:false,reviewRequired:true,verification:{status:'pending',method:VERIFICATION_METHOD,reason,checkedAt,sourceUrl:KIND_SOURCE,...(issuer?{industry:issuer.industry,products:issuer.products}: {})}});
 if(!issuer)return reject('NO_OFFICIAL_ISSUER');
 const alias=ISSUER_ALIASES[stock.symbol],share=issuer.shareLink;
 const aliasMatch=alias&&alias.market===stock.market&&identityName(alias.quote)===identityName(stock.name)&&identityName(alias.issuer)===identityName(issuer.name);
 const shareMatch=share&&SHARE_LINKS[stock.symbol]===share&&stock.name===share.name&&issuer.symbol===share.issuerSymbol&&issuer.name===share.issuerName;
 if((stock.symbol!==issuer.symbol&&!shareMatch)||stock.market!==issuer.market||(!aliasMatch&&!shareMatch&&identityName(stock.name)!==identityName(issuer.name)))return reject('ISSUER_IDENTITY_MISMATCH');
 const classification=shareMatch?{sector:'반도체',subSector:'메모리 반도체',themes:['DRAM','NAND'],ruleId:'verified-preferred-share'}:businessTaxonomy(issuer);if(!classification)return reject('INDUSTRY_REQUIRES_REVIEW');
 const {sector,subSector,themes,ruleId}=classification;
 return {symbol:stock.symbol,name:stock.name,market:stock.market,sector,subSector,themes,breadth:false,reviewRequired:false,source:'KRX KIND · 기존 섹터맵 체계로 사업·제품 분류',updatedAt:verifiedDay,verification:{status:'verified',method:VERIFICATION_METHOD,checkedAt,sourceUrl:KIND_SOURCE,issuerName:issuer.name,industry:issuer.industry,products:issuer.products,taxonomyVersion:TAXONOMY_VERSION,ruleId,...(classification.sourceUrl?{businessSourceUrl:classification.sourceUrl,businessReviewedAt:classification.businessReviewedAt}:{}),...(shareMatch?{shareSourceUrl:share.sourceUrl,issuerSymbol:issuer.symbol}:{}),...(aliasMatch?{identityAlias:true}:{})}};
}
