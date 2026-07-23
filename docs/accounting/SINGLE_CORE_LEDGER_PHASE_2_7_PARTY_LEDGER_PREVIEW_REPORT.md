# Single Core Ledger Phase 2.7 — Party Ledger Preview Report

**Status:** `PHASE 2.7 COMPLETE` — Party Ledger preview toggle shipped; legacy default preserved; engine still OFF  
**Branch:** `feature/single-core-ledger-phase-2-7-party-ledger-preview`  
**Base:** `feature/single-core-ledger-phase-2-6-roznamcha-preview` @ `baf87199`  
**Date:** 2026-06-14  

---

## Summary

Phase 2.7 adds a **role-gated preview toggle** on Sidebar → Party Ledger ([`EffectivePartyLedgerPage`](src/app/components/accounting/EffectivePartyLedgerPage.tsx)) only. When enabled, a parallel unified RPC fetch runs in shadow mode (`shadowForce: true`) alongside the existing legacy `loadEffectivePartyLedger` loader.

---

## Behavior

| State | Main Party Ledger table | Unified RPC | Export |
|-------|------------------------|-------------|--------|
| Toggle **OFF** (default) | Legacy `result` → display pipeline | Not called | N/A (no export on this page) |
| Toggle **ON** | Legacy unchanged | `shadowForce: true` | N/A |
| Kill switch **ON** | Legacy only | **Blocked** | N/A |

**Critical:** `loadEffectivePartyLedger` remains the only path populating the main table.

---

## Compare design

| Side | Source |
|------|--------|
| **Old** | On-screen `result` from effective load (before client filters) |
| **New** | `get_unified_party_ledger` with matching date range, party, basis |

**Note:** Admin Compare Center Party tab uses **GL hybrid** as old side; this preview compares **effective collapse vs unified GL**.

---

## Golden fixtures

| Fixture | Value |
|---------|-------|
| MR JALIL | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` |
| Expected unified closing | PKR **216,300** (±0.01) |
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |

Shortcut: **Load MR JALIL** button.

---

## Safety

- `unified_ledger_engine`: **OFF** — no `feature_flags` writes
- No SQL migrations
- Ledger V2, Account Statement, AR/AP, COA, Roznamcha, TB, Cash Flow, Day Book, BS, P&L: **unchanged**

---

## Tests

```bash
npm run test:unified-ledger
```

Target: 110+ tests.
