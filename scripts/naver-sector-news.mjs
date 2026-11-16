import {parseNaverNews,mergeSectorNews} from '../shared/naver-news.mjs';
export {parseNaverNews,mergeSectorNews} from '../shared/naver-news.mjs';
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
