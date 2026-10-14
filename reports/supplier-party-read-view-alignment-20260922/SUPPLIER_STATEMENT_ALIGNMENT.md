# Supplier Statement Alignment

Canonical module: `src/app/lib/supplierBusinessGl.ts`

| Surface | Wiring |
|---------|--------|
| Standard (Ledger Statement Center V2) | Default **Business History** for all suppliers; toggle **Official AP** (2000 subtree loader unchanged) |
| Advanced (`AccountLedgerReportPage`) | Same Business History / Official AP toggle (generalized from ARIF pilot) |

Rules:

- Opening-safe: attributed read omits `startDate`; wrapper splits opening vs period
- Deduplicate by `journal_line_id`
- Filter components: `ap_2000` + `legacy_2090` (incl. 210xxx / 2090 / AP-* / 2000)
- Never name-only matching
- Role gate: workers/couriers rejected via `isSupplierBusinessContactType`
- Official AP tab = prior AP-2000 supplier statement (may be empty for legacy-only parties)

ARIF golden: 24 rows, Source Account `210017`, closing 39,937.
