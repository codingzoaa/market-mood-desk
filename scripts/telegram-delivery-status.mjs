const ensure=(ok,reason)=>{if(!ok)throw Error(reason);};
const env=process.env;
const date=env.REPORT_DATE,title=env.REPORT_TITLE,state=env.DELIVERY_STATUS;
ensure(/^\d{4}-\d{2}-\d{2}$/.test(date||''),'INVALID_DATE');
ensure(['success','failure'].includes(state),'INVALID_STATUS');
ensure(title&&title.length<=100,'INVALID_TITLE');
ensure(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID,'MISSING_TELEGRAM_CREDENTIALS');
const text=state==='success'
 ? '✅ '+date+' '+title+' 브리핑 전송 성공 (Telegram API 수락)'
 : '🚨 '+date+' '+title+' 브리핑 발송 실패 · 16:10부터 30분 간격 재시도했으나 19:10까지 성공하지 못함. GitHub Actions 실행 로그를 확인하세요.';
const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text})
});
ensure(response.ok,'STATUS_TELEGRAM_HTTP_'+response.status);
const payload=await response.json();
ensure(payload.ok,'STATUS_TELEGRAM_REJECTED');
console.log('Telegram '+state+' notification accepted: '+date+' / '+title);
