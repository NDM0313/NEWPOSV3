# RESIDUAL_RISKS.md

1. Live Salesman / Limited / branch RLS not executed (resource/approval).
2. Physical device and stable emulator QA not available.
3. Sale/purchase edit JE helpers partially diverge from web shared services (documented; not rewritten).
4. Shipment RPC posts AR to 1100; web may use party sub-ledger.
5. Contact-list / dashboard silent operational enrichment remains labelled residual.
6. Studio finalize can be invoked from two callers (idempotent guards exist; race residual).
7. Dirty main working tree must not be the merge target cleanup surface.
8. Merge without phrase `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE` is forbidden.
