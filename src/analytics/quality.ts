import type {Snapshot} from '../market.ts';
import {eligibleStocks} from '../market.ts';
import {known,stamp} from './common.ts';
import type {DataQuality} from './types.ts';
/** Audit adapter only: the legacy schema cannot certify EOD or same-slot history. */
export function legacyDataQuality(snapshot:Snapshot|null,options:{asOf:string;lastSuccessAt?:string|null;errors?:string[]}):DataQuality {
 const stocks=eligibleStocks(snapshot?.stocks||[],snapshot?.etfs),missingFields=['sourceQuoteAt','previousClose','OHLC','adjustedPriceHistory20d60d','sameTimeTurnover20d','verifiedTradingCalendar','sourceConfirmedFinality','fixedSectorMembership'];
 const errors=[...(options.errors||[])];
 const valid=stamp(options.asOf),age=snapshot&&valid&&stamp(snapshot.asOf)?Date.parse(options.asOf)-Date.parse(snapshot.asOf):Infinity;
 if(!valid)errors.push('INVALID_AS_OF');if(snapshot&&valid&&stamp(snapshot.asOf)&&Date.parse(snapshot.asOf)>Date.parse(options.asOf))errors.push('FUTURE_SNAPSHOT');
 if(snapshot&&/demo|simulation|시뮬레이션|가상/i.test(snapshot.source))errors.push('NON_PRODUCTION_SOURCE');
 if(new Set(snapshot?.stocks.map(s=>s.symbol)).size!==(snapshot?.stocks.length||0))errors.push('DUPLICATE_SYMBOL');
 if(!snapshot)missingFields.push('snapshot');
 return {asOf:options.asOf,lastSuccessAt:known(options.lastSuccessAt,options.asOf)?options.lastSuccessAt!:null,source:snapshot?.source||'LS증권 KRX · no snapshot',universe:'SAMPLED_UNIVERSE',stockCount:stocks.length,classifiedCount:stocks.filter(s=>s.themes.length>0).length,historicalTradingDays:0,stale:age<0||age>10*60000,missingFields,errors:[...new Set(errors)]};
}
