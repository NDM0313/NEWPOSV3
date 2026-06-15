# DIN CHINA Purchase / Inventory GL Tie-Out — Dry Run

**Generated:** 2026-06-15T18:32:51.597Z

## Summary

| Metric | Value |
| --- | --- |
| ERP purchase total | 0 |
| Latest CSV purchase total | 67978418.4 |
| Updated CSV purchase total | 67514347.4 |
| Purchase items total | 0 |
| GL inventory debit (1200) | 68785345.52 |
| GL AP credit | 0 |
| Payments total | 0 |
| AP remaining due | 0 |
| CSV vs ERP mismatch | -67514347.4 |
| Requires user approval | YES |

## Purchase detail

```json
null
```

## Proposed safe repair strategy

```json
{
  "phase": 3,
  "note": "Manual approval required — adjust purchase header total via approved migration only",
  "erpTotal": 0,
  "targetTotal": 67514347.4,
  "delta": -67514347.4
}
```

**Do not update purchase total automatically.**