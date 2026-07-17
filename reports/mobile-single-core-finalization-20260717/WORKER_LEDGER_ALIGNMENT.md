# WORKER_LEDGER_ALIGNMENT.md

## Previous source
Operational-first (`worker_ledger_entries`) then GL 2010/1180 fallback. No unified attempt.

## Canonical contract
- Postgres `get_unified_party_ledger` supports `party_type=worker` (2010 + 1180).
- Web **production** Worker Ledger main UI still uses `getWorkerPartyGlJournalLedger` (GL), not unified main.
- Mobile now: **unified when party_ledger flags ON** → else **GL (web parity)** → else **labelled operational fallback**.

## Final source / basis
1. Unified official_gl when flags ON
2. Legacy GL journal 2010/1180 (official GL)
3. Operational worker_ledger_entries — explicitly labelled **not official GL**

## Fallback policy
Unified hard fail → labelled GL; GL empty → labelled operational; never silent zero as success.
