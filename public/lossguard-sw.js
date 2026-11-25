/* Marketnote notification worker. No fetch interception, caching or account storage. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let kind='LIMIT';try{kind=event.data.json().kind;}catch{}
 const text=kind==='TEST'?['마켓노트 테스트 알림','탭을 닫아도 받을 수 있는 웹 푸시가 연결됐습니다.']:kind==='WARNING'?['마켓노트 손실 사전 경고','설정한 사전 경고 기준에 도달했습니다. 계좌분석을 확인하세요.']:['마켓노트 손실 한도 알림','설정한 손실 한도에 도달했습니다. 매매를 멈추고 계좌를 확인하세요.'];
 event.waitUntil(self.registration.showNotification(text[0],{body:text[1],tag:'marketnote-lossguard',renotify:true,data:{url:new URL('./#account',self.registration.scope).href}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=new URL('./#account',self.registration.scope).href;event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const tab=windows.find(w=>w.url.startsWith(self.registration.scope));if(tab){await tab.navigate(url);await tab.focus();}else await self.clients.openWindow(url);})());});
