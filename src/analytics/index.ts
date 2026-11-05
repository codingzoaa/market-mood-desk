export * from './types.ts';
export * from './quality.ts';
export * from './common.ts';
export * from './relative-strength.ts';
export * from './relative-volume.ts';
export * from './persistence.ts';
export * from './features.ts';
export * from './grading.ts';
import {sectorIntraday} from './sector-intraday.ts';
import {sectorEod} from './sector-eod.ts';
import {stockIntraday} from './stock-intraday.ts';
import {stockEod} from './stock-eod.ts';
import type {AnalysisInput,ScoreMode} from './types.ts';
export function calculateLeadership(input:AnalysisInput,mode:ScoreMode){
 if(!['INTRADAY','EOD'].includes(mode)||!['SECTOR','STOCK'].includes(input.entity.type))throw Error('UNSUPPORTED_CALCULATOR');
 return input.entity.type==='SECTOR'?(mode==='INTRADAY'?sectorIntraday(input):sectorEod(input)):(mode==='INTRADAY'?stockIntraday(input):stockEod(input));
}

export * from './rotation.ts';
export * from './ledger.ts';
