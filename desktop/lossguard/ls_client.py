"""LS OPEN API allowlist: token, t0424, CSPAQ13700 only."""
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from engine import KST
BASE = 'https://openapi.ls-sec.co.kr:8080'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('Redirect rejected')

def integer(v):
    if isinstance(v, bool) or not isinstance(v, (int, str)) or not str(v).lstrip('-+').isdigit():
        raise ValueError('Invalid amount')
    n = int(v)
    if abs(n) > 2**53 - 1:
        raise ValueError('Amount out of range')
    return n

def order_count(rows, date, cutoff):
    orders = {}
    for r in rows:
        if r.get('OrdDt') != date.replace('-', '') or str(r.get('BnsTpCode')) not in ('1', '2'):
            raise ValueError('Invalid order date')
        oid, parent, t = str(r.get('OrdNo')), str(r.get('OrgOrdNo')), str(r.get('OrdTime'))
        if not oid.isdigit() or not parent.isdigit() or not t.isdigit() or not 6 <= len(t) <= 9:
            raise ValueError('Invalid order')
        datetime.strptime(t[:6], '%H%M%S')
        qty = integer(r.get('AllExecQty', r.get('ExecQty')))
        if qty < 0:
            raise ValueError('Invalid executed quantity')
        old = orders.get(oid)
        order_time = t[:2] + ':' + t[2:4]
        if old and (old['parent'] != parent or old['time'] != order_time):
            raise ValueError('Order conflict')
        orders[oid] = dict(parent=parent, time=order_time, qty=max(qty, old['qty'] if old else 0))
    roots = set()
    for oid, row in orders.items():
        if not row['qty']:
            continue
        root, r, seen = oid, row, {oid}
        while r['parent'] not in ('0', root):
            root = r['parent']
            if root in seen or root not in orders:
                raise ValueError('Incomplete original order chain')
            seen.add(root)
            r = orders[root]
        if r['time'] >= cutoff:
            roots.add(root)
    return len(roots)

class LSClient:
    def __init__(self, key, secret):
        self.key, self.secret = key, secret
        self.token, self.expires = None, 0
        self.opener = urllib.request.build_opener(NoRedirect())
    def _post(self, path, body, headers):
        req = urllib.request.Request(BASE + path, data=body, headers=headers, method='POST')
        with self.opener.open(req, timeout=15) as r:
            raw = r.read(1500001)
            if len(raw) > 1500000:
                raise ValueError('Response too large')
            return json.loads(raw), r.headers
    def _auth(self):
        if self.token and time.time() < self.expires - 120:
            return
        body = urllib.parse.urlencode(dict(grant_type='client_credentials', appkey=self.key,
                                          appsecretkey=self.secret, scope='oob')).encode()
        d, _ = self._post('/oauth2/token', body, {'Content-Type': 'application/x-www-form-urlencoded'})
        if not isinstance(d.get('access_token'), str) or not d['access_token'] or float(d.get('expires_in', 0)) <= 0:
            raise ValueError('Authentication failed')
        self.token, self.expires = d['access_token'], time.time() + float(d['expires_in'])
    def _tr(self, code, block, flag='N', key=''):
        if code not in ('t0424', 'CSPAQ13700'):
            raise ValueError('TR not allowed')
        self._auth()
        name = 't0424InBlock' if code == 't0424' else 'CSPAQ13700InBlock1'
        d, h = self._post('/stock/accno', json.dumps({name: block}).encode(),
                          {'Content-Type': 'application/json; charset=utf-8', 'authorization': 'Bearer ' + self.token,
                           'tr_cd': code, 'tr_cont': flag, 'tr_cont_key': key})
        if not isinstance(d.get('rsp_cd'), str) or not d['rsp_cd'] or set(d['rsp_cd']) != {'0'}:
            self.token = None
            raise ValueError('LS query failed')
        return d, h
    def sample(self, cutoff):
        date = datetime.now(KST).strftime('%Y-%m-%d')
        d, _ = self._tr('t0424', dict(prcgb='1', chegb='2', dangb='0', charge='1', cts_expcode=''))
        b = d['t0424OutBlock']
        balance_at = datetime.now(timezone.utc)
        result = dict(equityKRW=integer(b['sunamt']), realizedKRW=integer(b['dtsunik']), unrealizedKRW=integer(b['tdtsunik']),
                      afternoonOrders=None, ordersAvailable=False)
        start = time.monotonic()
        try:
            flag, key, rows, seen = 'N', '', [], set()
            for _ in range(16):
                if time.monotonic() - start > 60:
                    raise ValueError('Order deadline')
                time.sleep(1.1)
                d, h = self._tr('CSPAQ13700', dict(OrdMktCode='00', BnsTpCode='0', IsuNo='', ExecYn='0',
                            OrdDt=date.replace('-', ''), SrtOrdNo2=999999999, BkseqTpCode='0', OrdPtnCode='00'), flag, key)
                part = d.get('CSPAQ13700OutBlock3')
                if not isinstance(part, list) or len(part) > 1000:
                    raise ValueError('Invalid order rows')
                rows.extend(part)
                flag, key = h.get('tr_cont'), h.get('tr_cont_key', '')
                if flag == 'N':
                    result.update(afternoonOrders=order_count(rows, date, cutoff), ordersAvailable=True)
                    break
                if flag != 'Y' or not key or key in seen:
                    raise ValueError('Incomplete order query')
                seen.add(key)
        except Exception:
            pass  # Account PnL remains valid, unknown order count is never zero-filled.
        at = datetime.now(timezone.utc)
        if at.astimezone(KST).strftime('%Y-%m-%d') != date:
            raise ValueError('Date rollover')
        return {**result, 'date': date, 'at': balance_at.isoformat()}
