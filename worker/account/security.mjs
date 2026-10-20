const encoder=new TextEncoder(),decoder=new TextDecoder();
export const check=(condition,code='INVALID_DATA')=>{if(!condition)throw Error(code);};
export const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const unb64=value=>Uint8Array.from(atob(value),x=>x.charCodeAt(0));
const urlBytes=s=>unb64(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'='));
let jwksCache;
// Some Worker routes deliver the application JWT as a cookie. It must undergo
// exactly the same cryptographic validation as the preferred assertion header.
export function accessToken(request){
 const header=request.headers.get('Cf-Access-Jwt-Assertion');
 if(header)return header;
 const matches=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('CF_Authorization='));
 return matches.length===1?matches[0].slice('CF_Authorization='.length):null;
}
export function browserLogin(request,env){
 const url=new URL(request.url),origin=env.PRIVATE_APP_ORIGIN;
 if(request.method!=='GET'||!['/','/index.html'].includes(url.pathname)||!request.headers.get('Accept')?.includes('text/html')||accessToken(request))return null;
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER||'')||!env.ACCESS_AUD||origin!==url.origin||url.protocol!=='https:')return null;
 const login=new URL('/cdn-cgi/access/login/'+url.hostname,env.ACCESS_ISSUER);
 login.searchParams.set('kid',env.ACCESS_AUD);
 // Fixed return path: never carry user-controlled query strings to the login service.
 login.searchParams.set('redirect_url',origin+'/');
 return new Response(null,{status:302,headers:{...privateHeaders,Location:login.href}});
}
export async function authenticate(request,env,fetcher=fetch,now=Date.now()){
 const issuer=env.ACCESS_ISSUER,aud=env.ACCESS_AUD,email=env.OWNER_EMAIL;
 check(/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer||'')&&typeof aud==='string'&&aud.length>0&&typeof email==='string'&&email.includes('@'),'AUTH_NOT_CONFIGURED');
 const token=accessToken(request);check(token&&token.length<16384,'UNAUTHORIZED');
 const parts=token.split('.');check(parts.length===3,'UNAUTHORIZED');
 let header,claims;try{header=JSON.parse(decoder.decode(urlBytes(parts[0])));claims=JSON.parse(decoder.decode(urlBytes(parts[1])));}catch{throw Error('UNAUTHORIZED');}
 const seconds=now/1000;
 check(header.alg==='RS256'&&typeof header.kid==='string'&&claims.iss===issuer&&Array.isArray(claims.aud)&&claims.aud.includes(aud)&&claims.type==='app'&&typeof claims.sub==='string'&&claims.sub.length>0&&Number.isFinite(claims.exp)&&claims.exp>seconds&&Number.isFinite(claims.iat)&&claims.iat<=seconds+30&&(!claims.nbf||Number.isFinite(claims.nbf)&&claims.nbf<=seconds+30)&&typeof claims.email==='string'&&claims.email.toLowerCase()===email.toLowerCase(),'UNAUTHORIZED');
 if(!jwksCache||jwksCache.issuer!==issuer||jwksCache.until<now){
  const r=await fetcher(issuer+'/cdn-cgi/access/certs',{redirect:'error',signal:AbortSignal.timeout(5000)});check(r.ok,'AUTH_UNAVAILABLE');
  const text=await r.text();check(text.length<100000,'AUTH_UNAVAILABLE');const data=JSON.parse(text);check(Array.isArray(data.keys)&&data.keys.length<=20,'AUTH_UNAVAILABLE');jwksCache={issuer,keys:data.keys,until:now+300000};
 }
 const jwk=jwksCache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig'));check(jwk,'UNAUTHORIZED');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 check(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,urlBytes(parts[2]),encoder.encode(parts[0]+'.'+parts[1])),'UNAUTHORIZED');return {authenticated:true};
}
async function key(env){const bytes=unb64(env.ACCOUNT_ENCRYPTION_KEY||'');check(bytes.length===32,'ENCRYPTION_NOT_CONFIGURED');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(env,value,aad){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(aad)},await key(env),encoder.encode(JSON.stringify(value)));return JSON.stringify({v:1,iv:b64(iv),data:b64(cipher)});}
export async function open(env,payload,aad){const x=JSON.parse(payload);check(x.v===1,'UNSUPPORTED_KEY_VERSION');return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(x.iv),additionalData:encoder.encode(aad)},await key(env),unb64(x.data))));}
export async function opaqueID(env,value){const bytes=unb64(env.ACCOUNT_INDEX_KEY||'');check(bytes.length===32,'INDEX_NOT_CONFIGURED');const k=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export const privateHeaders={'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
