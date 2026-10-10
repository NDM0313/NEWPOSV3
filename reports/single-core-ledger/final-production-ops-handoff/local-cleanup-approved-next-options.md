# Local cleanup — approved next options

**Run:** DIN BRIDAL GOLDEN CAPTURE + LOCAL EVIDENCE MANUAL INSPECTION — DRY RUN ONLY  
**Generated:** 2026-06-29T18:00:00.000Z

After manual inspection, choose **one** option (or a explicit combination). No action executes until you approve.

---

## Option A — Leave all local files untouched

**When:** Safest default; no cleanup urgency.

**Effect:** All 25 modified/untracked files remain as-is.

**Risk:** Low.

---

## Option B — Archive selected timestamped monitoring files locally, no repo commit (recommended)

**When:** Operator wants a clean working tree without git churn.

**Archive to:** `%USERPROFILE%\erp-monitoring-logs\`

**Files to copy (10 untracked timestamped runs):**

- `three-company-monitoring-2026-06-27T15-16-22-259Z.*` (FAIL — optional skip)
- `three-company-monitoring-2026-06-27T15-27-34-167Z.*` (FAIL — optional skip)
- `three-company-monitoring-2026-06-27T15-43-53-886Z.*` (PASS)
- `three-company-monitoring-2026-06-29T07-31-19-431Z.*` (PASS)
- `three-company-monitoring-2026-06-29T08-12-46-549Z.*` (PASS — newest operator run)

**After archive (separate approval):** delete untracked copies from repo folder only.

**Does not touch:** DIN BRIDAL golden bundle, `latest-*`, modified bridal/couture/phase-2-16 files.

**Risk:** Low.

---

## Option C — Commit latest `08-12` PASS evidence as official evidence

**When:** Operator explicitly wants git to record post-handoff operator terminal PASS.

**Files:**

- `three-company-monitoring-2026-06-29T08-12-46-549Z.json` / `.md`
- `latest-three-company-monitoring.json` / `.md`

**Caution:** Committing `latest-*` on every scheduled PASS creates **daily git churn**. Prefer Option B for routine ops.

**Does not touch:** DIN BRIDAL golden fixtures without finance (Option E).

**Risk:** Low for monitoring; medium if combined with golden files.

---

## Option D — Restore generated noise only, leave evidence files untouched

**When:** Operator wants to discard graphify regen only.

**Files:**

- `graphify-out/GRAPH_REPORT.md` → `git restore graphify-out/GRAPH_REPORT.md`

**Leaves untouched:** All monitoring evidence, bridal bundle, couture, phase-2-16.

**Risk:** Low.

---

## Option E — Finance / manual review required before touching golden fixture files (mandatory for bridal golden)

**When:** Any change to `din-bridal/golden-fixtures.*` or `golden-capture/*`.

**Finding:** PKR golden values **unchanged** in diff; changes are capture timestamps and `loader: legacy` → `unified` metadata. Still requires **finance written approval** before commit or restore.

**Files (do not touch without finance):**

- `reports/single-core-ledger/din-bridal/golden-fixtures.json`
- `reports/single-core-ledger/din-bridal/golden-fixtures.md`
- `reports/single-core-ledger/din-bridal-monitoring/golden-capture/*` (6 paths)

**Risk:** **High** if committed/restored without finance sign-off.

---

## Inspector recommendation

| Priority | Option | Rationale |
|----------|--------|-----------|
| 1 | **E** | Golden fixture files stay frozen until finance approves |
| 2 | **B** | Archive PASS timestamp files locally; avoid git noise |
| 3 | **D** | Optional graphify restore |
| Avoid by default | **C** | Official closure evidence already on main @ `07-42-30-177Z` |

**Combined suggestion:** **B + D** (archive monitoring, restore graphify) while keeping **E** files untouched.

---

## Exact next prompt

Reply with: `Approve Option B`, `Approve Option D`, `Approve B+D`, `Approve Option C`, or `Approve Option A`.

Do not approve golden fixture changes without finance: prefix with `Finance approved:` if committing bridal golden bundle.
