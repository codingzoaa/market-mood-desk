"""Read-only loss guard calculations. All amounts are KRW. No order API."""
from datetime import datetime, timezone, timedelta
from copy import deepcopy
import math
KST = timezone(timedelta(hours=9))
DEFAULT = dict(mode='realized', limitKind='percent', limitPercent=3, fixedLimitKRW=100000,
               warnPercent=80, repeatMinutes=5, afternoonAt='11:00', tradeWarn=10,
               tradeStrong=20, givebackWarnPercent=30, givebackStrongPercent=50)

def settings(raw=None):
    c = {**DEFAULT, **(raw or {})}
    if c['mode'] not in ('realized', 'combined') or c['limitKind'] not in ('fixed', 'percent'):
        raise ValueError('Invalid mode')
    try:
        datetime.strptime(c['afternoonAt'], '%H:%M')
    except (TypeError, ValueError):
        raise ValueError('Invalid afternoon time')
    if not '09:00' <= c['afternoonAt'] <= '15:30':
        raise ValueError('Invalid afternoon time')
    for k, lo, hi in [('limitPercent', .01, 100), ('fixedLimitKRW', 1, 10**12),
                      ('warnPercent', 1, 99), ('repeatMinutes', 0, 1440),
                      ('tradeWarn', 1, 10000), ('tradeStrong', 2, 10000),
                      ('givebackWarnPercent', 1, 99), ('givebackStrongPercent', 2, 100)]:
        n = c[k]
        if isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or not lo <= n <= hi:
            raise ValueError('Invalid ' + k)
    if c['tradeStrong'] <= c['tradeWarn'] or c['givebackStrongPercent'] <= c['givebackWarnPercent']:
        raise ValueError('Strong warning must exceed warning')
    for k in ('tradeWarn', 'tradeStrong', 'fixedLimitKRW'):
        if int(c[k]) != c[k]:
            raise ValueError('Integer required')
    return {k: c[k] for k in DEFAULT}

def parse_at(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00'))

def step(previous, sample, raw=None, now=None):
    c = settings(raw)
    moment = parse_at(sample['at'])
    now = now or datetime.now(timezone.utc)
    if abs((now - moment).total_seconds()) > 120:
        raise ValueError('Stale sample')
    for k in ('equityKRW', 'realizedKRW', 'unrealizedKRW'):
        if isinstance(sample[k], bool) or not isinstance(sample[k], int) or abs(sample[k]) > 2**53 - 1:
            raise ValueError('Invalid balance')
    if sample['equityKRW'] < 0:
        raise ValueError('Invalid equity')
    clock = moment.astimezone(KST)
    date, time = clock.strftime('%Y-%m-%d'), clock.strftime('%H:%M')
    if sample['date'] != date:
        raise ValueError('Date mismatch')
    fresh = not previous or previous['date'] != date
    s = dict(date=date, baselineAt=sample['at'], baselineEquityKRW=sample['equityKRW'],
             baselineUnrealizedKRW=sample['unrealizedKRW'], morningKRW=None,
             morningAt=None, morningEstimated=False, warned=False, limited=False,
             lastLimitAt=None, tradeLevel=0, givebackLevel=0) if fresh else deepcopy(previous)
    alerts = []
    if s.get('lastSampleAt'):
        if moment < parse_at(s['lastSampleAt']):
            raise ValueError('Reversed sample')
        if moment == parse_at(s['lastSampleAt']):
            return {**s, 'alerts': []}
    if time >= c['afternoonAt'] and s['morningKRW'] is None:
        s.update(morningKRW=sample['realizedKRW'], morningAt=sample['at'],
                 morningEstimated=fresh or time != c['afternoonAt'])
        alerts.append(dict(kind='MORNING', message='오후 손익 기준을 기록했습니다. 기준 시각을 확인하세요.'))
    pnl = sample['realizedKRW'] + (sample['unrealizedKRW'] - s['baselineUnrealizedKRW'] if c['mode'] == 'combined' else 0)
    loss = max(0, -pnl)
    limit = c['fixedLimitKRW'] if c['limitKind'] == 'fixed' else s['baselineEquityKRW'] * c['limitPercent'] / 100
    ratio = loss / limit if limit > 0 else None
    if limit > 0 and loss < limit * c['warnPercent'] / 200:
        s.update(warned=False, limited=False, lastLimitAt=None)
    epoch = now.timestamp() * 1000
    if ratio is not None and ratio >= 1:
        if not s['limited'] or c['repeatMinutes'] > 0 and epoch - (s['lastLimitAt'] or 0) >= c['repeatMinutes'] * 60000:
            alerts.append(dict(kind='LIMIT', message='하루 손실 한도에 도달했습니다. 매매를 멈추고 계좌를 확인하세요.'))
            s['lastLimitAt'] = epoch
        s.update(limited=True, warned=True)
    elif ratio is not None and ratio >= c['warnPercent'] / 100 and not s['warned']:
        alerts.append(dict(kind='WARNING', message=f"손실 한도의 {c['warnPercent']}%에 도달했습니다."))
        s['warned'] = True
    afternoon = None if s['morningKRW'] is None else sample['realizedKRW'] - s['morningKRW']
    giveback = max(0, -afternoon) / s['morningKRW'] * 100 if s['morningKRW'] is not None and s['morningKRW'] > 0 else None
    count = sample.get('afternoonOrders')
    if time >= c['afternoonAt'] and isinstance(count, int) and count >= 0:
        level = 2 if count >= c['tradeStrong'] else 1 if count >= c['tradeWarn'] else 0
        if level > s['tradeLevel']:
            alerts.append(dict(kind='OVERTRADE', message=f'오후 체결 주문 {count}회 · 과매매 주의'))
        s['tradeLevel'] = max(level, s['tradeLevel'])
    if giveback is not None:
        level = 2 if giveback >= c['givebackStrongPercent'] else 1 if giveback >= c['givebackWarnPercent'] else 0
        if level > s['givebackLevel']:
            alerts.append(dict(kind='GIVEBACK', message=f'오후 기준 수익의 {giveback:.1f}%를 반납했습니다.'))
        s['givebackLevel'] = max(level, s['givebackLevel'])
    return {**s, 'lastSampleAt': sample['at'], 'sample': sample, 'pnlKRW': pnl, 'lossKRW': loss,
            'limitKRW': limit if limit > 0 else None, 'ratio': ratio, 'afternoonKRW': afternoon,
            'givebackPercent': giveback, 'alerts': alerts}
