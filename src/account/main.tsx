import React from 'react';
import {createRoot} from 'react-dom/client';
import LossGuard from './loss-guard.tsx';
export default function Account(){return <div className="account-shell"><header className="account-header"><a className="wordmark" href="https://codingzoaa.github.io/market-mood-desk/">m<span>marketnote</span></a><a href="https://codingzoaa.github.io/market-mood-desk/">마켓노트로 돌아가기</a></header><main><div className="account-heading"><div><span className="eyebrow">ACCOUNT WORKSPACE</span><h1>계좌 분석</h1><p>LS증권 손실 감지 · 잔고와 손익의 흐름을 확인하세요.</p></div></div><LossGuard/><footer>MARKETNOTE <span>LS 계좌 조회 · 서버 암호화 저장</span></footer></main></div>;}
if(typeof document!=='undefined'&&document.getElementById('root'))createRoot(document.getElementById('root')!).render(<Account/>);
