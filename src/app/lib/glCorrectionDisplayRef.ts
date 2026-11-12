import { knownOrphanDefectById } from '@/app/lib/glCorrectionDraftRepair';
import {
  type AccountingUiRef,
  buildTechnicalRef,
  formatJournalEntryBadge,
  getSaleDisplayNumber,
} from '@/app/lib/accountingDisplayReference';

export type GlCorrectionJeMeta = {
  id: string;
  entry_no: string | null;
  reference_type: string | null;
  reference_id: string | null;
  action_fingerprint?: string | null;
  description?: string | null;
};

export type SourceJeMeta = {
  id: string;
  entry_no: string | null;
  reference_type: string | null;
  reference_id: string | null;
};

export function resolveGlCorrectionDisplayRef(
  j: GlCorrectionJeMeta,
  ctx: {
    sales: Map<string, Record<string, unknown>>;
    sourceJournals: Map<string, SourceJeMeta>;
    rentals: Map<string, { booking_no?: string | null }>;
  }
): AccountingUiRef {
  const technicalRef = buildTechnicalRef(j.reference_type, j.reference_id, j.id);
  const entryNoBadge = formatJournalEntryBadge(j.entry_no, j.id);
  const fp = String(j.action_fingerprint || '').toLowerCase().trim();
  const desc = String(j.description || '').trim();

  if (fp.includes('hq-sl-0003-orphan-ar')) {
    const defect = knownOrphanDefectById('hq-sl-0003-orphan-ar');
    const invoice = defect?.saleInvoiceNo || 'HQ-SL-0003';
    return {
      displayRef: `GL correction · ${invoice}`,
      technicalRef,
      sourceLabel: 'GL correction',
      entryNoBadge,
      documentResolved: true,
    };
  }

  if (fp.includes('rental-1100-leakage:')) {
    const rid = String(j.reference_id || '').trim();
    const sourceJe = rid ? ctx.sourceJournals.get(rid) : undefined;
    const sourceEntryNo = sourceJe?.entry_no ? String(sourceJe.entry_no).trim() : '';
    let rentalLabel = '';
    if (sourceJe?.reference_type === 'rental' && sourceJe.reference_id) {
      const rental = ctx.rentals.get(String(sourceJe.reference_id));
      rentalLabel = String(rental?.booking_no || '').trim();
    }
    const bits = ['GL correction', sourceEntryNo ? `fixes ${sourceEntryNo}` : '', rentalLabel].filter(Boolean);
    const displayRef = bits.join(' · ') || desc.slice(0, 60) || entryNoBadge;
    return {
      displayRef,
      technicalRef,
      sourceLabel: 'GL correction',
      entryNoBadge,
      documentResolved: Boolean(sourceEntryNo || rentalLabel || desc),
    };
  }

  const rid = String(j.reference_id || '').trim();
  if (rid) {
    const sale = ctx.sales.get(rid);
    if (sale) {
      const disp = getSaleDisplayNumber(sale as Parameters<typeof getSaleDisplayNumber>[0]);
      if (disp) {
        return {
          displayRef: `GL correction · ${disp}`,
          technicalRef,
          sourceLabel: 'GL correction',
          entryNoBadge,
          documentResolved: true,
        };
      }
    }
    const sourceJe = ctx.sourceJournals.get(rid);
    if (sourceJe?.entry_no) {
      return {
        displayRef: `GL correction · fixes ${String(sourceJe.entry_no).trim()}`,
        technicalRef,
        sourceLabel: 'GL correction',
        entryNoBadge,
        documentResolved: true,
      };
    }
  }

  if (desc) {
    return {
      displayRef: desc.length > 72 ? `${desc.slice(0, 69)}…` : desc,
      technicalRef,
      sourceLabel: 'GL correction',
      entryNoBadge,
      documentResolved: true,
    };
  }

  return {
    displayRef: entryNoBadge,
    technicalRef,
    sourceLabel: 'GL correction',
    entryNoBadge,
    documentResolved: false,
  };
}
