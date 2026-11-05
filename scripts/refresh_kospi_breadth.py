#!/usr/bin/env python3
"""Provisional KOSPI breadth refresh with missing-session recovery.

A session is considered missing when the independent KOSPI index has a trading
date not found in the JSON, or its breadth value is null. No existing non-null
reading is overwritten. Run locally or in a review-only GitHub Action.
"""
import io
import json
import os
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import FinanceDataReader as fdr
import pandas as pd

OUT = Path("public/market-breadth.json")
BASE = "https://raw.githubusercontent.com/FinanceData/marcap/master/data/"
LOOKBACK_DAYS = max(60, min(730, int(os.getenv("BREADTH_BACKFILL_DAYS", "120"))))
MIN_STOCKS, MAX_STOCKS = 600, 1200


def get_year(year):
    with urllib.request.urlopen(BASE + f"marcap-{year}.parquet", timeout=100) as response:
        frame = pd.read_parquet(io.BytesIO(response.read()))
    required = {"Date", "Code", "Close", "Market"}
    if not required.issubset(frame.columns):
        raise ValueError(f"marcap {year}: missing columns {required - set(frame.columns)}")
    frame = frame[list(required)].copy()
    frame["Date"] = pd.to_datetime(frame["Date"], errors="coerce").dt.normalize()
    frame["Code"] = frame["Code"].astype(str).str.zfill(6)
    frame["Close"] = pd.to_numeric(frame["Close"], errors="coerce")
    return frame


def calculate_daily(prices):
    prices = prices[
        (prices["Market"] == "KOSPI")
        & prices["Code"].str.fullmatch(r"\d{6}")
        & prices["Date"].notna()
        & prices["Close"].gt(0)
    ].copy()
    prices = prices.drop_duplicates(["Date", "Code"]).sort_values(["Code", "Date"])
    # Warm-up starts before the backfill period to compute each stock SMA20.
    prices["SMA20"] = prices.groupby("Code")["Close"].transform(
        lambda values: values.rolling(20, min_periods=20).mean()
    )
    valid = prices[prices["SMA20"].notna()].copy()
    valid["below"] = valid["Close"] < valid["SMA20"]
    return valid.groupby("Date").agg(
        valid_count=("Code", "nunique"), below_count=("below", "sum")
    )


def main():
    data = json.loads(OUT.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1 or data.get("status") != "provisional":
        raise ValueError("Unexpected dataset schema or status")
    rows = data["rows"]
    known = {row["date"]: row for row in rows}
    if len(known) != len(rows):
        raise ValueError("Duplicate dates in existing JSON")
    last = max(pd.Timestamp(max(known)), pd.Timestamp(date.today()))
    earliest = max(pd.Timestamp(data["startDate"]), last - pd.Timedelta(days=LOOKBACK_DAYS))
    warmup = earliest - pd.Timedelta(days=50)
    frames = [get_year(y) for y in range(warmup.year, date.today().year + 1)]
    daily = calculate_daily(pd.concat(frames, ignore_index=True))
    index = fdr.DataReader("KS11", str(warmup.date()), str(date.today() + timedelta(days=1)))
    if index.empty or "Close" not in index:
        raise RuntimeError("Independent KOSPI index history unavailable")
    index.index = pd.to_datetime(index.index).normalize()
    index = index[~index.index.duplicated(keep="last")].sort_index()
    sessions = index[(index.index >= earliest) & (index.index <= pd.Timestamp(date.today()))]
    missing, restored, skipped = [], [], []
    for day, row in sessions.iterrows():
        key = day.strftime("%Y-%m-%d")
        prior = known.get(key)
        if prior is not None and prior.get("below20Pct") is not None:
            continue
        missing.append(key)
        if day not in daily.index:
            skipped.append([key, "missing constituent quotes"])
            continue
        count = int(daily.loc[day, "valid_count"])
        if not MIN_STOCKS <= count <= MAX_STOCKS:
            skipped.append([key, f"insufficient/unexpected coverage: {count}"])
            continue
        close = float(row["Close"])
        if not (0 < close < 100000):
            skipped.append([key, "invalid KOSPI close"])
            continue
        value = round(100 * int(daily.loc[day, "below_count"]) / count, 4)
        known[key] = {"date": key, "kospiClose": round(close, 2),
                      "below20Pct": value, "validStockCount": count}
        restored.append(key)

    report = {
        "lookbackDays": LOOKBACK_DAYS,
        "indexSessionsChecked": len(sessions),
        "missingOrNullSessions": missing,
        "recoveredSessions": restored,
        "unrecovered": [{"date": day, "reason": reason} for day, reason in skipped],
        "status": "provisional",
    }
    Path("breadth_refresh_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({key: len(value) if isinstance(value, list) else value
                      for key, value in report.items()}, ensure_ascii=False))
    if not restored:
        return
    final = [known[key] for key in sorted(known)]
    data["rows"] = final
    data["startDate"], data["endDate"] = final[0]["date"], final[-1]["date"]
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
