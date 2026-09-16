# Repo and evidence scan

**Run:** R1B Admin Compare retained-JE baseline closure  
**Branch:** `main` @ `8813bb6b` (in sync with origin/main)

## Prior evidence reviewed

- `reports/party-discount-monitoring-drift-closure-20260630/` — TB golden closed; Admin Compare 9/9 fail classified as engine tie-out baseline
- `reports/party-discount-je-keep-closure-20260630/` — JE-0003 KEEP; MR JALIL golden 216299
- `reports/party-discount-je-posting-qa-20260630/` — controlled posting QA

## Confirmed baseline

| Item | Value |
|------|--------|
| MR JALIL unified closing | 216299 |
| TB golden | 407957272.02 |
| Admin Compare failure | legacy hybrid 216300 vs unified 216299 |
