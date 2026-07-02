# DIN CHINA COA Cleanup — Final Report

Generated: 2026-06-15T07:09:47.971Z
Company: 30bd8592-3384-4f34-899a-f3907e336485
Apply: SUCCESS
Verification pass: **YES**

## Summary
- Parents created: 0
- Accounts updated: 0
- Account IDs unchanged: yes (same row ids)

## Name / code / parent changes

| Legacy | Old name | New name | Old code | New code | Old parent | New parent |
|--------|----------|----------|----------|----------|------------|------------|
| DC0115 | China Cash | China Cash | 1051 | 1051 | 1050 | 1050 |
| DC0106 | MCB | MCB | 1061 | 1061 | 1060 | 1060 |
| DC0108 | FHD MZ | FHD MZ | 1062 | 1062 | 1060 | 1060 |
| DC0159 | NDM MZ | NDM MZ | 1063 | 1063 | 1060 | 1060 |
| DC0133 | WALI T/T | WALI T/T | 1202 | 1202 | 1201 | 1201 |
| DC0157 | YAQOOB | YAQOOB | 1204 | 1204 | 1203 | 1203 |

## Verification checks

- PASS DC code removed DC0115: expected no DC, got 1051
- PASS name DC0115: expected China Cash, got China Cash
- PASS code DC0115: expected 1051, got 1051
- PASS parent DC0115: expected 5b901630-ad21-474f-ba99-12f3bbec1189, got 5b901630-ad21-474f-ba99-12f3bbec1189
- PASS balance DC0115: expected 611700, got 611700
- PASS payments DC0115: expected 17, got 17
- PASS expenses DC0115: expected 4, got 4
- PASS DC code removed DC0106: expected no DC, got 1061
- PASS name DC0106: expected MCB, got MCB
- PASS code DC0106: expected 1061, got 1061
- PASS parent DC0106: expected fa85d1a8-69c2-45a9-b58d-a869d3b12524, got fa85d1a8-69c2-45a9-b58d-a869d3b12524
- PASS balance DC0106: expected 37000, got 37000
- PASS payments DC0106: expected 1, got 1
- PASS expenses DC0106: expected 0, got 0
- PASS DC code removed DC0108: expected no DC, got 1062
- PASS name DC0108: expected FHD MZ, got FHD MZ
- PASS code DC0108: expected 1062, got 1062
- PASS parent DC0108: expected fa85d1a8-69c2-45a9-b58d-a869d3b12524, got fa85d1a8-69c2-45a9-b58d-a869d3b12524
- PASS balance DC0108: expected 6508500, got 6508500
- PASS payments DC0108: expected 46, got 46
- PASS expenses DC0108: expected 0, got 0
- PASS DC code removed DC0159: expected no DC, got 1063
- PASS name DC0159: expected NDM MZ, got NDM MZ
- PASS code DC0159: expected 1063, got 1063
- PASS parent DC0159: expected fa85d1a8-69c2-45a9-b58d-a869d3b12524, got fa85d1a8-69c2-45a9-b58d-a869d3b12524
- PASS balance DC0159: expected 1171340, got 1171340
- PASS payments DC0159: expected 10, got 10
- PASS expenses DC0159: expected 0, got 0
- PASS DC code removed DC0133: expected no DC, got 1202
- PASS name DC0133: expected WALI T/T, got WALI T/T
- PASS code DC0133: expected 1202, got 1202
- PASS parent DC0133: expected ec672253-7c3d-47ba-9a18-10480f8c8184, got ec672253-7c3d-47ba-9a18-10480f8c8184
- PASS balance DC0133: expected -41343000, got -41343000
- PASS payments DC0133: expected 1, got 1
- PASS expenses DC0133: expected 0, got 0
- PASS DC code removed DC0157: expected no DC, got 1204
- PASS name DC0157: expected YAQOOB, got YAQOOB
- PASS code DC0157: expected 1204, got 1204
- PASS parent DC0157: expected b5fa2033-71c3-49f5-9744-0c1dae2ad177, got b5fa2033-71c3-49f5-9744-0c1dae2ad177
- PASS balance DC0157: expected -24573440, got -24573440
- PASS payments DC0157: expected 3, got 3
- PASS expenses DC0157: expected 0, got 0
- PASS no DC codes company-wide: expected 0, got 0
- PASS no account 4000: expected false, got false
- PASS no 4050 posting lines: expected 0, got 0

## Confirmations
- DC codes removed from target accounts
- DIN prefix removed from cleaned names
- Balances unchanged (GL-derived)
- Payment and expense link counts unchanged
- No duplicate detail accounts created
- Journal entry amounts not modified by this tool