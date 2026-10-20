import {calculateLeadership} from '../analytics/index.ts';
import type {AnalysisInput,LeadershipScore,ScoreMode} from '../analytics/types.ts';
export type ScoreRequest={entity:AnalysisInput['entity'];quoteSymbols?:string[];sectorId?:string;sectorScore?:LeadershipScore};
export type SharedInput=Omit<AnalysisInput,'entity'|'sectorId'|'sectorScore'>;
export function scoreBatch(shared:SharedInput,entities:ScoreRequest[],mode:ScoreMode,clock=()=>performance.now()){
 const start=clock();const scores=entities.map(request=>calculateLeadership({...shared,...request,quotes:request.quoteSymbols?shared.quotes.filter(q=>request.quoteSymbols!.includes(q.symbol)):shared.quotes},mode));
 return {scores,durationMs:Math.max(0,clock()-start)};
}
export function replayScores(frame:{shared:SharedInput;entities:Array<ScoreRequest|AnalysisInput['entity']>;mode:ScoreMode}){
 return scoreBatch(frame.shared,frame.entities.map(r=>'entity'in r?r:{entity:r}),frame.mode).scores;
}
