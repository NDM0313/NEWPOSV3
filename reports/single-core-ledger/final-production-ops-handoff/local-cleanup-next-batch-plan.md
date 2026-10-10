# Local cleanup next batch plan

**Run:** OFFICE PC LOCAL CLEANUP REVIEW — DRY RUN ONLY  
**Generated:** 2026-06-29T16:00:00.000Z

---

## Batch A — Safe to leave untouched (default)

**Count:** 8 files  
**Reason:** No urgent action; committed equivalents exist on `main`; production ops unaffected.

| File |
|------|
| `graphify-out/GRAPH_REPORT.md` |
| `reports/single-core-ledger/din-bridal-monitoring/production-flags-day1.json` |
| `reports/single-core-ledger/din-bridal-monitoring/production-monitoring-day1.md` |
| `reports/single-core-ledger/din-couture-monitoring/production-flags-day1.json` |
| `reports/single-core-ledger/din-couture-monitoring/production-monitoring-day1.md` |
| `reports/single-core-ledger/phase-2-16-monitoring/production-monitoring-day1.md` |
| All 25 files if operator chooses **Option A — leave all untouched** |

---

## Batch B — Safe delete candidates after approval

**Count:** 4 files (2 FAIL runs × json/md)  
**Reason:** `overall: FAIL`; not on `main`; no unique evidence value.

| File |
|------|
| `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-27T15-16-22-259Z.json` |
| `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-27T15-16-22-259Z.md` |
| `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-27T15-27-34-167Z.json` |
| `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-27T15-27-34-167Z.md` |

**Later command (after approval only):**

```powershell
Remove-Item "reports\single-core-ledger\operational-monitoring\three-company-monitoring-2026-06-27T15-16-22-259Z.*"
Remove-Item "reports\single-core-ledger\operational-monitoring\three-company-monitoring-2026-06-27T15-27-34-167Z.*"
```

Optional add: `git restore graphify-out/GRAPH_REPORT.md` if operator treats graphify as noise.

---

## Batch C — Evidence candidates to keep / commit later

**Count:** 7 files  
**Reason:** Operator PASS evidence newer than committed closure artifact (`07-42-30-177Z`).

| File |
|------|
| `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-29T08-12-46-549Z.json` |
| `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-29T08-12-46-549Z.md` |
| `reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.json` |
| `reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.md` |
| `reports/single-core-ledger/phase-2-16-monitoring/production-flags-day1.json` (optional) |

**Later command (after approval only):**

```powershell
git add reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-29T08-12-46-549Z.*
git add reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.*
# optional:
git add reports/single-core-ledger/phase-2-16-monitoring/production-flags-day1.json
git commit -m "docs(accounting): add office pc monitoring evidence 2026-06-29"
```

---

## Batch D — Needs manual review

**Count:** 8 files  
**Reason:** DIN BRIDAL golden capture bundle — finance-sensitive; may be intentional re-capture or accidental drift.

| File |
|------|
| `reports/single-core-ledger/din-bridal-monitoring/golden-capture/golden-capture-raw.json` |
| `reports/single-core-ledger/din-bridal-monitoring/golden-capture/golden-capture-report.md` |
| `reports/single-core-ledger/din-bridal-monitoring/golden-capture/screenshots/party-ledger.png` |
| `reports/single-core-ledger/din-bridal-monitoring/golden-capture/screenshots/roznamcha.png` |
| `reports/single-core-ledger/din-bridal/golden-fixtures.json` |
| `reports/single-core-ledger/din-bridal/golden-fixtures.md` |

**Action:** `git diff` review + screenshot compare. Commit only with finance approval; else `git restore` bridal paths.

---

## Batch E — Archive candidates (not delete)

**Count:** 6 files  
**Reason:** PASS duplicates not on `main`; useful for local logs, not required in repo.

| File |
|------|
| `three-company-monitoring-2026-06-27T15-43-53-886Z.json` / `.md` |
| `three-company-monitoring-2026-06-29T07-31-19-431Z.json` / `.md` |

**Later command (after approval only):**

```powershell
$dest = "$env:USERPROFILE\erp-monitoring-logs"
New-Item -ItemType Directory -Force -Path $dest
Copy-Item "reports\single-core-ledger\operational-monitoring\three-company-monitoring-2026-06-27T15-43-53-886Z.*" $dest
Copy-Item "reports\single-core-ledger\operational-monitoring\three-company-monitoring-2026-06-29T07-31-19-431Z.*" $dest
```

Then optionally delete from repo working tree (Batch B style) after archive confirmed.

---

## Batch F — Must not touch without finance (subset of D)

| File | Why |
|------|-----|
| `din-bridal/golden-fixtures.json` | Golden PKR truth — high risk |
| `din-bridal/golden-fixtures.md` | Paired golden doc |

---

## Operator choice matrix

| Option | Action |
|--------|--------|
| **A** | Leave all 25 files untouched |
| **B** | Delete Batch B FAIL runs (+ optional graphify restore) |
| **C** | Commit Batch C monitoring evidence |
| **D** | Manually inspect Batch D (+ F) bridal golden bundle |
