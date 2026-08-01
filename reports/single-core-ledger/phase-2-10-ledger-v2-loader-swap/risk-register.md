# Phase 2.10 — Ledger V2 loader swap risk register

**Status:** Planning — no loader swap executed  
**Company:** DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`) only  

| ID | Risk | Likelihood | Impact | Mitigation | Gate / owner |
|----|------|------------|--------|------------|--------------|
| R1 | **Customer hybrid vs unified effective-party row mismatch** — legacy `getCustomerLedger` hybrid ≠ unified RPC row set | Medium | High | MR JALIL + Pilot Batch 9/9 before swap; per-type spot checks; keep preview compare during rollout | Pre-exec browser + batch |
| R2 | **Export totals drift** — PDF/Excel/CSV/WhatsApp use `result.rows`; unified rows may change closing | Medium | High | Mandatory export spot-check (not waived); golden fixtures; compare summary lines | Hard gate before loader flag ON |
| R3 | **Running balance / opening derivation** — `deriveLedgerV2Opening` assumes first row math; unified mapper must preserve running balance chain | Low | High | Unit tests on mapper + integration test MR JALIL; Pilot Batch | Pre-exec QA |
| R4 | **Row drill-down failure** — unified mapped rows lack `glEntry`; `prefetchLedgerRowTransaction` falls back to reference/journal id | Medium | Medium | Sample 10 rows per type: open detail modal; document known gaps | Pre-exec manual QA |
| R5 | **Attachments missing** — mapper sets `hasAttachments: false`; no post-enrichment | Medium | Low | Accept or add enrichment pass for unified rows; document UX | Product sign-off |
| R6 | **Created-by column blank** — unified mapper sets `createdBy: '—'` | High | Low | Accept for pilot or add user lookup; export column impact | Waivable for DIN CHINA pilot |
| R7 | **Accidental swap without loader flag** — reusing engine/screen flags for loader | Low | Critical | **Separate** `unified_ledger_loader_ledger_v2`; code branch only on loader flag | Design + code review |
| R8 | **Wrong company enabled** | Low | Critical | Cross-company SQL before/after; single-company INSERT scripts | Ops SQL checklist |
| R9 | **Wrong screen flag enabled** | Low | High | Assert forbidden keys OFF; no roznamcha/tb/account/party flags | SQL preflight |
| R10 | **Kill switch ignored** | Low | Critical | `isUnifiedLedgerKillSwitchActive` forces legacy in loader resolver; test env + DB kill | Rollback L4 + tests |
| R11 | **Staff sees unified data with wrong authority labels** — basis banner still says "official GL" | Medium | Medium | Update `ReportBasisBanner` copy when main=unified; staff waiver or verified hidden preview | UX review |
| R12 | **Filter confusion** — search/type filters client-side only; summary on filtered subset may confuse vs full-period unified | Low | Medium | Document behavior (unchanged from legacy); test filtered export | QA script |
| R13 | **Preview toggle semantics invert** — today preview=unified, main=legacy; after swap need legacy shadow compare | Medium | Medium | Design reverse-compare panel or disable redundant toggle | Implementation spec |
| R14 | **RPC error spike** — main path calls unified without shadowForce wrapper | Medium | High | Error toast + fallback to legacy optional (plan decision); monitor Admin Compare | Ops monitoring |
| R15 | **Instant rollback fails** — flag cache / client stale state | Low | High | Flag read on each load; document hard refresh; L1 SQL &lt; 1 min | Rollback dry-run |
| R16 | **Date range embed bug** — Accounting tab local period vs global filter (soak QA learned) | Medium | Medium | QA scripts set wide range via localStorage + verify period | Browser QA |
| R17 | **Production bundle stale** — flags ON but old JS | Low | Medium | Preview tunnel QA on `:3003` before prod deploy of loader code | Deploy plan separate |
| R18 | **Stage 3 conflated with Stage 2** — ops enables loader thinking screen flag = swap | Medium | Critical | Separate ops ticket; loader flag absent until implementation merged | This plan + training |

---

## Residual risks after mitigations

- Cash/Bank/Roznamcha parity **deferred** (Phase 2.9A-CB) — not a Ledger V2 blocker if scope stays Ledger V2 only.
- Full 24h soak may be waived again — acceptable if export spot-check and rollback dry-run complete.

---

## Plan recommendation

**Proceed to implementation approval (Status A)** with hard pre-execution gates on R2, R4, R7, R8, R10, and staff/export sign-off.
