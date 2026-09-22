# ROLLBACK.md

## Code rollback (mobile Single Core work)

1. Do not push dirty WIP until reviewed.  
2. To discard uncommitted mobile WIP:  
   `git checkout -- erp-mobile-app/src/...` (only after explicit approval).  
3. To revert a future commit on a feature branch: revert commit; redeploy mobile PWA/APK via existing `deploy/vps-build-erp-only.sh` / Capacitor sync — **does not require DB rollback**.

## Data / flags

- Feature flags can disable unified loaders (web pattern) without deleting RPCs.  
- Kill switch: `unified_ledger_kill_switch` / `VITE_UNIFIED_LEDGER_ENGINE_KILLED`.  
- No migration applied → no SQL rollback needed for this Phase 1 delivery.

## Do not

- Reclassify 4100  
- Delete R8 legacy loaders as part of rollback  
- Force-push main  
