# Stored LS quotes → Leadership V2 smoke test

Based on PR #2 ac262edef3f5229733865e4bf9620c0248dd0b0d, including the PR #1 Leadership V2 engine. Node.js 24 required.

```sh
npm run test:ls-stored
```

This command issues one anonymous GET to the fixed production `/api/dashboard?date=YYYY-MM-DD` endpoint (today in Asia/Seoul), with no redirects, retries, fallback snapshots, credentials or LS provider calls. It changes no Worker, D1, R2 or site. The existing dashboard handler only reads saved snapshots. A successful read selects up to five distinct eligible stock symbols in response order; ETF/ETN/leverage/inverse exclusions use the existing filter. The JSON includes current price, change percentage, turnover in KRW, snapshot timestamp, source, missing fields, engine input and engine status.

`stockAsOf`, falling back to `asOf`, is treated as snapshot receipt time. It is **not** claimed as a verified exchange timestamp. `sourceQuoteAt` remains null. Today-only snapshots, explicit LS KRX source, timezone-qualified nonfuture timestamps and finite price/change/turnover are checked. The test does not infer previous close from a rounded percentage or create exchange-calendar/history/RVOL data.

Each valid selected stock is converted with the actual PR #2 `engineInput()` and passed to the actual PR #1 `calculateLeadership(input, 'INTRADAY')`. The current dashboard snapshot contract contains no verified calendar, prior close/OHLC, adjusted daily bars, same-slot 20-day RVOL baseline, intraday bars or aligned sector score. Thus this adapter intentionally cannot emit a numeric score from this endpoint alone. It reports `INSUFFICIENT_DATA` and null score. `engineStatus` and `engineIssues` preserve engine invalidation, including `OUTSIDE_SESSION`: receipt times are never changed to 15:30 to make scoring pass. Finality is reported by the converter as missing, although finality itself is not an intraday scoring prerequisite. Supporting complete scoring would require separately authorized, genuine historical/context inputs, not substitutes in this test.

Failure states are distinct: `FETCH_FAILED` (transport/access/non-2xx), `INVALID_RESPONSE` (schema/source/time/JSON), `NO_TODAY_DATA`, `NO_ELIGIBLE_STOCKS`, per-stock `INVALID_DATA`, and per-stock `INSUFFICIENT_DATA`. Exit code 1 means no usable today response, and 0 means a read with selected rows; inspect row statuses separately. Error bodies and raw exception strings are never logged.

## Actual execution, 2026-10-20

See [recorded JSON](reports/ls-stored-smoke-2026-10-20.json). At 2026-10-20T11:18:59.341Z (20:18:59 KST), the fixed read-only endpoint could not be reached from the managed execution environment. Result: `FETCH_FAILED / NETWORK_OR_ACCESS_FAILURE`; zero selected rows, no observed quote timestamp, no engine invocation with real quotes, no score. This is an access failure, **not evidence of missing production data**. Re-run the command from an environment with normal access to that public endpoint to obtain the requested stock rows. No network-policy bypass was used.

Validation: all 12 test files passed; TypeScript and production build passed locally. New unit tests cover the single GET boundary, fetch/HTTP/JSON failures, selection limit, source/date/time/value validation, missing-data engine invocation and after-hours invalidation. Their synthetic fixtures are restricted to unit tests and never substituted into live results. The review workflow runs only offline tests/builds and has no deployment job or live API invocation.

## User-provided actual API response: successful decoding and engine invocation

On 2026-10-20 the user supplied the JSON returned by the public endpoint. No new live fetch was performed. The exact file SHA-256 and execution timestamp are recorded in [actual uploaded-response result](reports/ls-stored-smoke-upload-2026-10-20.json). The file contains snapshots for Oct 19 and Oct 20, each with 188 stocks. Only Oct 20 was selected, with the first five eligible distinct stocks in response order.

All five selected quote rows passed price/change/turnover/source/timestamp validation and were passed through `engineInput()` to `calculateLeadership(..., 'INTRADAY')`. Their snapshot receipt time is 2026-10-20T10:34:44.805Z (19:34:44.805 KST). No explicit exchange quote timestamp was supplied. All five reports show `INSUFFICIENT_DATA`, score null, with raw `engineStatus: INVALIDATED` including `OUTSIDE_SESSION` and missing prerequisites. This demonstrates actual-response parsing and engine wiring; it does not validate a complete numeric score or independently verify LS provider values.

Common missing inputs: verified source quote time, previous close, OHLC, official trading calendar, aligned KOSPI benchmark context, adjusted daily history, previous 20 trading days same-slot cumulative-turnover baseline, intraday bars, sector membership/sector score. Converter also reports missing finality (not itself required for intraday scores). No receipt timestamp was relabelled as market time, and no absent data was synthesized.

| Symbol | Name | Price KRW | Change % | Cumulative turnover KRW | Score |
|---|---|---:|---:|---:|---|
| 000660 | SK하이닉스 | 1,196,000 | -6.34 | 4,170,300,000,000 | null |
| 005930 | 삼성전자 | 209,500 | -3.90 | 3,315,619,000,000 | null |
| 009150 | 삼성전기 | 1,128,000 | -3.59 | 828,114,000,000 | null |
| 005935 | 삼성전자우 | 163,200 | -4.51 | 503,852,000,000 | null |
| 006400 | 삼성SDI | 550,000 | -7.09 | 399,793,000,000 | null |

To run against a downloaded endpoint response without any network request:

```sh
npm run test:ls-stored -- --input response.json
```

The offline CLI does not fall back to live fetching when file reading/parsing fails. Only the selected quote inputs/results are committed, not the full uploaded payload.
