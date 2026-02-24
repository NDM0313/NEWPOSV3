import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { productCategoryService } from '@/app/services/productCategoryService';
import { unitService } from '@/app/services/unitService';
import { brandService } from '@/app/services/brandService';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { toast } from 'sonner';

/** CSV column mapping - header names (case-insensitive) to field keys. Matches DB: products + product_variations. */
const PRODUCT_CSV_COLUMNS: Record<string, string> = {
  name: 'name',
  'product name': 'name',
  sku: 'sku',
  category: 'category',
  unit: 'unit',
  brand: 'brand',
  'cost price': 'cost_price',
  'purchase price': 'cost_price',
  'purchase_price': 'cost_price',
  'cost_price': 'cost_price',
  'selling price': 'selling_price',
  'retail price': 'selling_price',
  'retail_price': 'selling_price',
  'selling_price': 'selling_price',
  'wholesale price': 'wholesale_price',
  'wholesale_price': 'wholesale_price',
  'opening stock': 'opening_stock',
  'opening_stock': 'opening_stock',
  'initial stock': 'opening_stock',
  quantity: 'opening_stock',
  qty: 'opening_stock',
  'min stock': 'min_stock',
  'min_stock': 'min_stock',
  'max stock': 'max_stock',
  'max_stock': 'max_stock',
  'track stock': 'track_stock',
  'track_stock': 'track_stock',
  'is rentable': 'is_rentable',
  'is_rentable': 'is_rentable',
  'is sellable': 'is_sellable',
  'is_sellable': 'is_sellable',
  barcode: 'barcode',
  description: 'description',
  'variation name': 'variation_name',
  'variation_name': 'variation_name',
  'variation': 'variation_name',
  'variant': 'variation_name',
  'variation sku': 'variation_sku',
  'variation_sku': 'variation_sku',
  'variation barcode': 'variation_barcode',
  'variation_barcode': 'variation_barcode',
  subcategory: 'subcategory',
  'sub category': 'subcategory',
  'sub_category': 'subcategory',
  'image url': 'image_url',
  image_url: 'image_url',
};

interface ParsedProductRow {
  name: string;
  sku: string;
  category?: string;
  unit?: string;
  brand?: string;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number;
  opening_stock: number;
  min_stock?: number;
  max_stock?: number;
  track_stock?: boolean;
  is_sellable?: boolean;
  barcode?: string;
  description?: string;
  /** If set, this row is a variation of the product (name+sku). */
  variation_name?: string;
  variation_sku?: string;
  variation_barcode?: string;
  subcategory?: string;
  image_url?: string;
}

/** Per-row or per-group validation/import error for preview and error report */
export interface ImportRowError {
  groupKey: string;
  productName: string;
  rowIndex: number;
  message: string;
  type: 'validation' | 'failed';
}

/** Import summary after run */
export interface ImportSummary {
  created: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
}

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/** Template: simple product + variation product. For variation rows leave barcode,description,image_url empty (,,,) so variation_name and variation_sku align. */
const PRODUCT_CSV_TEMPLATE = `name,sku,category,subcategory,unit,brand,cost_price,selling_price,wholesale_price,opening_stock,min_stock,max_stock,track_stock,is_sellable,barcode,description,image_url,variation_name,variation_sku,variation_barcode
T-Shirt Basic,TSH-001,Apparel,,Piece,Brand A,80,200,160,0,5,500,yes,yes,,Plain t-shirt,,,,
T-Shirt Basic,TSH-001,Apparel,,Piece,Brand A,80,200,160,10,,,yes,yes,,,,Size: S,TSH-001-S,
T-Shirt Basic,TSH-001,Apparel,,Piece,Brand A,85,210,168,15,,,yes,yes,,,,Size: M,TSH-001-M,
T-Shirt Basic,TSH-001,Apparel,,Piece,Brand A,85,210,168,12,,,yes,yes,,,,Size: L,TSH-001-L,
Single Product,SGL-002,General,,Piece,,100,250,200,20,2,100,yes,yes,BAR-002,Single item only,,,,
BIN SAEED,,PRINT,,Piece,BINSAEED,2150,2750,2350,0,5,500,yes,yes,,PRINT 3PC LAWN,,,,,
BIN SAEED,,PRINT,,Piece,BINSAEED,2150,2750,2350,5,,,yes,yes,,,,Size: S,SMALL,
BIN SAEED,,PRINT,,Piece,BINSAEED,2150,2750,2350,3,,,yes,yes,,,,Size: M,MEDIUM,
BIN SAEED,,PRINT,,Piece,BINSAEED,2150,2750,2350,2,,,yes,yes,,,,Size: L,LARGE,`;

