import {validateDetails} from './market-details';
import { validateImport, type Snapshot } from './market';
export const API_URL = 'https://market-note-ls-api.kby0991.workers.dev';
const CACHE_KEY = 'market-note:ls-cache';
export const NOTES_KEY = 'market-note:ls-notes';
export function liveCache(): Snapshot[] {
  try { const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); return Array.isArray(raw) ? raw : []; } catch { return []; }
}
export async function liveDashboard(to: string) {
  try {
    const response = await fetch(API_URL + '/api/dashboard?date=' + encodeURIComponent(to), { credentials: 'omit', signal: AbortSignal.timeout(12000), redirect: 'error' });
    if (response.status === 503) throw Error('서버 설정 또는 LS 키 등록을 확인하세요.');
    if (!response.ok) throw Error('시세 서버 응답을 확인하지 못했습니다.');
    const text = await response.text();
    if (text.length > 6000000) throw Error('시세 응답이 너무 큽니다.');
    const raw = JSON.parse(text);
    if (raw.schemaVersion !== 2 || !Array.isArray(raw.snapshots) || raw.snapshots.length > 28) throw Error('시세 응답 형식이 맞지 않습니다.');
    const snapshots = raw.snapshots.length ? validateImport(raw) : [];
    if (snapshots.some(s => !s.source.startsWith('LS증권 KRX') || /시뮬레이션|demo|가상/i.test(s.source) || s.date > to)) throw Error('시세 출처 또는 날짜가 맞지 않습니다.');
    const existing = liveCache(); const dates = new Map(existing.map(s => [s.date, s]));
    snapshots.forEach(s => dates.set(s.date, s));
    const cached = [...dates.values()].map(s=>s.details?.heatmap?{...s,details:{...s.details,heatmap:undefined}}:s).sort((a,b) => a.date.localeCompare(b.date)).slice(-365);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cached)); } catch { /* Server remains the durable quote store. */ }
    return { snapshots: snapshots.sort((a,b) => a.date.localeCompare(b.date)), feed: { configured: true, failed: !!raw.feed?.failed, lastSuccessAt: typeof raw.feed?.lastSuccessAt === 'string' ? raw.feed.lastSuccessAt : null, message: raw.feed?.failed ? (typeof raw.feed?.error === 'string' && /^LS_AUTH_(NETWORK_FAILED|TIMEOUT|TLS_FAILED|PORT_REJECTED|DNS_FAILED|CONNECTION_FAILED|REQUEST_REJECTED|EDGE_INTERNAL)$/.test(raw.feed.error) ? 'LS 인증 서버 통신 실패 · '+raw.feed.error : 'LS 수집 오류 · 마지막 정상 기록 유지') : 'LS증권 KRX · 5분 수집 · KRX 15:30까지 · 시장별 최대100개 · 테마 부분 보강' } };
  } catch (error) {
    const cached = liveCache().filter(s => s.date <= to && s.date >= new Date(Date.parse(to+'T12:00:00Z')-27*86400000).toISOString().slice(0,10));
    // Preserve validated quotes when the read-only service is temporarily unavailable.
    if (!cached.length || (error instanceof Error && /서버 설정/.test(error.message))) throw error;
    return { snapshots: cached, feed: { configured: true, failed: true, lastSuccessAt: null, message: '시세 서버 연결 오류 · 마지막 정상 기록 유지' } };
  }
}

export async function liveMarketDetails(date:string,signal?:AbortSignal){
 const response=await fetch(API_URL+'/api/market-details?date='+encodeURIComponent(date),{credentials:'omit',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),redirect:'error'});
 if(!response.ok)throw Error('시장 상세 데이터 연결을 확인하세요.');const text=await response.text();if(text.length>3000000)throw Error('시장 상세 응답 크기 오류');const raw=JSON.parse(text);return raw.details?validateDetails(raw.details,date):null;
}
