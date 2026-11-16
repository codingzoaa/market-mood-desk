// Shared official Naver News Search XML validation. No credentials or Node APIs.
const publishers={'yna.co.kr':'연합뉴스','newsis.com':'뉴시스','newspim.com':'뉴스핌','edaily.co.kr':'이데일리','hankyung.com':'한국경제','mk.co.kr':'매일경제','sedaily.com':'서울경제','asiae.co.kr':'아시아경제','mt.co.kr':'머니투데이','biz.chosun.com':'조선비즈','etnews.com':'전자신문','fnnews.com':'파이낸셜뉴스','bizwatch.co.kr':'비즈워치'};
const clean=s=>String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&amp;/g,'&').replace(/<[^>]*>/g,'').trim();
const tag=(s,n)=>clean(s.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+n+'>','i'))?.[1]||'');
const kstDay=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
export function parseNaverNews(xml,date){
 if(typeof xml!=='string'||xml.length>5000000||!/<rss[\s>]/i.test(xml))throw Error('NAVER_INVALID_RSS');
 const rows=[];
 for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){
  const item=m[1],headline=tag(item,'title'),published=tag(item,'pubDate'),original=tag(item,'originallink');
  if(!headline||!Number.isFinite(Date.parse(published))||kstDay(published)!==date)continue;
  let url;try{url=new URL(original);}catch{continue;}
  if(url.protocol!=='https:'||url.username||url.password)continue;
  const source=Object.entries(publishers).find(([host])=>url.hostname===host||url.hostname.endsWith('.'+host))?.[1];
  if(!source)continue;
  rows.push({headline,description:tag(item,'description'),published,day:date,source,provider:'네이버 뉴스',link:url.href});
 }
 return rows;
}
export function mergeSectorNews(...groups){
 const urls=new Set(),titles=new Set(),out=[];
 for(const row of groups.flat()){
  let url;try{url=new URL(row.link);if(url.protocol!=='https:')continue;for(const key of [...url.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/.test(key))url.searchParams.delete(key);}catch{continue;}
  const title=row.headline.replace(new RegExp('\\s*[-–]\\s*'+row.source+'$'),'').replace(/\s+/g,'').toLowerCase();
  if(urls.has(url.href)||titles.has(title))continue;urls.add(url.href);titles.add(title);out.push({...row,link:url.href});
 }
 return out;
}
