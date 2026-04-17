import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X,
  Receipt,
  Calendar,
  FileText,
  Printer,
  Download,
  BarChart3,
  FileSpreadsheet,
  Truck,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAccounting } from '@/app/context/AccountingContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { DateTimeDisplay } from '@/app/components/ui/DateTimeDisplay';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import { exportToCSV, exportToExcel, exportToPDF, type ExportData } from '@/app/utils/exportUtils';

// ============================================
// 🎯 TYPES
// ============================================

export type LedgerEntityType = 'supplier' | 'customer' | 'worker';

export interface LedgerViewProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: LedgerEntityType;
  entityName: string;
  /** Contact / party UUID (customer, supplier, or worker). Required for live GL ledger. */
  entityId?: string;
  /** When viewing a sale's ledger, pass saleId to load and show Shipment Accounting section. */
  saleId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s?: string | null): boolean {
  return Boolean(s && UUID_RE.test(String(s).trim()));
}

function isOpeningRow(row: AccountLedgerEntry): boolean {
  const dt = (row.document_type || '').toLowerCase();
  return dt.includes('opening');
}

function getDateRangeForFilter(
  dateFilter: 'all' | '7days' | '30days' | '90days'
): { start?: string; end?: string } {
  if (dateFilter === 'all') return {};
  const days = dateFilter === '7days' ? 7 : dateFilter === '30days' ? 30 : 90;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function computeActivityTotals(rows: AccountLedgerEntry[], entityType: LedgerEntityType) {
  const data = rows.filter((r) => !isOpeningRow(r));
  let chargeSide = 0;
  let paymentSide = 0;
  for (const r of data) {
    const d = Number(r.debit) || 0;
    const c = Number(r.credit) || 0;
    if (entityType === 'customer') {
      chargeSide += d;
      paymentSide += c;
    } else if (entityType === 'supplier') {
      chargeSide += c;
      paymentSide += d;
    } else {
      chargeSide += d;
      paymentSide += c;
    }
  }
  const closingBalance = rows.length ? Number(rows[rows.length - 1].running_balance) || 0 : 0;
  return { chargeSide, paymentSide, closingBalance, txnCount: data.length };
}

function rowPresentation(
  row: AccountLedgerEntry,
  entityType: LedgerEntityType
): { label: string; amount: number; isCharge: boolean } {
  if (isOpeningRow(row)) {
    return { label: 'Opening balance', amount: Math.abs(Number(row.running_balance) || 0), isCharge: false };
  }
  const d = Number(row.debit) || 0;
  const c = Number(row.credit) || 0;
  if (entityType === 'customer') {
    if (d > 0) return { label: 'Charge', amount: d, isCharge: true };
    if (c > 0) return { label: 'Payment', amount: c, isCharge: false };
  } else if (entityType === 'supplier') {
    if (c > 0) return { label: 'Purchase / payable', amount: c, isCharge: true };
    if (d > 0) return { label: 'Payment', amount: d, isCharge: false };
  } else {
    if (d >= c && d > 0) return { label: 'Debit', amount: d, isCharge: true };
    if (c > 0) return { label: 'Credit', amount: c, isCharge: false };
  }
  const m = Math.max(d, c);
  return { label: 'Entry', amount: m, isCharge: d >= c };
}

// ============================================
// 🎯 UNIFIED LEDGER VIEW
// ============================================

interface ShipmentLedgerRow {
  shipment_id: string;
  date: string;
  shipping_income: number;
  shipping_expense: number;
  courier_payable: number;
  entry_no?: string;
  journal_entry_id?: string;
  courier_name?: string;
}

export const UnifiedLedgerView: React.FC<LedgerViewProps> = ({
  isOpen,
  onClose,
  entityType,
  entityName,
  entityId,
  saleId,
}) => {
  const { refreshEntries } = useAccounting();
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const [activeTab, setActiveTab] = useState<'summary' | 'detailed' | 'statement'>('summary');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [shipmentLedgerRows, setShipmentLedgerRows] = useState<ShipmentLedgerRow[]>([]);
  const [partyRows, setPartyRows] = useState<AccountLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const branchForService = branchId && branchId !== 'all' ? branchId : undefined;

  const loadPartyLedger = useCallback(async () => {
    if (!isOpen || !companyId || !entityId || !isUuid(entityId)) {
      setPartyRows([]);
      setLedgerError(null);
      return;
    }
    setLedgerLoading(true);
    setLedgerError(null);
    const { start, end } = getDateRangeForFilter(dateFilter);
    try {
      let rows: AccountLedgerEntry[] = [];
      if (entityType === 'customer') {
        rows = await accountingService.getCustomerLedger(entityId, companyId, branchForService, start, end);
      } else if (entityType === 'supplier') {
        rows = await accountingService.getSupplierApGlJournalLedger(
          entityId,
          companyId,
          branchForService,
          start,
          end
        );
      } else {
        rows = await accountingService.getWorkerPartyGlJournalLedger(
          entityId,
          companyId,
          branchForService,
          start,
          end
        );
      }
      setPartyRows(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load ledger';
      setLedgerError(msg);
      setPartyRows([]);
      toast.error(msg);
    } finally {
      setLedgerLoading(false);
    }
  }, [isOpen, companyId, entityId, entityType, branchForService, dateFilter]);

  useEffect(() => {
    if (!isOpen || !saleId) {
      setShipmentLedgerRows([]);
      return;
    }
    const load = async () => {
      try {
        const { shipmentService } = await import('@/app/services/shipmentService');
        const { shipmentAccountingService } = await import('@/app/services/shipmentAccountingService');
        const shipments = await shipmentService.getBySaleId(saleId);
        const ids = shipments.map((s) => s.id);
        if (ids.length === 0) {
          setShipmentLedgerRows([]);
          return;
        }
        const rows = await shipmentAccountingService.getShipmentLedgerByShipmentIds(ids);
        setShipmentLedgerRows((rows ?? []) as ShipmentLedgerRow[]);
      } catch {
        setShipmentLedgerRows([]);
      }
    };
    load();
  }, [isOpen, saleId]);

  useEffect(() => {
    if (isOpen) {
      void refreshEntries();
    }
  }, [isOpen, refreshEntries]);

  useEffect(() => {
    void loadPartyLedger();
  }, [loadPartyLedger]);

  const totals = useMemo(() => computeActivityTotals(partyRows, entityType), [partyRows, entityType]);

  const rawPeriodSums = useMemo(() => {
    const data = partyRows.filter((r) => !isOpeningRow(r));
    const sumDb = data.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const sumCr = data.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    return { sumDb, sumCr };
  }, [partyRows]);

  const summaryRows = useMemo(() => {
    const data = partyRows.filter((r) => !isOpeningRow(r));
    return [...data].sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      const cb = (b.created_at || '').localeCompare(a.created_at || '');
      if (cb !== 0) return cb;
      return (b.journal_entry_id || '').localeCompare(a.journal_entry_id || '');
    });
  }, [partyRows]);

  const statementRows = useMemo(() => partyRows, [partyRows]);

  const getEntityLabels = () => {
    switch (entityType) {
      case 'supplier':
        return {
          title: 'Supplier Ledger',
          badge: 'bg-red-500/10 text-red-400 border-red-500/20',
          balanceLabel: 'Net payable (AP)',
          chargeLabel: 'Purchases / credits (AP)',
          paymentLabel: 'Payments / debits (AP)',
          balanceColor:
            totals.closingBalance > 0 ? 'text-red-400' : totals.closingBalance < 0 ? 'text-green-400' : 'text-gray-300',
        };
      case 'customer':
        return {
          title: 'Customer Ledger',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          balanceLabel: 'Outstanding receivable (AR)',
          chargeLabel: 'Total charges (debit AR)',
          paymentLabel: 'Total payments (credit AR)',
          balanceColor:
            totals.closingBalance > 0 ? 'text-yellow-400' : totals.closingBalance < 0 ? 'text-green-400' : 'text-gray-300',
        };
      case 'worker':
        return {
          title: 'Worker Ledger',
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          balanceLabel: 'Net exposure (WP / WA)',
          chargeLabel: 'Total debits',
          paymentLabel: 'Total credits',
          balanceColor:
            totals.closingBalance > 0 ? 'text-orange-400' : totals.closingBalance < 0 ? 'text-green-400' : 'text-gray-300',
        };
    }
  };

  const labels = getEntityLabels();

  const getTransactionBadge = (row: AccountLedgerEntry) => {
    const mod = (row.source_module || '').toLowerCase();
    const doc = (row.document_type || '').toLowerCase();
    if (doc.includes('opening')) return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    if (mod.includes('sales') || doc.includes('sale')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (mod.includes('rental')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (mod.includes('payment')) return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (mod.includes('purchase')) return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (mod.includes('expense')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const buildExportPayload = useCallback((): ExportData => {
    const headers = [
      'Date',
      'Ref',
      'Description',
      'Document type',
      'Debit',
      'Credit',
      'Running balance',
      'Account / counterparty',
    ];
    const rows = partyRows.map((r) => [
      r.date,
      r.reference_number || r.entry_no || '',
      r.description || '',
      r.document_type || r.source_module || '',
      r.debit || 0,
      r.credit || 0,
      r.running_balance ?? '',
      r.account_name || '',
    ]);
    return {
      title: `${labels.title} — ${entityName}`,
      headers,
      rows,
    };
  }, [partyRows, labels.title, entityName]);

  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  const handleExportPDF = () => {
    const data = buildExportPayload();
    exportToPDF(data, `ledger-${entityType}-${(entityName || 'party').replace(/\s+/g, '_')}`);
    toast.success('PDF prepared — use the print dialog to save as PDF');
  };

  const handleExportExcel = () => {
    const data = buildExportPayload();
    exportToExcel(data, `ledger-${entityType}-${(entityName || 'party').replace(/\s+/g, '_')}`);
    toast.success('Spreadsheet download started');
  };

  const handleExportCsv = () => {
    const data = buildExportPayload();
    exportToCSV(data, `ledger-${entityType}-${(entityName || 'party').replace(/\s+/g, '_')}`);
    toast.success('CSV download started');
  };

  const idInvalid = Boolean(entityId && !isUuid(entityId));

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-[95vw] lg:max-w-7xl max-h-[92vh] flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200 print:shadow-none print:border-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-2xl font-bold text-white">{labels.title}</h2>
              <p className="text-sm text-gray-400 mt-1">Posted activity from the general ledger (filters apply)</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 border-b border-gray-800 bg-gray-950/30">
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <Badge variant="outline" className={labels.badge}>
                      {entityType.toUpperCase()}
                    </Badge>
                    <h3 className="text-3xl font-bold text-white">{entityName}</h3>
                    {entityId && (
                      <span className="text-sm text-gray-500 font-mono break-all max-w-xl">ID: {entityId}</span>
                    )}
                  </div>

                  {idInvalid && (
                    <p className="text-amber-400 text-sm mb-4">
                      This party is not linked to a contact UUID — load the ledger from Contacts or fix the record so a
                      valid contact ID is available.
                    </p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Transactions</p>
                      <p className="text-2xl font-bold text-white">{totals.txnCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">{labels.chargeLabel}</p>
                      <p className="text-2xl font-bold text-red-400">{formatCurrency(totals.chargeSide)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">{labels.paymentLabel}</p>
                      <p className="text-2xl font-bold text-green-400">{formatCurrency(totals.paymentSide)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">{labels.balanceLabel}</p>
                      <p className={`text-3xl font-bold ${labels.balanceColor}`}>
                        {formatCurrency(Math.abs(totals.closingBalance))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="h-20 w-20 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Receipt className="text-blue-400" size={40} />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-950/20">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'summary' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <BarChart3 size={16} className="inline mr-2" />
                Summary
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('detailed')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'detailed' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <FileText size={16} className="inline mr-2" />
                Detailed
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('statement')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'statement' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <FileSpreadsheet size={16} className="inline mr-2" />
                Statement
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-2 mr-1">
                <Calendar size={16} className="text-gray-400" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'all' | '7days' | '30days' | '90days')}
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All time</option>
                  <option value="7days">Last 7 days</option>
                  <option value="30days">Last 30 days</option>
                  <option value="90days">Last 90 days</option>
                </select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadPartyLedger()}
                disabled={ledgerLoading || !companyId || !entityId || idInvalid}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <RefreshCw size={14} className={cn('mr-2', ledgerLoading && 'animate-spin')} />
                Refresh
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Printer size={14} className="mr-2" />
                Print
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={partyRows.length === 0}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Download size={14} className="mr-2" />
                PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={partyRows.length === 0}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <FileSpreadsheet size={14} className="mr-2" />
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={partyRows.length === 0}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hidden sm:inline-flex"
              >
                CSV
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-[200px]">
            {ledgerError && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {ledgerError}
              </div>
            )}

            {ledgerLoading && (
              <div className="flex items-center gap-2 text-gray-400 mb-4">
                <Loader2 className="animate-spin" size={18} />
                Loading ledger…
              </div>
            )}

            {shipmentLedgerRows.length > 0 && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-gray-950/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                  <Truck size={18} className="text-indigo-400" />
                  <h4 className="font-semibold text-white">Shipment accounting</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-800">
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Shipping income</th>
                        <th className="px-4 py-2">Shipping expense</th>
                        <th className="px-4 py-2">Courier payable</th>
                        <th className="px-4 py-2">Journal entry #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipmentLedgerRows.map((row, i) => (
                        <tr key={row.shipment_id + (row.date || '') + i} className="border-b border-gray-800/50">
                          <td className="px-4 py-2 text-gray-300">
                            {row.date ? formatDate(new Date(row.date)) : '—'}
                          </td>
                          <td className="px-4 py-2 text-green-400">{formatCurrency(Number(row.shipping_income) || 0)}</td>
                          <td className="px-4 py-2 text-red-400">{formatCurrency(Number(row.shipping_expense) || 0)}</td>
                          <td className="px-4 py-2 text-amber-400">{formatCurrency(Number(row.courier_payable) || 0)}</td>
                          <td className="px-4 py-2 text-gray-400 font-mono">{row.entry_no || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!ledgerLoading && !idInvalid && partyRows.length === 0 && (
              <div className="text-center py-16">
                <Receipt className="mx-auto text-gray-600 mb-4" size={64} />
                <p className="text-gray-500 text-lg">No ledger lines in this period</p>
                <p className="text-sm text-gray-600 mt-2">Try &quot;All time&quot; or refresh after new postings.</p>
              </div>
            )}

            {!ledgerLoading && partyRows.length > 0 && (
              <>
                {activeTab === 'summary' && (
                  <div className="space-y-3">
                    {summaryRows.map((row) => {
                      const pres = rowPresentation(row, entityType);
                      return (
                        <div
                          key={`${row.journal_entry_id}-${row.date}-${row.reference_number}-${row.running_balance}`}
                          className="bg-gray-950/50 border border-gray-800 rounded-lg p-5 hover:bg-gray-800/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <Badge variant="outline" className={getTransactionBadge(row)}>
                                  {row.document_type || row.source_module || 'Entry'}
                                </Badge>
                                <span className="text-blue-400 font-mono text-sm font-semibold truncate">
                                  {row.reference_number}
                                </span>
                                <span className="text-gray-500 text-sm whitespace-nowrap">
                                  <DateTimeDisplay date={new Date(row.date + 'T12:00:00')} />
                                </span>
                              </div>

                              <p className="text-gray-300 mb-3 break-words">{row.description}</p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                <div className="text-gray-500">
                                  Counterparty / account:{' '}
                                  <span className="text-gray-300">{row.account_name || '—'}</span>
                                </div>
                                {row.notes ? (
                                  <div className="text-gray-500">
                                    Notes: <span className="text-gray-300">{row.notes}</span>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p
                                className={cn(
                                  'text-2xl font-bold',
                                  pres.isCharge ? 'text-red-400' : 'text-green-400'
                                )}
                              >
                                {pres.isCharge ? '+' : '−'} {formatCurrency(pres.amount)}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">{pres.label}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'detailed' && (
                  <div className="bg-gray-950/50 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full min-w-[880px]">
                      <thead>
                        <tr className="bg-gray-950 border-b border-gray-800">
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Date</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Ref</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Description</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Type</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Debit</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Credit</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partyRows.map((row) => (
                          <tr
                            key={`${row.journal_entry_id}-${row.date}-${row.reference_number}-${row.running_balance}`}
                            className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                          >
                            <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                              <DateTimeDisplay date={new Date(row.date + 'T12:00:00')} />
                            </td>
                            <td className="p-4">
                              <span className="text-blue-400 font-mono text-sm">{row.reference_number}</span>
                            </td>
                            <td className="p-4 text-gray-300 text-sm max-w-md">{row.description}</td>
                            <td className="p-4">
                              <Badge variant="outline" className={getTransactionBadge(row)}>
                                {row.document_type || row.source_module}
                              </Badge>
                            </td>
                            <td className="p-4 text-right text-green-400 text-sm">
                              {row.debit ? formatCurrency(row.debit) : '—'}
                            </td>
                            <td className="p-4 text-right text-red-400 text-sm">
                              {row.credit ? formatCurrency(row.credit) : '—'}
                            </td>
                            <td className="p-4 text-right font-mono text-sm text-gray-200">
                              {formatCurrency(row.running_balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'statement' && (
                  <div className="bg-gray-950/50 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
                    <div className="bg-gray-950 p-6 border-b border-gray-800">
                      <h3 className="text-lg font-bold text-white mb-2">Account statement</h3>
                      <p className="text-sm text-gray-400">
                        Period:{' '}
                        {dateFilter === 'all'
                          ? 'All time'
                          : dateFilter === '7days'
                            ? 'Last 7 days'
                            : dateFilter === '30days'
                              ? 'Last 30 days'
                              : 'Last 90 days'}
                      </p>
                    </div>
                    <table className="w-full min-w-[720px]">
                      <thead>
                        <tr className="bg-gray-900 border-b border-gray-800">
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Date</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Particulars</th>
                          <th className="text-center p-4 text-xs font-semibold text-gray-400 uppercase">Ref</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Debit</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Credit</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementRows.map((row, idx) => (
                          <tr
                            key={`stmt-${row.journal_entry_id}-${idx}-${row.reference_number}`}
                            className="border-b border-gray-800 hover:bg-gray-800/20 transition-colors"
                          >
                            <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                              <DateTimeDisplay date={new Date(row.date + 'T12:00:00')} />
                            </td>
                            <td className="p-4 text-gray-300 text-sm">{row.description}</td>
                            <td className="p-4 text-center">
                              <span className="text-blue-400 font-mono text-xs">{row.reference_number}</span>
                            </td>
                            <td className="p-4 text-right">
                              {row.debit > 0 ? (
                                <span className="text-green-400 font-semibold">{formatCurrency(row.debit)}</span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {row.credit > 0 ? (
                                <span className="text-red-400 font-semibold">{formatCurrency(row.credit)}</span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <span
                                className={cn(
                                  'font-bold',
                                  row.running_balance > 0 ? 'text-yellow-400' : 'text-green-400'
                                )}
                              >
                                {formatCurrency(row.running_balance)}
                              </span>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-950 font-bold border-t-2 border-blue-500/30">
                          <td colSpan={3} className="p-4 text-right text-white uppercase">
                            Period totals / closing balance
                          </td>
                          <td className="p-4 text-right text-green-400">{formatCurrency(rawPeriodSums.sumDb)}</td>
                          <td className="p-4 text-right text-red-400">{formatCurrency(rawPeriodSums.sumCr)}</td>
                          <td className={`p-4 text-right text-2xl ${labels.balanceColor}`}>
                            {formatCurrency(Math.abs(totals.closingBalance))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-6 border-t border-gray-800 flex items-center justify-between bg-gray-950/50 flex-wrap gap-3">
            <div className="text-sm text-gray-400">
              Showing <span className="text-white font-semibold">{totals.txnCount}</span> activity line
              {totals.txnCount !== 1 ? 's' : ''}
              {dateFilter !== 'all' && (
                <span className="ml-2">
                  (
                  {dateFilter === '7days'
                    ? 'last 7 days'
                    : dateFilter === '30days'
                      ? 'last 30 days'
                      : 'last 90 days'}
                  )
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500 mr-4">
                Generated {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-8">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
