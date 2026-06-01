# Numbering Phase B — Branch Code Embed (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Web ERP numbering engine + Settings UI. Mobile `document_sequences_global` path is scope se bahar.

## Maqsad

Jab **Branch Based** aur **Branch Code** dono ON hon, naye document numbers branch code ke sath allocate hon — format **`CR-SL-0001`** (branch code + prefix + padded number). Year reset ON par: **`CR-SL-26-0001`**.

## Database

**Migration:** [`migrations/20260525120000_numbering_include_branch_code.sql`](../migrations/20260525120000_numbering_include_branch_code.sql)

- Naya column: `erp_document_sequences.include_branch_code` (default `false`)
- `generate_document_number` update:
  - Sentinel rule row se `year_reset`, `branch_based`, `include_branch_code` read
  - Sequence key: branch_based → per-branch counter; warna company sentinel
  - Return: `branches.code` prepend jab dono flags ON aur valid code maujood ho
  - Khali/invalid branch code → prefix embed skip (sirf `SL-0001`)

**Deploy:** Supabase par migration apply karein **pehle** UI test se.

```bash
# VPS / Supabase CLI — apne workflow ke mutabiq
psql "$DATABASE_URL" -f migrations/20260525120000_numbering_include_branch_code.sql
```

## Settings UI

**File:** [`NumberingRulesTable.tsx`](../src/app/components/settings/NumberingRulesTable.tsx)

- Naya column **Branch Code** — sirf tab enable jab Branch Based ON ho
- Preview live: selected branch ka code + next number
- Save Rules → `settingsService.setErpDocumentSequence(..., includeBranchCode)`

**API:** [`settingsService.ts`](../src/app/services/settingsService.ts) — get/set `include_branch_code`

## Format examples

| Branch Based | Branch Code | Year Reset | Example |
|---|---|---|---|
| OFF | — | OFF | `SL-0042` |
| ON | OFF | OFF | `SL-0042` (alag counter per branch) |
| ON | ON | OFF | `CR-SL-0042` |
| ON | ON | ON | `CR-SL-26-0042` |

Branch code source: **Settings → General → Branches** → Branch Code field.

## Clients

- **Web:** [`documentNumberService.ts`](../src/app/services/documentNumberService.ts) — koi signature change nahi; RPC naya format return karta hai jab caller `p_branch_id` pass kare
- **Mobile:** [`erp-mobile-app/src/api/documentNumber.ts`](../erp-mobile-app/src/api/documentNumber.ts) — ab bhi global sequence; alag alignment task baad mein

## Manual smoke

1. Migration apply
2. Settings → Numbering — SALE → Branch Based ON → Branch Code ON → Save
3. Preview branch "College Road (CR)" → `CR-SL-00XX`
4. Us branch se nayi web sale → invoice `CR-SL-...`
5. Branch Code OFF → wapas `SL-...` (bina branch prefix)

## Rollback

1. Settings mein Branch Code toggles OFF + Save
2. Agar zaroorat ho to migration revert branch: purana `generate_document_number` body restore (20260516120000 se) — **production par careful**

Purane issued numbers change nahi hote; sirf naye allocations affect hote hain.
