import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ExternalLink, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { supabase } from '@/lib/supabase';
import CustomerLedgerPageOriginal from '@/app/components/customer-ledger-test/CustomerLedgerPageOriginal';
import { GenericLedgerView } from '@/app/components/accounting/GenericLedgerView';
import { ViewPurchaseDetailsDrawer } from '@/app/components/purchases/ViewPurchaseDetailsDrawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { getAttachmentOpenUrl } from '@/app/utils/paymentAttachmentUrl';
import { cn } from '@/app/components/ui/utils';

export type ProfileContact = {
  id?: number;
  uuid?: string;
  name: string;
  type?: string;
};

type PurchaseRow = {
  id: string;
  po_no: string | null;
  po_date: string | null;
  total: number | null;
  paid_amount: number | null;
  due_amount: number | null;
  status: string | null;
};

type PaymentRow = {
  id: string;
  reference_number: string | null;
  payment_date: string | null;
  amount: number | null;
  payment_method: string | null;
  reference_type: string | null;
  payment_type: string | null;
  voided_at: string | null;
  notes: string | null;
};

type StockRow = {
  id: string;
  created_at: string | null;
  movement_type: string | null;
  quantity: number | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  product?: { name?: string } | null;
};

type DocRow = {
  key: string;
  source: string;
  title: string;
  subtitle?: string;
  url: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeAttachments(raw: unknown): { url: string; name: string }[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    const u = raw.trim();
    return u ? [{ url: u, name: 'Attachment' }] : [];
  }
  if (Array.isArray(raw)) {
    return raw
      .map((x: any) => {
        if (!x) return null;
        if (typeof x === 'string') return { url: x, name: 'Attachment' };
        const url = String(x.url || x.path || '').trim();
        if (!url) return null;
        return { url, name: String(x.name || x.filename || 'File').trim() || 'Attachment' };
      })
      .filter(Boolean) as { url: string; name: string }[];
  }
  return [];
}

