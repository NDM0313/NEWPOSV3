# Sales Revenue Canonical Account Audit

**Date:** 2026-07-10  
**Method:** Read-only production SQL via VPS  
**Safety:** No DB migration, no mutation, no transfer JE

## Finding

- **4000 native/live usage:** All three companies use **4000** for live/native sales. DIN BRIDAL: 26 sale JEs (22 SL-native + 4 other). DIN COUTURE: 1 SL-native sale. DIN CHINA: 3 SL-native sales (Rs. 1,573,600).
- **4100 import/historical usage:** **4100** has JE activity only in DIN CHINA — 92 DC-import sales (Rs. 50,596,406.98) plus 4 sale returns. Zero JE activity in DIN BRIDAL and DIN COUTURE.
- **Recommendation:** Canonical future Sales Revenue = **4000**. **4100** = historical/import fallback only.

Both codes are active, non-group detail accounts under parent **4050** in all companies — valid for posting.

---

## DIN COUTURE (`2ab65903-62a3-4bcf-bced-076b681e9b74`)

### 4000
- Account id: `88e14dea-815e-41af-8088-b0cda27baef0`
- Name: Sales Revenue | type: revenue | active: yes | is_group: no | parent: 4050
- JE count: 1 sale doc | net revenue: Rs. 21,250 | latest JE: 2026-06-09
- Pattern: SL-native (SL-0001)

### 4100
- Account id: `1788d214-8cfb-4360-a53a-05f6b11b65c0`
- Active detail account; **no JE activity**

### Native sales account
**4000**

---

## DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)

### 4000
- Account id: `9d4ad9a6-537b-4f04-9af1-69f03e776027`
- Name: Sales Revenue | active: yes | is_group: no | parent: 4050
- JE count: 31 (26 sale doc) | net revenue: Rs. 943,750 | latest JE: 2026-07-05
- Pattern: 22 SL-native + 4 other

### 4100
- Account id: `230aef26-1818-4d41-8f96-01dba7d2b72e`
- Active detail account; **no JE activity**

### Native sales account
**4000**

---

## DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

### 4000
- Account id: `e0070cfa-5f80-45f3-b80d-cf75c1a93738`
- JE count: 3 sale doc | net revenue: Rs. 1,573,600 | latest JE: 2026-07-07
- **New SL/native pattern:** SL-0001 … SL-0003 → **4000**

### 4100
- Account id: `ce23889c-07c0-4f09-9946-1e55764719e1`
- JE count: 96 (92 sale doc + 4 returns) | net revenue: Rs. 49,685,321.98 | latest JE: 2026-04-23
- **Imported DC pattern:** DC-00xx → **4100** only (92 sales)

### Imported DC pattern
All 92 DC-import invoices credit **4100** exclusively.

### New SL/native pattern
All 3 SL-native invoices credit **4000** exclusively.

### Native sales account (future)
**4000**

---

## Decision

| Item | Value |
|------|-------|
| Canonical future Sales Revenue | **4000** |
| 4100 role | historical/import fallback only |

## Safety

- DB migration: no
- DB mutation: no
- Transfer JE: no
