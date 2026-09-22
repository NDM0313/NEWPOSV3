# AR/AP Parity by Basis (Read-Only Reproduction)

**Date:** 2026-07-15
**Method:** SSH `psql` comparing `get_contact_party_gl_balances` vs `get_unified_contact_party_gl_balances`

## Company summary (`effective_party`)

| Company | Contact AR sum abs delta vs legacy | Result |
|---------|--------------------------------------|--------|
| DIN COUTURE | 0 | **PASS** |
| DIN CHINA | 0 | **PASS** |
| DIN BRIDAL | **80,150** (80,000 + 150) | **FAIL** |

## DIN BRIDAL contact-level (`effective_party`)

| Contact | ID prefix | Legacy AR | Unified EP AR | Delta |
|---------|-----------|-----------|---------------|-------|
| Walk-in Customer old | `4549c5de` | 171,500 | 91,500 | **+80,000** (legacy higher) |
| Walk-in Customer | `a3c6ea52` | −150 | 0 | **−150** (legacy lower) |

No other Bridal contacts differ > 0.01.

## Same contacts — other bases

| Contact | Legacy AR | official_gl | audit_full_history | effective_party |
|---------|-----------|-------------|--------------------|-----------------|
| Walk-in Customer old | 171,500 | **171,500** | **171,500** | **91,500** |
| Walk-in Customer | −150 | **−150** | **−150** | **0** |

**Confirmed:** Bridal FAIL is **exclusive to `effective_party`**. `official_gl` and `audit_full_history` match legacy for these contacts and company totals (delta 0).
