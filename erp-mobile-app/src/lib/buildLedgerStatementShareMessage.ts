export interface LedgerStatementShareInput {
  businessName: string;
  reportTitle: string;
  partyLabel: string;
  periodLabel: string;
  branchScopeLabel?: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  formatCurrency: (n: number) => string;
  generatedAt?: string;
}

/** Multi-line WhatsApp / share text for a full ledger statement. */
export function buildLedgerStatementShareMessage(input: LedgerStatementShareInput): string {
  const lines = [
    input.businessName,
    '',
    input.reportTitle,
    `Party/Account: ${input.partyLabel}`,
    `Period: ${input.periodLabel}`,
    `Scope: ${input.branchScopeLabel ?? 'All branches (GL scope)'}`,
    '',
    `Opening balance: ${input.formatCurrency(input.openingBalance)}`,
    `Total debit: ${input.formatCurrency(input.totalDebit)}`,
    `Total credit: ${input.formatCurrency(input.totalCredit)}`,
    `Closing balance: ${input.formatCurrency(input.closingBalance)}`,
  ];
  if (input.generatedAt) {
    lines.push('', `Generated: ${input.generatedAt}`);
  }
  lines.push('', 'Shared from mobile ERP');
  return lines.join('\n');
}
