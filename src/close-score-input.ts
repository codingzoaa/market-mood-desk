import type {ScoreInput} from './close-score';
import type {MarketDetails} from './market-details';
import type {Snapshot} from './market';

export type AutoScoreSpec={
 date:string;
 leaderSymbol?:string;
 breadthSector?:string;
};

const API_BASE='https://market-note-ls-api.kby0991.workers.dev';
const unique=(xs:string[])=>[...new Set(xs)];

function verifiedPositiveStreak(snapshots:Snapshot[],date:string,symbol:string){
 const rows=snapshots.filter(s=>s.date<=date).slice().sort((a,b)=>b.date.localeCompare(a.date));
 if(!rows.length||rows[0].date!==date)return undefined;
 let streak=0;
 for(const row of rows){
  const stock=row.stocks.find(s=>s.symbol===symbol);
  if(!stock)break;
  if(stock.changePct<=0)break;
  streak++;
 }
 return streak||undefined;
}

export function buildAutoScoreInput(spec:AutoScoreSpec,snapshots:Snapshot[],details?:MarketDetails|null):ScoreInput|undefined{
 if(!spec.leaderSymbol)return undefined;
 const snap=snapshots.find(s=>s.date===spec.date);
 if(!snap)return undefined;
 const leader=snap.stocks.find(s=>s.symbol===spec.leaderSymbol);
 if(!leader)return undefined;

 const sourceUrls=[API_BASE+'/api/dashboard?date='+encodeURIComponent(spec.date)];
 const input:ScoreInput={
  date:spec.date,
  turnover:leader.turnoverKRW/100000000,
  sourceUrls
 };

 if(details?.date===spec.date&&details.heatmap){
  const heatLeader=details.heatmap.stocks.find(s=>s.symbol===spec.leaderSymbol);
  // Naver domestic marketSum is stored by collectHeatmap in 억원; turnover above is converted to 억원.
  if(heatLeader?.marketCap>0)input.marketCap=heatLeader.marketCap;
  if(spec.breadthSector){
   const members=details.heatmap.stocks.filter(s=>s.sector===spec.breadthSector);
   if(members.length>=2){
    input.members=members.length;
    input.up=members.filter(s=>s.changePct>0).length;
   }
  }
  input.sourceUrls.push(API_BASE+'/api/market-details?date='+encodeURIComponent(spec.date));
 }

 const streak=verifiedPositiveStreak(snapshots,spec.date,spec.leaderSymbol);
 if(streak!==undefined)input.streak=streak;
 input.sourceUrls=unique(input.sourceUrls);
 return input;
}

export function mergeScoreInput(editorial:ScoreInput|undefined,auto:ScoreInput|undefined,date:string):ScoreInput|undefined{
 if(!editorial&&!auto)return undefined;
 const validEditorial=editorial?.date===date?editorial:undefined;
 const validAuto=auto?.date===date?auto:undefined;
 if(!validEditorial&&!validAuto)return undefined;
 return {
  ...(validEditorial||{date,sourceUrls:[]}),
  ...(validAuto||{}),
  ...(validEditorial?.news!==undefined?{news:validEditorial.news}:{}),
  ...(validEditorial?.foreignNet!==undefined?{foreignNet:validEditorial.foreignNet}:{}),
  ...(validEditorial?.institutionNet!==undefined?{institutionNet:validEditorial.institutionNet}:{}),
  sourceUrls:unique([...(validEditorial?.sourceUrls||[]),...(validAuto?.sourceUrls||[])])
 };
}
