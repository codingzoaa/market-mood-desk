# Telegram 16:30 close report

This is a separate, opt-in report workflow. No site UI, Cloudflare Worker, LS authentication secrets, or deployment settings are changed.

## Configuration
1. In GitHub repository Settings → Secrets and variables → Actions, add:
   - Repository variable `MARKET_DETAILS_URL`: exact HTTPS URL of your existing Cloudflare Worker `/api/market-details` endpoint, e.g. the actual deployed endpoint (do not guess the hostname).
   - Repository secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
2. Before merging, confirm `/api/market-details?date=YYYY-MM-DD` returns current-day `details` with both indexes and all five `t1601` segments. The existing Worker stores this during trading hours.
3. The workflow runs Mon-Fri 16:30 Asia/Seoul, including exchange holidays; on holidays missing matching same-day data makes the run fail closed without sending fabricated data.
4. ETF investor-flow is deliberately displayed as unavailable. `financial` in `t1601` represents financial-investment firms, **not** all ETF net buying.
5. A date mismatch, an index/flow `asOf` before 15:30 KST, or missing figures aborts transmission. An API timestamp later than close is *collection time*, not proof of exchange finality.
6. The workflow does not call LS directly; it consumes your existing authenticated Worker collection. The Worker keys remain in Cloudflare, not GitHub.

## Tests
Run `node --test tests/telegram-market-close.test.mjs`.
