#!/usr/bin/env python3
"""Refresh recent KOSPI breadth from public marcap parquet data (provisional).
Never invent missing dates; fail closed if coverage or source recency is inadequate.
"""
import io
import json
import os
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import FinanceDataReader as fdr

OUT = Path("public/market-breadth.json")
BASE = "https://raw.githubusercontent.com/FinanceData/marcap/master/data/"
def get_year(y):
    with urllib.request.urlopen(BASE + f"marcap-{y}.parquet", timeout=100) as r:
        raw = r.read()
    df = pd.read_parquet(io.BytesIO(raw), columns=["Date", "Code", "Close", "Market", "Volume"])
    df["Date"] = pd.to_datetime(df["Date"]).dt.normalize()
    df["Code"] = df["Code"].astype(str).str.zfill(6)
    return df

def main():
    data = json.loads(OUT.read_text(encoding="utf-8"))
    assert data["schemaVersion"] == 1 and data["status"] == "provisional"
    rows = data["rows"]
    known = {r["date"]: r for r in rows}
    latest_valid = max(r["date"] for r in rows if r["below20Pct"] is not None)
    begin = pd.Timestamp(latest_valid) - pd.Timedelta(days=55)
    years = range(begin.year, date.today().year + 1)
    frames = [get_year(y) for y in years]
    prices = pd.concat(frames, ignore_index=True)
    prices = prices[prices["Date"] >= begin].copy()
    # Treat missing volume as unavailable, not a valid previous close.
    prices = prices[(prices["Market"] == "KOSPI") & prices["Code"].str.fullmatch(r"\\d{6}") &
                    (pd.to_numeric(prices["Close"], errors="coerce") > 0) &
                    (pd.to_numeric(prices["Volume"], errors="coerce") > 0)]
    prices = prices.drop_duplicates(["Date", "Code"]).sort_values(["Code", "Date"])
    prices["SMA20"] = prices.groupby("Code")["Close"].transform(
        lambda x: x.rolling(20, min_periods=20).mean())
    prices["below"] = prices["Close"] < prices["SMA20"]
    valid = prices[prices["SMA20"].notna()]
    daily = valid.groupby("Date").agg(valid_count=("Code", "nunique"), below_count=("below", "sum"))
    # FinanceDataReader should supply independently dated index closes.
    idx = fdr.DataReader("KS11", str(begin.date()), str(date.today() + timedelta(days=1)))
    if "Close" not in idx.columns or idx.empty:
        raise RuntimeError("No independent KOSPI index close series")
    idx.index = pd.to_datetime(idx.index).normalize()
    updated = 0
    for day, item in daily.iterrows():
        key = day.strftime("%Y-%m-%d")
        if key <= latest_valid and known.get(key, {}).get("below20Pct") is not None:
            continue
        n = int(item["valid_count"])
        if n < 600 or n > 1200:
            print(f"SKIP {key}: invalid KOSPI coverage {n}")
            continue
        if day not in idx.index:
            print(f"SKIP {key}: index quote unavailable")
            continue
        close = float(idx.loc[day, "Close"])
        if not (close > 0):
            continue
        pct = round(100 * int(item["below_count"]) / n, 4)
        known[key] = {"date": key, "kospiClose": round(close, 2), "below20Pct": pct, "validStockCount": n}
        updated += 1
    if not updated:
        print("No validated-coverage new readings; source may be stale. No file changes.")
        return
    final = [known[k] for k in sorted(known)]
    data["rows"] = final
    data["startDate"] = final[0]["date"]
    data["endDate"] = final[-1]["date"]
    # Retain provisional status until split adjustments and security classification are audited.
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Refreshed {updated} breadth readings; latest {data['endDate']} (PROVISIONAL)")

if __name__ == "__main__":
    main()
