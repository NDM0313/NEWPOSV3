# Import FX — status & remaining tasks (2026-08-15)

**Branch:** `main`  
**Last W3 merge:** PR [#24](https://github.com/NDM0313/NEWPOSV3/pull/24) · `5ef895f0`  
**This doc:** UA polish + Advance UX ship + open backlog after VPS sync.

---

## Shipped since W3 merge (UI — no new migrations)

| Item | Notes |
|------|--------|
| Guided UA shell | One task at a time; Cases/Context drawers; Arrange 1–5 · Advance · Buy USD · Later — [`IMPORT_FX_CASE_GUIDED_UA_SHELL.md`](IMPORT_FX_CASE_GUIDED_UA_SHELL.md) |
| AddEntryV2 theme | Blur overlay, `max-w-[700px]`, gradient header, blue accents |
| Easy Expected Schedule | Quick plans (Today / This week / Clear) + per-date chips + cascade |
| Advance Edit / Attach / Confirm unlock | Edit arrangement (locked review); metadata attachments; **inline clearing account picker**; soft Path-21 tip; sticky Confirm block reason |

**Operator note:** Confirm & Post needs clearing account (Settings or in-panel picker). Arrangement stay locked after confirm — change parties/amounts via Cancel Unposted + new draft.

---

## Production / VPS (as of prior + this sync)

| Item | Status |
|------|--------|
| W3 SQL on VPS (`…180000` / `…180100`) | Applied + ledgered (prior session) |
| W3 RPCs (`post_import_fx_agent_advance`, USD + reverses) | Present on `supabase-db` |
| Frontend deploy | Expect GitHub Actions **Deploy to VPS** on this push (or manual `git pull` + deploy) |
| Full `run-migrations-vps.sh` chain | **Still broken** after Aug 1 settings ledger fix — next fail: `20260801190100_fx_currency_purchase_rpcs.sql` (`record_fx_currency_purchase_on_credit` not unique). W3 was applied out-of-band; other PENDING import-fx files may already exist as objects but are not all in `schema_migrations` |

---

## Remaining tasks (backlog)

### P0 — ops / correctness

1. **Fix VPS migrate chain** — make `fx_currency_purchase_rpcs` idempotent (drop overloaded signatures / `CREATE OR REPLACE` with full args), then mark or re-run pending Import FX migrations so `schema_migrations` matches reality.
2. **Smoke Confirm & Post on prod** — clearing account set → advance post → JE appears → reverse once on a throwaway case (owner-supervised).
3. **Non-prod HTTP staging** — still missing; live browser Confirm against prod remains high-risk without a clone.

### P1 — product UX

4. **Binary attachments** — today metadata-only; Storage upload + RLS when approved.
5. **Real Path 21 soft-match** — replace stub “external ref filled” tip with actual duplicate lookup (or remove).
6. **Arrange reopen (optional)** — today locked after confirm; only if owner approves RPC unlock for `NOT_POSTED`.
7. **W3 Demo route cleanup** — keep secondary or gate behind flag only on non-prod.

### P2 — money waves (separate approvals)

8. **W4** — China USD transfer + USD→CNY conversion + pool (see [`IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md`](IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md)).
9. **W5** — Supplier allocation from CNY pool.
10. **W6** — Reconciliation / close + final `POSTED` semantics.
11. **W7** — Full timeline chrome / queues / mobile one-step (ASYNC polish).

### Explicitly out of scope until approved

- Merging Path 21 Agent FX into Cases workspace  
- Dropping clearing-account requirement  
- Casual retarget of `.env.local` away from / onto production without owner line  

---

## Quick links

- Guided shell: [`IMPORT_FX_CASE_GUIDED_UA_SHELL.md`](IMPORT_FX_CASE_GUIDED_UA_SHELL.md)  
- W3 design: [`IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md`](IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md)  
- Prior remaining (2026-08-14): [`IMPORT_FX_REMAINING_TASKS_2026-08-14.md`](IMPORT_FX_REMAINING_TASKS_2026-08-14.md)  
- Master W3→W6: [`IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md`](IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md)
