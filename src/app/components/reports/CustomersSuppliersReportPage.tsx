/**
 * Customers & Suppliers operational summary — live RPC data.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Filter,
  Info,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { CustomSelect } from '@/app/components/ui/custom-select';
import { DateRangePicker } from '@/app/components/ui/DateRangePicker';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { formatAmount } from '@/app/utils/formatCurrency';
import { toast } from 'sonner';
import { ReportActions } from './ReportActions';
import {
  exportCustomersSuppliersCsv,
  exportCustomersSuppliersExcel,
  exportCustomersSuppliersPdf,
  printCustomersSuppliersReport,
} from '@/app/lib/customersSuppliersReportExport';
import {
  filterCustomersSuppliersRows,
  paginateRows,
  resolveVisibleColumns,
  sortCustomersSuppliersRows,
  sumCustomersSuppliersTotals,
  visibleColumnKeysFromMap,
  type BalanceStatus,
  type ContactTypeFilter,
  type CustomersSuppliersSortKey,
  type SortDirection,
} from '@/app/lib/customersSuppliersReportLogic';
import {
  CUSTOMERS_SUPPLIERS_COLUMN_KEYS,
  CUSTOMERS_SUPPLIERS_COLUMN_LABELS,
  loadCustomersSuppliersReport,
  type CustomersSuppliersColumnKey,
  type CustomersSuppliersReportRow,
} from '@/app/services/customersSuppliersReportService';

const CS_COLUMNS_SESSION_KEY = 'reports-customers-suppliers-columns';

type Props = {
  startDate: string;
  endDate: string;
  branchId?: string | null;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const SORT_KEY_BY_COLUMN: Partial<Record<CustomersSuppliersColumnKey, CustomersSuppliersSortKey>> = {
  contact: 'contactName',
  totalPurchase: 'totalPurchase',
  totalPurchaseReturn: 'totalPurchaseReturn',
  totalSale: 'totalSale',
  totalSellReturn: 'totalSellReturn',
  payment: 'payment',
  totalDiscount: 'totalDiscount',
  openingBalanceDue: 'openingBalanceDue',
  due: 'due',
  advanceGl: 'advanceGl',
};

function parsePropDate(s: string): Date {
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function CustomersSuppliersReportPage({ startDate, endDate, branchId }: Props) {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();

  const [rows, setRows] = useState<CustomersSuppliersReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [contactType, setContactType] = useState<ContactTypeFilter>('both');
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus>('all');
  const [overrideGlobalDates, setOverrideGlobalDates] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(() => ({
    from: parsePropDate(startDate),
    to: parsePropDate(endDate),
  }));

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<CustomersSuppliersSortKey>('contactName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const printPreviewRef = useRef<HTMLDivElement>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const raw = sessionStorage.getItem(CS_COLUMNS_SESSION_KEY);
      if (raw) return { ...resolveVisibleColumns('both'), ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return resolveVisibleColumns('both');
  });

  useEffect(() => {
    if (!overrideGlobalDates) {
      setDateRange({ from: parsePropDate(startDate), to: parsePropDate(endDate) });
    }
  }, [startDate, endDate, overrideGlobalDates]);

  useEffect(() => {
    setVisibleColumns((prev) => ({ ...resolveVisibleColumns(contactType), ...prev, contact: true }));
  }, [contactType]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CS_COLUMNS_SESSION_KEY, JSON.stringify(visibleColumns));
    } catch {
      /* ignore */
    }
  }, [visibleColumns]);

  const effectiveStartDate = overrideGlobalDates
    ? format(dateRange.from ?? new Date(), 'yyyy-MM-dd')
    : startDate;
  const effectiveEndDate = overrideGlobalDates
    ? format(dateRange.to ?? new Date(), 'yyyy-MM-dd')
    : endDate;

  const periodLabel = `${effectiveStartDate} — ${effectiveEndDate}`;

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setLoading(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loadCustomersSuppliersReport({
        companyId,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        branchId,
        contactType,
        balanceStatus,
      });
      setRows(res.rows);
      setError(res.error);
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveStartDate, effectiveEndDate, branchId, contactType, balanceStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, sortKey, sortDirection, contactType, balanceStatus, effectiveStartDate, effectiveEndDate]);

  useEffect(() => {
    if (!columnsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [columnsOpen]);

  const filterActiveCount =
    (contactType !== 'both' ? 1 : 0) +
    (balanceStatus !== 'all' ? 1 : 0) +
    (overrideGlobalDates ? 1 : 0);

  const filteredRows = useMemo(
    () =>
      sortCustomersSuppliersRows(filterCustomersSuppliersRows(rows, search), sortKey, sortDirection),
    [rows, search, sortKey, sortDirection]
  );

  const totals = useMemo(() => sumCustomersSuppliersTotals(filteredRows), [filteredRows]);

  const { slice: pageSlice, totalPages, from, to, total } = useMemo(
    () => paginateRows(filteredRows, currentPage, pageSize),
    [filteredRows, currentPage, pageSize]
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const visibleCols = useMemo(() => visibleColumnKeysFromMap(visibleColumns), [visibleColumns]);

  const exportMeta = useMemo(
    () => ({
      title: 'Customers & Suppliers Report',
      periodLabel,
      filenameBase: `customers-suppliers-${effectiveStartDate}-${effectiveEndDate}`,
    }),
    [periodLabel, effectiveStartDate, effectiveEndDate]
  );

  const toggleSort = (col: CustomersSuppliersColumnKey) => {
    const key = SORT_KEY_BY_COLUMN[col];
    if (!key) return;
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setContactType('both');
    setBalanceStatus('all');
    setOverrideGlobalDates(false);
    setDateRange({ from: parsePropDate(startDate), to: parsePropDate(endDate) });
  };

  const handleExportCsv = () => {
    try {
      exportCustomersSuppliersCsv(filteredRows, visibleCols, totals, formatCurrency, exportMeta);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV export failed');
    }
  };

  const handleExportExcel = async () => {
    setExportBusy(true);
    try {
      await exportCustomersSuppliersExcel(filteredRows, visibleCols, totals, formatCurrency, exportMeta);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Excel export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportPdf = async () => {
    setExportBusy(true);
    try {
      await exportCustomersSuppliersPdf(filteredRows, visibleCols, totals, formatCurrency, exportMeta);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const renderAmountCell = (value: number) => (
    <span className="tabular-nums">{formatAmount(value)}</span>
  );

  const renderCell = (row: CustomersSuppliersReportRow, col: CustomersSuppliersColumnKey) => {
    switch (col) {
      case 'contact':
        return (
          <span className="text-blue-400 text-left truncate max-w-[220px] block" title={row.contactName}>
            {row.contactName}
          </span>
        );
      case 'totalPurchase':
        return renderAmountCell(row.totalPurchase);
      case 'totalPurchaseReturn':
        return renderAmountCell(row.totalPurchaseReturn);
      case 'totalSale':
        return renderAmountCell(row.totalSale);
      case 'totalSellReturn':
        return renderAmountCell(row.totalSellReturn);
      case 'payment':
        return renderAmountCell(row.payment);
      case 'totalDiscount':
        return renderAmountCell(row.totalDiscount);
      case 'openingBalanceDue':
        return renderAmountCell(row.openingBalanceDue);
      case 'due':
        return (
          <span className={cn('tabular-nums', row.due > 0 ? 'text-amber-300' : 'text-muted-foreground')}>
            {formatAmount(row.due)}
          </span>
        );
      case 'advanceGl':
        return (
          <span className={cn('tabular-nums', row.advanceGl > 0 ? 'text-cyan-300' : 'text-muted-foreground')}>
            {formatAmount(row.advanceGl)}
          </span>
        );
      default:
        return null;
    }
  };

  const renderTotalCell = (col: CustomersSuppliersColumnKey, forPrint = false) => {
    if (col === 'contact') return 'Total:';
    const key = col as keyof typeof totals;
    if (key in totals) {
      return forPrint ? formatAmount(totals[key]) : renderAmountCell(totals[key]);
    }
    return null;
  };

  const SortIcon = ({ col }: { col: CustomersSuppliersColumnKey }) => {
    const key = SORT_KEY_BY_COLUMN[col];
    if (!key) return null;
    if (sortKey !== key) {
      return <ChevronUp className="inline w-3 h-3 opacity-30 ml-0.5" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="inline w-3 h-3 ml-0.5 text-blue-400" />
    ) : (
      <ChevronDown className="inline w-3 h-3 ml-0.5 text-blue-400" />
    );
  };

  const renderTableHead = (forPrint = false) => (
    <thead className={cn(!forPrint && 'sticky top-0 z-10 bg-input-background/95 text-muted-foreground uppercase tracking-wide border-b border-border')}>
      <tr>
        {visibleCols.map((col) => (
          <th
            key={col}
            className={cn(
              'px-2 py-2 whitespace-nowrap font-medium',
              !forPrint && 'cursor-pointer select-none hover:text-gray-200',
              col !== 'contact' && 'text-right',
              forPrint && col !== 'contact' && 'text-right',
              forPrint && col === 'contact' && 'text-left text-black bg-gray-100',
              forPrint && col !== 'contact' && 'border border-gray-300 text-black bg-gray-100'
            )}
            onClick={forPrint ? undefined : () => toggleSort(col)}
          >
            <span className="inline-flex items-center gap-0.5">
              {col === 'due' && !forPrint ? (
                <>
                  {CUSTOMERS_SUPPLIERS_COLUMN_LABELS[col]}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex ml-0.5 text-blue-400 hover:text-blue-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs bg-card border border-border text-gray-200"
                    >
                      Party GL follow-up balance MAX(0, signed) as at period end — amounts you still
                      need to collect or pay. Same basis as Contacts receivables/payables columns.
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : col === 'advanceGl' && !forPrint ? (
                <>
                  {CUSTOMERS_SUPPLIERS_COLUMN_LABELS[col]}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex ml-0.5 text-cyan-400 hover:text-cyan-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs bg-card border border-border text-gray-200"
                    >
                      Party GL credit/advance MAX(0, −signed) as at period end — e.g. supplier prepayment
                      or customer overpayment. Shown as a positive amount.
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : (
                CUSTOMERS_SUPPLIERS_COLUMN_LABELS[col]
              )}
              {!forPrint && <SortIcon col={col} />}
            </span>
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4 customers-suppliers-report">
      <ReportBasisBanner
        basis="effective_party"
        detail="Activity columns use the selected date range. Due (GL) = party journal balance at period end (matches Trial Balance party rows and Balance Sheet after AR tie-out). Compare closing to Ledger Statement for operational proof."
      />

      <div className="no-print rounded-lg border border-sky-500/25 bg-sky-950/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-sky-100 hover:bg-sky-950/50 transition-colors"
        >
          <Filter className="w-4 h-4 text-sky-400" />
          Filters
          {filterActiveCount > 0 && (
            <span className="ml-1 text-xs bg-sky-600/80 text-foreground px-1.5 py-0.5 rounded-full">
              {filterActiveCount}
            </span>
          )}
          <span className="ml-auto">
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {filtersOpen && (
          <div className="border-t border-sky-500/20 px-4 py-4 bg-muted/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Contact type</Label>
                <Select value={contactType} onValueChange={(v) => setContactType(v as ContactTypeFilter)}>
                  <SelectTrigger className="bg-input-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Balance status</Label>
                <Select value={balanceStatus} onValueChange={(v) => setBalanceStatus(v as BalanceStatus)}>
                  <SelectTrigger className="bg-input-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="has_due">Has due balance</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Date range</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Switch
                    checked={overrideGlobalDates}
                    onCheckedChange={setOverrideGlobalDates}
                    id="cs-override-dates"
                  />
                  <Label htmlFor="cs-override-dates" className="text-xs text-muted-foreground cursor-pointer">
                    Override header dates
                  </Label>
                </div>
                {overrideGlobalDates ? (
                  <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Select period" />
                ) : (
                  <p className="text-sm text-muted-foreground">{periodLabel} (header)</p>
                )}
              </div>
            </div>

            {filterActiveCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <ReportActions
        title="Customers & Suppliers"
        onPrint={printCustomersSuppliersReport}
        onPdf={handleExportPdf}
        onExcel={handleExportExcel}
        onCsv={handleExportCsv}
        previewContentRef={printPreviewRef}
        previewDocumentType="ledger"
        previewReference={`customers-suppliers-${effectiveStartDate}`}
        pdfLoading={exportBusy}
        className="no-print !static !bg-transparent !border-0 !p-0 !mb-2"
      />

      <div className="no-print flex flex-wrap items-center gap-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <span>Show</span>
          <CustomSelect
            value={pageSize}
            onChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
            options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          />
          <span>entries</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 justify-center">
          <div ref={columnsRef} className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 bg-card border-border text-muted-foreground"
              onClick={() => setColumnsOpen((o) => !o)}
            >
              <Columns3 size={14} />
              Column visibility
            </Button>
            {columnsOpen && (
              <div className="absolute left-0 top-11 w-64 bg-card border border-border rounded-lg shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Show columns</h3>
                  <button
                    type="button"
                    onClick={() => setVisibleColumns(resolveVisibleColumns(contactType))}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Reset for type
                  </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {CUSTOMERS_SUPPLIERS_COLUMN_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 p-2 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[key] !== false}
                        onChange={() =>
                          setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        disabled={key === 'contact'}
                        className="rounded border-gray-600"
                      />
                      {CUSTOMERS_SUPPLIERS_COLUMN_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative w-full sm:w-64 shrink-0 ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-9 pr-8 h-9 bg-card border-border text-foreground text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {/* Print-only layout (classic-print-base visible on @media print) */}
      <div
        ref={printPreviewRef}
        className="classic-print-base"
        style={{ position: 'absolute', left: '-9999px', top: 0, width: '820px', minHeight: '240px', overflow: 'visible' }}
        aria-hidden
      >
        <div className="p-4 text-black bg-white">
          <h1 className="text-lg font-bold mb-1">Customers &amp; Suppliers Report</h1>
          <p className="text-sm mb-4">{periodLabel}</p>
          <table className="w-full text-xs border-collapse">
            {renderTableHead(true)}
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.contactId}>
                  {visibleCols.map((col) => (
                    <td
                      key={col}
                      className={cn(
                        'border border-gray-300 px-2 py-1',
                        col !== 'contact' && 'text-right'
                      )}
                    >
                      {col === 'contact'
                        ? r.contactName
                        : formatAmount(r[col as keyof CustomersSuppliersReportRow] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="font-bold">
                  {visibleCols.map((col) => (
                    <td
                      key={col}
                      className={cn(
                        'border border-gray-300 px-2 py-1',
                        col !== 'contact' && 'text-right'
                      )}
                    >
                      {renderTotalCell(col, true)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="no-print rounded-xl border border-border bg-card/40 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[calc(100dvh-22rem)] overflow-y-auto">
              <table className="w-full text-left text-sm min-w-[1100px]">
                {renderTableHead()}
                <tbody className="divide-y divide-border/80 text-gray-200">
                  {pageSlice.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleCols.length || 1}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No contacts match the current filters.
                      </td>
                    </tr>
                  ) : (
                    pageSlice.map((r) => (
                      <tr key={r.contactId} className="hover:bg-muted/40">
                        {visibleCols.map((col) => (
                          <td
                            key={col}
                            className={cn('px-2 py-1.5', col !== 'contact' && 'text-right')}
                          >
                            {renderCell(r, col)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredRows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-input-background/95 border-t border-border text-muted-foreground text-sm font-bold">
                    <tr>
                      {visibleCols.map((col) => (
                        <td
                          key={col}
                          className={cn(
                            'px-2 py-2',
                            col !== 'contact' && 'text-right tabular-nums',
                            col === 'contact' && 'text-foreground'
                          )}
                        >
                          {renderTotalCell(col)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border bg-card">
              <p className="text-xs text-muted-foreground">
                {total === 0
                  ? 'Showing 0 to 0 of 0 entries'
                  : `Showing ${from} to ${to} of ${total} entries`}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border text-muted-foreground"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2
                  )
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-muted-foreground">…</span>
                      )}
                      <button
                        type="button"
                        className={cn(
                          'h-8 min-w-[2rem] rounded px-2 text-sm font-medium',
                          p === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted'
                        )}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border text-muted-foreground"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
