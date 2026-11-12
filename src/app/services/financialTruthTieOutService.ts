/**
 * Financial Truth Tie-out — read-only company-wide reconciliation aggregation.
 */

import { accountingReportsService } from '@/app/services/accountingReportsService';
import {
  fetchIntegrityLabSummary,
  fetchUnmappedJournalLines,
  fetchUnpostedDocuments,
  type IntegrityLabSummary,
} from '@/app/services/arApReconciliationCenterService';
import { fetchArCusSubledgerSum } from '@/app/services/financialTraceCenterService';
import { fetchPartyGlLinesForEffectiveVariance } from '@/app/services/arApEffectiveVarianceService';
import { sumAuditOnlyPartyGlNet } from '@/app/lib/arApEffectiveVariance';
import {
  buildStandardTieOutDifferences,
  roundMoney,
  trialBalanceBalanced,
  type TieOutDifferenceRow,
} from '@/app/lib/financialTruthTieOut';
import { getCashFlowReport } from '@/app/services/cashFlowReportService';

export interface FinancialTruthTieOutResult {
  asOfDate: string;
  periodStart: string;
  branchId: string | null;
  trialBalance: {
    totalDebit: number;
    totalCredit: number;
    difference: number;
    balanced: boolean;
  };
  balanceSheet: {
    totalAssets: number;
    totalLiabilitiesAndEquity: number;
    difference: number;
    tbImbalance: number;
  };
  profitAndLoss: {
    netProfit: number;
    startDate: string;
    endDate: string;
  };
  ar: {
    controlGl: number | null;
    subledgerRawSum: number | null;
    subledgerEffectiveSum: number | null;
    operationalReceivables: number;
    auditOnlyAdjustment: number;
  };
  ap: {
    controlGl: number | null;
    auditOnlyAdjustment: number;
    operationalPayables: number;
  };
  cash: {
    glNetOfficial: number | null;
    operationalClosing: number | null;
  };
  integritySummary: IntegrityLabSummary | null;
  differences: TieOutDifferenceRow[];
}

function monthStart(isoDate: string): string {
  const d = isoDate.slice(0, 10);
  return `${d.slice(0, 7)}-01`;
}

export async function fetchFinancialTruthTieOut(
  companyId: string,
  branchId?: string | null,
  asOfDate?: string
): Promise<FinancialTruthTieOutResult | null> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const start = monthStart(end);
  const branch = branchId && branchId !== 'all' ? branchId : undefined;

  const [tb, bs, pl, summary, arCusRaw, arLines, apLines, unmapped, unposted, cashReport, glCashOfficial] =
    await Promise.all([
      accountingReportsService.getTrialBalance(companyId, '1900-01-01', end, branch),
      accountingReportsService.getBalanceSheet(companyId, end, branch),
      accountingReportsService.getProfitLoss(companyId, start, end, branch),
      fetchIntegrityLabSummary(companyId, branchId ?? null, end),
      fetchArCusSubledgerSum(companyId, end, branch),
      fetchPartyGlLinesForEffectiveVariance(companyId, 'AR', end),
      fetchPartyGlLinesForEffectiveVariance(companyId, 'AP', end),
      fetchUnmappedJournalLines(companyId, branchId ?? null, end, 200),
      fetchUnpostedDocuments(companyId, branchId ?? null, end, 200),
      getCashFlowReport({
        companyId,
        branchId: branchId ?? null,
        dateFrom: start,
        dateTo: end,
        auditMode: false,
      }).catch(() => null),
      accountingReportsService.getCashFlowStatement(companyId, start, end, branch, {
        basis: 'official_gl',
      }),
    ]);

  const auditOnlyArNet = roundMoney(sumAuditOnlyPartyGlNet(arLines));
  const auditOnlyApNet = roundMoney(sumAuditOnlyPartyGlNet(apLines));
  const arCusEffective =
    arCusRaw != null ? roundMoney(arCusRaw - auditOnlyArNet) : null;

  const snap = await accountingReportsService.getArApGlSnapshot(companyId, end, branch);
  const cashGlNet = snap.cashBankNetDrMinusCr ?? null;
  const operationalClosing = cashReport?.summary?.closing ?? null;

  const differences = buildStandardTieOutDifferences({
    tbDifference: tb.difference,
    bsDifference: bs.difference,
    arControlGl: summary?.gl_ar_net_dr_minus_cr ?? snap.ar?.balance ?? null,
    arSubledgerRaw: arCusRaw,
    arSubledgerEffective: arCusEffective,
    operationalReceivables: summary?.operational_receivables_full ?? 0,
    effectiveVarianceReceivables: summary?.effective_variance_receivables ?? null,
    auditOnlyArNet,
    apControlGl: summary?.gl_ap_net_credit ?? snap.apNetCredit ?? null,
    apSubledgerRaw: null,
    operationalPayables: summary?.operational_payables_full ?? 0,
    effectiveVariancePayables: summary?.effective_variance_payables ?? null,
    auditOnlyApNet,
    cashGlNet: glCashOfficial?.netChange ?? cashGlNet,
    cashOperationalClosing: operationalClosing,
    hasUnmappedRows: unmapped.length > 0,
    hasUnpostedDocs: unposted.length > 0,
  });

  return {
    asOfDate: end,
    periodStart: start,
    branchId: branchId ?? null,
    trialBalance: {
      totalDebit: tb.totalDebit,
      totalCredit: tb.totalCredit,
      difference: tb.difference,
      balanced: trialBalanceBalanced(tb.totalDebit, tb.totalCredit),
    },
    balanceSheet: {
      totalAssets: bs.totalAssets,
      totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
      difference: bs.difference,
      tbImbalance: bs.tbImbalance,
    },
    profitAndLoss: {
      netProfit: pl.netProfit,
      startDate: pl.startDate,
      endDate: pl.endDate,
    },
    ar: {
      controlGl: summary?.gl_ar_net_dr_minus_cr ?? null,
      subledgerRawSum: arCusRaw,
      subledgerEffectiveSum: arCusEffective,
      operationalReceivables: summary?.operational_receivables_full ?? 0,
      auditOnlyAdjustment: auditOnlyArNet,
    },
    ap: {
      controlGl: summary?.gl_ap_net_credit ?? null,
      auditOnlyAdjustment: auditOnlyApNet,
      operationalPayables: summary?.operational_payables_full ?? 0,
    },
    cash: {
      glNetOfficial: glCashOfficial?.netChange ?? cashGlNet,
      operationalClosing: operationalClosing,
    },
    integritySummary: summary,
    differences,
  };
}
