/**
 * Customer Ledger Debug Test Page
 * Check kahan issue hai: RPC vs Direct query vs Full API
 * Sidebar: Test > Ledger Debug
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useSupabase } from '@/app/context/SupabaseContext';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import { accountingService } from '@/app/services/accountingService';
import { getTodayYYYYMMDD } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { FileText, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type TestResult = {
  method: string;
  ok: boolean;
  count: number;
  error?: string;
  data?: any[];
};

export function LedgerDebugTestPage() {
  const { companyId } = useSupabase();
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [fromDate, setFromDate] = useState('2025-01-01');
  const [toDate, setToDate] = useState(() => getTodayYYYYMMDD());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [studioSalesInDb, setStudioSalesInDb] = useState<any[]>([]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const list = await customerLedgerAPI.getCustomers(companyId);
        setCustomers(list.map((c) => ({ id: c.id, name: c.name || c.code || c.id })));
        if (list.length > 0 && !selectedCustomerId) setSelectedCustomerId(list[0].id);
      } catch (e: any) {
        toast.error(e?.message || 'Customers load failed');
      }
    })();
  }, [companyId]);

  // Load studio sales from DB (so user can see which customer_id has STD-*)
  const loadStudioSales = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('id, invoice_no, customer_id, invoice_date, total, paid_amount, status')
        .eq('company_id', companyId)
        .or('invoice_no.ilike.STD%,invoice_no.ilike.ST-%')
        .order('invoice_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      setStudioSalesInDb(data || []);
      toast.success(`${(data || []).length} studio sale(s) in DB`);
    } catch (e: any) {
      toast.error(e?.message || 'Studio sales fetch failed');
      setStudioSalesInDb([]);
    } finally {
      setLoading(false);
    }
  };

  const runTests = async () => {
    if (!companyId || !selectedCustomerId) {
      toast.error('Company ID ya Customer select karein');
      return;
    }
    const cId = String(selectedCustomerId).trim();
    setLoading(true);
    setResults([]);
    const out: TestResult[] = [];

    try {
      // 1. RPC only
      const rpc = await supabase.rpc('get_customer_ledger_sales', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      });
      if (rpc.error) {
        out.push({ method: '1. RPC get_customer_ledger_sales', ok: false, count: 0, error: rpc.error.message });
      } else {
        const arr = rpc.data ?? [];
        out.push({ method: '1. RPC get_customer_ledger_sales', ok: true, count: arr.length, data: arr });
      }

      // 2. Direct query (sales table)
      let dq = supabase
        .from('sales')
        .select('id, invoice_no, invoice_date, total, paid_amount, due_amount')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .gte('invoice_date', fromDate)
        .lte('invoice_date', toDate);
      const direct = await dq.order('invoice_date', { ascending: false });
      if (direct.error) {
        out.push({ method: '2. Direct sales query', ok: false, count: 0, error: direct.error.message });
      } else {
        const arr = direct.data ?? [];
        out.push({ method: '2. Direct sales query', ok: true, count: arr.length, data: arr });
      }

      // 3. Full API getTransactions
      try {
        const transactions = await customerLedgerAPI.getTransactions(cId, companyId, fromDate, toDate);
        const saleCount = transactions.filter((t) => t.documentType === 'Sale' || t.documentType === 'Studio Sale').length;
        out.push({
          method: '3. API getTransactions',
          ok: true,
          count: transactions.length,
          data: transactions.slice(0, 20),
        });
      } catch (apiErr: any) {
        out.push({ method: '3. API getTransactions', ok: false, count: 0, error: apiErr?.message || 'Unknown' });
      }

      // 4. Main ledger (accountingService.getCustomerLedger) – RPC + journal + synthetic/merge
      try {
        const entries = await accountingService.getCustomerLedger(
          cId,
          companyId,
          undefined,
          fromDate || undefined,
          toDate || undefined
        );
        const rpcSalesCount = (out.find((r) => r.method === '1. RPC get_customer_ledger_sales') as any)?.count ?? 0;
        const hasRpcRows = rpcSalesCount > 0;
        const hasLedgerRows = entries.length > 0;
        let errMsg: string | undefined;
        if (hasRpcRows && !hasLedgerRows) errMsg = 'RPC mein rows hain lekin ledger 0 – mapping/merge check karein';
        out.push({
          method: '4. getCustomerLedger (main)',
          ok: true,
          count: entries.length,
          error: errMsg,
          data: entries.slice(0, 10),
        });
      } catch (ledgerErr: any) {
        out.push({
          method: '4. getCustomerLedger (main)',
          ok: false,
          count: 0,
          error: ledgerErr?.message || 'Unknown',
        });
      }

      setResults(out);
      const allOk = out.every((r) => r.ok);
      const anyHasRows = out.some((r) => r.ok && r.count > 0);
      if (!allOk) toast.error('Kuch tests fail hue – neeche detail dekhein');
      else if (!anyHasRows) toast.warning('Sab tests pass lekin 0 rows. Customer ID / date range check karein.');
      else toast.success('Tests complete – ledger data mil raha hai');
    } catch (e: any) {
      toast.error(e?.message || 'Test run failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Ledger Debug Test</h1>
          <p className="text-sm text-gray-400">RPC vs Direct query vs API – issue kahan hai check karein</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-300">Company ID</Label>
            <Input value={companyId ?? ''} readOnly className="mt-1 bg-gray-900 text-gray-400 font-mono text-xs" />
          </div>
          <div>
            <Label className="text-gray-300">Customer</Label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-600 bg-gray-900 text-white px-3 py-2"
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id.slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-gray-300">From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-gray-300">To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runTests} disabled={loading || !companyId || !selectedCustomerId}>
            <RefreshCw className={loading ? 'animate-spin w-4 h-4 mr-2' : 'w-4 h-4 mr-2'} />
            Run All 4 Tests
          </Button>
          <Button variant="outline" onClick={loadStudioSales} disabled={loading}>
            Studio sales in DB (STD-*)
          </Button>
        </div>
      </div>

      {/* Studio sales in DB – kis customer_id par STD-* hai */}
      {studioSalesInDb.length > 0 && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/10 p-4">
          <h3 className="font-semibold text-amber-200 mb-2">Studio sales in DB (STD-* / ST-*)</h3>
          <p className="text-xs text-gray-400 mb-2">Ledger ke liye isi customer_id par ledger kholo</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-600">
                  <th className="p-2">invoice_no</th>
                  <th className="p-2">customer_id</th>
                  <th className="p-2">invoice_date</th>
                  <th className="p-2">total</th>
                  <th className="p-2">paid</th>
                  <th className="p-2">status</th>
                </tr>
              </thead>
              <tbody>
                {studioSalesInDb.map((s) => (
                  <tr key={s.id} className="border-b border-gray-700">
                    <td className="p-2 font-mono text-blue-300">{s.invoice_no}</td>
                    <td className="p-2 font-mono text-xs text-gray-300">{s.customer_id ?? '—'}</td>
                    <td className="p-2">{s.invoice_date}</td>
                    <td className="p-2">{s.total}</td>
                    <td className="p-2">{s.paid_amount}</td>
                    <td className="p-2">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test results */}
      <div className="space-y-4">
        <h3 className="font-semibold text-white">Test results</h3>
        {results.length === 0 && (
          <p className="text-gray-500 text-sm">Pehle &quot;Run All 4 Tests&quot; click karein.</p>
        )}
        {results.map((r) => (
          <div
            key={r.method}
            className={`rounded-lg border p-4 ${
              r.ok ? 'border-green-700/50 bg-green-900/10' : 'border-red-700/50 bg-red-900/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {r.ok ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
              <span className="font-medium text-white">{r.method}</span>
              <span className="text-gray-400">→ {r.count} row(s)</span>
            </div>
            {r.error && <p className="text-sm text-red-300">{r.error}</p>}
            {r.data && r.data.length > 0 && (
              <div className="mt-2 overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-600">
                      <th className="p-1">invoice_no / ref</th>
                      <th className="p-1">date</th>
                      <th className="p-1">total/debit</th>
                      <th className="p-1">type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(r.data as any[]).slice(0, 15).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-700">
                        <td className="p-1 font-mono">{row.invoice_no ?? row.referenceNo ?? '—'}</td>
                        <td className="p-1">{row.invoice_date ?? row.date ?? '—'}</td>
                        <td className="p-1">{row.total ?? row.debit ?? row.credit ?? '—'}</td>
                        <td className="p-1">{row.documentType ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
