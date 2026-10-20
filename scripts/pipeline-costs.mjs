import {estimate,FREE_LIMITS} from '../worker/pipeline/costs.mjs';
const scenarios=[100].flatMap(stocks=>[false,true].map(r2=>estimate({stocks,r2,rawDays:20})));
console.log(JSON.stringify({asOf:'2026-10-20',kind:'ASSUMPTION_BASED_ESTIMATE_NOT_CLOUDFLARE_BILL',limits:FREE_LIMITS,scenarios},null,2));