export const ImportProductsModal = ({ isOpen, onClose, onSuccess }: ImportProductsModalProps) => {
  const { companyId, branchId } = useSupabase();
  const { generateDocumentNumberSafe, incrementNextNumber } = useDocumentNumbering();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [autoGenerateSku, setAutoGenerateSku] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setParsedRows([]);
    setImportStatus('idle');
    setImportError(null);
    setImportedCount(0);
    setSummary(null);
  }, []);

  const parseBool = (v: string): boolean => {
    const t = (v ?? '').trim().toLowerCase();
    return t === 'yes' || t === '1' || t === 'true' || t === 'y';
  };

  const parseCSV = useCallback((text: string): ParsedProductRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const colMap: Record<string, number> = {};
    header.forEach((h, i) => {
      const key = PRODUCT_CSV_COLUMNS[h] ?? h.replace(/\s+/g, '_');
      colMap[key] = i;
    });
    const nameIdx = colMap.name ?? header.findIndex((h) => PRODUCT_CSV_COLUMNS[h] === 'name');
    const skuIdx = colMap.sku ?? header.findIndex((h) => PRODUCT_CSV_COLUMNS[h] === 'sku');
    if (nameIdx < 0) return [];

    const rows: ParsedProductRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim());
      const name = (cells[nameIdx] ?? '').trim();
      if (!name) continue;
      const skuRaw = (cells[skuIdx] ?? '').trim();
      const costPrice = parseFloat(cells[colMap.cost_price ?? -1] ?? '0') || 0;
      const sellingPrice = parseFloat(cells[colMap.selling_price ?? -1] ?? '0') || 0;
      const wholesalePrice = parseFloat(cells[colMap.wholesale_price ?? -1] ?? '') || undefined;
      const openingStock = parseFloat(cells[colMap.opening_stock ?? -1] ?? '0') || 0;
      const minStock = parseInt(cells[colMap.min_stock ?? -1] ?? '', 10);
      const maxStock = parseInt(cells[colMap.max_stock ?? -1] ?? '', 10);
      const variationName = (cells[colMap.variation_name ?? -1] ?? '').trim() || undefined;
      const variationSku = (cells[colMap.variation_sku ?? -1] ?? '').trim() || undefined;
      const variationBarcode = (cells[colMap.variation_barcode ?? -1] ?? '').trim() || undefined;
      const trackStockRaw = (cells[colMap.track_stock ?? -1] ?? '').trim().toLowerCase();
      const isSellableRaw = (cells[colMap.is_sellable ?? -1] ?? '').trim().toLowerCase();
      const subcategory = (cells[colMap.subcategory ?? -1] ?? '').trim() || undefined;
      const imageUrl = (cells[colMap.image_url ?? -1] ?? '').trim() || undefined;
      rows.push({
        name,
        sku: skuRaw || '',
        category: (cells[colMap.category ?? -1] ?? '').trim() || undefined,
        subcategory,
        unit: (cells[colMap.unit ?? -1] ?? '').trim() || undefined,
        brand: (cells[colMap.brand ?? -1] ?? '').trim() || undefined,
        cost_price: costPrice,
        selling_price: sellingPrice,
        wholesale_price: wholesalePrice,
        opening_stock: openingStock,
        min_stock: Number.isNaN(minStock) ? undefined : minStock,
        max_stock: Number.isNaN(maxStock) ? undefined : maxStock,
        track_stock: trackStockRaw ? parseBool(trackStockRaw) : undefined,
        is_sellable: isSellableRaw ? parseBool(isSellableRaw) : undefined,
        barcode: (cells[colMap.barcode ?? -1] ?? '').trim() || undefined,
        description: (cells[colMap.description ?? -1] ?? '').trim() || undefined,
        variation_name: variationName,
        variation_sku: variationSku,
        variation_barcode: variationBarcode,
        image_url: imageUrl,
      });
    }
    return rows;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        const rows = parseCSV(text);
        if (rows.length === 0) {
          toast.error('No valid rows found. CSV must have a header row and at least one row with "name" column.');
          return;
        }
        setSelectedFile(file);
        setParsedRows(rows);
      };
      reader.readAsText(file);
    },
    [parseCSV]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const downloadTemplate = (format: 'csv' | 'xlsx') => {
    const filename = 'products_import_template.csv';
    const mimeType = 'text/csv;charset=utf-8;';
    const blob = new Blob([PRODUCT_CSV_TEMPLATE], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast.success('Template downloaded');
  };

  const handleImport = async () => {
    if (!selectedFile || !companyId || parsedRows.length === 0) return;

    setImportStatus('processing');
    setImportError(null);
    setSummary(null);

    const errors: ImportRowError[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const [categoriesFlat, units, brands] = await Promise.all([
        productCategoryService.getAllCategoriesFlat(companyId, { includeInactive: true }),
        unitService.getAll(companyId, { includeInactive: true }),
        brandService.getAll(companyId, { includeInactive: true }),
      ]);

      const topLevelCategories = categoriesFlat.filter((c: { parent_id: string | null }) => !c.parent_id);
      const categoryByName = new Map<string, string>(topLevelCategories.map((c: { name: string; id: string }) => [c.name.toLowerCase(), c.id]));
      const subcategoryByCategoryAndName = new Map<string, string>();
      categoriesFlat.forEach((c: { parent_id: string | null; name: string; id: string }) => {
        if (c.parent_id) {
          subcategoryByCategoryAndName.set(`${c.parent_id}|${c.name.toLowerCase()}`, c.id);
        }
      });

      const unitByName = new Map<string, string>(
        units.map((u: { name: string; id: string; short_code?: string }) => [u.name.toLowerCase(), u.id]).concat(
          units.map((u: { short_code?: string; id: string }) => [(u.short_code || '').toLowerCase(), u.id]).filter(([k]) => (k as string).length > 0)
        )
      );
      const brandByName = new Map<string, string>(brands.map((b: { name: string; id: string }) => [b.name.toLowerCase(), b.id]));

      const branchIdOrNull = branchId && branchId !== 'all' ? branchId : null;

      // Group rows by product: same name + (sku or '' for auto).
      const groupKey = (r: ParsedProductRow) => `${r.name}|${r.sku || '(auto)'}`;
      const groups = new Map<string, ParsedProductRow[]>();
      for (const row of parsedRows) {
        const key = groupKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      // Normalize variation rows: if "Size: S" / "SMALL" etc. were put in description/image_url columns (wrong place),
      // treat them as variation_name and variation_sku so variation product imports correctly.
      const VARIANT_LIKE = /^(Size|Color|Variant|Style):\s*.+|^(SMALL|MEDIUM|LARGE|S|M|L|XL|XXL)$/i;
      for (const rows of groups.values()) {
        for (const row of rows) {
          if (row.variation_name) continue;
          if (row.description && VARIANT_LIKE.test(row.description.trim())) {
            row.variation_name = row.description.trim();
            row.description = undefined;
          }
          if (row.image_url && !/^https?:\/\//i.test(row.image_url) && row.image_url.length <= 20 && !row.variation_sku) {
            row.variation_sku = row.image_url.trim();
            row.image_url = undefined;
          }
        }
      }

      for (const [key, rows] of groups) {
        const hasVariations = rows.some((r) => r.variation_name);
        const first = rows[0]!;
        const rowIndex = parsedRows.findIndex((r) => r === first) + 1;

        // Validation: category (and subcategory belongs to category), unit, brand
        let categoryId: string | null = null;
        if (first.subcategory && !first.category) {
          errors.push({ groupKey: key, productName: first.name, rowIndex, message: 'Subcategory requires category', type: 'validation' });
          skipped++;
          continue;
        }
        if (first.category) {
          const catId = categoryByName.get(first.category.toLowerCase()) ?? null;
          if (!catId) {
            errors.push({ groupKey: key, productName: first.name, rowIndex, message: `Category "${first.category}" not found`, type: 'validation' });
            skipped++;
            continue;
          }
          if (first.subcategory) {
            const subId = subcategoryByCategoryAndName.get(`${catId}|${first.subcategory.trim().toLowerCase()}`);
            if (!subId) {
              errors.push({ groupKey: key, productName: first.name, rowIndex, message: `Subcategory "${first.subcategory}" not found or does not belong to category "${first.category}"`, type: 'validation' });
              skipped++;
              continue;
            }
            categoryId = subId;
          } else {
            categoryId = catId;
          }
        }

        let unitId: string | null = null;
        if (first.unit) {
          const uKey = first.unit.trim().toLowerCase();
          unitId = unitByName.get(uKey) ?? units.find((u) => (u.short_code || '').toLowerCase() === uKey)?.id ?? null;
          if (!unitId) {
            errors.push({ groupKey: key, productName: first.name, rowIndex, message: `Unit "${first.unit}" not found`, type: 'validation' });
            skipped++;
            continue;
          }
        }

        if (first.brand && !brandByName.has(first.brand.toLowerCase())) {
          errors.push({ groupKey: key, productName: first.name, rowIndex, message: `Brand "${first.brand}" not found`, type: 'validation' });
          skipped++;
          continue;
        }
        const brandId = first.brand ? brandByName.get(first.brand.toLowerCase()) ?? null : null;

        let skuToUse = first.sku && !autoGenerateSku ? first.sku : '';
        if (!skuToUse) {
          try {
            skuToUse = await generateDocumentNumberSafe('production');
          } catch (e) {
            errors.push({ groupKey: key, productName: first.name, rowIndex, message: 'Failed to generate SKU', type: 'failed' });
            failed++;
            continue;
          }
        }

        try {
          const productData: Record<string, unknown> = {
            company_id: companyId,
            category_id: categoryId,
            brand_id: brandId,
            unit_id: unitId,
            name: first.name,
            sku: skuToUse,
            barcode: first.barcode || null,
            description: first.description || null,
            cost_price: first.cost_price,
            retail_price: first.selling_price,
            wholesale_price: first.wholesale_price ?? first.selling_price,
            current_stock: 0,
            min_stock: first.min_stock ?? 0,
            max_stock: first.max_stock ?? 1000,
            has_variations: hasVariations,
            is_rentable: false,
            is_sellable: first.is_sellable ?? true,
            track_stock: first.track_stock ?? true,
            is_active: true,
            is_combo_product: false,
          };
          if (first.image_url) {
            productData.image_urls = [first.image_url];
          }

          const product = await productService.createProduct(productData);
          if (!product?.id) {
            failed++;
            errors.push({ groupKey: key, productName: first.name, rowIndex, message: 'Create product returned no ID', type: 'failed' });
            continue;
          }

          if (autoGenerateSku || !first.sku) {
            incrementNextNumber('production');
          }

          if (!hasVariations) {
            const row = rows[0]!;
            if (row.opening_stock > 0) {
              const { error: movErr } = await inventoryService.insertOpeningBalanceMovement(
                companyId,
                branchIdOrNull,
                product.id,
                row.opening_stock,
                row.cost_price
              );
              if (movErr) {
                errors.push({ groupKey: key, productName: first.name, rowIndex, message: movErr.message || 'Opening stock failed', type: 'failed' });
                failed++;
              } else {
                created++;
              }
            } else {
              created++;
            }
            continue;
          }

          const variationRows = rows.filter((r) => r.variation_name);
          for (const row of variationRows) {
            const varSku = row.variation_sku?.trim() || `${skuToUse}-${(row.variation_name ?? '').replace(/\s+/g, '-')}`;
            const varRecord = await productService.createVariation({
              product_id: product.id,
              name: row.variation_name!,
              sku: varSku,
              barcode: row.variation_barcode || null,
              attributes: { variant: row.variation_name! },
              cost_price: row.cost_price,
              retail_price: row.selling_price,
              wholesale_price: row.wholesale_price ?? row.selling_price,
              current_stock: 0,
            });
            if (row.opening_stock > 0 && varRecord?.id) {
              await inventoryService.insertOpeningBalanceMovement(
                companyId,
                branchIdOrNull,
                product.id,
                row.opening_stock,
                row.cost_price,
                varRecord.id
              );
            }
          }
          created++;
        } catch (err: any) {
          const msg = err?.message ?? 'Unknown error';
          errors.push({ groupKey: key, productName: first.name, rowIndex, message: msg, type: 'failed' });
          failed++;
        }
      }

      setImportedCount(created);
      setSummary({ created, skipped, failed, errors });
      setImportStatus(errors.length > 0 ? 'error' : 'success');
      if (created > 0) {
        toast.success(`Imported ${created} product(s)` + (failed + skipped > 0 ? `; ${skipped} skipped, ${failed} failed` : ''));
        onSuccess?.();
      }
      if (failed > 0 || skipped > 0) {
        setImportError(`${created} created, ${skipped} skipped, ${failed} failed. See summary and download error report.`);
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      setImportError(msg);
      setImportStatus('error');
      setSummary({ created: 0, skipped: 0, failed: 1, errors: [{ groupKey: '', productName: '', rowIndex: 0, message: msg, type: 'failed' }] });
      toast.error('Import failed: ' + msg);
    }
  };

  const downloadErrorReport = useCallback(() => {
    if (!summary?.errors.length) return;
    const headers = ['Row', 'Product', 'SKU/Group', 'Type', 'Error'];
    const rows = summary.errors.map((e) => [e.rowIndex, e.productName, e.groupKey, e.type, e.message]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Error report downloaded');
  }, [summary]);

  const handleClose = () => {
    onClose();
    resetState();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={handleClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Upload size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Products</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload CSV to bulk import products</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">CSV Format (standard)</h3>
                  <ul className="text-xs text-gray-300 space-y-1">
                    <li>• <strong>name</strong> (required), <strong>sku</strong> (optional – auto if empty). <strong>selling_price</strong> required.</li>
                    <li>• <strong>Simple:</strong> One row, no variation_name. <strong>Variation:</strong> Multiple rows same name + <strong>variation_name</strong> (e.g. Size: S, Size: M) → one product with variations; parent has no stock.</li>
                    <li>• On variation rows keep <strong>barcode, description, image_url</strong> empty (use ,,,) so variation_name and variation_sku align. If &quot;Size: S&quot; is in description column it is still detected as variation.</li>
                    <li>• category, subcategory, unit, brand – optional; must exist if provided. Download template for correct column order.</li>
                    <li>• One row failure does not stop import; download error report for failed/skipped rows.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-white mb-2 block">SKU</label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateSku}
                  onChange={(e) => setAutoGenerateSku(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500"
                />
                Auto-generate SKU for all products (ignore SKU column; uses Settings → Numbering → Production)
              </label>
            </div>

            <div>
              <label className="text-sm font-semibold text-white mb-3 block">Step 1: Download Template</label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white gap-2"
                  onClick={() => downloadTemplate('csv')}
                >
                  <Download size={16} />
                  Download CSV Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white gap-2"
                  onClick={() => downloadTemplate('xlsx')}
                >
                  <Download size={16} />
                  Download Excel Template
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Both templates are CSV format. Excel can open CSV files directly.</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-white mb-3 block">Step 2: Upload File</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 transition-all',
                  isDragging ? 'border-blue-500 bg-blue-500/10' : selectedFile ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-gray-800/30'
                )}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 mx-auto flex items-center justify-center mb-3">
                      <FileText size={32} className="text-green-500" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400 mb-1">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                    <p className="text-xs text-green-400 mb-3">{parsedRows.length} product(s) ready to import</p>
                    <button onClick={() => { setSelectedFile(null); setParsedRows([]); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-700 mx-auto flex items-center justify-center mb-3">
                      <Upload size={32} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">Drag and drop your CSV here</p>
                    <p className="text-xs text-gray-400 mb-4">or</p>
                    <label className="inline-block">
                      <input type="file" accept=".csv" onChange={handleFileInputChange} className="hidden" />
                      <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg cursor-pointer inline-block transition-colors">
                        Browse Files
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-3">Supports: CSV only</p>
                  </div>
                )}
              </div>
            </div>

            {parsedRows.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 mb-2">Preview (first 10 rows). Validation runs on Import.</p>
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-gray-400">#</th>
                      <th className="text-left px-2 py-1.5 text-gray-400">Name</th>
                      <th className="text-left px-2 py-1.5 text-gray-400">SKU</th>
                      <th className="text-left px-2 py-1.5 text-gray-400">Variation</th>
                      <th className="text-right px-2 py-1.5 text-gray-400">Cost</th>
                      <th className="text-right px-2 py-1.5 text-gray-400">Price</th>
                      <th className="text-right px-2 py-1.5 text-gray-400">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-gray-800">
                        <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                        <td className="px-2 py-1.5 text-gray-300">{r.name}</td>
                        <td className="px-2 py-1.5 font-mono text-gray-400">{r.sku || '(auto)'}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.variation_name ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right text-gray-400">{r.cost_price}</td>
                        <td className="px-2 py-1.5 text-right text-gray-400">{r.selling_price}</td>
                        <td className="px-2 py-1.5 text-right text-gray-400">{r.opening_stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 10 && <p className="text-xs text-gray-500 px-2 py-1">+ {parsedRows.length - 10} more</p>}
              </div>
            )}

            {summary && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-2">
                <p className="text-sm font-semibold text-white">Summary</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-green-400">Created: {summary.created}</span>
                  <span className="text-amber-400">Skipped: {summary.skipped}</span>
                  <span className="text-red-400">Failed: {summary.failed}</span>
                </div>
                {summary.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">Errors:</p>
                    <ul className="text-xs text-gray-300 max-h-24 overflow-y-auto space-y-0.5">
                      {summary.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>Row {e.rowIndex}: {e.productName} — {e.message}</li>
                      ))}
                    </ul>
                    {summary.errors.length > 10 && <p className="text-gray-500 mt-1">+ {summary.errors.length - 10} more (see error report)</p>}
                    <Button type="button" variant="outline" size="sm" className="mt-2 h-8 text-xs bg-gray-800 border-gray-600 text-white hover:bg-gray-700" onClick={downloadErrorReport}>
                      <Download size={12} className="mr-1" />
                      Download error report CSV
                    </Button>
                  </div>
                )}
              </div>
            )}

            {importStatus !== 'idle' && (
              <div
                className={cn(
                  'p-4 rounded-xl border',
                  importStatus === 'processing' && 'bg-blue-500/10 border-blue-500/30',
                  importStatus === 'success' && 'bg-green-500/10 border-green-500/30',
                  importStatus === 'error' && 'bg-red-500/10 border-red-500/30'
                )}
              >
                <div className="flex items-center gap-3">
                  {importStatus === 'processing' && (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-blue-400">Processing import...</span>
                    </>
                  )}
                  {importStatus === 'success' && (
                    <>
                      <CheckCircle2 size={20} className="text-green-500" />
                      <span className="text-sm text-green-400">Imported {importedCount} product(s) successfully!</span>
                    </>
                  )}
                  {importStatus === 'error' && (
                    <>
                      <AlertCircle size={20} className="text-red-500" />
                      <span className="text-sm text-red-400">{importError || 'Import failed.'}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
            <Button onClick={handleClose} variant="outline" className="h-10 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white">
              {importStatus === 'success' ? 'Close' : 'Cancel'}
            </Button>
            {importStatus !== 'success' && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || parsedRows.length === 0 || importStatus === 'processing'}
                className="h-10 bg-blue-600 hover:bg-blue-500 text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importStatus === 'processing' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import {parsedRows.length} Product(s)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
