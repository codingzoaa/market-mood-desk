#!/usr/bin/env python3
"""Reproduce the original calendar-SMA20 and append audited, post-close KOSPI breadth.
Raw prices, numeric KOSPI share codes and positive-volume observations intentionally
match run_marcap_kospi.py. This is NOT a certified common-share/adjusted-price index.
"""
import argparse
import hashlib
import io
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import pandas as pd

API = 'https://market-note-ls-api.kby0991.workers.dev'
KST = ZoneInfo('Asia/Seoul')
FLAGS = {'2020-08-18', '2026-03-04', '2026-10-23'}
class NotReady(Exception): pass

def get_json(url):
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'Cache-Control': 'no-cache', 'User-Agent': 'MarketNote-breadth/1.0'})
    with urllib.request.urlopen(req, timeout=45) as response:
        raw = response.read(12_000_001)
    if len(raw) > 12_000_000: raise ValueError('Response too large')
    return json.loads(raw)

def read_marcap(year):
    url = f'https://api.github.com/repos/FinanceData/marcap/contents/data/marcap-{year}.parquet'
    meta = get_json(url)
    expected = f'https://raw.githubusercontent.com/FinanceData/marcap/master/data/marcap-{year}.parquet'
    if meta.get('download_url') != expected or not 0 < meta.get('size', 0) < 150_000_000: raise ValueError('Unexpected marcap source')
    req = urllib.request.Request(expected, headers={'User-Agent': 'MarketNote-breadth/1.0'})
    with urllib.request.urlopen(req, timeout=150) as response: raw = response.read(150_000_001)
    digest = hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    if digest != meta['sha']: raise ValueError('Marcap changed during transfer; retry instead of mixing versions')
    return pd.read_parquet(io.BytesIO(raw)), {'year': year, 'url': expected, 'gitBlob': digest, 'sha256': hashlib.sha256(raw).hexdigest()}

def clean_prices(frame):
    required = {'Date', 'Code', 'Close', 'Volume', 'Market'}
    if not required.issubset(frame.columns): raise ValueError('Missing constituent fields')
    x = frame[list(required)].copy()
    x['Date'] = pd.to_datetime(x['Date'], errors='raise').dt.normalize()
    x['Code'] = x['Code'].astype(str).str.zfill(6)
    x['Close'] = pd.to_numeric(x['Close'], errors='raise')
    x['Volume'] = pd.to_numeric(x['Volume'], errors='raise')
    x = x[(x['Market'] == 'KOSPI') & x['Code'].str.fullmatch(r'\d{6}')]
    if x.duplicated(['Date', 'Code']).any(): raise ValueError('Duplicate stock/session')
    return x

def calculate_daily(frame, calendar):
    x = clean_prices(frame)
    # A zero-volume/missing session remains a hole on the market calendar. Do not
    # roll over each stock's last twenty available quotes or forward-fill gaps.
    x = x[(x['Close'] > 0) & (x['Volume'] > 0)]
    prices = x.pivot(index='Date', columns='Code', values='Close').reindex(pd.DatetimeIndex(calendar))
    sma = prices.rolling(20, min_periods=20).mean()
    valid = prices.notna() & sma.notna()
    count = valid.sum(axis=1)
    below = ((prices < sma) & valid).sum(axis=1)
    return pd.DataFrame({'validStockCount': count, 'belowStockCount': below, 'below20Pct': 100*below/count.replace(0, float('nan'))})

