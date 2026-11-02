# Telegram 16:30 KRX market close report

## Delivery status and safety
- This Pull Request only changes a separate GitHub Actions workflow, sender script, tests and this document. It does not change the Cloudflare Worker, public site or LS API secrets.
- Scheduled send is **OFF by default**. It becomes active only after setting repository variable TELEGRAM_ENABLED to the literal value true.
- The existing public LS Worker URL is used as the default data source: https://market-note-ls-api.kby0991.workers.dev/api/market-details
- A manual run defaults to read-only dry-run, with no Telegram bot credentials loaded and no message sent.
- The workflow's daily GitHub Actions cache marker skips repeated successful sends on the same KST date; this is best effort (a cache failure/eviction or a partially failed send can still cause duplicates).
- The workflow deliberately never sends a weekend report or a report with mismatched dates, wrong units, missing t1511 index data, missing t1601 segments, or known collection errors.
- A 15:30+ KST observation time is **not** independent evidence of an exchange-final close. Messages disclose the LS data source and verification limitation.

## Initial setup
1. In repository Settings → Secrets and variables → Actions → Secrets, register TELEGRAM_BOT_TOKEN (Telegram BotFather token) and TELEGRAM_CHAT_ID (the destination chat ID). Never write these values to workflow YAML, logs, public issues or conversations.
2. The default MARKET_DETAILS_URL points to the existing public Worker. Only if the Worker hostname changes, override it with repository variable MARKET_DETAILS_URL using the exact HTTPS /api/market-details address.
3. Merge after passing CI. On the main branch, go to Actions → Telegram Market Close (KRX) → Run workflow, keep "Send a real Telegram message" **unchecked**. It checks the latest day’s stored market details and reports TELEGRAM_DRY_RUN_OK only if the data passes all required validations.
4. After a successful dry-run, manually trigger once with "Send a real Telegram message" checked to test actual bot delivery. A successful API acknowledgment is required; confirm the message also appears in the intended private chat.
5. Only after confirming delivery and report accuracy, register repository variable TELEGRAM_ENABLED=true to enable the weekday 16:30 Asia/Seoul scheduled action.
6. To pause all scheduled Telegram delivery, set TELEGRAM_ENABLED=false without deleting secrets or changing the Worker. The next manual run still defaults to dry-run.
7. Check Actions logs for MISSING_TELEGRAM_BOT_TOKEN, MISSING_TELEGRAM_CHAT_ID, DATA_HTTP_, DATE_MISMATCH, INDEX_MISSING_, FLOW_MISSING_, COLLECTION_ERRORS or TELEGRAM_HTTP_ codes if a run fails.

## Data contract
GET /api/market-details?date=YYYY-MM-DD returns:
- details.date must be today in KST
- indices.KOSPI, indices.KOSDAQ: numerical value, changePct, advances, unchanged, declines, and same-day post-15:30 KST asOf
- flows.unit='억원', flows.asOf same-day post-15:30 KST, segments for KOSPI/KOSDAQ/FUTURES/CALL/PUT with individual/foreign/institution finite numeric amounts
- details.errors must not report a failed KOSPI, KOSDAQ, flows or LS collector
- Missing ETF investor flows are shown as unavailable, never substituted with 금융투자 net flows
- The weekday job intentionally skips public holidays by failing closed when valid same-day data is unavailable.

## Tests
node --test tests/telegram-market-close.test.mjs
npm test
npx tsc --noEmit
npm run build

Note: The GitHub Actions scheduler may run later than 16:30 during high load.
