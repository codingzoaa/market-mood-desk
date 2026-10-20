export type Trade={id:string;accountRef:string;date:string;time:string;symbol:string;name:string;side:'BUY'|'SELL';sequence:number;quantity:number;price:number;grossKRW:number;feeKRW:number;taxKRW:number;orderingBasis?:'LEDGER_SEQUENCE'};
/** Moving average cost. Missing opening lots do not become fictitious zero-cost profits. */
export function analyzeAccount(trades:Trade[]){
 const positions=new Map<string,{symbol:string;name:string;quantity:number;cost:number;complete:boolean}>(),daily=new Map<string,{date:string;realizedKRW:number;buyKRW:number;sellKRW:number}>();
 let realizedKRW=0,feesKRW=0,buyKRW=0,sellKRW=0,wins=0,losses=0,unknownSells=0;
 const ordered=[...trades].sort((a,b)=>a.date.localeCompare(b.date)||(a.orderingBasis==='LEDGER_SEQUENCE'&&b.orderingBasis==='LEDGER_SEQUENCE'?a.sequence-b.sequence:0)||a.time.localeCompare(b.time)||a.sequence-b.sequence||a.id.localeCompare(b.id));
 for(const t of ordered){const key=t.accountRef+':'+t.symbol,p=positions.get(key)||{symbol:t.symbol,name:t.name,quantity:0,cost:0,complete:true},d=daily.get(t.date)||{date:t.date,realizedKRW:0,buyKRW:0,sellKRW:0};feesKRW+=t.feeKRW+t.taxKRW;
  if(t.side==='BUY'){const cost=t.grossKRW+t.feeKRW+t.taxKRW;p.quantity+=t.quantity;p.cost+=cost;buyKRW+=t.grossKRW;d.buyKRW+=t.grossKRW;}
  else{sellKRW+=t.grossKRW;d.sellKRW+=t.grossKRW;
   if(!p.complete||p.quantity<t.quantity){p.complete=false;unknownSells++;p.quantity=Math.max(0,p.quantity-t.quantity);p.cost=0;}
   else{const cost=p.cost/p.quantity*t.quantity,profit=t.grossKRW-t.feeKRW-t.taxKRW-cost;p.quantity-=t.quantity;p.cost-=cost;realizedKRW+=profit;d.realizedKRW+=profit;if(profit>0)wins++;else if(profit<0)losses++;}
  }positions.set(key,p);daily.set(t.date,d);
 }
 const accountCount=new Set(trades.map(t=>t.accountRef)).size;
 return {tradeCount:trades.length,accountCount,from:ordered[0]?.date||null,to:ordered.at(-1)?.date||null,realizedKRW:Math.round(realizedKRW),feesKRW,buyKRW,sellKRW,winRate:wins+losses?wins/(wins+losses)*100:null,unknownSells,complete:unknownSells===0,
  // Account identifiers never leave the Worker, even through this authenticated view.
  holdings:[...positions.values()].filter(p=>p.quantity>0||!p.complete).map(p=>({...p,cost:p.complete?Math.round(p.cost):null,averageCost:p.complete&&p.quantity?Math.round(p.cost/p.quantity):null})),daily:[...daily.values()].map(d=>({...d,realizedKRW:Math.round(d.realizedKRW)}))};
}