def validate_ls(payload, today):
    progress = payload.get('progress', {})
    record = payload.get('record')
    if not record or record.get('status') != 'COMPLETE': raise NotReady(f"LS close collection: {progress.get('status')} {progress.get('received',0)}/{progress.get('total',0)}")
    if record.get('date') != today and not (progress.get('date') == today and progress.get('status') == 'MARKET_CLOSED' and record.get('date', '') < today): raise NotReady('Latest trading session has not been collected')
    if record.get('method') != 'LS_KRX_DAILY_RAW_CLOSE_V1' or record.get('unit') != 'KRW': raise ValueError('Unverified LS source/method/units')
    seen = set(); prices = []
    for stock in record['stocks']:
        code = stock['symbol']
        if code in seen or len(code) != 6 or not code.isdigit() or stock.get('market') != 'KOSPI' or stock.get('collectedFor') != record['date']: raise ValueError('Invalid LS universe')
        seen.add(code)
        dates = set()
        for bar in stock['bars']:
            day = datetime.strptime(bar['date'], '%Y%m%d').date().isoformat()
            if day in dates or day > record['date']: raise ValueError('Invalid LS bar date')
            dates.add(day)
            if not isinstance(bar['close'], (int,float)) or not isinstance(bar['volume'], (int,float)) or not 0 <= bar['close'] <= 1e9 or not 0 <= bar['volume'] <= 1e14: raise ValueError('Invalid LS bar value')
            prices.append({'Date': pd.Timestamp(day), 'Code': code, 'Close': bar['close'], 'Volume': bar['volume'], 'Market': 'KOSPI'})
    if len(seen) != record['expected'] or not 700 <= len(seen) <= 1500: raise ValueError('Incomplete LS universe')
    indices = {}
    for row in record['indices']:
        day = datetime.strptime(row['date'], '%Y%m%d').date().isoformat()
        close = float(row['close'])
        if day in indices or day > record['date'] or not 0 < close < 1e7: raise ValueError('Invalid KOSPI history')
        indices[day] = close
    proof = record.get('indexVerification') or {}
    if max(indices) != record['date'] or proof.get('method') != 'T8429_VS_T1511_AFTER_CLOSE' or proof.get('date') != record['date'] or abs(proof.get('close',0)-indices[record['date']]) > .011: raise ValueError('Unverified index closing value')
    observed = datetime.fromisoformat(record['observedAt'].replace('Z','+00:00')).astimezone(KST)
    if observed.date().isoformat() != record['date'] or observed.hour < 16 or observed > datetime.now(KST)+timedelta(minutes=1): raise ValueError('Intraday/future LS snapshot')
    return record, pd.DataFrame(prices), indices

