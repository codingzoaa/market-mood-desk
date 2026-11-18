// Display projections use the current registry; source quotes and editorial evidence stay intact.
const identity=v=>String(v||'').replaceAll(' ','');
export function classifyStocks(stocks,registry){
 const byCode=new Map(registry.map(row=>[row.symbol,row]));
 return stocks.map(stock=>{
  const row=byCode.get(stock.symbol);
  if(!row||row.market!==stock.market||identity(row.name)!==identity(stock.name))return stock;
  return {...stock,sector:row.sector,subSector:row.subSector,themes:[...new Set([row.sector,row.subSector,...row.themes].filter(Boolean))]};
 });
}
export function classifyReviews(reviews,registry){
 const names=[...registry].sort((a,b)=>identity(b.name).length-identity(a.name).length);
 const match=text=>names.find(row=>{
  const label=identity(text),name=identity(row.name);if(!label.startsWith(name))return false;
  return !/[가-힣A-Za-z]/.test(label.slice(name.length,name.length+1));
 });
 return reviews.map(review=>{
  const groups=new Map();
  for(const source of review.sectors){
   const rows=[...source.leader.split(' · ').map(text=>({text,leader:true})),...source.companions.split(' · ').map(text=>({text,leader:false}))];
   for(const item of rows){
    const row=match(item.text),name=row?.manualEditedAt?row.sector:source.name;
    let group=groups.get(name);
    if(!group){group={...source,name,leader:'',companions:'',sourceIds:[],classificationMembers:[],originalSectors:[],items:[]};groups.set(name,group);}
    group.items.push(item);group.sourceIds=[...new Set([...group.sourceIds,...source.sourceIds])];
    if(!group.originalSectors.includes(source.name))group.originalSectors.push(source.name);
    if(row&&!group.classificationMembers.some(x=>x.symbol===row.symbol))group.classificationMembers.push({symbol:row.symbol,name:row.name,sector:row.sector,subSector:row.subSector,themes:[...row.themes]});
   }
  }
  return {...review,sectors:[...groups.values()].map(({items,...group})=>{
   const leaders=items.filter(x=>x.leader);const main=leaders.length?leaders:[items[0]];
   return {...group,leader:main.map(x=>x.text).join(' · '),companions:items.filter(x=>!main.includes(x)).map(x=>x.text).join(' · ')||'—'};
  })};
 });
}
