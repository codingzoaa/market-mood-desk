import PasskeyGate from './passkey-gate.tsx';
import React from 'react';
import LossGuard from './loss-guard.tsx';
export const ACCOUNT_API_ORIGIN='https://market-note-account.kby0991.workers.dev';
export default function AccountWorkspace(){return <div className="account-workspace"><PasskeyGate apiBase={ACCOUNT_API_ORIGIN}><LossGuard apiBase={ACCOUNT_API_ORIGIN}/></PasskeyGate></div>;}
