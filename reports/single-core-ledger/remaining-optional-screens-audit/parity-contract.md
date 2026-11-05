# Parity contract — BS / P&L / Cash Flow / Mobile

**Run:** PHASE 3 — REMAINING OPTIONAL SCREEN AUDIT  
**Generated:** 2026-06-29  
**Golden status:** Approved goldens exist for **five live loaders only**. BS / P&L / Cash Flow / mobile financial statements: **NEEDS_GOLDEN_CAPTURE** — do not invent final numbers.

---

## Shared production constraints

- Accounting basis for unified path: `official_gl` unless audit mode explicitly selected
- Companies in scope: DIN CHINA, DIN BRIDAL, DIN COUTURE (three-company baseline)
- FX / multi-currency app: **out of scope**
- Safe fallback: if unified preview compare fails or finance has not signed off → **keep legacy main** (no loader swap)

---

## Balance Sheet

| Contract item | Specification |
|---------------|---------------|
| Accounting basis | `official_gl` for normal; optional `audit_full_history` for audit compare only |
| Date / as-of | Single **as-of date** (end of selected period); assets/liabilities/equity cumulative through as-of |
| Branch behavior | Match Trial Balance branch semantics when unified — strict mode for transactional NULL-branch rules per `unifiedLedgerBranchFilter` |
| Company scoping | Single active company; no cross-company |
| Normal vs audit | Normal: exclude void; align with unified TB normal basis. Audit: include labeled reversal/void trails |
| Reversal/correction | Normal mode excludes `correction_reversal` if unified TB basis says so; audit shows suffix labels per `reportVisibilityContract` |
| Rounding / currency | PKR; 2 decimal places on totals; account lines rounded per existing TB rules |
| Print/export | Match current `FinancialReportPrintShell` + Excel column layout; no layout change without UI phase approval |
| Mobile parity | **No mobile BS screen** — contract deferred until screen exists |
| Golden test | **NEEDS_GOLDEN_CAPTURE** per company (as-of date + branch matrix) |
| Safe fallback | Legacy `getBalanceSheet` remains main until golden PASS + finance sign-off |

---

## Profit & Loss

| Contract item | Specification |
|---------------|---------------|
| Accounting basis | `official_gl` for period activity |
| Date range | Inclusive `startDate`–`endDate`; comparison period optional (prior month/quarter) |
| Branch behavior | Same as TB branch filter for unified derivation |
| Company scoping | Single company |
| Normal vs audit | Normal excludes void; correction_reversal policy must match unified TB period totals |
| Reversal/correction | Period P&L must not double-count reversals in normal mode |
| Rounding / currency | PKR; section subtotals sum to net profit |
| COGS mapping | Use chart `type` + approved code list (`COST_OF_PRODUCTION_CODES`); changes require finance approval |
| Print/export | Excel + print shell; comparison columns when enabled |
| Mobile parity | **No mobile P&L** — deferred |
| Golden test | **NEEDS_GOLDEN_CAPTURE** — revenue, COGS, expenses, net profit per company/period |
| Safe fallback | Legacy `getProfitLoss` main until golden PASS |

---

## Cash Flow

| Contract item | Specification |
|---------------|---------------|
| Accounting basis | Operational cash/bank movement (`official_gl` liquidity accounts); GL statement summary subsection uses same basis |
| Date range | `dateFrom`–`dateTo` inclusive |
| Branch behavior | Match Roznamcha unified branch null rules when on unified path |
| Company scoping | Single company |
| Normal vs audit | Normal: `shouldIncludeInNormalCashMovement`; Audit: all rows with `roznamchaRowAuditSuffix` labels |
| Reversal/correction | Normal hides correction_reversal and voided payments; audit shows trails |
| Rounding / currency | PKR; running balance recomputed after filters per `recomputeCashFlowRunningBalance` |
| Print/export | CSV headers `CASH_FLOW_CSV_HEADERS`; PDF via `CashBookReportPreview` |
| Tie-out | Opening + cash in − cash out = closing (within tolerance); diagnostic hints documented in UI |
| Mobile parity | Mobile has Roznamcha + cash summaries but **not** full Cash Flow report page — **NEEDS_GOLDEN_CAPTURE** for mobile cash summary vs web |
| Golden test | **NEEDS_GOLDEN_CAPTURE** — opening/cash in/cash out/closing per company (Roznamcha goldens exist but CF filters may differ) |
| Safe fallback | Legacy roznamcha-based `getCashFlowReport` main |

---

## Mobile (ledger / export / print)

| Contract item | Specification |
|---------------|---------------|
| Scope | Account Ledger, Party Ledgers, Day Book/Roznamcha, cash/bank/wallet summaries |
| Accounting basis | Should match web when same report + filters (legacy today) |
| Date range | Per-report date pickers; Roznamcha matches web payments-only mode |
| Branch behavior | `journalEntryMatchesLedgerBranch` + RPC branch args |
| Company scoping | Active company from mobile session |
| Normal vs audit | Mobile Roznamcha has no audit toggle today — **gap** |
| Reversal visibility | Not aligned with web `reportVisibilityContract` on all mobile reports |
| Print/export | `LedgerPreviewPdf`, `RoznamchaPreviewPdf`; branded headers via `getCompanyBrand` |
| Unified loader parity | **No** `resolve*MainLoaderSource` in mobile — always legacy paths |
| Golden test | Partial — use existing party/TB/Roznamcha monitoring goldens for overlapping surfaces; full mobile export parity **NEEDS_GOLDEN_CAPTURE** |
| Safe fallback | No mobile loader swap until web unified path proven and finance approves |

---

## Approved golden references (existing — do not change)

| Company | Surface | Approved value |
|---------|---------|----------------|
| DIN CHINA | Party / MR JALIL | PKR 216,300 |
| DIN CHINA | Trial Balance | PKR 407,957,271.02 balanced |
| DIN CHINA | Roznamcha | 136,158,012 / 67,042,426 / 69,115,586 |
| DIN BRIDAL | MR REHAN ALI | PKR 530,000 |
| DIN BRIDAL | TB | PKR 21,919,575 |
| DIN BRIDAL | Roznamcha | 1,836,350 / 917,780 / 918,570 |
| DIN COUTURE | DHARIA | PKR 4,488,088 |
| DIN COUTURE | TB | PKR 49,747,104 |
| DIN COUTURE | Roznamcha | 85,000 / 34,500 / 50,500 |

**BS / P&L / Cash Flow statement totals:** not in approved golden set → **NEEDS_GOLDEN_CAPTURE**.
