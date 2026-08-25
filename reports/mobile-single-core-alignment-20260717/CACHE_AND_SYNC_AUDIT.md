# CACHE_AND_SYNC_AUDIT

## Findings

| Area | Behavior | GL risk |
|------|----------|---------|
| `listCache` IndexedDB | Accounts, contacts, sales/purchase lists | Stale list balances possible offline |
| Ledger key in listCache | Defined but **unused** | No offline ledger pages (good) |
| Offline write queue | Sales/purchase drafts | Must not duplicate finalize on replay |
| Visibility refresh | Some reports bump refresh nonce on tab focus | Partial |
| Company/branch switch | Must clear scoped caches | Verify in Phase 6 — incomplete |
| Empty RPC → zero | Multiple silent paths | **Root cause class for “GL missing” UX** — treat as error or documented fallback with notice |
| Vite proxy 502 | Dev-only; Kong restart during VPS deploy | Transient empty screens (observed 2026-07-17) |

## Root-cause class for prior “ledger empty / GL issue” on mobile

1. **Dual source:** list `accounts.balance` (cache) vs party AP RPC empty success (fixed in local WIP: journal overlay + empty-success fallback)  
2. **Infra 502** during Kong/container restart while using localhost Vite proxy  
3. **FY default** vs life-to-date list balances (All-time default in local WIP)  
4. **Roznamcha/Aging** never on unified path — operational vs GL confusion  

## Required cache policy (target)

- Accounting truth TTL short / always revalidate on focus for statements  
- Invalidate on company/branch change and after writes  
- Logout clears scoped state  
- Offline: explicit stale banner; no fabricated zeros  

## Diagnostics (debug/admin only — not implemented fully)

Show: endpoint, company, branch, role, basis, date range, cache hit, JE id, last refresh.
