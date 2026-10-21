# Persistent daily journal archive

Daily t0150 and historical t0151 completed snapshots are stored by trade date in the existing private account_state table. Day keys are HMAC-derived using ACCOUNT_INDEX_KEY, and both snapshots and date index are encrypted with the existing AES-GCM key. Neither dates nor trade fields are added to plaintext storage. No new table or credentials required.

saveJournalDay runs while holding the shared sync lease. The daily snapshot and date index use one SQL INSERT SELECT / UPSERT statement, so failure rolls both back. Duplicate or older snapshots do not rewrite stored values; later completed snapshots for the same date update that one date rather than append duplicates. Incomplete pages and failed provider responses never enter the archive. No automatic daily deletion; index capacity 20,000 dates. Full rows stay stored (existing 10,000 row/day collection bound), API/UI shows first 200 with total count.

Collector success archives before updating legacy latest/previous compatibility pointers. Existing legacy snapshots appear in date selection immediately via read-only fallback; the next scheduled sync migrates them under its lease without provider calls and leaves originals intact. Already collected previous-day manual requests can also migrate without provider calls. A stale legacy copy cannot replace a newer archived snapshot.

GET /api/account?journalDate=YYYY-MM-DD returns encrypted-store data only after owner authentication. journalArchive has dates, selectedDate and capped entry. Default date is newest saved date. Invalid dates are rejected; an unstored date has no entry. Date changes do not call LS. UI uses a saved-date selector and suppresses stale network responses while switching rapidly.

Schedule remains weekdays 16:30 KST. Snapshot time is not an end-of-day finality guarantee for later NXT trades. Existing cost-basis calculations remain separate; settlement cash differences are not realized PnL. Earlier API capture failures cannot be recovered from a nonexistent saved snapshot.

Tests cover multiple days, deduplication without ciphertext rewrite, selected-date reads, encrypted IDs/index/payload, idempotent migration, stale overwrite protection, atomic rollback and Access/no-store protection. Live private financial values are not read or decrypted outside the owner-authorized Worker.
