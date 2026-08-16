# AR/AP effective visibility & Fix Link UX — final report

**Date:** 2026-06-12  
**Commit:** `83d947f4`  
**Deployed:** `83d947f4` (frontend-only, erp-frontend recreated)

## Part A — AR-CUS0000 diagnosis (Walk-in Customer / AR-CUS0000)

Production GL lines (non-void, AR-CUS0000 subledger):

| JE / ref | Type | Dr | Cr | Sale | Status | Visibility |
|---|---|---:|---:|---|---|---|
| JE-0160 | sale | 150 | 0 | HQ-SL-0003 | cancelled | Effective: hidden · Audit: shown |
| JE-0162 | sale | 150 | 0 | HQ-SL-0004 | cancelled | Effective: hidden · Audit: shown |
| JE-0163 | sale | 400 | 0 | SL-0001 | cancelled | Effective: hidden · Audit: shown |
| JE-0164 | sale_reversal | 0 | 400 | SL-0001 | cancelled | Effective: hidden · Audit: shown |
| JE-0165 | sale_reversal | 0 | 150 | HQ-SL-0004 | cancelled | Effective: hidden · Audit: shown |
| JE-0168 | correction_reversal | 1 | 0 | RCV-0001 (voided) | — | Effective: hidden · Audit: shown |
| JV-000203 | gl_correction | 0 | 150 | HQ-SL-0003 | cancelled | Effective: hidden · Audit: GL Correction / Audit |
| JE-0190 + RCV-0006 | sale + payment | 40k / 40k | SL-0013 | final | Effective + Audit: active |
| JE-0194 + RCV-0012 | sale + payment | 65k / 65k | SL-0002 | final | Effective + Audit: active |
| JE-0196 + RCV-0014 | sale + payment | 16k / 16k | SL-0015 | final | Effective + Audit: active |
| JE-0199 + RCV-0016 | sale + payment | 15k / 15k | SL-0016 | final | Effective + Audit: active |

**Raw non-void AR-CUS0000:** Rs **1.00** (JE-0168 Dr 1 — unchanged in GL)  
**Effective AR-CUS0000 closing:** Rs **0.00** (cancelled chains + void trail + orphan gl_correction excluded)

## Part B/C — Effective pairing rules

`shouldIncludePartyEffectiveRow()` in `reportVisibilityContract.ts` hides audit-only chains:

- Cancelled sale / sale_reversal / sale_return on cancelled sales
- Payments linked to cancelled sales or voided payments
- Orphan `-orphan-ar` gl_correction rows (JV-000203)
- correction_reversal (JE-0168 class)

Final sale + active payment pairs remain visible together. Audit mode labels:

- Cancelled sale trail — audit only
- GL Correction / Audit
- Voided payment trail — audit only
- Reversal — audit only

## Part D — AR/AP top variance cards

`fetchIntegrityLabSummary` now computes:

- **Raw variance** — operational − raw GL (unchanged)
- **Effective variance** — operational − effective GL (raw minus audit-only chain net)
- **Audit-only AR/AP adjustment** — sum of hidden chain nets

Status badges use **effective** variance when available. Refresh button reloads summary after Fix Link / mark resolved.

## Part E — Fix Link dialog

- Modal width ~1050px, max-height 80vh, scrollable contact list
- Search by name, contact code, phone, account code
- Suggestions (document party, account-linked contact) pinned above full list (up to 500 contacts)
- Selection preview + disabled Save with reason when no contact selected
- Save Link / Save Link for Trace / Cancel — GL amounts never changed; audit log on save

## Part F — Actionable Repair Center

Repair cards show **Effective impact** and **Audit/raw impact** lines where classified.

## Tests & build

- 45/45 unit tests pass (including `arApEffectiveVariance.test.ts`)
- `npm run build` pass

## Intentionally disabled (unchanged)

- Broad AR/AP GL post / reverse / repost
- Auto-cancel source documents from Accounting
- Second GL correction without explicit approval
- Direct edits to JE-0160, JE-0161, JE-0168, JV-000203

## Deploy

Frontend-only (`deploy/vps-build-erp-only.sh`) — no DB restart, no migrations.
