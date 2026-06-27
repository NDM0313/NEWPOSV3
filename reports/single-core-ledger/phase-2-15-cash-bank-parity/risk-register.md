# Phase 2.15 — Risk register

| ID | Risk | Mitigation | Status |
|----|------|------------|--------|
| R1 | Raw RPC still used in preview panel | Documented; main loader uses parity assembler | Mitigated |
| R2 | Admin Compare Cash/Bank still shows raw RPC vs legacy | Existing waiver; separate from roznamcha loader | Accepted |
| R3 | LV2/AS/TB/PL regression | Cross-screen gates before roznamcha enable | Gate |
| R4 | GL/payment data mutation | Reporting-only fix; no migrations | Closed |
| R5 | Wrong company flag enable | SQL scoped to DIN CHINA UUID only | Controlled |
