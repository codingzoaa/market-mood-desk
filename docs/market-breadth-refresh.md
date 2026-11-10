# KOSPI breadth daily refresh

The original `run_marcap_kospi.py` calculation is preserved:

- FinanceData/marcap KOSPI rows with six numeric code characters.
- Positive close and positive volume; a missing/zero-volume session remains missing.
- Pivot on the market trading calendar, then SMA20 with all 20 observations required.
- Count `close < SMA20`; never forward-fill or substitute the last 20 available quotes.
- This retains the original universe, including eligible preferred shares. It is not a certified common-share-only or adjusted-price measure, so the dataset remains provisional.

Historical source: https://github.com/FinanceData/marcap . Each downloaded annual Parquet file is checked against its Git blob SHA and recorded with a SHA256 hash.

Recent source: the existing LS Worker collects the numeric KOSPI non-ETF universe from t8436. The initial seed uses t8410 raw daily closes and actual daily volumes; subsequent sessions append KRX t8407 closing quotes. The closing date is checked against a liquid stock's daily bars, and t8429 KOSPI closes must match t1511 after the close. Only the FinanceData/marcap constituent series is published. LS stock closes differed from that series despite matching daily volumes and eligible-stock counts, so the two price series must never be spliced inside an SMA window. LS provides cross-checked KOSPI index closes. The chart stops at the latest available constituent source session, with its publication lag visible in metadata. Existing measured values are retained, and their available history must reproduce exactly before an append is permitted.

The Worker wakes every five minutes from 17:00 through 23:55 KST on weekdays, sharing the existing after-close schedule within the account's free cron quota. It resumes stored progress, uses a lease, and never fetches personal account information. First-time history collection is slower than daily bulk updates.

`.github/workflows/breadth-refresh.yml` runs at approximately 17:40, 20:40 and 22:30 KST on weekdays, with an 08:15 KST next-trading-day catch-up, with manual dispatch available. GitHub schedules can be delayed. The job waits for a complete source, runs the formula and coverage checks, commits only a changed verified result, then builds and deploys Pages explicitly. A GITHUB_TOKEN data commit alone does not trigger the normal Pages push workflow.

Incomplete collections or a source/count/index discrepancy fail without replacing the chart. The workflow retains a seven-day calculation report. Public diagnostic endpoint: `/api/breadth-close`; progress includes counts and sanitized error codes, never credentials. The chart rechecks its published static JSON every fifteen minutes and when its browser tab becomes visible, retaining the last good dataset on a network error.

Checks:

```
python -m unittest discover -s tests -p 'test_breadth_refresh.py'
npm test
npx tsc --noEmit
npm run build
```

## Delayed-run recovery

A scheduled job that crosses midnight or starts the next morning selects the last complete, explicitly dated closing record instead of waiting for an uncollected new session. Full existing close/source/coverage checks still apply. A same-day record before16:40, a future/invalid record or a completed record more than14calendar days old cannot publish. The report separately records `checkedForDate`; a November9 close stays November9 even if checked on November10. The day selection does not change the constituent price source, SMA20, exclusions or historical values.

If the verified file is already committed but its Pages publication previously failed, an unchanged-data run compares the live published rows/schedule with the repository file and retries deployment. The data updater never requests a new user credential or sends a Telegram message. Pages publication shares the existing main-branch deployment concurrency group. Source availability remains explicit: the index can advance while missing constituent breadth remains null until the coherent original source is available.
