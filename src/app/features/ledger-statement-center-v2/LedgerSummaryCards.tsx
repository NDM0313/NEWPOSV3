import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import type { LedgerStatementV2Summary, LedgerStatementV2Type } from './types';

interface CardDef {
  label: string;
  value: number;
}

function cardsForType(type: LedgerStatementV2Type, s: LedgerStatementV2Summary): CardDef[] {
  if (type === 'customer') {
    return [
      { label: 'Opening balance', value: s.openingBalance },
      { label: 'Total sales', value: s.totalSales ?? 0 },
      { label: 'Sales returns', value: s.totalSalesReturn ?? 0 },
      { label: 'Payments received', value: s.totalPaymentsReceived ?? 0 },
      { label: 'Rental charges', value: s.totalRentalCharges ?? 0 },
      { label: 'Rental payments', value: s.totalRentalPayments ?? 0 },
      { label: 'Net debit', value: s.totalDebit },
      { label: 'Net credit', value: s.totalCredit },
      { label: 'Closing balance', value: s.closingBalance },
    ];
  }
  if (type === 'supplier') {
    return [
      { label: 'Opening balance', value: s.openingBalance },
      { label: 'Total purchases', value: s.totalPurchases ?? 0 },
      { label: 'Purchase returns', value: s.totalPurchaseReturns ?? 0 },
      { label: 'Payments paid', value: s.totalPaymentsPaid ?? 0 },
      { label: 'Net debit', value: s.totalDebit },
      { label: 'Net credit', value: s.totalCredit },
      { label: 'Closing balance', value: s.closingBalance },
    ];
  }
  if (type === 'worker') {
    return [
      { label: 'Opening balance', value: s.openingBalance },
      { label: 'Work charges', value: s.totalWorkCharges ?? 0 },
      { label: 'Payments paid', value: s.totalPaymentsPaid ?? 0 },
      { label: 'Adjustments', value: s.totalAdjustments ?? 0 },
      { label: 'Closing balance', value: s.closingBalance },
    ];
  }
  return [
    { label: 'Opening balance', value: s.openingBalance },
    { label: 'Total debit', value: s.totalDebit },
    { label: 'Total credit', value: s.totalCredit },
    { label: 'Net movement', value: s.netMovement ?? s.totalDebit - s.totalCredit },
    { label: 'Closing balance', value: s.closingBalance },
  ];
}

export function LedgerSummaryCards({
  statementType,
  summary,
}: {
  statementType: LedgerStatementV2Type;
  summary: LedgerStatementV2Summary | null;
}) {
  const { formatCurrency } = useFormatCurrency();
  if (!summary) return null;
  const cards = cardsForType(statementType, summary);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-gray-800 bg-[#0F1419] px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{c.label}</p>
          <p className="text-base font-semibold text-white tabular-nums mt-1">{formatCurrency(c.value)}</p>
        </div>
      ))}
    </div>
  );
}
