// Official Naver News Search XML (RSS). Credentials remain in the Actions runner.
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
export async function collectNaverSectorNews(date,queries,{env=process.env,request=fetch}={}){
 if(!env.NAVER_CLIENT_ID||!env.NAVER_CLIENT_SECRET)return {status:'missing_credentials',items:[]};
 const items=[];let successful=0;
 for(const query of [...new Set(queries)].slice(0,5)){
  const url=new URL('https://openapi.naver.com/v1/search/news.xml');url.searchParams.set('query',query+' 강세');url.searchParams.set('display','100');url.searchParams.set('sort','date');
  try{
   const res=await request(url,{redirect:'error',headers:{'X-Naver-Client-Id':env.NAVER_CLIENT_ID,'X-Naver-Client-Secret':env.NAVER_CLIENT_SECRET},signal:AbortSignal.timeout(18000)});
   if(!res.ok)continue;items.push(...parseNaverNews(await res.text(),date));successful++;
  }catch{/* Keep the independent Google feed available; never log credential-bearing requests. */}
 }
 return {status:successful?'ok':'unavailable',items:mergeSectorNews(items)};
}
