# After-cleanup verification

**Generated:** 2026-06-29

---

## Absent (expected)

| Check | Count |
|-------|------:|
| auth.users `admin@test.com` | **0** |
| company `d7dac58b-a731-42cb-bc26-0bf7a1b8e292` | **0** |
| public.users for company/auth | **0** |
| branches / accounts / contacts for company | **0** |

---

## Present (expected)

| Check | Result |
|-------|--------|
| DIN CHINA, DIN BRIDAL, DIN COUTURE | **3 companies present** |
| Auth login `admin@test.com` | **400** (invalid credentials / absent) |

---

## Scope exclusions

| Item | Changed |
|------|---------|
| migrations_run | **false** |
| feature_flags | **false** |
| GL / journals / payments / sales / purchases | **not touched** |

---

## Result

**PASS**
