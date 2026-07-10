# Post-4000 Correction Monitoring Stabilization

**Date:** 2026-07-10  
**Scope:** Monitoring-only hardening — no accounting/revenue logic changes

## Scope

| Item | Status |
|------|--------|
| Accounting logic changed | no |
| DB migrations | no |
| Production GL/data mutation | no |
| Artificial sale created | no |
| Runtime ERP deploy required | no (scripts-only change) |

## Monitoring flake

### Previous issue
- DIN CHINA Phase 2.16 failed with `Timeout 120000ms` waiting for `getByRole('button', { name: /^Journal Entries$/ })` in `openAccountingTab()` during Roznamcha navigation.

### DIN CHINA Journal Entries timeout
- **Failing step:** `readRoznamchaSummary()` → `openAccountingTab(page, 'Roznamcha')` → shell wait on Journal Entries tab
- **Selector:** `getByRole('button', { name: /^Journal Entries$/ })`
- **Timeout:** 120000ms (single attempt, no retry)
- **Likely cause:** Accounting view slow to render after `/?view=accounting` navigation; tab bar not visible before timeout on transient load

### Root cause
- UI/navigation flake — accounting shell not stable before tab click
- Not an accounting posting, revenue, or loader regression

### Fix
- Added `waitForAccountingShell()` with multiple markers (Journal Entries button/heading, Roznamcha tab, body text)
- `openAccountingTab()` retry up to 3 attempts with `journal_entries_navigation_retry` log
- `networkidle` wait + longer backoff between retries
- Post-click content markers for Roznamcha / Account Statements tabs

## Results

| Check | Result |
|-------|--------|
| DIN CHINA | **PASS** |
| DIN BRIDAL | **PASS** |
| DIN COUTURE | **PASS** |
| Overall monitor | **PASS** |
| Artifact | `three-company-monitoring-2026-07-10T18-42-28-347Z.md` |
| test:unified-ledger | PASS (336) |
| test:unit | PASS (188) |
| build | PASS |

## Sales revenue observation

| Item | Value |
|------|-------|
| Cutoff | `2026-07-10T18:21:44Z` (4000 correction deploy) |
| New finalized sale found | no |
| New 4000 revenue | 0 |
| New 4100 revenue | 0 |
| Status | `PENDING_OBSERVATION` |

## Safety

| Item | Status |
|------|--------|
| Transfer JE | no |
| 4000 deactivated | no |
| 4100 deactivated | no |
| R8-R2 | no |
| Play Store | no |
