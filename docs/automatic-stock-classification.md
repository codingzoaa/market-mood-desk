# Automatic classification verification

The hourly `stock-classification.yml` job checks missing classifications on trading weekdays at 09:10–20:10 KST. GitHub scheduled runs may be delayed. The first code publication and manual dispatch also run verification.

Source: the exchange's public KIND listed-company download, https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13 . The job decodes its EUC-KR/CP949 bytes strictly, validates required columns, duplicate codes and coverage (at least 2,000 listed issuers, including at least 500 KOSPI and 1,000 KOSDAQ issuers), and records the source SHA256 and actual retrieval time. The retrieval time is not represented as the source's publication date.

The candidate queue combines collected ordinary stocks with previously pending entries. A verified result requires exact code, market and normalized legal-company-name agreement. Normalization removes whitespace and corporate prefixes; it does not fuzzy-match names or infer a preferred-share issuer from a similar code. ETF/ETN, leverage/inverse and SPAC records are excluded.

Only clear official business industries are mapped to broad sectors. Unmapped precise industries retain their official industry label. Generic or conflicting industries, missing issuers and identity mismatches remain pending with a reason. No investment theme is inferred from price movement, a company name, or a loose theme keyword. Pending entries are reconsidered every scheduled run.

The generated `src/data/stock-map-verified.json` is separate from the curated map. Curated classifications always win. All automatic entries have `breadth:false`; this job never expands the Breadth universe. Quote prices, turnover, changes and observation timestamps are not written by this job.

The Worker merges the generated manifest with its discovery queue and exposes it through the read-only `/api/stock-map` endpoint. The main quote API and the sector-map page use that same result. Official verification applies to current quotes; populated historical LS tags are preserved. Pending official verification does not turn into an automatic sector signal.

Source failures or parser/identity/coverage errors leave the existing manifest and service intact. Tests run before a changed manifest is committed. Deployment is explicit because GITHUB_TOKEN commits do not trigger the normal push workflow. A later run checks the live manifest receipt and retries an incomplete deployment even if data has not changed. Same-day unchanged classifications do not create another data commit. Worker deployment shares the existing deployment concurrency group.

The older LS discovery stage now retries pending records instead of treating their existence as success. It upserts by symbol, flags ambiguous classifications, and uses a 24-hour LS-call cooldown. This cooldown does not prevent the hourly exchange-source verification. Only dynamic discovery/cooldown rows are written back to D1; the generated manifest is not duplicated into that state row.

Checks: `node --test tests/stock-verification.test.mjs`, `npm test`, `npx tsc --noEmit`, `npm run build`. Workflow reports retain verification counts and pending-reason counts for seven days, without credentials.
