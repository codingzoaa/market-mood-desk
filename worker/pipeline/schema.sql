-- REVIEW ONLY. Never loaded by worker/schema.sql or automatically applied.
CREATE TABLE IF NOT EXISTS history_days (
 date TEXT PRIMARY KEY, sealed INTEGER NOT NULL DEFAULT 0 CHECK(sealed IN (0,1))
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS history_5m (
 date TEXT NOT NULL, symbol TEXT NOT NULL, slot TEXT NOT NULL,
 observed_at TEXT NOT NULL, available_at TEXT NOT NULL, source_quote_at TEXT,
 price REAL NOT NULL, turnover_krw INTEGER NOT NULL, market TEXT NOT NULL,
 name TEXT NOT NULL, source TEXT NOT NULL, timing_basis TEXT NOT NULL,
 PRIMARY KEY(date,symbol,slot)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS history_symbol_slot_date ON history_5m(symbol,slot,date);
CREATE TABLE IF NOT EXISTS trading_sessions (
 date TEXT PRIMARY KEY, known_at TEXT NOT NULL, source TEXT NOT NULL,
 is_open INTEGER NOT NULL CHECK(is_open IN(0,1))
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS rvol_days (
 target_date TEXT NOT NULL, version TEXT NOT NULL, cutoff TEXT NOT NULL,
 days_json TEXT NOT NULL, ready INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(target_date,version)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS rvol_baselines (
 target_date TEXT NOT NULL, symbol TEXT NOT NULL, slot TEXT NOT NULL,
 version TEXT NOT NULL, sum_turnover INTEGER NOT NULL, samples INTEGER NOT NULL,
 timing_basis TEXT NOT NULL, PRIMARY KEY(target_date,symbol,slot,version)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS archive_days (
 date TEXT PRIMARY KEY, object_key TEXT NOT NULL, sha256 TEXT NOT NULL,
 row_count INTEGER NOT NULL, max_available_at TEXT, verified_at TEXT NOT NULL,
 manifest_json TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS replay_contexts (
 hash TEXT PRIMARY KEY, payload BLOB NOT NULL, bytes INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS replay_frames (
 date TEXT NOT NULL, as_of TEXT NOT NULL, slot TEXT NOT NULL, mode TEXT NOT NULL,
 version TEXT NOT NULL, context_hash TEXT NOT NULL, sha256 TEXT NOT NULL,
 payload BLOB NOT NULL, PRIMARY KEY(date,as_of,mode,version)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS replay_context_reference ON replay_frames(context_hash);
CREATE TABLE IF NOT EXISTS backfill_jobs (
 id TEXT PRIMARY KEY, symbol TEXT NOT NULL, tr TEXT NOT NULL, contract_hash TEXT NOT NULL,
 request_json TEXT NOT NULL, cursor TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, pages INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT, error_code TEXT, provenance_json TEXT NOT NULL DEFAULT '[]', pending_page_json TEXT
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS pipeline_metrics (
 utc_date TEXT NOT NULL, component TEXT NOT NULL,
 rows_read INTEGER NOT NULL, rows_written INTEGER NOT NULL,
 size_after INTEGER, counters_json TEXT NOT NULL,
 PRIMARY KEY(utc_date,component)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS archive_jobs (
 date TEXT PRIMARY KEY, cursor_symbol TEXT NOT NULL DEFAULT '', cursor_slot TEXT NOT NULL DEFAULT '',
 next_part INTEGER NOT NULL DEFAULT 0, lease_until TEXT, done INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS archive_parts (
 date TEXT NOT NULL, part INTEGER NOT NULL, object_key TEXT NOT NULL, sha256 TEXT NOT NULL,
 row_count INTEGER NOT NULL, compressed_bytes INTEGER NOT NULL, max_available_at TEXT,
 PRIMARY KEY(date,part)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS provider_leases (
 tr TEXT PRIMARY KEY, next_request_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS replay_archives (
 date TEXT NOT NULL, as_of TEXT NOT NULL, mode TEXT NOT NULL, version TEXT NOT NULL,
 object_key TEXT NOT NULL, sha256 TEXT NOT NULL, context_key TEXT NOT NULL,
 context_hash TEXT NOT NULL, verified_at TEXT NOT NULL,
 PRIMARY KEY(date,as_of,mode,version)
) WITHOUT ROWID;
