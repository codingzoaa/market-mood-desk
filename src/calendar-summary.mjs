export function sectorFrequency(reviews,end,days){
 const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const start=shift(end,1-days),previousEnd=shift(start,-1),previousStart=shift(start,-days);
 const count=(from,to)=>{const counts=new Map();for(const r of reviews.filter(r=>r.date>=from&&r.date<=to)){for(const name of new Set(r.sectors.map(s=>s.name)))counts.set(name,(counts.get(name)||0)+1);}return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko'));};
 const old=count(previousStart,previousEnd),now=count(start,end),rank=(rows,n)=>{const item=rows.find(x=>x[0]===n);return item?1+rows.filter(x=>x[1]>item[1]).length:null;};
 return {start,end,previousStart,previousEnd,reviewDays:reviews.filter(r=>r.date>=start&&r.date<=end).length,rows:now.map(([name,count])=>({name,count,rank:rank(now,name),previousRank:rank(old,name),previousCount:old.find(x=>x[0]===name)?.[1]||0}))};
}
