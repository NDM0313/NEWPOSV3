# Phase 2.15 parity summary

- Wide golden parity model pass: **PASS**
- Legacy golden cash in: 136158012
- Legacy golden cash out: 67042426
- Legacy golden closing: 69115586
- Raw unified RPC cash out (pre-fix): 126,854,008
- Root cause: payment-posted GL legs + missing JE dedupe vs roznamcha composite
- Fix: roznamcha unified loader uses payment+journal composite (Phase 2.15 assembler)
