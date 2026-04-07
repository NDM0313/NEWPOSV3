/** Single event so AccountingContext, statements, party maps, and related UIs stay in sync after any JE write path. */
export function notifyAccountingEntriesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
}
