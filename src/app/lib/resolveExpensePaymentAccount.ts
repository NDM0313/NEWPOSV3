import { supabase } from '@/lib/supabase';
import { formatPaymentAccountLabel, type PaymentAccountRef } from '@/app/lib/paymentAccountDisplay';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';

export { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';

export interface ResolvedExpensePaymentAccount {
  accountId: string | null;
  account: PaymentAccountRef | null;
  display: string;
  source: 'payment' | 'je_credit' | 'expense_row' | 'enum';
}

function resolveDisplay(
  account: PaymentAccountRef | null,
  accountId: string | null,
  paymentMethod: string | null | undefined,
  source: ResolvedExpensePaymentAccount['source'],
): ResolvedExpensePaymentAccount {
  return {
    accountId,
    account,
    display: formatPaymentAccountLabel({ paymentAccount: account, paymentMethod }),
    source,
  };
}

type ExpenseRowLike = {
  id?: string;
  payment_account_id?: string | null;
  payment_method?: string | null;
  payment_account?: PaymentAccountRef | null;
  posted_payment_account?: PaymentAccountRef | null;
  posted_payment_account_id?: string | null;
};

/** Batch-resolve posted liquidity account for expense list/detail rows. */
export async function enrichExpenseRowsWithPostedPaymentAccount(
  rows: ExpenseRowLike[],
  companyId?: string,
): Promise<void> {
  const expenseIds = [...new Set(rows.map((r) => r.id).filter(Boolean))] as string[];
  if (expenseIds.length === 0) return;

  const resolvedByExpenseId = new Map<string, ResolvedExpensePaymentAccount>();

  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_id, payment_account_id, payment_method, created_at')
    .eq('reference_type', 'expense')
    .in('reference_id', expenseIds)
    .is('voided_at', null)
    .order('created_at', { ascending: false });

  const paymentAccountIds = new Set<string>();
  const paymentByExpense = new Map<string, { payment_account_id: string | null; payment_method: string | null }>();
  for (const p of payments || []) {
    const eid = String((p as { reference_id?: string }).reference_id || '');
    if (!eid || paymentByExpense.has(eid)) continue;
    const payAcctId = (p as { payment_account_id?: string | null }).payment_account_id ?? null;
    paymentByExpense.set(eid, {
      payment_account_id: payAcctId,
      payment_method: (p as { payment_method?: string | null }).payment_method ?? null,
    });
    if (payAcctId) paymentAccountIds.add(payAcctId);
  }

  const missingForJe = expenseIds.filter((id) => !paymentByExpense.has(id));
  const jeCreditByExpense = new Map<string, string>();
  if (missingForJe.length > 0) {
    let jeQuery = supabase
      .from('journal_entries')
      .select('id, reference_id, created_at')
      .eq('reference_type', 'expense')
      .in('reference_id', missingForJe)
      .or('is_void.is.null,is_void.eq.false')
      .order('created_at', { ascending: false });
    if (companyId) jeQuery = jeQuery.eq('company_id', companyId);
    const { data: jes } = await jeQuery;

    const latestJeByExpense = new Map<string, string>();
    for (const je of jes || []) {
      const refId = String((je as { reference_id?: string }).reference_id || '');
      const jeId = String((je as { id?: string }).id || '');
      if (refId && jeId && !latestJeByExpense.has(refId)) latestJeByExpense.set(refId, jeId);
    }

    const jeIds = [...latestJeByExpense.values()];
    if (jeIds.length > 0) {
      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select('journal_entry_id, account_id, credit, accounts(id, code, name, type)')
        .in('journal_entry_id', jeIds)
        .gt('credit', 0);

      const creditLinesByJe = new Map<string, Array<{ account_id: string; accounts?: PaymentAccountRef | PaymentAccountRef[] | null }>>();
      for (const line of lines || []) {
        const jeId = String((line as { journal_entry_id?: string }).journal_entry_id || '');
        if (!jeId) continue;
        const bucket = creditLinesByJe.get(jeId) || [];
        bucket.push(line as { account_id: string; accounts?: PaymentAccountRef | PaymentAccountRef[] | null });
        creditLinesByJe.set(jeId, bucket);
      }

      latestJeByExpense.forEach((jeId, expenseId) => {
        const creditLines = creditLinesByJe.get(jeId) || [];
        for (const line of creditLines) {
          const rawAcc = line.accounts;
          const acc = Array.isArray(rawAcc) ? rawAcc[0] : rawAcc;
          if (acc && isLiquidityPaymentAccount(acc)) {
            jeCreditByExpense.set(expenseId, line.account_id);
            paymentAccountIds.add(line.account_id);
            break;
          }
        }
      });
    }
  }

  for (const row of rows) {
    const expenseId = row.id;
    if (!expenseId) continue;
    const payMethod = row.payment_method ?? null;

    const fromPayment = paymentByExpense.get(expenseId);
    if (fromPayment?.payment_account_id) {
      resolvedByExpenseId.set(
        expenseId,
        resolveDisplay(null, fromPayment.payment_account_id, fromPayment.payment_method ?? payMethod, 'payment'),
      );
      continue;
    }

    const fromJe = jeCreditByExpense.get(expenseId);
    if (fromJe) {
      resolvedByExpenseId.set(expenseId, resolveDisplay(null, fromJe, payMethod, 'je_credit'));
      continue;
    }

    const rowAcc = row.payment_account ?? null;
    if (row.payment_account_id && isLiquidityPaymentAccount(rowAcc)) {
      resolvedByExpenseId.set(
        expenseId,
        resolveDisplay(rowAcc, row.payment_account_id, payMethod, 'expense_row'),
      );
    }
  }

  const orphanIds = [...paymentAccountIds].filter(
    (id) => ![...resolvedByExpenseId.values()].some((r) => r.account?.name && r.accountId === id),
  );
  const accountById = new Map<string, PaymentAccountRef>();
  if (orphanIds.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .in('id', orphanIds);
    (accounts || []).forEach((a: PaymentAccountRef & { id: string }) => {
      if (a?.id) accountById.set(a.id, { code: a.code, name: a.name, type: a.type });
    });
  }

  resolvedByExpenseId.forEach((res, eid) => {
    if (res.accountId && !res.account?.name) {
      const acc = accountById.get(res.accountId);
      if (acc) {
        resolvedByExpenseId.set(
          eid,
          resolveDisplay(acc, res.accountId, rows.find((r) => r.id === eid)?.payment_method ?? null, res.source),
        );
      }
    }
  });

  rows.forEach((row) => {
    if (!row.id) return;
    const resolved = resolvedByExpenseId.get(row.id);
    if (resolved?.accountId && resolved.account) {
      (row as ExpenseRowLike).posted_payment_account_id = resolved.accountId;
      (row as ExpenseRowLike).posted_payment_account = resolved.account;
      (row as ExpenseRowLike).posted_payment_display = resolved.display;
    } else if (resolved) {
      (row as ExpenseRowLike).posted_payment_display = resolved.display;
    }
  });
}

export function postedPaymentDisplayFromRow(row: ExpenseRowLike & { posted_payment_display?: string }): string {
  if (row.posted_payment_display) return row.posted_payment_display;
  const acc = row.posted_payment_account ?? row.payment_account;
  const accId = row.posted_payment_account_id ?? row.payment_account_id;
  if (accId && acc && isLiquidityPaymentAccount(acc)) {
    return formatPaymentAccountLabel({ paymentAccount: acc, paymentMethod: row.payment_method });
  }
  if (acc && isLiquidityPaymentAccount(acc)) {
    return formatPaymentAccountLabel({ paymentAccount: acc, paymentMethod: row.payment_method });
  }
  return formatPaymentAccountLabel({ paymentAccount: null, paymentMethod: row.payment_method });
}

export function postedPaymentAccountIdFromRow(row: ExpenseRowLike): string | undefined {
  if (row.posted_payment_account_id) return row.posted_payment_account_id;
  const acc = row.posted_payment_account ?? row.payment_account;
  if (row.payment_account_id && isLiquidityPaymentAccount(acc)) return row.payment_account_id;
  return undefined;
}