def refresh(data, public, payload, today):
    if data.get('schemaVersion') != 1 or data.get('status') != 'provisional': raise ValueError('Unexpected existing dataset')
    record, ls, indices = validate_ls(payload, today)
    public = clean_prices(public)
    public_end = public['Date'].max()
    target = min(pd.Timestamp(record['date']), public_end)
    calendar = sorted(set(public['Date']) | {pd.Timestamp(d) for d in indices})
    calendar = [d for d in calendar if d <= target]
    # Keep one constituent price source over every SMA window. LS supplies only
    # independently checked index closes; its differing stock closes are not spliced.
    combined = public
    daily = calculate_daily(combined, calendar)
    known = {r['date']:dict(r) for r in data['rows']}
    if len(known) != len(data['rows']): raise ValueError('Duplicate existing sessions')
    compared = matched = index_checks = 0
    for day in calendar[20:]:
        key = day.date().isoformat(); old = known.get(key); row = daily.loc[day]
        if old and old.get('below20Pct') is not None and row['validStockCount'] >= 600:
            compared += 1
            if old['validStockCount'] == int(row['validStockCount']) and abs(old['below20Pct']-round(float(row['below20Pct']),4)) < .00011: matched += 1
        if old and key in indices:
            if abs(old['kospiClose']-indices[key]) > .021: raise ValueError('Index sources disagree on '+key)
            index_checks += 1
    if compared < 20 or matched != compared: raise ValueError(f'Original formula reproduction mismatch: {matched}/{compared}')
    restored = []; approved = []
    for day, row in daily.iterrows():
        key = day.date().isoformat()
        if row['validStockCount'] >= 600 and key in indices: approved.append(key)
        if key not in indices or key < data['startDate'] or key in known and known[key].get('below20Pct') is not None: continue
        n = int(row['validStockCount']); below = int(row['belowStockCount'])
        if not 600 <= n <= 1200: raise ValueError(f'Constituent coverage unavailable for {key}: {n}')
        known[key] = {'date':key,'kospiClose':round(indices[key],2),'below20Pct':round(float(row['below20Pct']),4),'validStockCount':n,'belowStockCount':below,'source':'FinanceData/marcap' if day <= public_end else 'LS_KRX_DAILY'}
        restored.append(key)
    target_day=target.date().isoformat()
    if known.get(target_day,{}).get('below20Pct') is None: raise ValueError('Latest public-source breadth is missing')
    if any(day > target_day and row.get('below20Pct') is not None for day,row in known.items()): raise ValueError('Existing breadth extends beyond the coherent public source; review before replacing')
    index_only=[]
    for day,close in sorted(indices.items()):
        if day > target_day:
            known[day]={'date':day,'kospiClose':round(close,2),'below20Pct':None,'validStockCount':0,'source':'LS_INDEX_ONLY_AWAITING_CONSTITUENT_SOURCE'}
            index_only.append(day)
    reference = daily.loc[public_end,'validStockCount']
    if known[target_day]['validStockCount'] < reference*.95: raise ValueError('Latest coverage fell unexpectedly')
    output = dict(data); output['rows'] = [known[k] for k in sorted(known)];output['endDate']=output['rows'][-1]['date']
    output.update(updatedAt=datetime.now(KST).isoformat(),source='FinanceData/marcap 종목 종가 · LS증권 코스피 지수',priceAdjustment='unadjusted',universe='원본 기준 유지: KOSPI 6자리 숫자 종목, 거래량 > 0, 20거래일 모두 유효한 종목. 보통주 전용 분류는 미검증.',excludedDates=sorted(FLAGS-set(approved)),autoUpdate='거래일 17:40 · 20:40 · 22:30 KST',validation={'methodReproduced':True,'matchedSessions':matched,'comparedSessions':compared,'indexCrossChecks':index_checks,'indexCheckedBreadthDates':approved,'stockCloseSource':'FinanceData/marcap only','sourceLagDays':(pd.Timestamp(record['date'])-target).days,'lsDate':record['date'],'lsObservedAt':record['observedAt'],'lsExpectedStocks':record['expected'],'publicThrough':public_end.date().isoformat()})
    report={'latestBreadthDate':target_day,'indexOnlyDates':index_only,'latestDate':output['endDate'],'latest':known[target_day],'restored':restored,'matchedSessions':matched,'comparedSessions':compared,'indexCrossChecks':index_checks,'excludedDates':output['excludedDates'],'status':'provisional','lsDate':record['date']}
    return output,report

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',default='public/market-breadth.json');ap.add_argument('--marcap');ap.add_argument('--ls-feed');ap.add_argument('--report',default='work/breadth-refresh-report.json');a=ap.parse_args()
    today=datetime.now(KST).date().isoformat();data=json.loads(Path(a.output).read_text());payload=json.loads(Path(a.ls_feed).read_text()) if a.ls_feed else get_json(API+'/api/breadth-close?v='+str(int(datetime.now().timestamp())))
    # Test readiness before downloading the annual public source.
    validate_ls(payload,today)
    if a.marcap:
        source=Path(a.marcap);public=pd.read_parquet(source);sources=[{'localFile':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}]
    else:
        start=(datetime.now(KST).date()-timedelta(days=180)).year;frames=[];sources=[]
        for year in range(start,int(today[:4])+1):
            try: frame,proof=read_marcap(year)
            except urllib.error.HTTPError as error:
                # The new annual file may not exist on the year's first session.
                # The previous-year source plus verified LS bars still covers SMA20.
                if error.code == 404 and year == int(today[:4]) and frames: continue
                raise
            frames.append(frame);sources.append(proof)
        public=pd.concat(frames,ignore_index=True)
    output,report=refresh(data,public,payload,today);output['provenance']={'publicSources':sources,'lsFeed':API+'/api/breadth-close','lsPayloadSha256':hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'formula':'FinanceData/marcap positive-volume raw close < calendar SMA20; no cross-vendor price splicing; no forward fill; 20/20 observations required'}
    # Repeated schedules without new values do not cause redundant data commits.
    old_rows=data['rows'];changed=old_rows!=output['rows'] or data.get('validation')!=output['validation'] or data.get('excludedDates')!=output['excludedDates'] or data.get('autoUpdate')!=output['autoUpdate']
    if changed: Path(a.output).write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
    path=Path(a.report);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':
    try:main()
    except NotReady as e:print(str(e),file=sys.stderr);sys.exit(2)
