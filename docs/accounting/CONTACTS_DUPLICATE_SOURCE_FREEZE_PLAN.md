# Duplicate / legacy accounting sources — detection and freeze plan

**Date:** 2026-03-29

## 1. Canonical sources (authoritative)

| Concern | Canonical read | Why |
|---------|----------------|-----|
| Contact operational recv/pay | `get_contact_balances_summary` | Single RPC; encodes opening + final sale/purchase due + manual receipt/payment subtract rules per migrations. |
| Contact party GL AR/AP/worker | `get_contact_party_gl_balances` | Single RPC; 1100/2000 subtrees + party resolution + `linked_contact_id`. |
| Journal truth | `journal_entries` / `journal_entry_lines` (via services or statement RPCs) | Legal GL. |
| Payment amount (business event) | `payments.amount` | Source for cash; must pair with journal delta on edit (PF-14.1). |

## 2. Duplicate / risky sources

| Source | Duplicates | Risk | Action |
|--------|------------|------|--------|
| Merged client rollup (`convertFromSupabaseContact` + raw sales/purchases) | `get_contact_balances_summary` | **High** — diverged from RPC | **Frozen** from row operational numbers (removed earlier; only used for non-balance fields when loading list). |
| `accounts.balance` on party sub-rows | `get_contact_party_gl_balances` | **Medium** — stale vs journals | **Frozen** as truth: hierarchy model uses it only when party map missing (documented non-authoritative). |
| Generic 1100/2000 without subtree | Subtree-aware RPC | **High** for party views | **Superseded** by `20260410` on environments where applied; adjustment JEs must use `resolveReceivablePostingAccountId` / `resolvePayablePostingAccountId`. |
| Operational ledger adapters vs RPC | Same intent, different code path | **Low** — both document-based; watch for formula drift | **Monitor**; supplier operational running balance fixed in `ledgerDataAdapters.ts`. |

## 3. Keep / freeze / delete-later

| Item | Verdict |
|------|---------|
| `get_contact_balances_summary` | **Keep** — canonical OP. |
| `get_contact_party_gl_balances` | **Keep** — canonical party GL slice for contacts. |
| Legacy merged balance in `ContactsPage` | **Frozen** — must not return as operational. |
| Old COA-only balance for party display | **Frozen** — fallback labeled non-authoritative. |
| Duplicate journal builders | **No deletion** — prove unused repo-wide first. |

## 4. Deletion candidates

**None** approved in this pass. Schema/objects remain; UI truth paths are pinned in docs and tooltips.
