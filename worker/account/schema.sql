-- Apply ONLY to a NEW private-account D1 database after deployment review.
-- No plaintext account number, name, symbol, amount, trade date, tokens or cursor.
CREATE TABLE IF NOT EXISTS account_trades(id TEXT PRIMARY KEY,payload TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS account_state(id TEXT PRIMARY KEY,payload TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS account_lease(id TEXT PRIMARY KEY,expires INTEGER NOT NULL,owner TEXT) WITHOUT ROWID;
INSERT OR IGNORE INTO account_lease VALUES('sync',0,NULL);
