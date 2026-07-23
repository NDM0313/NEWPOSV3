# Operator-Attended Kill-Switch Drill Runbook (post–2026-08-09)

**Status:** RUNBOOK ONLY — **do not execute on 2026-07-15**
**Previous claimed drill (2026-07-12):** **CLAIM RETRACTED** — original evidence pack never existed; readiness plan still NOT DONE.
**Fresh drill required:** YES, after soak, before any R8-R2 deletion.

---

## 1. Exact operator present

| Role | Who |
|------|-----|
| Decision owner | Nadeem Khan (or designated ERP ops owner) |
| Attending operator | Must be physically/session-present for entire toggle window |
| Recorder | Second person or same operator writing evidence pack |

Approval to *start drill* is separate from deletion approval. Deletion still needs `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.

---

## 2. Exact production baseline (capture before toggle)

Record into `reports/r8-r2-kill-switch-drill-YYYYMMDD/baseline.md`:

- Date/time (Asia/Karachi)
- `git rev-parse` on VPS app checkout
- Browser `VITE_BUILD_COMMIT` from served assets if available
- HTTP `https://erp.dincouture.pk` → expect 200
- `docker`/compose health: `erp-frontend` healthy
- Kill switch: **OFF** (enabled count 0)
- Loader flags: **54 ON** for three approved companies (or current approved snapshot)
- Note: no journal/account mutations allowed at any step

---

## 3. Pre-drill monitoring

```bash
npm run monitor:three-company-unified-ledger
```

Require: DIN COUTURE / BRIDAL / CHINA **PASS** + loader guard **PASS**.
Abort if FAIL or CREDENTIAL_GATE unresolved.

Also: `npm run test:unified-ledger` && `npm run test:unit` && `npm run build` on the commit about to be drilled.

---

## 4–5. Loader flag + kill-switch snapshot

Read-only SQL (example intent — use approved ops scripts only):

- Count flags ON per company/screen
- `unified_ledger_kill_switch` (or equivalent table/row) enabled = false / absent

Store snapshot JSON/markdown in evidence (no secrets).

---

## 6. Safe activation method

Preferred L0: DB kill switch toggle via **approved ops script** (service-role / operator SQL), **not** env rebuild.

Rules:

- Operator present
- Change only kill-switch row(s), never accounts/JEs/GL
- Record exact SQL file path + checksum + timestamp
- Maximum kill window: agreed minutes (suggest ≤30)

Env kill (`VITE_UNIFIED_LEDGER_ENGINE_KILLED`) requires rebuild — **avoid** for this drill unless DB method unavailable.

---

## 7. Expected unified → legacy transition

| Before | During kill ON | After restore |
|--------|----------------|---------------|
| Resolvers → `unified` | Resolvers → `legacy` | → `unified` |
| Main loaders use unified RPCs | Main loaders use legacy services | Unified restored |
| UI banner may show kill/engine state | Legacy path loads | Kill banner clear |

---

## 8. Screens to verify (each company at least smoke on one primary)

1. Ledger V2
2. Account Statement
3. Trial Balance
4. Party Ledger
5. Roznamcha
6. Cash Flow
7. Balance Sheet
8. Profit & Loss
9. AR/AP Reconciliation Center (loads; parity banner OK)

For each: load succeeds, no blank crash, note source badge if shown.

---

## 9. Read-only data checks

- Spot-check one known party balance matches pre-drill screenshot (±0)
- No new `journal_entries` / voids during window (read-only query count)

---

## 10. No accounting mutation

Forbidden during drill: post/edit/void/reverse JE; change accounts 4000/4100/5210; AR/AP repairs; migrations; Contacts rewrites.

---

## 11. Legacy → unified restoration

Toggle kill switch **OFF** with same approved method. Confirm enabled count 0. Wait for caches if any; hard-refresh screens.

---

## 12. Post-restoration monitoring

```bash
npm run monitor:three-company-unified-ledger
```

Require PASS ×3 + loader guard PASS.

---

## 13. Tests / build (post-restore)

```bash
npm run test:unified-ledger
npm run test:unit
npm run build
```

---

## 14. Failure / abort conditions

Abort and restore kill OFF immediately if:

- Any main screen hard-fails on both paths
- Monitoring FAIL after restore
- Unexpected JE count change
- HTTP non-200 / frontend unhealthy
- Operator loses certainty of toggle state
- Credential/tooling failure mid-drill

---

## 15. Rollback procedure

1. Force kill switch OFF
2. If flags disturbed, run **L1** loader flag rollback SQL only (no data repair)
3. If frontend broken independently, L2 deploy prior tag
4. Re-run monitoring
5. Do **not** proceed to R8-R2 deletion

---

## 16. Evidence required

Folder: `reports/r8-r2-kill-switch-drill-YYYYMMDD/`

Must include: baseline, toggle timestamps, screen checklist, monitoring pre/post, JE count check, abort log (if any), operator sign-off, statement that previous 2026-07-12 claim remains retracted and this is the first attested drill.

---

## Explicit non-actions for 2026-07-15

- Production kill **not** toggled
- Drill **not** executed
- No fabricated PASS
