# Monitoring timeline — DIN BRIDAL 2026-07-01

**Golden baselines:** TB 22,056,075 | Roznamcha Cash In 1,836,350 | Closing 918,570

| Snapshot (UTC) | DIN BRIDAL | TB actual | TB Δ | Cash In actual | Cash In Δ | Closing Δ |
|----------------|------------|-----------|------|----------------|-----------|-----------|
| 11:32 | **PASS** | 22,056,075 | 0 | 1,836,350 | 0 | 0 |
| 11:58 | FAIL | 22,136,075 | +80,000 | 1,916,350 | +80,000 | +80,000 |
| 12:31 | FAIL | 22,215,400 | +159,325 | 1,916,350 | +80,000 | +80,000 |
| 12:43 | FAIL | 22,257,400 | +201,325 | 1,958,350 | +122,000 | +122,000 |

DIN CHINA and DIN COUTURE **PASS** on all snapshots. MR REHAN ALI closing **530,000** unchanged throughout.

## Correlation to GL activity

| Monitoring shift | JE / event | Created (UTC) |
|------------------|------------|---------------|
| +80k @ 11:58 | **RCV-0075** — PKR 80,000 receipt (Walk-in / N331 balance) | 11:56:02 |
| +79,325 TB only @ ~12:31 | **JE-0205** — Sale **SL-0018** finalized (MAHVISH IQBAL) | 12:32:12 |
| +42k roznamcha +42k TB @ 12:43 | **RCV-0076** — PKR 42,000 receipt **SL-0018** | 12:42:24 |
| +20k after 12:43 artifact | **RCV-0077** — PKR 20,000 receipt **SL-0019** (HARIS N219) | 13:07:42 |

**Sum at 12:43:** TB +80,000 + 79,325 + 42,000 = **+201,325** | Roznamcha +80,000 + 42,000 = **+122,000** — exact match.
