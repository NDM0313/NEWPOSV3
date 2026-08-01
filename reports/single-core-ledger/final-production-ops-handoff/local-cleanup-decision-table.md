# Local cleanup decision table

**Run:** OFFICE PC LOCAL CLEANUP REVIEW — DRY RUN ONLY  
**Generated:** 2026-06-29T16:00:00.000Z

| Path | Git status | Category | Likely purpose | Committed equivalent | Risk | Recommended action | Approval | Command later (if approved) |
|------|------------|----------|----------------|---------------------|------|-------------------|----------|----------------------------|
| `graphify-out/GRAPH_REPORT.md` | Modified | GENERATED_NOISE | AST graph auto-update | Yes | Low | leave untouched | No | `git restore graphify-out/GRAPH_REPORT.md` OR commit separately after `graphify update .` |
| `din-bridal-monitoring/golden-capture/golden-capture-raw.json` | Modified | NEEDS_REVIEW | Re-capture raw JSON | Yes | Medium | investigate manually | Yes | Diff review; commit only if finance approves golden refresh |
| `din-bridal-monitoring/golden-capture/golden-capture-report.md` | Modified | NEEDS_REVIEW | Re-capture report | Yes | Medium | investigate manually | Yes | Same as above |
| `din-bridal-monitoring/golden-capture/screenshots/party-ledger.png` | Modified | NEEDS_REVIEW | Screenshot evidence | Yes | Medium | investigate manually | Yes | Visual compare before commit/delete |
| `din-bridal-monitoring/golden-capture/screenshots/roznamcha.png` | Modified | NEEDS_REVIEW | Screenshot evidence | Yes | Medium | investigate manually | Yes | Visual compare before commit/delete |
| `din-bridal-monitoring/production-flags-day1.json` | Modified | NEEDS_REVIEW | Flag snapshot refresh | Yes | Medium | leave untouched | No | `git restore` or commit in bridal evidence batch |
| `din-bridal-monitoring/production-monitoring-day1.md` | Modified | NEEDS_REVIEW | Monitoring report refresh | Yes | Low | leave untouched | No | `git restore` or commit with bridal batch |
| `din-bridal/golden-fixtures.json` | Modified | POSSIBLE_EVIDENCE_FILE | Golden fixture timestamps | Yes | **High** | investigate manually | Yes | Finance review before any commit |
| `din-bridal/golden-fixtures.md` | Modified | POSSIBLE_EVIDENCE_FILE | Golden fixture doc | Yes | Medium | investigate manually | Yes | Pair with JSON decision |
| `din-couture-monitoring/production-flags-day1.json` | Modified | NEEDS_REVIEW | Flag snapshot refresh | Yes | Low | leave untouched | No | `git restore` or commit if intentional |
| `din-couture-monitoring/production-monitoring-day1.md` | Modified | NEEDS_REVIEW | Monitoring report refresh | Yes | Low | leave untouched | No | `git restore` or commit if intentional |
| `operational-monitoring/latest-three-company-monitoring.json` | Modified | POSSIBLE_EVIDENCE_FILE | Pointer to newest PASS | Yes (older slug) | Low | commit later in separate evidence commit | Yes | Stage with `08-12-46-549Z` pair if operator approves |
| `operational-monitoring/latest-three-company-monitoring.md` | Modified | ALREADY_COMMITTED_DUPLICATE | Pointer companion | Yes | Low | commit later in separate evidence commit | Yes | Stage with JSON pointer |
| `phase-2-16-monitoring/production-flags-day1.json` | Modified | POSSIBLE_EVIDENCE_FILE | DIN CHINA flag snapshot @ 2026-06-29 | Yes | Medium | commit later in separate evidence commit | Yes | Optional commit with monitoring evidence batch |
| `phase-2-16-monitoring/production-monitoring-day1.md` | Modified | NEEDS_REVIEW | Phase 2.16 report refresh | Yes | Low | leave untouched | No | `git restore` unless paired with flags commit |
| `three-company-monitoring-2026-06-27T15-16-22-259Z.json` | Untracked | SAFE_DELETE_CANDIDATE_AFTER_APPROVAL | Failed monitoring run | No | Low | delete later only after approval | Yes | `Remove-Item` both `.json` and `.md` |
| `three-company-monitoring-2026-06-27T15-16-22-259Z.md` | Untracked | SAFE_DELETE_CANDIDATE_AFTER_APPROVAL | Failed run report | No | Low | delete later only after approval | Yes | Pair delete with JSON |
| `three-company-monitoring-2026-06-27T15-27-34-167Z.json` | Untracked | SAFE_DELETE_CANDIDATE_AFTER_APPROVAL | Failed monitoring run | No | Low | delete later only after approval | Yes | `Remove-Item` both files |
| `three-company-monitoring-2026-06-27T15-27-34-167Z.md` | Untracked | SAFE_DELETE_CANDIDATE_AFTER_APPROVAL | Failed run report | No | Low | delete later only after approval | Yes | Pair delete with JSON |
| `three-company-monitoring-2026-06-27T15-43-53-886Z.json` | Untracked | SAFE_ARCHIVE_CANDIDATE | PASS duplicate (same session) | No | Low | archive later in separate folder | Yes | `Copy-Item` to `%USERPROFILE%\erp-monitoring-logs\` |
| `three-company-monitoring-2026-06-27T15-43-53-886Z.md` | Untracked | SAFE_ARCHIVE_CANDIDATE | PASS report duplicate | No | Low | archive later in separate folder | Yes | Copy with JSON |
| `three-company-monitoring-2026-06-29T07-31-19-431Z.json` | Untracked | SAFE_ARCHIVE_CANDIDATE | Intermediate PASS run | No | Low | archive later in separate folder | Yes | Copy to local logs folder |
| `three-company-monitoring-2026-06-29T07-31-19-431Z.md` | Untracked | SAFE_ARCHIVE_CANDIDATE | Intermediate PASS report | No | Low | archive later in separate folder | Yes | Copy with JSON |
| `three-company-monitoring-2026-06-29T08-12-46-549Z.json` | Untracked | POSSIBLE_EVIDENCE_FILE | **Newest operator PASS** | No | Low | commit later in separate evidence commit | Yes | `git add` timestamped pair + latest pointer |
| `three-company-monitoring-2026-06-29T08-12-46-549Z.md` | Untracked | POSSIBLE_EVIDENCE_FILE | Newest operator PASS report | No | Low | commit later in separate evidence commit | Yes | `git add` with JSON |

*Paths prefixed with `reports/single-core-ledger/` where abbreviated above.*
