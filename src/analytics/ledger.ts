import type {LeadershipScore} from './types.ts';
/** In-memory reference adapter for testing immutable keys. Not wired to production D1. */
export class ScoreLedger {
 private readonly rows=new Map<string,LeadershipScore>();
 append(score:LeadershipScore){
  const old=this.rows.get(score.id);
  if(old&&JSON.stringify(old)!==JSON.stringify(score))throw Error('SCORE_KEY_CONFLICT');
  if(!old)this.rows.set(score.id,structuredClone(score));
  return !old;
 }
 all(){return [...this.rows.values()].map(row=>structuredClone(row));}
}
