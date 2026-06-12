/**
 * GL Correction Draft — targeted orphan AR reversal defect (JE-0161 / HQ-SL-0003 class).
 * Dry-run preview only; apply requires a reviewed RPC migration.
 */

import { computeDryRunHash } from '@/app/lib/developerRepairHash';

export const GL_CORRECTION_CONFIRM_PHRASE = 'APPLY GL CORRECTION';

export interface OrphanArReversalDefectInput {
  defectId: string;
  saleInvoiceNo: string;
  saleJeNo: string;
  reversalJeNo: string;
  partyArAccountCode: string;
  wrongCreditAccountCode: string;
  orphanAmount: number;
  saleStatus?: string | null;
  rawGlPartyBalanceBefore?: number;
  normalStatementBalanceBefore?: number;
}

export interface GlCorrectionLinePreview {
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
}

export interface GlCorrectionDraftDryRun {
  ok: boolean;
  defectId: string;
  title: string;
  riskLevel: 'high';
  blockedApplyReason: string;
  originalWrongRows: Array<{ entryNo: string; accountCode: string; debit: number; credit: number; note: string }>;
  expectedCorrectionLines: GlCorrectionLinePreview[];
  newCorrectionJePreview: {
    referenceType: 'gl_correction';
    description: string;
    lines: GlCorrectionLinePreview[];
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
  };
  balances: {
    rawGlPartyBefore: number;
    rawGlPartyAfter: number;
    normalStatementBefore: number;
    normalStatementAfter: number;
    auditImpact: string;
  };
  dryRunHash: string;
  before: Record<string, unknown>;
  afterPreview: Record<string, unknown>;
}

/** Detect JE-0161-class defect: sale Dr on party AR, reversal Cr on control not party AR. */
export function isOrphanArReversalDefect(input: {
  saleJePartyArDebit?: number;
  reversalJePartyArCredit?: number;
  reversalJeWrongAccountCredit?: number;
  wrongAccountCode?: string;
  partyArAccountCode?: string;
}): boolean {
  const orphan = Number(input.saleJePartyArDebit ?? 0);
  const partyCredit = Number(input.reversalJePartyArCredit ?? 0);
  const wrongCredit = Number(input.reversalJeWrongAccountCredit ?? 0);
  if (orphan <= 0) return false;
  if (Math.abs(partyCredit - orphan) < 0.01) return false;
  if (wrongCredit <= 0) return false;
  const wrong = String(input.wrongAccountCode ?? '').trim();
  const party = String(input.partyArAccountCode ?? '').trim();
  if (!wrong || !party || wrong === party) return false;
  return Math.abs(wrongCredit - orphan) < 0.01;
}

export function buildGlCorrectionDraftDryRun(input: OrphanArReversalDefectInput): GlCorrectionDraftDryRun {
  const amt = Math.abs(Number(input.orphanAmount) || 0);
  const party = input.partyArAccountCode;
  const wrong = input.wrongCreditAccountCode;
  const rawBefore = input.rawGlPartyBalanceBefore ?? amt;
  const normalBefore = input.normalStatementBalanceBefore ?? 0;

  const originalWrongRows = [
    {
      entryNo: input.saleJeNo,
      accountCode: party,
      debit: amt,
      credit: 0,
      note: `Original sale Dr on ${party} — remains unchanged`,
    },
    {
      entryNo: input.reversalJeNo,
      accountCode: wrong,
      debit: 0,
      credit: amt,
      note: `Reversal credited ${wrong} instead of ${party} — remains unchanged`,
    },
  ];

  const correctionLines: GlCorrectionLinePreview[] = [
    {
      accountCode: wrong,
      debit: amt,
      credit: 0,
      description: `Clear erroneous reversal credit on ${wrong} (${input.saleInvoiceNo})`,
    },
    {
      accountCode: party,
      debit: 0,
      credit: amt,
      description: `Clear orphan Dr on ${party} from ${input.saleInvoiceNo} cancel mismatch`,
    },
  ];

  const totalDebit = correctionLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = correctionLines.reduce((s, l) => s + l.credit, 0);

  const before = {
    defectId: input.defectId,
    saleInvoiceNo: input.saleInvoiceNo,
    saleJeNo: input.saleJeNo,
    reversalJeNo: input.reversalJeNo,
    orphanAmount: amt,
    rawGlPartyBalance: rawBefore,
    normalStatementBalance: normalBefore,
    originalWrongRows,
  };

  const afterPreview = {
    ...before,
    rawGlPartyBalance: rawBefore - amt,
    normalStatementBalance: normalBefore,
    newCorrectionJe: {
      referenceType: 'gl_correction',
      lines: correctionLines,
      totalDebit,
      totalCredit,
    },
    note: 'New correction JE only — JE-0160, JE-0161, JE-0168 rows are never edited or deleted',
  };

  const dryRunHash = computeDryRunHash({ actionId: 'gl.create_correction_draft', before, afterPreview });

  return {
    ok: true,
    defectId: input.defectId,
    title: `GL correction draft — ${input.saleInvoiceNo} orphan ${party}`,
    riskLevel: 'high',
    blockedApplyReason:
      'Apply requires migration RPC create_gl_correction_journal (additive JE insert + audit). Dry-run preview only until approved.',
    originalWrongRows,
    expectedCorrectionLines: correctionLines,
    newCorrectionJePreview: {
      referenceType: 'gl_correction',
      description: `Correction: ${input.reversalJeNo} credited ${wrong} not ${party} for cancelled ${input.saleInvoiceNo}`,
      lines: correctionLines,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
    balances: {
      rawGlPartyBefore: rawBefore,
      rawGlPartyAfter: rawBefore - amt,
      normalStatementBefore: normalBefore,
      normalStatementAfter: normalBefore,
      auditImpact: 'New correction JE visible in audit mode; normal statement unchanged when sale is cancelled',
    },
    dryRunHash,
    before,
    afterPreview,
  };
}

/** Known production defect — HQ-SL-0003 / JE-0160 + JE-0161. */
export const KNOWN_ORPHAN_AR_DEFECTS: OrphanArReversalDefectInput[] = [
  {
    defectId: 'hq-sl-0003-orphan-ar',
    saleInvoiceNo: 'HQ-SL-0003',
    saleJeNo: 'JE-0160',
    reversalJeNo: 'JE-0161',
    partyArAccountCode: 'AR-CUS0000',
    wrongCreditAccountCode: '1100',
    orphanAmount: 150,
    saleStatus: 'cancelled',
    rawGlPartyBalanceBefore: 151,
    normalStatementBalanceBefore: 0,
  },
];

export function knownOrphanDefectById(defectId: string): OrphanArReversalDefectInput | undefined {
  return KNOWN_ORPHAN_AR_DEFECTS.find((d) => d.defectId === defectId);
}
