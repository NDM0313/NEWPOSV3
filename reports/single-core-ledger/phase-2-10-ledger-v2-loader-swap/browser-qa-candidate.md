# Phase 2.10 loader browser QA — candidate

**Timestamp:** 2026-06-26T13:13:40.184Z
**Mode:** candidate
**Overall:** PASS

## Checks
- [PASS] admin login
- [PASS] admin preview toggle visible
- [PASS] preview toggle default OFF
- [PASS] no unified RPC before main load (toggle OFF) — 0 calls
- [PASS] unified main-loader RPC on MR JALIL load (toggle OFF) — 1 calls
- [PASS] main loader attr (candidate) — expected=unified actual=unified
- [PASS] MR JALIL closing 216300 — closing=216300
- [PASS] preview legacy shadow compare (toggle ON) — source=legacy_shadow
- [PASS] export PDF closing 216300 — pdf=216300
- [PASS] export Excel closing 216300 — excel=216300
- [PASS] export CSV closing 216300 — csv=216300
- [PASS] export matches on-screen main table — screen=216300
- [PASS] export spot-check signed — unified main result.rows authority
- [PARTIAL] non-golden party spot-check — Customer
- [WAIVED] non-golden party spot-check — No alternate party selected from dropdown
- [PASS] admin compare center loads
- [PASS] admin Pilot ON — Pilot: ON
- [PASS] admin company engine ON — Company engine: ON
- [PASS] party MR JALIL compare — old=216300 new=216300
- [PASS] pilot batch 9/9 — compared=9 pass=9 fail=0
- [WAIVED] staff preview toggles hidden — No staff credentials

