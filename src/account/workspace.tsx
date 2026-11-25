import React from 'react';
import LossGuard from './loss-guard.tsx';
export const ACCOUNT_API_ORIGIN='https://market-note-account.kby0991.workers.dev';
export default function AccountWorkspace(){return <div className="account-workspace"><LossGuard apiBase={ACCOUNT_API_ORIGIN}/></div>;}
