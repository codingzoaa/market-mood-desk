// Shared by the existing CollectorAlarm Durable Object. Stores leases only, never credentials or balances.
export const LS_SESSION_COORDINATOR_VERSION='LS_SESSION_COORDINATOR_V1';
export async function handleLSSessionLock(request,state,now=Date.now()){
 const path=new URL(request.url).pathname,reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST'||!['/ls-session/acquire','/ls-session/renew','/ls-session/release'].includes(path))return reply({error:'METHOD_NOT_ALLOWED'},405);
 let d;try{const text=await request.text();if(text.length>256)throw Error();d=JSON.parse(text);}catch{return reply({error:'INVALID_REQUEST'},400);}
 if(typeof d.owner!=='string'||!/^[-a-zA-Z0-9]{20,80}$/.test(d.owner))return reply({error:'INVALID_OWNER'},400);
 return state.storage.transaction(async tx=>{
  const lease=await tx.get('ls-session-lease');
  if(path.endsWith('/acquire')){
   if(lease&&lease.expires>now)return reply({busy:true,retryAfterMs:Math.min(30000,lease.expires-now)},409);
   await tx.put('ls-session-lease',{owner:d.owner,expires:now+120000});return reply({acquired:true,expires:now+120000,version:LS_SESSION_COORDINATOR_VERSION});
  }
  if(!lease||lease.owner!==d.owner)return reply({error:'LEASE_LOST'},409);
  if(path.endsWith('/release')){await tx.delete('ls-session-lease');return reply({released:true});}
  if(lease.expires<=now)return reply({error:'LEASE_EXPIRED'},409);
  await tx.put('ls-session-lease',{owner:d.owner,expires:now+120000});return reply({renewed:true,expires:now+120000});
 });
}
