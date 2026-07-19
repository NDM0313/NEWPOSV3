import React, { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import {
  productService,
  mapProductVariationApiToFormRow,
  formatVariationName,
} from '@/app/services/productService';
import { variationMasterService } from '@/app/services/variationMasterService';
import { variationLibraryService } from '@/app/services/variationLibraryService';
import { inventoryService } from '@/app/services/inventoryService';
import { brandService } from '@/app/services/brandService';
import { productCategoryService } from '@/app/services/productCategoryService';
import { unitService } from '@/app/services/unitService';
import { contactService } from '@/app/services/contactService';
import { branchService } from '@/app/services/branchService';
import { comboService } from '@/app/services/comboService';
import { supabase } from '@/lib/supabase';
import { uploadProductImages, removeProductImagesFromStorage } from '@/app/utils/productImageUpload';
import { parseVariationAttributesRaw, publicVariationAttributes } from '@/app/utils/variationFieldMap';
import {
  duplicateProductName,
  duplicateVariationRows,
  duplicateVariantAttributes,
  duplicateImageUrls,
} from '@/app/utils/productDuplicateUtils';
import { ProductImage } from './ProductImage';
import { getSupabaseStorageDashboardUrl } from '@/app/utils/paymentAttachmentUrl';
import { toast } from 'sonner';
import { mapPool, perfStart } from '@/app/utils/perfTiming';
import {
  X,
  Upload,
  Plus,
  Minus,
  Trash2,
  RefreshCcw,
  Barcode,
  Package,
  DollarSign,
  Clock,
  Shield,
  ChevronDown,
  Search,
} from "lucide-react";
import { clsx } from "clsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SearchableSelect } from "../ui/searchable-select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

// Define the validation schema (aligned with submit and DB)
const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  // Empty allowed — onSubmit generates SKU (create/edit parity)
  sku: z.string().optional(),
  barcodeType: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  unit: z.string().optional(),

  // Sales Pricing (Always Sellable in Retail Mode)
  purchasePrice: z.coerce.number().min(0).optional(),
  margin: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce
    .number()
    .min(0.01, "Selling price is required"),
  wholesalePrice: z.coerce.number().min(0).optional(),
  taxType: z.string().optional(),

  // Rental Pricing (Optional)
  rentalPrice: z.coerce.number().min(0).optional(),
  securityDeposit: z.coerce.number().min(0).optional(),
  rentalDuration: z.coerce.number().min(1).optional(),

  // Inventory (initialStock = current_stock, alertQty = min_stock)
  stockManagement: z.boolean().default(true),
  initialStock: z.coerce.number().min(0).optional(),
  alertQty: z.coerce.number().min(0).optional(),
  maxStock: z.coerce.number().min(0).optional(),

  // Details
  description: z.string().optional(),
  notes: z.string().optional(),

  // Supplier
  supplier: z.string().optional(),
  supplierCode: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const PRODUCT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prefer uuid; accept string id only when it is a UUID (never list index numbers). */
function resolveEditProductId(
  product: { uuid?: unknown; id?: unknown } | null | undefined,
): string | null {
  if (!product) return null;
  const uuid = product.uuid;
  if (typeof uuid === 'string' && PRODUCT_UUID_RE.test(uuid)) return uuid;
  const id = product.id;
  if (typeof id === 'string' && PRODUCT_UUID_RE.test(id)) return id;
  return null;
}

type ProductFormTab = 'basic' | 'pricing' | 'inventory' | 'media' | 'details' | 'variations' | 'combos';

const FIELD_ERROR_TAB: Partial<Record<keyof ProductFormValues, ProductFormTab>> = {
  name: 'basic',
  sku: 'basic',
  brand: 'basic',
  category: 'basic',
  subCategory: 'basic',
  unit: 'basic',
  barcodeType: 'basic',
  barcode: 'basic',
  purchasePrice: 'pricing',
  margin: 'pricing',
  sellingPrice: 'pricing',
  wholesalePrice: 'pricing',
  taxType: 'pricing',
  rentalPrice: 'pricing',
  securityDeposit: 'pricing',
  rentalDuration: 'pricing',
  stockManagement: 'inventory',
  initialStock: 'inventory',
  alertQty: 'inventory',
  maxStock: 'inventory',
  description: 'details',
  notes: 'details',
  supplier: 'details',
  supplierCode: 'details',
};

// Ensure number inputs never show empty on click/clear — store 0 instead of ""
const setValueAsNumber = (v: unknown): number => {
  if (v === '' || v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

interface EnhancedProductFormProps {
  product?: any; // Product data for edit mode
  /** When set, pre-fill Add form from this product id (create mode, not update). */
  duplicateFromProductId?: string;
  onCancel: () => void;
  onSave: (product?: any) => void;
  onSaveAndAdd?: (product: any) => void;
}

export const EnhancedProductForm = ({
  product: initialProduct,
  duplicateFromProductId,
  onCancel,
  onSave,
  onSaveAndAdd,
}: EnhancedProductFormProps) => {
  const { companyId, branchId } = useSupabase();
  const settings = useSettings();
  const { modules } = settings;
  const { generateDocumentNumber, generateDocumentNumberSafe, incrementNextNumber } = useDocumentNumbering();
  const [saving, setSaving] = useState(false);
  /** Synchronous guard to prevent double submit (state update is async). */
  const submitInProgressRef = useRef(false);
  /** Prevent re-hydrating edit form (wipes in-progress name/price edits). Key = `${id}:list|full`. */
  const hydratedKeyRef = useRef<string | null>(null);
  /** Issue auto SKU once for new-product create (generateDocumentNumberSafe identity churn must not re-run). */
  const skuAutoIssuedRef = useRef(false);
  /** Seed duplicate form once per source product id. */
  const duplicateSeededKeyRef = useRef<string | null>(null);
  /** Enable Variations toggle: default OFF for new product, from DB for edit. When ON, parent stock locked at 0. */
  const [enableVariations, setEnableVariations] = useState(false);
  const [blockDisableVariationsModalOpen, setBlockDisableVariationsModalOpen] = useState(false);
  
  /** Enable Combo Product toggle: default OFF for new product, from DB for edit. When ON, product becomes virtual bundle - no stock. */
  const [isComboProduct, setIsComboProduct] = useState(false);
  const [blockEnableComboModalOpen, setBlockEnableComboModalOpen] = useState(false);
  const [blockDisableComboModalOpen, setBlockDisableComboModalOpen] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [isRentalOptionsOpen, setIsRentalOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'inventory' | 'media' | 'details' | 'variations' | 'combos'>('basic');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [subCategories, setSubCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol?: string }>>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [companyBranches, setCompanyBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  // Variations State
  const [variantAttributes, setVariantAttributes] = useState<Array<{
    name: string;
    values: string[];
  }>>([]);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState<number | null>(null);
  const [blockVariationsModalOpen, setBlockVariationsModalOpen] = useState(false);
  /** When in edit mode, full product fetched from API (with variations, category_id, etc.). Form hydrates from this. */
  const [fullProductForEdit, setFullProductForEdit] = useState<any>(null);
  const [loadingFullProduct, setLoadingFullProduct] = useState(false);
  /** Duplicate mode: source product fetched from API before seeding create form. */
  const [duplicateSourceFull, setDuplicateSourceFull] = useState<any>(null);
  const [loadingDuplicateSource, setLoadingDuplicateSource] = useState(false);
  const isDuplicateMode = !!duplicateFromProductId && !initialProduct;
  const [generatedVariations, setGeneratedVariations] = useState<
    Array<{
      id?: string;
      combination: Record<string, string>;
      sku: string;
      price: number;
      purchasePrice: number;
      stock: number;
      barcode: string;
    }>
  >([]);
  /** Settings → Inventory → Variations master (searchable picks + inline merge). */
  const [variationMaster, setVariationMaster] = useState<Record<string, string[]>>({});
  const [productsWithVariations, setProductsWithVariations] = useState<Array<{ id: string; name: string; sku: string; variations?: Array<{ attributes?: Record<string, string> }> }>>([]);
  const [variationsForCopy, setVariationsForCopy] = useState<Array<{ productId: string; variationId: string; product: any; supplierName: string; label: string }>>([]);
  const [loadingProductsWithVariations, setLoadingProductsWithVariations] = useState(false);
  const [copyFromVariationId, setCopyFromVariationId] = useState<string>('');

  // Combos State
  const [combos, setCombos] = useState<Array<{
    id: string;
    combo_name: string;
    combo_price: number;
    items: Array<{
      id?: string;
      product_id: string;
      product_name?: string;
      product_sku?: string;
      variation_id?: string | null;
      qty: number;
      unit_price?: number | null;
    }>;
  }>>([]);
  const [currentComboItems, setCurrentComboItems] = useState<Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    variation_id?: string | null;
    qty: number;
    unit_price?: number | null;
  }>>([]);
  const [comboName, setComboName] = useState('');
  const [comboFinalPrice, setComboFinalPrice] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Array<{
    id: string;
    name: string;
    sku: string;
    retail_price: number;
    has_variations: boolean;
  }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcodeType: "code128",
      barcode: "",
      stockManagement: true,
      purchasePrice: 0,
      margin: 30,
      sellingPrice: 0,
      wholesalePrice: 0,
      rentalPrice: 0,
      securityDeposit: 0,
      rentalDuration: 3,
      initialStock: 0,
      alertQty: 0,
      maxStock: 1000,
    },
  });

  const stockManagement = watch("stockManagement");
  const selectedUnitId = watch('unit');
  const selectedUnitAllowsDecimal =
    units.find((u) => u.id === selectedUnitId)?.allow_decimal ?? false;

  const onInvalid = useCallback((errors: FieldErrors<ProductFormValues>) => {
    if (import.meta.env.DEV) {
      console.warn('[PRODUCT FORM] validation', errors);
    }
    const firstKey = Object.keys(errors)[0] as keyof ProductFormValues | undefined;
    const err = firstKey ? errors[firstKey] : undefined;
    const msg =
      err && typeof err === 'object' && 'message' in err && err.message
        ? String(err.message)
        : 'Please fix the form errors';
    toast.error(msg);
    if (firstKey && FIELD_ERROR_TAB[firstKey]) {
      setActiveTab(FIELD_ERROR_TAB[firstKey]!);
    }
  }, []);

  const parseVariationQtyInput = (raw: string): number => {
    if (selectedUnitAllowsDecimal) {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    return Math.max(0, parseInt(raw, 10) || 0);
  };

  // Load only parent-level categories (no sub-categories in this dropdown)
  useEffect(() => {
    const loadCategories = async () => {
      if (!companyId) return;
      try {
        setLoadingCategories(true);
        const data = await productCategoryService.getCategories(companyId);
        setCategories(data.map((c) => ({ id: c.id, name: c.name })));
      } catch (error) {
        console.error('[PRODUCT FORM] Error loading categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, [companyId]);

  // Load brands from database
  useEffect(() => {
    const loadBrands = async () => {
      if (!companyId) return;
      try {
        setLoadingBrands(true);
        const data = await brandService.getAll(companyId);
        setBrands(data.map((b) => ({ id: b.id, name: b.name })));
      } catch (error) {
        console.error('[PRODUCT FORM] Error loading brands:', error);
        setBrands([]);
      } finally {
        setLoadingBrands(false);
      }
    };
    loadBrands();
  }, [companyId]);

  // Load units from database (Settings → Inventory → Units)
  useEffect(() => {
    const loadUnits = async () => {
      if (!companyId) return;
      try {
        setLoadingUnits(true);
        const data = await unitService.getAll(companyId);
        setUnits(data.map((u) => ({ 
          id: u.id, 
          name: u.name, 
          symbol: u.symbol,
          short_code: u.short_code,
          is_default: u.is_default,
          allow_decimal: u.allow_decimal
        })));
        
        // Set default unit when creating (not editing): use Settings → Inventory → Default Unit, else unit with is_default, else first
        if (!initialProduct) {
          const currentUnit = getValues('unit');
          if (!currentUnit) {
            const settingsDefaultId = settings.inventorySettings?.defaultUnitId;
            const defaultUnit = (settingsDefaultId && data.find(u => u.id === settingsDefaultId))
              || data.find(u => u.is_default)
              || data[0];
            if (defaultUnit) {
              setValue('unit', defaultUnit.id);
            }
          }
        }
      } catch (error) {
        console.error('[PRODUCT FORM] Error loading units:', error);
        setUnits([]);
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, [companyId, initialProduct, setValue, getValues, settings.inventorySettings?.defaultUnitId]);

  // Load full variation master whenever company is known (not gated on enableVariations — avoids empty
  // datalists until toggle; ensures COLOR/SIZE/etc. match Settings → Inventory → Variations).
  useEffect(() => {
    if (!companyId) return;
    // Merge Settings → Inventory → Variations master WITH the global library
    // (new 20260500 tables) so newly-added attributes auto-appear in the picker.
    void (async () => {
      try {
        const [legacy, library] = await Promise.all([
          variationMasterService.get(companyId).catch(() => ({} as Record<string, string[]>)),
          variationLibraryService.listAttributes(companyId).catch(() => []),
        ]);
        const merged: Record<string, string[]> = { ...(legacy || {}) };
        for (const attr of library) {
          const existing = new Set((merged[attr.name] || []).map((v) => v.toLowerCase()));
          const add = attr.values.map((v) => v.value).filter((v) => !existing.has(v.toLowerCase()));
          merged[attr.name] = [...(merged[attr.name] || []), ...add];
        }
        setVariationMaster(merged);
      } catch {
        setVariationMaster({});
      }
    })();
  }, [companyId]);

  // Load suppliers from contacts (type = supplier)
  useEffect(() => {
    const loadSuppliers = async () => {
      if (!companyId) return;
      try {
        setLoadingSuppliers(true);
        const data = await contactService.getAllContacts(companyId, 'supplier');
        setSuppliers((data || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name || 'Unnamed' })));
      } catch (error) {
        console.error('[PRODUCT FORM] Error loading suppliers:', error);
        setSuppliers([]);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    void branchService.getBranchesCached(companyId).then((branches) => {
      const list = (branches || []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }));
      setCompanyBranches(list);
      const productId = initialProduct?.uuid ?? initialProduct?.id;
      if (list.length > 1 && !productId) {
        setSelectedBranchIds(list.map((b) => b.id));
      }
    }).catch(() => setCompanyBranches([]));
  }, [companyId, initialProduct?.uuid, initialProduct?.id]);

  useEffect(() => {
    const productId = initialProduct?.uuid ?? initialProduct?.id;
    if (!companyId || !productId || companyBranches.length <= 1) return;
    void productService.getProductBranchIds(companyId, productId).then((ids) => {
      if (ids.length > 0) setSelectedBranchIds(ids);
      else setSelectedBranchIds(companyBranches.map((b) => b.id));
    }).catch(() => {});
  }, [companyId, initialProduct?.uuid, initialProduct?.id, companyBranches]);

  // Load variations for "copy from" – format: Supplier — AttributeName: Value (e.g. variant: Size: L, SUPLIER: Ibrahim)
  useEffect(() => {
    if (!companyId || activeTab !== 'variations' || !enableVariations) return;
    let cancelled = false;
    setLoadingProductsWithVariations(true);
    productService.getProductsWithVariationsForCopy(companyId)
      .then((data: any) => {
        if (cancelled) return;
        const withVars = (data || []).filter(
          (p: any) => p.has_variations && Array.isArray(p.variations) && p.variations.length > 0
        );
        setProductsWithVariations(
          withVars.map((p: any) => ({
            id: p.id,
            name: p.name || 'Unnamed',
            sku: p.sku || '',
            variations: p.variations || [],
          }))
        );
        const flat: Array<{ productId: string; variationId: string; product: any; supplierName: string; label: string }> = [];
        for (const p of withVars) {
          const supplierId = (p as any).supplier_id || (p as any).supplier;
          const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? '—';
          (p.variations || []).forEach((v: any, idx: number) => {
            const attrs = v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
            for (const [attrName, val] of Object.entries(attrs)) {
              if (!attrName || val == null) continue;
              const label = `${attrName}: ${val}`;
              flat.push({
                productId: p.id,
                variationId: `${p.id}-${idx}-${attrName}-${String(val).replace(/\s/g, '_')}`,
                product: p,
                supplierName,
                label,
              });
            }
          });
        }
        setVariationsForCopy(flat);
      })
      .catch(() => {
        if (!cancelled) setProductsWithVariations([]);
        if (!cancelled) setVariationsForCopy([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProductsWithVariations(false);
      });
    return () => { cancelled = true; };
  }, [companyId, activeTab, enableVariations, suppliers]);

  const selectedCategoryId = watch('category');

  // Load sub-categories only when a category is selected (filtered by category)
  useEffect(() => {
    if (!companyId || !selectedCategoryId) {
      setSubCategories([]);
      return;
    }
    const loadSubCategories = async () => {
      try {
        const data = await productCategoryService.getSubCategories(companyId, selectedCategoryId);
        setSubCategories(data.map((c) => ({ id: c.id, name: c.name })));
      } catch (error) {
        console.error('[PRODUCT FORM] Error loading sub-categories:', error);
        setSubCategories([]);
      }
    };
    loadSubCategories();
  }, [companyId, selectedCategoryId]);

  // PRD-0001 style from Settings → Numbering (must be defined before effect that uses it)
  const generateSKU = useCallback(() => {
    const n = generateDocumentNumber('production');
    return (n && String(n).trim()) ? n : 'PRD-0001';
  }, [generateDocumentNumber]);

  // Auto-generate unique SKU for new product only — once per create session
  const editProductId = initialProduct?.uuid ?? initialProduct?.id;
  useEffect(() => {
    if (editProductId || duplicateFromProductId || !companyId) {
      if (editProductId || duplicateFromProductId) skuAutoIssuedRef.current = false;
      return;
    }
    if (skuAutoIssuedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const nextSKU = await generateDocumentNumberSafe('production');
        if (!cancelled && nextSKU) {
          skuAutoIssuedRef.current = true;
          setValue('sku', nextSKU);
        }
      } catch {
        if (!cancelled) {
          skuAutoIssuedRef.current = true;
          setValue('sku', generateSKU());
        }
      }
    })();
    return () => { cancelled = true; };
    // Intentionally omit generateDocumentNumberSafe / generateSKU — unstable identities re-issue SKUs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot SKU; helpers read from latest render
  }, [companyId, duplicateFromProductId, editProductId, setValue]);

  // Duplicate mode: fetch full source product
  useEffect(() => {
    if (!duplicateFromProductId || initialProduct) {
      setDuplicateSourceFull(null);
      setLoadingDuplicateSource(false);
      return;
    }
    let cancelled = false;
    setLoadingDuplicateSource(true);
    setDuplicateSourceFull(null);
    productService.getProduct(duplicateFromProductId)
      .then((full) => {
        if (!cancelled) setDuplicateSourceFull(full);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[PRODUCT FORM] Failed to load product for duplicate:', err);
          toast.error('Could not load product to duplicate');
          setDuplicateSourceFull(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDuplicateSource(false);
      });
    return () => { cancelled = true; };
  }, [duplicateFromProductId, initialProduct]);

  // Duplicate mode: seed create form once per source id
  useEffect(() => {
    if (!duplicateFromProductId) {
      duplicateSeededKeyRef.current = null;
      return;
    }
    if (!isDuplicateMode || !duplicateSourceFull) return;
    if (duplicateSeededKeyRef.current === duplicateFromProductId) return;

    let cancelled = false;
    const source = duplicateSourceFull;
    (async () => {
      let nextSku = '';
      try {
        nextSku = await generateDocumentNumberSafe('production');
      } catch {
        nextSku = generateSKU();
      }
      if (cancelled) return;

      duplicateSeededKeyRef.current = duplicateFromProductId;

      setValue('name', duplicateProductName(source.name || ''));
      setValue('sku', nextSku);
      setValue('barcodeType', (source as any).barcode_type || 'code128');
      setValue('barcode', '');
      setValue('purchasePrice', source.cost_price ?? 0);
      setValue('sellingPrice', source.retail_price ?? 0);
      setValue('wholesalePrice', source.wholesale_price ?? source.retail_price ?? 0);
      setValue('rentalPrice', source.rental_price_daily ?? 0);
      setValue('alertQty', source.min_stock ?? 0);
      setValue('maxStock', source.max_stock ?? 1000);
      setValue('initialStock', 0);
      setValue('description', source.description || '');
      setValue('brand', source.brand_id || '');
      setValue('unit', source.unit_id || '');
      setValue('supplier', (source as any).supplier_id || (source as any).supplier || '');
      setValue('supplierCode', (source as any).supplier_code || (source as any).supplierCode || '');

      const catId = source.category_id || source.category?.id || '';
      if (catId) {
        try {
          const cat = await productCategoryService.getById(catId);
          if (cancelled) return;
          if (cat.parent_id) {
            setValue('category', cat.parent_id);
            setValue('subCategory', cat.id);
          } else {
            setValue('category', cat.id);
            setValue('subCategory', '');
          }
        } catch {
          if (!cancelled) {
            setValue('category', catId);
            setValue('subCategory', '');
          }
        }
      } else {
        setValue('category', '');
        setValue('subCategory', '');
      }

      const hasVar = !!(source.has_variations ?? (source.variations?.length > 0));
      setEnableVariations(hasVar);
      if (hasVar && Array.isArray(source.variations) && source.variations.length > 0) {
        setVariantAttributes(duplicateVariantAttributes(source.variations));
        setGeneratedVariations(duplicateVariationRows(source.variations, nextSku));
      } else {
        setVariantAttributes([]);
        setGeneratedVariations([]);
      }

      setExistingImageUrls(duplicateImageUrls(source));
      setIsComboProduct(!!source.is_combo_product);
      setCurrentComboItems([]);
      setCombos([]);
    })();
    return () => { cancelled = true; };
    // Intentionally omit generateDocumentNumberSafe / generateSKU — unstable identities wipe the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot duplicate seed
  }, [isDuplicateMode, duplicateFromProductId, duplicateSourceFull, setValue]);

  // Edit mode: fetch full product by id so we have variations, category_id, unit_id, brand_id (list product often has only display fields)
  useEffect(() => {
    const productId = initialProduct?.uuid || initialProduct?.id;
    if (!productId || typeof productId !== 'string') {
      setFullProductForEdit(null);
      setLoadingFullProduct(false);
      return;
    }
    let cancelled = false;
    setLoadingFullProduct(true);
    setFullProductForEdit(null);
    productService.getProduct(productId)
      .then((full) => {
        if (!cancelled) {
          setFullProductForEdit(full);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[PRODUCT FORM] Failed to load full product for edit:', err);
          setFullProductForEdit(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFullProduct(false);
      });
    return () => { cancelled = true; };
  }, [initialProduct?.uuid, initialProduct?.id]);

  // Sync enableVariations from product (use full product when available)
  useEffect(() => {
    const source = fullProductForEdit ?? initialProduct;
    if (source) {
      setEnableVariations(!!(source.has_variations ?? (source.variations?.length > 0)));
    } else if (!initialProduct) {
      setEnableVariations(false);
    }
  }, [initialProduct, fullProductForEdit]);

  // Pre-populate once per product id (list → full). Do not re-run on branch/object churn — that wipes edits.
  useEffect(() => {
    let cancelled = false;
    const productId = initialProduct?.uuid ?? initialProduct?.id;

    if (!productId) {
      if (hydratedKeyRef.current !== null) {
        hydratedKeyRef.current = null;
        setExistingImageUrls([]);
        setIsComboProduct(false);
        setFullProductForEdit(null);
        setGeneratedVariations([]);
        setVariantAttributes([]);
      }
      return;
    }

    const source = fullProductForEdit ?? initialProduct;
    if (!source) return;

    const key = `${productId}:${fullProductForEdit ? 'full' : 'list'}`;
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;

    setValue('name', source.name || '');
    setValue('sku', source.sku || '');
    setValue('barcodeType', (source as any).barcode_type || 'code128');
    setValue('barcode', source.barcode || '');
    setValue('purchasePrice', source.cost_price ?? (source as any).purchasePrice ?? 0);
    setValue('sellingPrice', source.retail_price ?? (source as any).sellingPrice ?? 0);
    setValue('wholesalePrice', source.wholesale_price ?? source.retail_price ?? 0);
    setValue('rentalPrice', source.rental_price_daily ?? 0);
    setValue('alertQty', source.min_stock ?? (source as any).lowStockThreshold ?? 0);
    setValue('maxStock', source.max_stock ?? 1000);
    setValue('description', source.description || '');
    setValue('brand', source.brand_id || '');
    setValue('unit', source.unit_id || '');
    setValue('supplier', (source as any).supplier_id || (source as any).supplier || '');
    setValue('supplierCode', (source as any).supplier_code || (source as any).supplierCode || '');
    const catId = source.category_id || source.category?.id || '';
    if (catId) {
      productCategoryService.getById(catId).then((cat) => {
        if (cancelled) return;
        if (cat.parent_id) {
          setValue('category', cat.parent_id);
          setValue('subCategory', cat.id);
        } else {
          setValue('category', cat.id);
          setValue('subCategory', '');
        }
      }).catch(() => {
        if (!cancelled) {
          setValue('category', catId);
          setValue('subCategory', '');
        }
      });
    } else {
      setValue('category', '');
      setValue('subCategory', '');
    }
    if (source.variations && Array.isArray(source.variations) && source.variations.length > 0) {
      const firstParsed = publicVariationAttributes(
        parseVariationAttributesRaw(source.variations[0]?.attributes)
      );
      const attrNames = Object.keys(firstParsed).sort((a, b) => a.localeCompare(b));
      if (attrNames.length > 0) {
        const valuesByAttr: Record<string, Set<string>> = {};
        attrNames.forEach((k) => {
          valuesByAttr[k] = new Set();
        });
        source.variations.forEach((v: any) => {
          const a = publicVariationAttributes(parseVariationAttributesRaw(v.attributes));
          attrNames.forEach((k) => {
            if (a[k] != null && a[k] !== '') valuesByAttr[k].add(String(a[k]));
          });
        });
        setVariantAttributes(
          attrNames.map((name) => ({
            name,
            values: Array.from(valuesByAttr[name] || []).sort((a, b) => a.localeCompare(b)),
          }))
        );
      } else {
        setVariantAttributes([]);
      }
      const mapped = (source.variations as any[]).map((v) =>
        mapProductVariationApiToFormRow(v as Record<string, unknown>)
      );
      const pid = (source as any).uuid || (source as any).id;
      (async () => {
        if (companyId && pid && mapped.some((m) => m.id)) {
          const branchScope = branchId && branchId !== 'all' ? branchId : null;
          const withMovement = await Promise.all(
            mapped.map(async (row) => {
              if (!row.id) return row;
              try {
                const qty = await inventoryService.getStock(companyId, pid as string, row.id, branchScope);
                return { ...row, stock: qty };
              } catch {
                return row;
              }
            })
          );
          if (!cancelled) setGeneratedVariations(withMovement);
        } else if (!cancelled) {
          setGeneratedVariations(mapped);
        }
      })();
    } else {
      setGeneratedVariations([]);
      setVariantAttributes([]);
    }
    const urls = (source as any)?.image_urls;
    setExistingImageUrls(Array.isArray(urls) ? [...urls] : []);
    if (source.is_combo_product !== undefined) {
      setIsComboProduct(!!source.is_combo_product);
    }
    if (productId) loadProductCombos(productId);

    return () => {
      cancelled = true;
    };
  }, [fullProductForEdit, initialProduct?.uuid, initialProduct?.id, setValue]);

  /** Movement-based stock for edit (products.current_stock is not selected in getProduct). */
  useEffect(() => {
    const source = fullProductForEdit ?? initialProduct;
    const pid = source?.uuid || source?.id;
    if (!companyId || !pid || typeof pid !== 'string') return;
    let cancelled = false;
    const hasVar = !!(source?.has_variations ?? (source?.variations && source.variations.length > 0));
    const branchScope = branchId && branchId !== 'all' ? branchId : null;
    if (hasVar || (source as any)?.is_combo_product) {
      setValue('initialStock', 0, { shouldValidate: false, shouldDirty: false });
      return;
    }
    (async () => {
      try {
        const qty = await inventoryService.getStock(companyId, pid, null, branchScope);
        if (!cancelled) setValue('initialStock', Math.round(qty * 100) / 100, { shouldValidate: false, shouldDirty: false });
      } catch {
        const fallback = Number((source as any)?.stock ?? (source as any)?.current_stock ?? 0) || 0;
        if (!cancelled) setValue('initialStock', fallback, { shouldValidate: false, shouldDirty: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fullProductForEdit, initialProduct, companyId, branchId, setValue]);

  // Load available products for combo search (exclude combo products and current product)
  useEffect(() => {
    if (modules.combosEnabled && isComboProduct && companyId) {
      loadAvailableProducts();
    } else {
      setAvailableProducts([]);
    }
  }, [modules.combosEnabled, isComboProduct, companyId]);

  // Load available products for combo (non-combo products only)
  const loadAvailableProducts = async () => {
    if (!companyId) return;
    setLoadingProducts(true);
    try {
      const currentProductId = initialProduct?.uuid || initialProduct?.id;
      const isValidUuid = typeof currentProductId === 'string' && currentProductId.length === 36 && /^[0-9a-f-]{36}$/i.test(currentProductId);
      let query = supabase
        .from('products')
        .select('id, name, sku, retail_price, has_variations')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .eq('is_combo_product', false); // Exclude combo products
      if (isValidUuid) {
        query = query.neq('id', currentProductId); // Exclude current product only when id is a valid UUID
      }
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (error: any) {
      console.error('[PRODUCT FORM] Error loading products for combo:', error);
      toast.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load existing combos for product
  const loadProductCombos = async (productId: string) => {
    if (!companyId || !productId) return;
    try {
      const combo = await comboService.getComboByProductId(productId, companyId);
      if (combo) {
        // Load items with product details
        const itemsWithDetails = await comboService.getComboItemsWithDetails(combo.id, companyId);
        setCombos([{
          id: combo.id,
          combo_name: combo.combo_name,
          combo_price: combo.combo_price,
          items: itemsWithDetails.map(item => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            variation_id: item.variation_id,
            qty: item.qty,
            unit_price: item.unit_price,
          })),
        }]);
      }
    } catch (error: any) {
      console.error('[PRODUCT FORM] Error loading combos:', error);
    }
  };

  /** Optional helper: only when user edits Profit Margin (%), recompute selling from purchase. */
  const applySellingFromMargin = useCallback(
    (marginRaw: unknown) => {
      const marginNum = setValueAsNumber(marginRaw);
      const purchasePriceNum = setValueAsNumber(getValues('purchasePrice'));
      if (purchasePriceNum > 0 && marginNum > 0) {
        const sp = purchasePriceNum + (purchasePriceNum * marginNum) / 100;
        if (Number.isFinite(sp)) {
          setValue('sellingPrice', Number(sp.toFixed(2)), { shouldValidate: false, shouldDirty: true });
        }
      }
    },
    [getValues, setValue],
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setImages((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } =
    useDropzone({ onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] }, maxSize: 5 * 1024 * 1024 });

  const generateSKUForForm = async () => {
    if (initialProduct) {
      setValue("sku", initialProduct.sku || getValues('sku'));
      return;
    }
    const nextSKU = await generateDocumentNumberSafe('production');
    if (nextSKU) setValue("sku", nextSKU);
    else setValue("sku", generateSKU());
  };

  // Enable Variations toggle: with safety checks when editing
  const handleEnableVariationsChange = async (checked: boolean) => {
    const productId = initialProduct?.uuid ?? initialProduct?.id;
    if (checked) {
      if (productId) {
        const parentCount = await inventoryService.getParentLevelMovementCount(productId);
        if (parentCount > 0) {
          setBlockVariationsModalOpen(true);
          return;
        }
      }
      setEnableVariations(true);
      setValue('initialStock', 0, { shouldValidate: false });
    } else {
      if (productId && (initialProduct?.has_variations || generatedVariations.length > 0)) {
        const variationCount = await inventoryService.getVariationLevelMovementCount(productId);
        if (variationCount > 0) {
          setBlockDisableVariationsModalOpen(true);
          return;
        }
      }
      setEnableVariations(false);
      setGeneratedVariations([]);
      setVariantAttributes([]);
      if (activeTab === 'variations') setActiveTab('inventory');
    }
  };

  // Enable Combo Product toggle: with safety checks (like variations)
  const handleEnableComboChange = async (checked: boolean) => {
    const productId = initialProduct?.uuid ?? initialProduct?.id;
    if (checked) {
      // BLOCK 1: If product has stock movements, cannot enable combo
      if (productId) {
        const parentCount = await inventoryService.getParentLevelMovementCount(productId);
        if (parentCount > 0) {
          setBlockEnableComboModalOpen(true);
          return;
        }
      }
      setIsComboProduct(true);
      setValue('initialStock', 0, { shouldValidate: false });
      if (!modules.combosEnabled) {
        toast.error('Combo module is disabled. Enable it in Settings first.');
        return;
      }
    } else {
      // BLOCK 2: If product has combo items, cannot disable combo
      if (productId && combos.length > 0) {
        setBlockDisableComboModalOpen(true);
        return;
      }
      setIsComboProduct(false);
      setCombos([]);
      setCurrentComboItems([]);
      setComboName('');
      setComboFinalPrice(0);
      if (activeTab === 'combos') setActiveTab('inventory');
    }
  };

  // Variations Functions
  const persistVariationMasterMerge = async (next: Record<string, string[]>) => {
    if (!companyId) return;
    try {
      await variationMasterService.save(companyId, next);
      setVariationMaster(next);
    } catch {
      /* non-blocking */
    }
  };

  const addVariantAttribute = () => {
    const name = newAttributeName.trim();
    if (name && !variantAttributes.some((attr) => attr.name === name)) {
      setVariantAttributes([...variantAttributes, { name, values: [] }]);
      setNewAttributeName('');
      if (companyId) {
        const next = { ...variationMaster };
        if (!next[name]) next[name] = [];
        void persistVariationMasterMerge(next);
      }
    }
  };

  const addAttributeValue = () => {
    if (selectedAttributeIndex !== null && newAttributeValue.trim()) {
      const updatedAttributes = [...variantAttributes];
      const val = newAttributeValue.trim();
      const attrName = updatedAttributes[selectedAttributeIndex].name;
      if (!updatedAttributes[selectedAttributeIndex].values.includes(val)) {
        updatedAttributes[selectedAttributeIndex].values.push(val);
        setVariantAttributes(updatedAttributes);
        setNewAttributeValue('');
        if (companyId && attrName) {
          const next = { ...variationMaster };
          const list = new Set([...(next[attrName] || []), val]);
          next[attrName] = Array.from(list).sort((a, b) => a.localeCompare(b));
          void persistVariationMasterMerge(next);
        }
      }
    }
  };

  const removeVariantAttribute = (attrName: string) => {
    setVariantAttributes(variantAttributes.filter(a => a.name !== attrName));
    setGeneratedVariations([]);
  };

  const removeAttributeValue = (attrIndex: number, valueIndex: number) => {
    const updatedAttributes = [...variantAttributes];
    updatedAttributes[attrIndex].values.splice(valueIndex, 1);
    setVariantAttributes(updatedAttributes);
    setGeneratedVariations([]);
  };

  /** Copy attribute structure from an existing product's variations */
  const copyAttributesFromProduct = (product: { variations?: Array<{ attributes?: unknown }> }) => {
    const vars = product.variations || [];
    if (vars.length === 0) return;
    const attrMap: Record<string, Set<string>> = {};
    for (const v of vars) {
      const attrs = publicVariationAttributes(parseVariationAttributesRaw(v.attributes));
      for (const [key, val] of Object.entries(attrs)) {
        if (!key || val == null || val === '') continue;
        if (!attrMap[key]) attrMap[key] = new Set();
        attrMap[key].add(String(val));
      }
    }
    const derived: Array<{ name: string; values: string[] }> = Object.entries(attrMap).map(([name, set]) => ({
      name,
      values: Array.from(set).sort(),
    }));
    if (derived.length > 0) {
      setVariantAttributes(derived);
      setGeneratedVariations([]);
      toast.success(`Copied ${derived.length} attribute(s) from existing product`);
    }
  };

  /** Max variations per product (frontend + backend consistency; avoid runaway combinations) */
  const MAX_VARIATIONS = 100;

  const cartesianProduct = (arrays: string[][]): string[][] => {
    if (arrays.length === 0) return [[]];
    return arrays.reduce((a, b) => a.flatMap(d => b.map(e => [...(Array.isArray(d) ? d : [d]), e])), [[]] as string[][]);
  };

  const variationComboKey = (combinationObj: Record<string, string>) =>
    variantAttributes.map((a) => `${a.name}=${combinationObj[a.name] ?? ''}`).join('|');

  const generateVariations = () => {
    const attributeValues = variantAttributes.map((attr) => attr.values);
    const combinations = cartesianProduct(attributeValues);
    if (combinations.length > MAX_VARIATIONS) {
      toast.error(`Variation limit (${MAX_VARIATIONS}) exceeded. You have ${combinations.length} combinations. Reduce attribute values or use fewer attributes.`);
      return;
    }
    const baseSku = (getValues('sku') || '').trim() || generateSKU();

    const basicSellingPrice = getValues('sellingPrice') ?? 0;
    const basicPurchasePrice = getValues('purchasePrice') ?? 0;
    const existingByCombo = new Map(generatedVariations.map((ev) => [variationComboKey(ev.combination), ev]));

    const newVariations = combinations.map((combination, index) => {
      const combinationObj: Record<string, string> = {};
      variantAttributes.forEach((attr, i) => {
        combinationObj[attr.name] = combination[i];
      });
      const prev = existingByCombo.get(variationComboKey(combinationObj));
      if (prev) {
        return { ...prev, combination: combinationObj };
      }
      return {
        id: undefined as string | undefined,
        combination: combinationObj,
        sku: `${baseSku}-V${index + 1}`,
        price: Number(basicSellingPrice) || 0,
        purchasePrice: Number(basicPurchasePrice) || 0,
        stock: 0,
        barcode: '',
      };
    });

    setGeneratedVariations(newVariations);
  };

  // Combos Functions
  // Filter available products based on search query
  const filteredProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const selectProduct = (product: { id: string; name: string; retail_price: number; sku: string; has_variations: boolean }) => {
    // Check if product already in current combo
    if (currentComboItems.some(item => item.product_id === product.id && !item.variation_id)) {
      toast.error('Product already added to combo');
      return;
    }
    
    // If product has variations, we need variation_id (will be handled in UI)
    // For now, add without variation (user can edit later if needed)
    setCurrentComboItems([...currentComboItems, {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      variation_id: null, // TODO: Add variation selection if has_variations
      qty: 1,
      unit_price: product.retail_price,
    }]);
      setProductSearchQuery('');
      setShowProductDropdown(false);
  };

  const removeComboItem = (index: number) => {
    setCurrentComboItems(currentComboItems.filter((_, i) => i !== index));
  };

  const updateComboItemQty = (index: number, qty: number) => {
    if (qty <= 0) return;
    const updated = [...currentComboItems];
    updated[index].qty = qty;
    setCurrentComboItems(updated);
  };

  const updateComboItemPrice = (index: number, price: number) => {
    if (price < 0) return;
    const updated = [...currentComboItems];
    updated[index].unit_price = price;
    setCurrentComboItems(updated);
  };

  const saveCombo = async () => {
    if (!comboName.trim() || comboFinalPrice <= 0 || currentComboItems.length === 0) {
      toast.error('Please fill all combo fields and add at least one product');
      return;
    }
    
    if (!companyId) {
      toast.error('Company ID missing');
      return;
    }

    const productId = initialProduct?.uuid || initialProduct?.id;
    if (!productId) {
      toast.error('Save the product first (Basic tab), then you can add combos here.');
      return;
    }

    try {
      // Create or update combo
      if (combos.length > 0 && combos[0].id) {
        // Update existing combo
        await comboService.updateCombo(combos[0].id, companyId, {
          combo_name: comboName,
          combo_price: comboFinalPrice,
        });
        await comboService.updateComboItems(combos[0].id, companyId, currentComboItems);
        toast.success('Combo updated!');
      } else {
        // Create new combo
        const newCombo = await comboService.createCombo({
          company_id: companyId,
          combo_product_id: productId,
          combo_name: comboName,
          combo_price: comboFinalPrice,
          items: currentComboItems,
        });
        
        setCombos([{
          id: newCombo.id,
          combo_name: newCombo.combo_name,
          combo_price: newCombo.combo_price,
          items: newCombo.items.map(item => ({
            id: item.id,
            product_id: item.product_id,
            variation_id: item.variation_id,
            qty: item.qty,
            unit_price: item.unit_price,
          })),
        }]);
        toast.success('Combo saved!');
      }
      
      // Reset form
      setCurrentComboItems([]);
      setComboName('');
      setComboFinalPrice(0);
      setProductSearchQuery('');
    } catch (error: any) {
      console.error('[PRODUCT FORM] Error saving combo:', error);
      toast.error(error?.message || 'Failed to save combo');
    }
  };

  const deleteCombo = async (id: string) => {
    if (!companyId) {
      toast.error('Company ID missing');
      return;
    }
    
    try {
      await comboService.deleteCombo(id, companyId);
      setCombos(combos.filter(c => c.id !== id));
      toast.success('Combo deleted!');
    } catch (error: any) {
      console.error('[PRODUCT FORM] Error deleting combo:', error);
      toast.error(error?.message || 'Failed to delete combo');
    }
  };

  const onSubmit = async (
    data: ProductFormValues,
    action: "save" | "saveAndAdd",
  ) => {
    if (submitInProgressRef.current) {
      toast.info('Save in progress…');
      return;
    }
    submitInProgressRef.current = true;
    if (!companyId) {
      toast.error('Company ID not found. Please login again.');
      submitInProgressRef.current = false;
      return;
    }
    const finalCompanyId = companyId;
    
    if (!finalCompanyId) {
      toast.error('Company information required. Please login again.');
      submitInProgressRef.current = false;
      return;
    }
    
    const perf = perfStart('productSave');
    let productSaveEnded = false;
    const endProductSavePerf = (extra?: Record<string, unknown>) => {
      if (productSaveEnded) return;
      productSaveEnded = true;
      perf.end(extra);
    };

    try {
      setSaving(true);
      const finalSKU = data.sku && data.sku.trim() !== '' ? data.sku : generateSKU();

      const asId = (v: unknown): string | null => {
        if (v == null || v === '') return null;
        if (typeof v === 'string' && PRODUCT_UUID_RE.test(v)) return v;
        if (typeof v === 'object' && v !== null && 'id' in v && typeof (v as any).id === 'string') return (v as any).id;
        return null;
      };
      const rawUnit = getValues('unit') ?? data.unit;
      const rawCategory = getValues('category') ?? data.category;
      const rawSubCategory = getValues('subCategory') ?? data.subCategory;
      const rawBrand = getValues('brand') ?? data.brand;

      let categoryId: string | null = asId(rawSubCategory) ?? asId(rawCategory) ?? null;
      if (!categoryId && (rawCategory || rawSubCategory)) {
        const found = categories.find((c) => c.id === rawCategory || c.id === rawSubCategory) || subCategories.find((c) => c.id === rawCategory || c.id === rawSubCategory);
        if (found) categoryId = found.id;
      }
      const unitId = asId(rawUnit);
      const brandId = asId(rawBrand);

      let barcodeValue: string | null = null;
      try {
        if (data.barcode && data.barcode.trim() !== '') barcodeValue = data.barcode.trim();
      } catch (barcodeError) {
        console.warn('[PRODUCT FORM] Barcode error (non-blocking):', barcodeError);
      }

      // Convert to Supabase format (field names match schema)
      const productData: Record<string, unknown> = {
        company_id: finalCompanyId,
        category_id: categoryId,
        brand_id: brandId,
        unit_id: unitId,
        name: data.name,
        sku: finalSKU,
        barcode: barcodeValue,
        description: data.description || null,
        cost_price: data.purchasePrice ?? 0,
        retail_price: data.sellingPrice,
        wholesale_price: data.wholesalePrice ?? data.sellingPrice ?? 0,
        rental_price_daily: data.rentalPrice ?? null,
        // RULE 1: When variations enabled, parent cannot hold stock (opening stock per variation only)
        // RULE 2: When combo enabled, product cannot hold stock (virtual bundle - stock from components)
        current_stock: (enableVariations || isComboProduct) ? 0 : ((data.initialStock ?? 0) > 0 && !initialProduct?.id ? 0 : (data.initialStock ?? 0)),
        min_stock: data.alertQty ?? 0,
        max_stock: data.maxStock ?? 1000,
        has_variations: enableVariations,
        is_combo_product: isComboProduct, // Save combo flag
        is_rentable: (data.rentalPrice ?? 0) > 0,
        is_sellable: true,
        track_stock: data.stockManagement !== false,
        is_active: true,
      };

      const productId = resolveEditProductId(initialProduct);
      const isEdit = !!initialProduct;

      if (isEdit && !productId) {
        toast.error('Product id missing. Close and reopen the product.');
        setSaving(false);
        submitInProgressRef.current = false;
        return;
      }

      if (isEdit && productId) {
        // UPDATE: merge existing image_urls (including any user-removed) with newly uploaded files
        const editSource = fullProductForEdit ?? initialProduct;
        const previousImageUrls = Array.isArray((editSource as { image_urls?: string[] })?.image_urls)
          ? [...((editSource as { image_urls: string[] }).image_urls)]
          : [];
        let imageUrls: string[] = [...existingImageUrls];
        if (images.length > 0) {
          try {
            const newUrls = await uploadProductImages(finalCompanyId, productId, images);
            imageUrls = [...imageUrls, ...newUrls];
          } catch (uploadErr: any) {
            console.error('[PRODUCT FORM] Image upload failed:', uploadErr);
            const msg = uploadErr?.message || 'Images failed to upload.';
            const isBucketMissing = String(msg).toLowerCase().includes('bucket not found');
            toast.error(msg, isBucketMissing ? { action: { label: 'Open Storage', onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank') } } : undefined);
          }
        }
        (productData as { image_urls: string[] }).image_urls = imageUrls;

        // RULE 5: Block enabling variations when product has parent-level stock (show modal)
        // Parallelize movement pre-checks (independent head counts)
        const [parentLevelCount, movementCount] = await Promise.all([
          enableVariations
            ? inventoryService.getParentLevelMovementCount(productId)
            : Promise.resolve(0),
          inventoryService.getMovementCountForProduct(productId),
        ]);
        if (enableVariations && parentLevelCount > 0) {
            setBlockVariationsModalOpen(true);
            setSaving(false);
            submitInProgressRef.current = false;
            return;
        }

        // Opening stock: movement-based only; never send current_stock (productService strips it).
        const hasVariations = enableVariations;
        const initialStock = Number(data.initialStock) || 0;
        delete (productData as any).current_stock;
        if (hasVariations) (productData as any).current_stock = 0; // RULE 1: parent never holds stock

        const result = await productService.updateProduct(productId, productData);

        const removedImageUrls = previousImageUrls.filter((u) => !imageUrls.includes(u));
        if (removedImageUrls.length > 0) {
          void removeProductImagesFromStorage(removedImageUrls);
        }

        const branchIdOrNull = branchId && branchId !== 'all' ? branchId : null;

        if (enableVariations && generatedVariations.length > 0 && finalCompanyId) {
          const parentCost = Number(data.purchasePrice) || 0;
          const parentSell = Number(data.sellingPrice) || 0;
          await mapPool(generatedVariations, 5, async (row) => {
            const purchN = Number(row.purchasePrice);
            const sellN = Number(row.price);
            const cost = Number.isFinite(purchN) ? purchN : parentCost;
            const selling = Number.isFinite(sellN) ? sellN : parentSell;
            if (import.meta.env.DEV) {
              if (row.id && !Number.isFinite(purchN)) {
                console.warn(
                  '[PRODUCT FORM] Variation update: purchasePrice not a finite number; using parent cost',
                  row.id,
                  row
                );
              }
              if (row.id && !Number.isFinite(sellN)) {
                console.warn(
                  '[PRODUCT FORM] Variation update: selling price not finite; using parent selling price',
                  row.id,
                  row
                );
              }
            }
            const name = formatVariationName(row.combination);
            try {
              if (row.id) {
                await productService.updateVariation(row.id, {
                  sku: row.sku,
                  barcode: row.barcode || null,
                  attributes: row.combination,
                  name,
                  cost_price: cost,
                  retail_price: selling,
                  wholesale_price: null,
                  price: selling,
                });
                const allowV = await inventoryService.allowsVariationOpeningReconcileFromProductForm(
                  finalCompanyId,
                  productId,
                  row.id,
                  branchIdOrNull
                );
                if (allowV) {
                  const { error: vMovErr } = await inventoryService.reconcileVariationOpeningStock(
                    finalCompanyId,
                    branchIdOrNull,
                    productId,
                    row.id,
                    parseVariationQtyInput(String(row.stock ?? '')),
                    cost
                  );
                  if (vMovErr) console.error('[PRODUCT FORM] Variation opening reconcile failed:', vMovErr);
                }
              } else {
                const q = parseVariationQtyInput(String(row.stock ?? ''));
                const created = await productService.createVariation({
                  product_id: productId,
                  name,
                  sku: row.sku,
                  barcode: row.barcode || null,
                  attributes: row.combination,
                  cost_price: cost,
                  retail_price: selling,
                  current_stock: q,
                });
                const vid = (created as { id?: string })?.id;
                if (q > 0 && vid && finalCompanyId) {
                  const { error: movErr } = await inventoryService.insertOpeningBalanceMovement(
                    finalCompanyId,
                    branchIdOrNull,
                    productId,
                    q,
                    cost,
                    vid
                  );
                  if (movErr) console.error('[PRODUCT FORM] Variation opening movement failed:', movErr);
                }
              }
            } catch (ve: unknown) {
              console.error('[PRODUCT FORM] Variation save failed:', ve);
              toast.warning('Product saved but one or more variations failed to save. Check the Variations tab.');
            }
          });
        }

        const canReconcileOpening = await inventoryService.allowsParentOpeningReconcileFromProductForm(
          finalCompanyId,
          productId,
          branchIdOrNull
        );

        // Parent-level opening: only when safe (no sales/purchases after opening — avoids overwriting opening with on-hand total).
        if (!hasVariations && finalCompanyId && canReconcileOpening) {
          const { error: movErr } = await inventoryService.reconcileParentLevelOpeningStock(
            finalCompanyId,
            branchIdOrNull,
            productId,
            initialStock,
            Number(data.purchasePrice) || 0,
            movementCount
          );
          if (movErr) {
            console.error('[PRODUCT FORM] Opening balance movement failed:', movErr);
            toast.error('Product updated but opening stock could not be recorded. You can add an adjustment in Inventory.');
          }
        }
        if (companyBranches.length > 1 && productId) {
          try {
            await productService.setProductBranchAvailability(
              finalCompanyId,
              productId,
              selectedBranchIds,
            );
          } catch (branchErr) {
            console.warn('[PRODUCT FORM] branch availability save failed:', branchErr);
          }
        }
        const payload = {
          ...data,
          sku: finalSKU,
          id: result.id,
          uuid: result.id,
          isSellable: true,
          isRentable: (data.rentalPrice || 0) > 0,
          variations: generatedVariations,
          combos: combos,
        };
        toast.success('Product updated successfully!');
        endProductSavePerf({ action: 'update' });
        if (action === "saveAndAdd" && onSaveAndAdd) {
          onSaveAndAdd(payload);
        } else {
          onSave(payload);
        }
      } else {
        // CREATE new product (orchestrated parent + variations)
        const branchIdOrNull = branchId && branchId !== 'all' ? branchId : null;
        const hasVariations = enableVariations;
        const initialStock = Number(data.initialStock) || 0;

        if (hasVariations && generatedVariations.length > MAX_VARIATIONS) {
          toast.error(`Variation limit (${MAX_VARIATIONS}) exceeded. Save without variations or reduce to ${MAX_VARIATIONS} or fewer.`);
          setSaving(false);
          submitInProgressRef.current = false;
          return;
        }

        const parentCost = Number(data.purchasePrice) || 0;
        const parentSell = Number(data.sellingPrice) || 0;
        const variationPayload =
          hasVariations && generatedVariations.length > 0
            ? generatedVariations.map((variation) => {
                const purchN = Number(variation.purchasePrice);
                const sellN = Number(variation.price);
                const cost = Number.isFinite(purchN) ? purchN : parentCost;
                const retail = Number.isFinite(sellN) ? sellN : parentSell;
                return {
                  name: formatVariationName(variation.combination),
                  sku: variation.sku,
                  barcode: variation.barcode || null,
                  attributes: variation.combination,
                  cost_price: cost,
                  retail_price: retail,
                  opening_stock: parseVariationQtyInput(String(variation.stock ?? '')),
                };
              })
            : [];

        const saveResult = await productService.saveProductWithVariations({
          companyId: finalCompanyId,
          branchIdOrNull,
          parent: {
            ...productData,
            opening_stock: hasVariations ? 0 : initialStock,
          },
          variations: variationPayload,
        });
        incrementNextNumber('production');
        const result = { id: saveResult.productId };

        if (companyBranches.length > 1 && result?.id) {
          try {
            await productService.setProductBranchAvailability(
              finalCompanyId,
              result.id,
              selectedBranchIds,
            );
          } catch (branchErr) {
            console.warn('[PRODUCT FORM] branch availability save failed:', branchErr);
          }
        }

        // Upload product images and save URLs
        if (images.length > 0 && result?.id) {
          try {
            const imageUrls = await uploadProductImages(finalCompanyId, result.id, images);
            await productService.updateProduct(result.id, { image_urls: imageUrls });
          } catch (uploadErr: any) {
            console.error('[PRODUCT FORM] Image upload failed:', uploadErr);
            const msg = uploadErr?.message || 'Product saved but images failed to upload.';
            const isBucketMissing = String(msg).toLowerCase().includes('bucket not found');
            toast.error(msg, isBucketMissing ? { action: { label: 'Open Storage', onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank') } } : undefined);
          }
        }

        const payload = {
          ...data,
          sku: finalSKU,
          id: result.id,
          isSellable: true,
          isRentable: (data.rentalPrice || 0) > 0,
          variations: generatedVariations,
          combos: combos,
        };

        if (generatedVariations.length > 0) {
          toast.success(`Product created with ${generatedVariations.length} variations!`);
        } else {
          toast.success('Product created successfully!');
        }
        endProductSavePerf({ action: 'create', variations: generatedVariations.length });

        if (action === "saveAndAdd" && onSaveAndAdd) {
          onSaveAndAdd(payload);
        } else {
          onSave(payload);
        }
      }
    } catch (error: any) {
      const wasEdit = !!resolveEditProductId(initialProduct) || !!initialProduct;
      const msg = error?.message || 'Unknown error';
      console.error('[PRODUCT FORM] Error saving product:', error);
      if (msg.includes('SKU') && msg.includes('already') && !wasEdit) {
        toast.error(msg, { duration: 6000 });
        incrementNextNumber('production'); // free the duplicate number so next generate is unique
        setValue('sku', generateSKU());
      } else {
        toast.error(wasEdit ? 'Failed to update product: ' + msg : 'Failed to create product: ' + msg);
      }
    } finally {
      endProductSavePerf({ done: true });
      setSaving(false);
      submitInProgressRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-input-background text-foreground relative">
      {(loadingFullProduct && initialProduct) || (loadingDuplicateSource && isDuplicateMode) ? (
        <div className="absolute inset-x-0 top-0 bottom-[4.5rem] bg-input-background/80 z-20 flex items-center justify-center rounded-xl pointer-events-none">
          <div className="flex flex-col items-center gap-3 pointer-events-auto">
            <RefreshCcw size={32} className="text-blue-400 animate-spin" />
            <p className="text-sm text-muted-foreground">
              {isDuplicateMode ? 'Preparing duplicate...' : 'Loading product...'}
            </p>
          </div>
        </div>
      ) : null}
      <div className="p-6 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold">
            {initialProduct ? 'Edit Product' : isDuplicateMode ? 'Duplicate Product' : 'Add New Product'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {initialProduct
              ? 'Update product details'
              : isDuplicateMode
                ? 'Review and save as a new product'
                : 'Complete product details for inventory'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-muted rounded-full"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card sticky top-[89px] z-10">
        <div className="flex px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('basic')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'basic'
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            )}
          >
            Basic Info
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'pricing'
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            )}
          >
            Pricing & Tax
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'inventory'
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            )}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'media'
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            )}
          >
            Media
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'details'
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            )}
          >
            Details
          </button>
          {enableVariations && (
            <button
              onClick={() => setActiveTab('variations')}
              className={clsx(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === 'variations'
                  ? "border-blue-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-muted-foreground"
              )}
            >
              Variations {generatedVariations.length > 0 && `(${generatedVariations.length} / ${MAX_VARIATIONS})`}
            </button>
          )}
          {modules.combosEnabled && isComboProduct && (
          <button
            onClick={() => setActiveTab('combos')}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === 'combos'
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            )}
          >
            Combos {combos.length > 0 && `(${combos.length})`}
          </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* TAB 1 - BASIC INFO */}
        {activeTab === 'basic' && (
          <>
            {/* Section 1: Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3 flex items-center gap-2">
                <Package size={20} />
                Product Identity
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="name" className="text-gray-200">
                    Product Name *
                  </Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="e.g. Cotton Premium Shirt"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="sku" className="text-gray-200">
                    SKU / Code *
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="sku"
                      {...register("sku")}
                      placeholder="AUTO-GENERATED"
                      className="bg-muted border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={generateSKUForForm}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCcw size={16} />
                    </button>
                  </div>
                  {errors.sku && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.sku.message}
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* Section 2: Classification */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-purple-500 pl-3">
                Classification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-200">Brand</Label>
                  <div className="mt-1">
                    {loadingBrands ? (
                      <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">Loading brands...</div>
                    ) : (
                      <SearchableSelect
                        value={watch('brand') ?? ''}
                        onValueChange={(v) => setValue('brand', v)}
                        options={brands}
                        placeholder="Select Brand"
                        searchPlaceholder="Search brand..."
                        emptyText="No brand found."
                        className="bg-muted border-border text-foreground h-9"
                        enableAddNew
                        addNewLabel="Add Brand"
                        onAddNew={async (searchText) => {
                          if (!companyId) return;
                          try {
                            const name = (searchText || '').trim() || 'New Brand';
                            const created = await brandService.create({ company_id: companyId, name });
                            setBrands((prev) => [...prev, { id: created.id, name: created.name }]);
                            setValue('brand', created.id);
                            toast.success('Brand added');
                          } catch (e) {
                            toast.error('Failed to add brand');
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-200">Category</Label>
                  <div className="mt-1">
                    {loadingCategories ? (
                      <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">Loading categories...</div>
                    ) : (
                      <SearchableSelect
                        value={watch('category') ?? ''}
                        onValueChange={(v) => {
                          setValue('category', v);
                          setValue('subCategory', '');
                        }}
                        options={categories}
                        placeholder="Select Category"
                        searchPlaceholder="Search category..."
                        emptyText="No category found."
                        className="bg-muted border-border text-foreground h-9"
                        enableAddNew
                        addNewLabel="Add Category"
                        onAddNew={async (searchText) => {
                          if (!companyId) return;
                          try {
                            const name = (searchText || '').trim() || 'New Category';
                            const created = await productCategoryService.create({ company_id: companyId, name, parent_id: null });
                            setCategories((prev) => [...prev, { id: created.id, name: created.name }]);
                            setValue('category', created.id);
                            setValue('subCategory', '');
                            toast.success('Category added');
                          } catch (e) {
                            toast.error('Failed to add category');
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-200">Sub-Category</Label>
                  <div className="mt-1">
                    {!selectedCategoryId ? (
                      <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">Select a category first</div>
                    ) : (
                      <SearchableSelect
                        value={watch('subCategory') ?? ''}
                        onValueChange={(v) => setValue('subCategory', v)}
                        options={subCategories}
                        placeholder="Select Sub-Category"
                        searchPlaceholder="Search sub-category..."
                        emptyText="No sub-category found."
                        className="bg-muted border-border text-foreground h-9"
                        enableAddNew
                        addNewLabel="Add Sub-Category"
                        onAddNew={async (searchText) => {
                          if (!companyId || !selectedCategoryId) return;
                          try {
                            const name = (searchText || '').trim() || 'New Sub-Category';
                            const created = await productCategoryService.create({ company_id: companyId, name, parent_id: selectedCategoryId });
                            setSubCategories((prev) => [...prev, { id: created.id, name: created.name }]);
                            setValue('subCategory', created.id);
                            toast.success('Sub-category added');
                          } catch (e) {
                            toast.error('Failed to add sub-category');
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-200">Unit</Label>
                  <div className="mt-1">
                    {loadingUnits ? (
                      <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">Loading units...</div>
                    ) : (
                      <SearchableSelect
                        value={watch('unit') ?? ''}
                        onValueChange={(v) => setValue('unit', v)}
                        options={units.map((u) => ({ id: u.id, name: `${u.name} (${u.short_code || u.symbol || '—'})` }))}
                        placeholder="Select Unit"
                        searchPlaceholder="Search unit..."
                        emptyText="No unit found. Add units in Settings → Inventory → Units."
                        className="bg-muted border-border text-foreground h-9"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Basic Pricing */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-green-500 pl-3 flex items-center gap-2">
                <DollarSign size={20} />
                Quick Pricing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-200">
                    Purchase Price
                  </Label>
                  <Input
                    type="number"
                    {...register("purchasePrice", { setValueAs: setValueAsNumber })}
                    placeholder="0.00"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cost price from supplier
                  </p>
                </div>

                <div>
                  <Label className="text-gray-200">
                    Selling Price *
                  </Label>
                  <Input
                    type="number"
                    {...register("sellingPrice", { setValueAs: setValueAsNumber })}
                    placeholder="0.00"
                    className={clsx(
                      "bg-green-900/30 border-green-700 text-foreground mt-1 font-bold",
                      errors.sellingPrice &&
                        "border-red-500 ring-1 ring-red-500",
                    )}
                  />
                  {errors.sellingPrice && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.sellingPrice.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Final price for customers
                  </p>
                </div>
              </div>
              <div className="bg-blue-900/10 border border-blue-900/30 p-3 rounded-md text-xs text-blue-300">
                💡 <strong>Tip:</strong> For advanced pricing options (wholesale, bulk, retail), go to the "Pricing & Tax" tab.
              </div>
            </div>

          </>
        )}

        {/* TAB 2 - PRICING & TAX */}
        {activeTab === 'pricing' && (
          <>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-green-500 pl-3 flex items-center gap-2">
                <DollarSign size={20} />
                Basic Pricing
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-200">
                    Purchase Price
                  </Label>
                  <Input
                    type="number"
                    {...register("purchasePrice", { setValueAs: setValueAsNumber })}
                    placeholder="0.00"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Cost from supplier</p>
                </div>

                <div>
                  <Label className="text-gray-200">
                    Profit Margin (%)
                  </Label>
                  <Input
                    type="number"
                    {...register('margin', { setValueAs: setValueAsNumber })}
                    onChange={(e) => {
                      const n = setValueAsNumber(e.target.value);
                      setValue('margin', n, { shouldDirty: true, shouldValidate: true });
                      applySellingFromMargin(n);
                    }}
                    placeholder="0"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-calculate selling price</p>
                </div>

                <div>
                  <Label className="text-gray-200">
                    Selling Price *
                  </Label>
                  <Input
                    type="number"
                    {...register("sellingPrice", { setValueAs: setValueAsNumber })}
                    placeholder="0.00"
                    className={clsx(
                      "bg-green-900/30 border-green-700 text-foreground mt-1 font-bold",
                      errors.sellingPrice &&
                        "border-red-500 ring-1 ring-red-500",
                    )}
                  />
                  {errors.sellingPrice && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.sellingPrice.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Retail price</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">
                Advanced Pricing Tiers
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-200">
                    Wholesale Price
                  </Label>
                  <Input
                    type="number"
                    {...register("wholesalePrice", { setValueAs: setValueAsNumber })}
                    placeholder="0.00"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Price for wholesale customers</p>
                </div>

                <div>
                  <Label className="text-gray-200">
                    Retail Price
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Price for retail customers</p>
                </div>

                <div>
                  <Label className="text-gray-200">
                    Bulk Price (10+ items)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Special price for bulk orders</p>
                </div>

                <div>
                  <Label className="text-gray-200">
                    Minimum Order Quantity
                  </Label>
                  <Input
                    type="number"
                    placeholder="1"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minimum quantity to order</p>
                </div>
              </div>

              <div className="bg-purple-900/10 border border-purple-800 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-purple-300 mb-2">💰 Pricing Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Purchase:</p>
                    <p className="text-foreground font-bold">₨{watch('purchasePrice') || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Selling:</p>
                    <p className="text-[var(--erp-money-positive)] font-bold">₨{watch('sellingPrice') || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Margin:</p>
                    <p className="text-blue-400 font-bold">{watch('margin') || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Profit:</p>
                    <p className="text-yellow-400 font-bold">₨{((watch('sellingPrice') || 0) - (watch('purchasePrice') || 0)).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-purple-500 pl-3">
                Tax Configuration
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-gray-200">Tax Type</Label>
                  <Controller
                    control={control}
                    name="taxType"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                          <SelectValue placeholder="Select Tax Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          <SelectItem value="exclusive">
                            Exclusive (Tax Added)
                          </SelectItem>
                          <SelectItem value="inclusive">
                            Inclusive (Tax Included)
                          </SelectItem>
                          <SelectItem value="exempt">
                            Tax Exempt
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">
                Rental Pricing (Optional)
              </h3>

              <div className="bg-blue-900/10 border border-blue-900/30 p-3 rounded-md text-xs text-blue-300 mb-4">
                Leave these fields empty to decide the rental price at the time of booking.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-200">
                    Default Rent Price
                  </Label>
                  <Input
                    type="number"
                    {...register("rentalPrice", { setValueAs: setValueAsNumber })}
                    placeholder="0.00"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                </div>

                <div>
                  <Label className="text-gray-200">
                    Security Deposit
                  </Label>
                  <Input
                    type="number"
                    {...register("securityDeposit", { setValueAs: setValueAsNumber })}
                    placeholder="0.00"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 3 - INVENTORY */}
        {activeTab === 'inventory' && (
          <>
            <div className="space-y-4">
              {companyBranches.length > 1 && (
                <div className="p-3 bg-muted border border-border rounded-lg space-y-2">
                  <Label className="text-gray-200 font-medium">Available in branches</Label>
                  <p className="text-xs text-muted-foreground">Select which branches can sell this product.</p>
                  <div className="space-y-2">
                    {companyBranches.map((b) => {
                      const checked = selectedBranchIds.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedBranchIds((prev) =>
                                checked ? prev.filter((id) => id !== b.id) : [...prev, b.id],
                              );
                            }}
                            className="rounded border-gray-600"
                          />
                          {b.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Enable Variations toggle (opt-in, default OFF for new product) */}
              <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                <div>
                  <Label htmlFor="enable-variations" className="text-gray-200 font-medium">
                    Enable Variations
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable size/color variations. Stock will be tracked per variation.
                  </p>
                </div>
                <Switch
                  id="enable-variations"
                  checked={enableVariations}
                  onCheckedChange={handleEnableVariationsChange}
                />
              </div>

              {enableVariations && (
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">Parent product does not hold stock when variations are enabled.</p>
                </div>
              )}

              {/* Enable Combo Product toggle (only if module enabled) */}
              {modules.combosEnabled && (
                <>
                  <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                    <div>
                      <Label htmlFor="enable-combo" className="text-gray-200 font-medium">
                        Enable Combo Product
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Make this product a combo/bundle. Stock will be managed through component products.
                      </p>
                    </div>
                    <Switch
                      id="enable-combo"
                      checked={isComboProduct}
                      onCheckedChange={handleEnableComboChange}
                    />
                  </div>

                  {isComboProduct && (
                    <div className="p-3 bg-muted border border-border rounded-lg">
                      <p className="text-sm text-muted-foreground">Combo products do not hold stock. Stock is managed through component products.</p>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold border-l-4 border-yellow-500 pl-3">
                  Stock Management
                </h3>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="stock-mgmt"
                    className="text-gray-200"
                  >
                    Enable Tracking
                  </Label>
                  <Controller
                    control={control}
                    name="stockManagement"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="stock-mgmt"
                      />
                    )}
                  />
                </div>
              </div>

              {stockManagement && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="initial-stock"
                      className="text-gray-200"
                    >
                      Initial Stock
                    </Label>
                    <Input
                      id="initial-stock"
                      type="number"
                      step={selectedUnitAllowsDecimal ? 'any' : 1}
                      disabled={enableVariations || isComboProduct}
                      {...register("initialStock", { setValueAs: setValueAsNumber })}
                      placeholder="0"
                      className={clsx("mt-1", (enableVariations || isComboProduct) ? "bg-card border-border text-muted-foreground cursor-not-allowed" : "bg-muted border-border text-foreground")}
                    />
                    {enableVariations && (
                      <p className="text-xs text-muted-foreground mt-1">Opening stock is defined per variation.</p>
                    )}
                    {isComboProduct && (
                      <p className="text-xs text-muted-foreground mt-1">Combo products do not hold stock. Stock is managed through component products.</p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="alert-qty"
                      className="text-gray-200"
                    >
                      Alert Quantity
                    </Label>
                    <Input
                      id="alert-qty"
                      type="number"
                      {...register("alertQty", { setValueAs: setValueAsNumber })}
                      placeholder="5"
                      className="bg-muted border-red-900/50 text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Get notified when stock falls below this level
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="max-stock" className="text-gray-200">Max Stock</Label>
                    <Input
                      id="max-stock"
                      type="number"
                      {...register("maxStock", { setValueAs: setValueAsNumber })}
                      placeholder="1000"
                      className="bg-muted border-border text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Maximum stock capacity</p>
                  </div>
                </div>
              )}

              {!stockManagement && (
                <div className="bg-muted border border-border rounded-xl p-6 text-center">
                  <p className="text-muted-foreground">Stock tracking is disabled for this product</p>
                  <p className="text-sm text-muted-foreground mt-1">Enable tracking above to manage inventory levels</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 4 - MEDIA */}
        {activeTab === 'media' && (
          <>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-pink-500 pl-3">
                Product Images
              </h3>

              <div
                {...getRootProps()}
                className={clsx(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:border-gray-500 bg-muted/50",
                )}
              >
                <input {...getInputProps()} />
                <Upload
                  size={32}
                  className="text-muted-foreground mb-3"
                />
                <p className="text-muted-foreground text-center">
                  Drag & drop images here, or{" "}
                  <span className="text-blue-500">browse</span>
                </p>
              </div>

              {existingImageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <p className="col-span-full text-sm text-muted-foreground">Saved images</p>
                  {existingImageUrls.map((url, idx) => (
                    <div
                      key={url + idx}
                      className="relative group aspect-square bg-muted rounded-lg overflow-hidden border border-border"
                    >
                      <ProductImage src={url} alt="product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExistingImageUrls(existingImageUrls.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  {existingImageUrls.length > 0 && <p className="col-span-full text-sm text-muted-foreground">New images (will save on Submit)</p>}
                  {images.map((file, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-square bg-muted rounded-lg overflow-hidden border border-border"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages(
                            images.filter((_, i) => i !== idx),
                          );
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length === 0 && existingImageUrls.length === 0 && (
                <div className="bg-muted border border-border rounded-xl p-6 text-center">
                  <p className="text-muted-foreground">No images uploaded yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Upload images to showcase your product</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 5 - DETAILS */}
        {activeTab === 'details' && (
          <>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-cyan-500 pl-3">
                Description & Notes
              </h3>

              <div>
                <Label
                  htmlFor="description"
                  className="text-gray-200"
                >
                  Product Description
                </Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Detailed product description..."
                  className="bg-muted border-border text-foreground mt-1 min-h-[120px]"
                />
              </div>

              <div>
                <Label
                  htmlFor="notes"
                  className="text-gray-200"
                >
                  Internal Notes
                </Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  placeholder="Private notes (not visible to customers)..."
                  className="bg-muted border-border text-foreground mt-1 min-h-[80px]"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-orange-500 pl-3">
                Supplier Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-200">
                    Default Supplier
                  </Label>
                  <Controller
                    control={control}
                    name="supplier"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ''}
                      >
                        <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                          <SelectValue placeholder="Select Supplier" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          {loadingSuppliers ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading suppliers...</div>
                          ) : suppliers.length > 0 ? (
                            suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No suppliers. Add in Contacts (type: Supplier).</div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label className="text-gray-200">
                    Supplier Product Code
                  </Label>
                  <Input
                    {...register("supplierCode")}
                    placeholder="Supplier's SKU"
                    className="bg-muted border-border text-foreground mt-1"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 2 - VARIATIONS */}
        {activeTab === 'variations' && (
          <>
            {/* Supplier display - shows selected supplier from Details tab */}
            <div className="bg-muted border border-border rounded-xl p-4">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Supplier for this product</Label>
              <p className="text-foreground font-medium mt-1">
                {watch('supplier') && suppliers.length > 0
                  ? suppliers.find((s) => s.id === watch('supplier'))?.name ?? '—'
                  : 'Select supplier in Details tab'}
              </p>
              {watch('supplier') && (
                <p className="text-xs text-muted-foreground mt-0.5">Variations will be associated with this supplier</p>
              )}
            </div>

            {/* Info Banner */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-300">
                <strong>Product Variations:</strong> Create different variants of your product (e.g., different sizes, colors, materials). 
                Each variant will have its own SKU, price, and stock level.
              </p>
            </div>

            {/* Copy from existing variation – format: Supplier — AttributeName: Value (e.g. variant: Size: L, SUPLIER: Ibrahim) */}
            {variationsForCopy.length > 0 && (
              <div className="bg-muted border border-border rounded-xl p-4">
                <Label className="text-gray-200 mb-2 block">Copy from existing variation</Label>
                <p className="text-xs text-muted-foreground mb-2">Select an existing variation to copy its attributes. Shows: Supplier, Attribute: Value (e.g. Size: Large, Color: Red).</p>
                <Select
                  value={copyFromVariationId}
                  onValueChange={(id) => {
                    setCopyFromVariationId(id);
                    const entry = variationsForCopy.find((x) => x.variationId === id);
                    if (entry && entry.productId !== (initialProduct?.uuid || initialProduct?.id)) {
                      copyAttributesFromProduct(entry.product);
                      setCopyFromVariationId('');
                    } else if (entry) {
                      toast.info('This is the current product');
                      setCopyFromVariationId('');
                    }
                  }}
                >
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue placeholder="Select variation to copy from..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    {loadingProductsWithVariations ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
                    ) : (
                      variationsForCopy
                        .filter((e) => e.productId !== (initialProduct?.uuid || initialProduct?.id))
                        .map((e) => (
                          <SelectItem key={e.variationId} value={e.variationId}>
                            {e.supplierName} — {e.label}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Step 1: Add Attributes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">
                Step 1: Define Variation Attributes
              </h3>
              <p className="text-xs text-muted-foreground">
                Pick from Settings → Inventory → Variations master or type new names; values can be chosen from saved lists per attribute.
              </p>
              <datalist id="variation-master-attr-names">
                {Object.keys(variationMaster)
                  .sort((a, b) => a.localeCompare(b))
                  .map((k) => (
                    <option key={k} value={k} />
                  ))}
              </datalist>

              <div className="bg-muted border border-border rounded-xl p-4">
                <Label className="text-gray-200 mb-2 block">Add New Attribute (e.g., Size, Color, Material)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newAttributeName}
                    onChange={(e) => setNewAttributeName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVariantAttribute())}
                    placeholder="Enter attribute name (e.g., Color)"
                    className="bg-card border-border text-foreground"
                    list="variation-master-attr-names"
                  />
                  <button
                    type="button"
                    onClick={addVariantAttribute}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>

              {/* Display Attributes */}
              {variantAttributes.length > 0 && (
                <div className="space-y-4">
                  {variantAttributes.map((attr, attrIndex) => (
                    <div key={attr.name} className="bg-muted border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-foreground flex items-center gap-2">
                          {attr.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeVariantAttribute(attr.name)}
                          className="text-red-500 hover:text-red-400 transition-colors p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Add Values */}
                      <div className="mb-3">
                        <datalist id={`variation-master-values-${attr.name.replace(/\s+/g, '-')}`}>
                          {(variationMaster[attr.name] || []).map((v) => (
                            <option key={v} value={v} />
                          ))}
                        </datalist>
                        <div className="flex items-center gap-2">
                          <Input
                            value={selectedAttributeIndex === attrIndex ? newAttributeValue : ''}
                            onFocus={() => setSelectedAttributeIndex(attrIndex)}
                            onChange={(e) => setNewAttributeValue(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setSelectedAttributeIndex(attrIndex);
                                addAttributeValue();
                              }
                            }}
                            placeholder={`Add ${attr.name} value (e.g., Red, Blue)`}
                            className="bg-card border-border text-foreground text-sm"
                            list={`variation-master-values-${attr.name.replace(/\s+/g, '-')}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAttributeIndex(attrIndex);
                              addAttributeValue();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                          >
                            Add Value
                          </button>
                        </div>
                      </div>

                      {/* Display Values */}
                      <div className="flex flex-wrap gap-2">
                        {attr.values.map((value, valueIndex) => (
                          <div
                            key={value}
                            className="bg-card border border-border text-foreground px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm"
                          >
                            <span>{value}</span>
                            <button
                              type="button"
                              onClick={() => removeAttributeValue(attrIndex, valueIndex)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {attr.values.length === 0 && (
                          <span className="text-muted-foreground text-sm italic">No values added yet</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Generate Variations */}
            {variantAttributes.length > 0 && variantAttributes.every(attr => attr.values.length > 0) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">
                  Step 2: Generate & Configure Variations
                </h3>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Limit: {MAX_VARIATIONS} variations per product. Opening stock is set per row and saved as stock movements on save.
                  </p>
                  <span className="text-xs text-muted-foreground font-mono">
                    {generatedVariations.length} / {MAX_VARIATIONS}
                  </span>
                </div>
                
                <div className="bg-muted border border-border rounded-xl p-4">
                  {(() => {
                    const count = variantAttributes.reduce((acc, attr) => acc * attr.values.length, 1);
                    const atLimit = count > MAX_VARIATIONS;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={generateVariations}
                          disabled={atLimit}
                          className={clsx(
                            "text-foreground px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2",
                            atLimit
                              ? "bg-gray-600 cursor-not-allowed opacity-60"
                              : "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                          )}
                        >
                          <RefreshCcw size={18} />
                          Generate {count} Variations
                        </button>
                        <p className="text-xs text-muted-foreground mt-2">
                          {atLimit
                            ? `Reduce attributes or values to stay under ${MAX_VARIATIONS} variations.`
                            : "All possible combinations of your attribute values."}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* Variations Table */}
                {generatedVariations.length > 0 && (
                  <div className="bg-muted border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'min(60vh, 420px)' }}>
                      <table className="w-full border-collapse">
                        <thead className="bg-card border-b border-border sticky top-0 z-[1]">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">#</th>
                            {variantAttributes.map(attr => (
                              <th key={attr.name} className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                                {attr.name}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">SKU</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Purchase Price</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Selling Price</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Opening Stock</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Barcode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedVariations.map((variation, index) => (
                            <tr key={index} className="border-b border-border hover:bg-muted/40 transition-colors">
                              <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
                              {variantAttributes.map(attr => (
                                <td key={attr.name} className="px-4 py-3 text-sm text-foreground">
                                  <span className="bg-blue-900/30 border border-blue-800 px-2 py-1 rounded text-xs">
                                    {variation.combination[attr.name]}
                                  </span>
                                </td>
                              ))}
                              <td className="px-4 py-3">
                                <Input
                                  value={variation.sku}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    updated[index].sku = e.target.value;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-card border-border text-foreground text-sm w-32"
                                  placeholder="SKU"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number"
                                  step={0.01}
                                  min={0}
                                  value={Number.isFinite(Number(variation.purchasePrice)) ? variation.purchasePrice : 0}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    const v = parseFloat(e.target.value);
                                    updated[index].purchasePrice = Number.isNaN(v) ? 0 : v;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-card border-border text-foreground text-sm w-24"
                                  placeholder={String(watch('purchasePrice') ?? 0)}
                                  title="Purchase cost for this variation"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number"
                                  step={0.01}
                                  min={0}
                                  value={Number.isFinite(Number(variation.price)) ? variation.price : 0}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    const v = parseFloat(e.target.value);
                                    updated[index].price = Number.isNaN(v) ? 0 : v;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-card border-border text-foreground text-sm w-24"
                                  placeholder={String(watch('sellingPrice') ?? 0)}
                                  title="Selling price for this variation"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number"
                                  min={0}
                                  step={selectedUnitAllowsDecimal ? 'any' : 1}
                                  value={variation.stock}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    updated[index].stock = parseVariationQtyInput(e.target.value);
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-card border-border text-foreground text-sm w-24"
                                  placeholder="0"
                                  title={
                                    selectedUnitAllowsDecimal
                                      ? 'Opening qty from stock movements (editable when only opening exists)'
                                      : 'Whole units only for this product unit'
                                  }
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  value={variation.barcode}
                                  onChange={(e) => {
                                    const updated = [...generatedVariations];
                                    updated[index].barcode = e.target.value;
                                    setGeneratedVariations(updated);
                                  }}
                                  className="bg-card border-border text-foreground text-sm w-32"
                                  placeholder="Barcode"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="bg-card px-4 py-3 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Total Variations: <span className="text-foreground font-semibold">{generatedVariations.length}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {variantAttributes.length === 0 && (
              <div className="bg-muted border border-border rounded-xl p-8 text-center">
                <Package size={48} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No variation attributes added yet</p>
                <p className="text-sm text-muted-foreground">
                  Add attributes like Size, Color, or Material to create product variations
                </p>
              </div>
            )}
          </>
        )}

        {/* TAB 3 - COMBOS */}
        {activeTab === 'combos' && modules.combosEnabled && isComboProduct && (
          <>
            {/* Require product to be saved before adding combos */}
            {!(initialProduct?.uuid || initialProduct?.id) ? (
              <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-6 text-center">
                <p className="text-amber-200 font-medium">Save the product first to add combos</p>
                <p className="text-amber-200/80 text-sm mt-2">
                  Go to the <strong>Basic</strong> tab, fill in name and other required fields, then click <strong>Save</strong>. 
                  After the product is saved, you can return here to create combo bundles.
                </p>
              </div>
            ) : (
            <>
            {/* Info Banner */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-300">
                <strong>Product Combos:</strong> Create bundled packages by combining multiple products. 
                Set a special combo price to offer discounts on bundle purchases.
              </p>
            </div>

            {/* Step 1: Create Combo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">
                Create New Combo
              </h3>
              
              {/* Combo Name */}
              <div className="bg-muted border border-border rounded-xl p-4">
                <Label className="text-gray-200 mb-2 block">Combo Name</Label>
                <Input
                  value={comboName}
                  onChange={(e) => setComboName(e.target.value)}
                  placeholder="e.g., Wedding Package, Summer Bundle"
                  className="bg-card border-border text-foreground"
                />
              </div>

              {/* Add Products to Combo */}
              <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                <Label className="text-gray-200 block">Add Products to Combo</Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  {/* Product Search with Dropdown */}
                  <div className="md:col-span-2 relative">
                    <Input
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="Search product by name or SKU..."
                      className="bg-card border-border text-foreground text-sm"
                    />
                    
                    {/* Product Dropdown */}
                    {showProductDropdown && productSearchQuery && filteredProducts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => selectProduct(product)}
                            className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-foreground text-sm font-medium">{product.name}</p>
                                <p className="text-muted-foreground text-xs mt-1">SKU: {product.sku}</p>
                              </div>
                              <span className="text-[var(--erp-money-positive)] text-sm font-semibold">₨{product.retail_price}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {showProductDropdown && productSearchQuery && filteredProducts.length === 0 && !loadingProducts && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl p-4 text-center">
                        <p className="text-muted-foreground text-sm">No products available to add.</p>
                      </div>
                    )}
                    {loadingProducts && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl p-4 text-center">
                        <p className="text-muted-foreground text-sm">Loading products...</p>
                  </div>
                    )}
                </div>
                </div>
                {availableProducts.length === 0 && !loadingProducts && (
                  <div className="bg-card border border-border rounded-lg p-4 text-center">
                    <p className="text-muted-foreground text-sm">No products available to add.</p>
                    <p className="text-muted-foreground text-xs mt-1">Create products first, then add them to this combo.</p>
                  </div>
                )}
              </div>

              {/* Current Combo Items */}
              {currentComboItems.length > 0 && (
                <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                  <Label className="text-gray-200 block">Products in This Combo</Label>
                  <div className="space-y-2">
                    {currentComboItems.map((item, index) => (
                      <div
                        key={index}
                        className="bg-card border border-border px-4 py-3 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-1">
                            <span className="text-foreground font-medium">{item.product_name}</span>
                            <p className="text-muted-foreground text-xs mt-0.5">SKU: {item.product_sku}</p>
                          </div>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={item.qty || ''}
                            onChange={(e) => updateComboItemQty(index, parseFloat(e.target.value) || 1)}
                            className="bg-muted border-border text-foreground text-sm w-20"
                            placeholder="Qty"
                          />
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unit_price || ''}
                            onChange={(e) => updateComboItemPrice(index, parseFloat(e.target.value) || 0)}
                            className="bg-muted border-border text-foreground text-sm w-24"
                            placeholder="Price"
                          />
                          <span className="text-muted-foreground text-sm w-24 text-right">
                            Subtotal: ₨{((item.qty || 0) * (item.unit_price || 0)).toFixed(2)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeComboItem(index)}
                          className="text-red-500 hover:text-red-400 transition-colors p-2 ml-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Combo Pricing */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Individual Price:</span>
                      <span className="text-foreground font-semibold">
                        ₨{currentComboItems.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="text-gray-200">Combo Price:</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={comboFinalPrice || ''}
                        onChange={(e) => setComboFinalPrice(parseFloat(e.target.value) || 0)}
                        placeholder="Enter combo price"
                        className="bg-card border-border text-foreground flex-1"
                      />
                    </div>
                    {comboFinalPrice > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--erp-money-positive)]">Discount:</span>
                        <span className="text-[var(--erp-money-positive)] font-semibold">
                          ₨{(currentComboItems.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0) - comboFinalPrice).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={saveCombo}
                    disabled={!comboName.trim() || comboFinalPrice <= 0 || currentComboItems.length === 0}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-muted disabled:cursor-not-allowed text-foreground px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 w-full"
                  >
                    Save Combo
                  </button>
                </div>
              )}
            </div>

            {/* Saved Combos */}
            {combos.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">
                  Saved Combos ({combos.length})
                </h3>
                
                <div className="space-y-3">
                  {combos.map((combo) => (
                    <div key={combo.id} className="bg-muted border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold text-foreground">{combo.combo_name}</h4>
                        <button
                          type="button"
                          onClick={() => deleteCombo(combo.id)}
                          className="text-red-500 hover:text-red-400 transition-colors p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {combo.items.map((item, idx) => (
                          <div key={idx} className="bg-card border border-border px-3 py-2 rounded-lg flex items-center justify-between text-sm">
                            <div>
                              <span className="text-foreground">{item.product_name || 'Unknown Product'}</span>
                              {item.product_sku && (
                                <p className="text-muted-foreground text-xs mt-0.5">SKU: {item.product_sku}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>Qty: {item.qty}</span>
                              {item.unit_price && <span>₨{item.unit_price.toFixed(2)}</span>}
                              <span className="text-foreground">₨{((item.qty || 0) * (item.unit_price || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-border pt-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Individual Price:</span>
                          <span className="text-foreground">₨{combo.items.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--erp-money-positive)]">Combo Price:</span>
                          <span className="text-[var(--erp-money-positive)] font-bold">₨{combo.combo_price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-400">You Save:</span>
                          <span className="text-blue-400 font-semibold">₨{(combo.items.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0) - combo.combo_price).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {combos.length === 0 && currentComboItems.length === 0 && (
              <div className="bg-muted border border-border rounded-xl p-8 text-center">
                <Package size={48} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No combos created yet</p>
                <p className="text-sm text-muted-foreground">
                  Start adding products above to create your first combo package
                </p>
              </div>
            )}
            </>
            )}
          </>
        )}
      </div>

      <div className="p-6 border-t border-border bg-card sticky bottom-0 z-10 flex gap-4">
        <button
          onClick={onCancel}
          type="button"
          className="px-6 bg-muted hover:bg-muted text-foreground py-3 rounded-xl font-bold transition-colors border border-border"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit(
            (data) => onSubmit(data, "save"),
            onInvalid,
          )}
          type="button"
          disabled={saving}
          className="flex-1 bg-muted hover:bg-gray-600 text-foreground py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {saving ? 'Saving...' : 'Save Product'}
        </button>
        {onSaveAndAdd && (
          <button
            onClick={handleSubmit(
              (data) => onSubmit(data, "saveAndAdd"),
              onInvalid,
            )}
            type="button"
            disabled={saving}
            className="flex-[2] bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? 'Saving...' : 'Save & Add to Transaction'}
          </button>
        )}
      </div>

      {/* PART 5: Modal when blocking enable variations (parent-level stock exists) */}
      <Dialog open={blockVariationsModalOpen} onOpenChange={setBlockVariationsModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cannot enable variations</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Parent-level stock exists. Clear or adjust stock first.
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Clear or adjust stock in Inventory first, then add variations. Opening stock for each size/color can be set in the Variations tab after saving.
          </p>
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setBlockVariationsModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-gray-600 text-foreground rounded-lg text-sm font-medium"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockDisableVariationsModalOpen} onOpenChange={setBlockDisableVariationsModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cannot disable variations</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Variation-level stock exists. Cannot disable variations until variation stock is cleared or adjusted.
          </p>
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setBlockDisableVariationsModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-gray-600 text-foreground rounded-lg text-sm font-medium"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PART 6: Modal when blocking enable combo (parent-level stock exists) */}
      <Dialog open={blockEnableComboModalOpen} onOpenChange={setBlockEnableComboModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cannot enable combo</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This product already has stock. Clear stock before enabling Combo mode.
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Clear or adjust stock in Inventory first, then enable Combo mode. Combo products do not hold stock - stock is managed through component products.
          </p>
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setBlockEnableComboModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-gray-600 text-foreground rounded-lg text-sm font-medium"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PART 7: Modal when blocking disable combo (combo items exist) */}
      <Dialog open={blockDisableComboModalOpen} onOpenChange={setBlockDisableComboModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cannot disable combo</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This product has combo components. Remove them before disabling Combo mode.
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Delete all combo items in the Combos tab first, then you can disable Combo mode.
          </p>
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setBlockDisableComboModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-gray-600 text-foreground rounded-lg text-sm font-medium"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedProductForm;
