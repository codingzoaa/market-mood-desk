// User-authorized removal of pre-loss-guard account records only.
export const legacyDeleteSQL=[
 'DELETE FROM account_trades',
 'DELETE FROM account_ledger_versions',
 'DELETE FROM account_ledger',
 "DELETE FROM account_state WHERE id NOT LIKE 'lossguard:%'"
];
export const legacyCountsSQL="SELECT (SELECT COUNT(*) FROM account_trades) AS trades,(SELECT COUNT(*) FROM account_ledger) AS ledger,(SELECT COUNT(*) FROM account_ledger_versions) AS revisions,(SELECT COUNT(*) FROM account_state WHERE id NOT LIKE 'lossguard:%') AS legacyStates";
