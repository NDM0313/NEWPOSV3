# Local cleanup file classification

**Run:** OFFICE PC LOCAL CLEANUP REVIEW — DRY RUN ONLY  
**Generated:** 2026-06-29T16:00:00.000Z  
**Total files:** 25

---

## Classification summary

| Category | Count |
|----------|-------|
| KEEP_UNTOUCHED | 1 |
| GENERATED_NOISE | 1 |
| ALREADY_COMMITTED_DUPLICATE | 2 |
| SAFE_ARCHIVE_CANDIDATE | 4 |
| SAFE_DELETE_CANDIDATE_AFTER_APPROVAL | 4 |
| POSSIBLE_EVIDENCE_FILE | 6 |
| NEEDS_REVIEW | 7 |
| UNKNOWN_DO_NOT_TOUCH | 0 |

---

## Group 1 — Graphify

| Path | Status | Category | Committed equivalent | Notes |
|------|--------|----------|---------------------|-------|
| `graphify-out/GRAPH_REPORT.md` | Modified | **GENERATED_NOISE** | Yes (older AST snapshot on main) | Large diff (~8.5k lines). Local `graphify update` artifact. Not production evidence. |

---

## Group 2 — DIN BRIDAL monitoring / golden fixtures

| Path | Status | Category | Committed equivalent | Notes |
|------|--------|----------|---------------------|-------|
| `din-bridal-monitoring/golden-capture/golden-capture-raw.json` | Modified | **NEEDS_REVIEW** | Yes | Small field deltas; likely re-capture @ 2026-06-27T11:34 |
| `din-bridal-monitoring/golden-capture/golden-capture-report.md` | Modified | **NEEDS_REVIEW** | Yes | Timestamp/report alignment with re-capture |
| `din-bridal-monitoring/golden-capture/screenshots/party-ledger.png` | Modified | **NEEDS_REVIEW** | Yes | Binary screenshot delta (~4 KB) |
| `din-bridal-monitoring/golden-capture/screenshots/roznamcha.png` | Modified | **NEEDS_REVIEW** | Yes | Minimal binary delta (2 bytes) |
| `din-bridal-monitoring/production-flags-day1.json` | Modified | **NEEDS_REVIEW** | Yes | Flag snapshot refresh |
| `din-bridal-monitoring/production-monitoring-day1.md` | Modified | **NEEDS_REVIEW** | Yes | Monitoring report timestamp refresh |
| `din-bridal/golden-fixtures.json` | Modified | **POSSIBLE_EVIDENCE_FILE** | Yes | `browser_capture_at` 11:11 → 11:34; golden PKR values unchanged in diff sample |
| `din-bridal/golden-fixtures.md` | Modified | **POSSIBLE_EVIDENCE_FILE** | Yes | Companion doc timestamp |

**Git evidence:** All tracked; last commit `9ea7f426` (DIN BRIDAL rollout). Local changes are re-run artifacts, not new golden PKR totals in sampled diff.

---

## Group 3 — DIN COUTURE monitoring

| Path | Status | Category | Committed equivalent | Notes |
|------|--------|----------|---------------------|-------|
| `din-couture-monitoring/production-flags-day1.json` | Modified | **NEEDS_REVIEW** | Yes | Single-line `capturedAt` or similar refresh |
| `din-couture-monitoring/production-monitoring-day1.md` | Modified | **NEEDS_REVIEW** | Yes | Single-line timestamp refresh |

**Git evidence:** Last commit `d227d221` (DIN COUTURE rollout).

---

## Group 4 — Phase 2.16 monitoring

| Path | Status | Category | Committed equivalent | Notes |
|------|--------|----------|---------------------|-------|
| `phase-2-16-monitoring/production-flags-day1.json` | Modified | **POSSIBLE_EVIDENCE_FILE** | Yes | `capturedAt` updated 2026-06-27 → **2026-06-29T08:12** (matches operator terminal PASS run) |
| `phase-2-16-monitoring/production-monitoring-day1.md` | Modified | **NEEDS_REVIEW** | Yes | Small timestamp/wording delta |

---

## Group 5 — Timestamped three-company monitoring (untracked)

| Path | Status | Category | Overall | Committed equivalent | Notes |
|------|--------|----------|---------|---------------------|-------|
| `three-company-monitoring-2026-06-27T15-16-22-259Z.*` | Untracked | **SAFE_DELETE_CANDIDATE_AFTER_APPROVAL** | **FAIL** | No | Pre-credential-hardening failed run |
| `three-company-monitoring-2026-06-27T15-27-34-167Z.*` | Untracked | **SAFE_DELETE_CANDIDATE_AFTER_APPROVAL** | **FAIL** | No | Failed run; not on main |
| `three-company-monitoring-2026-06-27T15-43-53-886Z.*` | Untracked | **SAFE_ARCHIVE_CANDIDATE** | PASS | No (similar era committed: 15-42 on main) | PASS duplicate of same-day session |
| `three-company-monitoring-2026-06-29T07-31-19-431Z.*` | Untracked | **SAFE_ARCHIVE_CANDIDATE** | PASS | No | Agent-run PASS; closure evidence is 07-42-30 on main |
| `three-company-monitoring-2026-06-29T08-12-46-549Z.*` | Untracked | **POSSIBLE_EVIDENCE_FILE** | PASS | No | **Newest operator terminal PASS**; per-company credentials |

**Committed reference:** `three-company-monitoring-2026-06-29T07-42-30-177Z.json` on main — authoritative closure evidence.

---

## Group 6 — Latest monitoring pointer

| Path | Status | Category | Committed equivalent | Notes |
|------|--------|----------|---------------------|-------|
| `latest-three-company-monitoring.json` | Modified | **POSSIBLE_EVIDENCE_FILE** | Yes (points to 07-42-30 on HEAD) | Local now points to **08-12-46-549Z** PASS |
| `latest-three-company-monitoring.md` | Modified | **ALREADY_COMMITTED_DUPLICATE** | Yes | Companion pointer; same slug update |

---

## Group 7 — Unexpected files

None beyond the 25 listed above.

---

## Task 3 — Committed evidence comparison

| Local artifact | Authoritative on `main` | Relationship |
|----------------|-------------------------|--------------|
| `07-42-30-177Z` | **Committed** | Password rotation closure evidence |
| `08-12-46-549Z` | Not committed | Newer operator PASS; supersedes pointer locally only |
| `07-31-19-431Z` | Not committed | Intermediate PASS during closure session |
| `15-43-53-886Z` | Not committed | Same-day PASS; `15-42-15` committed instead |
| `15-16/15-27` FAIL | Not committed | Failed runs — safe delete candidates after approval |
| DIN BRIDAL golden bundle | Committed @ `9ea7f426` | Local = re-capture timestamps; review before commit |
| Graphify report | Committed (stale) | Local = regenerated noise |
