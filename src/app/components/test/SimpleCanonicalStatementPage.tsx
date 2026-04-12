'use client';

/**
 * Developer / safe fallback: one-source party statement (customer or supplier).
 * Operational vs GL vs Reconciliation are explicit — pick one engine at a time.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import { getSingleCustomerPartyReconciliation, getSingleSupplierPartyReconciliation } from '@/app/services/contactBalanceReconciliationService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

type PartyKind = 'customer' | 'supplier';
type SourceMode = 'operational' | 'gl_recon';

export default function SimpleCanonicalStatementPage() {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [kind, setKind] = useState<PartyKind>('customer');
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [contactId, setContactId] = useState<string>('');
  const [source, setSource] = useState<SourceMode>('operational');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [opRecv, setOpRecv] = useState<number | null>(null);
  const [opPay, setOpPay] = useState<number | null>(null);
  const [glRecv, setGlRecv] = useState<number | null>(null);
  const [glPay, setGlPay] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    openingBalance: number;
    totalInvoiceAmount: number;
    totalPaymentReceived: number;
    pendingAmount: number;
    closingBalance: number;
    totalInvoices: number;
  } | null>(null);

  const loadContacts = useCallback(async () => {
    if (!companyId) return;
    const rows = await contactService.getAllContacts(
      companyId,
      kind === 'customer' ? 'customer' : 'supplier'
    );
    setContacts((rows || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
  }, [companyId, kind]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const loadStatement = useCallback(async () => {
    if (!companyId || !contactId) return;
    setLoading(true);
    setErr(null);
    setInfo(null);
    try {
      const b = branchId === 'all' ? null : branchId;
      if (source === 'gl_recon') {
        if (kind === 'customer') {
          const r = await getSingleCustomerPartyReconciliation(companyId, contactId, b);
          setOpRecv(r.operationalReceivable);
          setOpPay(null);
          setGlRecv(r.glArReceivable);
          setGlPay(null);
        } else {
          const r = await getSingleSupplierPartyReconciliation(companyId, contactId, b);
          setOpRecv(null);
          setOpPay(r.operationalPayable);
          setGlRecv(null);
          setGlPay(r.glApPayable);
        }
        setSummary(null);
      } else {
        if (kind === 'supplier') {
          setSummary(null);
          setInfo('Operational summary for suppliers is not bundled in this preview — use GL / Reconciliation or the supplier statement.');
        } else {
          const s = await customerLedgerAPI.getLedgerSummary(contactId, companyId, '2000-01-01', '2099-12-31', {
            paymentScope: 'live',
          });
          setSummary({
            openingBalance: s.openingBalance,
            totalInvoiceAmount: s.totalInvoiceAmount,
            totalPaymentReceived: s.totalPaymentReceived,
            pendingAmount: s.pendingAmount,
            closingBalance: s.closingBalance,
            totalInvoices: s.totalInvoices,
          });
          setOpRecv(null);
          setOpPay(null);
          setGlRecv(null);
          setGlPay(null);
        }
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId, branchId, kind, source]);

  const title = useMemo(
    () => (kind === 'customer' ? 'Simple canonical — customer' : 'Simple canonical — supplier'),
    [kind]
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Pick one source: <strong className="text-gray-300">Operational</strong> uses customer ledger API summary
          (open docs). <strong className="text-gray-300">GL / Reconciliation</strong> uses the same RPC pair as Contacts
          reconciliation (party slice).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={kind === 'customer' ? 'default' : 'secondary'} onClick={() => setKind('customer')}>
          Customer
        </Button>
        <Button type="button" variant={kind === 'supplier' ? 'default' : 'secondary'} onClick={() => setKind('supplier')}>
          Supplier
        </Button>
        <Button
          type="button"
          variant={source === 'operational' ? 'default' : 'secondary'}
          onClick={() => setSource('operational')}
        >
          Operational summary
        </Button>
        <Button type="button" variant={source === 'gl_recon' ? 'default' : 'secondary'} onClick={() => setSource('gl_recon')}>
          GL / Reconciliation figures
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-gray-400">
          Contact
          <select
            className="ml-2 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">— Select —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => void loadStatement()} disabled={!contactId || loading}>
          {loading ? 'Loading…' : 'Load'}
        </Button>
      </div>

      {err && <div className="text-red-400 text-sm">{err}</div>}
      {info && <div className="text-amber-200/90 text-sm">{info}</div>}

      {source === 'operational' && summary && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle>Operational (customerLedgerAPI)</CardTitle>
            <CardDescription>Wide date range — same family as Contacts operational truth for AR/AP due logic.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Opening</div>
              <div className="tabular-nums">{formatCurrency(summary.openingBalance)}</div>
            </div>
            <div>
              <div className="text-gray-500">Invoice total</div>
              <div className="tabular-nums">{formatCurrency(summary.totalInvoiceAmount)}</div>
            </div>
            <div>
              <div className="text-gray-500">Receipts / payments in</div>
              <div className="tabular-nums">{formatCurrency(summary.totalPaymentReceived)}</div>
            </div>
            <div>
              <div className="text-gray-500">Pending</div>
              <div className="tabular-nums">{formatCurrency(summary.pendingAmount)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-500">Closing (operational)</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(summary.closingBalance)}</div>
            </div>
            <div>
              <div className="text-gray-500">Invoice count</div>
              <div>{summary.totalInvoices}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {source === 'gl_recon' && (opRecv !== null || opPay !== null || glRecv !== null || glPay !== null) && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle>GL / reconciliation</CardTitle>
            <CardDescription>Same `get_contact_party_gl_balances` slice as Contacts mini GL + Reconciliation tab.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {kind === 'customer' && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Operational receivable (RPC)</span>
                  <span className="tabular-nums">{formatCurrency(opRecv ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GL AR (party)</span>
                  <span className="tabular-nums text-violet-300">{formatCurrency(glRecv ?? 0)}</span>
                </div>
              </>
            )}
            {kind === 'supplier' && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Operational payable (RPC)</span>
                  <span className="tabular-nums">{formatCurrency(opPay ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GL AP (party)</span>
                  <span className="tabular-nums text-violet-300">{formatCurrency(glPay ?? 0)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
