// Editorial rubric v1. Inputs must refer to the review's regular-session date.
export type ScoreInput={date:string;turnover?:number;marketCap?:number;up?:number;members?:number;news?:'disclosure'|'official'|'reported'|'none';streak?:number;foreignNet?:number;institutionNet?:number;sourceUrls:string[]};
export const scoreRules=[
 {key:'turnover',label:'시총 대비 대표종목 거래대금',max:30,rule:'대표종목 정규장 거래대금 ÷ 같은 날 시가총액. 비율 5% 이상 30점, 그 이하는 비례 배점.'},
 {key:'breadth',label:'동반 상승',max:25,rule:'사전에 정한 섹터 전체 구성종목 중 상승 종목 비율 × 25점. 최소 2종목, 전체 구성과 종가 확인 필요.'},
 {key:'news',label:'뉴스·공시',max:20,rule:'당일 상승과 관련된 원문 공시 20점, 기업·기관 공식 발표 15점, 언론 보도 10점. 관련 재료 없음이 확인된 경우 0점.'},
 {key:'persistence',label:'지속성',max:15,rule:'대표종목 연속 상승 거래일 × 3점, 5거래일 이상 15점. 확인된 종가 이력 기준.'},
 {key:'flow',label:'수급',max:10,rule:'대표종목 외국인+기관 순매수 ÷ 정규장 거래대금. 10% 이상 10점, 양수는 비례 배점, 0 이하 0점.'}
] as const;
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const positive=(n:unknown):n is number=>finite(n)&&n>0;
const round=(n:number)=>Math.round(n*10)/10;
export function scoreSector(input:ScoreInput|undefined,date:string){
 const valid=input?.date===date&&input.sourceUrls.length>0&&input.sourceUrls.every(url=>/^https:\/\//.test(url));
 const x=valid?input:undefined;
 const values:(number|null)[]=[
  x&&finite(x.turnover)&&x.turnover>=0&&positive(x.marketCap)?round(Math.min(x.turnover/x.marketCap/.05,1)*30):null,
  x&&Number.isInteger(x.up)&&Number.isInteger(x.members)&&x.members!>=2&&x.up!>=0&&x.up!<=x.members!?round(x.up!/x.members!*25):null,
  x?.news?({disclosure:20,official:15,reported:10,none:0}[x.news]):null,
  x&&Number.isInteger(x.streak)&&x.streak!>=0?Math.min(x.streak!,5)*3:null,
  x&&positive(x.turnover)&&finite(x.foreignNet)&&finite(x.institutionNet)?round(Math.max(0,Math.min((x.foreignNet+x.institutionNet)/x.turnover/.1,1))*10):null
 ];
 const components=scoreRules.map((r,i)=>({...r,value:values[i]}));
 return {components,total:values.every(v=>v!==null)?round(values.reduce<number>((sum,v)=>sum+(v??0),0)):null,known:values.filter(v=>v!==null).length};
}
