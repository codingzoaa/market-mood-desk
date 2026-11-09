import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseNews,selectLeaders} from './telegram-sector-briefing.mjs';

const API='https://market-note-ls-api.kby0991.workers.dev/api/dashboard';
const root=new URL('../',import.meta.url);
const path=p=>new URL(p,root);
const iso=/^\d{4}-\d{2}-\d{2}$/;
const dateParts=v=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(v)).map(p=>[p.type,p.value]));
const day=v=>{const p=dateParts(v);return p.year+'-'+p.month+'-'+p.day;};
const currentDay=()=>day(new Date());
const checkedTime=(value,date)=>{if(!value||Number.isNaN(Date.parse(value))||day(value)!==date)return false;const p=dateParts(value);return p.hour+p.minute>='1530';};
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,240);
const aliases={
 '반도체':['반도체','메모리','HBM','패키징','칩','마이크론'],
 '2차전지':['이차전지','2차전지','배터리','양극재'],
 '제약·바이오':['바이오','신약','제약','임상'],
 '금융·증권':['금융','증권','은행'],
 '조선':['조선','선박','해운'],
 '방산':['방산','무기','방위'],
 '화장품':['화장품','K뷰티','뷰티','ODM'],
 '원전':['원전','원자력'],
 '우주항공':['우주','항공','위성'],
 '전력기기':['전력','변압기','전선','전력기기'],
 '자동차':['자동차','완성차','전기차','모빌리티'],
 '로봇':['로봇','자동화'],
 '사이버보안':['보안','사이버'],
 '건설·EPC':['건설','플랜트','EPC']
};
const validHeadline=(story,group)=>{const h=normalize(story.headline).toLowerCase();const terms=[group.name,...(aliases[group.name]||[]),...group.stocks.filter(s=>s.name.length>=3).map(s=>s.name)];return terms.some(w=>w.length>=2&&h.includes(w.toLowerCase()));};
const pct=n=>(n>0?'+':'')+n.toFixed(2)+'%';
const shortStock=s=>s.name+' '+pct(s.changePct);

