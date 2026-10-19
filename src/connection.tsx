import { useState } from 'react';
import { accessCode, API_URL, setAccessCode, liveDashboard } from './live';
import { dayKey } from './market';
export default function Connection() {
  const [code, setCode] = useState(''), [connected, setConnected] = useState(!!accessCode()), [busy,setBusy] = useState(false), [message,setMessage] = useState('');
  async function connect() {
    if(code.trim().length<32){setMessage('32자 이상으로 설정한 사이트 접속 코드를 입력하세요. LS 앱키는 입력하지 마세요.');return;}
    const previous=accessCode(); setBusy(true); setMessage('서버 확인 중…');
    try { setAccessCode(code.trim()); const result=await liveDashboard(dayKey()); setConnected(true); setCode('');setMessage(result.snapshots.length?'LS 저장 시세를 연결했습니다.':'서버 연결 완료 · 첫 시세 수집을 기다립니다.');window.dispatchEvent(new Event('market-note-connection')); }
    catch(error){setAccessCode(previous);setMessage(error instanceof Error?error.message:'연결하지 못했습니다.');}
    finally{setBusy(false);}
  }
  return <section className="panel ls-connection"><div className="section-title"><h2>LS증권 시세 연결</h2><span className={'badge '+(connected?'green':'amber')}>{connected?'서버 연결 설정됨':'접속 코드 필요'}</span></div><p className="connection-description">Cloudflare 서버가 KRX 시세를 5분 간격으로 수집합니다. 시장별 거래대금 최대100개를 분석하며 테마는 순차 보강합니다. 누락된 지표는 표시하지 않습니다.</p><form onSubmit={e=>{e.preventDefault();connect();}}><label htmlFor="ls-access-code">사이트 접속 코드</label><div className="ls-connect-form"><input id="ls-access-code" type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} placeholder="DASHBOARD_TOKEN · LS 앱키 입력 금지" maxLength={256}/><button className="btn primary" disabled={busy} type="submit">{busy?'확인 중…':'시세 연결'}</button>{connected&&<button className="btn" type="button" disabled={busy} onClick={()=>{setAccessCode('');setConnected(false);setMessage('연결을 해제했습니다.');window.dispatchEvent(new Event('market-note-connection'));}}>연결 해제</button>}</div></form><p className="footnote">접속 코드는 현재 탭의 세션에만 보관합니다. LS 앱키·시크릿은 Cloudflare의 Secret 설정에만 등록하세요. 시세 기록은 서버에, 메모·관심종목은 이 브라우저에 보관합니다.</p><p className="footnote">시세 서버: {API_URL}<br/>해외 지수·환율·SOX·금리와 전체 KODEX 순위는 별도 데이터가 필요합니다. ETF는 수집 목록에 포함된 KODEX 범위입니다. 캘린더는 연결 이후 수집한 날짜부터 쌓입니다.</p><p role="status" aria-live="polite">{message}</p></section>;
}
