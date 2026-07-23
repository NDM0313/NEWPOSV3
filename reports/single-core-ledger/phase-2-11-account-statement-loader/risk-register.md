# Phase 2.11 — risk register

| Risk | Mitigation | Status |
|------|------------|--------|
| Wrong company enabled | SQL scoped to DIN CHINA UUID only | Mitigated |
| GL mutation | No migrations; read-only RPC loaders | Mitigated |
| Ledger V2 regression | Independent loader flag; QA verifies V2 unified + 216,300 | PASS |
| Export drift | Exports from main `entries`; golden MR JALIL signed | PASS |
| Preview invert wrong | `legacy_shadow` when main unified; tested | PASS |
| Cross-screen flag leak | Preflight + post-verify SQL; only 6 unified flags for DIN CHINA | PASS |
| Production rollback delay | L1 SQL ready; loader OFF restores legacy immediately | Ready |
