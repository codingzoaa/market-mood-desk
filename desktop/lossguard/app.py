"""Marketnote LS Loss Guard for Windows. Run app.py or the packaged executable."""
import os
import queue
import threading
import tkinter as tk
from tkinter import ttk, messagebox
import webbrowser
from copy import deepcopy
from engine import DEFAULT, settings, step
from ls_client import LSClient
import secure_store
VERSION = '0.1.0'
LABELS = {'limitPercent': '손실 한도 (%)', 'fixedLimitKRW': '고정 손실 한도 (원)',
          'warnPercent': '사전 경고 (%)', 'repeatMinutes': '한도 경고 반복 (분 · 0=끔)',
          'afternoonAt': '오후 기준 (HH:MM)', 'tradeWarn': '체결 주문 주의 (회)',
          'tradeStrong': '체결 주문 강한 경고 (회)', 'givebackWarnPercent': '수익 반납 주의 (%)',
          'givebackStrongPercent': '수익 반납 강한 경고 (%)'}
def won(v):
    return f'{v:,.0f}원' if isinstance(v, (int, float)) else '—'

class Application:
    def __init__(self, root):
        self.root, self.events = root, queue.Queue()
        self.running, self.busy, self.generation, self.failures = False, False, 0, 0
        self.store_error = False
        try:
            self.record = secure_store.load()
        except Exception:
            self.record, self.store_error = {}, True
        self.config = settings(self.record.get('settings'))
        self.state = self.record.get('state')
        self.client = None
        root.title('마켓노트 · LS 손실 감지기 ' + VERSION)
        root.geometry('760x820')
        root.minsize(650, 700)
        root.configure(bg='#f4f7f3')
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TFrame', background='#f4f7f3')
        style.configure('TLabel', background='#f4f7f3', foreground='#183d32', font=('맑은 고딕', 10))
        style.configure('TButton', padding=7)
        shell = ttk.Frame(root, padding=22)
        shell.pack(fill='both', expand=True)
        ttk.Label(shell, text='LS LOSS GUARD  ·  조회 전용', font=('맑은 고딕', 11, 'bold')).pack(anchor='w')
        ttk.Label(shell, text='하루 손실을 확인하고, 매매를 쉬어갈 때', font=('맑은 고딕', 18, 'bold')).pack(anchor='w', pady=(8, 16))
        self.status = tk.StringVar(value='감시 중지 · 시작하면 30초마다 조회합니다.')
        ttk.Label(shell, textvariable=self.status, wraplength=680).pack(anchor='w')
        self.value = tk.StringVar(value='—')
        ttk.Label(shell, textvariable=self.value, font=('맑은 고딕', 30, 'bold')).pack(anchor='w', pady=(15, 5))
        self.detail = tk.StringVar(value='당일 실현손익 · 최초 조회 전')
        ttk.Label(shell, textvariable=self.detail, wraplength=680).pack(anchor='w')
        self.progress = ttk.Progressbar(shell, maximum=100)
        self.progress.pack(fill='x', pady=12)
        self.secondary = tk.StringVar(value='오후 손익 — · 오후 주문 — · 수익 반납 —')
        ttk.Label(shell, textvariable=self.secondary, wraplength=680).pack(anchor='w')
        buttons = ttk.Frame(shell)
        buttons.pack(fill='x', pady=15)
        self.start_button = ttk.Button(buttons, text='감시 시작', command=self.toggle)
        self.start_button.pack(side='left')
        ttk.Button(buttons, text='오늘 기준 다시 잡기', command=self.reset).pack(side='left', padx=8)
        ttk.Button(buttons, text='계좌분석 열기', command=lambda: webbrowser.open('https://market-note-account.kby0991.workers.dev/#lossguard')).pack(side='right')
        tabs = ttk.Notebook(shell)
        tabs.pack(fill='both', expand=True)
        config_tab, key_tab, history_tab = (ttk.Frame(tabs, padding=15) for _ in range(3))
        tabs.add(config_tab, text='손실·경고 설정')
        tabs.add(key_tab, text='LS 연결')
        tabs.add(history_tab, text='최근 기록')
        self.vars = {k: tk.StringVar(value=str(v)) for k, v in self.config.items()}
        all_fields = [('mode', '손익 기준'), ('limitKind', '한도 방식')] + list(LABELS.items())
        for i, (key, label) in enumerate(all_fields):
            col, row = i % 2, i // 2
            cell = ttk.Frame(config_tab)
            cell.grid(row=row, column=col, sticky='ew', padx=7, pady=4)
            ttk.Label(cell, text=label).pack(anchor='w')
            if key in ('mode', 'limitKind'):
                widget = ttk.Combobox(cell, textvariable=self.vars[key], state='readonly',
                          values=('realized', 'combined') if key == 'mode' else ('percent', 'fixed'))
            else:
                widget = ttk.Entry(cell, textvariable=self.vars[key])
            widget.pack(fill='x', pady=3)
        for i in range(2):
            config_tab.columnconfigure(i, weight=1)
        ttk.Button(config_tab, text='설정 저장', command=self.save_config).grid(row=6, column=0, sticky='w', padx=7, pady=8)
        ttk.Label(config_tab, text='realized = 실현손익  /  combined = 실현 + 평가손익 변화\npercent = 최초 순자산 비율  /  fixed = 고정 금액', wraplength=650).grid(row=7, column=0, columnspan=2, sticky='w', padx=7)
        self.key, self.secret = tk.StringVar(), tk.StringVar()
        for label, var in [('APP KEY', self.key), ('APP SECRET', self.secret)]:
            ttk.Label(key_tab, text=label).pack(anchor='w', pady=(10, 4))
            ttk.Entry(key_tab, textvariable=var, show='•').pack(fill='x')
        ttk.Button(key_tab, text='Windows 자격 증명에 저장', command=self.save_keys).pack(anchor='w', pady=15)
        ttk.Label(key_tab, text='같은 앱키를 마켓노트 시세 수집과 동시에 사용하지 마세요.\n손실 감시용 별도 LS OPEN API 앱키 사용을 권장합니다.\n앱키가 연결된 국내주식 계좌를 조회하며 주문을 전송하지 않습니다.', wraplength=650).pack(anchor='w')
        try:
            key, secret = secure_store.credentials()
            self.key.set(key)
            self.secret.set(secret)
        except Exception:
            self.status.set('Windows 자격 증명 저장소 연결을 확인해 주세요.')
        self.history = tk.Text(history_tab, wrap='word', height=12, font=('맑은 고딕', 10), relief='flat')
        self.history.pack(fill='both', expand=True)
        ttk.Label(shell, text='최소화해도 감시합니다. 프로그램 종료·PC 절전·인터넷 단절 시 감시 불가.\n선물·옵션·해외주식 제외 · 자동 주문·청산·PC 종료 기능 없음', wraplength=680).pack(anchor='w', pady=(14, 0))
        root.protocol('WM_DELETE_WINDOW', self.close)
        self.render()
        if self.store_error:
            self.start_button.configure(state='disabled')
            self.status.set('저장 기록 복호화 실패 · 원본 기록을 보존했습니다. 감시를 시작할 수 없습니다.')
        root.after(200, self.drain)

    def persist(self):
        secure_store.save({**self.record, 'settings': self.config, 'state': self.state})
    def save_config(self):
        if self.running or self.busy:
            messagebox.showinfo('설정', '감시를 중지하고 조회가 끝난 뒤 수정하세요.')
            return
        try:
            raw = {k: self.vars[k].get() if k in ('mode', 'limitKind', 'afternoonAt') else float(self.vars[k].get()) for k in DEFAULT}
            for k in ('tradeWarn', 'tradeStrong', 'fixedLimitKRW'):
                if raw[k] != int(raw[k]):
                    raise ValueError('정수 필요')
                raw[k] = int(raw[k])
            c = settings(raw)
            secure_store.save({**self.record, 'settings': c, 'state': self.state})
            self.config = c
            self.status.set('설정을 저장했습니다. 다음 조회부터 적용합니다.')
        except Exception:
            messagebox.showerror('설정', '설정 값과 암호화 저장 상태를 확인하세요. 강한 경고는 주의 기준보다 커야 합니다.')
    def save_keys(self):
        if self.running or self.busy:
            messagebox.showinfo('LS 연결', '감시를 중지한 뒤 저장하세요.')
            return
        try:
            key, secret = self.key.get().strip(), self.secret.get().strip()
            if not key or not secret:
                raise ValueError('Missing keys')
            secure_store.credentials(key, secret)
            self.status.set('앱키를 Windows 자격 증명에 저장했습니다.')
        except Exception:
            messagebox.showerror('LS 연결', '앱키 또는 Windows 자격 증명 저장소를 확인하세요.')
    def toggle(self):
        if self.running:
            self.running = False
            self.generation += 1
            self.start_button.configure(text='감시 시작')
            self.status.set('감시 중지')
        else:
            if self.busy:
                return
            key, secret = self.key.get().strip(), self.secret.get().strip()
            if not key or not secret:
                messagebox.showinfo('LS 연결', 'LS 연결 탭에 APP KEY와 SECRET을 입력하세요.')
                return
            self.client = LSClient(key, secret)
            self.running, self.failures = True, 0
            self.generation += 1
            self.start_button.configure(text='감시 중지')
            self.query()
    def query(self):
        if not self.running or self.busy:
            return
        self.busy = True
        self.status.set('LS 계좌 조회 중…')
        generation, config, previous, client = self.generation, deepcopy(self.config), deepcopy(self.state), self.client
        def work():
            try:
                result = step(previous, client.sample(config['afternoonAt']), config)
                self.events.put((generation, result))
            except Exception:
                self.events.put((generation, None))
        threading.Thread(target=work, daemon=True).start()
    def drain(self):
        try:
            while True:
                generation, result = self.events.get_nowait()
                self.busy = False
                if generation != self.generation or not self.running:
                    continue
                if result is None:
                    self.failures += 1
                    self.status.set(f'조회 실패 {self.failures}회 · 마지막 정상 수치 유지 (현재값 아님)')
                    if self.failures == 3:
                        self.alert(['3회 연속 조회 실패 · 손실 감시가 지연되고 있습니다.'])
                else:
                    self.failures = 0
                    history = [r for r in self.record.get('history', []) if r['date'] != result['date']]
                    history.append({k: result.get(k) for k in ('date', 'pnlKRW', 'afternoonKRW', 'morningEstimated')}
                                   | {'afternoonOrders': result['sample']['afternoonOrders']})
                    new_record = {'settings': self.config, 'state': result, 'history': sorted(history, key=lambda r: r['date'])[-90:]}
                    try:
                        secure_store.save(new_record)
                        self.record, self.state = new_record, result
                        self.status.set('감시 중 · 마지막 조회 ' + result['lastSampleAt'] + ' (UTC)')
                        self.render()
                        self.alert([a['message'] for a in result['alerts']])
                    except Exception:
                        self.toggle()
                        self.alert(['암호화 기록 저장 실패로 감시를 중지했습니다. 마지막 저장 기준을 유지합니다.'])
                if self.running:
                    self.root.after(30000, lambda g=generation: self.query() if g == self.generation else None)
        except queue.Empty:
            pass
        self.root.after(200, self.drain)
    def render(self):
        s = self.state
        if s:
            self.value.set(won(s['pnlKRW']))
            ratio = s.get('ratio')
            self.detail.set(('실현 + 평가 변화' if self.config['mode'] == 'combined' else '오늘 실현손익') +
                            ' · 손실 한도 ' + won(s['limitKRW']) + ' · 소진 ' + (f'{ratio*100:.1f}%' if ratio is not None else '—'))
            self.progress['value'] = min(100, (ratio or 0) * 100)
            count, giveback = s['sample'].get('afternoonOrders'), s.get('givebackPercent')
            self.secondary.set(f"오후 실현 {won(s.get('afternoonKRW'))} · 체결 주문 {str(count)+'회' if count is not None else '확인 불가'} · 반납 {f'{giveback:.1f}%' if giveback is not None else '—'}\n" +
                               f"오후 기준 {s.get('morningAt') or '관측 전'}" + (' · 지연 관측값' if s.get('morningEstimated') else ''))
        self.history.configure(state='normal')
        self.history.delete('1.0', 'end')
        rows = self.record.get('history', [])
        recent = rows[-20:]
        def avg(group, key):
            values = [r[key] for r in group if isinstance(r.get(key), (int, float))]
            return won(sum(values) / len(values)) if values else '—'
        high = [r for r in recent if r.get('afternoonOrders') is not None and r['afternoonOrders'] >= 10]
        low = [r for r in recent if r.get('afternoonOrders') is not None and r['afternoonOrders'] < 10]
        self.history.insert('end', f"최근 {len(recent)}일 평균 손익 {avg(recent, 'pnlKRW')}\n오후 10회 이상 평균 {avg(high, 'afternoonKRW')} / 10회 미만 {avg(low, 'afternoonKRW')}\n\n")
        for r in reversed(rows):
            self.history.insert('end', f"{r['date']}  손익 {won(r['pnlKRW'])}  오후 {won(r.get('afternoonKRW'))}  주문 {r.get('afternoonOrders') if r.get('afternoonOrders') is not None else '—'}\n")
        self.history.insert('end', '\n감시한 날의 마지막 관측값입니다. 종가 확정 기록이 아닙니다.')
        self.history.configure(state='disabled')
    def reset(self):
        if self.running or self.busy or self.store_error:
            messagebox.showinfo('기준 초기화', '감시를 중지하고 조회가 끝난 뒤 시도하세요.')
            return
        if not messagebox.askyesno('기준 초기화', '최초 순자산·평가손익 기준을 다음 조회 시각으로 다시 잡을까요?'):
            return
        try:
            secure_store.save({**self.record, 'settings': self.config, 'state': None})
            self.state = None
            self.value.set('—')
            self.detail.set('기준 초기화 완료 · 감시를 시작하면 새 기준을 기록합니다.')
            self.progress['value'] = 0
            self.secondary.set('오후 손익 — · 오후 주문 — · 수익 반납 —')
        except Exception:
            messagebox.showerror('기준 초기화', '암호화 저장을 확인하세요.')
    def alert(self, lines):
        if not lines:
            return
        try:
            import winsound
            winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
        except Exception:
            self.root.bell()
        top = tk.Toplevel(self.root)
        top.title('마켓노트 · 손실 감지 알림')
        top.attributes('-topmost', True)
        ttk.Label(top, text='\n\n'.join(lines), wraplength=430, padding=25).pack()
        ttk.Button(top, text='확인', command=top.destroy).pack(pady=15)
        top.lift()
    def close(self):
        if self.running and not messagebox.askyesno('감시 종료', '프로그램을 종료하면 손실 감시가 중지됩니다. 종료할까요?'):
            return
        self.running = False
        self.generation += 1
        self.root.destroy()

if __name__ == '__main__':
    if os.name != 'nt':
        raise SystemExit('This application requires Windows 10/11.')
    import ctypes
    kernel = ctypes.windll.kernel32
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
    kernel.CreateMutexW.restype = ctypes.c_void_p
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel.CreateMutexW(None, False, 'Local\\MarketnoteLSLossGuard')
    if not handle or kernel.GetLastError() == 183:
        raise SystemExit('Loss guard is already running or mutex unavailable.')
    try:
        root = tk.Tk()
        Application(root)
        root.mainloop()
    finally:
        kernel.CloseHandle(handle)
