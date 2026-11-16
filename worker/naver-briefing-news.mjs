import {parseNaverNews,mergeSectorNews} from '../shared/naver-news.mjs';
// Shared by Cloudflare scheduled delivery and the manual GitHub dry-run.
// A request failure may use another Naver query, never the failed Google feed.
export async function fetchNaverBriefingNews(date,queries,{env={},request=fetch}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('NAVER_NEWS_DATE_INVALID');
 const id=String(env.NAVER_CLIENT_ID||'').trim(),secret=String(env.NAVER_CLIENT_SECRET||'').trim();
 if(!id||!secret)throw Error('NAVER_NEWS_SECRETS_MISSING');
 const rows=[],errors=[];let successful=0;
 for(const query of [...new Set(queries)].filter(q=>typeof q==='string'&&q.trim()).slice(0,5)){
  const url=new URL('https://openapi.naver.com/v1/search/news.xml');
  url.searchParams.set('query',query);url.searchParams.set('display','100');url.searchParams.set('sort','date');
  try{
   const response=await request(url,{redirect:'error',headers:{'X-Naver-Client-Id':id,'X-Naver-Client-Secret':secret},signal:AbortSignal.timeout(15000)});
   if(!response.ok){errors.push('NAVER_NEWS_HTTP_'+response.status);if([401,403].includes(response.status))break;continue;}
   rows.push(...parseNaverNews(await response.text(),date));successful++;
  }catch{/* Do not put request objects, headers, or response bodies in logs. */errors.push('NAVER_NEWS_FETCH_OR_XML_FAILED');}
 }
 if(!successful)throw Error(errors[0]||'NAVER_NEWS_NO_QUERIES');
 const news=mergeSectorNews(rows).filter(n=>n.headline.length>10&&n.link.length<=500).slice(0,4);
 if(!news.length)throw Error('NAVER_NEWS_NO_VERIFIED_ARTICLES');
 return news.map(n=>({...n,title:n.headline,pubDate:n.published,source:n.source+' · 네이버 뉴스'}));
}
