# Verification results — Mac Home Sync Audit

**Generated:** 2026-06-29  
**HEAD:** `ae6c69d0`

---

## Commands run

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | **298/298 PASS** |
| `npm run test:unit` | **122/122 PASS** |
| `npm run build` | **PASS** (Vite + PWA) |
| `npm run lint` | **Not available** at repo root |
| `npm run typecheck` | **Not available** at repo root (build covers TS) |

---

## Duration

- unified-ledger: ~2.3s
- unit: ~1.2s
- build: ~32s

---

## Notes

- Build emits chunk size warnings (pre-existing; not introduced by ae6c69d0)
- Browserslist data 6 months old (informational)
- No conflict markers in source tree
- graphify-out modified locally — excluded from commit

---

## Verdict

**VERIFICATION_PASS**
