/**

 * Stock Ledger by Product — movement history report (read-only).

 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BookOpen, Loader2, AlertTriangle } from 'lucide-react';

import { toast } from 'sonner';

import { useSupabase } from '@/app/context/SupabaseContext';
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';

import { branchService } from '@/app/services/branchService';
import { productService } from '@/app/services/productService';
import { formatProductVariationLabel } from '@/app/lib/stockMovementDisplay';

import {

  stockMovementHistoryReportService,

  type CatalogProduct,

} from '@/app/services/stockMovementHistoryReportService';

import {

  buildExportRows,

  buildIntegritySummary,

  defaultFilters,

  validateFilters,

  type ProductReportSection,

  type ProductStockSummary,

  type StockMovementReportFilters,

  type StockStatusFilter,

} from '@/app/lib/stockMovementReportLogic';

import { exportToCSV, exportToExcel } from '@/app/utils/exportUtils';

import { ReportActions } from '@/app/components/reports/ReportActions';

import { PdfPreviewModal, type PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';

import { useReportExport } from '@/app/components/reports/shared/useReportExport';

import { StockMovementHistoryPrintPreview } from '@/app/components/reports/shared/StockMovementHistoryPrintPreview';

import { StockMovementFilterPanel, type ProductVariationOption } from './StockMovementFilterPanel';

import { ProductStockSummaryCard } from './ProductStockSummaryCard';

import { MovementHistoryTable } from './MovementHistoryTable';

import { StockIntegrityPanel } from './StockIntegrityPanel';

import { ProductAccordionList } from './ProductAccordionList';

type StockMovementHistoryReportPageProps = {
  startDate?: string;
  endDate?: string;
  branchId?: string;
};

export function StockMovementHistoryReportPage({
  startDate: propStartDate,
  endDate: propEndDate,
  branchId: propBranchId,
}: StockMovementHistoryReportPageProps = {}) {

  const { companyId, branchId: contextBranchId } = useSupabase();
  const globalFilter = useGlobalFilter();
  const { startDate: globalStartDate, endDate: globalEndDate, setCurrentModule, getDateRangeLabel } = globalFilter;

  const effectiveStartDate = (propStartDate ?? globalStartDate).slice(0, 10);
  const effectiveEndDate = (propEndDate ?? globalEndDate).slice(0, 10);
  const effectiveBranchId =
    propBranchId !== undefined
      ? propBranchId || null
      : contextBranchId && contextBranchId !== 'all'
        ? contextBranchId
        : null;

  const reportExport = useReportExport({ companyId, documentType: 'ledger', reportKind: 'stock_movement_history' });

  const [printOrientation, setPrintOrientation] = useState<PdfPreviewOrientation>('landscape');



  const [filters, setFilters] = useState<StockMovementReportFilters>(() => ({
    ...defaultFilters(),
    dateFrom: effectiveStartDate,
    dateTo: effectiveEndDate,
    branchId: effectiveBranchId,
  }));

  const [validationError, setValidationError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);

  const [hasRun, setHasRun] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState('');



  const [singleSection, setSingleSection] = useState<ProductReportSection | null>(null);

  const [allSummariesCached, setAllSummariesCached] = useState<ProductStockSummary[]>([]);

  const [allSummaries, setAllSummaries] = useState<ProductStockSummary[]>([]);

  const [allTotalCount, setAllTotalCount] = useState(0);

  const [allPage, setAllPage] = useState(1);

  const [largeWarning, setLargeWarning] = useState(false);

  const [exportSections, setExportSections] = useState<ProductReportSection[]>([]);

  const [previewSections, setPreviewSections] = useState<ProductReportSection[]>([]);
  const previewSectionsRef = useRef<ProductReportSection[]>([]);



  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const [categories, setCategories] = useState<{ id: string; name: string; parentId: string | null }[]>([]);

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  const [productSearchResults, setProductSearchResults] = useState<CatalogProduct[]>([]);

  const [selectedProductLabel, setSelectedProductLabel] = useState('');
  const [productVariations, setProductVariations] = useState<ProductVariationOption[]>([]);
  const [showVariationPicker, setShowVariationPicker] = useState(false);



  useEffect(() => {
    setCurrentModule('reports');
  }, [setCurrentModule]);

  useEffect(() => {
    setFilters((f) => ({
      ...f,
      dateFrom: effectiveStartDate,
      dateTo: effectiveEndDate,
    }));
  }, [effectiveStartDate, effectiveEndDate]);

  useEffect(() => {
    if (companyId) void reportExport.ensureBrand();
  }, [companyId, reportExport.ensureBrand]);



  useEffect(() => {

    if (!companyId) return;

    branchService.getBranchesCached(companyId).then((b) => setBranches(b.filter((x) => x.is_active !== false)));

    stockMovementHistoryReportService.fetchCategories(companyId).then(setCategories);

    stockMovementHistoryReportService.fetchBrands(companyId).then(setBrands);

    stockMovementHistoryReportService.fetchSuppliers(companyId).then(setSuppliers);

  }, [companyId]);



  const clearReportResults = useCallback(() => {
    setHasRun(false);
    setSingleSection(null);
    setExportSections([]);
    setPreviewSections([]);
    previewSectionsRef.current = [];
  }, []);

  const handleProductSearch = useCallback(
    async (term: string) => {
      if (!companyId) return;
      try {
        const results = await stockMovementHistoryReportService.searchProducts(
          companyId,
          term,
          20,
          filters.includeInactive,
        );
        setProductSearchResults(results);
      } catch (e) {
        console.error('[Stock Ledger] product search', e);
        setProductSearchResults([]);
      }
    },
    [companyId, filters.includeInactive],
  );

  const handleProductSelect = useCallback(async (product: CatalogProduct) => {
    setSelectedProductLabel(`${product.name} (${product.sku})`);
    setFilters((f) => ({ ...f, variationId: null }));
    clearReportResults();
    if (product.hasVariations) {
      try {
        const full = await productService.getProduct(product.id);
        const variations = (full?.variations || []) as Array<{
          id: string;
          name?: string | null;
          sku?: string | null;
          attributes?: Record<string, unknown> | null;
        }>;
        setProductVariations(
          variations.map((v) => ({
            id: v.id,
            label: formatProductVariationLabel(v),
          })),
        );
        setShowVariationPicker(variations.length > 0);
      } catch {
        setProductVariations([]);
        setShowVariationPicker(false);
      }
    } else {
      setProductVariations([]);
      setShowVariationPicker(false);
    }
  }, [clearReportResults]);

  const handleVariationChange = useCallback(
    (variationId: string | null) => {
      setFilters((f) => ({ ...f, variationId }));
      clearReportResults();
    },
    [clearReportResults],
  );

  const selectedVariationLabel = useMemo(() => {
    if (!filters.variationId) return null;
    return productVariations.find((v) => v.id === filters.variationId)?.label ?? filters.variationId;
  }, [filters.variationId, productVariations]);



  const filterSummary = useMemo(() => {
    const parts = [`${getDateRangeLabel()} · ${filters.dateFrom} → ${filters.dateTo}`];
    if (filters.branchId) parts.push(`Branch: ${branches.find((b) => b.id === filters.branchId)?.name || filters.branchId}`);
    if (filters.mode === 'single' && filters.productId) parts.push(`Product: ${selectedProductLabel || filters.productId}`);
    if (selectedVariationLabel) parts.push(`Variation: ${selectedVariationLabel}`);
    if (filters.movementType !== 'all') parts.push(`Type: ${filters.movementType}`);
    return parts.join(' · ');
  }, [filters, branches, selectedProductLabel, selectedVariationLabel, getDateRangeLabel]);



  const integrityFlags = useMemo(

    () => buildIntegritySummary(allSummariesCached),

    [allSummariesCached],

  );



  const slicePage = useCallback((summaries: ProductStockSummary[], page: number) => {

    const pageSize = stockMovementHistoryReportService.PAGE_SIZE;

    const start = (page - 1) * pageSize;

    return summaries.slice(start, start + pageSize);

  }, []);



  const runReport = useCallback(async () => {
    if (!companyId) return;
    const err = validateFilters(filters.dateFrom, filters.dateTo);
    if (err) {
      setValidationError(err);
      return;
    }
    if (filters.mode === 'single' && !filters.productId) {
      setValidationError('Please select a product.');
      return;
    }
    setValidationError(null);
    setLoading(true);
    setHasRun(true);
    stockMovementHistoryReportService.clearSummaryCache();
    try {
      if (filters.mode === 'single') {
        setLoadingMessage('Loading product ledger…');
        const section = await stockMovementHistoryReportService.runSingleProductReport(companyId, filters);
        setSingleSection(section);
        const sections = section ? [section] : [];
        setExportSections(sections);
        setPreviewSections(sections);
        if (section) {
          setSelectedProductLabel(`${section.summary.productName} (${section.summary.sku})`);
        }
      } else {
        setLoadingMessage('Loading product summaries…');
        const { summaries, totalCount, largeReportWarning: warn } =
          await stockMovementHistoryReportService.fetchAllProductSummaries(companyId, filters);
        setAllSummariesCached(summaries);
        setAllTotalCount(totalCount);
        setAllPage(1);
        setAllSummaries(slicePage(summaries, 1));
        setLargeWarning(warn);
        const summarySections = stockMovementHistoryReportService.buildSummaryOnlySections(summaries);
        setPreviewSections(summarySections);
        setExportSections(summarySections);
      }
    } catch (e: unknown) {

      const msg =

        e instanceof Error

          ? e.message

          : e && typeof e === 'object' && 'message' in e

            ? String((e as { message: unknown }).message)

            : 'Failed to load report';

      console.error('[Stock Ledger]', e);

      toast.error(msg);

    } finally {

      setLoading(false);

      setLoadingMessage('');

    }

  }, [companyId, filters, slicePage]);



  const handleReset = () => {
    stockMovementHistoryReportService.clearSummaryCache();
    setFilters({
      ...defaultFilters(),
      dateFrom: effectiveStartDate,
      dateTo: effectiveEndDate,
      branchId: effectiveBranchId,
    });

    setValidationError(null);

    setHasRun(false);

    setSingleSection(null);

    setAllSummaries([]);

    setAllSummariesCached([]);

    setExportSections([]);
    setPreviewSections([]);
    previewSectionsRef.current = [];

    setSelectedProductLabel('');
    setProductVariations([]);
    setShowVariationPicker(false);

    setAllPage(1);

  };



  const handleExpandProduct = useCallback(

    async (productId: string) => {

      if (!companyId) throw new Error('No company');

      return stockMovementHistoryReportService.fetchProductDetail(companyId, productId, filters);

    },

    [companyId, filters],

  );



  const handlePageChange = (page: number) => {

    setAllPage(page);

    setAllSummaries(slicePage(allSummariesCached, page));

  };



  const resolveExportSections = useCallback(

    async (fullDetail: boolean): Promise<ProductReportSection[]> => {

      if (!companyId) return [];

      if (filters.mode === 'single' && singleSection) return [singleSection];

      if (!fullDetail && previewSections.length) return previewSections;

      if (fullDetail && exportSections.some((s) => s.rows.length > 0)) return exportSections;

      toast.info('Preparing export data…');

      const sections = await stockMovementHistoryReportService.fetchAllSectionsForExport(companyId, filters);

      setExportSections(sections);
      setPreviewSections(sections);
      previewSectionsRef.current = sections;
      return sections;

    },

    [companyId, filters, singleSection, previewSections, exportSections],

  );



  const handleExportCsv = async () => {

    setExportLoading(true);

    try {

      const sections = await resolveExportSections(true);

      if (!sections.length) {

        toast.error('No data to export.');

        return;

      }

      const rows = buildExportRows(sections);

      exportToCSV(

        {

          headers: Object.keys(rows[0] || { rowType: '', productName: '' }),

          rows: rows.map((r) => Object.values(r).map(String)),

          title: 'Stock Ledger by Product',

        },

        `stock-ledger-${filters.dateFrom}-${filters.dateTo}`,

      );

    } finally {

      setExportLoading(false);

    }

  };



  const handleExportExcel = async () => {

    setExportLoading(true);

    try {

      const sections = await resolveExportSections(true);

      if (!sections.length) {

        toast.error('No data to export.');

        return;

      }

      const rows = buildExportRows(sections);

      exportToExcel(

        {

          headers: Object.keys(rows[0] || { rowType: '', productName: '' }),

          rows: rows.map((r) => Object.values(r).map(String)),

          title: 'Stock Ledger by Product',

        },

        `stock-ledger-${filters.dateFrom}-${filters.dateTo}`,

      );

    } finally {

      setExportLoading(false);

    }

  };



  const handleOpenPdfPreview = useCallback(async () => {
    setExportLoading(true);
    try {
      const sections = await resolveExportSections(true);
      if (!sections.length) {
        toast.error('No data to preview.');
        return;
      }
      previewSectionsRef.current = sections;
      setPreviewSections(sections);
      await reportExport.preparePrint();
      await reportExport.openPreview();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === 'object' && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Failed to prepare preview';
      toast.error(msg);
    } finally {
      setExportLoading(false);
    }
  }, [resolveExportSections, reportExport]);



  const expandAllEnabled = allSummaries.length <= stockMovementHistoryReportService.EXPAND_ALL_MAX;

  const activePreviewSections =
    previewSections.length > 0
      ? previewSections
      : previewSectionsRef.current.length > 0
        ? previewSectionsRef.current
        : exportSections.length > 0
          ? exportSections
          : singleSection
            ? [singleSection]
            : [];



  const exportToolbar = hasRun ? (

    <ReportActions

      onPrint={() => void handleOpenPdfPreview()}

      onOpenPdfPreview={() => void handleOpenPdfPreview()}

      onPreview={() => void handleOpenPdfPreview()}

      onCsv={() => void handleExportCsv()}

      onExcel={() => void handleExportExcel()}

      pdfLoading={exportLoading}

      previewContentRef={reportExport.printRef}

      previewDocumentType="ledger"

      previewReference="Stock-Ledger"

      className="sticky top-0 z-10 bg-transparent backdrop-blur-none border-0 p-0 mb-0"

    />

  ) : null;



  return (

    <div className="flex flex-col h-full min-h-0 bg-[#0B0F19]">

      {reportExport.previewOpen && reportExport.brand && (

        <PdfPreviewModal

          open={reportExport.previewOpen}

          onClose={reportExport.closePreview}

          title="Stock Ledger by Product"

          documentType="ledger"

          reference="Stock-Ledger"

          format={reportExport.printFormat}

          orientation={printOrientation}

          showOrientationToggle

          onOrientationChange={setPrintOrientation}

          pageNumbers

        >

          <StockMovementHistoryPrintPreview

            brand={reportExport.brand}

            title="Stock Ledger by Product"

            subtitle={filterSummary}

            generatedAt={new Date().toLocaleString()}

            filterSummary={filterSummary}

            sections={activePreviewSections}

            fieldVisibility={reportExport.tabularPrintOptions.fieldVisibility}

            showHeader={reportExport.tabularPrintOptions.showHeader}

            showFooter={reportExport.tabularPrintOptions.showFooter}

            fontSize={reportExport.tabularPrintOptions.fontSize}

            fontFamily={reportExport.tabularPrintOptions.fontFamily}

            orientation={printOrientation}

          />

        </PdfPreviewModal>

      )}



      <div className="shrink-0 px-6 py-4 border-b border-gray-800">

        <h1 className="text-2xl font-bold text-white flex items-center gap-2">

          <BookOpen className="text-blue-400" size={24} />

          Stock Ledger by Product

        </h1>

        <p className="text-sm text-gray-400 mt-0.5">

          Complete stock movement history from the ledger — opening balance, running totals, and current stock

        </p>

      </div>



      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        <StockMovementFilterPanel

          filters={filters}

          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}

          onRun={runReport}

          onReset={handleReset}

          validationError={validationError}

          branches={branches}

          categories={categories}

          brands={brands}

          suppliers={suppliers}

          productSearchResults={productSearchResults}

          onProductSearch={handleProductSearch}
          onProductSelect={handleProductSelect}
          selectedProductLabel={selectedProductLabel}
          productVariations={productVariations}
          showVariationPicker={showVariationPicker}
          onVariationChange={handleVariationChange}

          loading={loading || exportLoading}

          exportSlot={exportToolbar}

        />



        {loading && (

          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">

            <Loader2 className="animate-spin" size={24} />

            {loadingMessage || 'Loading report…'}

          </div>

        )}



        {!loading && hasRun && filters.mode === 'single' && singleSection && (

          <div className="space-y-4">

            <ProductStockSummaryCard summary={singleSection.summary} />

            <MovementHistoryTable
              rows={singleSection.rows}
              showVariationColumn={singleSection.showVariationColumn}
              emptyMessage="No stock movement found for this product."
            />

          </div>

        )}



        {!loading && hasRun && filters.mode === 'all' && (

          <div className="space-y-4">

            {largeWarning && (

              <div className="flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-amber-200 text-sm">

                <AlertTriangle size={18} className="shrink-0 mt-0.5" />

                Large report. Please narrow the date range or use export instead of expanding all products.

              </div>

            )}

            <StockIntegrityPanel

              flags={integrityFlags}

              onFilterShortcut={(status: StockStatusFilter) => setFilters((f) => ({ ...f, stockStatus: status }))}

            />

            <ProductAccordionList

              summaries={allSummaries}

              totalCount={allTotalCount}

              page={allPage}

              pageSize={stockMovementHistoryReportService.PAGE_SIZE}

              onPageChange={handlePageChange}

              onExpand={handleExpandProduct}

              expandAllEnabled={expandAllEnabled}

            />

          </div>

        )}



        {!loading && hasRun && filters.mode === 'single' && !singleSection && (

          <p className="text-gray-400 text-center py-8">Product not found or no data available.</p>

        )}

      </div>



      <div ref={reportExport.printRef} className="sr-only">

        {reportExport.brand && activePreviewSections.length > 0 && (

          <StockMovementHistoryPrintPreview

            brand={reportExport.brand}

            title="Stock Ledger by Product"

            generatedAt={new Date().toLocaleString()}

            filterSummary={filterSummary}

            sections={activePreviewSections}

            fieldVisibility={reportExport.tabularPrintOptions.fieldVisibility}

            orientation={printOrientation}

          />

        )}

      </div>

    </div>

  );

}



export default StockMovementHistoryReportPage;


