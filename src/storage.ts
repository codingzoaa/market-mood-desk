import { accessCode, liveDashboard, liveCache, NOTES_KEY } from './live';
import { dayKey, shiftDay, validateImport, type Snapshot } from './market';

const KEY = 'market-note:v1';
type Store = { snapshots: Snapshot[]; watchlist: string[] };
function read(): Store {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { snapshots: [], watchlist: [] };
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.snapshots) || !Array.isArray(data.watchlist)) throw Error();
    return data;
  } catch { throw Error('저장된 기록을 읽지 못했습니다. 브라우저 데이터를 지우기 전에 백업을 확인하세요.'); }
}
function write(data: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { throw Error('브라우저 저장 공간을 사용할 수 없습니다. 기존 기록은 유지됩니다. 저장 공간과 브라우저 설정을 확인하세요.'); }
}
export async function localApi(path: string, body?: any): Promise<any> {
  const url = new URL(path, 'https://local.invalid');
  if (url.pathname === '/api/connection') return { connected: !!accessCode(), lsConfigured: !!accessCode() };
  const data = read();
  if (url.pathname === '/api/dashboard') {
    const to = url.searchParams.get('date') || dayKey();
    if (accessCode()) { const result = await liveDashboard(to); const notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); return { ...result, snapshots: result.snapshots.map(s => ({ ...s, note: typeof notes[s.date] === 'string' ? notes[s.date] : '' })), watchlist: data.watchlist }; }
    return { snapshots: data.snapshots.filter(s => s.date <= to && s.date >= shiftDay(to, -364)), watchlist: data.watchlist,
      feed: { configured: false, failed: false, message: '파일 기반 기록 · 실시간 시세 연결 없음', lastSuccessAt: null } };
  }
  if (url.pathname === '/api/watchlist') {
    if (!Array.isArray(body?.symbols) || body.symbols.length > 3000 || body.symbols.some((s: unknown) => typeof s !== 'string' || !/^\d{6}$/.test(s))) throw Error('관심종목 코드를 확인하세요.');
    write({ ...data, watchlist: [...new Set<string>(body.symbols)] });
    return { ok: true };
  }
  if (url.pathname === '/api/note') {
    if(accessCode()) { if(typeof body?.note !== 'string'||body.note.length>3000||!liveCache().some(s=>s.date===body.date))throw Error('메모 날짜를 확인하세요.'); const notes=JSON.parse(localStorage.getItem(NOTES_KEY)||'{}'); notes[body.date]=body.note;try{localStorage.setItem(NOTES_KEY,JSON.stringify(notes));}catch{throw Error('메모를 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.');}return {ok:true}; }
    if (typeof body?.note !== 'string' || body.note.length > 3000 || !data.snapshots.some(s => s.date === body.date)) throw Error('저장할 날짜와 메모를 확인하세요.');
    write({ ...data, snapshots: data.snapshots.map(s => s.date === body.date ? { ...s, note: body.note } : s) });
    return { ok: true };
  }
  if (url.pathname === '/api/import') {
    const incoming = validateImport(body);
    if (incoming.some(s => /시뮬레이션|demo|sample|가상/i.test(s.source))) throw Error('가상 시세는 예시 공간에서만 확인하세요. 실제 기록을 가져오세요.');
    if (!body.overwrite && incoming.some(s => data.snapshots.some(old => old.date === s.date))) throw Error('같은 날짜가 있습니다. 교체 여부를 확인하세요.');
    const merged = new Map(data.snapshots.map(s => [s.date, s]));
    incoming.forEach(s => merged.set(s.date, s));
    const snapshots = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (snapshots.length > 365) throw Error('최대 365일을 저장할 수 있습니다. 먼저 기록을 백업하세요.');
    write({ ...data, snapshots });
    return { ok: true };
  }
  throw Error('지원하지 않는 작업입니다.');
}
