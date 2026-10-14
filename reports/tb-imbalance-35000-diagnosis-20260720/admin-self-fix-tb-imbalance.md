# Admin self-fix — TB imbalance / unbalanced JE

**Audience:** company Admin / Owner (and Developer)  
**Scope:** `sale` + `sale_reversal` document journals only

## When this happens

Trial Balance shows **TB difference ≠ 0** (Dr ≠ Cr). Almost always one or more non-void JEs where line totals do not balance (e.g. sale edit missing COGS debit, cancel reversal missing Extra Service Income).

Single Core Engine does **not** auto-fix this — it only ensures one GL loader.

## How to fix (UI)

**Where Lab H lives:** Sidebar → **Accounting Integrity Lab** → last tab **H · Live TB repair**.  
It is **not** inside Accounting Developer Center or the AR/AP hub body — those pages only deep-link to Lab H.

1. Open Lab H via any of:
   - Sidebar → Accounting Integrity Lab → **H · Live TB repair**
   - AR/AP Diagnostics hub header → **Live TB repair (Lab H)**
   - Accounting Developer Center header → **Live TB repair**
   - Tie-out / Financial Truth → amber **TB difference** → **Open Live TB repair**
2. Click **Load detection** (auto-loads on open)
3. Confirm **Σ JE diffs** matches **TB difference** (±0.01)
4. Per row:
   - **Preview** → strategy `REBUILD_SALE` or `REBUILD_SALE_REVERSAL` + proposed action
   - **Fix** → confirm dialog → soft-void unbalanced JE + repost from document  
5. Or **Fix all auto-fixable** for every sale/sale_reversal row
6. Verify TB difference before → after is **0**

### Alternate surfaces

- Journal → open unbalanced JE → **Rebuild from sale** / **Rebuild sale reversal**
- AR/AP reverse-repost wizard → strategy includes rebuild sale reversal

## Safety

- Soft-void only (audit retained)
- Payments never touched
- Purchase / expense / manual JEs stay **MANUAL_REVIEW** (no auto Fix)
- Do **not** invent a suspense balancing JE
- Sync account balances ≠ TB fix

## After TB is 0

When Lab H shows **TB difference = 0** and **Unbalanced JEs = 0**, remaining cards are **not** JE rebuild work:

| Lab H metric | Meaning | Action |
|--------------|---------|--------|
| **Account mismatches** | Cached `accounts.balance` ≠ journal | Lab H → **Sync account balances from journal** |
| **AR vs receivables** | Document due vs AR journal | Separate investigation — sync button does **not** fix this. DIN BRIDAL −1,382,450 explained 2026-07-20 as openings/rentals in AR GL (see `lab-h-task-b-complete-20260720.md`) |

Office checklist for the 2026-07-20 DIN BRIDAL leftovers: [`office-handoff-lab-h-remaining-20260720.md`](./office-handoff-lab-h-remaining-20260720.md).

## Code entry points

| Piece | Path |
|-------|------|
| Classifier | `src/app/lib/unbalancedJeRepairClassifier.ts` |
| Preview / apply | `previewUnbalancedJeRepair` / `applyUnbalancedJeRepair` in `liveDataRepairService.ts` |
| Rebuild sale | `rebuildSaleDocumentAccounting` |
| Rebuild reversal | `rebuildSaleReversalAccounting` |
| Batch | `repairUnbalancedSaleRelatedJournals` |
| Lab H UI | `AccountingIntegrityTestLab.tsx` |
