import {parseNaverNews,mergeSectorNews} from '../shared/naver-news.mjs';
export {parseNaverNews,mergeSectorNews} from '../shared/naver-news.mjs';
export async function collectNaverSectorNews(date,queries,{env=process.env,request=fetch}={}){
 if(!env.NAVER_CLIENT_ID||!env.NAVER_CLIENT_SECRET)return {status:'missing_credentials',items:[]};
 const items=[];let successful=0;
 const search=async query=>{
  const url=new URL('https://openapi.naver.com/v1/search/news.xml');url.searchParams.set('query',query);url.searchParams.set('display','100');url.searchParams.set('sort','date');
  try{
   const res=await request(url,{redirect:'error',headers:{'X-Naver-Client-Id':env.NAVER_CLIENT_ID,'X-Naver-Client-Secret':env.NAVER_CLIENT_SECRET},signal:AbortSignal.timeout(18000)});
   if(!res.ok)return 0;const rows=parseNaverNews(await res.text(),date);items.push(...rows);successful++;return rows.length;
  }catch{return 0;}
 };
 // Search actual company names too: broad taxonomy labels and the word 강세
 // are often absent from a valid same-day closing headline.
 for(const query of [...new Set(queries)].slice(0,30)){
  if(!await search(query+' 강세'))await search(query);
 }
 // These add candidates only. The editorial stage still requires a dated,
 // trusted headline matching each observed sector/company before publication.
 for(const query of ['코스피 마감','코스닥 마감','특징주'])await search(query);
 return {status:successful?'ok':'unavailable',items:mergeSectorNews(items)};
}