export const ContactProfileActivityTabs: React.FC<{ contact: ProfileContact }> = ({ contact }) => {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const contactId = String(contact.uuid || '').trim();
  const contactType = (contact.type || 'contact').toLowerCase();

  const [tab, setTab] = useState('ledger');

  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const [purchaseDrawerId, setPurchaseDrawerId] = useState<string | null>(null);

  const showPurchasesTab = contactType === 'supplier' || contactType === 'both';
  const showCustomerSide = contactType === 'customer' || contactType === 'both';

  const loadPurchases = useCallback(async () => {
    if (!companyId || !contactId || !showPurchasesTab) return;
    setPurchasesLoading(true);
    setPurchasesError(null);
    try {
      let q = supabase
        .from('purchases')
        .select('id, po_no, po_date, total, paid_amount, due_amount, status, supplier_id, branch_id')
        .eq('company_id', companyId)
        .eq('supplier_id', contactId)
        .order('po_date', { ascending: false })
        .limit(150);
      if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      setPurchases((data || []) as PurchaseRow[]);
    } catch (e: any) {
      setPurchasesError(e?.message || 'Failed to load purchases');
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, [companyId, contactId, showPurchasesTab, branchId]);

  const loadPayments = useCallback(async () => {
    if (!companyId || !contactId) return;
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      let q = supabase
        .from('payments')
        .select(
          'id, reference_number, payment_date, amount, payment_method, reference_type, payment_type, voided_at, notes, branch_id'
        )
        .eq('company_id', companyId)
        .eq('contact_id', contactId)
        .order('payment_date', { ascending: false })
        .limit(200);
      if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      setPayments((data || []) as PaymentRow[]);
    } catch (e: any) {
      setPaymentsError(e?.message || 'Failed to load payments');
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, [companyId, contactId, branchId]);

  const loadStockHistory = useCallback(async () => {
    if (!companyId || !contactId) return;
    setStockLoading(true);
    setStockError(null);
    try {
      const purchaseIds: string[] = [];
      const saleIds: string[] = [];
      if (showPurchasesTab) {
        let pq = supabase.from('purchases').select('id').eq('company_id', companyId).eq('supplier_id', contactId);
        if (branchId && branchId !== 'all') pq = pq.eq('branch_id', branchId);
        const { data: pr, error: pe } = await pq;
        if (pe) throw pe;
        (pr || []).forEach((r: any) => r?.id && purchaseIds.push(String(r.id)));
      }
      if (showCustomerSide) {
        let sq = supabase.from('sales').select('id').eq('company_id', companyId).eq('customer_id', contactId);
        if (branchId && branchId !== 'all') sq = sq.eq('branch_id', branchId);
        const { data: sr, error: se } = await sq;
        if (se) throw se;
        (sr || []).forEach((r: any) => r?.id && saleIds.push(String(r.id)));
      }
      if (purchaseIds.length === 0 && saleIds.length === 0) {
        setStockRows([]);
        return;
      }
      const byId = new Map<string, StockRow>();
      const select =
        'id, created_at, movement_type, quantity, reference_type, reference_id, notes, product:products(name)';
      for (const part of chunk(purchaseIds, 80)) {
        const { data: m1, error: e1 } = await supabase
          .from('stock_movements')
          .select(select)
          .eq('company_id', companyId)
          .eq('reference_type', 'purchase')
          .in('reference_id', part);
        if (e1) throw e1;
        (m1 || []).forEach((r: any) => byId.set(String(r.id), r as StockRow));
      }
      for (const part of chunk(saleIds, 80)) {
        const { data: m2, error: e2 } = await supabase
          .from('stock_movements')
          .select(select)
          .eq('company_id', companyId)
          .eq('reference_type', 'sale')
          .in('reference_id', part);
        if (e2) throw e2;
        (m2 || []).forEach((r: any) => byId.set(String(r.id), r as StockRow));
      }
      const movements = [...byId.values()].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      setStockRows(movements.slice(0, 250));
    } catch (e: any) {
      setStockError(e?.message || 'Failed to load stock history');
      setStockRows([]);
    } finally {
      setStockLoading(false);
    }
  }, [companyId, contactId, branchId, showPurchasesTab, showCustomerSide]);

  const loadDocuments = useCallback(async () => {
    if (!companyId || !contactId) return;
    setDocumentsLoading(true);
    setDocumentsError(null);
    const rows: DocRow[] = [];
    try {
      if (showPurchasesTab) {
        let pq = supabase
          .from('purchases')
          .select('id, po_no, po_date, attachments')
          .eq('company_id', companyId)
          .eq('supplier_id', contactId)
          .order('po_date', { ascending: false })
          .limit(80);
        if (branchId && branchId !== 'all') pq = pq.eq('branch_id', branchId);
        const { data: pr } = await pq;
        for (const p of pr || []) {
          const atts = normalizeAttachments((p as any).attachments);
          atts.forEach((a, i) => {
            rows.push({
              key: `p:${(p as any).id}:${i}`,
              source: 'Purchase',
              title: `${(p as any).po_no || 'PO'} — ${a.name}`,
              subtitle: (p as any).po_date ? String((p as any).po_date).slice(0, 10) : undefined,
              url: a.url,
            });
          });
        }
      }
      if (showCustomerSide) {
        let sq = supabase
          .from('sales')
          .select('id, invoice_no, invoice_date, attachments')
          .eq('company_id', companyId)
          .eq('customer_id', contactId)
          .order('invoice_date', { ascending: false })
          .limit(80);
        if (branchId && branchId !== 'all') sq = sq.eq('branch_id', branchId);
        const { data: sr } = await sq;
        for (const s of sr || []) {
          const atts = normalizeAttachments((s as any).attachments);
          atts.forEach((a, i) => {
            rows.push({
              key: `s:${(s as any).id}:${i}`,
              source: 'Sale',
              title: `${(s as any).invoice_no || 'Invoice'} — ${a.name}`,
              subtitle: (s as any).invoice_date ? String((s as any).invoice_date).slice(0, 10) : undefined,
              url: a.url,
            });
          });
        }
      }
      let payQ = supabase
        .from('payments')
        .select('id, reference_number, payment_date, attachments')
        .eq('company_id', companyId)
        .eq('contact_id', contactId)
        .order('payment_date', { ascending: false })
        .limit(100);
      if (branchId && branchId !== 'all') payQ = payQ.eq('branch_id', branchId);
      const { data: pays } = await payQ;
      for (const p of pays || []) {
        const atts = normalizeAttachments((p as any).attachments);
        atts.forEach((a, i) => {
          rows.push({
            key: `pay:${(p as any).id}:${i}`,
            source: 'Payment',
            title: `${(p as any).reference_number || 'Payment'} — ${a.name}`,
            subtitle: (p as any).payment_date ? String((p as any).payment_date).slice(0, 10) : undefined,
            url: a.url,
          });
        });
      }
      setDocuments(rows);
    } catch (e: any) {
      setDocumentsError(e?.message || 'Failed to load documents');
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  }, [companyId, contactId, branchId, showPurchasesTab, showCustomerSide]);

  useEffect(() => {
    if (tab === 'purchases' && showPurchasesTab) loadPurchases();
  }, [tab, showPurchasesTab, loadPurchases]);

  useEffect(() => {
    if (tab === 'payments') loadPayments();
  }, [tab, loadPayments]);

  useEffect(() => {
    if (tab === 'stock-history') loadStockHistory();
  }, [tab, loadStockHistory]);

  useEffect(() => {
    if (tab === 'documents') loadDocuments();
  }, [tab, loadDocuments]);

  const ledgerPanel = useMemo(() => {
    if (!contactId) {
      return <p className="text-center text-gray-500 py-8">Contact ID missing — cannot load ledger.</p>;
    }
    if (contactType === 'customer' || contactType === 'both') {
      return (
        <div className="min-h-[420px] max-h-[58vh] overflow-y-auto rounded-lg border border-gray-800 bg-[#0B0F19] p-3">
          <CustomerLedgerPageOriginal embedded initialCustomerId={contactId} />
        </div>
      );
    }
    if (contactType === 'supplier' || contactType === 'worker') {
      return (
        <div className="min-h-[420px] max-h-[58vh] overflow-y-auto rounded-lg border border-gray-800 bg-[#0B0F19] p-3">
          <GenericLedgerView
            ledgerType={contactType === 'supplier' ? 'supplier' : 'worker'}
            entityId={contactId}
            entityName={contact.name}
          />
        </div>
      );
    }
    return <p className="text-center text-gray-500 py-8">Ledger for this contact type is not configured.</p>;
  }, [contactId, contactType, contact.name]);

  return (
    <>
      <Tabs value={tab} onValueChange={setTab} className="w-full flex-1 flex flex-col min-h-0">
        <div className="border-b border-gray-800 shrink-0">
          <TabsList className="bg-transparent h-auto p-0 w-full justify-start overflow-x-auto flex-wrap gap-0">
            {[
              { id: 'ledger', label: 'Ledger' },
              { id: 'purchases', label: 'Purchases', hide: !showPurchasesTab },
              { id: 'stock-history', label: 'Stock History' },
              { id: 'documents', label: 'Documents' },
              { id: 'payments', label: 'Payments' },
            ]
              .filter((t) => !t.hide)
              .map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 text-gray-400 rounded-none px-4 py-3 text-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
          </TabsList>
        </div>

        <TabsContent value="ledger" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
          {ledgerPanel}
        </TabsContent>

        <TabsContent value="purchases" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
          {!showPurchasesTab ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              Purchases list applies to suppliers. This contact is not a supplier.
            </p>
          ) : purchasesLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : purchasesError ? (
            <p className="text-red-400 text-sm py-6">{purchasesError}</p>
          ) : purchases.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No purchase orders for this supplier.</p>
          ) : (
            <div className="max-h-[58vh] overflow-auto rounded-lg border border-gray-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">PO</TableHead>
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400 text-right">Total</TableHead>
                    <TableHead className="text-gray-400 text-right">Paid</TableHead>
                    <TableHead className="text-gray-400 text-right">Due</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id} className="border-gray-800">
                      <TableCell className="text-white font-mono text-sm">{p.po_no || '—'}</TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {p.po_date ? formatDate(p.po_date) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-gray-200">{formatCurrency(Number(p.total) || 0)}</TableCell>
                      <TableCell className="text-right text-gray-200">{formatCurrency(Number(p.paid_amount) || 0)}</TableCell>
                      <TableCell className="text-right text-gray-200">{formatCurrency(Number(p.due_amount) || 0)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">
                          {p.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300"
                          onClick={() => setPurchaseDrawerId(p.id)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stock-history" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
          {stockLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : stockError ? (
            <p className="text-red-400 text-sm py-6">{stockError}</p>
          ) : stockRows.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              No stock movements linked to this contact&apos;s sales or purchases (final documents with inventory
              posting).
            </p>
          ) : (
            <div className="max-h-[58vh] overflow-auto rounded-lg border border-gray-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">When</TableHead>
                    <TableHead className="text-gray-400">Product</TableHead>
                    <TableHead className="text-gray-400">Type</TableHead>
                    <TableHead className="text-gray-400">Ref</TableHead>
                    <TableHead className="text-gray-400 text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((m) => {
                    const qty = Number(m.quantity) || 0;
                    const inflow = qty > 0;
                    return (
                      <TableRow key={m.id} className="border-gray-800">
                        <TableCell className="text-gray-300 text-sm whitespace-nowrap">
                          {m.created_at ? formatDate(m.created_at) : '—'}
                        </TableCell>
                        <TableCell className="text-gray-200 text-sm max-w-[200px] truncate">
                          {(m.product as any)?.name || '—'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            {inflow ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
                            )}
                            {m.movement_type || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-500 text-xs font-mono">
                          {(m.reference_type || '') + (m.reference_id ? ` · ${String(m.reference_id).slice(0, 8)}…` : '')}
                        </TableCell>
                        <TableCell className={cn('text-right font-mono', inflow ? 'text-emerald-400' : 'text-amber-300')}>
                          {qty > 0 ? `+${qty}` : String(qty)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
          {documentsLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : documentsError ? (
            <p className="text-red-400 text-sm py-6">{documentsError}</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              No attachments on sales, purchases, or payments for this contact.
            </p>
          ) : (
            <div className="max-h-[58vh] overflow-auto rounded-lg border border-gray-800 divide-y divide-gray-800">
              {documents.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-900/40">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{d.title}</p>
                      <p className="text-xs text-gray-500">
                        <Badge variant="outline" className="mr-2 border-gray-600 text-gray-400 text-[10px]">
                          {d.source}
                        </Badge>
                        {d.subtitle || ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-gray-600 shrink-0"
                    onClick={async () => {
                      try {
                        const url = await getAttachmentOpenUrl(d.url);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } catch {
                        window.open(d.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden">
          {paymentsLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : paymentsError ? (
            <p className="text-red-400 text-sm py-6">{paymentsError}</p>
          ) : payments.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No payment rows for this contact.</p>
          ) : (
            <div className="max-h-[58vh] overflow-auto rounded-lg border border-gray-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400">Ref</TableHead>
                    <TableHead className="text-gray-400">Type</TableHead>
                    <TableHead className="text-gray-400 text-right">Amount</TableHead>
                    <TableHead className="text-gray-400">Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className="border-gray-800 opacity-100">
                      <TableCell className="text-gray-300 text-sm whitespace-nowrap">
                        {p.payment_date ? formatDate(p.payment_date) : '—'}
                      </TableCell>
                      <TableCell className="text-gray-200 text-sm font-mono">{p.reference_number || p.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="border-gray-600 text-gray-300 text-[10px]">
                            {p.reference_type || p.payment_type || '—'}
                          </Badge>
                          {p.voided_at && (
                            <Badge variant="destructive" className="text-[10px]">
                              Voided
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-white font-medium">
                        {formatCurrency(Number(p.amount) || 0)}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">{p.payment_method || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ViewPurchaseDetailsDrawer
        isOpen={!!purchaseDrawerId}
        onClose={() => setPurchaseDrawerId(null)}
        purchaseId={purchaseDrawerId}
      />
    </>
  );
};
