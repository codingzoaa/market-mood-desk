-- Apply ONLY to a NEW private-account D1 database after deployment review.
-- No plaintext account number, name, symbol, amount, trade date, tokens or cursor.
CREATE TABLE IF NOT EXISTS account_trades(id TEXT PRIMARY KEY,payload TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS account_state(id TEXT PRIMARY KEY,payload TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS account_lease(id TEXT PRIMARY KEY,expires INTEGER NOT NULL,owner TEXT) WITHOUT ROWID;
INSERT OR IGNORE INTO account_lease VALUES('sync',0,NULL);
-- Separate current ledger and encrypted revision archive. No source fields in plaintext.
CREATE TABLE IF NOT EXISTS account_ledger(id TEXT PRIMARY KEY,revision TEXT NOT NULL,payload TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS account_ledger_versions(id TEXT NOT NULL,revision TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(id,revision)) WITHOUT ROWID;