export function prepareEditorial(date,snapshot,headlines,catalog){
 if(!iso.test(date))throw Error('INVALID_CLOSE_DATE');
 if(!snapshot||snapshot.date!==date||!/^LS증권 KRX/.test(snapshot.source||''))throw Error('LS_SAME_DAY_SNAPSHOT_REQUIRED');
 if(!checkedTime(snapshot.stockAsOf||snapshot.asOf,date))throw Error('REGULAR_CLOSE_NOT_CONFIRMED');
 if(!Array.isArray(snapshot.stocks)||snapshot.stocks.length<10)throw Error('LS_STOCK_SAMPLE_INSUFFICIENT');
 if(!Array.isArray(catalog)||catalog.length<50)throw Error('STOCK_TAXONOMY_MISSING');
 const candidates=selectLeaders(snapshot,catalog).filter(g=>g.stocks.filter(s=>s.changePct>=2).length>=2&&g.stocks.some(s=>s.changePct>=4));
 const sources=[],sectors=[];
 for(const group of candidates){
  const matches=headlines.filter(n=>validHeadline(n,group)&&n.day===date&&/^https:\/\//.test(n.link));
  if(!matches.length)continue;
  const story=matches[0];
  const sourceId=sources.length;
  sources.push({title:normalize(story.source)+' · '+date+' · '+normalize(story.headline),url:story.link});
  const gainers=group.stocks.filter(s=>s.changePct>0).sort((a,b)=>b.turnoverKRW-a.turnoverKRW||a.symbol.localeCompare(b.symbol));
  if(gainers.length<2)continue;
  const leader=gainers[0],companions=gainers.slice(1,5);
  const headline=normalize(story.headline);
  const reason='['+normalize(story.source)+' · '+date+' 보도] '+headline+'. 기사 제목과 종가 동반 상승은 확인했으나 상승 원인·공통 공시 간 인과관계는 별도 검증이 필요합니다.';
  sectors.push({
   name:group.name,status:'NEW',kind:'정규장 LS 표본 + 당일 매체 기사 · NEW 잠정',
   leaderSymbol:leader.symbol,leader:shortStock(leader),
   companions:companions.map(shortStock).join(' · '),
   reason,outlook:'LS 거래대금 상위 표본에서 '+gainers.length+'/'+group.stocks.length+'개 종목 상승. 섹터 전체 종목 전수·기관/외국인 수급·신고가와 재료 지속성은 추가 확인이 필요합니다.',
   change:'직전 거래일 동일 구성종목·거래대금 비교 미확인. NEW는 당일 편집 선정의 잠정 분류이며 신규 추세 확정을 뜻하지 않습니다.',
   sourceIds:[sourceId]
  });
  if(sectors.length>=5)break;
 }
 return {date,session:'KRX 정규장 마감 · LS 저장 종목 검증',summary:'거래대금 상위 LS 표본·당일 신뢰매체 기사로 교차확인한 강세 섹터 '+sectors.length+'개',coverageNote:'정규장 종가 확인, LS 표본에서 동반 상승한 종목에 한해 당일 매체 기사와 교차검증. 순서는 표본 평균등락률 순의 후보 선정이며 KRX 공식 섹터 TOP5 순위가 아닙니다. 당일 시가총액·섹터 전체 Breadth·대표종목 기관/외국인 수급·확정 지속일 등 미확인 값은 강도점수 미산출. 기사 제목만으로 인과관계를 확정하지 않음. 검증 가능한 '+sectors.length+'개만 등록.',marketFlow:'종목별 수급 원자료 미확인 · 섹터 수급 점수 미산출',sources,sectors};
}

export function updateIndex(original,date){
 const identifier='review'+date.replaceAll('-','');
 const importLine="import {"+identifier+"} from './close-review-"+date+"';";
 if(original.includes(identifier))return original;
 const importAnchor="import type {ScoreInput} from './close-score';";
 if(!original.includes(importAnchor))throw Error('CLOSE_REVIEW_IMPORT_ANCHOR_MISSING');
 const match=original.match(/const records=\[([^\n]*)\];/);
 if(!match)throw Error('CLOSE_REVIEW_RECORDS_ANCHOR_MISSING');
 return original.replace(importAnchor,importAnchor+'\n'+importLine).replace(match[0],match[0].replace(/\];$/ ,','+identifier+'];'));
}
export function nextState(date,review,reason,news=[]){
 if(review?.sectors?.length)return {date,status:'published',checkedAt:new Date().toISOString(),reason:review.sectors.length+'개 강세 섹터의 당일 종가·동반 상승·기사 링크 검증 후 자동 PR/CI/배포',sources:review.sources.map(s=>s.url).slice(0,5)};
 return {date,status:'pending',checkedAt:new Date().toISOString(),reason:'검증 보류: '+reason+'. 당일 정규장 종가·동반 상승·섹터 관련 기사 등 확인되지 않은 항목은 등록하지 않았습니다.',sources:news.filter(n=>/^https:\/\//.test(n.link)).slice(0,3).map(n=>n.link)};
}
async function checkedFetch(url,mode='json'){
 const res=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(18000)});
 if(!res.ok)throw Error('SOURCE_HTTP_'+res.status);
 const text=await res.text();if(text.length>5000000)throw Error('SOURCE_TOO_LARGE');
 return mode==='text'?text:JSON.parse(text);
}
const rssUrl=()=>{
 const u=new URL('https://news.google.com/rss/search');
 u.searchParams.set('q','(코스피 OR 코스닥 OR 반도체 OR 바이오 OR 조선 OR 방산 OR 화장품 OR 로봇 OR 배터리) (상승 OR 강세 OR 특징주 OR 실적) when:1d');
 u.searchParams.set('hl','ko');u.searchParams.set('gl','KR');u.searchParams.set('ceid','KR:ko');
 return u.href;
};
export async function main({date=currentDay(),readData=checkedFetch,readNews=checkedFetch}={}){
 if(!iso.test(date)||date>currentDay())throw Error('INVALID_OR_FUTURE_DATE');
 const indexPath=path('src/close-reviews.ts'),index=readFileSync(indexPath,'utf8');
 if(index.includes('review'+date.replaceAll('-',''))){console.log('SECTOR_ALREADY_PUBLISHED '+date);return {status:'unchanged',date};}
 let review=null,headlines=[],reason='당일 종가 또는 기사 검증에 필요한 자료 부족';
 try{
  const dashboard=await readData(API+'?date='+date);
  const snapshot=dashboard?.snapshots?.find(s=>s.date===date);
  if(!snapshot)throw Error('LS_SAME_DAY_SNAPSHOT_MISSING');
  const xml=await readNews(rssUrl(),'text');
  headlines=parseNews(xml,date);
  if(!headlines.length)throw Error('TRUSTED_SAME_DAY_NEWS_MISSING');
  const catalog=JSON.parse(readFileSync(path('src/data/stock-map.json'),'utf8'));
  const candidate=prepareEditorial(date,snapshot,headlines,catalog);
  if(candidate.sectors.length)review=candidate;
  else reason='LS 표본 동반 상승과 당일 신뢰매체 기사를 동시에 충족한 섹터 없음';
 }catch(e){reason=e instanceof Error?e.message:'EDITORIAL_VERIFICATION_FAILED';}
 const status=nextState(date,review,reason,headlines);
 const statusPath=path('public/sector-review-status.json');
 // Pending reviews are not treated as published; reruns may strengthen evidence.
 if(review){
  const reviewPath=path('src/close-review-'+date+'.ts');
  if(existsSync(reviewPath))throw Error('REVIEW_FILE_EXISTS_WITHOUT_INDEX');
  writeFileSync(reviewPath,"import type {CloseReview} from './close-reviews';\n// Verified same-day LS quote sample + dated news headlines; missing measurements are not inferred.\nexport const review"+date.replaceAll('-','')+":CloseReview="+JSON.stringify(review,null,2)+";\n");
  writeFileSync(indexPath,updateIndex(index,date));
 }
 // Stable pending records do not cause repeated commits at each retry.
 const old=existsSync(statusPath)?JSON.parse(readFileSync(statusPath,'utf8')):null;
 if(!review&&old?.date===date&&old?.status==='pending'&&old?.reason===status.reason){
  console.log('SECTOR_NO_CHANGE '+date);return {status:'unchanged',date};
 }
 writeFileSync(statusPath,JSON.stringify(status,null,2)+'\n');
 console.log('SECTOR_REVIEW_RESULT '+JSON.stringify({date,status:status.status,sectors:review?.sectors?.length||0,reason:status.reason}));
 return {status:status.status,date};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main({date:process.env.REVIEW_DATE||currentDay()}).catch(e=>{console.error('SECTOR_REVIEW_PIPELINE_FAILED',e.message);process.exitCode=1;});
