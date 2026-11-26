const KEY='market-note:account-session-v1';
let current:{token:string;expiresAt:number}|null=null;
export function session(){try{if(!current)current=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}if(current&&current.expiresAt>Date.now())return current;clearSession();return null;}
export function setSession(value:{token:string;expiresAt:number}){current=value;try{sessionStorage.setItem(KEY,JSON.stringify(value));}catch{}}
export function clearSession(){current=null;try{sessionStorage.removeItem(KEY);}catch{}}
export async function accountFetch(input:RequestInfo|URL,init:RequestInit={}){const headers=new Headers(init.headers),s=session();if(s)headers.set('Authorization','Bearer '+s.token);const r=await fetch(input,{...init,headers});if(r.status===401){clearSession();window.dispatchEvent(new Event('market-note-account-locked'));}return r;}
