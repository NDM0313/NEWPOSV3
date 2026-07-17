# BASELINE.md — Mobile Single Core Finalization

**Date:** 2026-07-17  
**Worktree:** `/Users/ndm/Documents/Development/CursorDev/NEWPOSV3-mobile-sc-phase2`  
**Branch created:** `feature/mobile-single-core-finalization`  
**Branched from:** `feature/mobile-single-core-party-roznamcha` @ `3c9dc4071082716ecd0fc397788567bff5913c38`  
**Dirty main:** left untouched at `/Users/ndm/Documents/Development/CursorDev/NEWPOSV3` (`main` @ `812c2871`, dirty)

## Pre-change validation

| Check | Result |
|-------|--------|
| Mobile `npm run test:run` | **79 pass / 0 fail** |
| `npm run test:unified-ledger` | **350 pass / 0 fail** |
| `npx tsc -b` | **PASS** |
| `npm run build:mobile:prod` | **PASS** |

No baseline regression before finalization edits.
