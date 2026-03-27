import type { ControlAccountBreakdownResult } from '@/app/services/controlAccountBreakdownService';

/** COA row → GL control bucket for breakdown + actions (code first, then name). */
export function getControlAccountKind(account: {
  name?: string;
  code?: string;
}): ControlAccountBreakdownResult['controlKind'] | null {
  const c = String(account.code || '').trim();
  if (c === '1100') return 'ar';
  if (c === '2000') return 'ap';
  if (c === '2010') return 'worker_payable';
  if (c === '1180') return 'worker_advance';
  if (c === '1195') return 'suspense';
  const n = (account.name || '').trim().toLowerCase();
  if (n === 'accounts receivable' || (n.includes('receivable') && c.startsWith('11'))) return 'ar';
  if (n === 'accounts payable') return 'ap';
  if (n.includes('worker payable')) return 'worker_payable';
  if (n.includes('worker advance')) return 'worker_advance';
  if (n.includes('suspense') || n.includes('reconciliation suspense')) return 'suspense';
  return null;
}
