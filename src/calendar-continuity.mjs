const key=name=>({'제약·바이오':'바이오','엔터테인먼트':'엔터·콘텐츠'}[name]||name).replace(/\s+/g,'');
const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function previousTradingDay(date,holidays=[]){let d=shift(date,-1);while([0,6].includes(new Date(d+'T12:00:00Z').getUTCDay())||holidays.includes(d))d=shift(d,-1);return d;}
export function verifiedCoRise(sector){const names=new Set();for(const text of [sector.leader,sector.companions].join(' · ').split(' · ')){const m=text.match(/^(.+?)\s+\+([\d,.]+)%/);if(m&&Number(m[2].replaceAll(',',''))>0)names.add(m[1].trim());}return names.size>=2;}
// Consecutive editorial selections with verified co-rising stocks, not all-market performance.
export function calendarContinuity(reviews,{holidays=['2026-10-05','2026-10-09']}={}){
 const sorted=[...reviews].sort((a,b)=>a.date.localeCompare(b.date)),byDate=new Map(),seen=new Set();
 return sorted.map(review=>{const prev=byDate.get(previousTradingDay(review.date,holidays)),sectors=review.sectors.map(s=>{const id=key(s.name),prior=prev?.sectors.find(p=>key(p.name)===id),verified=verifiedCoRise(s),continued=verified&&prior&&verifiedCoRise(prior),days=continued?(prior.continuity?.days||1)+1:verified?1:0;
 const state=!verified?'unverified':continued?'consecutive':!prev||prior&&!verifiedCoRise(prior)?'unknown':seen.has(id)?'returning':'daily',label={unverified:'동반 상승 확인 부족',consecutive:`연속 강세 ${days}거래일`,unknown:'당일 강세 · 전일 비교 부족',returning:'재등장',daily:'당일 강세'}[state];
 return {...s,continuity:{state,days,label,previousDate:previousTradingDay(review.date,holidays)}};});const out={...review,sectors};byDate.set(review.date,out);for(const s of sectors)seen.add(key(s.name));return out;});
}
