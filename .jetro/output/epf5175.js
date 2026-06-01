import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/app/components/products/EnhancedProductForm.tsx");import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false, "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.-Di5M1AY_6w7XksvYOOxS_yRpZRF4HYyB-Jn_UZGRq4", "VITE_SUPABASE_URL": "https://supabase.dincouture.pk"};import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=704c05ff"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=704c05ff"; const useCallback = __vite__cjsImport3_react["useCallback"]; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"];
import { useDropzone } from "/node_modules/.vite/deps/react-dropzone.js?v=704c05ff";
import { useForm, Controller } from "/node_modules/.vite/deps/react-hook-form.js?v=704c05ff";
import { zodResolver } from "/node_modules/.vite/deps/@hookform_resolvers_zod.js?v=704c05ff";
import * as z from "/node_modules/.vite/deps/zod.js?v=704c05ff";
import { useSupabase } from "/src/app/context/SupabaseContext.tsx";
import { useSettings } from "/src/app/context/SettingsContext.tsx";
import { useDocumentNumbering } from "/src/app/hooks/useDocumentNumbering.ts";
import {
  productService,
  mapProductVariationApiToFormRow,
  formatVariationName
} from "/src/app/services/productService.ts";
import { variationMasterService } from "/src/app/services/variationMasterService.ts";
import { variationLibraryService } from "/src/app/services/variationLibraryService.ts";
import { inventoryService } from "/src/app/services/inventoryService.ts";
import { brandService } from "/src/app/services/brandService.ts";
import { productCategoryService } from "/src/app/services/productCategoryService.ts";
import { unitService } from "/src/app/services/unitService.ts";
import { contactService } from "/src/app/services/contactService.ts";
import { branchService } from "/src/app/services/branchService.ts";
import { comboService } from "/src/app/services/comboService.ts";
import { supabase } from "/src/lib/supabase.ts";
import { uploadProductImages } from "/src/app/utils/productImageUpload.ts";
import { parseVariationAttributesRaw, publicVariationAttributes } from "/src/app/utils/variationFieldMap.ts";
import { ProductImage } from "/src/app/components/products/ProductImage.tsx";
import { getSupabaseStorageDashboardUrl } from "/src/app/utils/paymentAttachmentUrl.ts";
import { toast } from "/node_modules/.vite/deps/sonner.js?v=704c05ff";
import {
  X,
  Upload,
  Plus,
  Trash2,
  RefreshCcw,
  Package,
  DollarSign
} from "/node_modules/.vite/deps/lucide-react.js?v=704c05ff";
import { clsx } from "/node_modules/.vite/deps/clsx.js?v=704c05ff";
import { Label } from "/src/app/components/ui/label.tsx";
import { Input } from "/src/app/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "/src/app/components/ui/select.tsx";
import { SearchableSelect } from "/src/app/components/ui/searchable-select.tsx";
import { Switch } from "/src/app/components/ui/switch.tsx";
import { Textarea } from "/src/app/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "/src/app/components/ui/dialog.tsx";
const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcodeType: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  unit: z.string().optional(),
  // Sales Pricing (Always Sellable in Retail Mode)
  purchasePrice: z.coerce.number().min(0).optional(),
  margin: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0.01, "Selling price is required"),
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
  supplierCode: z.string().optional()
});
const setValueAsNumber = (v) => {
  if (v === "" || v === void 0 || v === null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
export const EnhancedProductForm = ({
  product: initialProduct,
  onCancel,
  onSave,
  onSaveAndAdd
}) => {
  _s();
  const { companyId, branchId } = useSupabase();
  const settings = useSettings();
  const { modules } = settings;
  const { generateDocumentNumber, generateDocumentNumberSafe, incrementNextNumber } = useDocumentNumbering();
  const [saving, setSaving] = useState(false);
  const submitInProgressRef = useRef(false);
  const [enableVariations, setEnableVariations] = useState(false);
  const [blockDisableVariationsModalOpen, setBlockDisableVariationsModalOpen] = useState(false);
  const [isComboProduct, setIsComboProduct] = useState(false);
  const [blockEnableComboModalOpen, setBlockEnableComboModalOpen] = useState(false);
  const [blockDisableComboModalOpen, setBlockDisableComboModalOpen] = useState(false);
  const [images, setImages] = useState([]);
  const [existingImageUrls, setExistingImageUrls] = useState([]);
  const [isRentalOptionsOpen, setIsRentalOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [companyBranches, setCompanyBranches] = useState([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  const [variantAttributes, setVariantAttributes] = useState([]);
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newAttributeValue, setNewAttributeValue] = useState("");
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState(null);
  const [blockVariationsModalOpen, setBlockVariationsModalOpen] = useState(false);
  const [fullProductForEdit, setFullProductForEdit] = useState(null);
  const [loadingFullProduct, setLoadingFullProduct] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState(
    []
  );
  const [variationMaster, setVariationMaster] = useState({});
  const [productsWithVariations, setProductsWithVariations] = useState([]);
  const [variationsForCopy, setVariationsForCopy] = useState([]);
  const [loadingProductsWithVariations, setLoadingProductsWithVariations] = useState(false);
  const [copyFromVariationId, setCopyFromVariationId] = useState("");
  const [combos, setCombos] = useState([]);
  const [currentComboItems, setCurrentComboItems] = useState([]);
  const [comboName, setComboName] = useState("");
  const [comboFinalPrice, setComboFinalPrice] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    getValues,
    formState: { errors }
  } = useForm({
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
      maxStock: 1e3
    }
  });
  const stockManagement = watch("stockManagement");
  const purchasePrice = watch("purchasePrice");
  const margin = watch("margin");
  const selectedUnitId = watch("unit");
  const selectedUnitAllowsDecimal = units.find((u) => u.id === selectedUnitId)?.allow_decimal ?? false;
  const parseVariationQtyInput = (raw) => {
    if (selectedUnitAllowsDecimal) {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    return Math.max(0, parseInt(raw, 10) || 0);
  };
  useEffect(() => {
    const loadCategories = async () => {
      if (!companyId) return;
      try {
        setLoadingCategories(true);
        const data = await productCategoryService.getCategories(companyId);
        setCategories(data.map((c) => ({ id: c.id, name: c.name })));
      } catch (error) {
        console.error("[PRODUCT FORM] Error loading categories:", error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, [companyId]);
  useEffect(() => {
    const loadBrands = async () => {
      if (!companyId) return;
      try {
        setLoadingBrands(true);
        const data = await brandService.getAll(companyId);
        setBrands(data.map((b) => ({ id: b.id, name: b.name })));
      } catch (error) {
        console.error("[PRODUCT FORM] Error loading brands:", error);
        setBrands([]);
      } finally {
        setLoadingBrands(false);
      }
    };
    loadBrands();
  }, [companyId]);
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
        if (!initialProduct) {
          const currentUnit = getValues("unit");
          if (!currentUnit) {
            const settingsDefaultId = settings.inventorySettings?.defaultUnitId;
            const defaultUnit = settingsDefaultId && data.find((u) => u.id === settingsDefaultId) || data.find((u) => u.is_default) || data[0];
            if (defaultUnit) {
              setValue("unit", defaultUnit.id);
            }
          }
        }
      } catch (error) {
        console.error("[PRODUCT FORM] Error loading units:", error);
        setUnits([]);
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, [companyId, initialProduct, setValue, getValues, settings.inventorySettings?.defaultUnitId]);
  useEffect(() => {
    if (!companyId) return;
    void (async () => {
      try {
        const [legacy, library] = await Promise.all(
          [
            variationMasterService.get(companyId).catch(() => ({})),
            variationLibraryService.listAttributes(companyId).catch(() => [])
          ]
        );
        const merged = { ...legacy || {} };
        for (const attr of library) {
          const existing = new Set((merged[attr.name] || []).map((v) => v.toLowerCase()));
          const add = attr.values.map((v) => v.value).filter((v) => !existing.has(v.toLowerCase()));
          merged[attr.name] = [...merged[attr.name] || [], ...add];
        }
        setVariationMaster(merged);
      } catch {
        setVariationMaster({});
      }
    })();
  }, [companyId]);
  useEffect(() => {
    const loadSuppliers = async () => {
      if (!companyId) return;
      try {
        setLoadingSuppliers(true);
        const data = await contactService.getAllContacts(companyId, "supplier");
        setSuppliers((data || []).map((c) => ({ id: c.id, name: c.name || "Unnamed" })));
      } catch (error) {
        console.error("[PRODUCT FORM] Error loading suppliers:", error);
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
      const list = (branches || []).map((b) => ({ id: b.id, name: b.name }));
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
      else
        setSelectedBranchIds(companyBranches.map((b) => b.id));
    }).catch(() => {
    });
  }, [companyId, initialProduct?.uuid, initialProduct?.id, companyBranches]);
  useEffect(() => {
    if (!companyId || activeTab !== "variations" || !enableVariations) return;
    let cancelled = false;
    setLoadingProductsWithVariations(true);
    productService.getAllProducts(companyId).then((data) => {
      if (cancelled) return;
      const withVars = (data || []).filter(
        (p) => p.has_variations && Array.isArray(p.variations) && p.variations.length > 0
      );
      setProductsWithVariations(
        withVars.map((p) => ({
          id: p.id,
          name: p.name || "Unnamed",
          sku: p.sku || "",
          variations: p.variations || []
        }))
      );
      const flat = [];
      for (const p of withVars) {
        const supplierId = p.supplier_id || p.supplier;
        const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? "—";
        (p.variations || []).forEach((v, idx) => {
          const attrs = v.attributes && typeof v.attributes === "object" ? v.attributes : {};
          for (const [attrName, val] of Object.entries(attrs)) {
            if (!attrName || val == null) continue;
            const label = `${attrName}: ${val}`;
            flat.push({
              productId: p.id,
              variationId: `${p.id}-${idx}-${attrName}-${String(val).replace(/\s/g, "_")}`,
              product: p,
              supplierName,
              label
            });
          }
        });
      }
      setVariationsForCopy(flat);
    }).catch(() => {
      if (!cancelled) setProductsWithVariations([]);
      if (!cancelled) setVariationsForCopy([]);
    }).finally(() => {
      if (!cancelled) setLoadingProductsWithVariations(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, activeTab, enableVariations, suppliers]);
  const selectedCategoryId = watch("category");
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
        console.error("[PRODUCT FORM] Error loading sub-categories:", error);
        setSubCategories([]);
      }
    };
    loadSubCategories();
  }, [companyId, selectedCategoryId]);
  const generateSKU = useCallback(() => {
    const n = generateDocumentNumber("production");
    return n && String(n).trim() ? n : "PRD-0001";
  }, [generateDocumentNumber]);
  useEffect(() => {
    if (initialProduct || !companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const nextSKU = await generateDocumentNumberSafe("production");
        if (!cancelled && nextSKU) setValue("sku", nextSKU);
      } catch (e) {
        if (!cancelled) setValue("sku", generateSKU());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, initialProduct, setValue, generateDocumentNumberSafe, generateSKU]);
  useEffect(() => {
    const productId = initialProduct?.uuid || initialProduct?.id;
    if (!productId || typeof productId !== "string") {
      setFullProductForEdit(null);
      setLoadingFullProduct(false);
      return;
    }
    let cancelled = false;
    setLoadingFullProduct(true);
    setFullProductForEdit(null);
    productService.getProduct(productId).then((full) => {
      if (!cancelled) {
        setFullProductForEdit(full);
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error("[PRODUCT FORM] Failed to load full product for edit:", err);
        setFullProductForEdit(null);
      }
    }).finally(() => {
      if (!cancelled) setLoadingFullProduct(false);
    });
    return () => {
      cancelled = true;
    };
  }, [initialProduct?.uuid, initialProduct?.id]);
  useEffect(() => {
    const source = fullProductForEdit ?? initialProduct;
    if (source) {
      setEnableVariations(!!(source.has_variations ?? source.variations?.length > 0));
    } else if (!initialProduct) {
      setEnableVariations(false);
    }
  }, [initialProduct, fullProductForEdit]);
  useEffect(() => {
    let cancelled = false;
    const source = fullProductForEdit ?? initialProduct;
    if (source) {
      setValue("name", source.name || "");
      setValue("sku", source.sku || "");
      setValue("barcodeType", source.barcode_type || "code128");
      setValue("barcode", source.barcode || "");
      setValue("purchasePrice", source.cost_price ?? source.purchasePrice ?? 0);
      setValue("sellingPrice", source.retail_price ?? source.sellingPrice ?? 0);
      setValue("wholesalePrice", source.wholesale_price ?? source.retail_price ?? 0);
      setValue("rentalPrice", source.rental_price_daily ?? 0);
      setValue("alertQty", source.min_stock ?? source.lowStockThreshold ?? 0);
      setValue("maxStock", source.max_stock ?? 1e3);
      setValue("description", source.description || "");
      setValue("brand", source.brand_id || "");
      setValue("unit", source.unit_id || "");
      setValue("supplier", source.supplier_id || source.supplier || "");
      setValue("supplierCode", source.supplier_code || source.supplierCode || "");
      const catId = source.category_id || source.category?.id || "";
      if (catId) {
        productCategoryService.getById(catId).then((cat) => {
          if (cat.parent_id) {
            setValue("category", cat.parent_id);
            setValue("subCategory", cat.id);
          } else {
            setValue("category", cat.id);
            setValue("subCategory", "");
          }
        }).catch(() => {
          setValue("category", catId);
          setValue("subCategory", "");
        });
      } else {
        setValue("category", "");
        setValue("subCategory", "");
      }
      if (source.variations && Array.isArray(source.variations) && source.variations.length > 0) {
        const firstParsed = publicVariationAttributes(
          parseVariationAttributesRaw(source.variations[0]?.attributes)
        );
        const attrNames = Object.keys(firstParsed).sort((a, b) => a.localeCompare(b));
        if (attrNames.length > 0) {
          const valuesByAttr = {};
          attrNames.forEach((k) => {
            valuesByAttr[k] = /* @__PURE__ */ new Set();
          });
          source.variations.forEach((v) => {
            const a = publicVariationAttributes(parseVariationAttributesRaw(v.attributes));
            attrNames.forEach((k) => {
              if (a[k] != null && a[k] !== "") valuesByAttr[k].add(String(a[k]));
            });
          });
          setVariantAttributes(
            attrNames.map((name) => ({
              name,
              values: Array.from(valuesByAttr[name] || []).sort((a, b) => a.localeCompare(b))
            }))
          );
        } else {
          setVariantAttributes([]);
        }
        const mapped = source.variations.map(
          (v) => mapProductVariationApiToFormRow(v)
        );
        const pid = source.uuid || source.id;
        (async () => {
          if (companyId && pid && mapped.some((m) => m.id)) {
            const branchScope = branchId && branchId !== "all" ? branchId : null;
            const withMovement = await Promise.all(
              mapped.map(async (row) => {
                if (!row.id) return row;
                try {
                  const qty = await inventoryService.getStock(companyId, pid, row.id, branchScope);
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
      const urls = source?.image_urls;
      setExistingImageUrls(Array.isArray(urls) ? [...urls] : []);
      if (source.is_combo_product !== void 0) {
        setIsComboProduct(!!source.is_combo_product);
      }
      const productId = source.uuid || source.id;
      if (productId) loadProductCombos(productId);
    } else {
      setExistingImageUrls([]);
      setIsComboProduct(false);
      setFullProductForEdit(null);
      setGeneratedVariations([]);
      setVariantAttributes([]);
    }
    return () => {
      cancelled = true;
    };
  }, [fullProductForEdit, initialProduct, setValue, companyId, branchId]);
  useEffect(() => {
    const source = fullProductForEdit ?? initialProduct;
    const pid = source?.uuid || source?.id;
    if (!companyId || !pid || typeof pid !== "string") return;
    let cancelled = false;
    const hasVar = !!(source?.has_variations ?? (source?.variations && source.variations.length > 0));
    const branchScope = branchId && branchId !== "all" ? branchId : null;
    if (hasVar || source?.is_combo_product) {
      setValue("initialStock", 0, { shouldValidate: false, shouldDirty: false });
      return;
    }
    (async () => {
      try {
        const qty = await inventoryService.getStock(companyId, pid, null, branchScope);
        if (!cancelled) setValue("initialStock", Math.round(qty * 100) / 100, { shouldValidate: false, shouldDirty: false });
      } catch {
        const fallback = Number(source?.stock ?? source?.current_stock ?? 0) || 0;
        if (!cancelled) setValue("initialStock", fallback, { shouldValidate: false, shouldDirty: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fullProductForEdit, initialProduct, companyId, branchId, setValue]);
  useEffect(() => {
    if (modules.combosEnabled && isComboProduct && companyId) {
      loadAvailableProducts();
    } else {
      setAvailableProducts([]);
    }
  }, [modules.combosEnabled, isComboProduct, companyId]);
  const loadAvailableProducts = async () => {
    if (!companyId) return;
    setLoadingProducts(true);
    try {
      const currentProductId = initialProduct?.uuid || initialProduct?.id;
      const isValidUuid = typeof currentProductId === "string" && currentProductId.length === 36 && /^[0-9a-f-]{36}$/i.test(currentProductId);
      let query = supabase.from("products").select("id, name, sku, retail_price, has_variations").eq("company_id", companyId).eq("is_active", true).eq("is_combo_product", false);
      if (isValidUuid) {
        query = query.neq("id", currentProductId);
      }
      const { data, error } = await query.order("name");
      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (error) {
      console.error("[PRODUCT FORM] Error loading products for combo:", error);
      toast.error("Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };
  const loadProductCombos = async (productId) => {
    if (!companyId || !productId) return;
    try {
      const combo = await comboService.getComboByProductId(productId, companyId);
      if (combo) {
        const itemsWithDetails = await comboService.getComboItemsWithDetails(combo.id, companyId);
        setCombos([{
          id: combo.id,
          combo_name: combo.combo_name,
          combo_price: combo.combo_price,
          items: itemsWithDetails.map((item) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            variation_id: item.variation_id,
            qty: item.qty,
            unit_price: item.unit_price
          }))
        }]);
      }
    } catch (error) {
      console.error("[PRODUCT FORM] Error loading combos:", error);
    }
  };
  useEffect(() => {
    const purchasePriceNum = typeof purchasePrice === "number" ? purchasePrice : parseFloat(String(purchasePrice || 0)) || 0;
    const marginNum = typeof margin === "number" ? margin : parseFloat(String(margin || 0)) || 0;
    if (purchasePriceNum > 0 && marginNum > 0) {
      const sp = purchasePriceNum + purchasePriceNum * marginNum / 100;
      if (typeof sp === "number" && !isNaN(sp)) {
        const sellingPrice = Number(sp.toFixed(2));
        setValue("sellingPrice", sellingPrice, { shouldValidate: false, shouldDirty: false });
      }
    }
  }, [purchasePrice, margin, setValue]);
  const onDrop = useCallback((acceptedFiles) => {
    setImages((prev) => [...prev, ...acceptedFiles]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] }, maxSize: 5 * 1024 * 1024 });
  const generateSKUForForm = async () => {
    if (initialProduct) {
      setValue("sku", initialProduct.sku || getValues("sku"));
      return;
    }
    const nextSKU = await generateDocumentNumberSafe("production");
    if (nextSKU) setValue("sku", nextSKU);
    else
      setValue("sku", generateSKU());
  };
  const handleEnableVariationsChange = async (checked) => {
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
      setValue("initialStock", 0, { shouldValidate: false });
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
      if (activeTab === "variations") setActiveTab("inventory");
    }
  };
  const handleEnableComboChange = async (checked) => {
    const productId = initialProduct?.uuid ?? initialProduct?.id;
    if (checked) {
      if (productId) {
        const parentCount = await inventoryService.getParentLevelMovementCount(productId);
        if (parentCount > 0) {
          setBlockEnableComboModalOpen(true);
          return;
        }
      }
      setIsComboProduct(true);
      setValue("initialStock", 0, { shouldValidate: false });
      if (!modules.combosEnabled) {
        toast.error("Combo module is disabled. Enable it in Settings first.");
        return;
      }
    } else {
      if (productId && combos.length > 0) {
        setBlockDisableComboModalOpen(true);
        return;
      }
      setIsComboProduct(false);
      setCombos([]);
      setCurrentComboItems([]);
      setComboName("");
      setComboFinalPrice(0);
      if (activeTab === "combos") setActiveTab("inventory");
    }
  };
  const persistVariationMasterMerge = async (next) => {
    if (!companyId) return;
    try {
      await variationMasterService.save(companyId, next);
      setVariationMaster(next);
    } catch {
    }
  };
  const addVariantAttribute = () => {
    const name = newAttributeName.trim();
    if (name && !variantAttributes.some((attr) => attr.name === name)) {
      setVariantAttributes([...variantAttributes, { name, values: [] }]);
      setNewAttributeName("");
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
        setNewAttributeValue("");
        if (companyId && attrName) {
          const next = { ...variationMaster };
          const list = /* @__PURE__ */ new Set([...next[attrName] || [], val]);
          next[attrName] = Array.from(list).sort((a, b) => a.localeCompare(b));
          void persistVariationMasterMerge(next);
        }
      }
    }
  };
  const removeVariantAttribute = (attrName) => {
    setVariantAttributes(variantAttributes.filter((a) => a.name !== attrName));
    setGeneratedVariations([]);
  };
  const removeAttributeValue = (attrIndex, valueIndex) => {
    const updatedAttributes = [...variantAttributes];
    updatedAttributes[attrIndex].values.splice(valueIndex, 1);
    setVariantAttributes(updatedAttributes);
    setGeneratedVariations([]);
  };
  const copyAttributesFromProduct = (product) => {
    const vars = product.variations || [];
    if (vars.length === 0) return;
    const attrMap = {};
    for (const v of vars) {
      const attrs = publicVariationAttributes(parseVariationAttributesRaw(v.attributes));
      for (const [key, val] of Object.entries(attrs)) {
        if (!key || val == null || val === "") continue;
        if (!attrMap[key]) attrMap[key] = /* @__PURE__ */ new Set();
        attrMap[key].add(String(val));
      }
    }
    const derived = Object.entries(attrMap).map(([name, set]) => ({
      name,
      values: Array.from(set).sort()
    }));
    if (derived.length > 0) {
      setVariantAttributes(derived);
      setGeneratedVariations([]);
      toast.success(`Copied ${derived.length} attribute(s) from existing product`);
    }
  };
  const MAX_VARIATIONS = 100;
  const cartesianProduct = (arrays) => {
    if (arrays.length === 0) return [[]];
    return arrays.reduce((a, b) => a.flatMap((d) => b.map((e) => [...Array.isArray(d) ? d : [d], e])), [[]]);
  };
  const variationComboKey = (combinationObj) => variantAttributes.map((a) => `${a.name}=${combinationObj[a.name] ?? ""}`).join("|");
  const generateVariations = () => {
    const attributeValues = variantAttributes.map((attr) => attr.values);
    const combinations = cartesianProduct(attributeValues);
    if (combinations.length > MAX_VARIATIONS) {
      toast.error(`Variation limit (${MAX_VARIATIONS}) exceeded. You have ${combinations.length} combinations. Reduce attribute values or use fewer attributes.`);
      return;
    }
    const baseSku = (getValues("sku") || "").trim() || generateSKU();
    const basicSellingPrice = getValues("sellingPrice") ?? 0;
    const basicPurchasePrice = getValues("purchasePrice") ?? 0;
    const existingByCombo = new Map(generatedVariations.map((ev) => [variationComboKey(ev.combination), ev]));
    const newVariations = combinations.map((combination, index) => {
      const combinationObj = {};
      variantAttributes.forEach((attr, i) => {
        combinationObj[attr.name] = combination[i];
      });
      const prev = existingByCombo.get(variationComboKey(combinationObj));
      if (prev) {
        return { ...prev, combination: combinationObj };
      }
      return {
        id: void 0,
        combination: combinationObj,
        sku: `${baseSku}-V${index + 1}`,
        price: Number(basicSellingPrice) || 0,
        purchasePrice: Number(basicPurchasePrice) || 0,
        stock: 0,
        barcode: ""
      };
    });
    setGeneratedVariations(newVariations);
  };
  const filteredProducts = availableProducts.filter(
    (product) => product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || product.sku.toLowerCase().includes(productSearchQuery.toLowerCase())
  );
  const selectProduct = (product) => {
    if (currentComboItems.some((item) => item.product_id === product.id && !item.variation_id)) {
      toast.error("Product already added to combo");
      return;
    }
    setCurrentComboItems([...currentComboItems, {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      variation_id: null,
      // TODO: Add variation selection if has_variations
      qty: 1,
      unit_price: product.retail_price
    }]);
    setProductSearchQuery("");
    setShowProductDropdown(false);
  };
  const removeComboItem = (index) => {
    setCurrentComboItems(currentComboItems.filter((_, i) => i !== index));
  };
  const updateComboItemQty = (index, qty) => {
    if (qty <= 0) return;
    const updated = [...currentComboItems];
    updated[index].qty = qty;
    setCurrentComboItems(updated);
  };
  const updateComboItemPrice = (index, price) => {
    if (price < 0) return;
    const updated = [...currentComboItems];
    updated[index].unit_price = price;
    setCurrentComboItems(updated);
  };
  const saveCombo = async () => {
    if (!comboName.trim() || comboFinalPrice <= 0 || currentComboItems.length === 0) {
      toast.error("Please fill all combo fields and add at least one product");
      return;
    }
    if (!companyId) {
      toast.error("Company ID missing");
      return;
    }
    const productId = initialProduct?.uuid || initialProduct?.id;
    if (!productId) {
      toast.error("Save the product first (Basic tab), then you can add combos here.");
      return;
    }
    try {
      if (combos.length > 0 && combos[0].id) {
        await comboService.updateCombo(combos[0].id, companyId, {
          combo_name: comboName,
          combo_price: comboFinalPrice
        });
        await comboService.updateComboItems(combos[0].id, companyId, currentComboItems);
        toast.success("Combo updated!");
      } else {
        const newCombo = await comboService.createCombo({
          company_id: companyId,
          combo_product_id: productId,
          combo_name: comboName,
          combo_price: comboFinalPrice,
          items: currentComboItems
        });
        setCombos([{
          id: newCombo.id,
          combo_name: newCombo.combo_name,
          combo_price: newCombo.combo_price,
          items: newCombo.items.map((item) => ({
            id: item.id,
            product_id: item.product_id,
            variation_id: item.variation_id,
            qty: item.qty,
            unit_price: item.unit_price
          }))
        }]);
        toast.success("Combo saved!");
      }
      setCurrentComboItems([]);
      setComboName("");
      setComboFinalPrice(0);
      setProductSearchQuery("");
    } catch (error) {
      console.error("[PRODUCT FORM] Error saving combo:", error);
      toast.error(error?.message || "Failed to save combo");
    }
  };
  const deleteCombo = async (id) => {
    if (!companyId) {
      toast.error("Company ID missing");
      return;
    }
    try {
      await comboService.deleteCombo(id, companyId);
      setCombos(combos.filter((c) => c.id !== id));
      toast.success("Combo deleted!");
    } catch (error) {
      console.error("[PRODUCT FORM] Error deleting combo:", error);
      toast.error(error?.message || "Failed to delete combo");
    }
  };
  const onSubmit = async (data, action) => {
    if (submitInProgressRef.current) return;
    submitInProgressRef.current = true;
    if (!companyId) {
      toast.error("Company ID not found. Please login again.");
      submitInProgressRef.current = false;
      return;
    }
    const finalCompanyId = companyId;
    if (!finalCompanyId) {
      toast.error("Company information required. Please login again.");
      submitInProgressRef.current = false;
      return;
    }
    try {
      setSaving(true);
      const finalSKU = data.sku && data.sku.trim() !== "" ? data.sku : generateSKU();
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const asId = (v) => {
        if (v == null || v === "") return null;
        if (typeof v === "string" && UUID_REGEX.test(v)) return v;
        if (typeof v === "object" && v !== null && "id" in v && typeof v.id === "string") return v.id;
        return null;
      };
      const rawUnit = getValues("unit") ?? data.unit;
      const rawCategory = getValues("category") ?? data.category;
      const rawSubCategory = getValues("subCategory") ?? data.subCategory;
      const rawBrand = getValues("brand") ?? data.brand;
      let categoryId = asId(rawSubCategory) ?? asId(rawCategory) ?? null;
      if (!categoryId && (rawCategory || rawSubCategory)) {
        const found = categories.find((c) => c.id === rawCategory || c.id === rawSubCategory) || subCategories.find((c) => c.id === rawCategory || c.id === rawSubCategory);
        if (found) categoryId = found.id;
      }
      const unitId = asId(rawUnit);
      const brandId = asId(rawBrand);
      let barcodeValue = null;
      try {
        if (data.barcode && data.barcode.trim() !== "") barcodeValue = data.barcode.trim();
      } catch (barcodeError) {
        console.warn("[PRODUCT FORM] Barcode error (non-blocking):", barcodeError);
      }
      const productData = {
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
        current_stock: enableVariations || isComboProduct ? 0 : (data.initialStock ?? 0) > 0 && !initialProduct?.id ? 0 : data.initialStock ?? 0,
        min_stock: data.alertQty ?? 0,
        max_stock: data.maxStock ?? 1e3,
        has_variations: enableVariations,
        is_combo_product: isComboProduct,
        // Save combo flag
        is_rentable: (data.rentalPrice ?? 0) > 0,
        is_sellable: true,
        track_stock: data.stockManagement !== false,
        is_active: true
      };
      const productId = initialProduct?.uuid ?? initialProduct?.id;
      const isEdit = !!productId;
      if (isEdit) {
        let imageUrls = [...existingImageUrls];
        if (images.length > 0) {
          try {
            const newUrls = await uploadProductImages(finalCompanyId, productId, images);
            imageUrls = [...imageUrls, ...newUrls];
          } catch (uploadErr) {
            console.error("[PRODUCT FORM] Image upload failed:", uploadErr);
            const msg = uploadErr?.message || "Images failed to upload.";
            const isBucketMissing = String(msg).toLowerCase().includes("bucket not found");
            toast.error(msg, isBucketMissing ? { action: { label: "Open Storage", onClick: () => window.open(getSupabaseStorageDashboardUrl(), "_blank") } } : void 0);
          }
        }
        if (imageUrls.length > 0) productData.image_urls = imageUrls;
        if (enableVariations) {
          const parentLevelCount = await inventoryService.getParentLevelMovementCount(productId);
          if (parentLevelCount > 0) {
            setBlockVariationsModalOpen(true);
            setSaving(false);
            submitInProgressRef.current = false;
            return;
          }
        }
        const hasVariations = enableVariations;
        const initialStock = Number(data.initialStock) || 0;
        const movementCount = await inventoryService.getMovementCountForProduct(productId);
        delete productData.current_stock;
        if (hasVariations) productData.current_stock = 0;
        const result = await productService.updateProduct(productId, productData);
        const branchIdOrNull = branchId && branchId !== "all" ? branchId : null;
        if (enableVariations && generatedVariations.length > 0 && finalCompanyId) {
          const parentCost = Number(data.purchasePrice) || 0;
          const parentSell = Number(data.sellingPrice) || 0;
          for (const row of generatedVariations) {
            const purchN = Number(row.purchasePrice);
            const sellN = Number(row.price);
            const cost = Number.isFinite(purchN) ? purchN : parentCost;
            const selling = Number.isFinite(sellN) ? sellN : parentSell;
            if (import.meta.env.DEV) {
              if (row.id && !Number.isFinite(purchN)) {
                console.warn(
                  "[PRODUCT FORM] Variation update: purchasePrice not a finite number; using parent cost",
                  row.id,
                  row
                );
              }
              if (row.id && !Number.isFinite(sellN)) {
                console.warn(
                  "[PRODUCT FORM] Variation update: selling price not finite; using parent selling price",
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
                  price: selling
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
                    parseVariationQtyInput(String(row.stock ?? "")),
                    cost
                  );
                  if (vMovErr) console.error("[PRODUCT FORM] Variation opening reconcile failed:", vMovErr);
                }
              } else {
                const q = parseVariationQtyInput(String(row.stock ?? ""));
                const created = await productService.createVariation({
                  product_id: productId,
                  name,
                  sku: row.sku,
                  barcode: row.barcode || null,
                  attributes: row.combination,
                  cost_price: cost,
                  retail_price: selling,
                  current_stock: q
                });
                const vid = created?.id;
                if (q > 0 && vid && finalCompanyId) {
                  const { error: movErr } = await inventoryService.insertOpeningBalanceMovement(
                    finalCompanyId,
                    branchIdOrNull,
                    productId,
                    q,
                    cost,
                    vid
                  );
                  if (movErr) console.error("[PRODUCT FORM] Variation opening movement failed:", movErr);
                }
              }
            } catch (ve) {
              console.error("[PRODUCT FORM] Variation save failed:", ve);
              toast.warning("Product saved but one or more variations failed to save. Check the Variations tab.");
            }
          }
        }
        const canReconcileOpening = await inventoryService.allowsParentOpeningReconcileFromProductForm(
          finalCompanyId,
          productId,
          branchIdOrNull
        );
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
            console.error("[PRODUCT FORM] Opening balance movement failed:", movErr);
            toast.error("Product updated but opening stock could not be recorded. You can add an adjustment in Inventory.");
          }
        }
        if (companyBranches.length > 1 && productId) {
          try {
            await productService.setProductBranchAvailability(
              finalCompanyId,
              productId,
              selectedBranchIds
            );
          } catch (branchErr) {
            console.warn("[PRODUCT FORM] branch availability save failed:", branchErr);
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
          combos
        };
        toast.success("Product updated successfully!");
        if (action === "saveAndAdd" && onSaveAndAdd) {
          onSaveAndAdd(payload);
        } else {
          onSave(payload);
        }
      } else {
        const branchIdOrNull = branchId && branchId !== "all" ? branchId : null;
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
        const variationPayload = hasVariations && generatedVariations.length > 0 ? generatedVariations.map((variation) => {
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
            opening_stock: parseVariationQtyInput(String(variation.stock ?? ""))
          };
        }) : [];
        const saveResult = await productService.saveProductWithVariations({
          companyId: finalCompanyId,
          branchIdOrNull,
          parent: {
            ...productData,
            opening_stock: hasVariations ? 0 : initialStock
          },
          variations: variationPayload
        });
        incrementNextNumber("production");
        const result = { id: saveResult.productId };
        if (companyBranches.length > 1 && result?.id) {
          try {
            await productService.setProductBranchAvailability(
              finalCompanyId,
              result.id,
              selectedBranchIds
            );
          } catch (branchErr) {
            console.warn("[PRODUCT FORM] branch availability save failed:", branchErr);
          }
        }
        if (images.length > 0 && result?.id) {
          try {
            const imageUrls = await uploadProductImages(finalCompanyId, result.id, images);
            await productService.updateProduct(result.id, { image_urls: imageUrls });
          } catch (uploadErr) {
            console.error("[PRODUCT FORM] Image upload failed:", uploadErr);
            const msg = uploadErr?.message || "Product saved but images failed to upload.";
            const isBucketMissing = String(msg).toLowerCase().includes("bucket not found");
            toast.error(msg, isBucketMissing ? { action: { label: "Open Storage", onClick: () => window.open(getSupabaseStorageDashboardUrl(), "_blank") } } : void 0);
          }
        }
        const payload = {
          ...data,
          sku: finalSKU,
          id: result.id,
          isSellable: true,
          isRentable: (data.rentalPrice || 0) > 0,
          variations: generatedVariations,
          combos
        };
        if (generatedVariations.length > 0) {
          toast.success(`Product created with ${generatedVariations.length} variations!`);
        } else {
          toast.success("Product created successfully!");
        }
        if (action === "saveAndAdd" && onSaveAndAdd) {
          onSaveAndAdd(payload);
        } else {
          onSave(payload);
        }
      }
    } catch (error) {
      const wasEdit = !!(initialProduct?.uuid ?? initialProduct?.id);
      const msg = error?.message || "Unknown error";
      console.error("[PRODUCT FORM] Error saving product:", error);
      if (msg.includes("SKU") && msg.includes("already") && !wasEdit) {
        toast.error(msg, { duration: 6e3 });
        incrementNextNumber("production");
        setValue("sku", generateSKU());
      } else {
        toast.error(wasEdit ? "Failed to update product: " + msg : "Failed to create product: " + msg);
      }
    } finally {
      setSaving(false);
      submitInProgressRef.current = false;
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col h-full min-h-0 bg-gray-950 text-white relative", children: [
    loadingFullProduct && initialProduct && /* @__PURE__ */ jsxDEV("div", { className: "absolute inset-0 bg-gray-950/80 z-20 flex items-center justify-center rounded-xl", children: /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center gap-3", children: [
      /* @__PURE__ */ jsxDEV(RefreshCcw, { size: 32, className: "text-blue-400 animate-spin" }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 1478,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-400", children: "Loading product..." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 1479,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 1477,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 1476,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 z-10", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("h2", { className: "text-xl font-bold", children: initialProduct ? "Edit Product" : "Add New Product" }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1485,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-400", children: initialProduct ? "Update product details" : "Complete product details for inventory" }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1486,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 1484,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: onCancel,
          className: "p-2 hover:bg-gray-800 rounded-full",
          children: /* @__PURE__ */ jsxDEV(X, { size: 20 }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1494,
            columnNumber: 11
          }, this)
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1490,
          columnNumber: 9
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 1483,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "border-b border-gray-800 bg-gray-900 sticky top-[89px] z-10", children: /* @__PURE__ */ jsxDEV("div", { className: "flex px-6 overflow-x-auto", children: [
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setActiveTab("basic"),
          className: clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeTab === "basic" ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-300"
          ),
          children: "Basic Info"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1501,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setActiveTab("pricing"),
          className: clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeTab === "pricing" ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-300"
          ),
          children: "Pricing & Tax"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1512,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setActiveTab("inventory"),
          className: clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeTab === "inventory" ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-300"
          ),
          children: "Inventory"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1523,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setActiveTab("media"),
          className: clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeTab === "media" ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-300"
          ),
          children: "Media"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1534,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setActiveTab("details"),
          className: clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeTab === "details" ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-300"
          ),
          children: "Details"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1545,
          columnNumber: 11
        },
        this
      ),
      enableVariations && /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setActiveTab("variations"),
          className: clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeTab === "variations" ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-300"
          ),
          children: [
            "Variations ",
            generatedVariations.length > 0 && `(${generatedVariations.length} / ${MAX_VARIATIONS})`
          ]
        },
        void 0,
        true,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1557,
          columnNumber: 11
        },
        this
      ),
      modules.combosEnabled && isComboProduct && /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setActiveTab("combos"),
          className: clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeTab === "combos" ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-300"
          ),
          children: [
            "Combos ",
            combos.length > 0 && `(${combos.length})`
          ]
        },
        void 0,
        true,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1570,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 1500,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 1499,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-6 space-y-6", children: [
      activeTab === "basic" && /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-blue-500 pl-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxDEV(Package, { size: 20 }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1592,
              columnNumber: 17
            }, this),
            "Product Identity"
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1591,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "md:col-span-2", children: [
              /* @__PURE__ */ jsxDEV(Label, { htmlFor: "name", className: "text-gray-200", children: "Product Name *" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1597,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  id: "name",
                  ...register("name"),
                  placeholder: "e.g. Cotton Premium Shirt",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1600,
                  columnNumber: 19
                },
                this
              ),
              errors.name && /* @__PURE__ */ jsxDEV("p", { className: "text-red-500 text-xs mt-1", children: errors.name.message }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1607,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1596,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { htmlFor: "sku", className: "text-gray-200", children: "SKU / Code *" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1614,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "relative mt-1", children: [
                /* @__PURE__ */ jsxDEV(
                  Input,
                  {
                    id: "sku",
                    ...register("sku"),
                    placeholder: "AUTO-GENERATED",
                    className: "bg-gray-800 border-gray-700 text-white pr-10"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 1618,
                    columnNumber: 21
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    onClick: generateSKUForForm,
                    className: "absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors",
                    children: /* @__PURE__ */ jsxDEV(RefreshCcw, { size: 16 }, void 0, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 1629,
                      columnNumber: 23
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 1624,
                    columnNumber: 21
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1617,
                columnNumber: 19
              }, this),
              errors.sku && /* @__PURE__ */ jsxDEV("p", { className: "text-red-500 text-xs mt-1", children: errors.sku.message }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1633,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1613,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1595,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1590,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-purple-500 pl-3", children: "Classification" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1644,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Brand" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1649,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "mt-1", children: loadingBrands ? /* @__PURE__ */ jsxDEV("div", { className: "flex h-9 items-center rounded-md border border-gray-700 bg-gray-800 px-3 text-sm text-gray-400", children: "Loading brands..." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1652,
                columnNumber: 19
              }, this) : /* @__PURE__ */ jsxDEV(
                SearchableSelect,
                {
                  value: watch("brand") ?? "",
                  onValueChange: (v) => setValue("brand", v),
                  options: brands,
                  placeholder: "Select Brand",
                  searchPlaceholder: "Search brand...",
                  emptyText: "No brand found.",
                  className: "bg-gray-800 border-gray-700 text-white h-9",
                  enableAddNew: true,
                  addNewLabel: "Add Brand",
                  onAddNew: async (searchText) => {
                    if (!companyId) return;
                    try {
                      const name = (searchText || "").trim() || "New Brand";
                      const created = await brandService.create({ company_id: companyId, name });
                      setBrands((prev) => [...prev, { id: created.id, name: created.name }]);
                      setValue("brand", created.id);
                      toast.success("Brand added");
                    } catch (e) {
                      toast.error("Failed to add brand");
                    }
                  }
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1654,
                  columnNumber: 19
                },
                this
              ) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1650,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1648,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Category" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1682,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "mt-1", children: loadingCategories ? /* @__PURE__ */ jsxDEV("div", { className: "flex h-9 items-center rounded-md border border-gray-700 bg-gray-800 px-3 text-sm text-gray-400", children: "Loading categories..." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1685,
                columnNumber: 19
              }, this) : /* @__PURE__ */ jsxDEV(
                SearchableSelect,
                {
                  value: watch("category") ?? "",
                  onValueChange: (v) => {
                    setValue("category", v);
                    setValue("subCategory", "");
                  },
                  options: categories,
                  placeholder: "Select Category",
                  searchPlaceholder: "Search category...",
                  emptyText: "No category found.",
                  className: "bg-gray-800 border-gray-700 text-white h-9",
                  enableAddNew: true,
                  addNewLabel: "Add Category",
                  onAddNew: async (searchText) => {
                    if (!companyId) return;
                    try {
                      const name = (searchText || "").trim() || "New Category";
                      const created = await productCategoryService.create({ company_id: companyId, name, parent_id: null });
                      setCategories((prev) => [...prev, { id: created.id, name: created.name }]);
                      setValue("category", created.id);
                      setValue("subCategory", "");
                      toast.success("Category added");
                    } catch (e) {
                      toast.error("Failed to add category");
                    }
                  }
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1687,
                  columnNumber: 19
                },
                this
              ) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1683,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1681,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Sub-Category" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1719,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "mt-1", children: !selectedCategoryId ? /* @__PURE__ */ jsxDEV("div", { className: "flex h-9 items-center rounded-md border border-gray-700 bg-gray-800 px-3 text-sm text-gray-500", children: "Select a category first" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1722,
                columnNumber: 19
              }, this) : /* @__PURE__ */ jsxDEV(
                SearchableSelect,
                {
                  value: watch("subCategory") ?? "",
                  onValueChange: (v) => setValue("subCategory", v),
                  options: subCategories,
                  placeholder: "Select Sub-Category",
                  searchPlaceholder: "Search sub-category...",
                  emptyText: "No sub-category found.",
                  className: "bg-gray-800 border-gray-700 text-white h-9",
                  enableAddNew: true,
                  addNewLabel: "Add Sub-Category",
                  onAddNew: async (searchText) => {
                    if (!companyId || !selectedCategoryId) return;
                    try {
                      const name = (searchText || "").trim() || "New Sub-Category";
                      const created = await productCategoryService.create({ company_id: companyId, name, parent_id: selectedCategoryId });
                      setSubCategories((prev) => [...prev, { id: created.id, name: created.name }]);
                      setValue("subCategory", created.id);
                      toast.success("Sub-category added");
                    } catch (e) {
                      toast.error("Failed to add sub-category");
                    }
                  }
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1724,
                  columnNumber: 19
                },
                this
              ) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1720,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1718,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Unit" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1752,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "mt-1", children: loadingUnits ? /* @__PURE__ */ jsxDEV("div", { className: "flex h-9 items-center rounded-md border border-gray-700 bg-gray-800 px-3 text-sm text-gray-400", children: "Loading units..." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1755,
                columnNumber: 19
              }, this) : /* @__PURE__ */ jsxDEV(
                SearchableSelect,
                {
                  value: watch("unit") ?? "",
                  onValueChange: (v) => setValue("unit", v),
                  options: units.map((u) => ({ id: u.id, name: `${u.name} (${u.short_code || u.symbol || "—"})` })),
                  placeholder: "Select Unit",
                  searchPlaceholder: "Search unit...",
                  emptyText: "No unit found. Add units in Settings → Inventory → Units.",
                  className: "bg-gray-800 border-gray-700 text-white h-9"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1757,
                  columnNumber: 19
                },
                this
              ) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1753,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1751,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1647,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1643,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-green-500 pl-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxDEV(DollarSign, { size: 20 }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1775,
              columnNumber: 17
            }, this),
            "Quick Pricing"
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1774,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Purchase Price" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1780,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("purchasePrice", { setValueAs: setValueAsNumber }),
                  placeholder: "0.00",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1783,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Cost price from supplier" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1789,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1779,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Selling Price *" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1795,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("sellingPrice", { setValueAs: setValueAsNumber }),
                  placeholder: "0.00",
                  className: clsx(
                    "bg-green-900/30 border-green-700 text-white mt-1 font-bold",
                    errors.sellingPrice && "border-red-500 ring-1 ring-red-500"
                  )
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1798,
                  columnNumber: 19
                },
                this
              ),
              errors.sellingPrice && /* @__PURE__ */ jsxDEV("p", { className: "text-red-500 text-xs mt-1", children: errors.sellingPrice.message }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1809,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Final price for customers" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1813,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1794,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1778,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-blue-900/10 border border-blue-900/30 p-3 rounded-md text-xs text-blue-300", children: [
            "💡 ",
            /* @__PURE__ */ jsxDEV("strong", { children: "Tip:" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1819,
              columnNumber: 20
            }, this),
            ' For advanced pricing options (wholesale, bulk, retail), go to the "Pricing & Tax" tab.'
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1818,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1773,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 1588,
        columnNumber: 9
      }, this),
      activeTab === "pricing" && /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-green-500 pl-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxDEV(DollarSign, { size: 20 }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1831,
              columnNumber: 17
            }, this),
            "Basic Pricing"
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1830,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Purchase Price" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1837,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("purchasePrice", { setValueAs: setValueAsNumber }),
                  placeholder: "0.00",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1840,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Cost from supplier" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1846,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1836,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Profit Margin (%)" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1850,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("margin", { setValueAs: setValueAsNumber }),
                  placeholder: "0",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1853,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Auto-calculate selling price" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1859,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1849,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Selling Price *" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1863,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("sellingPrice", { setValueAs: setValueAsNumber }),
                  placeholder: "0.00",
                  className: clsx(
                    "bg-green-900/30 border-green-700 text-white mt-1 font-bold",
                    errors.sellingPrice && "border-red-500 ring-1 ring-red-500"
                  )
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1866,
                  columnNumber: 19
                },
                this
              ),
              errors.sellingPrice && /* @__PURE__ */ jsxDEV("p", { className: "text-red-500 text-xs mt-1", children: errors.sellingPrice.message }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1877,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Retail price" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1881,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1862,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1835,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1829,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-blue-500 pl-3", children: "Advanced Pricing Tiers" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1887,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Wholesale Price" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1893,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("wholesalePrice", { setValueAs: setValueAsNumber }),
                  placeholder: "0.00",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1896,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Price for wholesale customers" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1902,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1892,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Retail Price" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1906,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  placeholder: "0.00",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1909,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Price for retail customers" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1914,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1905,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Bulk Price (10+ items)" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1918,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  placeholder: "0.00",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1921,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Special price for bulk orders" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1926,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1917,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Minimum Order Quantity" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1930,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  placeholder: "1",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1933,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Minimum quantity to order" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1938,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1929,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1891,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-purple-900/10 border border-purple-800 p-4 rounded-lg", children: [
            /* @__PURE__ */ jsxDEV("h4", { className: "text-sm font-semibold text-purple-300 mb-2", children: "💰 Pricing Summary" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1943,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3 text-xs", children: [
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500", children: "Purchase:" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1946,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-white font-bold", children: [
                  "₨",
                  watch("purchasePrice") || 0
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1947,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1945,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500", children: "Selling:" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1950,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-green-400 font-bold", children: [
                  "₨",
                  watch("sellingPrice") || 0
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1951,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1949,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500", children: "Margin:" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1954,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-blue-400 font-bold", children: [
                  watch("margin") || 0,
                  "%"
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1955,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1953,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500", children: "Profit:" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1958,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-yellow-400 font-bold", children: [
                  "₨",
                  ((watch("sellingPrice") || 0) - (watch("purchasePrice") || 0)).toFixed(2)
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 1959,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1957,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1944,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1942,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1886,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-purple-500 pl-3", children: "Tax Configuration" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1966,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 gap-4", children: /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Tax Type" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 1972,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Controller,
              {
                control,
                name: "taxType",
                render: ({ field }) => /* @__PURE__ */ jsxDEV(
                  Select,
                  {
                    onValueChange: field.onChange,
                    defaultValue: field.value,
                    children: [
                      /* @__PURE__ */ jsxDEV(SelectTrigger, { className: "bg-gray-800 border-gray-700 text-white mt-1", children: /* @__PURE__ */ jsxDEV(SelectValue, { placeholder: "Select Tax Type" }, void 0, false, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 1982,
                        columnNumber: 27
                      }, this) }, void 0, false, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 1981,
                        columnNumber: 25
                      }, this),
                      /* @__PURE__ */ jsxDEV(SelectContent, { className: "bg-gray-900 border-gray-800 text-white", children: [
                        /* @__PURE__ */ jsxDEV(SelectItem, { value: "exclusive", children: "Exclusive (Tax Added)" }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 1985,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV(SelectItem, { value: "inclusive", children: "Inclusive (Tax Included)" }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 1988,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV(SelectItem, { value: "exempt", children: "Tax Exempt" }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 1991,
                          columnNumber: 27
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 1984,
                        columnNumber: 25
                      }, this)
                    ]
                  },
                  void 0,
                  true,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 1977,
                    columnNumber: 19
                  },
                  this
                )
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 1973,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1971,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 1970,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 1965,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-blue-500 pl-3", children: "Rental Pricing (Optional)" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2003,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-blue-900/10 border border-blue-900/30 p-3 rounded-md text-xs text-blue-300 mb-4", children: "Leave these fields empty to decide the rental price at the time of booking." }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2007,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Default Rent Price" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2013,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("rentalPrice", { setValueAs: setValueAsNumber }),
                  placeholder: "0.00",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2016,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2012,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Security Deposit" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2025,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  type: "number",
                  ...register("securityDeposit", { setValueAs: setValueAsNumber }),
                  placeholder: "0.00",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2028,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2024,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2011,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2002,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 1828,
        columnNumber: 9
      }, this),
      activeTab === "inventory" && /* @__PURE__ */ jsxDEV(Fragment, { children: /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
        companyBranches.length > 1 && /* @__PURE__ */ jsxDEV("div", { className: "p-3 bg-gray-800 border border-gray-700 rounded-lg space-y-2", children: [
          /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200 font-medium", children: "Available in branches" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2046,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500", children: "Select which branches can sell this product." }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2047,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: companyBranches.map((b) => {
            const checked = selectedBranchIds.includes(b.id);
            return /* @__PURE__ */ jsxDEV("label", { className: "flex items-center gap-2 text-sm text-gray-200 cursor-pointer", children: [
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "checkbox",
                  checked,
                  onChange: () => {
                    setSelectedBranchIds(
                      (prev) => checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                    );
                  },
                  className: "rounded border-gray-600"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2053,
                  columnNumber: 27
                },
                this
              ),
              b.name
            ] }, b.id, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2052,
              columnNumber: 21
            }, this);
          }) }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2048,
            columnNumber: 19
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2045,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV(Label, { htmlFor: "enable-variations", className: "text-gray-200 font-medium", children: "Enable Variations" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2074,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-0.5", children: "Enable size/color variations. Stock will be tracked per variation." }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2077,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2073,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            Switch,
            {
              id: "enable-variations",
              checked: enableVariations,
              onCheckedChange: handleEnableVariationsChange
            },
            void 0,
            false,
            {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2081,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2072,
          columnNumber: 15
        }, this),
        enableVariations && /* @__PURE__ */ jsxDEV("div", { className: "p-3 bg-gray-800 border border-gray-700 rounded-lg", children: /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-400", children: "Parent product does not hold stock when variations are enabled." }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2090,
          columnNumber: 19
        }, this) }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2089,
          columnNumber: 13
        }, this),
        modules.combosEnabled && /* @__PURE__ */ jsxDEV(Fragment, { children: [
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { htmlFor: "enable-combo", className: "text-gray-200 font-medium", children: "Enable Combo Product" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2099,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-0.5", children: "Make this product a combo/bundle. Stock will be managed through component products." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2102,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2098,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              Switch,
              {
                id: "enable-combo",
                checked: isComboProduct,
                onCheckedChange: handleEnableComboChange
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2106,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2097,
            columnNumber: 19
          }, this),
          isComboProduct && /* @__PURE__ */ jsxDEV("div", { className: "p-3 bg-gray-800 border border-gray-700 rounded-lg", children: /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-400", children: "Combo products do not hold stock. Stock is managed through component products." }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2115,
            columnNumber: 23
          }, this) }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2114,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2096,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-yellow-500 pl-3", children: "Stock Management" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2122,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxDEV(
              Label,
              {
                htmlFor: "stock-mgmt",
                className: "text-gray-200",
                children: "Enable Tracking"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2126,
                columnNumber: 19
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              Controller,
              {
                control,
                name: "stockManagement",
                render: ({ field }) => /* @__PURE__ */ jsxDEV(
                  Switch,
                  {
                    checked: field.value,
                    onCheckedChange: field.onChange,
                    id: "stock-mgmt"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2136,
                    columnNumber: 19
                  },
                  this
                )
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2132,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2125,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2121,
          columnNumber: 15
        }, this),
        stockManagement && /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV(
              Label,
              {
                htmlFor: "initial-stock",
                className: "text-gray-200",
                children: "Initial Stock"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2149,
                columnNumber: 21
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              Input,
              {
                id: "initial-stock",
                type: "number",
                step: selectedUnitAllowsDecimal ? "any" : 1,
                disabled: enableVariations || isComboProduct,
                ...register("initialStock", { setValueAs: setValueAsNumber }),
                placeholder: "0",
                className: clsx("mt-1", enableVariations || isComboProduct ? "bg-gray-900 border-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-800 border-gray-700 text-white")
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2155,
                columnNumber: 21
              },
              this
            ),
            enableVariations && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Opening stock is defined per variation." }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2165,
              columnNumber: 17
            }, this),
            isComboProduct && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Combo products do not hold stock. Stock is managed through component products." }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2168,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2148,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV(
              Label,
              {
                htmlFor: "alert-qty",
                className: "text-gray-200",
                children: "Alert Quantity"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2173,
                columnNumber: 21
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              Input,
              {
                id: "alert-qty",
                type: "number",
                ...register("alertQty", { setValueAs: setValueAsNumber }),
                placeholder: "5",
                className: "bg-gray-800 border-red-900/50 text-white mt-1"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2179,
                columnNumber: 21
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Get notified when stock falls below this level" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2186,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2172,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV(Label, { htmlFor: "max-stock", className: "text-gray-200", children: "Max Stock" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2192,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              Input,
              {
                id: "max-stock",
                type: "number",
                ...register("maxStock", { setValueAs: setValueAsNumber }),
                placeholder: "1000",
                className: "bg-gray-800 border-gray-700 text-white mt-1"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2193,
                columnNumber: 21
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-1", children: "Maximum stock capacity" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2200,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2191,
            columnNumber: 19
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2147,
          columnNumber: 13
        }, this),
        !stockManagement && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-6 text-center", children: [
          /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400", children: "Stock tracking is disabled for this product" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2207,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-500 mt-1", children: "Enable tracking above to manage inventory levels" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2208,
            columnNumber: 19
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2206,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2043,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2042,
        columnNumber: 9
      }, this),
      activeTab === "media" && /* @__PURE__ */ jsxDEV(Fragment, { children: /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-pink-500 pl-3", children: "Product Images" }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2219,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV(
          "div",
          {
            ...getRootProps(),
            className: clsx(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors",
              isDragActive ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-500 bg-gray-800/50"
            ),
            children: [
              /* @__PURE__ */ jsxDEV("input", { ...getInputProps() }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2232,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV(
                Upload,
                {
                  size: 32,
                  className: "text-gray-500 mb-3"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2233,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 text-center", children: [
                "Drag & drop images here, or",
                " ",
                /* @__PURE__ */ jsxDEV("span", { className: "text-blue-500", children: "browse" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2239,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2237,
                columnNumber: 17
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2223,
            columnNumber: 15
          },
          this
        ),
        existingImageUrls.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-4 gap-4 mt-4", children: [
          /* @__PURE__ */ jsxDEV("p", { className: "col-span-full text-sm text-gray-500", children: "Saved images" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2245,
            columnNumber: 19
          }, this),
          existingImageUrls.map(
            (url, idx) => /* @__PURE__ */ jsxDEV(
              "div",
              {
                className: "relative group aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700",
                children: [
                  /* @__PURE__ */ jsxDEV(ProductImage, { src: url, alt: "product", className: "w-full h-full object-cover" }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2251,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      type: "button",
                      onClick: (e) => {
                        e.stopPropagation();
                        setExistingImageUrls(existingImageUrls.filter((_, i) => i !== idx));
                      },
                      className: "absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                      children: /* @__PURE__ */ jsxDEV(X, { size: 12 }, void 0, false, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 2260,
                        columnNumber: 25
                      }, this)
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2252,
                      columnNumber: 23
                    },
                    this
                  )
                ]
              },
              url + idx,
              true,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2247,
                columnNumber: 15
              },
              this
            )
          )
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2244,
          columnNumber: 13
        }, this),
        images.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-4 gap-4 mt-4", children: [
          existingImageUrls.length > 0 && /* @__PURE__ */ jsxDEV("p", { className: "col-span-full text-sm text-gray-500", children: "New images (will save on Submit)" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2269,
            columnNumber: 52
          }, this),
          images.map(
            (file, idx) => /* @__PURE__ */ jsxDEV(
              "div",
              {
                className: "relative group aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700",
                children: [
                  /* @__PURE__ */ jsxDEV(
                    "img",
                    {
                      src: URL.createObjectURL(file),
                      alt: "preview",
                      className: "w-full h-full object-cover"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2275,
                      columnNumber: 23
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      type: "button",
                      onClick: (e) => {
                        e.stopPropagation();
                        setImages(
                          images.filter((_, i) => i !== idx)
                        );
                      },
                      className: "absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                      children: /* @__PURE__ */ jsxDEV(X, { size: 12 }, void 0, false, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 2290,
                        columnNumber: 25
                      }, this)
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2280,
                      columnNumber: 23
                    },
                    this
                  )
                ]
              },
              idx,
              true,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2271,
                columnNumber: 15
              },
              this
            )
          )
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2268,
          columnNumber: 13
        }, this),
        images.length === 0 && existingImageUrls.length === 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-6 text-center", children: [
          /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400", children: "No images uploaded yet" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2299,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-500 mt-1", children: "Upload images to showcase your product" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2300,
            columnNumber: 19
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2298,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2218,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2217,
        columnNumber: 9
      }, this),
      activeTab === "details" && /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-cyan-500 pl-3", children: "Description & Notes" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2311,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV(
              Label,
              {
                htmlFor: "description",
                className: "text-gray-200",
                children: "Product Description"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2316,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              Textarea,
              {
                id: "description",
                ...register("description"),
                placeholder: "Detailed product description...",
                className: "bg-gray-800 border-gray-700 text-white mt-1 min-h-[120px]"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2322,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2315,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV(
              Label,
              {
                htmlFor: "notes",
                className: "text-gray-200",
                children: "Internal Notes"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2331,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              Textarea,
              {
                id: "notes",
                ...register("notes"),
                placeholder: "Private notes (not visible to customers)...",
                className: "bg-gray-800 border-gray-700 text-white mt-1 min-h-[80px]"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2337,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2330,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2310,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-orange-500 pl-3", children: "Supplier Information" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2347,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Default Supplier" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2353,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Controller,
                {
                  control,
                  name: "supplier",
                  render: ({ field }) => /* @__PURE__ */ jsxDEV(
                    Select,
                    {
                      onValueChange: field.onChange,
                      value: field.value ?? "",
                      children: [
                        /* @__PURE__ */ jsxDEV(SelectTrigger, { className: "bg-gray-800 border-gray-700 text-white mt-1", children: /* @__PURE__ */ jsxDEV(SelectValue, { placeholder: "Select Supplier" }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2365,
                          columnNumber: 27
                        }, this) }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2364,
                          columnNumber: 25
                        }, this),
                        /* @__PURE__ */ jsxDEV(SelectContent, { className: "bg-gray-900 border-gray-800 text-white", children: loadingSuppliers ? /* @__PURE__ */ jsxDEV("div", { className: "px-2 py-1.5 text-sm text-gray-400", children: "Loading suppliers..." }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2369,
                          columnNumber: 23
                        }, this) : suppliers.length > 0 ? suppliers.map(
                          (s) => /* @__PURE__ */ jsxDEV(SelectItem, { value: s.id, children: s.name }, s.id, false, {
                            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                            lineNumber: 2372,
                            columnNumber: 23
                          }, this)
                        ) : /* @__PURE__ */ jsxDEV("div", { className: "px-2 py-1.5 text-sm text-gray-500", children: "No suppliers. Add in Contacts (type: Supplier)." }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2377,
                          columnNumber: 23
                        }, this) }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2367,
                          columnNumber: 25
                        }, this)
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2360,
                      columnNumber: 19
                    },
                    this
                  )
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2356,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2352,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Supplier Product Code" }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2385,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  ...register("supplierCode"),
                  placeholder: "Supplier's SKU",
                  className: "bg-gray-800 border-gray-700 text-white mt-1"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2388,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2384,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2351,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2346,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2309,
        columnNumber: 9
      }, this),
      activeTab === "variations" && /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4", children: [
          /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-400 text-xs uppercase tracking-wide", children: "Supplier for this product" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2404,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-white font-medium mt-1", children: watch("supplier") && suppliers.length > 0 ? suppliers.find((s) => s.id === watch("supplier"))?.name ?? "—" : "Select supplier in Details tab" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2405,
            columnNumber: 15
          }, this),
          watch("supplier") && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mt-0.5", children: "Variations will be associated with this supplier" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2411,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2403,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "bg-blue-900/20 border border-blue-800 rounded-xl p-4", children: /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-blue-300", children: [
          /* @__PURE__ */ jsxDEV("strong", { children: "Product Variations:" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2418,
            columnNumber: 17
          }, this),
          " Create different variants of your product (e.g., different sizes, colors, materials). Each variant will have its own SKU, price, and stock level."
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2417,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2416,
          columnNumber: 13
        }, this),
        variationsForCopy.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4", children: [
          /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200 mb-2 block", children: "Copy from existing variation" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2426,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500 mb-2", children: "Select an existing variation to copy its attributes. Shows: Supplier, Attribute: Value (e.g. Size: Large, Color: Red)." }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2427,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            Select,
            {
              value: copyFromVariationId,
              onValueChange: (id) => {
                setCopyFromVariationId(id);
                const entry = variationsForCopy.find((x) => x.variationId === id);
                if (entry && entry.productId !== (initialProduct?.uuid || initialProduct?.id)) {
                  copyAttributesFromProduct(entry.product);
                  setCopyFromVariationId("");
                } else if (entry) {
                  toast.info("This is the current product");
                  setCopyFromVariationId("");
                }
              },
              children: [
                /* @__PURE__ */ jsxDEV(SelectTrigger, { className: "bg-gray-900 border-gray-700 text-white", children: /* @__PURE__ */ jsxDEV(SelectValue, { placeholder: "Select variation to copy from..." }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2443,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2442,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV(SelectContent, { className: "bg-gray-900 border-gray-800 text-white", children: loadingProductsWithVariations ? /* @__PURE__ */ jsxDEV("div", { className: "px-2 py-1.5 text-sm text-gray-400", children: "Loading..." }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2447,
                  columnNumber: 17
                }, this) : variationsForCopy.filter((e) => e.productId !== (initialProduct?.uuid || initialProduct?.id)).map(
                  (e) => /* @__PURE__ */ jsxDEV(SelectItem, { value: e.variationId, children: [
                    e.supplierName,
                    " — ",
                    e.label
                  ] }, e.variationId, true, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2452,
                    columnNumber: 17
                  }, this)
                ) }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2445,
                  columnNumber: 19
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2428,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2425,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-blue-500 pl-3", children: "Step 1: Define Variation Attributes" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2464,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-500", children: "Pick from Settings → Inventory → Variations master or type new names; values can be chosen from saved lists per attribute." }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2467,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("datalist", { id: "variation-master-attr-names", children: Object.keys(variationMaster).sort((a, b) => a.localeCompare(b)).map(
            (k) => /* @__PURE__ */ jsxDEV("option", { value: k }, k, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2474,
              columnNumber: 15
            }, this)
          ) }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2470,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4", children: [
            /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200 mb-2 block", children: "Add New Attribute (e.g., Size, Color, Material)" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2479,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  value: newAttributeName,
                  onChange: (e) => setNewAttributeName(e.target.value),
                  onKeyPress: (e) => e.key === "Enter" && (e.preventDefault(), addVariantAttribute()),
                  placeholder: "Enter attribute name (e.g., Color)",
                  className: "bg-gray-900 border-gray-700 text-white",
                  list: "variation-master-attr-names"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2481,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  onClick: addVariantAttribute,
                  className: "bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap",
                  children: [
                    /* @__PURE__ */ jsxDEV(Plus, { size: 16 }, void 0, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2494,
                      columnNumber: 21
                    }, this),
                    "Add"
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2489,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2480,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2478,
            columnNumber: 15
          }, this),
          variantAttributes.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: variantAttributes.map(
            (attr, attrIndex) => /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-3", children: [
                /* @__PURE__ */ jsxDEV("h4", { className: "text-md font-semibold text-white flex items-center gap-2", children: attr.name }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2506,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    onClick: () => removeVariantAttribute(attr.name),
                    className: "text-red-500 hover:text-red-400 transition-colors p-2",
                    children: /* @__PURE__ */ jsxDEV(Trash2, { size: 16 }, void 0, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2514,
                      columnNumber: 27
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2509,
                    columnNumber: 25
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2505,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "mb-3", children: [
                /* @__PURE__ */ jsxDEV("datalist", { id: `variation-master-values-${attr.name.replace(/\s+/g, "-")}`, children: (variationMaster[attr.name] || []).map(
                  (v) => /* @__PURE__ */ jsxDEV("option", { value: v }, v, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2522,
                    columnNumber: 21
                  }, this)
                ) }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2520,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxDEV(
                    Input,
                    {
                      value: selectedAttributeIndex === attrIndex ? newAttributeValue : "",
                      onFocus: () => setSelectedAttributeIndex(attrIndex),
                      onChange: (e) => setNewAttributeValue(e.target.value),
                      onKeyPress: (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setSelectedAttributeIndex(attrIndex);
                          addAttributeValue();
                        }
                      },
                      placeholder: `Add ${attr.name} value (e.g., Red, Blue)`,
                      className: "bg-gray-900 border-gray-700 text-white text-sm",
                      list: `variation-master-values-${attr.name.replace(/\s+/g, "-")}`
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2526,
                      columnNumber: 27
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                        setSelectedAttributeIndex(attrIndex);
                        addAttributeValue();
                      },
                      className: "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      children: "Add Value"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2541,
                      columnNumber: 27
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2525,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2519,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap gap-2", children: [
                attr.values.map(
                  (value, valueIndex) => /* @__PURE__ */ jsxDEV(
                    "div",
                    {
                      className: "bg-gray-900 border border-gray-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm",
                      children: [
                        /* @__PURE__ */ jsxDEV("span", { children: value }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2561,
                          columnNumber: 29
                        }, this),
                        /* @__PURE__ */ jsxDEV(
                          "button",
                          {
                            type: "button",
                            onClick: () => removeAttributeValue(attrIndex, valueIndex),
                            className: "text-red-400 hover:text-red-300 transition-colors",
                            children: /* @__PURE__ */ jsxDEV(X, { size: 14 }, void 0, false, {
                              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                              lineNumber: 2567,
                              columnNumber: 31
                            }, this)
                          },
                          void 0,
                          false,
                          {
                            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                            lineNumber: 2562,
                            columnNumber: 29
                          },
                          this
                        )
                      ]
                    },
                    value,
                    true,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2557,
                      columnNumber: 19
                    },
                    this
                  )
                ),
                attr.values.length === 0 && /* @__PURE__ */ jsxDEV("span", { className: "text-gray-500 text-sm italic", children: "No values added yet" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2572,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2555,
                columnNumber: 23
              }, this)
            ] }, attr.name, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2504,
              columnNumber: 15
            }, this)
          ) }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2502,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2463,
          columnNumber: 13
        }, this),
        variantAttributes.length > 0 && variantAttributes.every((attr) => attr.values.length > 0) && /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-blue-500 pl-3", children: "Step 2: Generate & Configure Variations" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2584,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400", children: [
              "Limit: ",
              MAX_VARIATIONS,
              " variations per product. Opening stock is set per row and saved as stock movements on save."
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2589,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-500 font-mono", children: [
              generatedVariations.length,
              " / ",
              MAX_VARIATIONS
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2592,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2588,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4", children: (() => {
            const count = variantAttributes.reduce((acc, attr) => acc * attr.values.length, 1);
            const atLimit = count > MAX_VARIATIONS;
            return /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  onClick: generateVariations,
                  disabled: atLimit,
                  className: clsx(
                    "text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2",
                    atLimit ? "bg-gray-600 cursor-not-allowed opacity-60" : "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                  ),
                  children: [
                    /* @__PURE__ */ jsxDEV(RefreshCcw, { size: 18 }, void 0, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2614,
                      columnNumber: 27
                    }, this),
                    "Generate ",
                    count,
                    " Variations"
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2603,
                  columnNumber: 25
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 mt-2", children: atLimit ? `Reduce attributes or values to stay under ${MAX_VARIATIONS} variations.` : "All possible combinations of your attribute values." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2617,
                columnNumber: 25
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2602,
              columnNumber: 19
            }, this);
          })() }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2597,
            columnNumber: 17
          }, this),
          generatedVariations.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl overflow-hidden", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "overflow-x-auto overflow-y-auto", style: { maxHeight: "min(60vh, 420px)" }, children: /* @__PURE__ */ jsxDEV("table", { className: "w-full border-collapse", children: [
              /* @__PURE__ */ jsxDEV("thead", { className: "bg-gray-900 border-b border-gray-700 sticky top-0 z-[1]", children: /* @__PURE__ */ jsxDEV("tr", { children: [
                /* @__PURE__ */ jsxDEV("th", { className: "px-4 py-3 text-left text-sm font-semibold text-gray-300", children: "#" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2634,
                  columnNumber: 29
                }, this),
                variantAttributes.map(
                  (attr) => /* @__PURE__ */ jsxDEV("th", { className: "px-4 py-3 text-left text-sm font-semibold text-gray-300", children: attr.name }, attr.name, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2636,
                    columnNumber: 23
                  }, this)
                ),
                /* @__PURE__ */ jsxDEV("th", { className: "px-4 py-3 text-left text-sm font-semibold text-gray-300", children: "SKU" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2640,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "px-4 py-3 text-left text-sm font-semibold text-gray-300", children: "Purchase Price" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2641,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "px-4 py-3 text-left text-sm font-semibold text-gray-300", children: "Selling Price" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2642,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "px-4 py-3 text-left text-sm font-semibold text-gray-300", children: "Opening Stock" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2643,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "px-4 py-3 text-left text-sm font-semibold text-gray-300", children: "Barcode" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2644,
                  columnNumber: 29
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2633,
                columnNumber: 27
              }, this) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2632,
                columnNumber: 25
              }, this),
              /* @__PURE__ */ jsxDEV("tbody", { children: generatedVariations.map(
                (variation, index) => /* @__PURE__ */ jsxDEV("tr", { className: "border-b border-gray-700 hover:bg-gray-900/50 transition-colors", children: [
                  /* @__PURE__ */ jsxDEV("td", { className: "px-4 py-3 text-sm text-gray-400", children: index + 1 }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2650,
                    columnNumber: 31
                  }, this),
                  variantAttributes.map(
                    (attr) => /* @__PURE__ */ jsxDEV("td", { className: "px-4 py-3 text-sm text-white", children: /* @__PURE__ */ jsxDEV("span", { className: "bg-blue-900/30 border border-blue-800 px-2 py-1 rounded text-xs", children: variation.combination[attr.name] }, void 0, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2653,
                      columnNumber: 35
                    }, this) }, attr.name, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2652,
                      columnNumber: 23
                    }, this)
                  ),
                  /* @__PURE__ */ jsxDEV("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxDEV(
                    Input,
                    {
                      value: variation.sku,
                      onChange: (e) => {
                        const updated = [...generatedVariations];
                        updated[index].sku = e.target.value;
                        setGeneratedVariations(updated);
                      },
                      className: "bg-gray-900 border-gray-700 text-white text-sm w-32",
                      placeholder: "SKU"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2659,
                      columnNumber: 33
                    },
                    this
                  ) }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2658,
                    columnNumber: 31
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxDEV(
                    Input,
                    {
                      type: "number",
                      step: 0.01,
                      min: 0,
                      value: Number.isFinite(Number(variation.purchasePrice)) ? variation.purchasePrice : 0,
                      onChange: (e) => {
                        const updated = [...generatedVariations];
                        const v = parseFloat(e.target.value);
                        updated[index].purchasePrice = Number.isNaN(v) ? 0 : v;
                        setGeneratedVariations(updated);
                      },
                      className: "bg-gray-900 border-gray-700 text-white text-sm w-24",
                      placeholder: String(watch("purchasePrice") ?? 0),
                      title: "Purchase cost for this variation"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2671,
                      columnNumber: 33
                    },
                    this
                  ) }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2670,
                    columnNumber: 31
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxDEV(
                    Input,
                    {
                      type: "number",
                      step: 0.01,
                      min: 0,
                      value: Number.isFinite(Number(variation.price)) ? variation.price : 0,
                      onChange: (e) => {
                        const updated = [...generatedVariations];
                        const v = parseFloat(e.target.value);
                        updated[index].price = Number.isNaN(v) ? 0 : v;
                        setGeneratedVariations(updated);
                      },
                      className: "bg-gray-900 border-gray-700 text-white text-sm w-24",
                      placeholder: String(watch("sellingPrice") ?? 0),
                      title: "Selling price for this variation"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2688,
                      columnNumber: 33
                    },
                    this
                  ) }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2687,
                    columnNumber: 31
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxDEV(
                    Input,
                    {
                      type: "number",
                      min: 0,
                      step: selectedUnitAllowsDecimal ? "any" : 1,
                      value: variation.stock,
                      onChange: (e) => {
                        const updated = [...generatedVariations];
                        updated[index].stock = parseVariationQtyInput(e.target.value);
                        setGeneratedVariations(updated);
                      },
                      className: "bg-gray-900 border-gray-700 text-white text-sm w-24",
                      placeholder: "0",
                      title: selectedUnitAllowsDecimal ? "Opening qty from stock movements (editable when only opening exists)" : "Whole units only for this product unit"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2705,
                      columnNumber: 33
                    },
                    this
                  ) }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2704,
                    columnNumber: 31
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxDEV(
                    Input,
                    {
                      value: variation.barcode,
                      onChange: (e) => {
                        const updated = [...generatedVariations];
                        updated[index].barcode = e.target.value;
                        setGeneratedVariations(updated);
                      },
                      className: "bg-gray-900 border-gray-700 text-white text-sm w-32",
                      placeholder: "Barcode"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2725,
                      columnNumber: 33
                    },
                    this
                  ) }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2724,
                    columnNumber: 31
                  }, this)
                ] }, index, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2649,
                  columnNumber: 21
                }, this)
              ) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2647,
                columnNumber: 25
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2631,
              columnNumber: 23
            }, this) }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2630,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-900 px-4 py-3 border-t border-gray-700", children: /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-400", children: [
              "Total Variations: ",
              /* @__PURE__ */ jsxDEV("span", { className: "text-white font-semibold", children: generatedVariations.length }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2744,
                columnNumber: 43
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2743,
              columnNumber: 23
            }, this) }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2742,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2629,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2583,
          columnNumber: 11
        }, this),
        variantAttributes.length === 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-8 text-center", children: [
          /* @__PURE__ */ jsxDEV(Package, { size: 48, className: "text-gray-600 mx-auto mb-3" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2755,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 mb-2", children: "No variation attributes added yet" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2756,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-500", children: "Add attributes like Size, Color, or Material to create product variations" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2757,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2754,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2401,
        columnNumber: 9
      }, this),
      activeTab === "combos" && modules.combosEnabled && isComboProduct && /* @__PURE__ */ jsxDEV(Fragment, { children: !(initialProduct?.uuid || initialProduct?.id) ? /* @__PURE__ */ jsxDEV("div", { className: "bg-amber-900/30 border border-amber-700 rounded-xl p-6 text-center", children: [
        /* @__PURE__ */ jsxDEV("p", { className: "text-amber-200 font-medium", children: "Save the product first to add combos" }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2771,
          columnNumber: 17
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-amber-200/80 text-sm mt-2", children: [
          "Go to the ",
          /* @__PURE__ */ jsxDEV("strong", { children: "Basic" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2773,
            columnNumber: 29
          }, this),
          " tab, fill in name and other required fields, then click ",
          /* @__PURE__ */ jsxDEV("strong", { children: "Save" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2773,
            columnNumber: 108
          }, this),
          ". After the product is saved, you can return here to create combo bundles."
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2772,
          columnNumber: 17
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2770,
        columnNumber: 11
      }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "bg-blue-900/20 border border-blue-800 rounded-xl p-4", children: /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-blue-300", children: [
          /* @__PURE__ */ jsxDEV("strong", { children: "Product Combos:" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2782,
            columnNumber: 17
          }, this),
          " Create bundled packages by combining multiple products. Set a special combo price to offer discounts on bundle purchases."
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2781,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2780,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-blue-500 pl-3", children: "Create New Combo" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2789,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4", children: [
            /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200 mb-2 block", children: "Combo Name" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2795,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              Input,
              {
                value: comboName,
                onChange: (e) => setComboName(e.target.value),
                placeholder: "e.g., Wedding Package, Summer Bundle",
                className: "bg-gray-900 border-gray-700 text-white"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2796,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2794,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3", children: [
            /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200 block", children: "Add Products to Combo" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2806,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-2", children: /* @__PURE__ */ jsxDEV("div", { className: "md:col-span-2 relative", children: [
              /* @__PURE__ */ jsxDEV(
                Input,
                {
                  value: productSearchQuery,
                  onChange: (e) => {
                    setProductSearchQuery(e.target.value);
                    setShowProductDropdown(true);
                  },
                  onFocus: () => setShowProductDropdown(true),
                  placeholder: "Search product by name or SKU...",
                  className: "bg-gray-900 border-gray-700 text-white text-sm"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2810,
                  columnNumber: 21
                },
                this
              ),
              showProductDropdown && productSearchQuery && filteredProducts.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto", children: filteredProducts.map(
                (product) => /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    onClick: () => selectProduct(product),
                    className: "w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0",
                    children: /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-start", children: [
                      /* @__PURE__ */ jsxDEV("div", { children: [
                        /* @__PURE__ */ jsxDEV("p", { className: "text-white text-sm font-medium", children: product.name }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2833,
                          columnNumber: 33
                        }, this),
                        /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500 text-xs mt-1", children: [
                          "SKU: ",
                          product.sku
                        ] }, void 0, true, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2834,
                          columnNumber: 33
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 2832,
                        columnNumber: 31
                      }, this),
                      /* @__PURE__ */ jsxDEV("span", { className: "text-green-400 text-sm font-semibold", children: [
                        "₨",
                        product.retail_price
                      ] }, void 0, true, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 2836,
                        columnNumber: 31
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2831,
                      columnNumber: 29
                    }, this)
                  },
                  product.id,
                  false,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2825,
                    columnNumber: 23
                  },
                  this
                )
              ) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2823,
                columnNumber: 21
              }, this),
              showProductDropdown && productSearchQuery && filteredProducts.length === 0 && !loadingProducts && /* @__PURE__ */ jsxDEV("div", { className: "absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 text-center", children: /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500 text-sm", children: "No products available to add." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2845,
                columnNumber: 25
              }, this) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2844,
                columnNumber: 21
              }, this),
              loadingProducts && /* @__PURE__ */ jsxDEV("div", { className: "absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 text-center", children: /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500 text-sm", children: "Loading products..." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2850,
                columnNumber: 25
              }, this) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2849,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2809,
              columnNumber: 19
            }, this) }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2807,
              columnNumber: 17
            }, this),
            availableProducts.length === 0 && !loadingProducts && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-900 border border-gray-700 rounded-lg p-4 text-center", children: [
              /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500 text-sm", children: "No products available to add." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2857,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-gray-600 text-xs mt-1", children: "Create products first, then add them to this combo." }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2858,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2856,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2805,
            columnNumber: 15
          }, this),
          currentComboItems.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3", children: [
            /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200 block", children: "Products in This Combo" }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2866,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: currentComboItems.map(
              (item, index) => /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: "bg-gray-900 border border-gray-700 px-4 py-3 rounded-lg flex items-center justify-between",
                  children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4 flex-1", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                        /* @__PURE__ */ jsxDEV("span", { className: "text-white font-medium", children: item.product_name }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2875,
                          columnNumber: 29
                        }, this),
                        /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500 text-xs mt-0.5", children: [
                          "SKU: ",
                          item.product_sku
                        ] }, void 0, true, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2876,
                          columnNumber: 29
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 2874,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(
                        Input,
                        {
                          type: "number",
                          min: 0.01,
                          step: 0.01,
                          value: item.qty || "",
                          onChange: (e) => updateComboItemQty(index, parseFloat(e.target.value) || 1),
                          className: "bg-gray-800 border-gray-700 text-white text-sm w-20",
                          placeholder: "Qty"
                        },
                        void 0,
                        false,
                        {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2878,
                          columnNumber: 27
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV(
                        Input,
                        {
                          type: "number",
                          min: 0,
                          step: 0.01,
                          value: item.unit_price || "",
                          onChange: (e) => updateComboItemPrice(index, parseFloat(e.target.value) || 0),
                          className: "bg-gray-800 border-gray-700 text-white text-sm w-24",
                          placeholder: "Price"
                        },
                        void 0,
                        false,
                        {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2887,
                          columnNumber: 27
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV("span", { className: "text-gray-500 text-sm w-24 text-right", children: [
                        "Subtotal: ₨",
                        ((item.qty || 0) * (item.unit_price || 0)).toFixed(2)
                      ] }, void 0, true, {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 2896,
                        columnNumber: 27
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2873,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        type: "button",
                        onClick: () => removeComboItem(index),
                        className: "text-red-500 hover:text-red-400 transition-colors p-2 ml-2",
                        children: /* @__PURE__ */ jsxDEV(Trash2, { size: 16 }, void 0, false, {
                          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                          lineNumber: 2905,
                          columnNumber: 27
                        }, this)
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                        lineNumber: 2900,
                        columnNumber: 25
                      },
                      this
                    )
                  ]
                },
                index,
                true,
                {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2869,
                  columnNumber: 19
                },
                this
              )
            ) }, void 0, false, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2867,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "border-t border-gray-700 pt-4 space-y-3", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center", children: [
                /* @__PURE__ */ jsxDEV("span", { className: "text-gray-400", children: "Total Individual Price:" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2914,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "text-white font-semibold", children: [
                  "₨",
                  currentComboItems.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0).toFixed(2)
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2915,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2913,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4", children: [
                /* @__PURE__ */ jsxDEV(Label, { className: "text-gray-200", children: "Combo Price:" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2920,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV(
                  Input,
                  {
                    type: "number",
                    min: 0,
                    step: 0.01,
                    value: comboFinalPrice || "",
                    onChange: (e) => setComboFinalPrice(parseFloat(e.target.value) || 0),
                    placeholder: "Enter combo price",
                    className: "bg-gray-900 border-gray-700 text-white flex-1"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2921,
                    columnNumber: 23
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2919,
                columnNumber: 21
              }, this),
              comboFinalPrice > 0 && /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center text-sm", children: [
                /* @__PURE__ */ jsxDEV("span", { className: "text-green-400", children: "Discount:" }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2933,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "text-green-400 font-semibold", children: [
                  "₨",
                  (currentComboItems.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0) - comboFinalPrice).toFixed(2)
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2934,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2932,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2912,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                onClick: saveCombo,
                disabled: !comboName.trim() || comboFinalPrice <= 0 || currentComboItems.length === 0,
                className: "bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 w-full",
                children: "Save Combo"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2941,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2865,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2788,
          columnNumber: 13
        }, this),
        combos.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold border-l-4 border-blue-500 pl-3", children: [
            "Saved Combos (",
            combos.length,
            ")"
          ] }, void 0, true, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2956,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: combos.map(
            (combo) => /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-3", children: [
                /* @__PURE__ */ jsxDEV("h4", { className: "text-lg font-semibold text-white", children: combo.combo_name }, void 0, false, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2964,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    onClick: () => deleteCombo(combo.id),
                    className: "text-red-500 hover:text-red-400 transition-colors p-2",
                    children: /* @__PURE__ */ jsxDEV(Trash2, { size: 18 }, void 0, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2970,
                      columnNumber: 27
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2965,
                    columnNumber: 25
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2963,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "space-y-2 mb-3", children: combo.items.map(
                (item, idx) => /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-900 border border-gray-700 px-3 py-2 rounded-lg flex items-center justify-between text-sm", children: [
                  /* @__PURE__ */ jsxDEV("div", { children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-white", children: item.product_name || "Unknown Product" }, void 0, false, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2978,
                      columnNumber: 31
                    }, this),
                    item.product_sku && /* @__PURE__ */ jsxDEV("p", { className: "text-gray-500 text-xs mt-0.5", children: [
                      "SKU: ",
                      item.product_sku
                    ] }, void 0, true, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2980,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2977,
                    columnNumber: 29
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4 text-gray-400", children: [
                    /* @__PURE__ */ jsxDEV("span", { children: [
                      "Qty: ",
                      item.qty
                    ] }, void 0, true, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2984,
                      columnNumber: 31
                    }, this),
                    item.unit_price && /* @__PURE__ */ jsxDEV("span", { children: [
                      "₨",
                      item.unit_price.toFixed(2)
                    ] }, void 0, true, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2985,
                      columnNumber: 51
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-white", children: [
                      "₨",
                      ((item.qty || 0) * (item.unit_price || 0)).toFixed(2)
                    ] }, void 0, true, {
                      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                      lineNumber: 2986,
                      columnNumber: 31
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2983,
                    columnNumber: 29
                  }, this)
                ] }, idx, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2976,
                  columnNumber: 21
                }, this)
              ) }, void 0, false, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2974,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "border-t border-gray-700 pt-3 space-y-1", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-sm", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-gray-400", children: "Total Individual Price:" }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2994,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-white", children: [
                    "₨",
                    combo.items.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0).toFixed(2)
                  ] }, void 0, true, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2995,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2993,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-sm", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-green-400", children: "Combo Price:" }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2998,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-green-400 font-bold", children: [
                    "₨",
                    combo.combo_price.toFixed(2)
                  ] }, void 0, true, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 2999,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 2997,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-sm", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-blue-400", children: "You Save:" }, void 0, false, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 3002,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-blue-400 font-semibold", children: [
                    "₨",
                    (combo.items.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0) - combo.combo_price).toFixed(2)
                  ] }, void 0, true, {
                    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                    lineNumber: 3003,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                  lineNumber: 3001,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
                lineNumber: 2992,
                columnNumber: 23
              }, this)
            ] }, combo.id, true, {
              fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
              lineNumber: 2962,
              columnNumber: 17
            }, this)
          ) }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 2960,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 2955,
          columnNumber: 13
        }, this),
        combos.length === 0 && currentComboItems.length === 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 border border-gray-700 rounded-xl p-8 text-center", children: [
          /* @__PURE__ */ jsxDEV(Package, { size: 48, className: "text-gray-600 mx-auto mb-3" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 3015,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 mb-2", children: "No combos created yet" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 3016,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-500", children: "Start adding products above to create your first combo package" }, void 0, false, {
            fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
            lineNumber: 3017,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3014,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2778,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 2767,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 1585,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "p-6 border-t border-gray-800 bg-gray-900 sticky bottom-0 z-10 flex gap-4", children: [
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: onCancel,
          type: "button",
          className: "px-6 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors border border-gray-700",
          children: "Cancel"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3029,
          columnNumber: 9
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: handleSubmit(
            (data) => onSubmit(data, "save")
          ),
          type: "button",
          disabled: saving,
          className: "flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none",
          children: saving ? "Saving..." : "Save Product"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3036,
          columnNumber: 9
        },
        this
      ),
      onSaveAndAdd && /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: handleSubmit(
            (data) => onSubmit(data, "saveAndAdd")
          ),
          type: "button",
          disabled: saving,
          className: "flex-[2] bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none",
          children: saving ? "Saving..." : "Save & Add to Transaction"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3047,
          columnNumber: 9
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3028,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Dialog, { open: blockVariationsModalOpen, onOpenChange: setBlockVariationsModalOpen, children: /* @__PURE__ */ jsxDEV(DialogContent, { className: "bg-gray-900 border-gray-700 text-white max-w-md", children: [
      /* @__PURE__ */ jsxDEV(DialogHeader, { children: /* @__PURE__ */ jsxDEV(DialogTitle, { className: "text-white", children: "Cannot enable variations" }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3064,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3063,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-300 text-sm", children: "Parent-level stock exists. Clear or adjust stock first." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3066,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 text-xs mt-2", children: "Clear or adjust stock in Inventory first, then add variations. Opening stock for each size/color can be set in the Variations tab after saving." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3069,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(DialogFooter, { className: "mt-4", children: /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          onClick: () => setBlockVariationsModalOpen(false),
          className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium",
          children: "OK"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3073,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3072,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3062,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3061,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Dialog, { open: blockDisableVariationsModalOpen, onOpenChange: setBlockDisableVariationsModalOpen, children: /* @__PURE__ */ jsxDEV(DialogContent, { className: "bg-gray-900 border-gray-700 text-white max-w-md", children: [
      /* @__PURE__ */ jsxDEV(DialogHeader, { children: /* @__PURE__ */ jsxDEV(DialogTitle, { className: "text-white", children: "Cannot disable variations" }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3087,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3086,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-300 text-sm", children: "Variation-level stock exists. Cannot disable variations until variation stock is cleared or adjusted." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3089,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(DialogFooter, { className: "mt-4", children: /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          onClick: () => setBlockDisableVariationsModalOpen(false),
          className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium",
          children: "OK"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3093,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3092,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3085,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3084,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Dialog, { open: blockEnableComboModalOpen, onOpenChange: setBlockEnableComboModalOpen, children: /* @__PURE__ */ jsxDEV(DialogContent, { className: "bg-gray-900 border-gray-700 text-white max-w-md", children: [
      /* @__PURE__ */ jsxDEV(DialogHeader, { children: /* @__PURE__ */ jsxDEV(DialogTitle, { className: "text-white", children: "Cannot enable combo" }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3108,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3107,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-300 text-sm", children: "This product already has stock. Clear stock before enabling Combo mode." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3110,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 text-xs mt-2", children: "Clear or adjust stock in Inventory first, then enable Combo mode. Combo products do not hold stock - stock is managed through component products." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3113,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(DialogFooter, { className: "mt-4", children: /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          onClick: () => setBlockEnableComboModalOpen(false),
          className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium",
          children: "OK"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3117,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3116,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3106,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3105,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Dialog, { open: blockDisableComboModalOpen, onOpenChange: setBlockDisableComboModalOpen, children: /* @__PURE__ */ jsxDEV(DialogContent, { className: "bg-gray-900 border-gray-700 text-white max-w-md", children: [
      /* @__PURE__ */ jsxDEV(DialogHeader, { children: /* @__PURE__ */ jsxDEV(DialogTitle, { className: "text-white", children: "Cannot disable combo" }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3132,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3131,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-300 text-sm", children: "This product has combo components. Remove them before disabling Combo mode." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3134,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-400 text-xs mt-2", children: "Delete all combo items in the Combos tab first, then you can disable Combo mode." }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3137,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(DialogFooter, { className: "mt-4", children: /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          onClick: () => setBlockDisableComboModalOpen(false),
          className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium",
          children: "OK"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
          lineNumber: 3141,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
        lineNumber: 3140,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3130,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
      lineNumber: 3129,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx",
    lineNumber: 1474,
    columnNumber: 5
  }, this);
};
_s(EnhancedProductForm, "wIVTp9OEmjL8o89NlBxhZD2CYUA=", false, function() {
  return [useSupabase, useSettings, useDocumentNumbering, useForm, useDropzone];
});
_c = EnhancedProductForm;
var _c;
$RefreshReg$(_c, "EnhancedProductForm");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/ndm31/dev/Corusr/NEW POSV3/src/app/components/products/EnhancedProductForm.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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QUEsV0FxQkE7QUFBQSxPQTVvREY7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQTZvREE7QUFFSjtBQUFFcEIsR0F6N0ZXTixxQkFBbUI7QUFBQSxVQU1FcEYsYUFDZkMsYUFFbUVDLHNCQXNHaEZOLFNBNGdCRkQsV0FBVztBQUFBO0FBQUEsS0EzbkJGeUY7QUFBbUIsSUFBQW9jO0FBQUEsYUFBQUEsSUFBQSIsIm5hbWVzIjpbInVzZUNhbGxiYWNrIiwidXNlU3RhdGUiLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VEcm9wem9uZSIsInVzZUZvcm0iLCJDb250cm9sbGVyIiwiem9kUmVzb2x2ZXIiLCJ6IiwidXNlU3VwYWJhc2UiLCJ1c2VTZXR0aW5ncyIsInVzZURvY3VtZW50TnVtYmVyaW5nIiwicHJvZHVjdFNlcnZpY2UiLCJtYXBQcm9kdWN0VmFyaWF0aW9uQXBpVG9Gb3JtUm93IiwiZm9ybWF0VmFyaWF0aW9uTmFtZSIsInZhcmlhdGlvbk1hc3RlclNlcnZpY2UiLCJ2YXJpYXRpb25MaWJyYXJ5U2VydmljZSIsImludmVudG9yeVNlcnZpY2UiLCJicmFuZFNlcnZpY2UiLCJwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlIiwidW5pdFNlcnZpY2UiLCJjb250YWN0U2VydmljZSIsImJyYW5jaFNlcnZpY2UiLCJjb21ib1NlcnZpY2UiLCJzdXBhYmFzZSIsInVwbG9hZFByb2R1Y3RJbWFnZXMiLCJwYXJzZVZhcmlhdGlvbkF0dHJpYnV0ZXNSYXciLCJwdWJsaWNWYXJpYXRpb25BdHRyaWJ1dGVzIiwiUHJvZHVjdEltYWdlIiwiZ2V0U3VwYWJhc2VTdG9yYWdlRGFzaGJvYXJkVXJsIiwidG9hc3QiLCJYIiwiVXBsb2FkIiwiUGx1cyIsIlRyYXNoMiIsIlJlZnJlc2hDY3ciLCJQYWNrYWdlIiwiRG9sbGFyU2lnbiIsImNsc3giLCJMYWJlbCIsIklucHV0IiwiU2VsZWN0IiwiU2VsZWN0Q29udGVudCIsIlNlbGVjdEl0ZW0iLCJTZWxlY3RUcmlnZ2VyIiwiU2VsZWN0VmFsdWUiLCJTZWFyY2hhYmxlU2VsZWN0IiwiU3dpdGNoIiwiVGV4dGFyZWEiLCJEaWFsb2ciLCJEaWFsb2dDb250ZW50IiwiRGlhbG9nSGVhZGVyIiwiRGlhbG9nVGl0bGUiLCJEaWFsb2dGb290ZXIiLCJwcm9kdWN0U2NoZW1hIiwib2JqZWN0IiwibmFtZSIsInN0cmluZyIsIm1pbiIsInNrdSIsImJhcmNvZGVUeXBlIiwib3B0aW9uYWwiLCJiYXJjb2RlIiwiYnJhbmQiLCJjYXRlZ29yeSIsInN1YkNhdGVnb3J5IiwidW5pdCIsInB1cmNoYXNlUHJpY2UiLCJjb2VyY2UiLCJudW1iZXIiLCJtYXJnaW4iLCJzZWxsaW5nUHJpY2UiLCJ3aG9sZXNhbGVQcmljZSIsInRheFR5cGUiLCJyZW50YWxQcmljZSIsInNlY3VyaXR5RGVwb3NpdCIsInJlbnRhbER1cmF0aW9uIiwic3RvY2tNYW5hZ2VtZW50IiwiYm9vbGVhbiIsImRlZmF1bHQiLCJpbml0aWFsU3RvY2siLCJhbGVydFF0eSIsIm1heFN0b2NrIiwiZGVzY3JpcHRpb24iLCJub3RlcyIsInN1cHBsaWVyIiwic3VwcGxpZXJDb2RlIiwic2V0VmFsdWVBc051bWJlciIsInYiLCJ1bmRlZmluZWQiLCJuIiwiTnVtYmVyIiwiaXNOYU4iLCJFbmhhbmNlZFByb2R1Y3RGb3JtIiwicHJvZHVjdCIsImluaXRpYWxQcm9kdWN0Iiwib25DYW5jZWwiLCJvblNhdmUiLCJvblNhdmVBbmRBZGQiLCJfcyIsImNvbXBhbnlJZCIsImJyYW5jaElkIiwic2V0dGluZ3MiLCJtb2R1bGVzIiwiZ2VuZXJhdGVEb2N1bWVudE51bWJlciIsImdlbmVyYXRlRG9jdW1lbnROdW1iZXJTYWZlIiwiaW5jcmVtZW50TmV4dE51bWJlciIsInNhdmluZyIsInNldFNhdmluZyIsInN1Ym1pdEluUHJvZ3Jlc3NSZWYiLCJlbmFibGVWYXJpYXRpb25zIiwic2V0RW5hYmxlVmFyaWF0aW9ucyIsImJsb2NrRGlzYWJsZVZhcmlhdGlvbnNNb2RhbE9wZW4iLCJzZXRCbG9ja0Rpc2FibGVWYXJpYXRpb25zTW9kYWxPcGVuIiwiaXNDb21ib1Byb2R1Y3QiLCJzZXRJc0NvbWJvUHJvZHVjdCIsImJsb2NrRW5hYmxlQ29tYm9Nb2RhbE9wZW4iLCJzZXRCbG9ja0VuYWJsZUNvbWJvTW9kYWxPcGVuIiwiYmxvY2tEaXNhYmxlQ29tYm9Nb2RhbE9wZW4iLCJzZXRCbG9ja0Rpc2FibGVDb21ib01vZGFsT3BlbiIsImltYWdlcyIsInNldEltYWdlcyIsImV4aXN0aW5nSW1hZ2VVcmxzIiwic2V0RXhpc3RpbmdJbWFnZVVybHMiLCJpc1JlbnRhbE9wdGlvbnNPcGVuIiwic2V0SXNSZW50YWxPcHRpb25zT3BlbiIsImFjdGl2ZVRhYiIsInNldEFjdGl2ZVRhYiIsImNhdGVnb3JpZXMiLCJzZXRDYXRlZ29yaWVzIiwic3ViQ2F0ZWdvcmllcyIsInNldFN1YkNhdGVnb3JpZXMiLCJsb2FkaW5nQ2F0ZWdvcmllcyIsInNldExvYWRpbmdDYXRlZ29yaWVzIiwiYnJhbmRzIiwic2V0QnJhbmRzIiwibG9hZGluZ0JyYW5kcyIsInNldExvYWRpbmdCcmFuZHMiLCJ1bml0cyIsInNldFVuaXRzIiwibG9hZGluZ1VuaXRzIiwic2V0TG9hZGluZ1VuaXRzIiwic3VwcGxpZXJzIiwic2V0U3VwcGxpZXJzIiwibG9hZGluZ1N1cHBsaWVycyIsInNldExvYWRpbmdTdXBwbGllcnMiLCJjb21wYW55QnJhbmNoZXMiLCJzZXRDb21wYW55QnJhbmNoZXMiLCJzZWxlY3RlZEJyYW5jaElkcyIsInNldFNlbGVjdGVkQnJhbmNoSWRzIiwidmFyaWFudEF0dHJpYnV0ZXMiLCJzZXRWYXJpYW50QXR0cmlidXRlcyIsIm5ld0F0dHJpYnV0ZU5hbWUiLCJzZXROZXdBdHRyaWJ1dGVOYW1lIiwibmV3QXR0cmlidXRlVmFsdWUiLCJzZXROZXdBdHRyaWJ1dGVWYWx1ZSIsInNlbGVjdGVkQXR0cmlidXRlSW5kZXgiLCJzZXRTZWxlY3RlZEF0dHJpYnV0ZUluZGV4IiwiYmxvY2tWYXJpYXRpb25zTW9kYWxPcGVuIiwic2V0QmxvY2tWYXJpYXRpb25zTW9kYWxPcGVuIiwiZnVsbFByb2R1Y3RGb3JFZGl0Iiwic2V0RnVsbFByb2R1Y3RGb3JFZGl0IiwibG9hZGluZ0Z1bGxQcm9kdWN0Iiwic2V0TG9hZGluZ0Z1bGxQcm9kdWN0IiwiZ2VuZXJhdGVkVmFyaWF0aW9ucyIsInNldEdlbmVyYXRlZFZhcmlhdGlvbnMiLCJ2YXJpYXRpb25NYXN0ZXIiLCJzZXRWYXJpYXRpb25NYXN0ZXIiLCJwcm9kdWN0c1dpdGhWYXJpYXRpb25zIiwic2V0UHJvZHVjdHNXaXRoVmFyaWF0aW9ucyIsInZhcmlhdGlvbnNGb3JDb3B5Iiwic2V0VmFyaWF0aW9uc0ZvckNvcHkiLCJsb2FkaW5nUHJvZHVjdHNXaXRoVmFyaWF0aW9ucyIsInNldExvYWRpbmdQcm9kdWN0c1dpdGhWYXJpYXRpb25zIiwiY29weUZyb21WYXJpYXRpb25JZCIsInNldENvcHlGcm9tVmFyaWF0aW9uSWQiLCJjb21ib3MiLCJzZXRDb21ib3MiLCJjdXJyZW50Q29tYm9JdGVtcyIsInNldEN1cnJlbnRDb21ib0l0ZW1zIiwiY29tYm9OYW1lIiwic2V0Q29tYm9OYW1lIiwiY29tYm9GaW5hbFByaWNlIiwic2V0Q29tYm9GaW5hbFByaWNlIiwicHJvZHVjdFNlYXJjaFF1ZXJ5Iiwic2V0UHJvZHVjdFNlYXJjaFF1ZXJ5Iiwic2hvd1Byb2R1Y3REcm9wZG93biIsInNldFNob3dQcm9kdWN0RHJvcGRvd24iLCJhdmFpbGFibGVQcm9kdWN0cyIsInNldEF2YWlsYWJsZVByb2R1Y3RzIiwibG9hZGluZ1Byb2R1Y3RzIiwic2V0TG9hZGluZ1Byb2R1Y3RzIiwicmVnaXN0ZXIiLCJoYW5kbGVTdWJtaXQiLCJjb250cm9sIiwic2V0VmFsdWUiLCJ3YXRjaCIsImdldFZhbHVlcyIsImZvcm1TdGF0ZSIsImVycm9ycyIsInJlc29sdmVyIiwiZGVmYXVsdFZhbHVlcyIsInNlbGVjdGVkVW5pdElkIiwic2VsZWN0ZWRVbml0QWxsb3dzRGVjaW1hbCIsImZpbmQiLCJ1IiwiaWQiLCJhbGxvd19kZWNpbWFsIiwicGFyc2VWYXJpYXRpb25RdHlJbnB1dCIsInJhdyIsInBhcnNlRmxvYXQiLCJpc0Zpbml0ZSIsIk1hdGgiLCJtYXgiLCJwYXJzZUludCIsImxvYWRDYXRlZ29yaWVzIiwiZGF0YSIsImdldENhdGVnb3JpZXMiLCJtYXAiLCJjIiwiZXJyb3IiLCJjb25zb2xlIiwibG9hZEJyYW5kcyIsImdldEFsbCIsImIiLCJsb2FkVW5pdHMiLCJzeW1ib2wiLCJzaG9ydF9jb2RlIiwiaXNfZGVmYXVsdCIsImN1cnJlbnRVbml0Iiwic2V0dGluZ3NEZWZhdWx0SWQiLCJpbnZlbnRvcnlTZXR0aW5ncyIsImRlZmF1bHRVbml0SWQiLCJkZWZhdWx0VW5pdCIsImxlZ2FjeSIsImxpYnJhcnkiLCJQcm9taXNlIiwiYWxsIiwiZ2V0IiwiY2F0Y2giLCJsaXN0QXR0cmlidXRlcyIsIm1lcmdlZCIsImF0dHIiLCJleGlzdGluZyIsIlNldCIsInRvTG93ZXJDYXNlIiwiYWRkIiwidmFsdWVzIiwidmFsdWUiLCJmaWx0ZXIiLCJoYXMiLCJsb2FkU3VwcGxpZXJzIiwiZ2V0QWxsQ29udGFjdHMiLCJnZXRCcmFuY2hlc0NhY2hlZCIsInRoZW4iLCJicmFuY2hlcyIsImxpc3QiLCJwcm9kdWN0SWQiLCJ1dWlkIiwibGVuZ3RoIiwiZ2V0UHJvZHVjdEJyYW5jaElkcyIsImlkcyIsImNhbmNlbGxlZCIsImdldEFsbFByb2R1Y3RzIiwid2l0aFZhcnMiLCJwIiwiaGFzX3ZhcmlhdGlvbnMiLCJBcnJheSIsImlzQXJyYXkiLCJ2YXJpYXRpb25zIiwiZmxhdCIsInN1cHBsaWVySWQiLCJzdXBwbGllcl9pZCIsInN1cHBsaWVyTmFtZSIsInMiLCJmb3JFYWNoIiwiaWR4IiwiYXR0cnMiLCJhdHRyaWJ1dGVzIiwiYXR0ck5hbWUiLCJ2YWwiLCJPYmplY3QiLCJlbnRyaWVzIiwibGFiZWwiLCJwdXNoIiwidmFyaWF0aW9uSWQiLCJTdHJpbmciLCJyZXBsYWNlIiwiZmluYWxseSIsInNlbGVjdGVkQ2F0ZWdvcnlJZCIsImxvYWRTdWJDYXRlZ29yaWVzIiwiZ2V0U3ViQ2F0ZWdvcmllcyIsImdlbmVyYXRlU0tVIiwidHJpbSIsIm5leHRTS1UiLCJlIiwiZ2V0UHJvZHVjdCIsImZ1bGwiLCJlcnIiLCJzb3VyY2UiLCJiYXJjb2RlX3R5cGUiLCJjb3N0X3ByaWNlIiwicmV0YWlsX3ByaWNlIiwid2hvbGVzYWxlX3ByaWNlIiwicmVudGFsX3ByaWNlX2RhaWx5IiwibWluX3N0b2NrIiwibG93U3RvY2tUaHJlc2hvbGQiLCJtYXhfc3RvY2siLCJicmFuZF9pZCIsInVuaXRfaWQiLCJzdXBwbGllcl9jb2RlIiwiY2F0SWQiLCJjYXRlZ29yeV9pZCIsImdldEJ5SWQiLCJjYXQiLCJwYXJlbnRfaWQiLCJmaXJzdFBhcnNlZCIsImF0dHJOYW1lcyIsImtleXMiLCJzb3J0IiwiYSIsImxvY2FsZUNvbXBhcmUiLCJ2YWx1ZXNCeUF0dHIiLCJrIiwiZnJvbSIsIm1hcHBlZCIsInBpZCIsInNvbWUiLCJtIiwiYnJhbmNoU2NvcGUiLCJ3aXRoTW92ZW1lbnQiLCJyb3ciLCJxdHkiLCJnZXRTdG9jayIsInN0b2NrIiwidXJscyIsImltYWdlX3VybHMiLCJpc19jb21ib19wcm9kdWN0IiwibG9hZFByb2R1Y3RDb21ib3MiLCJoYXNWYXIiLCJzaG91bGRWYWxpZGF0ZSIsInNob3VsZERpcnR5Iiwicm91bmQiLCJmYWxsYmFjayIsImN1cnJlbnRfc3RvY2siLCJjb21ib3NFbmFibGVkIiwibG9hZEF2YWlsYWJsZVByb2R1Y3RzIiwiY3VycmVudFByb2R1Y3RJZCIsImlzVmFsaWRVdWlkIiwidGVzdCIsInF1ZXJ5Iiwic2VsZWN0IiwiZXEiLCJuZXEiLCJvcmRlciIsImNvbWJvIiwiZ2V0Q29tYm9CeVByb2R1Y3RJZCIsIml0ZW1zV2l0aERldGFpbHMiLCJnZXRDb21ib0l0ZW1zV2l0aERldGFpbHMiLCJjb21ib19uYW1lIiwiY29tYm9fcHJpY2UiLCJpdGVtcyIsIml0ZW0iLCJwcm9kdWN0X2lkIiwicHJvZHVjdF9uYW1lIiwicHJvZHVjdF9za3UiLCJ2YXJpYXRpb25faWQiLCJ1bml0X3ByaWNlIiwicHVyY2hhc2VQcmljZU51bSIsIm1hcmdpbk51bSIsInNwIiwidG9GaXhlZCIsIm9uRHJvcCIsImFjY2VwdGVkRmlsZXMiLCJwcmV2IiwiZ2V0Um9vdFByb3BzIiwiZ2V0SW5wdXRQcm9wcyIsImlzRHJhZ0FjdGl2ZSIsImFjY2VwdCIsIm1heFNpemUiLCJnZW5lcmF0ZVNLVUZvckZvcm0iLCJoYW5kbGVFbmFibGVWYXJpYXRpb25zQ2hhbmdlIiwiY2hlY2tlZCIsInBhcmVudENvdW50IiwiZ2V0UGFyZW50TGV2ZWxNb3ZlbWVudENvdW50IiwidmFyaWF0aW9uQ291bnQiLCJnZXRWYXJpYXRpb25MZXZlbE1vdmVtZW50Q291bnQiLCJoYW5kbGVFbmFibGVDb21ib0NoYW5nZSIsInBlcnNpc3RWYXJpYXRpb25NYXN0ZXJNZXJnZSIsIm5leHQiLCJzYXZlIiwiYWRkVmFyaWFudEF0dHJpYnV0ZSIsImFkZEF0dHJpYnV0ZVZhbHVlIiwidXBkYXRlZEF0dHJpYnV0ZXMiLCJpbmNsdWRlcyIsInJlbW92ZVZhcmlhbnRBdHRyaWJ1dGUiLCJyZW1vdmVBdHRyaWJ1dGVWYWx1ZSIsImF0dHJJbmRleCIsInZhbHVlSW5kZXgiLCJzcGxpY2UiLCJjb3B5QXR0cmlidXRlc0Zyb21Qcm9kdWN0IiwidmFycyIsImF0dHJNYXAiLCJrZXkiLCJkZXJpdmVkIiwic2V0Iiwic3VjY2VzcyIsIk1BWF9WQVJJQVRJT05TIiwiY2FydGVzaWFuUHJvZHVjdCIsImFycmF5cyIsInJlZHVjZSIsImZsYXRNYXAiLCJkIiwidmFyaWF0aW9uQ29tYm9LZXkiLCJjb21iaW5hdGlvbk9iaiIsImpvaW4iLCJnZW5lcmF0ZVZhcmlhdGlvbnMiLCJhdHRyaWJ1dGVWYWx1ZXMiLCJjb21iaW5hdGlvbnMiLCJiYXNlU2t1IiwiYmFzaWNTZWxsaW5nUHJpY2UiLCJiYXNpY1B1cmNoYXNlUHJpY2UiLCJleGlzdGluZ0J5Q29tYm8iLCJNYXAiLCJldiIsImNvbWJpbmF0aW9uIiwibmV3VmFyaWF0aW9ucyIsImluZGV4IiwiaSIsInByaWNlIiwiZmlsdGVyZWRQcm9kdWN0cyIsInNlbGVjdFByb2R1Y3QiLCJyZW1vdmVDb21ib0l0ZW0iLCJfIiwidXBkYXRlQ29tYm9JdGVtUXR5IiwidXBkYXRlZCIsInVwZGF0ZUNvbWJvSXRlbVByaWNlIiwic2F2ZUNvbWJvIiwidXBkYXRlQ29tYm8iLCJ1cGRhdGVDb21ib0l0ZW1zIiwibmV3Q29tYm8iLCJjcmVhdGVDb21ibyIsImNvbXBhbnlfaWQiLCJjb21ib19wcm9kdWN0X2lkIiwibWVzc2FnZSIsImRlbGV0ZUNvbWJvIiwib25TdWJtaXQiLCJhY3Rpb24iLCJjdXJyZW50IiwiZmluYWxDb21wYW55SWQiLCJmaW5hbFNLVSIsIlVVSURfUkVHRVgiLCJhc0lkIiwicmF3VW5pdCIsInJhd0NhdGVnb3J5IiwicmF3U3ViQ2F0ZWdvcnkiLCJyYXdCcmFuZCIsImNhdGVnb3J5SWQiLCJmb3VuZCIsInVuaXRJZCIsImJyYW5kSWQiLCJiYXJjb2RlVmFsdWUiLCJiYXJjb2RlRXJyb3IiLCJ3YXJuIiwicHJvZHVjdERhdGEiLCJpc19yZW50YWJsZSIsImlzX3NlbGxhYmxlIiwidHJhY2tfc3RvY2siLCJpc19hY3RpdmUiLCJpc0VkaXQiLCJpbWFnZVVybHMiLCJuZXdVcmxzIiwidXBsb2FkRXJyIiwibXNnIiwiaXNCdWNrZXRNaXNzaW5nIiwib25DbGljayIsIndpbmRvdyIsIm9wZW4iLCJwYXJlbnRMZXZlbENvdW50IiwiaGFzVmFyaWF0aW9ucyIsIm1vdmVtZW50Q291bnQiLCJnZXRNb3ZlbWVudENvdW50Rm9yUHJvZHVjdCIsInJlc3VsdCIsInVwZGF0ZVByb2R1Y3QiLCJicmFuY2hJZE9yTnVsbCIsInBhcmVudENvc3QiLCJwYXJlbnRTZWxsIiwicHVyY2hOIiwic2VsbE4iLCJjb3N0Iiwic2VsbGluZyIsImltcG9ydCIsImVudiIsIkRFViIsInVwZGF0ZVZhcmlhdGlvbiIsImFsbG93ViIsImFsbG93c1ZhcmlhdGlvbk9wZW5pbmdSZWNvbmNpbGVGcm9tUHJvZHVjdEZvcm0iLCJ2TW92RXJyIiwicmVjb25jaWxlVmFyaWF0aW9uT3BlbmluZ1N0b2NrIiwicSIsImNyZWF0ZWQiLCJjcmVhdGVWYXJpYXRpb24iLCJ2aWQiLCJtb3ZFcnIiLCJpbnNlcnRPcGVuaW5nQmFsYW5jZU1vdmVtZW50IiwidmUiLCJ3YXJuaW5nIiwiY2FuUmVjb25jaWxlT3BlbmluZyIsImFsbG93c1BhcmVudE9wZW5pbmdSZWNvbmNpbGVGcm9tUHJvZHVjdEZvcm0iLCJyZWNvbmNpbGVQYXJlbnRMZXZlbE9wZW5pbmdTdG9jayIsInNldFByb2R1Y3RCcmFuY2hBdmFpbGFiaWxpdHkiLCJicmFuY2hFcnIiLCJwYXlsb2FkIiwiaXNTZWxsYWJsZSIsImlzUmVudGFibGUiLCJ2YXJpYXRpb25QYXlsb2FkIiwidmFyaWF0aW9uIiwicmV0YWlsIiwib3BlbmluZ19zdG9jayIsInNhdmVSZXN1bHQiLCJzYXZlUHJvZHVjdFdpdGhWYXJpYXRpb25zIiwicGFyZW50Iiwid2FzRWRpdCIsImR1cmF0aW9uIiwic2VhcmNoVGV4dCIsImNyZWF0ZSIsInNldFZhbHVlQXMiLCJmaWVsZCIsIm9uQ2hhbmdlIiwidXJsIiwic3RvcFByb3BhZ2F0aW9uIiwiZmlsZSIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsImVudHJ5IiwieCIsImluZm8iLCJ0YXJnZXQiLCJwcmV2ZW50RGVmYXVsdCIsImV2ZXJ5IiwiY291bnQiLCJhY2MiLCJhdExpbWl0IiwibWF4SGVpZ2h0Iiwic3VtIiwiX2MiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRW5oYW5jZWRQcm9kdWN0Rm9ybS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZUNhbGxiYWNrLCB1c2VTdGF0ZSwgdXNlRWZmZWN0LCB1c2VSZWYgfSBmcm9tIFwicmVhY3RcIjtcclxuaW1wb3J0IHsgdXNlRHJvcHpvbmUgfSBmcm9tIFwicmVhY3QtZHJvcHpvbmVcIjtcclxuaW1wb3J0IHsgdXNlRm9ybSwgQ29udHJvbGxlciB9IGZyb20gXCJyZWFjdC1ob29rLWZvcm1cIjtcclxuaW1wb3J0IHsgem9kUmVzb2x2ZXIgfSBmcm9tIFwiQGhvb2tmb3JtL3Jlc29sdmVycy96b2RcIjtcclxuaW1wb3J0ICogYXMgeiBmcm9tIFwiem9kXCI7XHJcbmltcG9ydCB7IHVzZVN1cGFiYXNlIH0gZnJvbSAnQC9hcHAvY29udGV4dC9TdXBhYmFzZUNvbnRleHQnO1xyXG5pbXBvcnQgeyB1c2VTZXR0aW5ncyB9IGZyb20gJ0AvYXBwL2NvbnRleHQvU2V0dGluZ3NDb250ZXh0JztcclxuaW1wb3J0IHsgdXNlRG9jdW1lbnROdW1iZXJpbmcgfSBmcm9tICdAL2FwcC9ob29rcy91c2VEb2N1bWVudE51bWJlcmluZyc7XHJcbmltcG9ydCB7XHJcbiAgcHJvZHVjdFNlcnZpY2UsXHJcbiAgbWFwUHJvZHVjdFZhcmlhdGlvbkFwaVRvRm9ybVJvdyxcclxuICBmb3JtYXRWYXJpYXRpb25OYW1lLFxyXG59IGZyb20gJ0AvYXBwL3NlcnZpY2VzL3Byb2R1Y3RTZXJ2aWNlJztcclxuaW1wb3J0IHsgdmFyaWF0aW9uTWFzdGVyU2VydmljZSB9IGZyb20gJ0AvYXBwL3NlcnZpY2VzL3ZhcmlhdGlvbk1hc3RlclNlcnZpY2UnO1xyXG5pbXBvcnQgeyB2YXJpYXRpb25MaWJyYXJ5U2VydmljZSB9IGZyb20gJ0AvYXBwL3NlcnZpY2VzL3ZhcmlhdGlvbkxpYnJhcnlTZXJ2aWNlJztcclxuaW1wb3J0IHsgaW52ZW50b3J5U2VydmljZSB9IGZyb20gJ0AvYXBwL3NlcnZpY2VzL2ludmVudG9yeVNlcnZpY2UnO1xyXG5pbXBvcnQgeyBicmFuZFNlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy9icmFuZFNlcnZpY2UnO1xyXG5pbXBvcnQgeyBwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlIH0gZnJvbSAnQC9hcHAvc2VydmljZXMvcHJvZHVjdENhdGVnb3J5U2VydmljZSc7XHJcbmltcG9ydCB7IHVuaXRTZXJ2aWNlIH0gZnJvbSAnQC9hcHAvc2VydmljZXMvdW5pdFNlcnZpY2UnO1xyXG5pbXBvcnQgeyBjb250YWN0U2VydmljZSB9IGZyb20gJ0AvYXBwL3NlcnZpY2VzL2NvbnRhY3RTZXJ2aWNlJztcclxuaW1wb3J0IHsgYnJhbmNoU2VydmljZSB9IGZyb20gJ0AvYXBwL3NlcnZpY2VzL2JyYW5jaFNlcnZpY2UnO1xyXG5pbXBvcnQgeyBjb21ib1NlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy9jb21ib1NlcnZpY2UnO1xyXG5pbXBvcnQgeyBzdXBhYmFzZSB9IGZyb20gJ0AvbGliL3N1cGFiYXNlJztcclxuaW1wb3J0IHsgdXBsb2FkUHJvZHVjdEltYWdlcyB9IGZyb20gJ0AvYXBwL3V0aWxzL3Byb2R1Y3RJbWFnZVVwbG9hZCc7XHJcbmltcG9ydCB7IHBhcnNlVmFyaWF0aW9uQXR0cmlidXRlc1JhdywgcHVibGljVmFyaWF0aW9uQXR0cmlidXRlcyB9IGZyb20gJ0AvYXBwL3V0aWxzL3ZhcmlhdGlvbkZpZWxkTWFwJztcclxuaW1wb3J0IHsgUHJvZHVjdEltYWdlIH0gZnJvbSAnLi9Qcm9kdWN0SW1hZ2UnO1xyXG5pbXBvcnQgeyBnZXRTdXBhYmFzZVN0b3JhZ2VEYXNoYm9hcmRVcmwgfSBmcm9tICdAL2FwcC91dGlscy9wYXltZW50QXR0YWNobWVudFVybCc7XHJcbmltcG9ydCB7IHRvYXN0IH0gZnJvbSAnc29ubmVyJztcclxuaW1wb3J0IHtcclxuICBYLFxyXG4gIFVwbG9hZCxcclxuICBQbHVzLFxyXG4gIE1pbnVzLFxyXG4gIFRyYXNoMixcclxuICBSZWZyZXNoQ2N3LFxyXG4gIEJhcmNvZGUsXHJcbiAgUGFja2FnZSxcclxuICBEb2xsYXJTaWduLFxyXG4gIENsb2NrLFxyXG4gIFNoaWVsZCxcclxuICBDaGV2cm9uRG93bixcclxuICBTZWFyY2gsXHJcbn0gZnJvbSBcImx1Y2lkZS1yZWFjdFwiO1xyXG5pbXBvcnQgeyBjbHN4IH0gZnJvbSBcImNsc3hcIjtcclxuaW1wb3J0IHtcclxuICBBY2NvcmRpb24sXHJcbiAgQWNjb3JkaW9uQ29udGVudCxcclxuICBBY2NvcmRpb25JdGVtLFxyXG4gIEFjY29yZGlvblRyaWdnZXIsXHJcbn0gZnJvbSBcIi4uL3VpL2FjY29yZGlvblwiO1xyXG5pbXBvcnQgeyBMYWJlbCB9IGZyb20gXCIuLi91aS9sYWJlbFwiO1xyXG5pbXBvcnQgeyBJbnB1dCB9IGZyb20gXCIuLi91aS9pbnB1dFwiO1xyXG5pbXBvcnQge1xyXG4gIFNlbGVjdCxcclxuICBTZWxlY3RDb250ZW50LFxyXG4gIFNlbGVjdEl0ZW0sXHJcbiAgU2VsZWN0VHJpZ2dlcixcclxuICBTZWxlY3RWYWx1ZSxcclxufSBmcm9tIFwiLi4vdWkvc2VsZWN0XCI7XHJcbmltcG9ydCB7IFNlYXJjaGFibGVTZWxlY3QgfSBmcm9tIFwiLi4vdWkvc2VhcmNoYWJsZS1zZWxlY3RcIjtcclxuaW1wb3J0IHsgU3dpdGNoIH0gZnJvbSBcIi4uL3VpL3N3aXRjaFwiO1xyXG5pbXBvcnQgeyBUZXh0YXJlYSB9IGZyb20gXCIuLi91aS90ZXh0YXJlYVwiO1xyXG5pbXBvcnQgeyBTZXBhcmF0b3IgfSBmcm9tIFwiLi4vdWkvc2VwYXJhdG9yXCI7XHJcbmltcG9ydCB7XHJcbiAgQ29sbGFwc2libGUsXHJcbiAgQ29sbGFwc2libGVDb250ZW50LFxyXG4gIENvbGxhcHNpYmxlVHJpZ2dlcixcclxufSBmcm9tIFwiLi4vdWkvY29sbGFwc2libGVcIjtcclxuaW1wb3J0IHtcclxuICBEaWFsb2csXHJcbiAgRGlhbG9nQ29udGVudCxcclxuICBEaWFsb2dIZWFkZXIsXHJcbiAgRGlhbG9nVGl0bGUsXHJcbiAgRGlhbG9nRm9vdGVyLFxyXG59IGZyb20gXCIuLi91aS9kaWFsb2dcIjtcclxuXHJcbi8vIERlZmluZSB0aGUgdmFsaWRhdGlvbiBzY2hlbWEgKGFsaWduZWQgd2l0aCBzdWJtaXQgYW5kIERCKVxyXG5jb25zdCBwcm9kdWN0U2NoZW1hID0gei5vYmplY3Qoe1xyXG4gIG5hbWU6IHouc3RyaW5nKCkubWluKDEsIFwiUHJvZHVjdCBuYW1lIGlzIHJlcXVpcmVkXCIpLFxyXG4gIHNrdTogei5zdHJpbmcoKS5taW4oMSwgXCJTS1UgaXMgcmVxdWlyZWRcIiksXHJcbiAgYmFyY29kZVR5cGU6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICBiYXJjb2RlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgYnJhbmQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICBjYXRlZ29yeTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gIHN1YkNhdGVnb3J5OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgdW5pdDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG5cclxuICAvLyBTYWxlcyBQcmljaW5nIChBbHdheXMgU2VsbGFibGUgaW4gUmV0YWlsIE1vZGUpXHJcbiAgcHVyY2hhc2VQcmljZTogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm9wdGlvbmFsKCksXHJcbiAgbWFyZ2luOiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkub3B0aW9uYWwoKSxcclxuICBzZWxsaW5nUHJpY2U6IHouY29lcmNlXHJcbiAgICAubnVtYmVyKClcclxuICAgIC5taW4oMC4wMSwgXCJTZWxsaW5nIHByaWNlIGlzIHJlcXVpcmVkXCIpLFxyXG4gIHdob2xlc2FsZVByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkub3B0aW9uYWwoKSxcclxuICB0YXhUeXBlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXHJcblxyXG4gIC8vIFJlbnRhbCBQcmljaW5nIChPcHRpb25hbClcclxuICByZW50YWxQcmljZTogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm9wdGlvbmFsKCksXHJcbiAgc2VjdXJpdHlEZXBvc2l0OiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkub3B0aW9uYWwoKSxcclxuICByZW50YWxEdXJhdGlvbjogei5jb2VyY2UubnVtYmVyKCkubWluKDEpLm9wdGlvbmFsKCksXHJcblxyXG4gIC8vIEludmVudG9yeSAoaW5pdGlhbFN0b2NrID0gY3VycmVudF9zdG9jaywgYWxlcnRRdHkgPSBtaW5fc3RvY2spXHJcbiAgc3RvY2tNYW5hZ2VtZW50OiB6LmJvb2xlYW4oKS5kZWZhdWx0KHRydWUpLFxyXG4gIGluaXRpYWxTdG9jazogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm9wdGlvbmFsKCksXHJcbiAgYWxlcnRRdHk6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5vcHRpb25hbCgpLFxyXG4gIG1heFN0b2NrOiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkub3B0aW9uYWwoKSxcclxuXHJcbiAgLy8gRGV0YWlsc1xyXG4gIGRlc2NyaXB0aW9uOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgbm90ZXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuXHJcbiAgLy8gU3VwcGxpZXJcclxuICBzdXBwbGllcjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gIHN1cHBsaWVyQ29kZTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG59KTtcclxuXHJcbnR5cGUgUHJvZHVjdEZvcm1WYWx1ZXMgPSB6LmluZmVyPHR5cGVvZiBwcm9kdWN0U2NoZW1hPjtcclxuXHJcbi8vIEVuc3VyZSBudW1iZXIgaW5wdXRzIG5ldmVyIHNob3cgZW1wdHkgb24gY2xpY2svY2xlYXIg4oCUIHN0b3JlIDAgaW5zdGVhZCBvZiBcIlwiXHJcbmNvbnN0IHNldFZhbHVlQXNOdW1iZXIgPSAodjogdW5rbm93bik6IG51bWJlciA9PiB7XHJcbiAgaWYgKHYgPT09ICcnIHx8IHYgPT09IHVuZGVmaW5lZCB8fCB2ID09PSBudWxsKSByZXR1cm4gMDtcclxuICBjb25zdCBuID0gTnVtYmVyKHYpO1xyXG4gIHJldHVybiBOdW1iZXIuaXNOYU4obikgPyAwIDogbjtcclxufTtcclxuXHJcbmludGVyZmFjZSBFbmhhbmNlZFByb2R1Y3RGb3JtUHJvcHMge1xyXG4gIHByb2R1Y3Q/OiBhbnk7IC8vIFByb2R1Y3QgZGF0YSBmb3IgZWRpdCBtb2RlXHJcbiAgb25DYW5jZWw6ICgpID0+IHZvaWQ7XHJcbiAgb25TYXZlOiAocHJvZHVjdD86IGFueSkgPT4gdm9pZDtcclxuICBvblNhdmVBbmRBZGQ/OiAocHJvZHVjdDogYW55KSA9PiB2b2lkO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgRW5oYW5jZWRQcm9kdWN0Rm9ybSA9ICh7XHJcbiAgcHJvZHVjdDogaW5pdGlhbFByb2R1Y3QsXHJcbiAgb25DYW5jZWwsXHJcbiAgb25TYXZlLFxyXG4gIG9uU2F2ZUFuZEFkZCxcclxufTogRW5oYW5jZWRQcm9kdWN0Rm9ybVByb3BzKSA9PiB7XHJcbiAgY29uc3QgeyBjb21wYW55SWQsIGJyYW5jaElkIH0gPSB1c2VTdXBhYmFzZSgpO1xyXG4gIGNvbnN0IHNldHRpbmdzID0gdXNlU2V0dGluZ3MoKTtcclxuICBjb25zdCB7IG1vZHVsZXMgfSA9IHNldHRpbmdzO1xyXG4gIGNvbnN0IHsgZ2VuZXJhdGVEb2N1bWVudE51bWJlciwgZ2VuZXJhdGVEb2N1bWVudE51bWJlclNhZmUsIGluY3JlbWVudE5leHROdW1iZXIgfSA9IHVzZURvY3VtZW50TnVtYmVyaW5nKCk7XHJcbiAgY29uc3QgW3NhdmluZywgc2V0U2F2aW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICAvKiogU3luY2hyb25vdXMgZ3VhcmQgdG8gcHJldmVudCBkb3VibGUgc3VibWl0IChzdGF0ZSB1cGRhdGUgaXMgYXN5bmMpLiAqL1xyXG4gIGNvbnN0IHN1Ym1pdEluUHJvZ3Jlc3NSZWYgPSB1c2VSZWYoZmFsc2UpO1xyXG4gIC8qKiBFbmFibGUgVmFyaWF0aW9ucyB0b2dnbGU6IGRlZmF1bHQgT0ZGIGZvciBuZXcgcHJvZHVjdCwgZnJvbSBEQiBmb3IgZWRpdC4gV2hlbiBPTiwgcGFyZW50IHN0b2NrIGxvY2tlZCBhdCAwLiAqL1xyXG4gIGNvbnN0IFtlbmFibGVWYXJpYXRpb25zLCBzZXRFbmFibGVWYXJpYXRpb25zXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbYmxvY2tEaXNhYmxlVmFyaWF0aW9uc01vZGFsT3Blbiwgc2V0QmxvY2tEaXNhYmxlVmFyaWF0aW9uc01vZGFsT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgXHJcbiAgLyoqIEVuYWJsZSBDb21ibyBQcm9kdWN0IHRvZ2dsZTogZGVmYXVsdCBPRkYgZm9yIG5ldyBwcm9kdWN0LCBmcm9tIERCIGZvciBlZGl0LiBXaGVuIE9OLCBwcm9kdWN0IGJlY29tZXMgdmlydHVhbCBidW5kbGUgLSBubyBzdG9jay4gKi9cclxuICBjb25zdCBbaXNDb21ib1Byb2R1Y3QsIHNldElzQ29tYm9Qcm9kdWN0XSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbYmxvY2tFbmFibGVDb21ib01vZGFsT3Blbiwgc2V0QmxvY2tFbmFibGVDb21ib01vZGFsT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2Jsb2NrRGlzYWJsZUNvbWJvTW9kYWxPcGVuLCBzZXRCbG9ja0Rpc2FibGVDb21ib01vZGFsT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2ltYWdlcywgc2V0SW1hZ2VzXSA9IHVzZVN0YXRlPEZpbGVbXT4oW10pO1xyXG4gIGNvbnN0IFtleGlzdGluZ0ltYWdlVXJscywgc2V0RXhpc3RpbmdJbWFnZVVybHNdID0gdXNlU3RhdGU8c3RyaW5nW10+KFtdKTtcclxuICBjb25zdCBbaXNSZW50YWxPcHRpb25zT3Blbiwgc2V0SXNSZW50YWxPcHRpb25zT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2FjdGl2ZVRhYiwgc2V0QWN0aXZlVGFiXSA9IHVzZVN0YXRlPCdiYXNpYycgfCAncHJpY2luZycgfCAnaW52ZW50b3J5JyB8ICdtZWRpYScgfCAnZGV0YWlscycgfCAndmFyaWF0aW9ucycgfCAnY29tYm9zJz4oJ2Jhc2ljJyk7XHJcbiAgY29uc3QgW2NhdGVnb3JpZXMsIHNldENhdGVnb3JpZXNdID0gdXNlU3RhdGU8QXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4+KFtdKTtcclxuICBjb25zdCBbc3ViQ2F0ZWdvcmllcywgc2V0U3ViQ2F0ZWdvcmllc10gPSB1c2VTdGF0ZTxBcnJheTx7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9Pj4oW10pO1xyXG4gIGNvbnN0IFtsb2FkaW5nQ2F0ZWdvcmllcywgc2V0TG9hZGluZ0NhdGVnb3JpZXNdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFticmFuZHMsIHNldEJyYW5kc10gPSB1c2VTdGF0ZTxBcnJheTx7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9Pj4oW10pO1xyXG4gIGNvbnN0IFtsb2FkaW5nQnJhbmRzLCBzZXRMb2FkaW5nQnJhbmRzXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbdW5pdHMsIHNldFVuaXRzXSA9IHVzZVN0YXRlPEFycmF5PHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBzeW1ib2w/OiBzdHJpbmcgfT4+KFtdKTtcclxuICBjb25zdCBbbG9hZGluZ1VuaXRzLCBzZXRMb2FkaW5nVW5pdHNdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtzdXBwbGllcnMsIHNldFN1cHBsaWVyc10gPSB1c2VTdGF0ZTxBcnJheTx7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9Pj4oW10pO1xyXG4gIGNvbnN0IFtsb2FkaW5nU3VwcGxpZXJzLCBzZXRMb2FkaW5nU3VwcGxpZXJzXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbY29tcGFueUJyYW5jaGVzLCBzZXRDb21wYW55QnJhbmNoZXNdID0gdXNlU3RhdGU8QXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4+KFtdKTtcclxuICBjb25zdCBbc2VsZWN0ZWRCcmFuY2hJZHMsIHNldFNlbGVjdGVkQnJhbmNoSWRzXSA9IHVzZVN0YXRlPHN0cmluZ1tdPihbXSk7XHJcblxyXG4gIC8vIFZhcmlhdGlvbnMgU3RhdGVcclxuICBjb25zdCBbdmFyaWFudEF0dHJpYnV0ZXMsIHNldFZhcmlhbnRBdHRyaWJ1dGVzXSA9IHVzZVN0YXRlPEFycmF5PHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIHZhbHVlczogc3RyaW5nW107XHJcbiAgfT4+KFtdKTtcclxuICBjb25zdCBbbmV3QXR0cmlidXRlTmFtZSwgc2V0TmV3QXR0cmlidXRlTmFtZV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW25ld0F0dHJpYnV0ZVZhbHVlLCBzZXROZXdBdHRyaWJ1dGVWYWx1ZV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW3NlbGVjdGVkQXR0cmlidXRlSW5kZXgsIHNldFNlbGVjdGVkQXR0cmlidXRlSW5kZXhdID0gdXNlU3RhdGU8bnVtYmVyIHwgbnVsbD4obnVsbCk7XHJcbiAgY29uc3QgW2Jsb2NrVmFyaWF0aW9uc01vZGFsT3Blbiwgc2V0QmxvY2tWYXJpYXRpb25zTW9kYWxPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICAvKiogV2hlbiBpbiBlZGl0IG1vZGUsIGZ1bGwgcHJvZHVjdCBmZXRjaGVkIGZyb20gQVBJICh3aXRoIHZhcmlhdGlvbnMsIGNhdGVnb3J5X2lkLCBldGMuKS4gRm9ybSBoeWRyYXRlcyBmcm9tIHRoaXMuICovXHJcbiAgY29uc3QgW2Z1bGxQcm9kdWN0Rm9yRWRpdCwgc2V0RnVsbFByb2R1Y3RGb3JFZGl0XSA9IHVzZVN0YXRlPGFueT4obnVsbCk7XHJcbiAgY29uc3QgW2xvYWRpbmdGdWxsUHJvZHVjdCwgc2V0TG9hZGluZ0Z1bGxQcm9kdWN0XSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbZ2VuZXJhdGVkVmFyaWF0aW9ucywgc2V0R2VuZXJhdGVkVmFyaWF0aW9uc10gPSB1c2VTdGF0ZTxcclxuICAgIEFycmF5PHtcclxuICAgICAgaWQ/OiBzdHJpbmc7XHJcbiAgICAgIGNvbWJpbmF0aW9uOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xyXG4gICAgICBza3U6IHN0cmluZztcclxuICAgICAgcHJpY2U6IG51bWJlcjtcclxuICAgICAgcHVyY2hhc2VQcmljZTogbnVtYmVyO1xyXG4gICAgICBzdG9jazogbnVtYmVyO1xyXG4gICAgICBiYXJjb2RlOiBzdHJpbmc7XHJcbiAgICB9PlxyXG4gID4oW10pO1xyXG4gIC8qKiBTZXR0aW5ncyDihpIgSW52ZW50b3J5IOKGkiBWYXJpYXRpb25zIG1hc3RlciAoc2VhcmNoYWJsZSBwaWNrcyArIGlubGluZSBtZXJnZSkuICovXHJcbiAgY29uc3QgW3ZhcmlhdGlvbk1hc3Rlciwgc2V0VmFyaWF0aW9uTWFzdGVyXSA9IHVzZVN0YXRlPFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPj4oe30pO1xyXG4gIGNvbnN0IFtwcm9kdWN0c1dpdGhWYXJpYXRpb25zLCBzZXRQcm9kdWN0c1dpdGhWYXJpYXRpb25zXSA9IHVzZVN0YXRlPEFycmF5PHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBza3U6IHN0cmluZzsgdmFyaWF0aW9ucz86IEFycmF5PHsgYXR0cmlidXRlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfT4gfT4+KFtdKTtcclxuICBjb25zdCBbdmFyaWF0aW9uc0ZvckNvcHksIHNldFZhcmlhdGlvbnNGb3JDb3B5XSA9IHVzZVN0YXRlPEFycmF5PHsgcHJvZHVjdElkOiBzdHJpbmc7IHZhcmlhdGlvbklkOiBzdHJpbmc7IHByb2R1Y3Q6IGFueTsgc3VwcGxpZXJOYW1lOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfT4+KFtdKTtcclxuICBjb25zdCBbbG9hZGluZ1Byb2R1Y3RzV2l0aFZhcmlhdGlvbnMsIHNldExvYWRpbmdQcm9kdWN0c1dpdGhWYXJpYXRpb25zXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbY29weUZyb21WYXJpYXRpb25JZCwgc2V0Q29weUZyb21WYXJpYXRpb25JZF0gPSB1c2VTdGF0ZTxzdHJpbmc+KCcnKTtcclxuXHJcbiAgLy8gQ29tYm9zIFN0YXRlXHJcbiAgY29uc3QgW2NvbWJvcywgc2V0Q29tYm9zXSA9IHVzZVN0YXRlPEFycmF5PHtcclxuICAgIGlkOiBzdHJpbmc7XHJcbiAgICBjb21ib19uYW1lOiBzdHJpbmc7XHJcbiAgICBjb21ib19wcmljZTogbnVtYmVyO1xyXG4gICAgaXRlbXM6IEFycmF5PHtcclxuICAgICAgaWQ/OiBzdHJpbmc7XHJcbiAgICAgIHByb2R1Y3RfaWQ6IHN0cmluZztcclxuICAgICAgcHJvZHVjdF9uYW1lPzogc3RyaW5nO1xyXG4gICAgICBwcm9kdWN0X3NrdT86IHN0cmluZztcclxuICAgICAgdmFyaWF0aW9uX2lkPzogc3RyaW5nIHwgbnVsbDtcclxuICAgICAgcXR5OiBudW1iZXI7XHJcbiAgICAgIHVuaXRfcHJpY2U/OiBudW1iZXIgfCBudWxsO1xyXG4gICAgfT47XHJcbiAgfT4+KFtdKTtcclxuICBjb25zdCBbY3VycmVudENvbWJvSXRlbXMsIHNldEN1cnJlbnRDb21ib0l0ZW1zXSA9IHVzZVN0YXRlPEFycmF5PHtcclxuICAgIHByb2R1Y3RfaWQ6IHN0cmluZztcclxuICAgIHByb2R1Y3RfbmFtZTogc3RyaW5nO1xyXG4gICAgcHJvZHVjdF9za3U6IHN0cmluZztcclxuICAgIHZhcmlhdGlvbl9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICBxdHk6IG51bWJlcjtcclxuICAgIHVuaXRfcHJpY2U/OiBudW1iZXIgfCBudWxsO1xyXG4gIH0+PihbXSk7XHJcbiAgY29uc3QgW2NvbWJvTmFtZSwgc2V0Q29tYm9OYW1lXSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbY29tYm9GaW5hbFByaWNlLCBzZXRDb21ib0ZpbmFsUHJpY2VdID0gdXNlU3RhdGUoMCk7XHJcbiAgY29uc3QgW3Byb2R1Y3RTZWFyY2hRdWVyeSwgc2V0UHJvZHVjdFNlYXJjaFF1ZXJ5XSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbc2hvd1Byb2R1Y3REcm9wZG93biwgc2V0U2hvd1Byb2R1Y3REcm9wZG93bl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2F2YWlsYWJsZVByb2R1Y3RzLCBzZXRBdmFpbGFibGVQcm9kdWN0c10gPSB1c2VTdGF0ZTxBcnJheTx7XHJcbiAgICBpZDogc3RyaW5nO1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgc2t1OiBzdHJpbmc7XHJcbiAgICByZXRhaWxfcHJpY2U6IG51bWJlcjtcclxuICAgIGhhc192YXJpYXRpb25zOiBib29sZWFuO1xyXG4gIH0+PihbXSk7XHJcbiAgY29uc3QgW2xvYWRpbmdQcm9kdWN0cywgc2V0TG9hZGluZ1Byb2R1Y3RzXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuXHJcbiAgY29uc3Qge1xyXG4gICAgcmVnaXN0ZXIsXHJcbiAgICBoYW5kbGVTdWJtaXQsXHJcbiAgICBjb250cm9sLFxyXG4gICAgc2V0VmFsdWUsXHJcbiAgICB3YXRjaCxcclxuICAgIGdldFZhbHVlcyxcclxuICAgIGZvcm1TdGF0ZTogeyBlcnJvcnMgfSxcclxuICB9ID0gdXNlRm9ybTxQcm9kdWN0Rm9ybVZhbHVlcz4oe1xyXG4gICAgcmVzb2x2ZXI6IHpvZFJlc29sdmVyKHByb2R1Y3RTY2hlbWEpLFxyXG4gICAgZGVmYXVsdFZhbHVlczoge1xyXG4gICAgICBuYW1lOiBcIlwiLFxyXG4gICAgICBza3U6IFwiXCIsXHJcbiAgICAgIGJhcmNvZGVUeXBlOiBcImNvZGUxMjhcIixcclxuICAgICAgYmFyY29kZTogXCJcIixcclxuICAgICAgc3RvY2tNYW5hZ2VtZW50OiB0cnVlLFxyXG4gICAgICBwdXJjaGFzZVByaWNlOiAwLFxyXG4gICAgICBtYXJnaW46IDMwLFxyXG4gICAgICBzZWxsaW5nUHJpY2U6IDAsXHJcbiAgICAgIHdob2xlc2FsZVByaWNlOiAwLFxyXG4gICAgICByZW50YWxQcmljZTogMCxcclxuICAgICAgc2VjdXJpdHlEZXBvc2l0OiAwLFxyXG4gICAgICByZW50YWxEdXJhdGlvbjogMyxcclxuICAgICAgaW5pdGlhbFN0b2NrOiAwLFxyXG4gICAgICBhbGVydFF0eTogMCxcclxuICAgICAgbWF4U3RvY2s6IDEwMDAsXHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBzdG9ja01hbmFnZW1lbnQgPSB3YXRjaChcInN0b2NrTWFuYWdlbWVudFwiKTtcclxuICBjb25zdCBwdXJjaGFzZVByaWNlID0gd2F0Y2goXCJwdXJjaGFzZVByaWNlXCIpO1xyXG4gIGNvbnN0IG1hcmdpbiA9IHdhdGNoKFwibWFyZ2luXCIpO1xyXG4gIGNvbnN0IHNlbGVjdGVkVW5pdElkID0gd2F0Y2goJ3VuaXQnKTtcclxuICBjb25zdCBzZWxlY3RlZFVuaXRBbGxvd3NEZWNpbWFsID1cclxuICAgIHVuaXRzLmZpbmQoKHUpID0+IHUuaWQgPT09IHNlbGVjdGVkVW5pdElkKT8uYWxsb3dfZGVjaW1hbCA/PyBmYWxzZTtcclxuXHJcbiAgY29uc3QgcGFyc2VWYXJpYXRpb25RdHlJbnB1dCA9IChyYXc6IHN0cmluZyk6IG51bWJlciA9PiB7XHJcbiAgICBpZiAoc2VsZWN0ZWRVbml0QWxsb3dzRGVjaW1hbCkge1xyXG4gICAgICBjb25zdCBuID0gcGFyc2VGbG9hdChyYXcpO1xyXG4gICAgICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKG4pID8gTWF0aC5tYXgoMCwgbikgOiAwO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIE1hdGgubWF4KDAsIHBhcnNlSW50KHJhdywgMTApIHx8IDApO1xyXG4gIH07XHJcblxyXG4gIC8vIExvYWQgb25seSBwYXJlbnQtbGV2ZWwgY2F0ZWdvcmllcyAobm8gc3ViLWNhdGVnb3JpZXMgaW4gdGhpcyBkcm9wZG93bilcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3QgbG9hZENhdGVnb3JpZXMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgIGlmICghY29tcGFueUlkKSByZXR1cm47XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgc2V0TG9hZGluZ0NhdGVnb3JpZXModHJ1ZSk7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHByb2R1Y3RDYXRlZ29yeVNlcnZpY2UuZ2V0Q2F0ZWdvcmllcyhjb21wYW55SWQpO1xyXG4gICAgICAgIHNldENhdGVnb3JpZXMoZGF0YS5tYXAoKGMpID0+ICh7IGlkOiBjLmlkLCBuYW1lOiBjLm5hbWUgfSkpKTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBFcnJvciBsb2FkaW5nIGNhdGVnb3JpZXM6JywgZXJyb3IpO1xyXG4gICAgICAgIHNldENhdGVnb3JpZXMoW10pO1xyXG4gICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgIHNldExvYWRpbmdDYXRlZ29yaWVzKGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIGxvYWRDYXRlZ29yaWVzKCk7XHJcbiAgfSwgW2NvbXBhbnlJZF0pO1xyXG5cclxuICAvLyBMb2FkIGJyYW5kcyBmcm9tIGRhdGFiYXNlXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IGxvYWRCcmFuZHMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgIGlmICghY29tcGFueUlkKSByZXR1cm47XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgc2V0TG9hZGluZ0JyYW5kcyh0cnVlKTtcclxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgYnJhbmRTZXJ2aWNlLmdldEFsbChjb21wYW55SWQpO1xyXG4gICAgICAgIHNldEJyYW5kcyhkYXRhLm1hcCgoYikgPT4gKHsgaWQ6IGIuaWQsIG5hbWU6IGIubmFtZSB9KSkpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEVycm9yIGxvYWRpbmcgYnJhbmRzOicsIGVycm9yKTtcclxuICAgICAgICBzZXRCcmFuZHMoW10pO1xyXG4gICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgIHNldExvYWRpbmdCcmFuZHMoZmFsc2UpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgbG9hZEJyYW5kcygpO1xyXG4gIH0sIFtjb21wYW55SWRdKTtcclxuXHJcbiAgLy8gTG9hZCB1bml0cyBmcm9tIGRhdGFiYXNlIChTZXR0aW5ncyDihpIgSW52ZW50b3J5IOKGkiBVbml0cylcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3QgbG9hZFVuaXRzID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHNldExvYWRpbmdVbml0cyh0cnVlKTtcclxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgdW5pdFNlcnZpY2UuZ2V0QWxsKGNvbXBhbnlJZCk7XHJcbiAgICAgICAgc2V0VW5pdHMoZGF0YS5tYXAoKHUpID0+ICh7IFxyXG4gICAgICAgICAgaWQ6IHUuaWQsIFxyXG4gICAgICAgICAgbmFtZTogdS5uYW1lLCBcclxuICAgICAgICAgIHN5bWJvbDogdS5zeW1ib2wsXHJcbiAgICAgICAgICBzaG9ydF9jb2RlOiB1LnNob3J0X2NvZGUsXHJcbiAgICAgICAgICBpc19kZWZhdWx0OiB1LmlzX2RlZmF1bHQsXHJcbiAgICAgICAgICBhbGxvd19kZWNpbWFsOiB1LmFsbG93X2RlY2ltYWxcclxuICAgICAgICB9KSkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNldCBkZWZhdWx0IHVuaXQgd2hlbiBjcmVhdGluZyAobm90IGVkaXRpbmcpOiB1c2UgU2V0dGluZ3Mg4oaSIEludmVudG9yeSDihpIgRGVmYXVsdCBVbml0LCBlbHNlIHVuaXQgd2l0aCBpc19kZWZhdWx0LCBlbHNlIGZpcnN0XHJcbiAgICAgICAgaWYgKCFpbml0aWFsUHJvZHVjdCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudFVuaXQgPSBnZXRWYWx1ZXMoJ3VuaXQnKTtcclxuICAgICAgICAgIGlmICghY3VycmVudFVuaXQpIHtcclxuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NEZWZhdWx0SWQgPSBzZXR0aW5ncy5pbnZlbnRvcnlTZXR0aW5ncz8uZGVmYXVsdFVuaXRJZDtcclxuICAgICAgICAgICAgY29uc3QgZGVmYXVsdFVuaXQgPSAoc2V0dGluZ3NEZWZhdWx0SWQgJiYgZGF0YS5maW5kKHUgPT4gdS5pZCA9PT0gc2V0dGluZ3NEZWZhdWx0SWQpKVxyXG4gICAgICAgICAgICAgIHx8IGRhdGEuZmluZCh1ID0+IHUuaXNfZGVmYXVsdClcclxuICAgICAgICAgICAgICB8fCBkYXRhWzBdO1xyXG4gICAgICAgICAgICBpZiAoZGVmYXVsdFVuaXQpIHtcclxuICAgICAgICAgICAgICBzZXRWYWx1ZSgndW5pdCcsIGRlZmF1bHRVbml0LmlkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBFcnJvciBsb2FkaW5nIHVuaXRzOicsIGVycm9yKTtcclxuICAgICAgICBzZXRVbml0cyhbXSk7XHJcbiAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgc2V0TG9hZGluZ1VuaXRzKGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIGxvYWRVbml0cygpO1xyXG4gIH0sIFtjb21wYW55SWQsIGluaXRpYWxQcm9kdWN0LCBzZXRWYWx1ZSwgZ2V0VmFsdWVzLCBzZXR0aW5ncy5pbnZlbnRvcnlTZXR0aW5ncz8uZGVmYXVsdFVuaXRJZF0pO1xyXG5cclxuICAvLyBMb2FkIGZ1bGwgdmFyaWF0aW9uIG1hc3RlciB3aGVuZXZlciBjb21wYW55IGlzIGtub3duIChub3QgZ2F0ZWQgb24gZW5hYmxlVmFyaWF0aW9ucyDigJQgYXZvaWRzIGVtcHR5XHJcbiAgLy8gZGF0YWxpc3RzIHVudGlsIHRvZ2dsZTsgZW5zdXJlcyBDT0xPUi9TSVpFL2V0Yy4gbWF0Y2ggU2V0dGluZ3Mg4oaSIEludmVudG9yeSDihpIgVmFyaWF0aW9ucykuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmICghY29tcGFueUlkKSByZXR1cm47XHJcbiAgICAvLyBNZXJnZSBTZXR0aW5ncyDihpIgSW52ZW50b3J5IOKGkiBWYXJpYXRpb25zIG1hc3RlciBXSVRIIHRoZSBnbG9iYWwgbGlicmFyeVxyXG4gICAgLy8gKG5ldyAyMDI2MDUwMCB0YWJsZXMpIHNvIG5ld2x5LWFkZGVkIGF0dHJpYnV0ZXMgYXV0by1hcHBlYXIgaW4gdGhlIHBpY2tlci5cclxuICAgIHZvaWQgKGFzeW5jICgpID0+IHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBbbGVnYWN5LCBsaWJyYXJ5XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcclxuICAgICAgICAgIHZhcmlhdGlvbk1hc3RlclNlcnZpY2UuZ2V0KGNvbXBhbnlJZCkuY2F0Y2goKCkgPT4gKHt9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPikpLFxyXG4gICAgICAgICAgdmFyaWF0aW9uTGlicmFyeVNlcnZpY2UubGlzdEF0dHJpYnV0ZXMoY29tcGFueUlkKS5jYXRjaCgoKSA9PiBbXSksXHJcbiAgICAgICAgXSk7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7IC4uLihsZWdhY3kgfHwge30pIH07XHJcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGxpYnJhcnkpIHtcclxuICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbmV3IFNldCgobWVyZ2VkW2F0dHIubmFtZV0gfHwgW10pLm1hcCgodikgPT4gdi50b0xvd2VyQ2FzZSgpKSk7XHJcbiAgICAgICAgICBjb25zdCBhZGQgPSBhdHRyLnZhbHVlcy5tYXAoKHYpID0+IHYudmFsdWUpLmZpbHRlcigodikgPT4gIWV4aXN0aW5nLmhhcyh2LnRvTG93ZXJDYXNlKCkpKTtcclxuICAgICAgICAgIG1lcmdlZFthdHRyLm5hbWVdID0gWy4uLihtZXJnZWRbYXR0ci5uYW1lXSB8fCBbXSksIC4uLmFkZF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldFZhcmlhdGlvbk1hc3RlcihtZXJnZWQpO1xyXG4gICAgICB9IGNhdGNoIHtcclxuICAgICAgICBzZXRWYXJpYXRpb25NYXN0ZXIoe30pO1xyXG4gICAgICB9XHJcbiAgICB9KSgpO1xyXG4gIH0sIFtjb21wYW55SWRdKTtcclxuXHJcbiAgLy8gTG9hZCBzdXBwbGllcnMgZnJvbSBjb250YWN0cyAodHlwZSA9IHN1cHBsaWVyKVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBsb2FkU3VwcGxpZXJzID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHNldExvYWRpbmdTdXBwbGllcnModHJ1ZSk7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLmdldEFsbENvbnRhY3RzKGNvbXBhbnlJZCwgJ3N1cHBsaWVyJyk7XHJcbiAgICAgICAgc2V0U3VwcGxpZXJzKChkYXRhIHx8IFtdKS5tYXAoKGM6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0pID0+ICh7IGlkOiBjLmlkLCBuYW1lOiBjLm5hbWUgfHwgJ1VubmFtZWQnIH0pKSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3IgbG9hZGluZyBzdXBwbGllcnM6JywgZXJyb3IpO1xyXG4gICAgICAgIHNldFN1cHBsaWVycyhbXSk7XHJcbiAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgc2V0TG9hZGluZ1N1cHBsaWVycyhmYWxzZSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBsb2FkU3VwcGxpZXJzKCk7XHJcbiAgfSwgW2NvbXBhbnlJZF0pO1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFjb21wYW55SWQpIHJldHVybjtcclxuICAgIHZvaWQgYnJhbmNoU2VydmljZS5nZXRCcmFuY2hlc0NhY2hlZChjb21wYW55SWQpLnRoZW4oKGJyYW5jaGVzKSA9PiB7XHJcbiAgICAgIGNvbnN0IGxpc3QgPSAoYnJhbmNoZXMgfHwgW10pLm1hcCgoYjogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfSkgPT4gKHsgaWQ6IGIuaWQsIG5hbWU6IGIubmFtZSB9KSk7XHJcbiAgICAgIHNldENvbXBhbnlCcmFuY2hlcyhsaXN0KTtcclxuICAgICAgY29uc3QgcHJvZHVjdElkID0gaW5pdGlhbFByb2R1Y3Q/LnV1aWQgPz8gaW5pdGlhbFByb2R1Y3Q/LmlkO1xyXG4gICAgICBpZiAobGlzdC5sZW5ndGggPiAxICYmICFwcm9kdWN0SWQpIHtcclxuICAgICAgICBzZXRTZWxlY3RlZEJyYW5jaElkcyhsaXN0Lm1hcCgoYikgPT4gYi5pZCkpO1xyXG4gICAgICB9XHJcbiAgICB9KS5jYXRjaCgoKSA9PiBzZXRDb21wYW55QnJhbmNoZXMoW10pKTtcclxuICB9LCBbY29tcGFueUlkLCBpbml0aWFsUHJvZHVjdD8udXVpZCwgaW5pdGlhbFByb2R1Y3Q/LmlkXSk7XHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBwcm9kdWN0SWQgPSBpbml0aWFsUHJvZHVjdD8udXVpZCA/PyBpbml0aWFsUHJvZHVjdD8uaWQ7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCB8fCAhcHJvZHVjdElkIHx8IGNvbXBhbnlCcmFuY2hlcy5sZW5ndGggPD0gMSkgcmV0dXJuO1xyXG4gICAgdm9pZCBwcm9kdWN0U2VydmljZS5nZXRQcm9kdWN0QnJhbmNoSWRzKGNvbXBhbnlJZCwgcHJvZHVjdElkKS50aGVuKChpZHMpID0+IHtcclxuICAgICAgaWYgKGlkcy5sZW5ndGggPiAwKSBzZXRTZWxlY3RlZEJyYW5jaElkcyhpZHMpO1xyXG4gICAgICBlbHNlIHNldFNlbGVjdGVkQnJhbmNoSWRzKGNvbXBhbnlCcmFuY2hlcy5tYXAoKGIpID0+IGIuaWQpKTtcclxuICAgIH0pLmNhdGNoKCgpID0+IHt9KTtcclxuICB9LCBbY29tcGFueUlkLCBpbml0aWFsUHJvZHVjdD8udXVpZCwgaW5pdGlhbFByb2R1Y3Q/LmlkLCBjb21wYW55QnJhbmNoZXNdKTtcclxuXHJcbiAgLy8gTG9hZCB2YXJpYXRpb25zIGZvciBcImNvcHkgZnJvbVwiIOKAkyBmb3JtYXQ6IFN1cHBsaWVyIOKAlCBBdHRyaWJ1dGVOYW1lOiBWYWx1ZSAoZS5nLiB2YXJpYW50OiBTaXplOiBMLCBTVVBMSUVSOiBJYnJhaGltKVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCB8fCBhY3RpdmVUYWIgIT09ICd2YXJpYXRpb25zJyB8fCAhZW5hYmxlVmFyaWF0aW9ucykgcmV0dXJuO1xyXG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlO1xyXG4gICAgc2V0TG9hZGluZ1Byb2R1Y3RzV2l0aFZhcmlhdGlvbnModHJ1ZSk7XHJcbiAgICBwcm9kdWN0U2VydmljZS5nZXRBbGxQcm9kdWN0cyhjb21wYW55SWQpXHJcbiAgICAgIC50aGVuKChkYXRhOiBhbnkpID0+IHtcclxuICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm47XHJcbiAgICAgICAgY29uc3Qgd2l0aFZhcnMgPSAoZGF0YSB8fCBbXSkuZmlsdGVyKFxyXG4gICAgICAgICAgKHA6IGFueSkgPT4gcC5oYXNfdmFyaWF0aW9ucyAmJiBBcnJheS5pc0FycmF5KHAudmFyaWF0aW9ucykgJiYgcC52YXJpYXRpb25zLmxlbmd0aCA+IDBcclxuICAgICAgICApO1xyXG4gICAgICAgIHNldFByb2R1Y3RzV2l0aFZhcmlhdGlvbnMoXHJcbiAgICAgICAgICB3aXRoVmFycy5tYXAoKHA6IGFueSkgPT4gKHtcclxuICAgICAgICAgICAgaWQ6IHAuaWQsXHJcbiAgICAgICAgICAgIG5hbWU6IHAubmFtZSB8fCAnVW5uYW1lZCcsXHJcbiAgICAgICAgICAgIHNrdTogcC5za3UgfHwgJycsXHJcbiAgICAgICAgICAgIHZhcmlhdGlvbnM6IHAudmFyaWF0aW9ucyB8fCBbXSxcclxuICAgICAgICAgIH0pKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgZmxhdDogQXJyYXk8eyBwcm9kdWN0SWQ6IHN0cmluZzsgdmFyaWF0aW9uSWQ6IHN0cmluZzsgcHJvZHVjdDogYW55OyBzdXBwbGllck5hbWU6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9PiA9IFtdO1xyXG4gICAgICAgIGZvciAoY29uc3QgcCBvZiB3aXRoVmFycykge1xyXG4gICAgICAgICAgY29uc3Qgc3VwcGxpZXJJZCA9IChwIGFzIGFueSkuc3VwcGxpZXJfaWQgfHwgKHAgYXMgYW55KS5zdXBwbGllcjtcclxuICAgICAgICAgIGNvbnN0IHN1cHBsaWVyTmFtZSA9IHN1cHBsaWVycy5maW5kKChzKSA9PiBzLmlkID09PSBzdXBwbGllcklkKT8ubmFtZSA/PyAn4oCUJztcclxuICAgICAgICAgIChwLnZhcmlhdGlvbnMgfHwgW10pLmZvckVhY2goKHY6IGFueSwgaWR4OiBudW1iZXIpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgYXR0cnMgPSB2LmF0dHJpYnV0ZXMgJiYgdHlwZW9mIHYuYXR0cmlidXRlcyA9PT0gJ29iamVjdCcgPyB2LmF0dHJpYnV0ZXMgOiB7fTtcclxuICAgICAgICAgICAgZm9yIChjb25zdCBbYXR0ck5hbWUsIHZhbF0gb2YgT2JqZWN0LmVudHJpZXMoYXR0cnMpKSB7XHJcbiAgICAgICAgICAgICAgaWYgKCFhdHRyTmFtZSB8fCB2YWwgPT0gbnVsbCkgY29udGludWU7XHJcbiAgICAgICAgICAgICAgY29uc3QgbGFiZWwgPSBgJHthdHRyTmFtZX06ICR7dmFsfWA7XHJcbiAgICAgICAgICAgICAgZmxhdC5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHByb2R1Y3RJZDogcC5pZCxcclxuICAgICAgICAgICAgICAgIHZhcmlhdGlvbklkOiBgJHtwLmlkfS0ke2lkeH0tJHthdHRyTmFtZX0tJHtTdHJpbmcodmFsKS5yZXBsYWNlKC9cXHMvZywgJ18nKX1gLFxyXG4gICAgICAgICAgICAgICAgcHJvZHVjdDogcCxcclxuICAgICAgICAgICAgICAgIHN1cHBsaWVyTmFtZSxcclxuICAgICAgICAgICAgICAgIGxhYmVsLFxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc2V0VmFyaWF0aW9uc0ZvckNvcHkoZmxhdCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaCgoKSA9PiB7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldFByb2R1Y3RzV2l0aFZhcmlhdGlvbnMoW10pO1xyXG4gICAgICAgIGlmICghY2FuY2VsbGVkKSBzZXRWYXJpYXRpb25zRm9yQ29weShbXSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5maW5hbGx5KCgpID0+IHtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0TG9hZGluZ1Byb2R1Y3RzV2l0aFZhcmlhdGlvbnMoZmFsc2UpO1xyXG4gICAgICB9KTtcclxuICAgIHJldHVybiAoKSA9PiB7IGNhbmNlbGxlZCA9IHRydWU7IH07XHJcbiAgfSwgW2NvbXBhbnlJZCwgYWN0aXZlVGFiLCBlbmFibGVWYXJpYXRpb25zLCBzdXBwbGllcnNdKTtcclxuXHJcbiAgY29uc3Qgc2VsZWN0ZWRDYXRlZ29yeUlkID0gd2F0Y2goJ2NhdGVnb3J5Jyk7XHJcblxyXG4gIC8vIExvYWQgc3ViLWNhdGVnb3JpZXMgb25seSB3aGVuIGEgY2F0ZWdvcnkgaXMgc2VsZWN0ZWQgKGZpbHRlcmVkIGJ5IGNhdGVnb3J5KVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCB8fCAhc2VsZWN0ZWRDYXRlZ29yeUlkKSB7XHJcbiAgICAgIHNldFN1YkNhdGVnb3JpZXMoW10pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBsb2FkU3ViQ2F0ZWdvcmllcyA9IGFzeW5jICgpID0+IHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcHJvZHVjdENhdGVnb3J5U2VydmljZS5nZXRTdWJDYXRlZ29yaWVzKGNvbXBhbnlJZCwgc2VsZWN0ZWRDYXRlZ29yeUlkKTtcclxuICAgICAgICBzZXRTdWJDYXRlZ29yaWVzKGRhdGEubWFwKChjKSA9PiAoeyBpZDogYy5pZCwgbmFtZTogYy5uYW1lIH0pKSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3IgbG9hZGluZyBzdWItY2F0ZWdvcmllczonLCBlcnJvcik7XHJcbiAgICAgICAgc2V0U3ViQ2F0ZWdvcmllcyhbXSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBsb2FkU3ViQ2F0ZWdvcmllcygpO1xyXG4gIH0sIFtjb21wYW55SWQsIHNlbGVjdGVkQ2F0ZWdvcnlJZF0pO1xyXG5cclxuICAvLyBQUkQtMDAwMSBzdHlsZSBmcm9tIFNldHRpbmdzIOKGkiBOdW1iZXJpbmcgKG11c3QgYmUgZGVmaW5lZCBiZWZvcmUgZWZmZWN0IHRoYXQgdXNlcyBpdClcclxuICBjb25zdCBnZW5lcmF0ZVNLVSA9IHVzZUNhbGxiYWNrKCgpID0+IHtcclxuICAgIGNvbnN0IG4gPSBnZW5lcmF0ZURvY3VtZW50TnVtYmVyKCdwcm9kdWN0aW9uJyk7XHJcbiAgICByZXR1cm4gKG4gJiYgU3RyaW5nKG4pLnRyaW0oKSkgPyBuIDogJ1BSRC0wMDAxJztcclxuICB9LCBbZ2VuZXJhdGVEb2N1bWVudE51bWJlcl0pO1xyXG5cclxuICAvLyBBdXRvLWdlbmVyYXRlIHVuaXF1ZSBTS1UgZm9yIG5ldyBwcm9kdWN0IG9ubHkgKGNvbGxpc2lvbi1zYWZlIHZpYSBEQiBjaGVjaylcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGluaXRpYWxQcm9kdWN0IHx8ICFjb21wYW55SWQpIHJldHVybjtcclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcclxuICAgIChhc3luYyAoKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgbmV4dFNLVSA9IGF3YWl0IGdlbmVyYXRlRG9jdW1lbnROdW1iZXJTYWZlKCdwcm9kdWN0aW9uJyk7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQgJiYgbmV4dFNLVSkgc2V0VmFsdWUoJ3NrdScsIG5leHRTS1UpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldFZhbHVlKCdza3UnLCBnZW5lcmF0ZVNLVSgpKTtcclxuICAgICAgfVxyXG4gICAgfSkoKTtcclxuICAgIHJldHVybiAoKSA9PiB7IGNhbmNlbGxlZCA9IHRydWU7IH07XHJcbiAgfSwgW2NvbXBhbnlJZCwgaW5pdGlhbFByb2R1Y3QsIHNldFZhbHVlLCBnZW5lcmF0ZURvY3VtZW50TnVtYmVyU2FmZSwgZ2VuZXJhdGVTS1VdKTtcclxuXHJcbiAgLy8gRWRpdCBtb2RlOiBmZXRjaCBmdWxsIHByb2R1Y3QgYnkgaWQgc28gd2UgaGF2ZSB2YXJpYXRpb25zLCBjYXRlZ29yeV9pZCwgdW5pdF9pZCwgYnJhbmRfaWQgKGxpc3QgcHJvZHVjdCBvZnRlbiBoYXMgb25seSBkaXNwbGF5IGZpZWxkcylcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3QgcHJvZHVjdElkID0gaW5pdGlhbFByb2R1Y3Q/LnV1aWQgfHwgaW5pdGlhbFByb2R1Y3Q/LmlkO1xyXG4gICAgaWYgKCFwcm9kdWN0SWQgfHwgdHlwZW9mIHByb2R1Y3RJZCAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgc2V0RnVsbFByb2R1Y3RGb3JFZGl0KG51bGwpO1xyXG4gICAgICBzZXRMb2FkaW5nRnVsbFByb2R1Y3QoZmFsc2UpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XHJcbiAgICBzZXRMb2FkaW5nRnVsbFByb2R1Y3QodHJ1ZSk7XHJcbiAgICBzZXRGdWxsUHJvZHVjdEZvckVkaXQobnVsbCk7XHJcbiAgICBwcm9kdWN0U2VydmljZS5nZXRQcm9kdWN0KHByb2R1Y3RJZClcclxuICAgICAgLnRoZW4oKGZ1bGwpID0+IHtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkge1xyXG4gICAgICAgICAgc2V0RnVsbFByb2R1Y3RGb3JFZGl0KGZ1bGwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRmFpbGVkIHRvIGxvYWQgZnVsbCBwcm9kdWN0IGZvciBlZGl0OicsIGVycik7XHJcbiAgICAgICAgICBzZXRGdWxsUHJvZHVjdEZvckVkaXQobnVsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgICAuZmluYWxseSgoKSA9PiB7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldExvYWRpbmdGdWxsUHJvZHVjdChmYWxzZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgcmV0dXJuICgpID0+IHsgY2FuY2VsbGVkID0gdHJ1ZTsgfTtcclxuICB9LCBbaW5pdGlhbFByb2R1Y3Q/LnV1aWQsIGluaXRpYWxQcm9kdWN0Py5pZF0pO1xyXG5cclxuICAvLyBTeW5jIGVuYWJsZVZhcmlhdGlvbnMgZnJvbSBwcm9kdWN0ICh1c2UgZnVsbCBwcm9kdWN0IHdoZW4gYXZhaWxhYmxlKVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBzb3VyY2UgPSBmdWxsUHJvZHVjdEZvckVkaXQgPz8gaW5pdGlhbFByb2R1Y3Q7XHJcbiAgICBpZiAoc291cmNlKSB7XHJcbiAgICAgIHNldEVuYWJsZVZhcmlhdGlvbnMoISEoc291cmNlLmhhc192YXJpYXRpb25zID8/IChzb3VyY2UudmFyaWF0aW9ucz8ubGVuZ3RoID4gMCkpKTtcclxuICAgIH0gZWxzZSBpZiAoIWluaXRpYWxQcm9kdWN0KSB7XHJcbiAgICAgIHNldEVuYWJsZVZhcmlhdGlvbnMoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH0sIFtpbml0aWFsUHJvZHVjdCwgZnVsbFByb2R1Y3RGb3JFZGl0XSk7XHJcblxyXG4gIC8vIFByZS1wb3B1bGF0ZSBmb3JtIHdoZW4gZWRpdGluZyDigJMgdXNlIGZ1bGwgcHJvZHVjdCBmcm9tIEFQSSB3aGVuIGF2YWlsYWJsZSBzbyBhbGwgZmllbGRzICsgdmFyaWF0aW9ucyBoeWRyYXRlXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcclxuICAgIGNvbnN0IHNvdXJjZSA9IGZ1bGxQcm9kdWN0Rm9yRWRpdCA/PyBpbml0aWFsUHJvZHVjdDtcclxuICAgIGlmIChzb3VyY2UpIHtcclxuICAgICAgc2V0VmFsdWUoJ25hbWUnLCBzb3VyY2UubmFtZSB8fCAnJyk7XHJcbiAgICAgIHNldFZhbHVlKCdza3UnLCBzb3VyY2Uuc2t1IHx8ICcnKTtcclxuICAgICAgc2V0VmFsdWUoJ2JhcmNvZGVUeXBlJywgKHNvdXJjZSBhcyBhbnkpLmJhcmNvZGVfdHlwZSB8fCAnY29kZTEyOCcpO1xyXG4gICAgICBzZXRWYWx1ZSgnYmFyY29kZScsIHNvdXJjZS5iYXJjb2RlIHx8ICcnKTtcclxuICAgICAgc2V0VmFsdWUoJ3B1cmNoYXNlUHJpY2UnLCBzb3VyY2UuY29zdF9wcmljZSA/PyAoc291cmNlIGFzIGFueSkucHVyY2hhc2VQcmljZSA/PyAwKTtcclxuICAgICAgc2V0VmFsdWUoJ3NlbGxpbmdQcmljZScsIHNvdXJjZS5yZXRhaWxfcHJpY2UgPz8gKHNvdXJjZSBhcyBhbnkpLnNlbGxpbmdQcmljZSA/PyAwKTtcclxuICAgICAgc2V0VmFsdWUoJ3dob2xlc2FsZVByaWNlJywgc291cmNlLndob2xlc2FsZV9wcmljZSA/PyBzb3VyY2UucmV0YWlsX3ByaWNlID8/IDApO1xyXG4gICAgICBzZXRWYWx1ZSgncmVudGFsUHJpY2UnLCBzb3VyY2UucmVudGFsX3ByaWNlX2RhaWx5ID8/IDApO1xyXG4gICAgICBzZXRWYWx1ZSgnYWxlcnRRdHknLCBzb3VyY2UubWluX3N0b2NrID8/IChzb3VyY2UgYXMgYW55KS5sb3dTdG9ja1RocmVzaG9sZCA/PyAwKTtcclxuICAgICAgc2V0VmFsdWUoJ21heFN0b2NrJywgc291cmNlLm1heF9zdG9jayA/PyAxMDAwKTtcclxuICAgICAgc2V0VmFsdWUoJ2Rlc2NyaXB0aW9uJywgc291cmNlLmRlc2NyaXB0aW9uIHx8ICcnKTtcclxuICAgICAgc2V0VmFsdWUoJ2JyYW5kJywgc291cmNlLmJyYW5kX2lkIHx8ICcnKTtcclxuICAgICAgc2V0VmFsdWUoJ3VuaXQnLCBzb3VyY2UudW5pdF9pZCB8fCAnJyk7XHJcbiAgICAgIHNldFZhbHVlKCdzdXBwbGllcicsIChzb3VyY2UgYXMgYW55KS5zdXBwbGllcl9pZCB8fCAoc291cmNlIGFzIGFueSkuc3VwcGxpZXIgfHwgJycpO1xyXG4gICAgICBzZXRWYWx1ZSgnc3VwcGxpZXJDb2RlJywgKHNvdXJjZSBhcyBhbnkpLnN1cHBsaWVyX2NvZGUgfHwgKHNvdXJjZSBhcyBhbnkpLnN1cHBsaWVyQ29kZSB8fCAnJyk7XHJcbiAgICAgIGNvbnN0IGNhdElkID0gc291cmNlLmNhdGVnb3J5X2lkIHx8IHNvdXJjZS5jYXRlZ29yeT8uaWQgfHwgJyc7XHJcbiAgICAgIGlmIChjYXRJZCkge1xyXG4gICAgICAgIHByb2R1Y3RDYXRlZ29yeVNlcnZpY2UuZ2V0QnlJZChjYXRJZCkudGhlbigoY2F0KSA9PiB7XHJcbiAgICAgICAgICBpZiAoY2F0LnBhcmVudF9pZCkge1xyXG4gICAgICAgICAgICBzZXRWYWx1ZSgnY2F0ZWdvcnknLCBjYXQucGFyZW50X2lkKTtcclxuICAgICAgICAgICAgc2V0VmFsdWUoJ3N1YkNhdGVnb3J5JywgY2F0LmlkKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNldFZhbHVlKCdjYXRlZ29yeScsIGNhdC5pZCk7XHJcbiAgICAgICAgICAgIHNldFZhbHVlKCdzdWJDYXRlZ29yeScsICcnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XHJcbiAgICAgICAgICBzZXRWYWx1ZSgnY2F0ZWdvcnknLCBjYXRJZCk7XHJcbiAgICAgICAgICBzZXRWYWx1ZSgnc3ViQ2F0ZWdvcnknLCAnJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2V0VmFsdWUoJ2NhdGVnb3J5JywgJycpO1xyXG4gICAgICAgIHNldFZhbHVlKCdzdWJDYXRlZ29yeScsICcnKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoc291cmNlLnZhcmlhdGlvbnMgJiYgQXJyYXkuaXNBcnJheShzb3VyY2UudmFyaWF0aW9ucykgJiYgc291cmNlLnZhcmlhdGlvbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGZpcnN0UGFyc2VkID0gcHVibGljVmFyaWF0aW9uQXR0cmlidXRlcyhcclxuICAgICAgICAgIHBhcnNlVmFyaWF0aW9uQXR0cmlidXRlc1Jhdyhzb3VyY2UudmFyaWF0aW9uc1swXT8uYXR0cmlidXRlcylcclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGF0dHJOYW1lcyA9IE9iamVjdC5rZXlzKGZpcnN0UGFyc2VkKS5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xyXG4gICAgICAgIGlmIChhdHRyTmFtZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgY29uc3QgdmFsdWVzQnlBdHRyOiBSZWNvcmQ8c3RyaW5nLCBTZXQ8c3RyaW5nPj4gPSB7fTtcclxuICAgICAgICAgIGF0dHJOYW1lcy5mb3JFYWNoKChrKSA9PiB7XHJcbiAgICAgICAgICAgIHZhbHVlc0J5QXR0cltrXSA9IG5ldyBTZXQoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgc291cmNlLnZhcmlhdGlvbnMuZm9yRWFjaCgodjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGEgPSBwdWJsaWNWYXJpYXRpb25BdHRyaWJ1dGVzKHBhcnNlVmFyaWF0aW9uQXR0cmlidXRlc1Jhdyh2LmF0dHJpYnV0ZXMpKTtcclxuICAgICAgICAgICAgYXR0ck5hbWVzLmZvckVhY2goKGspID0+IHtcclxuICAgICAgICAgICAgICBpZiAoYVtrXSAhPSBudWxsICYmIGFba10gIT09ICcnKSB2YWx1ZXNCeUF0dHJba10uYWRkKFN0cmluZyhhW2tdKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBzZXRWYXJpYW50QXR0cmlidXRlcyhcclxuICAgICAgICAgICAgYXR0ck5hbWVzLm1hcCgobmFtZSkgPT4gKHtcclxuICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgIHZhbHVlczogQXJyYXkuZnJvbSh2YWx1ZXNCeUF0dHJbbmFtZV0gfHwgW10pLnNvcnQoKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSksXHJcbiAgICAgICAgICAgIH0pKVxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgc2V0VmFyaWFudEF0dHJpYnV0ZXMoW10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBtYXBwZWQgPSAoc291cmNlLnZhcmlhdGlvbnMgYXMgYW55W10pLm1hcCgodikgPT5cclxuICAgICAgICAgIG1hcFByb2R1Y3RWYXJpYXRpb25BcGlUb0Zvcm1Sb3codiBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilcclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IHBpZCA9IChzb3VyY2UgYXMgYW55KS51dWlkIHx8IChzb3VyY2UgYXMgYW55KS5pZDtcclxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgaWYgKGNvbXBhbnlJZCAmJiBwaWQgJiYgbWFwcGVkLnNvbWUoKG0pID0+IG0uaWQpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJyYW5jaFNjb3BlID0gYnJhbmNoSWQgJiYgYnJhbmNoSWQgIT09ICdhbGwnID8gYnJhbmNoSWQgOiBudWxsO1xyXG4gICAgICAgICAgICBjb25zdCB3aXRoTW92ZW1lbnQgPSBhd2FpdCBQcm9taXNlLmFsbChcclxuICAgICAgICAgICAgICBtYXBwZWQubWFwKGFzeW5jIChyb3cpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICghcm93LmlkKSByZXR1cm4gcm93O1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgcXR5ID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5nZXRTdG9jayhjb21wYW55SWQsIHBpZCBhcyBzdHJpbmcsIHJvdy5pZCwgYnJhbmNoU2NvcGUpO1xyXG4gICAgICAgICAgICAgICAgICByZXR1cm4geyAuLi5yb3csIHN0b2NrOiBxdHkgfTtcclxuICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gcm93O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIGlmICghY2FuY2VsbGVkKSBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKHdpdGhNb3ZlbWVudCk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKCFjYW5jZWxsZWQpIHtcclxuICAgICAgICAgICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyhtYXBwZWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyhbXSk7XHJcbiAgICAgICAgc2V0VmFyaWFudEF0dHJpYnV0ZXMoW10pO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHVybHMgPSAoc291cmNlIGFzIGFueSk/LmltYWdlX3VybHM7XHJcbiAgICAgIHNldEV4aXN0aW5nSW1hZ2VVcmxzKEFycmF5LmlzQXJyYXkodXJscykgPyBbLi4udXJsc10gOiBbXSk7XHJcbiAgICAgIGlmIChzb3VyY2UuaXNfY29tYm9fcHJvZHVjdCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgc2V0SXNDb21ib1Byb2R1Y3QoISFzb3VyY2UuaXNfY29tYm9fcHJvZHVjdCk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgcHJvZHVjdElkID0gc291cmNlLnV1aWQgfHwgc291cmNlLmlkO1xyXG4gICAgICBpZiAocHJvZHVjdElkKSBsb2FkUHJvZHVjdENvbWJvcyhwcm9kdWN0SWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc2V0RXhpc3RpbmdJbWFnZVVybHMoW10pO1xyXG4gICAgICBzZXRJc0NvbWJvUHJvZHVjdChmYWxzZSk7XHJcbiAgICAgIHNldEZ1bGxQcm9kdWN0Rm9yRWRpdChudWxsKTtcclxuICAgICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyhbXSk7XHJcbiAgICAgIHNldFZhcmlhbnRBdHRyaWJ1dGVzKFtdKTtcclxuICAgIH1cclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNhbmNlbGxlZCA9IHRydWU7XHJcbiAgICB9O1xyXG4gIH0sIFtmdWxsUHJvZHVjdEZvckVkaXQsIGluaXRpYWxQcm9kdWN0LCBzZXRWYWx1ZSwgY29tcGFueUlkLCBicmFuY2hJZF0pO1xyXG5cclxuICAvKiogTW92ZW1lbnQtYmFzZWQgc3RvY2sgZm9yIGVkaXQgKHByb2R1Y3RzLmN1cnJlbnRfc3RvY2sgaXMgbm90IHNlbGVjdGVkIGluIGdldFByb2R1Y3QpLiAqL1xyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBzb3VyY2UgPSBmdWxsUHJvZHVjdEZvckVkaXQgPz8gaW5pdGlhbFByb2R1Y3Q7XHJcbiAgICBjb25zdCBwaWQgPSBzb3VyY2U/LnV1aWQgfHwgc291cmNlPy5pZDtcclxuICAgIGlmICghY29tcGFueUlkIHx8ICFwaWQgfHwgdHlwZW9mIHBpZCAhPT0gJ3N0cmluZycpIHJldHVybjtcclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcclxuICAgIGNvbnN0IGhhc1ZhciA9ICEhKHNvdXJjZT8uaGFzX3ZhcmlhdGlvbnMgPz8gKHNvdXJjZT8udmFyaWF0aW9ucyAmJiBzb3VyY2UudmFyaWF0aW9ucy5sZW5ndGggPiAwKSk7XHJcbiAgICBjb25zdCBicmFuY2hTY29wZSA9IGJyYW5jaElkICYmIGJyYW5jaElkICE9PSAnYWxsJyA/IGJyYW5jaElkIDogbnVsbDtcclxuICAgIGlmIChoYXNWYXIgfHwgKHNvdXJjZSBhcyBhbnkpPy5pc19jb21ib19wcm9kdWN0KSB7XHJcbiAgICAgIHNldFZhbHVlKCdpbml0aWFsU3RvY2snLCAwLCB7IHNob3VsZFZhbGlkYXRlOiBmYWxzZSwgc2hvdWxkRGlydHk6IGZhbHNlIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHF0eSA9IGF3YWl0IGludmVudG9yeVNlcnZpY2UuZ2V0U3RvY2soY29tcGFueUlkLCBwaWQsIG51bGwsIGJyYW5jaFNjb3BlKTtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0VmFsdWUoJ2luaXRpYWxTdG9jaycsIE1hdGgucm91bmQocXR5ICogMTAwKSAvIDEwMCwgeyBzaG91bGRWYWxpZGF0ZTogZmFsc2UsIHNob3VsZERpcnR5OiBmYWxzZSB9KTtcclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgY29uc3QgZmFsbGJhY2sgPSBOdW1iZXIoKHNvdXJjZSBhcyBhbnkpPy5zdG9jayA/PyAoc291cmNlIGFzIGFueSk/LmN1cnJlbnRfc3RvY2sgPz8gMCkgfHwgMDtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0VmFsdWUoJ2luaXRpYWxTdG9jaycsIGZhbGxiYWNrLCB7IHNob3VsZFZhbGlkYXRlOiBmYWxzZSwgc2hvdWxkRGlydHk6IGZhbHNlIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KSgpO1xyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgY2FuY2VsbGVkID0gdHJ1ZTtcclxuICAgIH07XHJcbiAgfSwgW2Z1bGxQcm9kdWN0Rm9yRWRpdCwgaW5pdGlhbFByb2R1Y3QsIGNvbXBhbnlJZCwgYnJhbmNoSWQsIHNldFZhbHVlXSk7XHJcblxyXG4gIC8vIExvYWQgYXZhaWxhYmxlIHByb2R1Y3RzIGZvciBjb21ibyBzZWFyY2ggKGV4Y2x1ZGUgY29tYm8gcHJvZHVjdHMgYW5kIGN1cnJlbnQgcHJvZHVjdClcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKG1vZHVsZXMuY29tYm9zRW5hYmxlZCAmJiBpc0NvbWJvUHJvZHVjdCAmJiBjb21wYW55SWQpIHtcclxuICAgICAgbG9hZEF2YWlsYWJsZVByb2R1Y3RzKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzZXRBdmFpbGFibGVQcm9kdWN0cyhbXSk7XHJcbiAgICB9XHJcbiAgfSwgW21vZHVsZXMuY29tYm9zRW5hYmxlZCwgaXNDb21ib1Byb2R1Y3QsIGNvbXBhbnlJZF0pO1xyXG5cclxuICAvLyBMb2FkIGF2YWlsYWJsZSBwcm9kdWN0cyBmb3IgY29tYm8gKG5vbi1jb21ibyBwcm9kdWN0cyBvbmx5KVxyXG4gIGNvbnN0IGxvYWRBdmFpbGFibGVQcm9kdWN0cyA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY29tcGFueUlkKSByZXR1cm47XHJcbiAgICBzZXRMb2FkaW5nUHJvZHVjdHModHJ1ZSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBjdXJyZW50UHJvZHVjdElkID0gaW5pdGlhbFByb2R1Y3Q/LnV1aWQgfHwgaW5pdGlhbFByb2R1Y3Q/LmlkO1xyXG4gICAgICBjb25zdCBpc1ZhbGlkVXVpZCA9IHR5cGVvZiBjdXJyZW50UHJvZHVjdElkID09PSAnc3RyaW5nJyAmJiBjdXJyZW50UHJvZHVjdElkLmxlbmd0aCA9PT0gMzYgJiYgL15bMC05YS1mLV17MzZ9JC9pLnRlc3QoY3VycmVudFByb2R1Y3RJZCk7XHJcbiAgICAgIGxldCBxdWVyeSA9IHN1cGFiYXNlXHJcbiAgICAgICAgLmZyb20oJ3Byb2R1Y3RzJylcclxuICAgICAgICAuc2VsZWN0KCdpZCwgbmFtZSwgc2t1LCByZXRhaWxfcHJpY2UsIGhhc192YXJpYXRpb25zJylcclxuICAgICAgICAuZXEoJ2NvbXBhbnlfaWQnLCBjb21wYW55SWQpXHJcbiAgICAgICAgLmVxKCdpc19hY3RpdmUnLCB0cnVlKVxyXG4gICAgICAgIC5lcSgnaXNfY29tYm9fcHJvZHVjdCcsIGZhbHNlKTsgLy8gRXhjbHVkZSBjb21ibyBwcm9kdWN0c1xyXG4gICAgICBpZiAoaXNWYWxpZFV1aWQpIHtcclxuICAgICAgICBxdWVyeSA9IHF1ZXJ5Lm5lcSgnaWQnLCBjdXJyZW50UHJvZHVjdElkKTsgLy8gRXhjbHVkZSBjdXJyZW50IHByb2R1Y3Qgb25seSB3aGVuIGlkIGlzIGEgdmFsaWQgVVVJRFxyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHsgZGF0YSwgZXJyb3IgfSA9IGF3YWl0IHF1ZXJ5Lm9yZGVyKCduYW1lJyk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICBzZXRBdmFpbGFibGVQcm9kdWN0cyhkYXRhIHx8IFtdKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3IgbG9hZGluZyBwcm9kdWN0cyBmb3IgY29tYm86JywgZXJyb3IpO1xyXG4gICAgICB0b2FzdC5lcnJvcignRmFpbGVkIHRvIGxvYWQgcHJvZHVjdHMnKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldExvYWRpbmdQcm9kdWN0cyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gTG9hZCBleGlzdGluZyBjb21ib3MgZm9yIHByb2R1Y3RcclxuICBjb25zdCBsb2FkUHJvZHVjdENvbWJvcyA9IGFzeW5jIChwcm9kdWN0SWQ6IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKCFjb21wYW55SWQgfHwgIXByb2R1Y3RJZCkgcmV0dXJuO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY29tYm8gPSBhd2FpdCBjb21ib1NlcnZpY2UuZ2V0Q29tYm9CeVByb2R1Y3RJZChwcm9kdWN0SWQsIGNvbXBhbnlJZCk7XHJcbiAgICAgIGlmIChjb21ibykge1xyXG4gICAgICAgIC8vIExvYWQgaXRlbXMgd2l0aCBwcm9kdWN0IGRldGFpbHNcclxuICAgICAgICBjb25zdCBpdGVtc1dpdGhEZXRhaWxzID0gYXdhaXQgY29tYm9TZXJ2aWNlLmdldENvbWJvSXRlbXNXaXRoRGV0YWlscyhjb21iby5pZCwgY29tcGFueUlkKTtcclxuICAgICAgICBzZXRDb21ib3MoW3tcclxuICAgICAgICAgIGlkOiBjb21iby5pZCxcclxuICAgICAgICAgIGNvbWJvX25hbWU6IGNvbWJvLmNvbWJvX25hbWUsXHJcbiAgICAgICAgICBjb21ib19wcmljZTogY29tYm8uY29tYm9fcHJpY2UsXHJcbiAgICAgICAgICBpdGVtczogaXRlbXNXaXRoRGV0YWlscy5tYXAoaXRlbSA9PiAoe1xyXG4gICAgICAgICAgICBpZDogaXRlbS5pZCxcclxuICAgICAgICAgICAgcHJvZHVjdF9pZDogaXRlbS5wcm9kdWN0X2lkLFxyXG4gICAgICAgICAgICBwcm9kdWN0X25hbWU6IGl0ZW0ucHJvZHVjdF9uYW1lLFxyXG4gICAgICAgICAgICBwcm9kdWN0X3NrdTogaXRlbS5wcm9kdWN0X3NrdSxcclxuICAgICAgICAgICAgdmFyaWF0aW9uX2lkOiBpdGVtLnZhcmlhdGlvbl9pZCxcclxuICAgICAgICAgICAgcXR5OiBpdGVtLnF0eSxcclxuICAgICAgICAgICAgdW5pdF9wcmljZTogaXRlbS51bml0X3ByaWNlLFxyXG4gICAgICAgICAgfSkpLFxyXG4gICAgICAgIH1dKTtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBFcnJvciBsb2FkaW5nIGNvbWJvczonLCBlcnJvcik7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gQXV0by1jYWxjdWxhdGUgc2VsbGluZyBwcmljZSB3aGVuIHB1cmNoYXNlIHByaWNlIG9yIG1hcmdpbiBjaGFuZ2VzXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IHB1cmNoYXNlUHJpY2VOdW0gPSB0eXBlb2YgcHVyY2hhc2VQcmljZSA9PT0gJ251bWJlcicgPyBwdXJjaGFzZVByaWNlIDogcGFyc2VGbG9hdChTdHJpbmcocHVyY2hhc2VQcmljZSB8fCAwKSkgfHwgMDtcclxuICAgIGNvbnN0IG1hcmdpbk51bSA9IHR5cGVvZiBtYXJnaW4gPT09ICdudW1iZXInID8gbWFyZ2luIDogcGFyc2VGbG9hdChTdHJpbmcobWFyZ2luIHx8IDApKSB8fCAwO1xyXG4gICAgXHJcbiAgICBpZiAocHVyY2hhc2VQcmljZU51bSA+IDAgJiYgbWFyZ2luTnVtID4gMCkge1xyXG4gICAgICBjb25zdCBzcCA9IHB1cmNoYXNlUHJpY2VOdW0gKyAocHVyY2hhc2VQcmljZU51bSAqIG1hcmdpbk51bSkgLyAxMDA7XHJcbiAgICAgIGlmICh0eXBlb2Ygc3AgPT09ICdudW1iZXInICYmICFpc05hTihzcCkpIHtcclxuICAgICAgICBjb25zdCBzZWxsaW5nUHJpY2UgPSBOdW1iZXIoc3AudG9GaXhlZCgyKSk7XHJcbiAgICAgICAgc2V0VmFsdWUoXCJzZWxsaW5nUHJpY2VcIiwgc2VsbGluZ1ByaWNlLCB7IHNob3VsZFZhbGlkYXRlOiBmYWxzZSwgc2hvdWxkRGlydHk6IGZhbHNlIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSwgW3B1cmNoYXNlUHJpY2UsIG1hcmdpbiwgc2V0VmFsdWVdKTtcclxuXHJcbiAgY29uc3Qgb25Ecm9wID0gdXNlQ2FsbGJhY2soKGFjY2VwdGVkRmlsZXM6IEZpbGVbXSkgPT4ge1xyXG4gICAgc2V0SW1hZ2VzKChwcmV2KSA9PiBbLi4ucHJldiwgLi4uYWNjZXB0ZWRGaWxlc10pO1xyXG4gIH0sIFtdKTtcclxuXHJcbiAgY29uc3QgeyBnZXRSb290UHJvcHMsIGdldElucHV0UHJvcHMsIGlzRHJhZ0FjdGl2ZSB9ID1cclxuICAgIHVzZURyb3B6b25lKHsgb25Ecm9wLCBhY2NlcHQ6IHsgJ2ltYWdlLyonOiBbJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcud2VicCcsICcuZ2lmJ10gfSwgbWF4U2l6ZTogNSAqIDEwMjQgKiAxMDI0IH0pO1xyXG5cclxuICBjb25zdCBnZW5lcmF0ZVNLVUZvckZvcm0gPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoaW5pdGlhbFByb2R1Y3QpIHtcclxuICAgICAgc2V0VmFsdWUoXCJza3VcIiwgaW5pdGlhbFByb2R1Y3Quc2t1IHx8IGdldFZhbHVlcygnc2t1JykpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBuZXh0U0tVID0gYXdhaXQgZ2VuZXJhdGVEb2N1bWVudE51bWJlclNhZmUoJ3Byb2R1Y3Rpb24nKTtcclxuICAgIGlmIChuZXh0U0tVKSBzZXRWYWx1ZShcInNrdVwiLCBuZXh0U0tVKTtcclxuICAgIGVsc2Ugc2V0VmFsdWUoXCJza3VcIiwgZ2VuZXJhdGVTS1UoKSk7XHJcbiAgfTtcclxuXHJcbiAgLy8gRW5hYmxlIFZhcmlhdGlvbnMgdG9nZ2xlOiB3aXRoIHNhZmV0eSBjaGVja3Mgd2hlbiBlZGl0aW5nXHJcbiAgY29uc3QgaGFuZGxlRW5hYmxlVmFyaWF0aW9uc0NoYW5nZSA9IGFzeW5jIChjaGVja2VkOiBib29sZWFuKSA9PiB7XHJcbiAgICBjb25zdCBwcm9kdWN0SWQgPSBpbml0aWFsUHJvZHVjdD8udXVpZCA/PyBpbml0aWFsUHJvZHVjdD8uaWQ7XHJcbiAgICBpZiAoY2hlY2tlZCkge1xyXG4gICAgICBpZiAocHJvZHVjdElkKSB7XHJcbiAgICAgICAgY29uc3QgcGFyZW50Q291bnQgPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmdldFBhcmVudExldmVsTW92ZW1lbnRDb3VudChwcm9kdWN0SWQpO1xyXG4gICAgICAgIGlmIChwYXJlbnRDb3VudCA+IDApIHtcclxuICAgICAgICAgIHNldEJsb2NrVmFyaWF0aW9uc01vZGFsT3Blbih0cnVlKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgc2V0RW5hYmxlVmFyaWF0aW9ucyh0cnVlKTtcclxuICAgICAgc2V0VmFsdWUoJ2luaXRpYWxTdG9jaycsIDAsIHsgc2hvdWxkVmFsaWRhdGU6IGZhbHNlIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKHByb2R1Y3RJZCAmJiAoaW5pdGlhbFByb2R1Y3Q/Lmhhc192YXJpYXRpb25zIHx8IGdlbmVyYXRlZFZhcmlhdGlvbnMubGVuZ3RoID4gMCkpIHtcclxuICAgICAgICBjb25zdCB2YXJpYXRpb25Db3VudCA9IGF3YWl0IGludmVudG9yeVNlcnZpY2UuZ2V0VmFyaWF0aW9uTGV2ZWxNb3ZlbWVudENvdW50KHByb2R1Y3RJZCk7XHJcbiAgICAgICAgaWYgKHZhcmlhdGlvbkNvdW50ID4gMCkge1xyXG4gICAgICAgICAgc2V0QmxvY2tEaXNhYmxlVmFyaWF0aW9uc01vZGFsT3Blbih0cnVlKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgc2V0RW5hYmxlVmFyaWF0aW9ucyhmYWxzZSk7XHJcbiAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnMoW10pO1xyXG4gICAgICBzZXRWYXJpYW50QXR0cmlidXRlcyhbXSk7XHJcbiAgICAgIGlmIChhY3RpdmVUYWIgPT09ICd2YXJpYXRpb25zJykgc2V0QWN0aXZlVGFiKCdpbnZlbnRvcnknKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvLyBFbmFibGUgQ29tYm8gUHJvZHVjdCB0b2dnbGU6IHdpdGggc2FmZXR5IGNoZWNrcyAobGlrZSB2YXJpYXRpb25zKVxyXG4gIGNvbnN0IGhhbmRsZUVuYWJsZUNvbWJvQ2hhbmdlID0gYXN5bmMgKGNoZWNrZWQ6IGJvb2xlYW4pID0+IHtcclxuICAgIGNvbnN0IHByb2R1Y3RJZCA9IGluaXRpYWxQcm9kdWN0Py51dWlkID8/IGluaXRpYWxQcm9kdWN0Py5pZDtcclxuICAgIGlmIChjaGVja2VkKSB7XHJcbiAgICAgIC8vIEJMT0NLIDE6IElmIHByb2R1Y3QgaGFzIHN0b2NrIG1vdmVtZW50cywgY2Fubm90IGVuYWJsZSBjb21ib1xyXG4gICAgICBpZiAocHJvZHVjdElkKSB7XHJcbiAgICAgICAgY29uc3QgcGFyZW50Q291bnQgPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmdldFBhcmVudExldmVsTW92ZW1lbnRDb3VudChwcm9kdWN0SWQpO1xyXG4gICAgICAgIGlmIChwYXJlbnRDb3VudCA+IDApIHtcclxuICAgICAgICAgIHNldEJsb2NrRW5hYmxlQ29tYm9Nb2RhbE9wZW4odHJ1ZSk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHNldElzQ29tYm9Qcm9kdWN0KHRydWUpO1xyXG4gICAgICBzZXRWYWx1ZSgnaW5pdGlhbFN0b2NrJywgMCwgeyBzaG91bGRWYWxpZGF0ZTogZmFsc2UgfSk7XHJcbiAgICAgIGlmICghbW9kdWxlcy5jb21ib3NFbmFibGVkKSB7XHJcbiAgICAgICAgdG9hc3QuZXJyb3IoJ0NvbWJvIG1vZHVsZSBpcyBkaXNhYmxlZC4gRW5hYmxlIGl0IGluIFNldHRpbmdzIGZpcnN0LicpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gQkxPQ0sgMjogSWYgcHJvZHVjdCBoYXMgY29tYm8gaXRlbXMsIGNhbm5vdCBkaXNhYmxlIGNvbWJvXHJcbiAgICAgIGlmIChwcm9kdWN0SWQgJiYgY29tYm9zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBzZXRCbG9ja0Rpc2FibGVDb21ib01vZGFsT3Blbih0cnVlKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgc2V0SXNDb21ib1Byb2R1Y3QoZmFsc2UpO1xyXG4gICAgICBzZXRDb21ib3MoW10pO1xyXG4gICAgICBzZXRDdXJyZW50Q29tYm9JdGVtcyhbXSk7XHJcbiAgICAgIHNldENvbWJvTmFtZSgnJyk7XHJcbiAgICAgIHNldENvbWJvRmluYWxQcmljZSgwKTtcclxuICAgICAgaWYgKGFjdGl2ZVRhYiA9PT0gJ2NvbWJvcycpIHNldEFjdGl2ZVRhYignaW52ZW50b3J5Jyk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gVmFyaWF0aW9ucyBGdW5jdGlvbnNcclxuICBjb25zdCBwZXJzaXN0VmFyaWF0aW9uTWFzdGVyTWVyZ2UgPSBhc3luYyAobmV4dDogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+KSA9PiB7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgdmFyaWF0aW9uTWFzdGVyU2VydmljZS5zYXZlKGNvbXBhbnlJZCwgbmV4dCk7XHJcbiAgICAgIHNldFZhcmlhdGlvbk1hc3RlcihuZXh0KTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAvKiBub24tYmxvY2tpbmcgKi9cclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBhZGRWYXJpYW50QXR0cmlidXRlID0gKCkgPT4ge1xyXG4gICAgY29uc3QgbmFtZSA9IG5ld0F0dHJpYnV0ZU5hbWUudHJpbSgpO1xyXG4gICAgaWYgKG5hbWUgJiYgIXZhcmlhbnRBdHRyaWJ1dGVzLnNvbWUoKGF0dHIpID0+IGF0dHIubmFtZSA9PT0gbmFtZSkpIHtcclxuICAgICAgc2V0VmFyaWFudEF0dHJpYnV0ZXMoWy4uLnZhcmlhbnRBdHRyaWJ1dGVzLCB7IG5hbWUsIHZhbHVlczogW10gfV0pO1xyXG4gICAgICBzZXROZXdBdHRyaWJ1dGVOYW1lKCcnKTtcclxuICAgICAgaWYgKGNvbXBhbnlJZCkge1xyXG4gICAgICAgIGNvbnN0IG5leHQgPSB7IC4uLnZhcmlhdGlvbk1hc3RlciB9O1xyXG4gICAgICAgIGlmICghbmV4dFtuYW1lXSkgbmV4dFtuYW1lXSA9IFtdO1xyXG4gICAgICAgIHZvaWQgcGVyc2lzdFZhcmlhdGlvbk1hc3Rlck1lcmdlKG5leHQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYWRkQXR0cmlidXRlVmFsdWUgPSAoKSA9PiB7XHJcbiAgICBpZiAoc2VsZWN0ZWRBdHRyaWJ1dGVJbmRleCAhPT0gbnVsbCAmJiBuZXdBdHRyaWJ1dGVWYWx1ZS50cmltKCkpIHtcclxuICAgICAgY29uc3QgdXBkYXRlZEF0dHJpYnV0ZXMgPSBbLi4udmFyaWFudEF0dHJpYnV0ZXNdO1xyXG4gICAgICBjb25zdCB2YWwgPSBuZXdBdHRyaWJ1dGVWYWx1ZS50cmltKCk7XHJcbiAgICAgIGNvbnN0IGF0dHJOYW1lID0gdXBkYXRlZEF0dHJpYnV0ZXNbc2VsZWN0ZWRBdHRyaWJ1dGVJbmRleF0ubmFtZTtcclxuICAgICAgaWYgKCF1cGRhdGVkQXR0cmlidXRlc1tzZWxlY3RlZEF0dHJpYnV0ZUluZGV4XS52YWx1ZXMuaW5jbHVkZXModmFsKSkge1xyXG4gICAgICAgIHVwZGF0ZWRBdHRyaWJ1dGVzW3NlbGVjdGVkQXR0cmlidXRlSW5kZXhdLnZhbHVlcy5wdXNoKHZhbCk7XHJcbiAgICAgICAgc2V0VmFyaWFudEF0dHJpYnV0ZXModXBkYXRlZEF0dHJpYnV0ZXMpO1xyXG4gICAgICAgIHNldE5ld0F0dHJpYnV0ZVZhbHVlKCcnKTtcclxuICAgICAgICBpZiAoY29tcGFueUlkICYmIGF0dHJOYW1lKSB7XHJcbiAgICAgICAgICBjb25zdCBuZXh0ID0geyAuLi52YXJpYXRpb25NYXN0ZXIgfTtcclxuICAgICAgICAgIGNvbnN0IGxpc3QgPSBuZXcgU2V0KFsuLi4obmV4dFthdHRyTmFtZV0gfHwgW10pLCB2YWxdKTtcclxuICAgICAgICAgIG5leHRbYXR0ck5hbWVdID0gQXJyYXkuZnJvbShsaXN0KS5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xyXG4gICAgICAgICAgdm9pZCBwZXJzaXN0VmFyaWF0aW9uTWFzdGVyTWVyZ2UobmV4dCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgcmVtb3ZlVmFyaWFudEF0dHJpYnV0ZSA9IChhdHRyTmFtZTogc3RyaW5nKSA9PiB7XHJcbiAgICBzZXRWYXJpYW50QXR0cmlidXRlcyh2YXJpYW50QXR0cmlidXRlcy5maWx0ZXIoYSA9PiBhLm5hbWUgIT09IGF0dHJOYW1lKSk7XHJcbiAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKFtdKTtcclxuICB9O1xyXG5cclxuICBjb25zdCByZW1vdmVBdHRyaWJ1dGVWYWx1ZSA9IChhdHRySW5kZXg6IG51bWJlciwgdmFsdWVJbmRleDogbnVtYmVyKSA9PiB7XHJcbiAgICBjb25zdCB1cGRhdGVkQXR0cmlidXRlcyA9IFsuLi52YXJpYW50QXR0cmlidXRlc107XHJcbiAgICB1cGRhdGVkQXR0cmlidXRlc1thdHRySW5kZXhdLnZhbHVlcy5zcGxpY2UodmFsdWVJbmRleCwgMSk7XHJcbiAgICBzZXRWYXJpYW50QXR0cmlidXRlcyh1cGRhdGVkQXR0cmlidXRlcyk7XHJcbiAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKFtdKTtcclxuICB9O1xyXG5cclxuICAvKiogQ29weSBhdHRyaWJ1dGUgc3RydWN0dXJlIGZyb20gYW4gZXhpc3RpbmcgcHJvZHVjdCdzIHZhcmlhdGlvbnMgKi9cclxuICBjb25zdCBjb3B5QXR0cmlidXRlc0Zyb21Qcm9kdWN0ID0gKHByb2R1Y3Q6IHsgdmFyaWF0aW9ucz86IEFycmF5PHsgYXR0cmlidXRlcz86IHVua25vd24gfT4gfSkgPT4ge1xyXG4gICAgY29uc3QgdmFycyA9IHByb2R1Y3QudmFyaWF0aW9ucyB8fCBbXTtcclxuICAgIGlmICh2YXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG4gICAgY29uc3QgYXR0ck1hcDogUmVjb3JkPHN0cmluZywgU2V0PHN0cmluZz4+ID0ge307XHJcbiAgICBmb3IgKGNvbnN0IHYgb2YgdmFycykge1xyXG4gICAgICBjb25zdCBhdHRycyA9IHB1YmxpY1ZhcmlhdGlvbkF0dHJpYnV0ZXMocGFyc2VWYXJpYXRpb25BdHRyaWJ1dGVzUmF3KHYuYXR0cmlidXRlcykpO1xyXG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgT2JqZWN0LmVudHJpZXMoYXR0cnMpKSB7XHJcbiAgICAgICAgaWYgKCFrZXkgfHwgdmFsID09IG51bGwgfHwgdmFsID09PSAnJykgY29udGludWU7XHJcbiAgICAgICAgaWYgKCFhdHRyTWFwW2tleV0pIGF0dHJNYXBba2V5XSA9IG5ldyBTZXQoKTtcclxuICAgICAgICBhdHRyTWFwW2tleV0uYWRkKFN0cmluZyh2YWwpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgY29uc3QgZGVyaXZlZDogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlczogc3RyaW5nW10gfT4gPSBPYmplY3QuZW50cmllcyhhdHRyTWFwKS5tYXAoKFtuYW1lLCBzZXRdKSA9PiAoe1xyXG4gICAgICBuYW1lLFxyXG4gICAgICB2YWx1ZXM6IEFycmF5LmZyb20oc2V0KS5zb3J0KCksXHJcbiAgICB9KSk7XHJcbiAgICBpZiAoZGVyaXZlZC5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHNldFZhcmlhbnRBdHRyaWJ1dGVzKGRlcml2ZWQpO1xyXG4gICAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKFtdKTtcclxuICAgICAgdG9hc3Quc3VjY2VzcyhgQ29waWVkICR7ZGVyaXZlZC5sZW5ndGh9IGF0dHJpYnV0ZShzKSBmcm9tIGV4aXN0aW5nIHByb2R1Y3RgKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvKiogTWF4IHZhcmlhdGlvbnMgcGVyIHByb2R1Y3QgKGZyb250ZW5kICsgYmFja2VuZCBjb25zaXN0ZW5jeTsgYXZvaWQgcnVuYXdheSBjb21iaW5hdGlvbnMpICovXHJcbiAgY29uc3QgTUFYX1ZBUklBVElPTlMgPSAxMDA7XHJcblxyXG4gIGNvbnN0IGNhcnRlc2lhblByb2R1Y3QgPSAoYXJyYXlzOiBzdHJpbmdbXVtdKTogc3RyaW5nW11bXSA9PiB7XHJcbiAgICBpZiAoYXJyYXlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtbXV07XHJcbiAgICByZXR1cm4gYXJyYXlzLnJlZHVjZSgoYSwgYikgPT4gYS5mbGF0TWFwKGQgPT4gYi5tYXAoZSA9PiBbLi4uKEFycmF5LmlzQXJyYXkoZCkgPyBkIDogW2RdKSwgZV0pKSwgW1tdXSBhcyBzdHJpbmdbXVtdKTtcclxuICB9O1xyXG5cclxuICBjb25zdCB2YXJpYXRpb25Db21ib0tleSA9IChjb21iaW5hdGlvbk9iajogUmVjb3JkPHN0cmluZywgc3RyaW5nPikgPT5cclxuICAgIHZhcmlhbnRBdHRyaWJ1dGVzLm1hcCgoYSkgPT4gYCR7YS5uYW1lfT0ke2NvbWJpbmF0aW9uT2JqW2EubmFtZV0gPz8gJyd9YCkuam9pbignfCcpO1xyXG5cclxuICBjb25zdCBnZW5lcmF0ZVZhcmlhdGlvbnMgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBhdHRyaWJ1dGVWYWx1ZXMgPSB2YXJpYW50QXR0cmlidXRlcy5tYXAoKGF0dHIpID0+IGF0dHIudmFsdWVzKTtcclxuICAgIGNvbnN0IGNvbWJpbmF0aW9ucyA9IGNhcnRlc2lhblByb2R1Y3QoYXR0cmlidXRlVmFsdWVzKTtcclxuICAgIGlmIChjb21iaW5hdGlvbnMubGVuZ3RoID4gTUFYX1ZBUklBVElPTlMpIHtcclxuICAgICAgdG9hc3QuZXJyb3IoYFZhcmlhdGlvbiBsaW1pdCAoJHtNQVhfVkFSSUFUSU9OU30pIGV4Y2VlZGVkLiBZb3UgaGF2ZSAke2NvbWJpbmF0aW9ucy5sZW5ndGh9IGNvbWJpbmF0aW9ucy4gUmVkdWNlIGF0dHJpYnV0ZSB2YWx1ZXMgb3IgdXNlIGZld2VyIGF0dHJpYnV0ZXMuYCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IGJhc2VTa3UgPSAoZ2V0VmFsdWVzKCdza3UnKSB8fCAnJykudHJpbSgpIHx8IGdlbmVyYXRlU0tVKCk7XHJcblxyXG4gICAgY29uc3QgYmFzaWNTZWxsaW5nUHJpY2UgPSBnZXRWYWx1ZXMoJ3NlbGxpbmdQcmljZScpID8/IDA7XHJcbiAgICBjb25zdCBiYXNpY1B1cmNoYXNlUHJpY2UgPSBnZXRWYWx1ZXMoJ3B1cmNoYXNlUHJpY2UnKSA/PyAwO1xyXG4gICAgY29uc3QgZXhpc3RpbmdCeUNvbWJvID0gbmV3IE1hcChnZW5lcmF0ZWRWYXJpYXRpb25zLm1hcCgoZXYpID0+IFt2YXJpYXRpb25Db21ib0tleShldi5jb21iaW5hdGlvbiksIGV2XSkpO1xyXG5cclxuICAgIGNvbnN0IG5ld1ZhcmlhdGlvbnMgPSBjb21iaW5hdGlvbnMubWFwKChjb21iaW5hdGlvbiwgaW5kZXgpID0+IHtcclxuICAgICAgY29uc3QgY29tYmluYXRpb25PYmo6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcclxuICAgICAgdmFyaWFudEF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0ciwgaSkgPT4ge1xyXG4gICAgICAgIGNvbWJpbmF0aW9uT2JqW2F0dHIubmFtZV0gPSBjb21iaW5hdGlvbltpXTtcclxuICAgICAgfSk7XHJcbiAgICAgIGNvbnN0IHByZXYgPSBleGlzdGluZ0J5Q29tYm8uZ2V0KHZhcmlhdGlvbkNvbWJvS2V5KGNvbWJpbmF0aW9uT2JqKSk7XHJcbiAgICAgIGlmIChwcmV2KSB7XHJcbiAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgY29tYmluYXRpb246IGNvbWJpbmF0aW9uT2JqIH07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogdW5kZWZpbmVkIGFzIHN0cmluZyB8IHVuZGVmaW5lZCxcclxuICAgICAgICBjb21iaW5hdGlvbjogY29tYmluYXRpb25PYmosXHJcbiAgICAgICAgc2t1OiBgJHtiYXNlU2t1fS1WJHtpbmRleCArIDF9YCxcclxuICAgICAgICBwcmljZTogTnVtYmVyKGJhc2ljU2VsbGluZ1ByaWNlKSB8fCAwLFxyXG4gICAgICAgIHB1cmNoYXNlUHJpY2U6IE51bWJlcihiYXNpY1B1cmNoYXNlUHJpY2UpIHx8IDAsXHJcbiAgICAgICAgc3RvY2s6IDAsXHJcbiAgICAgICAgYmFyY29kZTogJycsXHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuXHJcbiAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKG5ld1ZhcmlhdGlvbnMpO1xyXG4gIH07XHJcblxyXG4gIC8vIENvbWJvcyBGdW5jdGlvbnNcclxuICAvLyBGaWx0ZXIgYXZhaWxhYmxlIHByb2R1Y3RzIGJhc2VkIG9uIHNlYXJjaCBxdWVyeVxyXG4gIGNvbnN0IGZpbHRlcmVkUHJvZHVjdHMgPSBhdmFpbGFibGVQcm9kdWN0cy5maWx0ZXIocHJvZHVjdCA9PlxyXG4gICAgcHJvZHVjdC5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocHJvZHVjdFNlYXJjaFF1ZXJ5LnRvTG93ZXJDYXNlKCkpIHx8XHJcbiAgICBwcm9kdWN0LnNrdS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHByb2R1Y3RTZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpKVxyXG4gICk7XHJcblxyXG4gIGNvbnN0IHNlbGVjdFByb2R1Y3QgPSAocHJvZHVjdDogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IHJldGFpbF9wcmljZTogbnVtYmVyOyBza3U6IHN0cmluZzsgaGFzX3ZhcmlhdGlvbnM6IGJvb2xlYW4gfSkgPT4ge1xyXG4gICAgLy8gQ2hlY2sgaWYgcHJvZHVjdCBhbHJlYWR5IGluIGN1cnJlbnQgY29tYm9cclxuICAgIGlmIChjdXJyZW50Q29tYm9JdGVtcy5zb21lKGl0ZW0gPT4gaXRlbS5wcm9kdWN0X2lkID09PSBwcm9kdWN0LmlkICYmICFpdGVtLnZhcmlhdGlvbl9pZCkpIHtcclxuICAgICAgdG9hc3QuZXJyb3IoJ1Byb2R1Y3QgYWxyZWFkeSBhZGRlZCB0byBjb21ibycpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIElmIHByb2R1Y3QgaGFzIHZhcmlhdGlvbnMsIHdlIG5lZWQgdmFyaWF0aW9uX2lkICh3aWxsIGJlIGhhbmRsZWQgaW4gVUkpXHJcbiAgICAvLyBGb3Igbm93LCBhZGQgd2l0aG91dCB2YXJpYXRpb24gKHVzZXIgY2FuIGVkaXQgbGF0ZXIgaWYgbmVlZGVkKVxyXG4gICAgc2V0Q3VycmVudENvbWJvSXRlbXMoWy4uLmN1cnJlbnRDb21ib0l0ZW1zLCB7XHJcbiAgICAgIHByb2R1Y3RfaWQ6IHByb2R1Y3QuaWQsXHJcbiAgICAgIHByb2R1Y3RfbmFtZTogcHJvZHVjdC5uYW1lLFxyXG4gICAgICBwcm9kdWN0X3NrdTogcHJvZHVjdC5za3UsXHJcbiAgICAgIHZhcmlhdGlvbl9pZDogbnVsbCwgLy8gVE9ETzogQWRkIHZhcmlhdGlvbiBzZWxlY3Rpb24gaWYgaGFzX3ZhcmlhdGlvbnNcclxuICAgICAgcXR5OiAxLFxyXG4gICAgICB1bml0X3ByaWNlOiBwcm9kdWN0LnJldGFpbF9wcmljZSxcclxuICAgIH1dKTtcclxuICAgICAgc2V0UHJvZHVjdFNlYXJjaFF1ZXJ5KCcnKTtcclxuICAgICAgc2V0U2hvd1Byb2R1Y3REcm9wZG93bihmYWxzZSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgcmVtb3ZlQ29tYm9JdGVtID0gKGluZGV4OiBudW1iZXIpID0+IHtcclxuICAgIHNldEN1cnJlbnRDb21ib0l0ZW1zKGN1cnJlbnRDb21ib0l0ZW1zLmZpbHRlcigoXywgaSkgPT4gaSAhPT0gaW5kZXgpKTtcclxuICB9O1xyXG5cclxuICBjb25zdCB1cGRhdGVDb21ib0l0ZW1RdHkgPSAoaW5kZXg6IG51bWJlciwgcXR5OiBudW1iZXIpID0+IHtcclxuICAgIGlmIChxdHkgPD0gMCkgcmV0dXJuO1xyXG4gICAgY29uc3QgdXBkYXRlZCA9IFsuLi5jdXJyZW50Q29tYm9JdGVtc107XHJcbiAgICB1cGRhdGVkW2luZGV4XS5xdHkgPSBxdHk7XHJcbiAgICBzZXRDdXJyZW50Q29tYm9JdGVtcyh1cGRhdGVkKTtcclxuICB9O1xyXG5cclxuICBjb25zdCB1cGRhdGVDb21ib0l0ZW1QcmljZSA9IChpbmRleDogbnVtYmVyLCBwcmljZTogbnVtYmVyKSA9PiB7XHJcbiAgICBpZiAocHJpY2UgPCAwKSByZXR1cm47XHJcbiAgICBjb25zdCB1cGRhdGVkID0gWy4uLmN1cnJlbnRDb21ib0l0ZW1zXTtcclxuICAgIHVwZGF0ZWRbaW5kZXhdLnVuaXRfcHJpY2UgPSBwcmljZTtcclxuICAgIHNldEN1cnJlbnRDb21ib0l0ZW1zKHVwZGF0ZWQpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHNhdmVDb21ibyA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY29tYm9OYW1lLnRyaW0oKSB8fCBjb21ib0ZpbmFsUHJpY2UgPD0gMCB8fCBjdXJyZW50Q29tYm9JdGVtcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdG9hc3QuZXJyb3IoJ1BsZWFzZSBmaWxsIGFsbCBjb21ibyBmaWVsZHMgYW5kIGFkZCBhdCBsZWFzdCBvbmUgcHJvZHVjdCcpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmICghY29tcGFueUlkKSB7XHJcbiAgICAgIHRvYXN0LmVycm9yKCdDb21wYW55IElEIG1pc3NpbmcnKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHByb2R1Y3RJZCA9IGluaXRpYWxQcm9kdWN0Py51dWlkIHx8IGluaXRpYWxQcm9kdWN0Py5pZDtcclxuICAgIGlmICghcHJvZHVjdElkKSB7XHJcbiAgICAgIHRvYXN0LmVycm9yKCdTYXZlIHRoZSBwcm9kdWN0IGZpcnN0IChCYXNpYyB0YWIpLCB0aGVuIHlvdSBjYW4gYWRkIGNvbWJvcyBoZXJlLicpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gQ3JlYXRlIG9yIHVwZGF0ZSBjb21ib1xyXG4gICAgICBpZiAoY29tYm9zLmxlbmd0aCA+IDAgJiYgY29tYm9zWzBdLmlkKSB7XHJcbiAgICAgICAgLy8gVXBkYXRlIGV4aXN0aW5nIGNvbWJvXHJcbiAgICAgICAgYXdhaXQgY29tYm9TZXJ2aWNlLnVwZGF0ZUNvbWJvKGNvbWJvc1swXS5pZCwgY29tcGFueUlkLCB7XHJcbiAgICAgICAgICBjb21ib19uYW1lOiBjb21ib05hbWUsXHJcbiAgICAgICAgICBjb21ib19wcmljZTogY29tYm9GaW5hbFByaWNlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGF3YWl0IGNvbWJvU2VydmljZS51cGRhdGVDb21ib0l0ZW1zKGNvbWJvc1swXS5pZCwgY29tcGFueUlkLCBjdXJyZW50Q29tYm9JdGVtcyk7XHJcbiAgICAgICAgdG9hc3Quc3VjY2VzcygnQ29tYm8gdXBkYXRlZCEnKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBDcmVhdGUgbmV3IGNvbWJvXHJcbiAgICAgICAgY29uc3QgbmV3Q29tYm8gPSBhd2FpdCBjb21ib1NlcnZpY2UuY3JlYXRlQ29tYm8oe1xyXG4gICAgICAgICAgY29tcGFueV9pZDogY29tcGFueUlkLFxyXG4gICAgICAgICAgY29tYm9fcHJvZHVjdF9pZDogcHJvZHVjdElkLFxyXG4gICAgICAgICAgY29tYm9fbmFtZTogY29tYm9OYW1lLFxyXG4gICAgICAgICAgY29tYm9fcHJpY2U6IGNvbWJvRmluYWxQcmljZSxcclxuICAgICAgICAgIGl0ZW1zOiBjdXJyZW50Q29tYm9JdGVtcyxcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBzZXRDb21ib3MoW3tcclxuICAgICAgICAgIGlkOiBuZXdDb21iby5pZCxcclxuICAgICAgICAgIGNvbWJvX25hbWU6IG5ld0NvbWJvLmNvbWJvX25hbWUsXHJcbiAgICAgICAgICBjb21ib19wcmljZTogbmV3Q29tYm8uY29tYm9fcHJpY2UsXHJcbiAgICAgICAgICBpdGVtczogbmV3Q29tYm8uaXRlbXMubWFwKGl0ZW0gPT4gKHtcclxuICAgICAgICAgICAgaWQ6IGl0ZW0uaWQsXHJcbiAgICAgICAgICAgIHByb2R1Y3RfaWQ6IGl0ZW0ucHJvZHVjdF9pZCxcclxuICAgICAgICAgICAgdmFyaWF0aW9uX2lkOiBpdGVtLnZhcmlhdGlvbl9pZCxcclxuICAgICAgICAgICAgcXR5OiBpdGVtLnF0eSxcclxuICAgICAgICAgICAgdW5pdF9wcmljZTogaXRlbS51bml0X3ByaWNlLFxyXG4gICAgICAgICAgfSkpLFxyXG4gICAgICAgIH1dKTtcclxuICAgICAgICB0b2FzdC5zdWNjZXNzKCdDb21ibyBzYXZlZCEnKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gUmVzZXQgZm9ybVxyXG4gICAgICBzZXRDdXJyZW50Q29tYm9JdGVtcyhbXSk7XHJcbiAgICAgIHNldENvbWJvTmFtZSgnJyk7XHJcbiAgICAgIHNldENvbWJvRmluYWxQcmljZSgwKTtcclxuICAgICAgc2V0UHJvZHVjdFNlYXJjaFF1ZXJ5KCcnKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3Igc2F2aW5nIGNvbWJvOicsIGVycm9yKTtcclxuICAgICAgdG9hc3QuZXJyb3IoZXJyb3I/Lm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBzYXZlIGNvbWJvJyk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZGVsZXRlQ29tYm8gPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKCFjb21wYW55SWQpIHtcclxuICAgICAgdG9hc3QuZXJyb3IoJ0NvbXBhbnkgSUQgbWlzc2luZycpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGNvbWJvU2VydmljZS5kZWxldGVDb21ibyhpZCwgY29tcGFueUlkKTtcclxuICAgICAgc2V0Q29tYm9zKGNvbWJvcy5maWx0ZXIoYyA9PiBjLmlkICE9PSBpZCkpO1xyXG4gICAgICB0b2FzdC5zdWNjZXNzKCdDb21ibyBkZWxldGVkIScpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBFcnJvciBkZWxldGluZyBjb21ibzonLCBlcnJvcik7XHJcbiAgICAgIHRvYXN0LmVycm9yKGVycm9yPy5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gZGVsZXRlIGNvbWJvJyk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgb25TdWJtaXQgPSBhc3luYyAoXHJcbiAgICBkYXRhOiBQcm9kdWN0Rm9ybVZhbHVlcyxcclxuICAgIGFjdGlvbjogXCJzYXZlXCIgfCBcInNhdmVBbmRBZGRcIixcclxuICApID0+IHtcclxuICAgIGlmIChzdWJtaXRJblByb2dyZXNzUmVmLmN1cnJlbnQpIHJldHVybjtcclxuICAgIHN1Ym1pdEluUHJvZ3Jlc3NSZWYuY3VycmVudCA9IHRydWU7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCkge1xyXG4gICAgICB0b2FzdC5lcnJvcignQ29tcGFueSBJRCBub3QgZm91bmQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi4nKTtcclxuICAgICAgc3VibWl0SW5Qcm9ncmVzc1JlZi5jdXJyZW50ID0gZmFsc2U7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnN0IGZpbmFsQ29tcGFueUlkID0gY29tcGFueUlkO1xyXG4gICAgXHJcbiAgICBpZiAoIWZpbmFsQ29tcGFueUlkKSB7XHJcbiAgICAgIHRvYXN0LmVycm9yKCdDb21wYW55IGluZm9ybWF0aW9uIHJlcXVpcmVkLiBQbGVhc2UgbG9naW4gYWdhaW4uJyk7XHJcbiAgICAgIHN1Ym1pdEluUHJvZ3Jlc3NSZWYuY3VycmVudCA9IGZhbHNlO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgIHNldFNhdmluZyh0cnVlKTtcclxuICAgICAgY29uc3QgZmluYWxTS1UgPSBkYXRhLnNrdSAmJiBkYXRhLnNrdS50cmltKCkgIT09ICcnID8gZGF0YS5za3UgOiBnZW5lcmF0ZVNLVSgpO1xyXG5cclxuICAgICAgY29uc3QgVVVJRF9SRUdFWCA9IC9eWzAtOWEtZl17OH0tWzAtOWEtZl17NH0tWzAtOWEtZl17NH0tWzAtOWEtZl17NH0tWzAtOWEtZl17MTJ9JC9pO1xyXG4gICAgICBjb25zdCBhc0lkID0gKHY6IHVua25vd24pOiBzdHJpbmcgfCBudWxsID0+IHtcclxuICAgICAgICBpZiAodiA9PSBudWxsIHx8IHYgPT09ICcnKSByZXR1cm4gbnVsbDtcclxuICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnICYmIFVVSURfUkVHRVgudGVzdCh2KSkgcmV0dXJuIHY7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2ID09PSAnb2JqZWN0JyAmJiB2ICE9PSBudWxsICYmICdpZCcgaW4gdiAmJiB0eXBlb2YgKHYgYXMgYW55KS5pZCA9PT0gJ3N0cmluZycpIHJldHVybiAodiBhcyBhbnkpLmlkO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICB9O1xyXG4gICAgICBjb25zdCByYXdVbml0ID0gZ2V0VmFsdWVzKCd1bml0JykgPz8gZGF0YS51bml0O1xyXG4gICAgICBjb25zdCByYXdDYXRlZ29yeSA9IGdldFZhbHVlcygnY2F0ZWdvcnknKSA/PyBkYXRhLmNhdGVnb3J5O1xyXG4gICAgICBjb25zdCByYXdTdWJDYXRlZ29yeSA9IGdldFZhbHVlcygnc3ViQ2F0ZWdvcnknKSA/PyBkYXRhLnN1YkNhdGVnb3J5O1xyXG4gICAgICBjb25zdCByYXdCcmFuZCA9IGdldFZhbHVlcygnYnJhbmQnKSA/PyBkYXRhLmJyYW5kO1xyXG5cclxuICAgICAgbGV0IGNhdGVnb3J5SWQ6IHN0cmluZyB8IG51bGwgPSBhc0lkKHJhd1N1YkNhdGVnb3J5KSA/PyBhc0lkKHJhd0NhdGVnb3J5KSA/PyBudWxsO1xyXG4gICAgICBpZiAoIWNhdGVnb3J5SWQgJiYgKHJhd0NhdGVnb3J5IHx8IHJhd1N1YkNhdGVnb3J5KSkge1xyXG4gICAgICAgIGNvbnN0IGZvdW5kID0gY2F0ZWdvcmllcy5maW5kKChjKSA9PiBjLmlkID09PSByYXdDYXRlZ29yeSB8fCBjLmlkID09PSByYXdTdWJDYXRlZ29yeSkgfHwgc3ViQ2F0ZWdvcmllcy5maW5kKChjKSA9PiBjLmlkID09PSByYXdDYXRlZ29yeSB8fCBjLmlkID09PSByYXdTdWJDYXRlZ29yeSk7XHJcbiAgICAgICAgaWYgKGZvdW5kKSBjYXRlZ29yeUlkID0gZm91bmQuaWQ7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgdW5pdElkID0gYXNJZChyYXdVbml0KTtcclxuICAgICAgY29uc3QgYnJhbmRJZCA9IGFzSWQocmF3QnJhbmQpO1xyXG5cclxuICAgICAgbGV0IGJhcmNvZGVWYWx1ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKGRhdGEuYmFyY29kZSAmJiBkYXRhLmJhcmNvZGUudHJpbSgpICE9PSAnJykgYmFyY29kZVZhbHVlID0gZGF0YS5iYXJjb2RlLnRyaW0oKTtcclxuICAgICAgfSBjYXRjaCAoYmFyY29kZUVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdbUFJPRFVDVCBGT1JNXSBCYXJjb2RlIGVycm9yIChub24tYmxvY2tpbmcpOicsIGJhcmNvZGVFcnJvcik7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIENvbnZlcnQgdG8gU3VwYWJhc2UgZm9ybWF0IChmaWVsZCBuYW1lcyBtYXRjaCBzY2hlbWEpXHJcbiAgICAgIGNvbnN0IHByb2R1Y3REYXRhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcclxuICAgICAgICBjb21wYW55X2lkOiBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICBjYXRlZ29yeV9pZDogY2F0ZWdvcnlJZCxcclxuICAgICAgICBicmFuZF9pZDogYnJhbmRJZCxcclxuICAgICAgICB1bml0X2lkOiB1bml0SWQsXHJcbiAgICAgICAgbmFtZTogZGF0YS5uYW1lLFxyXG4gICAgICAgIHNrdTogZmluYWxTS1UsXHJcbiAgICAgICAgYmFyY29kZTogYmFyY29kZVZhbHVlLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBkYXRhLmRlc2NyaXB0aW9uIHx8IG51bGwsXHJcbiAgICAgICAgY29zdF9wcmljZTogZGF0YS5wdXJjaGFzZVByaWNlID8/IDAsXHJcbiAgICAgICAgcmV0YWlsX3ByaWNlOiBkYXRhLnNlbGxpbmdQcmljZSxcclxuICAgICAgICB3aG9sZXNhbGVfcHJpY2U6IGRhdGEud2hvbGVzYWxlUHJpY2UgPz8gZGF0YS5zZWxsaW5nUHJpY2UgPz8gMCxcclxuICAgICAgICByZW50YWxfcHJpY2VfZGFpbHk6IGRhdGEucmVudGFsUHJpY2UgPz8gbnVsbCxcclxuICAgICAgICAvLyBSVUxFIDE6IFdoZW4gdmFyaWF0aW9ucyBlbmFibGVkLCBwYXJlbnQgY2Fubm90IGhvbGQgc3RvY2sgKG9wZW5pbmcgc3RvY2sgcGVyIHZhcmlhdGlvbiBvbmx5KVxyXG4gICAgICAgIC8vIFJVTEUgMjogV2hlbiBjb21ibyBlbmFibGVkLCBwcm9kdWN0IGNhbm5vdCBob2xkIHN0b2NrICh2aXJ0dWFsIGJ1bmRsZSAtIHN0b2NrIGZyb20gY29tcG9uZW50cylcclxuICAgICAgICBjdXJyZW50X3N0b2NrOiAoZW5hYmxlVmFyaWF0aW9ucyB8fCBpc0NvbWJvUHJvZHVjdCkgPyAwIDogKChkYXRhLmluaXRpYWxTdG9jayA/PyAwKSA+IDAgJiYgIWluaXRpYWxQcm9kdWN0Py5pZCA/IDAgOiAoZGF0YS5pbml0aWFsU3RvY2sgPz8gMCkpLFxyXG4gICAgICAgIG1pbl9zdG9jazogZGF0YS5hbGVydFF0eSA/PyAwLFxyXG4gICAgICAgIG1heF9zdG9jazogZGF0YS5tYXhTdG9jayA/PyAxMDAwLFxyXG4gICAgICAgIGhhc192YXJpYXRpb25zOiBlbmFibGVWYXJpYXRpb25zLFxyXG4gICAgICAgIGlzX2NvbWJvX3Byb2R1Y3Q6IGlzQ29tYm9Qcm9kdWN0LCAvLyBTYXZlIGNvbWJvIGZsYWdcclxuICAgICAgICBpc19yZW50YWJsZTogKGRhdGEucmVudGFsUHJpY2UgPz8gMCkgPiAwLFxyXG4gICAgICAgIGlzX3NlbGxhYmxlOiB0cnVlLFxyXG4gICAgICAgIHRyYWNrX3N0b2NrOiBkYXRhLnN0b2NrTWFuYWdlbWVudCAhPT0gZmFsc2UsXHJcbiAgICAgICAgaXNfYWN0aXZlOiB0cnVlLFxyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3QgcHJvZHVjdElkID0gaW5pdGlhbFByb2R1Y3Q/LnV1aWQgPz8gaW5pdGlhbFByb2R1Y3Q/LmlkOyAvLyBFZGl0OiBVVUlEIGZyb20gbGlzdCBvciBBUElcclxuICAgICAgY29uc3QgaXNFZGl0ID0gISFwcm9kdWN0SWQ7XHJcblxyXG4gICAgICBpZiAoaXNFZGl0KSB7XHJcbiAgICAgICAgLy8gVVBEQVRFOiBtZXJnZSBleGlzdGluZyBpbWFnZV91cmxzIChpbmNsdWRpbmcgYW55IHVzZXItcmVtb3ZlZCkgd2l0aCBuZXdseSB1cGxvYWRlZCBmaWxlc1xyXG4gICAgICAgIGxldCBpbWFnZVVybHM6IHN0cmluZ1tdID0gWy4uLmV4aXN0aW5nSW1hZ2VVcmxzXTtcclxuICAgICAgICBpZiAoaW1hZ2VzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld1VybHMgPSBhd2FpdCB1cGxvYWRQcm9kdWN0SW1hZ2VzKGZpbmFsQ29tcGFueUlkLCBwcm9kdWN0SWQsIGltYWdlcyk7XHJcbiAgICAgICAgICAgIGltYWdlVXJscyA9IFsuLi5pbWFnZVVybHMsIC4uLm5ld1VybHNdO1xyXG4gICAgICAgICAgfSBjYXRjaCAodXBsb2FkRXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gSW1hZ2UgdXBsb2FkIGZhaWxlZDonLCB1cGxvYWRFcnIpO1xyXG4gICAgICAgICAgICBjb25zdCBtc2cgPSB1cGxvYWRFcnI/Lm1lc3NhZ2UgfHwgJ0ltYWdlcyBmYWlsZWQgdG8gdXBsb2FkLic7XHJcbiAgICAgICAgICAgIGNvbnN0IGlzQnVja2V0TWlzc2luZyA9IFN0cmluZyhtc2cpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2J1Y2tldCBub3QgZm91bmQnKTtcclxuICAgICAgICAgICAgdG9hc3QuZXJyb3IobXNnLCBpc0J1Y2tldE1pc3NpbmcgPyB7IGFjdGlvbjogeyBsYWJlbDogJ09wZW4gU3RvcmFnZScsIG9uQ2xpY2s6ICgpID0+IHdpbmRvdy5vcGVuKGdldFN1cGFiYXNlU3RvcmFnZURhc2hib2FyZFVybCgpLCAnX2JsYW5rJykgfSB9IDogdW5kZWZpbmVkKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGltYWdlVXJscy5sZW5ndGggPiAwKSAocHJvZHVjdERhdGEgYXMgYW55KS5pbWFnZV91cmxzID0gaW1hZ2VVcmxzO1xyXG5cclxuICAgICAgICAvLyBSVUxFIDU6IEJsb2NrIGVuYWJsaW5nIHZhcmlhdGlvbnMgd2hlbiBwcm9kdWN0IGhhcyBwYXJlbnQtbGV2ZWwgc3RvY2sgKHNob3cgbW9kYWwpXHJcbiAgICAgICAgaWYgKGVuYWJsZVZhcmlhdGlvbnMpIHtcclxuICAgICAgICAgIGNvbnN0IHBhcmVudExldmVsQ291bnQgPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmdldFBhcmVudExldmVsTW92ZW1lbnRDb3VudChwcm9kdWN0SWQpO1xyXG4gICAgICAgICAgaWYgKHBhcmVudExldmVsQ291bnQgPiAwKSB7XHJcbiAgICAgICAgICAgIHNldEJsb2NrVmFyaWF0aW9uc01vZGFsT3Blbih0cnVlKTtcclxuICAgICAgICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcclxuICAgICAgICAgICAgc3VibWl0SW5Qcm9ncmVzc1JlZi5jdXJyZW50ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE9wZW5pbmcgc3RvY2s6IG1vdmVtZW50LWJhc2VkIG9ubHk7IG5ldmVyIHNlbmQgY3VycmVudF9zdG9jayAocHJvZHVjdFNlcnZpY2Ugc3RyaXBzIGl0KS5cclxuICAgICAgICBjb25zdCBoYXNWYXJpYXRpb25zID0gZW5hYmxlVmFyaWF0aW9ucztcclxuICAgICAgICBjb25zdCBpbml0aWFsU3RvY2sgPSBOdW1iZXIoZGF0YS5pbml0aWFsU3RvY2spIHx8IDA7XHJcbiAgICAgICAgY29uc3QgbW92ZW1lbnRDb3VudCA9IGF3YWl0IGludmVudG9yeVNlcnZpY2UuZ2V0TW92ZW1lbnRDb3VudEZvclByb2R1Y3QocHJvZHVjdElkKTtcclxuICAgICAgICBkZWxldGUgKHByb2R1Y3REYXRhIGFzIGFueSkuY3VycmVudF9zdG9jaztcclxuICAgICAgICBpZiAoaGFzVmFyaWF0aW9ucykgKHByb2R1Y3REYXRhIGFzIGFueSkuY3VycmVudF9zdG9jayA9IDA7IC8vIFJVTEUgMTogcGFyZW50IG5ldmVyIGhvbGRzIHN0b2NrXHJcblxyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb2R1Y3RTZXJ2aWNlLnVwZGF0ZVByb2R1Y3QocHJvZHVjdElkLCBwcm9kdWN0RGF0YSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGJyYW5jaElkT3JOdWxsID0gYnJhbmNoSWQgJiYgYnJhbmNoSWQgIT09ICdhbGwnID8gYnJhbmNoSWQgOiBudWxsO1xyXG5cclxuICAgICAgICBpZiAoZW5hYmxlVmFyaWF0aW9ucyAmJiBnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aCA+IDAgJiYgZmluYWxDb21wYW55SWQpIHtcclxuICAgICAgICAgIGNvbnN0IHBhcmVudENvc3QgPSBOdW1iZXIoZGF0YS5wdXJjaGFzZVByaWNlKSB8fCAwO1xyXG4gICAgICAgICAgY29uc3QgcGFyZW50U2VsbCA9IE51bWJlcihkYXRhLnNlbGxpbmdQcmljZSkgfHwgMDtcclxuICAgICAgICAgIGZvciAoY29uc3Qgcm93IG9mIGdlbmVyYXRlZFZhcmlhdGlvbnMpIHtcclxuICAgICAgICAgICAgY29uc3QgcHVyY2hOID0gTnVtYmVyKHJvdy5wdXJjaGFzZVByaWNlKTtcclxuICAgICAgICAgICAgY29uc3Qgc2VsbE4gPSBOdW1iZXIocm93LnByaWNlKTtcclxuICAgICAgICAgICAgY29uc3QgY29zdCA9IE51bWJlci5pc0Zpbml0ZShwdXJjaE4pID8gcHVyY2hOIDogcGFyZW50Q29zdDtcclxuICAgICAgICAgICAgY29uc3Qgc2VsbGluZyA9IE51bWJlci5pc0Zpbml0ZShzZWxsTikgPyBzZWxsTiA6IHBhcmVudFNlbGw7XHJcbiAgICAgICAgICAgIGlmIChpbXBvcnQubWV0YS5lbnYuREVWKSB7XHJcbiAgICAgICAgICAgICAgaWYgKHJvdy5pZCAmJiAhTnVtYmVyLmlzRmluaXRlKHB1cmNoTikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcclxuICAgICAgICAgICAgICAgICAgJ1tQUk9EVUNUIEZPUk1dIFZhcmlhdGlvbiB1cGRhdGU6IHB1cmNoYXNlUHJpY2Ugbm90IGEgZmluaXRlIG51bWJlcjsgdXNpbmcgcGFyZW50IGNvc3QnLFxyXG4gICAgICAgICAgICAgICAgICByb3cuaWQsXHJcbiAgICAgICAgICAgICAgICAgIHJvd1xyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgaWYgKHJvdy5pZCAmJiAhTnVtYmVyLmlzRmluaXRlKHNlbGxOKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICAgICAgICAgICAnW1BST0RVQ1QgRk9STV0gVmFyaWF0aW9uIHVwZGF0ZTogc2VsbGluZyBwcmljZSBub3QgZmluaXRlOyB1c2luZyBwYXJlbnQgc2VsbGluZyBwcmljZScsXHJcbiAgICAgICAgICAgICAgICAgIHJvdy5pZCxcclxuICAgICAgICAgICAgICAgICAgcm93XHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBuYW1lID0gZm9ybWF0VmFyaWF0aW9uTmFtZShyb3cuY29tYmluYXRpb24pO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIGlmIChyb3cuaWQpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHByb2R1Y3RTZXJ2aWNlLnVwZGF0ZVZhcmlhdGlvbihyb3cuaWQsIHtcclxuICAgICAgICAgICAgICAgICAgc2t1OiByb3cuc2t1LFxyXG4gICAgICAgICAgICAgICAgICBiYXJjb2RlOiByb3cuYmFyY29kZSB8fCBudWxsLFxyXG4gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiByb3cuY29tYmluYXRpb24sXHJcbiAgICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgIGNvc3RfcHJpY2U6IGNvc3QsXHJcbiAgICAgICAgICAgICAgICAgIHJldGFpbF9wcmljZTogc2VsbGluZyxcclxuICAgICAgICAgICAgICAgICAgd2hvbGVzYWxlX3ByaWNlOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgICBwcmljZTogc2VsbGluZyxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYWxsb3dWID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5hbGxvd3NWYXJpYXRpb25PcGVuaW5nUmVjb25jaWxlRnJvbVByb2R1Y3RGb3JtKFxyXG4gICAgICAgICAgICAgICAgICBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgICAgICAgICAgcHJvZHVjdElkLFxyXG4gICAgICAgICAgICAgICAgICByb3cuaWQsXHJcbiAgICAgICAgICAgICAgICAgIGJyYW5jaElkT3JOdWxsXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgaWYgKGFsbG93Vikge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCB7IGVycm9yOiB2TW92RXJyIH0gPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLnJlY29uY2lsZVZhcmlhdGlvbk9wZW5pbmdTdG9jayhcclxuICAgICAgICAgICAgICAgICAgICBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgICAgICAgICAgICBicmFuY2hJZE9yTnVsbCxcclxuICAgICAgICAgICAgICAgICAgICBwcm9kdWN0SWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcm93LmlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlVmFyaWF0aW9uUXR5SW5wdXQoU3RyaW5nKHJvdy5zdG9jayA/PyAnJykpLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvc3RcclxuICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgaWYgKHZNb3ZFcnIpIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIFZhcmlhdGlvbiBvcGVuaW5nIHJlY29uY2lsZSBmYWlsZWQ6Jywgdk1vdkVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHEgPSBwYXJzZVZhcmlhdGlvblF0eUlucHV0KFN0cmluZyhyb3cuc3RvY2sgPz8gJycpKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcm9kdWN0U2VydmljZS5jcmVhdGVWYXJpYXRpb24oe1xyXG4gICAgICAgICAgICAgICAgICBwcm9kdWN0X2lkOiBwcm9kdWN0SWQsXHJcbiAgICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgIHNrdTogcm93LnNrdSxcclxuICAgICAgICAgICAgICAgICAgYmFyY29kZTogcm93LmJhcmNvZGUgfHwgbnVsbCxcclxuICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogcm93LmNvbWJpbmF0aW9uLFxyXG4gICAgICAgICAgICAgICAgICBjb3N0X3ByaWNlOiBjb3N0LFxyXG4gICAgICAgICAgICAgICAgICByZXRhaWxfcHJpY2U6IHNlbGxpbmcsXHJcbiAgICAgICAgICAgICAgICAgIGN1cnJlbnRfc3RvY2s6IHEsXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZpZCA9IChjcmVhdGVkIGFzIHsgaWQ/OiBzdHJpbmcgfSk/LmlkO1xyXG4gICAgICAgICAgICAgICAgaWYgKHEgPiAwICYmIHZpZCAmJiBmaW5hbENvbXBhbnlJZCkge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCB7IGVycm9yOiBtb3ZFcnIgfSA9IGF3YWl0IGludmVudG9yeVNlcnZpY2UuaW5zZXJ0T3BlbmluZ0JhbGFuY2VNb3ZlbWVudChcclxuICAgICAgICAgICAgICAgICAgICBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgICAgICAgICAgICBicmFuY2hJZE9yTnVsbCxcclxuICAgICAgICAgICAgICAgICAgICBwcm9kdWN0SWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcSxcclxuICAgICAgICAgICAgICAgICAgICBjb3N0LFxyXG4gICAgICAgICAgICAgICAgICAgIHZpZFxyXG4gICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICBpZiAobW92RXJyKSBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBWYXJpYXRpb24gb3BlbmluZyBtb3ZlbWVudCBmYWlsZWQ6JywgbW92RXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKHZlOiB1bmtub3duKSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gVmFyaWF0aW9uIHNhdmUgZmFpbGVkOicsIHZlKTtcclxuICAgICAgICAgICAgICB0b2FzdC53YXJuaW5nKCdQcm9kdWN0IHNhdmVkIGJ1dCBvbmUgb3IgbW9yZSB2YXJpYXRpb25zIGZhaWxlZCB0byBzYXZlLiBDaGVjayB0aGUgVmFyaWF0aW9ucyB0YWIuJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGNhblJlY29uY2lsZU9wZW5pbmcgPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmFsbG93c1BhcmVudE9wZW5pbmdSZWNvbmNpbGVGcm9tUHJvZHVjdEZvcm0oXHJcbiAgICAgICAgICBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgIHByb2R1Y3RJZCxcclxuICAgICAgICAgIGJyYW5jaElkT3JOdWxsXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgLy8gUGFyZW50LWxldmVsIG9wZW5pbmc6IG9ubHkgd2hlbiBzYWZlIChubyBzYWxlcy9wdXJjaGFzZXMgYWZ0ZXIgb3BlbmluZyDigJQgYXZvaWRzIG92ZXJ3cml0aW5nIG9wZW5pbmcgd2l0aCBvbi1oYW5kIHRvdGFsKS5cclxuICAgICAgICBpZiAoIWhhc1ZhcmlhdGlvbnMgJiYgZmluYWxDb21wYW55SWQgJiYgY2FuUmVjb25jaWxlT3BlbmluZykge1xyXG4gICAgICAgICAgY29uc3QgeyBlcnJvcjogbW92RXJyIH0gPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLnJlY29uY2lsZVBhcmVudExldmVsT3BlbmluZ1N0b2NrKFxyXG4gICAgICAgICAgICBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgICAgYnJhbmNoSWRPck51bGwsXHJcbiAgICAgICAgICAgIHByb2R1Y3RJZCxcclxuICAgICAgICAgICAgaW5pdGlhbFN0b2NrLFxyXG4gICAgICAgICAgICBOdW1iZXIoZGF0YS5wdXJjaGFzZVByaWNlKSB8fCAwLFxyXG4gICAgICAgICAgICBtb3ZlbWVudENvdW50XHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgaWYgKG1vdkVycikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBPcGVuaW5nIGJhbGFuY2UgbW92ZW1lbnQgZmFpbGVkOicsIG1vdkVycik7XHJcbiAgICAgICAgICAgIHRvYXN0LmVycm9yKCdQcm9kdWN0IHVwZGF0ZWQgYnV0IG9wZW5pbmcgc3RvY2sgY291bGQgbm90IGJlIHJlY29yZGVkLiBZb3UgY2FuIGFkZCBhbiBhZGp1c3RtZW50IGluIEludmVudG9yeS4nKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGNvbXBhbnlCcmFuY2hlcy5sZW5ndGggPiAxICYmIHByb2R1Y3RJZCkge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgcHJvZHVjdFNlcnZpY2Uuc2V0UHJvZHVjdEJyYW5jaEF2YWlsYWJpbGl0eShcclxuICAgICAgICAgICAgICBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgICAgICBwcm9kdWN0SWQsXHJcbiAgICAgICAgICAgICAgc2VsZWN0ZWRCcmFuY2hJZHMsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9IGNhdGNoIChicmFuY2hFcnIpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbUFJPRFVDVCBGT1JNXSBicmFuY2ggYXZhaWxhYmlsaXR5IHNhdmUgZmFpbGVkOicsIGJyYW5jaEVycik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgc2t1OiBmaW5hbFNLVSxcclxuICAgICAgICAgIGlkOiByZXN1bHQuaWQsXHJcbiAgICAgICAgICB1dWlkOiByZXN1bHQuaWQsXHJcbiAgICAgICAgICBpc1NlbGxhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgaXNSZW50YWJsZTogKGRhdGEucmVudGFsUHJpY2UgfHwgMCkgPiAwLFxyXG4gICAgICAgICAgdmFyaWF0aW9uczogZ2VuZXJhdGVkVmFyaWF0aW9ucyxcclxuICAgICAgICAgIGNvbWJvczogY29tYm9zLFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgdG9hc3Quc3VjY2VzcygnUHJvZHVjdCB1cGRhdGVkIHN1Y2Nlc3NmdWxseSEnKTtcclxuICAgICAgICBpZiAoYWN0aW9uID09PSBcInNhdmVBbmRBZGRcIiAmJiBvblNhdmVBbmRBZGQpIHtcclxuICAgICAgICAgIG9uU2F2ZUFuZEFkZChwYXlsb2FkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgb25TYXZlKHBheWxvYWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBDUkVBVEUgbmV3IHByb2R1Y3QgKG9yY2hlc3RyYXRlZCBwYXJlbnQgKyB2YXJpYXRpb25zKVxyXG4gICAgICAgIGNvbnN0IGJyYW5jaElkT3JOdWxsID0gYnJhbmNoSWQgJiYgYnJhbmNoSWQgIT09ICdhbGwnID8gYnJhbmNoSWQgOiBudWxsO1xyXG4gICAgICAgIGNvbnN0IGhhc1ZhcmlhdGlvbnMgPSBlbmFibGVWYXJpYXRpb25zO1xyXG4gICAgICAgIGNvbnN0IGluaXRpYWxTdG9jayA9IE51bWJlcihkYXRhLmluaXRpYWxTdG9jaykgfHwgMDtcclxuXHJcbiAgICAgICAgaWYgKGhhc1ZhcmlhdGlvbnMgJiYgZ2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGggPiBNQVhfVkFSSUFUSU9OUykge1xyXG4gICAgICAgICAgdG9hc3QuZXJyb3IoYFZhcmlhdGlvbiBsaW1pdCAoJHtNQVhfVkFSSUFUSU9OU30pIGV4Y2VlZGVkLiBTYXZlIHdpdGhvdXQgdmFyaWF0aW9ucyBvciByZWR1Y2UgdG8gJHtNQVhfVkFSSUFUSU9OU30gb3IgZmV3ZXIuYCk7XHJcbiAgICAgICAgICBzZXRTYXZpbmcoZmFsc2UpO1xyXG4gICAgICAgICAgc3VibWl0SW5Qcm9ncmVzc1JlZi5jdXJyZW50ID0gZmFsc2U7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBwYXJlbnRDb3N0ID0gTnVtYmVyKGRhdGEucHVyY2hhc2VQcmljZSkgfHwgMDtcclxuICAgICAgICBjb25zdCBwYXJlbnRTZWxsID0gTnVtYmVyKGRhdGEuc2VsbGluZ1ByaWNlKSB8fCAwO1xyXG4gICAgICAgIGNvbnN0IHZhcmlhdGlvblBheWxvYWQgPVxyXG4gICAgICAgICAgaGFzVmFyaWF0aW9ucyAmJiBnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aCA+IDBcclxuICAgICAgICAgICAgPyBnZW5lcmF0ZWRWYXJpYXRpb25zLm1hcCgodmFyaWF0aW9uKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwdXJjaE4gPSBOdW1iZXIodmFyaWF0aW9uLnB1cmNoYXNlUHJpY2UpO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2VsbE4gPSBOdW1iZXIodmFyaWF0aW9uLnByaWNlKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvc3QgPSBOdW1iZXIuaXNGaW5pdGUocHVyY2hOKSA/IHB1cmNoTiA6IHBhcmVudENvc3Q7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZXRhaWwgPSBOdW1iZXIuaXNGaW5pdGUoc2VsbE4pID8gc2VsbE4gOiBwYXJlbnRTZWxsO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgbmFtZTogZm9ybWF0VmFyaWF0aW9uTmFtZSh2YXJpYXRpb24uY29tYmluYXRpb24pLFxyXG4gICAgICAgICAgICAgICAgICBza3U6IHZhcmlhdGlvbi5za3UsXHJcbiAgICAgICAgICAgICAgICAgIGJhcmNvZGU6IHZhcmlhdGlvbi5iYXJjb2RlIHx8IG51bGwsXHJcbiAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHZhcmlhdGlvbi5jb21iaW5hdGlvbixcclxuICAgICAgICAgICAgICAgICAgY29zdF9wcmljZTogY29zdCxcclxuICAgICAgICAgICAgICAgICAgcmV0YWlsX3ByaWNlOiByZXRhaWwsXHJcbiAgICAgICAgICAgICAgICAgIG9wZW5pbmdfc3RvY2s6IHBhcnNlVmFyaWF0aW9uUXR5SW5wdXQoU3RyaW5nKHZhcmlhdGlvbi5zdG9jayA/PyAnJykpLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICA6IFtdO1xyXG5cclxuICAgICAgICBjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgcHJvZHVjdFNlcnZpY2Uuc2F2ZVByb2R1Y3RXaXRoVmFyaWF0aW9ucyh7XHJcbiAgICAgICAgICBjb21wYW55SWQ6IGZpbmFsQ29tcGFueUlkLFxyXG4gICAgICAgICAgYnJhbmNoSWRPck51bGwsXHJcbiAgICAgICAgICBwYXJlbnQ6IHtcclxuICAgICAgICAgICAgLi4ucHJvZHVjdERhdGEsXHJcbiAgICAgICAgICAgIG9wZW5pbmdfc3RvY2s6IGhhc1ZhcmlhdGlvbnMgPyAwIDogaW5pdGlhbFN0b2NrLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHZhcmlhdGlvbnM6IHZhcmlhdGlvblBheWxvYWQsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaW5jcmVtZW50TmV4dE51bWJlcigncHJvZHVjdGlvbicpO1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHsgaWQ6IHNhdmVSZXN1bHQucHJvZHVjdElkIH07XHJcblxyXG4gICAgICAgIGlmIChjb21wYW55QnJhbmNoZXMubGVuZ3RoID4gMSAmJiByZXN1bHQ/LmlkKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBwcm9kdWN0U2VydmljZS5zZXRQcm9kdWN0QnJhbmNoQXZhaWxhYmlsaXR5KFxyXG4gICAgICAgICAgICAgIGZpbmFsQ29tcGFueUlkLFxyXG4gICAgICAgICAgICAgIHJlc3VsdC5pZCxcclxuICAgICAgICAgICAgICBzZWxlY3RlZEJyYW5jaElkcyxcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKGJyYW5jaEVycikge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1tQUk9EVUNUIEZPUk1dIGJyYW5jaCBhdmFpbGFiaWxpdHkgc2F2ZSBmYWlsZWQ6JywgYnJhbmNoRXJyKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFVwbG9hZCBwcm9kdWN0IGltYWdlcyBhbmQgc2F2ZSBVUkxzXHJcbiAgICAgICAgaWYgKGltYWdlcy5sZW5ndGggPiAwICYmIHJlc3VsdD8uaWQpIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGltYWdlVXJscyA9IGF3YWl0IHVwbG9hZFByb2R1Y3RJbWFnZXMoZmluYWxDb21wYW55SWQsIHJlc3VsdC5pZCwgaW1hZ2VzKTtcclxuICAgICAgICAgICAgYXdhaXQgcHJvZHVjdFNlcnZpY2UudXBkYXRlUHJvZHVjdChyZXN1bHQuaWQsIHsgaW1hZ2VfdXJsczogaW1hZ2VVcmxzIH0pO1xyXG4gICAgICAgICAgfSBjYXRjaCAodXBsb2FkRXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gSW1hZ2UgdXBsb2FkIGZhaWxlZDonLCB1cGxvYWRFcnIpO1xyXG4gICAgICAgICAgICBjb25zdCBtc2cgPSB1cGxvYWRFcnI/Lm1lc3NhZ2UgfHwgJ1Byb2R1Y3Qgc2F2ZWQgYnV0IGltYWdlcyBmYWlsZWQgdG8gdXBsb2FkLic7XHJcbiAgICAgICAgICAgIGNvbnN0IGlzQnVja2V0TWlzc2luZyA9IFN0cmluZyhtc2cpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2J1Y2tldCBub3QgZm91bmQnKTtcclxuICAgICAgICAgICAgdG9hc3QuZXJyb3IobXNnLCBpc0J1Y2tldE1pc3NpbmcgPyB7IGFjdGlvbjogeyBsYWJlbDogJ09wZW4gU3RvcmFnZScsIG9uQ2xpY2s6ICgpID0+IHdpbmRvdy5vcGVuKGdldFN1cGFiYXNlU3RvcmFnZURhc2hib2FyZFVybCgpLCAnX2JsYW5rJykgfSB9IDogdW5kZWZpbmVkKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSB7XHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgc2t1OiBmaW5hbFNLVSxcclxuICAgICAgICAgIGlkOiByZXN1bHQuaWQsXHJcbiAgICAgICAgICBpc1NlbGxhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgaXNSZW50YWJsZTogKGRhdGEucmVudGFsUHJpY2UgfHwgMCkgPiAwLFxyXG4gICAgICAgICAgdmFyaWF0aW9uczogZ2VuZXJhdGVkVmFyaWF0aW9ucyxcclxuICAgICAgICAgIGNvbWJvczogY29tYm9zLFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmIChnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHRvYXN0LnN1Y2Nlc3MoYFByb2R1Y3QgY3JlYXRlZCB3aXRoICR7Z2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGh9IHZhcmlhdGlvbnMhYCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRvYXN0LnN1Y2Nlc3MoJ1Byb2R1Y3QgY3JlYXRlZCBzdWNjZXNzZnVsbHkhJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoYWN0aW9uID09PSBcInNhdmVBbmRBZGRcIiAmJiBvblNhdmVBbmRBZGQpIHtcclxuICAgICAgICAgIG9uU2F2ZUFuZEFkZChwYXlsb2FkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgb25TYXZlKHBheWxvYWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zdCB3YXNFZGl0ID0gISEoaW5pdGlhbFByb2R1Y3Q/LnV1aWQgPz8gaW5pdGlhbFByb2R1Y3Q/LmlkKTtcclxuICAgICAgY29uc3QgbXNnID0gZXJyb3I/Lm1lc3NhZ2UgfHwgJ1Vua25vd24gZXJyb3InO1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBFcnJvciBzYXZpbmcgcHJvZHVjdDonLCBlcnJvcik7XHJcbiAgICAgIGlmIChtc2cuaW5jbHVkZXMoJ1NLVScpICYmIG1zZy5pbmNsdWRlcygnYWxyZWFkeScpICYmICF3YXNFZGl0KSB7XHJcbiAgICAgICAgdG9hc3QuZXJyb3IobXNnLCB7IGR1cmF0aW9uOiA2MDAwIH0pO1xyXG4gICAgICAgIGluY3JlbWVudE5leHROdW1iZXIoJ3Byb2R1Y3Rpb24nKTsgLy8gZnJlZSB0aGUgZHVwbGljYXRlIG51bWJlciBzbyBuZXh0IGdlbmVyYXRlIGlzIHVuaXF1ZVxyXG4gICAgICAgIHNldFZhbHVlKCdza3UnLCBnZW5lcmF0ZVNLVSgpKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0b2FzdC5lcnJvcih3YXNFZGl0ID8gJ0ZhaWxlZCB0byB1cGRhdGUgcHJvZHVjdDogJyArIG1zZyA6ICdGYWlsZWQgdG8gY3JlYXRlIHByb2R1Y3Q6ICcgKyBtc2cpO1xyXG4gICAgICB9XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBzZXRTYXZpbmcoZmFsc2UpO1xyXG4gICAgICBzdWJtaXRJblByb2dyZXNzUmVmLmN1cnJlbnQgPSBmYWxzZTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICByZXR1cm4gKFxyXG4gICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIGgtZnVsbCBtaW4taC0wIGJnLWdyYXktOTUwIHRleHQtd2hpdGUgcmVsYXRpdmVcIj5cclxuICAgICAge2xvYWRpbmdGdWxsUHJvZHVjdCAmJiBpbml0aWFsUHJvZHVjdCAmJiAoXHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSBpbnNldC0wIGJnLWdyYXktOTUwLzgwIHotMjAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC14bFwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBnYXAtM1wiPlxyXG4gICAgICAgICAgICA8UmVmcmVzaENjdyBzaXplPXszMn0gY2xhc3NOYW1lPVwidGV4dC1ibHVlLTQwMCBhbmltYXRlLXNwaW5cIiAvPlxyXG4gICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5Mb2FkaW5nIHByb2R1Y3QuLi48L3A+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKX1cclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJwLTYgYm9yZGVyLWIgYm9yZGVyLWdyYXktODAwIGZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlciBiZy1ncmF5LTkwMCBzdGlja3kgdG9wLTAgei0xMFwiPlxyXG4gICAgICAgIDxkaXY+XHJcbiAgICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC14bCBmb250LWJvbGRcIj57aW5pdGlhbFByb2R1Y3QgPyAnRWRpdCBQcm9kdWN0JyA6ICdBZGQgTmV3IFByb2R1Y3QnfTwvaDI+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5cclxuICAgICAgICAgICAge2luaXRpYWxQcm9kdWN0ID8gJ1VwZGF0ZSBwcm9kdWN0IGRldGFpbHMnIDogJ0NvbXBsZXRlIHByb2R1Y3QgZGV0YWlscyBmb3IgaW52ZW50b3J5J31cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICBvbkNsaWNrPXtvbkNhbmNlbH1cclxuICAgICAgICAgIGNsYXNzTmFtZT1cInAtMiBob3ZlcjpiZy1ncmF5LTgwMCByb3VuZGVkLWZ1bGxcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxYIHNpemU9ezIwfSAvPlxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIHsvKiBUYWIgTmF2aWdhdGlvbiAqL31cclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJib3JkZXItYiBib3JkZXItZ3JheS04MDAgYmctZ3JheS05MDAgc3RpY2t5IHRvcC1bODlweF0gei0xMFwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBweC02IG92ZXJmbG93LXgtYXV0b1wiPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRBY3RpdmVUYWIoJ2Jhc2ljJyl9XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICBcInB4LTYgcHktMyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGJvcmRlci1iLTIgdHJhbnNpdGlvbi1jb2xvcnMgd2hpdGVzcGFjZS1ub3dyYXBcIixcclxuICAgICAgICAgICAgICBhY3RpdmVUYWIgPT09ICdiYXNpYydcclxuICAgICAgICAgICAgICAgID8gXCJib3JkZXItYmx1ZS01MDAgdGV4dC13aGl0ZVwiXHJcbiAgICAgICAgICAgICAgICA6IFwiYm9yZGVyLXRyYW5zcGFyZW50IHRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC1ncmF5LTMwMFwiXHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIEJhc2ljIEluZm9cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRBY3RpdmVUYWIoJ3ByaWNpbmcnKX1cclxuICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgIFwicHgtNiBweS0zIHRleHQtc20gZm9udC1tZWRpdW0gYm9yZGVyLWItMiB0cmFuc2l0aW9uLWNvbG9ycyB3aGl0ZXNwYWNlLW5vd3JhcFwiLFxyXG4gICAgICAgICAgICAgIGFjdGl2ZVRhYiA9PT0gJ3ByaWNpbmcnXHJcbiAgICAgICAgICAgICAgICA/IFwiYm9yZGVyLWJsdWUtNTAwIHRleHQtd2hpdGVcIlxyXG4gICAgICAgICAgICAgICAgOiBcImJvcmRlci10cmFuc3BhcmVudCB0ZXh0LWdyYXktNDAwIGhvdmVyOnRleHQtZ3JheS0zMDBcIlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICBQcmljaW5nICYgVGF4XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QWN0aXZlVGFiKCdpbnZlbnRvcnknKX1cclxuICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgIFwicHgtNiBweS0zIHRleHQtc20gZm9udC1tZWRpdW0gYm9yZGVyLWItMiB0cmFuc2l0aW9uLWNvbG9ycyB3aGl0ZXNwYWNlLW5vd3JhcFwiLFxyXG4gICAgICAgICAgICAgIGFjdGl2ZVRhYiA9PT0gJ2ludmVudG9yeSdcclxuICAgICAgICAgICAgICAgID8gXCJib3JkZXItYmx1ZS01MDAgdGV4dC13aGl0ZVwiXHJcbiAgICAgICAgICAgICAgICA6IFwiYm9yZGVyLXRyYW5zcGFyZW50IHRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC1ncmF5LTMwMFwiXHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIEludmVudG9yeVxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEFjdGl2ZVRhYignbWVkaWEnKX1cclxuICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgIFwicHgtNiBweS0zIHRleHQtc20gZm9udC1tZWRpdW0gYm9yZGVyLWItMiB0cmFuc2l0aW9uLWNvbG9ycyB3aGl0ZXNwYWNlLW5vd3JhcFwiLFxyXG4gICAgICAgICAgICAgIGFjdGl2ZVRhYiA9PT0gJ21lZGlhJ1xyXG4gICAgICAgICAgICAgICAgPyBcImJvcmRlci1ibHVlLTUwMCB0ZXh0LXdoaXRlXCJcclxuICAgICAgICAgICAgICAgIDogXCJib3JkZXItdHJhbnNwYXJlbnQgdGV4dC1ncmF5LTQwMCBob3Zlcjp0ZXh0LWdyYXktMzAwXCJcclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgTWVkaWFcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRBY3RpdmVUYWIoJ2RldGFpbHMnKX1cclxuICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgIFwicHgtNiBweS0zIHRleHQtc20gZm9udC1tZWRpdW0gYm9yZGVyLWItMiB0cmFuc2l0aW9uLWNvbG9ycyB3aGl0ZXNwYWNlLW5vd3JhcFwiLFxyXG4gICAgICAgICAgICAgIGFjdGl2ZVRhYiA9PT0gJ2RldGFpbHMnXHJcbiAgICAgICAgICAgICAgICA/IFwiYm9yZGVyLWJsdWUtNTAwIHRleHQtd2hpdGVcIlxyXG4gICAgICAgICAgICAgICAgOiBcImJvcmRlci10cmFuc3BhcmVudCB0ZXh0LWdyYXktNDAwIGhvdmVyOnRleHQtZ3JheS0zMDBcIlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICBEZXRhaWxzXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIHtlbmFibGVWYXJpYXRpb25zICYmIChcclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEFjdGl2ZVRhYigndmFyaWF0aW9ucycpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICAgIFwicHgtNiBweS0zIHRleHQtc20gZm9udC1tZWRpdW0gYm9yZGVyLWItMiB0cmFuc2l0aW9uLWNvbG9ycyB3aGl0ZXNwYWNlLW5vd3JhcFwiLFxyXG4gICAgICAgICAgICAgICAgYWN0aXZlVGFiID09PSAndmFyaWF0aW9ucydcclxuICAgICAgICAgICAgICAgICAgPyBcImJvcmRlci1ibHVlLTUwMCB0ZXh0LXdoaXRlXCJcclxuICAgICAgICAgICAgICAgICAgOiBcImJvcmRlci10cmFuc3BhcmVudCB0ZXh0LWdyYXktNDAwIGhvdmVyOnRleHQtZ3JheS0zMDBcIlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICBWYXJpYXRpb25zIHtnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aCA+IDAgJiYgYCgke2dlbmVyYXRlZFZhcmlhdGlvbnMubGVuZ3RofSAvICR7TUFYX1ZBUklBVElPTlN9KWB9XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgKX1cclxuICAgICAgICAgIHttb2R1bGVzLmNvbWJvc0VuYWJsZWQgJiYgaXNDb21ib1Byb2R1Y3QgJiYgKFxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRBY3RpdmVUYWIoJ2NvbWJvcycpfVxyXG4gICAgICAgICAgICBjbGFzc05hbWU9e2Nsc3goXHJcbiAgICAgICAgICAgICAgXCJweC02IHB5LTMgdGV4dC1zbSBmb250LW1lZGl1bSBib3JkZXItYi0yIHRyYW5zaXRpb24tY29sb3JzIHdoaXRlc3BhY2Utbm93cmFwXCIsXHJcbiAgICAgICAgICAgICAgYWN0aXZlVGFiID09PSAnY29tYm9zJ1xyXG4gICAgICAgICAgICAgICAgPyBcImJvcmRlci1ibHVlLTUwMCB0ZXh0LXdoaXRlXCJcclxuICAgICAgICAgICAgICAgIDogXCJib3JkZXItdHJhbnNwYXJlbnQgdGV4dC1ncmF5LTQwMCBob3Zlcjp0ZXh0LWdyYXktMzAwXCJcclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgQ29tYm9zIHtjb21ib3MubGVuZ3RoID4gMCAmJiBgKCR7Y29tYm9zLmxlbmd0aH0pYH1cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgKX1cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBvdmVyZmxvdy15LWF1dG8gcC02IHNwYWNlLXktNlwiPlxyXG4gICAgICAgIHsvKiBUQUIgMSAtIEJBU0lDIElORk8gKi99XHJcbiAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ2Jhc2ljJyAmJiAoXHJcbiAgICAgICAgICA8PlxyXG4gICAgICAgICAgICB7LyogU2VjdGlvbiAxOiBCYXNpYyBJbmZvICovfVxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgYm9yZGVyLWwtNCBib3JkZXItYmx1ZS01MDAgcGwtMyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgPFBhY2thZ2Ugc2l6ZT17MjB9IC8+XHJcbiAgICAgICAgICAgICAgICBQcm9kdWN0IElkZW50aXR5XHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWQ6Y29sLXNwYW4tMlwiPlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgaHRtbEZvcj1cIm5hbWVcIiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgUHJvZHVjdCBOYW1lICpcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgaWQ9XCJuYW1lXCJcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJuYW1lXCIpfVxyXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiZS5nLiBDb3R0b24gUHJlbWl1bSBTaGlydFwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIHtlcnJvcnMubmFtZSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNTAwIHRleHQteHMgbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAge2Vycm9ycy5uYW1lLm1lc3NhZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGh0bWxGb3I9XCJza3VcIiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgU0tVIC8gQ29kZSAqXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicmVsYXRpdmUgbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgaWQ9XCJza3VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwic2t1XCIpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJBVVRPLUdFTkVSQVRFRFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBwci0xMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2dlbmVyYXRlU0tVRm9yRm9ybX1cclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIHJpZ2h0LTIgdG9wLTEvMiAtdHJhbnNsYXRlLXktMS8yIHRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC13aGl0ZSB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPFJlZnJlc2hDY3cgc2l6ZT17MTZ9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICB7ZXJyb3JzLnNrdSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNTAwIHRleHQteHMgbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAge2Vycm9ycy5za3UubWVzc2FnZX1cclxuICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgey8qIFNlY3Rpb24gMjogQ2xhc3NpZmljYXRpb24gKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1wdXJwbGUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIENsYXNzaWZpY2F0aW9uXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+QnJhbmQ8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICB7bG9hZGluZ0JyYW5kcyA/IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBoLTkgaXRlbXMtY2VudGVyIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCBiZy1ncmF5LTgwMCBweC0zIHRleHQtc20gdGV4dC1ncmF5LTQwMFwiPkxvYWRpbmcgYnJhbmRzLi4uPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxTZWFyY2hhYmxlU2VsZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXt3YXRjaCgnYnJhbmQnKSA/PyAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25WYWx1ZUNoYW5nZT17KHYpID0+IHNldFZhbHVlKCdicmFuZCcsIHYpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zPXticmFuZHN9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VsZWN0IEJyYW5kXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VhcmNoUGxhY2Vob2xkZXI9XCJTZWFyY2ggYnJhbmQuLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbXB0eVRleHQ9XCJObyBicmFuZCBmb3VuZC5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBoLTlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVBZGROZXdcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkTmV3TGFiZWw9XCJBZGQgQnJhbmRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkFkZE5ldz17YXN5bmMgKHNlYXJjaFRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gKHNlYXJjaFRleHQgfHwgJycpLnRyaW0oKSB8fCAnTmV3IEJyYW5kJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBicmFuZFNlcnZpY2UuY3JlYXRlKHsgY29tcGFueV9pZDogY29tcGFueUlkLCBuYW1lIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0QnJhbmRzKChwcmV2KSA9PiBbLi4ucHJldiwgeyBpZDogY3JlYXRlZC5pZCwgbmFtZTogY3JlYXRlZC5uYW1lIH1dKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKCdicmFuZCcsIGNyZWF0ZWQuaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9hc3Quc3VjY2VzcygnQnJhbmQgYWRkZWQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2FzdC5lcnJvcignRmFpbGVkIHRvIGFkZCBicmFuZCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPkNhdGVnb3J5PC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAge2xvYWRpbmdDYXRlZ29yaWVzID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGgtOSBpdGVtcy1jZW50ZXIgcm91bmRlZC1tZCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIGJnLWdyYXktODAwIHB4LTMgdGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+TG9hZGluZyBjYXRlZ29yaWVzLi4uPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxTZWFyY2hhYmxlU2VsZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXt3YXRjaCgnY2F0ZWdvcnknKSA/PyAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25WYWx1ZUNoYW5nZT17KHYpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZSgnY2F0ZWdvcnknLCB2KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZSgnc3ViQ2F0ZWdvcnknLCAnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM9e2NhdGVnb3JpZXN9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VsZWN0IENhdGVnb3J5XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VhcmNoUGxhY2Vob2xkZXI9XCJTZWFyY2ggY2F0ZWdvcnkuLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbXB0eVRleHQ9XCJObyBjYXRlZ29yeSBmb3VuZC5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBoLTlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVBZGROZXdcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkTmV3TGFiZWw9XCJBZGQgQ2F0ZWdvcnlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkFkZE5ldz17YXN5bmMgKHNlYXJjaFRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gKHNlYXJjaFRleHQgfHwgJycpLnRyaW0oKSB8fCAnTmV3IENhdGVnb3J5JztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZSh7IGNvbXBhbnlfaWQ6IGNvbXBhbnlJZCwgbmFtZSwgcGFyZW50X2lkOiBudWxsIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0Q2F0ZWdvcmllcygocHJldikgPT4gWy4uLnByZXYsIHsgaWQ6IGNyZWF0ZWQuaWQsIG5hbWU6IGNyZWF0ZWQubmFtZSB9XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZSgnY2F0ZWdvcnknLCBjcmVhdGVkLmlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKCdzdWJDYXRlZ29yeScsICcnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvYXN0LnN1Y2Nlc3MoJ0NhdGVnb3J5IGFkZGVkJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9hc3QuZXJyb3IoJ0ZhaWxlZCB0byBhZGQgY2F0ZWdvcnknKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5TdWItQ2F0ZWdvcnk8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICB7IXNlbGVjdGVkQ2F0ZWdvcnlJZCA/IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBoLTkgaXRlbXMtY2VudGVyIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCBiZy1ncmF5LTgwMCBweC0zIHRleHQtc20gdGV4dC1ncmF5LTUwMFwiPlNlbGVjdCBhIGNhdGVnb3J5IGZpcnN0PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxTZWFyY2hhYmxlU2VsZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXt3YXRjaCgnc3ViQ2F0ZWdvcnknKSA/PyAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25WYWx1ZUNoYW5nZT17KHYpID0+IHNldFZhbHVlKCdzdWJDYXRlZ29yeScsIHYpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zPXtzdWJDYXRlZ29yaWVzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlbGVjdCBTdWItQ2F0ZWdvcnlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2hQbGFjZWhvbGRlcj1cIlNlYXJjaCBzdWItY2F0ZWdvcnkuLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbXB0eVRleHQ9XCJObyBzdWItY2F0ZWdvcnkgZm91bmQuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgaC05XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlQWRkTmV3XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZE5ld0xhYmVsPVwiQWRkIFN1Yi1DYXRlZ29yeVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQWRkTmV3PXthc3luYyAoc2VhcmNoVGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY29tcGFueUlkIHx8ICFzZWxlY3RlZENhdGVnb3J5SWQpIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChzZWFyY2hUZXh0IHx8ICcnKS50cmltKCkgfHwgJ05ldyBTdWItQ2F0ZWdvcnknO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByb2R1Y3RDYXRlZ29yeVNlcnZpY2UuY3JlYXRlKHsgY29tcGFueV9pZDogY29tcGFueUlkLCBuYW1lLCBwYXJlbnRfaWQ6IHNlbGVjdGVkQ2F0ZWdvcnlJZCB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFN1YkNhdGVnb3JpZXMoKHByZXYpID0+IFsuLi5wcmV2LCB7IGlkOiBjcmVhdGVkLmlkLCBuYW1lOiBjcmVhdGVkLm5hbWUgfV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoJ3N1YkNhdGVnb3J5JywgY3JlYXRlZC5pZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2FzdC5zdWNjZXNzKCdTdWItY2F0ZWdvcnkgYWRkZWQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2FzdC5lcnJvcignRmFpbGVkIHRvIGFkZCBzdWItY2F0ZWdvcnknKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5Vbml0PC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAge2xvYWRpbmdVbml0cyA/IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBoLTkgaXRlbXMtY2VudGVyIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCBiZy1ncmF5LTgwMCBweC0zIHRleHQtc20gdGV4dC1ncmF5LTQwMFwiPkxvYWRpbmcgdW5pdHMuLi48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPFNlYXJjaGFibGVTZWxlY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3dhdGNoKCd1bml0JykgPz8gJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uVmFsdWVDaGFuZ2U9eyh2KSA9PiBzZXRWYWx1ZSgndW5pdCcsIHYpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zPXt1bml0cy5tYXAoKHUpID0+ICh7IGlkOiB1LmlkLCBuYW1lOiBgJHt1Lm5hbWV9ICgke3Uuc2hvcnRfY29kZSB8fCB1LnN5bWJvbCB8fCAn4oCUJ30pYCB9KSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VsZWN0IFVuaXRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2hQbGFjZWhvbGRlcj1cIlNlYXJjaCB1bml0Li4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW1wdHlUZXh0PVwiTm8gdW5pdCBmb3VuZC4gQWRkIHVuaXRzIGluIFNldHRpbmdzIOKGkiBJbnZlbnRvcnkg4oaSIFVuaXRzLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIGgtOVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgey8qIFNlY3Rpb24gMzogQmFzaWMgUHJpY2luZyAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWdyZWVuLTUwMCBwbC0zIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICA8RG9sbGFyU2lnbiBzaXplPXsyMH0gLz5cclxuICAgICAgICAgICAgICAgIFF1aWNrIFByaWNpbmdcclxuICAgICAgICAgICAgICA8L2gzPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBQdXJjaGFzZSBQcmljZVxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJwdXJjaGFzZVByaWNlXCIsIHsgc2V0VmFsdWVBczogc2V0VmFsdWVBc051bWJlciB9KX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjAuMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIENvc3QgcHJpY2UgZnJvbSBzdXBwbGllclxyXG4gICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIFNlbGxpbmcgUHJpY2UgKlxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJzZWxsaW5nUHJpY2VcIiwgeyBzZXRWYWx1ZUFzOiBzZXRWYWx1ZUFzTnVtYmVyIH0pfVxyXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMC4wMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgICAgICAgICAgXCJiZy1ncmVlbi05MDAvMzAgYm9yZGVyLWdyZWVuLTcwMCB0ZXh0LXdoaXRlIG10LTEgZm9udC1ib2xkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMuc2VsbGluZ1ByaWNlICYmXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiYm9yZGVyLXJlZC01MDAgcmluZy0xIHJpbmctcmVkLTUwMFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIHtlcnJvcnMuc2VsbGluZ1ByaWNlICYmIChcclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXJlZC01MDAgdGV4dC14cyBtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICB7ZXJyb3JzLnNlbGxpbmdQcmljZS5tZXNzYWdlfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICBGaW5hbCBwcmljZSBmb3IgY3VzdG9tZXJzXHJcbiAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctYmx1ZS05MDAvMTAgYm9yZGVyIGJvcmRlci1ibHVlLTkwMC8zMCBwLTMgcm91bmRlZC1tZCB0ZXh0LXhzIHRleHQtYmx1ZS0zMDBcIj5cclxuICAgICAgICAgICAgICAgIPCfkqEgPHN0cm9uZz5UaXA6PC9zdHJvbmc+IEZvciBhZHZhbmNlZCBwcmljaW5nIG9wdGlvbnMgKHdob2xlc2FsZSwgYnVsaywgcmV0YWlsKSwgZ28gdG8gdGhlIFwiUHJpY2luZyAmIFRheFwiIHRhYi5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPC8+XHJcbiAgICAgICAgKX1cclxuXHJcbiAgICAgICAgey8qIFRBQiAyIC0gUFJJQ0lORyAmIFRBWCAqL31cclxuICAgICAgICB7YWN0aXZlVGFiID09PSAncHJpY2luZycgJiYgKFxyXG4gICAgICAgICAgPD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWdyZWVuLTUwMCBwbC0zIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICA8RG9sbGFyU2lnbiBzaXplPXsyMH0gLz5cclxuICAgICAgICAgICAgICAgIEJhc2ljIFByaWNpbmdcclxuICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTMgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgUHVyY2hhc2UgUHJpY2VcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwicHVyY2hhc2VQcmljZVwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5Db3N0IGZyb20gc3VwcGxpZXI8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIFByb2ZpdCBNYXJnaW4gKCUpXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcIm1hcmdpblwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5BdXRvLWNhbGN1bGF0ZSBzZWxsaW5nIHByaWNlPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBTZWxsaW5nIFByaWNlICpcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwic2VsbGluZ1ByaWNlXCIsIHsgc2V0VmFsdWVBczogc2V0VmFsdWVBc051bWJlciB9KX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjAuMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICAgICAgICAgIFwiYmctZ3JlZW4tOTAwLzMwIGJvcmRlci1ncmVlbi03MDAgdGV4dC13aGl0ZSBtdC0xIGZvbnQtYm9sZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnNlbGxpbmdQcmljZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImJvcmRlci1yZWQtNTAwIHJpbmctMSByaW5nLXJlZC01MDBcIixcclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICB7ZXJyb3JzLnNlbGxpbmdQcmljZSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNTAwIHRleHQteHMgbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAge2Vycm9ycy5zZWxsaW5nUHJpY2UubWVzc2FnZX1cclxuICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+UmV0YWlsIHByaWNlPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWJsdWUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIEFkdmFuY2VkIFByaWNpbmcgVGllcnNcclxuICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgV2hvbGVzYWxlIFByaWNlXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcIndob2xlc2FsZVByaWNlXCIsIHsgc2V0VmFsdWVBczogc2V0VmFsdWVBc051bWJlciB9KX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjAuMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgbXQtMVwiPlByaWNlIGZvciB3aG9sZXNhbGUgY3VzdG9tZXJzPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBSZXRhaWwgUHJpY2VcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5QcmljZSBmb3IgcmV0YWlsIGN1c3RvbWVyczwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgQnVsayBQcmljZSAoMTArIGl0ZW1zKVxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjAuMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgbXQtMVwiPlNwZWNpYWwgcHJpY2UgZm9yIGJ1bGsgb3JkZXJzPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBNaW5pbXVtIE9yZGVyIFF1YW50aXR5XHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMVwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+TWluaW11bSBxdWFudGl0eSB0byBvcmRlcjwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXB1cnBsZS05MDAvMTAgYm9yZGVyIGJvcmRlci1wdXJwbGUtODAwIHAtNCByb3VuZGVkLWxnXCI+XHJcbiAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtcHVycGxlLTMwMCBtYi0yXCI+8J+SsCBQcmljaW5nIFN1bW1hcnk8L2g0PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0yIG1kOmdyaWQtY29scy00IGdhcC0zIHRleHQteHNcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwXCI+UHVyY2hhc2U6PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtd2hpdGUgZm9udC1ib2xkXCI+4oKoe3dhdGNoKCdwdXJjaGFzZVByaWNlJykgfHwgMH08L3A+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDBcIj5TZWxsaW5nOjwvcD5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTQwMCBmb250LWJvbGRcIj7igqh7d2F0Y2goJ3NlbGxpbmdQcmljZScpIHx8IDB9PC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwXCI+TWFyZ2luOjwvcD5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNDAwIGZvbnQtYm9sZFwiPnt3YXRjaCgnbWFyZ2luJykgfHwgMH0lPC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwXCI+UHJvZml0OjwvcD5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXllbGxvdy00MDAgZm9udC1ib2xkXCI+4oKoeygod2F0Y2goJ3NlbGxpbmdQcmljZScpIHx8IDApIC0gKHdhdGNoKCdwdXJjaGFzZVByaWNlJykgfHwgMCkpLnRvRml4ZWQoMil9PC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1wdXJwbGUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIFRheCBDb25maWd1cmF0aW9uXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlRheCBUeXBlPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPENvbnRyb2xsZXJcclxuICAgICAgICAgICAgICAgICAgICBjb250cm9sPXtjb250cm9sfVxyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU9XCJ0YXhUeXBlXCJcclxuICAgICAgICAgICAgICAgICAgICByZW5kZXI9eyh7IGZpZWxkIH0pID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25WYWx1ZUNoYW5nZT17ZmllbGQub25DaGFuZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHRWYWx1ZT17ZmllbGQudmFsdWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RUcmlnZ2VyIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0VmFsdWUgcGxhY2Vob2xkZXI9XCJTZWxlY3QgVGF4IFR5cGVcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L1NlbGVjdFRyaWdnZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RDb250ZW50IGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTgwMCB0ZXh0LXdoaXRlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdEl0ZW0gdmFsdWU9XCJleGNsdXNpdmVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEV4Y2x1c2l2ZSAoVGF4IEFkZGVkKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvU2VsZWN0SXRlbT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0SXRlbSB2YWx1ZT1cImluY2x1c2l2ZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgSW5jbHVzaXZlIChUYXggSW5jbHVkZWQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3RJdGVtPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RJdGVtIHZhbHVlPVwiZXhlbXB0XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBUYXggRXhlbXB0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3RJdGVtPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L1NlbGVjdENvbnRlbnQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L1NlbGVjdD5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWJsdWUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIFJlbnRhbCBQcmljaW5nIChPcHRpb25hbClcclxuICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWJsdWUtOTAwLzEwIGJvcmRlciBib3JkZXItYmx1ZS05MDAvMzAgcC0zIHJvdW5kZWQtbWQgdGV4dC14cyB0ZXh0LWJsdWUtMzAwIG1iLTRcIj5cclxuICAgICAgICAgICAgICAgIExlYXZlIHRoZXNlIGZpZWxkcyBlbXB0eSB0byBkZWNpZGUgdGhlIHJlbnRhbCBwcmljZSBhdCB0aGUgdGltZSBvZiBib29raW5nLlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgRGVmYXVsdCBSZW50IFByaWNlXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcInJlbnRhbFByaWNlXCIsIHsgc2V0VmFsdWVBczogc2V0VmFsdWVBc051bWJlciB9KX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjAuMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBTZWN1cml0eSBEZXBvc2l0XHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcInNlY3VyaXR5RGVwb3NpdFwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvPlxyXG4gICAgICAgICl9XHJcblxyXG4gICAgICAgIHsvKiBUQUIgMyAtIElOVkVOVE9SWSAqL31cclxuICAgICAgICB7YWN0aXZlVGFiID09PSAnaW52ZW50b3J5JyAmJiAoXHJcbiAgICAgICAgICA8PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgIHtjb21wYW55QnJhbmNoZXMubGVuZ3RoID4gMSAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtMyBiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgc3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIGZvbnQtbWVkaXVtXCI+QXZhaWxhYmxlIGluIGJyYW5jaGVzPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwXCI+U2VsZWN0IHdoaWNoIGJyYW5jaGVzIGNhbiBzZWxsIHRoaXMgcHJvZHVjdC48L3A+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAge2NvbXBhbnlCcmFuY2hlcy5tYXAoKGIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoZWNrZWQgPSBzZWxlY3RlZEJyYW5jaElkcy5pbmNsdWRlcyhiLmlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBrZXk9e2IuaWR9IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQtc20gdGV4dC1ncmF5LTIwMCBjdXJzb3ItcG9pbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImNoZWNrYm94XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e2NoZWNrZWR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZEJyYW5jaElkcygocHJldikgPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja2VkID8gcHJldi5maWx0ZXIoKGlkKSA9PiBpZCAhPT0gYi5pZCkgOiBbLi4ucHJldiwgYi5pZF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZCBib3JkZXItZ3JheS02MDBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2IubmFtZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgey8qIEVuYWJsZSBWYXJpYXRpb25zIHRvZ2dsZSAob3B0LWluLCBkZWZhdWx0IE9GRiBmb3IgbmV3IHByb2R1Y3QpICovfVxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIHAtMyBiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGdcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBodG1sRm9yPVwiZW5hYmxlLXZhcmlhdGlvbnNcIiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIGZvbnQtbWVkaXVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgRW5hYmxlIFZhcmlhdGlvbnNcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTAuNVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIEVuYWJsZSBzaXplL2NvbG9yIHZhcmlhdGlvbnMuIFN0b2NrIHdpbGwgYmUgdHJhY2tlZCBwZXIgdmFyaWF0aW9uLlxyXG4gICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxTd2l0Y2hcclxuICAgICAgICAgICAgICAgICAgaWQ9XCJlbmFibGUtdmFyaWF0aW9uc1wiXHJcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e2VuYWJsZVZhcmlhdGlvbnN9XHJcbiAgICAgICAgICAgICAgICAgIG9uQ2hlY2tlZENoYW5nZT17aGFuZGxlRW5hYmxlVmFyaWF0aW9uc0NoYW5nZX1cclxuICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIHtlbmFibGVWYXJpYXRpb25zICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC0zIGJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZ1wiPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5QYXJlbnQgcHJvZHVjdCBkb2VzIG5vdCBob2xkIHN0b2NrIHdoZW4gdmFyaWF0aW9ucyBhcmUgZW5hYmxlZC48L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgICB7LyogRW5hYmxlIENvbWJvIFByb2R1Y3QgdG9nZ2xlIChvbmx5IGlmIG1vZHVsZSBlbmFibGVkKSAqL31cclxuICAgICAgICAgICAgICB7bW9kdWxlcy5jb21ib3NFbmFibGVkICYmIChcclxuICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIHAtMyBiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGdcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPExhYmVsIGh0bWxGb3I9XCJlbmFibGUtY29tYm9cIiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIGZvbnQtbWVkaXVtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEVuYWJsZSBDb21ibyBQcm9kdWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTAuNVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBNYWtlIHRoaXMgcHJvZHVjdCBhIGNvbWJvL2J1bmRsZS4gU3RvY2sgd2lsbCBiZSBtYW5hZ2VkIHRocm91Z2ggY29tcG9uZW50IHByb2R1Y3RzLlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxTd2l0Y2hcclxuICAgICAgICAgICAgICAgICAgICAgIGlkPVwiZW5hYmxlLWNvbWJvXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e2lzQ29tYm9Qcm9kdWN0fVxyXG4gICAgICAgICAgICAgICAgICAgICAgb25DaGVja2VkQ2hhbmdlPXtoYW5kbGVFbmFibGVDb21ib0NoYW5nZX1cclxuICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgIHtpc0NvbWJvUHJvZHVjdCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwLTMgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5Db21ibyBwcm9kdWN0cyBkbyBub3QgaG9sZCBzdG9jay4gU3RvY2sgaXMgbWFuYWdlZCB0aHJvdWdoIGNvbXBvbmVudCBwcm9kdWN0cy48L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxyXG4gICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci15ZWxsb3ctNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgICAgU3RvY2sgTWFuYWdlbWVudFxyXG4gICAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsXHJcbiAgICAgICAgICAgICAgICAgICAgaHRtbEZvcj1cInN0b2NrLW1nbXRcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgRW5hYmxlIFRyYWNraW5nXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxDb250cm9sbGVyXHJcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbD17Y29udHJvbH1cclxuICAgICAgICAgICAgICAgICAgICBuYW1lPVwic3RvY2tNYW5hZ2VtZW50XCJcclxuICAgICAgICAgICAgICAgICAgICByZW5kZXI9eyh7IGZpZWxkIH0pID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxTd2l0Y2hcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZD17ZmllbGQudmFsdWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hlY2tlZENoYW5nZT17ZmllbGQub25DaGFuZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkPVwic3RvY2stbWdtdFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAge3N0b2NrTWFuYWdlbWVudCAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8TGFiZWxcclxuICAgICAgICAgICAgICAgICAgICAgIGh0bWxGb3I9XCJpbml0aWFsLXN0b2NrXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgIEluaXRpYWwgU3RvY2tcclxuICAgICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgaWQ9XCJpbml0aWFsLXN0b2NrXCJcclxuICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgc3RlcD17c2VsZWN0ZWRVbml0QWxsb3dzRGVjaW1hbCA/ICdhbnknIDogMX1cclxuICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtlbmFibGVWYXJpYXRpb25zIHx8IGlzQ29tYm9Qcm9kdWN0fVxyXG4gICAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwiaW5pdGlhbFN0b2NrXCIsIHsgc2V0VmFsdWVBczogc2V0VmFsdWVBc051bWJlciB9KX1cclxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2Nsc3goXCJtdC0xXCIsIChlbmFibGVWYXJpYXRpb25zIHx8IGlzQ29tYm9Qcm9kdWN0KSA/IFwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtZ3JheS01MDAgY3Vyc29yLW5vdC1hbGxvd2VkXCIgOiBcImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlXCIpfVxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAge2VuYWJsZVZhcmlhdGlvbnMgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5PcGVuaW5nIHN0b2NrIGlzIGRlZmluZWQgcGVyIHZhcmlhdGlvbi48L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICB7aXNDb21ib1Byb2R1Y3QgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5Db21ibyBwcm9kdWN0cyBkbyBub3QgaG9sZCBzdG9jay4gU3RvY2sgaXMgbWFuYWdlZCB0aHJvdWdoIGNvbXBvbmVudCBwcm9kdWN0cy48L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxMYWJlbFxyXG4gICAgICAgICAgICAgICAgICAgICAgaHRtbEZvcj1cImFsZXJ0LXF0eVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCJcclxuICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICBBbGVydCBRdWFudGl0eVxyXG4gICAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICBpZD1cImFsZXJ0LXF0eVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcImFsZXJ0UXR5XCIsIHsgc2V0VmFsdWVBczogc2V0VmFsdWVBc051bWJlciB9KX1cclxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiNVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItcmVkLTkwMC81MCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIEdldCBub3RpZmllZCB3aGVuIHN0b2NrIGZhbGxzIGJlbG93IHRoaXMgbGV2ZWxcclxuICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8TGFiZWwgaHRtbEZvcj1cIm1heC1zdG9ja1wiIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5NYXggU3RvY2s8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgaWQ9XCJtYXgtc3RvY2tcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJtYXhTdG9ja1wiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjEwMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgbXQtMVwiPk1heGltdW0gc3RvY2sgY2FwYWNpdHk8L3A+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgeyFzdG9ja01hbmFnZW1lbnQgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC02IHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDBcIj5TdG9jayB0cmFja2luZyBpcyBkaXNhYmxlZCBmb3IgdGhpcyBwcm9kdWN0PC9wPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS01MDAgbXQtMVwiPkVuYWJsZSB0cmFja2luZyBhYm92ZSB0byBtYW5hZ2UgaW52ZW50b3J5IGxldmVsczwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC8+XHJcbiAgICAgICAgKX1cclxuXHJcbiAgICAgICAgey8qIFRBQiA0IC0gTUVESUEgKi99XHJcbiAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ21lZGlhJyAmJiAoXHJcbiAgICAgICAgICA8PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgYm9yZGVyLWwtNCBib3JkZXItcGluay01MDAgcGwtM1wiPlxyXG4gICAgICAgICAgICAgICAgUHJvZHVjdCBJbWFnZXNcclxuICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICB7Li4uZ2V0Um9vdFByb3BzKCl9XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2Nsc3goXHJcbiAgICAgICAgICAgICAgICAgIFwiYm9yZGVyLTIgYm9yZGVyLWRhc2hlZCByb3VuZGVkLXhsIHAtOCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBjdXJzb3ItcG9pbnRlciB0cmFuc2l0aW9uLWNvbG9yc1wiLFxyXG4gICAgICAgICAgICAgICAgICBpc0RyYWdBY3RpdmVcclxuICAgICAgICAgICAgICAgICAgICA/IFwiYm9yZGVyLWJsdWUtNTAwIGJnLWJsdWUtNTAwLzEwXCJcclxuICAgICAgICAgICAgICAgICAgICA6IFwiYm9yZGVyLWdyYXktNzAwIGhvdmVyOmJvcmRlci1ncmF5LTUwMCBiZy1ncmF5LTgwMC81MFwiLFxyXG4gICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8aW5wdXQgey4uLmdldElucHV0UHJvcHMoKX0gLz5cclxuICAgICAgICAgICAgICAgIDxVcGxvYWRcclxuICAgICAgICAgICAgICAgICAgc2l6ZT17MzJ9XHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDAgbWItM1wiXHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICBEcmFnICYgZHJvcCBpbWFnZXMgaGVyZSwgb3J7XCIgXCJ9XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtYmx1ZS01MDBcIj5icm93c2U8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIHtleGlzdGluZ0ltYWdlVXJscy5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtNCBnYXAtNCBtdC00XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cImNvbC1zcGFuLWZ1bGwgdGV4dC1zbSB0ZXh0LWdyYXktNTAwXCI+U2F2ZWQgaW1hZ2VzPC9wPlxyXG4gICAgICAgICAgICAgICAgICB7ZXhpc3RpbmdJbWFnZVVybHMubWFwKCh1cmwsIGlkeCkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgIGtleT17dXJsICsgaWR4fVxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicmVsYXRpdmUgZ3JvdXAgYXNwZWN0LXNxdWFyZSBiZy1ncmF5LTgwMCByb3VuZGVkLWxnIG92ZXJmbG93LWhpZGRlbiBib3JkZXIgYm9yZGVyLWdyYXktNzAwXCJcclxuICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8UHJvZHVjdEltYWdlIHNyYz17dXJsfSBhbHQ9XCJwcm9kdWN0XCIgY2xhc3NOYW1lPVwidy1mdWxsIGgtZnVsbCBvYmplY3QtY292ZXJcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldEV4aXN0aW5nSW1hZ2VVcmxzKGV4aXN0aW5nSW1hZ2VVcmxzLmZpbHRlcigoXywgaSkgPT4gaSAhPT0gaWR4KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIHRvcC0xIHJpZ2h0LTEgYmctcmVkLTUwMCB0ZXh0LXdoaXRlIHAtMSByb3VuZGVkLWZ1bGwgb3BhY2l0eS0wIGdyb3VwLWhvdmVyOm9wYWNpdHktMTAwIHRyYW5zaXRpb24tb3BhY2l0eVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxYIHNpemU9ezEyfSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAge2ltYWdlcy5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtNCBnYXAtNCBtdC00XCI+XHJcbiAgICAgICAgICAgICAgICAgIHtleGlzdGluZ0ltYWdlVXJscy5sZW5ndGggPiAwICYmIDxwIGNsYXNzTmFtZT1cImNvbC1zcGFuLWZ1bGwgdGV4dC1zbSB0ZXh0LWdyYXktNTAwXCI+TmV3IGltYWdlcyAod2lsbCBzYXZlIG9uIFN1Ym1pdCk8L3A+fVxyXG4gICAgICAgICAgICAgICAgICB7aW1hZ2VzLm1hcCgoZmlsZSwgaWR4KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAga2V5PXtpZHh9XHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJyZWxhdGl2ZSBncm91cCBhc3BlY3Qtc3F1YXJlIGJnLWdyYXktODAwIHJvdW5kZWQtbGcgb3ZlcmZsb3ctaGlkZGVuIGJvcmRlciBib3JkZXItZ3JheS03MDBcIlxyXG4gICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgIDxpbWdcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3JjPXtVUkwuY3JlYXRlT2JqZWN0VVJMKGZpbGUpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhbHQ9XCJwcmV2aWV3XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGgtZnVsbCBvYmplY3QtY292ZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRJbWFnZXMoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbWFnZXMuZmlsdGVyKChfLCBpKSA9PiBpICE9PSBpZHgpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIHRvcC0xIHJpZ2h0LTEgYmctcmVkLTUwMCB0ZXh0LXdoaXRlIHAtMSByb3VuZGVkLWZ1bGwgb3BhY2l0eS0wIGdyb3VwLWhvdmVyOm9wYWNpdHktMTAwIHRyYW5zaXRpb24tb3BhY2l0eVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxYIHNpemU9ezEyfSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAge2ltYWdlcy5sZW5ndGggPT09IDAgJiYgZXhpc3RpbmdJbWFnZVVybHMubGVuZ3RoID09PSAwICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNiB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwXCI+Tm8gaW1hZ2VzIHVwbG9hZGVkIHlldDwvcD5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNTAwIG10LTFcIj5VcGxvYWQgaW1hZ2VzIHRvIHNob3djYXNlIHlvdXIgcHJvZHVjdDwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC8+XHJcbiAgICAgICAgKX1cclxuXHJcbiAgICAgICAgey8qIFRBQiA1IC0gREVUQUlMUyAqL31cclxuICAgICAgICB7YWN0aXZlVGFiID09PSAnZGV0YWlscycgJiYgKFxyXG4gICAgICAgICAgPD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWN5YW4tNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIERlc2NyaXB0aW9uICYgTm90ZXNcclxuICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPExhYmVsXHJcbiAgICAgICAgICAgICAgICAgIGh0bWxGb3I9XCJkZXNjcmlwdGlvblwiXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICBQcm9kdWN0IERlc2NyaXB0aW9uXHJcbiAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgPFRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgIGlkPVwiZGVzY3JpcHRpb25cIlxyXG4gICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJkZXNjcmlwdGlvblwiKX1cclxuICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJEZXRhaWxlZCBwcm9kdWN0IGRlc2NyaXB0aW9uLi4uXCJcclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMSBtaW4taC1bMTIwcHhdXCJcclxuICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8TGFiZWxcclxuICAgICAgICAgICAgICAgICAgaHRtbEZvcj1cIm5vdGVzXCJcclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiXHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIEludGVybmFsIE5vdGVzXHJcbiAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgPFRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgIGlkPVwibm90ZXNcIlxyXG4gICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJub3Rlc1wiKX1cclxuICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJQcml2YXRlIG5vdGVzIChub3QgdmlzaWJsZSB0byBjdXN0b21lcnMpLi4uXCJcclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMSBtaW4taC1bODBweF1cIlxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgYm9yZGVyLWwtNCBib3JkZXItb3JhbmdlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBTdXBwbGllciBJbmZvcm1hdGlvblxyXG4gICAgICAgICAgICAgIDwvaDM+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBEZWZhdWx0IFN1cHBsaWVyXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxDb250cm9sbGVyXHJcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbD17Y29udHJvbH1cclxuICAgICAgICAgICAgICAgICAgICBuYW1lPVwic3VwcGxpZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHJlbmRlcj17KHsgZmllbGQgfSkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvblZhbHVlQ2hhbmdlPXtmaWVsZC5vbkNoYW5nZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2ZpZWxkLnZhbHVlID8/ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0VHJpZ2dlciBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdFZhbHVlIHBsYWNlaG9sZGVyPVwiU2VsZWN0IFN1cHBsaWVyXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3RUcmlnZ2VyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0Q29udGVudCBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS04MDAgdGV4dC13aGl0ZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtsb2FkaW5nU3VwcGxpZXJzID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJweC0yIHB5LTEuNSB0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5Mb2FkaW5nIHN1cHBsaWVycy4uLjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICkgOiBzdXBwbGllcnMubGVuZ3RoID4gMCA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1cHBsaWVycy5tYXAoKHMpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdEl0ZW0ga2V5PXtzLmlkfSB2YWx1ZT17cy5pZH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3MubmFtZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3RJdGVtPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJweC0yIHB5LTEuNSB0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5ObyBzdXBwbGllcnMuIEFkZCBpbiBDb250YWN0cyAodHlwZTogU3VwcGxpZXIpLjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvU2VsZWN0Q29udGVudD5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvU2VsZWN0PlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgU3VwcGxpZXIgUHJvZHVjdCBDb2RlXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcInN1cHBsaWVyQ29kZVwiKX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlN1cHBsaWVyJ3MgU0tVXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvPlxyXG4gICAgICAgICl9XHJcblxyXG4gICAgICAgIHsvKiBUQUIgMiAtIFZBUklBVElPTlMgKi99XHJcbiAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ3ZhcmlhdGlvbnMnICYmIChcclxuICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgIHsvKiBTdXBwbGllciBkaXNwbGF5IC0gc2hvd3Mgc2VsZWN0ZWQgc3VwcGxpZXIgZnJvbSBEZXRhaWxzIHRhYiAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC00XCI+XHJcbiAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDAgdGV4dC14cyB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZVwiPlN1cHBsaWVyIGZvciB0aGlzIHByb2R1Y3Q8L0xhYmVsPlxyXG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtd2hpdGUgZm9udC1tZWRpdW0gbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAge3dhdGNoKCdzdXBwbGllcicpICYmIHN1cHBsaWVycy5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgICAgICAgID8gc3VwcGxpZXJzLmZpbmQoKHMpID0+IHMuaWQgPT09IHdhdGNoKCdzdXBwbGllcicpKT8ubmFtZSA/PyAn4oCUJ1xyXG4gICAgICAgICAgICAgICAgICA6ICdTZWxlY3Qgc3VwcGxpZXIgaW4gRGV0YWlscyB0YWInfVxyXG4gICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICB7d2F0Y2goJ3N1cHBsaWVyJykgJiYgKFxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTAuNVwiPlZhcmlhdGlvbnMgd2lsbCBiZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBzdXBwbGllcjwvcD5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBJbmZvIEJhbm5lciAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ibHVlLTkwMC8yMCBib3JkZXIgYm9yZGVyLWJsdWUtODAwIHJvdW5kZWQteGwgcC00XCI+XHJcbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWJsdWUtMzAwXCI+XHJcbiAgICAgICAgICAgICAgICA8c3Ryb25nPlByb2R1Y3QgVmFyaWF0aW9uczo8L3N0cm9uZz4gQ3JlYXRlIGRpZmZlcmVudCB2YXJpYW50cyBvZiB5b3VyIHByb2R1Y3QgKGUuZy4sIGRpZmZlcmVudCBzaXplcywgY29sb3JzLCBtYXRlcmlhbHMpLiBcclxuICAgICAgICAgICAgICAgIEVhY2ggdmFyaWFudCB3aWxsIGhhdmUgaXRzIG93biBTS1UsIHByaWNlLCBhbmQgc3RvY2sgbGV2ZWwuXHJcbiAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBDb3B5IGZyb20gZXhpc3RpbmcgdmFyaWF0aW9uIOKAkyBmb3JtYXQ6IFN1cHBsaWVyIOKAlCBBdHRyaWJ1dGVOYW1lOiBWYWx1ZSAoZS5nLiB2YXJpYW50OiBTaXplOiBMLCBTVVBMSUVSOiBJYnJhaGltKSAqL31cclxuICAgICAgICAgICAge3ZhcmlhdGlvbnNGb3JDb3B5Lmxlbmd0aCA+IDAgJiYgKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDAgbWItMiBibG9ja1wiPkNvcHkgZnJvbSBleGlzdGluZyB2YXJpYXRpb248L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG1iLTJcIj5TZWxlY3QgYW4gZXhpc3RpbmcgdmFyaWF0aW9uIHRvIGNvcHkgaXRzIGF0dHJpYnV0ZXMuIFNob3dzOiBTdXBwbGllciwgQXR0cmlidXRlOiBWYWx1ZSAoZS5nLiBTaXplOiBMYXJnZSwgQ29sb3I6IFJlZCkuPC9wPlxyXG4gICAgICAgICAgICAgICAgPFNlbGVjdFxyXG4gICAgICAgICAgICAgICAgICB2YWx1ZT17Y29weUZyb21WYXJpYXRpb25JZH1cclxuICAgICAgICAgICAgICAgICAgb25WYWx1ZUNoYW5nZT17KGlkKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0Q29weUZyb21WYXJpYXRpb25JZChpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnkgPSB2YXJpYXRpb25zRm9yQ29weS5maW5kKCh4KSA9PiB4LnZhcmlhdGlvbklkID09PSBpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5ICYmIGVudHJ5LnByb2R1Y3RJZCAhPT0gKGluaXRpYWxQcm9kdWN0Py51dWlkIHx8IGluaXRpYWxQcm9kdWN0Py5pZCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvcHlBdHRyaWJ1dGVzRnJvbVByb2R1Y3QoZW50cnkucHJvZHVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICBzZXRDb3B5RnJvbVZhcmlhdGlvbklkKCcnKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICB0b2FzdC5pbmZvKCdUaGlzIGlzIHRoZSBjdXJyZW50IHByb2R1Y3QnKTtcclxuICAgICAgICAgICAgICAgICAgICAgIHNldENvcHlGcm9tVmFyaWF0aW9uSWQoJycpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPFNlbGVjdFRyaWdnZXIgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGVcIj5cclxuICAgICAgICAgICAgICAgICAgICA8U2VsZWN0VmFsdWUgcGxhY2Vob2xkZXI9XCJTZWxlY3QgdmFyaWF0aW9uIHRvIGNvcHkgZnJvbS4uLlwiIC8+XHJcbiAgICAgICAgICAgICAgICAgIDwvU2VsZWN0VHJpZ2dlcj5cclxuICAgICAgICAgICAgICAgICAgPFNlbGVjdENvbnRlbnQgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktODAwIHRleHQtd2hpdGVcIj5cclxuICAgICAgICAgICAgICAgICAgICB7bG9hZGluZ1Byb2R1Y3RzV2l0aFZhcmlhdGlvbnMgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB4LTIgcHktMS41IHRleHQtc20gdGV4dC1ncmF5LTQwMFwiPkxvYWRpbmcuLi48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgdmFyaWF0aW9uc0ZvckNvcHlcclxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigoZSkgPT4gZS5wcm9kdWN0SWQgIT09IChpbml0aWFsUHJvZHVjdD8udXVpZCB8fCBpbml0aWFsUHJvZHVjdD8uaWQpKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChlKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdEl0ZW0ga2V5PXtlLnZhcmlhdGlvbklkfSB2YWx1ZT17ZS52YXJpYXRpb25JZH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZS5zdXBwbGllck5hbWV9IOKAlCB7ZS5sYWJlbH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L1NlbGVjdEl0ZW0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICkpXHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgPC9TZWxlY3RDb250ZW50PlxyXG4gICAgICAgICAgICAgICAgPC9TZWxlY3Q+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICB7LyogU3RlcCAxOiBBZGQgQXR0cmlidXRlcyAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWJsdWUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIFN0ZXAgMTogRGVmaW5lIFZhcmlhdGlvbiBBdHRyaWJ1dGVzXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDBcIj5cclxuICAgICAgICAgICAgICAgIFBpY2sgZnJvbSBTZXR0aW5ncyDihpIgSW52ZW50b3J5IOKGkiBWYXJpYXRpb25zIG1hc3RlciBvciB0eXBlIG5ldyBuYW1lczsgdmFsdWVzIGNhbiBiZSBjaG9zZW4gZnJvbSBzYXZlZCBsaXN0cyBwZXIgYXR0cmlidXRlLlxyXG4gICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICA8ZGF0YWxpc3QgaWQ9XCJ2YXJpYXRpb24tbWFzdGVyLWF0dHItbmFtZXNcIj5cclxuICAgICAgICAgICAgICAgIHtPYmplY3Qua2V5cyh2YXJpYXRpb25NYXN0ZXIpXHJcbiAgICAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpXHJcbiAgICAgICAgICAgICAgICAgIC5tYXAoKGspID0+IChcclxuICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIGtleT17a30gdmFsdWU9e2t9IC8+XHJcbiAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgIDwvZGF0YWxpc3Q+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDAgbWItMiBibG9ja1wiPkFkZCBOZXcgQXR0cmlidXRlIChlLmcuLCBTaXplLCBDb2xvciwgTWF0ZXJpYWwpPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU9e25ld0F0dHJpYnV0ZU5hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXROZXdBdHRyaWJ1dGVOYW1lKGUudGFyZ2V0LnZhbHVlKX1cclxuICAgICAgICAgICAgICAgICAgICBvbktleVByZXNzPXsoZSkgPT4gZS5rZXkgPT09ICdFbnRlcicgJiYgKGUucHJldmVudERlZmF1bHQoKSwgYWRkVmFyaWFudEF0dHJpYnV0ZSgpKX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkVudGVyIGF0dHJpYnV0ZSBuYW1lIChlLmcuLCBDb2xvcilcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlXCJcclxuICAgICAgICAgICAgICAgICAgICBsaXN0PVwidmFyaWF0aW9uLW1hc3Rlci1hdHRyLW5hbWVzXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2FkZFZhcmlhbnRBdHRyaWJ1dGV9XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctYmx1ZS01MDAgaG92ZXI6YmctYmx1ZS02MDAgdGV4dC13aGl0ZSBweC02IHB5LTIgcm91bmRlZC1sZyBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWNvbG9ycyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB3aGl0ZXNwYWNlLW5vd3JhcFwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICA8UGx1cyBzaXplPXsxNn0gLz5cclxuICAgICAgICAgICAgICAgICAgICBBZGRcclxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgey8qIERpc3BsYXkgQXR0cmlidXRlcyAqL31cclxuICAgICAgICAgICAgICB7dmFyaWFudEF0dHJpYnV0ZXMubGVuZ3RoID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgICAgICB7dmFyaWFudEF0dHJpYnV0ZXMubWFwKChhdHRyLCBhdHRySW5kZXgpID0+IChcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17YXR0ci5uYW1lfSBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBtYi0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJ0ZXh0LW1kIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHthdHRyLm5hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvaDQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiByZW1vdmVWYXJpYW50QXR0cmlidXRlKGF0dHIubmFtZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNTAwIGhvdmVyOnRleHQtcmVkLTQwMCB0cmFuc2l0aW9uLWNvbG9ycyBwLTJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFRyYXNoMiBzaXplPXsxNn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICB7LyogQWRkIFZhbHVlcyAqL31cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItM1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGF0YWxpc3QgaWQ9e2B2YXJpYXRpb24tbWFzdGVyLXZhbHVlcy0ke2F0dHIubmFtZS5yZXBsYWNlKC9cXHMrL2csICctJyl9YH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyh2YXJpYXRpb25NYXN0ZXJbYXR0ci5uYW1lXSB8fCBbXSkubWFwKCh2KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIGtleT17dn0gdmFsdWU9e3Z9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGF0YWxpc3Q+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtzZWxlY3RlZEF0dHJpYnV0ZUluZGV4ID09PSBhdHRySW5kZXggPyBuZXdBdHRyaWJ1dGVWYWx1ZSA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Gb2N1cz17KCkgPT4gc2V0U2VsZWN0ZWRBdHRyaWJ1dGVJbmRleChhdHRySW5kZXgpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXROZXdBdHRyaWJ1dGVWYWx1ZShlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbktleVByZXNzPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRBdHRyaWJ1dGVJbmRleChhdHRySW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZEF0dHJpYnV0ZVZhbHVlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17YEFkZCAke2F0dHIubmFtZX0gdmFsdWUgKGUuZy4sIFJlZCwgQmx1ZSlgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaXN0PXtgdmFyaWF0aW9uLW1hc3Rlci12YWx1ZXMtJHthdHRyLm5hbWUucmVwbGFjZSgvXFxzKy9nLCAnLScpfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRBdHRyaWJ1dGVJbmRleChhdHRySW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRBdHRyaWJ1dGVWYWx1ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWJsdWUtNjAwIGhvdmVyOmJnLWJsdWUtNzAwIHRleHQtd2hpdGUgcHgtNCBweS0yIHJvdW5kZWQtbGcgdGV4dC1zbSBmb250LW1lZGl1bSB0cmFuc2l0aW9uLWNvbG9ycyB3aGl0ZXNwYWNlLW5vd3JhcFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgQWRkIFZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgey8qIERpc3BsYXkgVmFsdWVzICovfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtd3JhcCBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7YXR0ci52YWx1ZXMubWFwKCh2YWx1ZSwgdmFsdWVJbmRleCkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17dmFsdWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgcHgtMyBweS0xLjUgcm91bmRlZC1sZyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXNtXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj57dmFsdWV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcmVtb3ZlQXR0cmlidXRlVmFsdWUoYXR0ckluZGV4LCB2YWx1ZUluZGV4KX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNDAwIGhvdmVyOnRleHQtcmVkLTMwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxYIHNpemU9ezE0fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7YXR0ci52YWx1ZXMubGVuZ3RoID09PSAwICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwIHRleHQtc20gaXRhbGljXCI+Tm8gdmFsdWVzIGFkZGVkIHlldDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgey8qIFN0ZXAgMjogR2VuZXJhdGUgVmFyaWF0aW9ucyAqL31cclxuICAgICAgICAgICAge3ZhcmlhbnRBdHRyaWJ1dGVzLmxlbmd0aCA+IDAgJiYgdmFyaWFudEF0dHJpYnV0ZXMuZXZlcnkoYXR0ciA9PiBhdHRyLnZhbHVlcy5sZW5ndGggPiAwKSAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgYm9yZGVyLWwtNCBib3JkZXItYmx1ZS01MDAgcGwtM1wiPlxyXG4gICAgICAgICAgICAgICAgICBTdGVwIDI6IEdlbmVyYXRlICYgQ29uZmlndXJlIFZhcmlhdGlvbnNcclxuICAgICAgICAgICAgICAgIDwvaDM+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgZmxleC13cmFwXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTQwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIExpbWl0OiB7TUFYX1ZBUklBVElPTlN9IHZhcmlhdGlvbnMgcGVyIHByb2R1Y3QuIE9wZW5pbmcgc3RvY2sgaXMgc2V0IHBlciByb3cgYW5kIHNhdmVkIGFzIHN0b2NrIG1vdmVtZW50cyBvbiBzYXZlLlxyXG4gICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBmb250LW1vbm9cIj5cclxuICAgICAgICAgICAgICAgICAgICB7Z2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGh9IC8ge01BWF9WQVJJQVRJT05TfVxyXG4gICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgIHsoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gdmFyaWFudEF0dHJpYnV0ZXMucmVkdWNlKChhY2MsIGF0dHIpID0+IGFjYyAqIGF0dHIudmFsdWVzLmxlbmd0aCwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXRMaW1pdCA9IGNvdW50ID4gTUFYX1ZBUklBVElPTlM7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtnZW5lcmF0ZVZhcmlhdGlvbnN9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2F0TGltaXR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0LXdoaXRlIHB4LTYgcHktMyByb3VuZGVkLXhsIGZvbnQtYm9sZCB0cmFuc2l0aW9uLWNvbG9ycyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXRMaW1pdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiYmctZ3JheS02MDAgY3Vyc29yLW5vdC1hbGxvd2VkIG9wYWNpdHktNjBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiYmctYmx1ZS01MDAgaG92ZXI6YmctYmx1ZS02MDAgc2hhZG93LWxnIHNoYWRvdy1ibHVlLTUwMC8yMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxSZWZyZXNoQ2N3IHNpemU9ezE4fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIEdlbmVyYXRlIHtjb3VudH0gVmFyaWF0aW9uc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNDAwIG10LTJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7YXRMaW1pdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBgUmVkdWNlIGF0dHJpYnV0ZXMgb3IgdmFsdWVzIHRvIHN0YXkgdW5kZXIgJHtNQVhfVkFSSUFUSU9OU30gdmFyaWF0aW9ucy5gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IFwiQWxsIHBvc3NpYmxlIGNvbWJpbmF0aW9ucyBvZiB5b3VyIGF0dHJpYnV0ZSB2YWx1ZXMuXCJ9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgIH0pKCl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICB7LyogVmFyaWF0aW9ucyBUYWJsZSAqL31cclxuICAgICAgICAgICAgICAgIHtnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aCA+IDAgJiYgKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBvdmVyZmxvdy1oaWRkZW5cIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm92ZXJmbG93LXgtYXV0byBvdmVyZmxvdy15LWF1dG9cIiBzdHlsZT17eyBtYXhIZWlnaHQ6ICdtaW4oNjB2aCwgNDIwcHgpJyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDx0YWJsZSBjbGFzc05hbWU9XCJ3LWZ1bGwgYm9yZGVyLWNvbGxhcHNlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aGVhZCBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItYiBib3JkZXItZ3JheS03MDAgc3RpY2t5IHRvcC0wIHotWzFdXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cInB4LTQgcHktMyB0ZXh0LWxlZnQgdGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZ3JheS0zMDBcIj4jPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt2YXJpYW50QXR0cmlidXRlcy5tYXAoYXR0ciA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBrZXk9e2F0dHIubmFtZX0gY2xhc3NOYW1lPVwicHgtNCBweS0zIHRleHQtbGVmdCB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTMwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHthdHRyLm5hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJweC00IHB5LTMgdGV4dC1sZWZ0IHRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktMzAwXCI+U0tVPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJweC00IHB5LTMgdGV4dC1sZWZ0IHRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktMzAwXCI+UHVyY2hhc2UgUHJpY2U8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cInB4LTQgcHktMyB0ZXh0LWxlZnQgdGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZ3JheS0zMDBcIj5TZWxsaW5nIFByaWNlPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJweC00IHB5LTMgdGV4dC1sZWZ0IHRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktMzAwXCI+T3BlbmluZyBTdG9jazwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwicHgtNCBweS0zIHRleHQtbGVmdCB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTMwMFwiPkJhcmNvZGU8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0Ym9keT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Z2VuZXJhdGVkVmFyaWF0aW9ucy5tYXAoKHZhcmlhdGlvbiwgaW5kZXgpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciBrZXk9e2luZGV4fSBjbGFzc05hbWU9XCJib3JkZXItYiBib3JkZXItZ3JheS03MDAgaG92ZXI6YmctZ3JheS05MDAvNTAgdHJhbnNpdGlvbi1jb2xvcnNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInB4LTQgcHktMyB0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj57aW5kZXggKyAxfTwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt2YXJpYW50QXR0cmlidXRlcy5tYXAoYXR0ciA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGtleT17YXR0ci5uYW1lfSBjbGFzc05hbWU9XCJweC00IHB5LTMgdGV4dC1zbSB0ZXh0LXdoaXRlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJiZy1ibHVlLTkwMC8zMCBib3JkZXIgYm9yZGVyLWJsdWUtODAwIHB4LTIgcHktMSByb3VuZGVkIHRleHQteHNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3ZhcmlhdGlvbi5jb21iaW5hdGlvblthdHRyLm5hbWVdfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicHgtNCBweS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17dmFyaWF0aW9uLnNrdX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkID0gWy4uLmdlbmVyYXRlZFZhcmlhdGlvbnNdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkW2luZGV4XS5za3UgPSBlLnRhcmdldC52YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyh1cGRhdGVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSB0ZXh0LXNtIHctMzJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTS1VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJweC00IHB5LTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RlcD17MC4wMX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbj17MH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtOdW1iZXIuaXNGaW5pdGUoTnVtYmVyKHZhcmlhdGlvbi5wdXJjaGFzZVByaWNlKSkgPyB2YXJpYXRpb24ucHVyY2hhc2VQcmljZSA6IDB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IFsuLi5nZW5lcmF0ZWRWYXJpYXRpb25zXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdiA9IHBhcnNlRmxvYXQoZS50YXJnZXQudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkW2luZGV4XS5wdXJjaGFzZVByaWNlID0gTnVtYmVyLmlzTmFOKHYpID8gMCA6IHY7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnModXBkYXRlZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbSB3LTI0XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPXtTdHJpbmcod2F0Y2goJ3B1cmNoYXNlUHJpY2UnKSA/PyAwKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiUHVyY2hhc2UgY29zdCBmb3IgdGhpcyB2YXJpYXRpb25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJweC00IHB5LTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RlcD17MC4wMX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbj17MH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtOdW1iZXIuaXNGaW5pdGUoTnVtYmVyKHZhcmlhdGlvbi5wcmljZSkpID8gdmFyaWF0aW9uLnByaWNlIDogMH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkID0gWy4uLmdlbmVyYXRlZFZhcmlhdGlvbnNdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2ID0gcGFyc2VGbG9hdChlLnRhcmdldC52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWRbaW5kZXhdLnByaWNlID0gTnVtYmVyLmlzTmFOKHYpID8gMCA6IHY7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnModXBkYXRlZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbSB3LTI0XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPXtTdHJpbmcod2F0Y2goJ3NlbGxpbmdQcmljZScpID8/IDApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJTZWxsaW5nIHByaWNlIGZvciB0aGlzIHZhcmlhdGlvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInB4LTQgcHktM1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW49ezB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGVwPXtzZWxlY3RlZFVuaXRBbGxvd3NEZWNpbWFsID8gJ2FueScgOiAxfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3ZhcmlhdGlvbi5zdG9ja31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkID0gWy4uLmdlbmVyYXRlZFZhcmlhdGlvbnNdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkW2luZGV4XS5zdG9jayA9IHBhcnNlVmFyaWF0aW9uUXR5SW5wdXQoZS50YXJnZXQudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKHVwZGF0ZWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIHRleHQtc20gdy0yNFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RlZFVuaXRBbGxvd3NEZWNpbWFsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnT3BlbmluZyBxdHkgZnJvbSBzdG9jayBtb3ZlbWVudHMgKGVkaXRhYmxlIHdoZW4gb25seSBvcGVuaW5nIGV4aXN0cyknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnV2hvbGUgdW5pdHMgb25seSBmb3IgdGhpcyBwcm9kdWN0IHVuaXQnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInB4LTQgcHktM1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3ZhcmlhdGlvbi5iYXJjb2RlfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWQgPSBbLi4uZ2VuZXJhdGVkVmFyaWF0aW9uc107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWRbaW5kZXhdLmJhcmNvZGUgPSBlLnRhcmdldC52YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyh1cGRhdGVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSB0ZXh0LXNtIHctMzJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJCYXJjb2RlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBweC00IHB5LTMgYm9yZGVyLXQgYm9yZGVyLWdyYXktNzAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgVG90YWwgVmFyaWF0aW9uczogPHNwYW4gY2xhc3NOYW1lPVwidGV4dC13aGl0ZSBmb250LXNlbWlib2xkXCI+e2dlbmVyYXRlZFZhcmlhdGlvbnMubGVuZ3RofTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgey8qIEVtcHR5IFN0YXRlICovfVxyXG4gICAgICAgICAgICB7dmFyaWFudEF0dHJpYnV0ZXMubGVuZ3RoID09PSAwICYmIChcclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTggdGV4dC1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgIDxQYWNrYWdlIHNpemU9ezQ4fSBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNjAwIG14LWF1dG8gbWItM1wiIC8+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwIG1iLTJcIj5ObyB2YXJpYXRpb24gYXR0cmlidXRlcyBhZGRlZCB5ZXQ8L3A+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5cclxuICAgICAgICAgICAgICAgICAgQWRkIGF0dHJpYnV0ZXMgbGlrZSBTaXplLCBDb2xvciwgb3IgTWF0ZXJpYWwgdG8gY3JlYXRlIHByb2R1Y3QgdmFyaWF0aW9uc1xyXG4gICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC8+XHJcbiAgICAgICAgKX1cclxuXHJcbiAgICAgICAgey8qIFRBQiAzIC0gQ09NQk9TICovfVxyXG4gICAgICAgIHthY3RpdmVUYWIgPT09ICdjb21ib3MnICYmIG1vZHVsZXMuY29tYm9zRW5hYmxlZCAmJiBpc0NvbWJvUHJvZHVjdCAmJiAoXHJcbiAgICAgICAgICA8PlxyXG4gICAgICAgICAgICB7LyogUmVxdWlyZSBwcm9kdWN0IHRvIGJlIHNhdmVkIGJlZm9yZSBhZGRpbmcgY29tYm9zICovfVxyXG4gICAgICAgICAgICB7IShpbml0aWFsUHJvZHVjdD8udXVpZCB8fCBpbml0aWFsUHJvZHVjdD8uaWQpID8gKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctYW1iZXItOTAwLzMwIGJvcmRlciBib3JkZXItYW1iZXItNzAwIHJvdW5kZWQteGwgcC02IHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWFtYmVyLTIwMCBmb250LW1lZGl1bVwiPlNhdmUgdGhlIHByb2R1Y3QgZmlyc3QgdG8gYWRkIGNvbWJvczwvcD5cclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtYW1iZXItMjAwLzgwIHRleHQtc20gbXQtMlwiPlxyXG4gICAgICAgICAgICAgICAgICBHbyB0byB0aGUgPHN0cm9uZz5CYXNpYzwvc3Ryb25nPiB0YWIsIGZpbGwgaW4gbmFtZSBhbmQgb3RoZXIgcmVxdWlyZWQgZmllbGRzLCB0aGVuIGNsaWNrIDxzdHJvbmc+U2F2ZTwvc3Ryb25nPi4gXHJcbiAgICAgICAgICAgICAgICAgIEFmdGVyIHRoZSBwcm9kdWN0IGlzIHNhdmVkLCB5b3UgY2FuIHJldHVybiBoZXJlIHRvIGNyZWF0ZSBjb21ibyBidW5kbGVzLlxyXG4gICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICB7LyogSW5mbyBCYW5uZXIgKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctYmx1ZS05MDAvMjAgYm9yZGVyIGJvcmRlci1ibHVlLTgwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ibHVlLTMwMFwiPlxyXG4gICAgICAgICAgICAgICAgPHN0cm9uZz5Qcm9kdWN0IENvbWJvczo8L3N0cm9uZz4gQ3JlYXRlIGJ1bmRsZWQgcGFja2FnZXMgYnkgY29tYmluaW5nIG11bHRpcGxlIHByb2R1Y3RzLiBcclxuICAgICAgICAgICAgICAgIFNldCBhIHNwZWNpYWwgY29tYm8gcHJpY2UgdG8gb2ZmZXIgZGlzY291bnRzIG9uIGJ1bmRsZSBwdXJjaGFzZXMuXHJcbiAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBTdGVwIDE6IENyZWF0ZSBDb21ibyAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWJsdWUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIENyZWF0ZSBOZXcgQ29tYm9cclxuICAgICAgICAgICAgICA8L2gzPlxyXG4gICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIHsvKiBDb21ibyBOYW1lICovfVxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDAgbWItMiBibG9ja1wiPkNvbWJvIE5hbWU8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgIHZhbHVlPXtjb21ib05hbWV9XHJcbiAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0Q29tYm9OYW1lKGUudGFyZ2V0LnZhbHVlKX1cclxuICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJlLmcuLCBXZWRkaW5nIFBhY2thZ2UsIFN1bW1lciBCdW5kbGVcIlxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZVwiXHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICB7LyogQWRkIFByb2R1Y3RzIHRvIENvbWJvICovfVxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNCBzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIGJsb2NrXCI+QWRkIFByb2R1Y3RzIHRvIENvbWJvPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtNCBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICB7LyogUHJvZHVjdCBTZWFyY2ggd2l0aCBEcm9wZG93biAqL31cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtZDpjb2wtc3Bhbi0yIHJlbGF0aXZlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cHJvZHVjdFNlYXJjaFF1ZXJ5fVxyXG4gICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFByb2R1Y3RTZWFyY2hRdWVyeShlLnRhcmdldC52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dQcm9kdWN0RHJvcGRvd24odHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgb25Gb2N1cz17KCkgPT4gc2V0U2hvd1Byb2R1Y3REcm9wZG93bih0cnVlKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VhcmNoIHByb2R1Y3QgYnkgbmFtZSBvciBTS1UuLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbVwiXHJcbiAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB7LyogUHJvZHVjdCBEcm9wZG93biAqL31cclxuICAgICAgICAgICAgICAgICAgICB7c2hvd1Byb2R1Y3REcm9wZG93biAmJiBwcm9kdWN0U2VhcmNoUXVlcnkgJiYgZmlsdGVyZWRQcm9kdWN0cy5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgei01MCB3LWZ1bGwgbXQtMSBiZy1ncmF5LTkwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgc2hhZG93LXhsIG1heC1oLTYwIG92ZXJmbG93LXktYXV0b1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7ZmlsdGVyZWRQcm9kdWN0cy5tYXAoKHByb2R1Y3QpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e3Byb2R1Y3QuaWR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNlbGVjdFByb2R1Y3QocHJvZHVjdCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcHgtNCBweS0zIHRleHQtbGVmdCBob3ZlcjpiZy1ncmF5LTgwMCB0cmFuc2l0aW9uLWNvbG9ycyBib3JkZXItYiBib3JkZXItZ3JheS04MDAgbGFzdDpib3JkZXItYi0wXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLXN0YXJ0XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC13aGl0ZSB0ZXh0LXNtIGZvbnQtbWVkaXVtXCI+e3Byb2R1Y3QubmFtZX08L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMCB0ZXh0LXhzIG10LTFcIj5TS1U6IHtwcm9kdWN0LnNrdX08L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTQwMCB0ZXh0LXNtIGZvbnQtc2VtaWJvbGRcIj7igqh7cHJvZHVjdC5yZXRhaWxfcHJpY2V9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB7c2hvd1Byb2R1Y3REcm9wZG93biAmJiBwcm9kdWN0U2VhcmNoUXVlcnkgJiYgZmlsdGVyZWRQcm9kdWN0cy5sZW5ndGggPT09IDAgJiYgIWxvYWRpbmdQcm9kdWN0cyAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIHotNTAgdy1mdWxsIG10LTEgYmctZ3JheS05MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHNoYWRvdy14bCBwLTQgdGV4dC1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMCB0ZXh0LXNtXCI+Tm8gcHJvZHVjdHMgYXZhaWxhYmxlIHRvIGFkZC48L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgIHtsb2FkaW5nUHJvZHVjdHMgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSB6LTUwIHctZnVsbCBtdC0xIGJnLWdyYXktOTAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZyBzaGFkb3cteGwgcC00IHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDAgdGV4dC1zbVwiPkxvYWRpbmcgcHJvZHVjdHMuLi48L3A+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAge2F2YWlsYWJsZVByb2R1Y3RzLmxlbmd0aCA9PT0gMCAmJiAhbG9hZGluZ1Byb2R1Y3RzICYmIChcclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgcC00IHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMCB0ZXh0LXNtXCI+Tm8gcHJvZHVjdHMgYXZhaWxhYmxlIHRvIGFkZC48L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTYwMCB0ZXh0LXhzIG10LTFcIj5DcmVhdGUgcHJvZHVjdHMgZmlyc3QsIHRoZW4gYWRkIHRoZW0gdG8gdGhpcyBjb21iby48L3A+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgey8qIEN1cnJlbnQgQ29tYm8gSXRlbXMgKi99XHJcbiAgICAgICAgICAgICAge2N1cnJlbnRDb21ib0l0ZW1zLmxlbmd0aCA+IDAgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC00IHNwYWNlLXktM1wiPlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMCBibG9ja1wiPlByb2R1Y3RzIGluIFRoaXMgQ29tYm88L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgIHtjdXJyZW50Q29tYm9JdGVtcy5tYXAoKGl0ZW0sIGluZGV4KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleT17aW5kZXh9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcHgtNCBweS0zIHJvdW5kZWQtbGcgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCJcclxuICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNCBmbGV4LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC13aGl0ZSBmb250LW1lZGl1bVwiPntpdGVtLnByb2R1Y3RfbmFtZX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwIHRleHQteHMgbXQtMC41XCI+U0tVOiB7aXRlbS5wcm9kdWN0X3NrdX08L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbj17MC4wMX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXA9ezAuMDF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aXRlbS5xdHkgfHwgJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHVwZGF0ZUNvbWJvSXRlbVF0eShpbmRleCwgcGFyc2VGbG9hdChlLnRhcmdldC52YWx1ZSkgfHwgMSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSB0ZXh0LXNtIHctMjBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJRdHlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbj17MH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXA9ezAuMDF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aXRlbS51bml0X3ByaWNlIHx8ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVDb21ib0l0ZW1QcmljZShpbmRleCwgcGFyc2VGbG9hdChlLnRhcmdldC52YWx1ZSkgfHwgMCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSB0ZXh0LXNtIHctMjRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJQcmljZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwIHRleHQtc20gdy0yNCB0ZXh0LXJpZ2h0XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdWJ0b3RhbDog4oKoeygoaXRlbS5xdHkgfHwgMCkgKiAoaXRlbS51bml0X3ByaWNlIHx8IDApKS50b0ZpeGVkKDIpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiByZW1vdmVDb21ib0l0ZW0oaW5kZXgpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtcmVkLTUwMCBob3Zlcjp0ZXh0LXJlZC00MDAgdHJhbnNpdGlvbi1jb2xvcnMgcC0yIG1sLTJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFRyYXNoMiBzaXplPXsxNn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICB7LyogQ29tYm8gUHJpY2luZyAqL31cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJib3JkZXItdCBib3JkZXItZ3JheS03MDAgcHQtNCBzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMFwiPlRvdGFsIEluZGl2aWR1YWwgUHJpY2U6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC13aGl0ZSBmb250LXNlbWlib2xkXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIOKCqHtjdXJyZW50Q29tYm9JdGVtcy5yZWR1Y2UoKHN1bSwgaXRlbSkgPT4gc3VtICsgKGl0ZW0ucXR5IHx8IDApICogKGl0ZW0udW5pdF9wcmljZSB8fCAwKSwgMCkudG9GaXhlZCgyKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPkNvbWJvIFByaWNlOjwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbj17MH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RlcD17MC4wMX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2NvbWJvRmluYWxQcmljZSB8fCAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRDb21ib0ZpbmFsUHJpY2UocGFyc2VGbG9hdChlLnRhcmdldC52YWx1ZSkgfHwgMCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRW50ZXIgY29tYm8gcHJpY2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBmbGV4LTFcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICB7Y29tYm9GaW5hbFByaWNlID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlciB0ZXh0LXNtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JlZW4tNDAwXCI+RGlzY291bnQ6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTQwMCBmb250LXNlbWlib2xkXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAg4oKoeyhjdXJyZW50Q29tYm9JdGVtcy5yZWR1Y2UoKHN1bSwgaXRlbSkgPT4gc3VtICsgKGl0ZW0ucXR5IHx8IDApICogKGl0ZW0udW5pdF9wcmljZSB8fCAwKSwgMCkgLSBjb21ib0ZpbmFsUHJpY2UpLnRvRml4ZWQoMil9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3NhdmVDb21ib31cclxuICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17IWNvbWJvTmFtZS50cmltKCkgfHwgY29tYm9GaW5hbFByaWNlIDw9IDAgfHwgY3VycmVudENvbWJvSXRlbXMubGVuZ3RoID09PSAwfVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWJsdWUtNTAwIGhvdmVyOmJnLWJsdWUtNjAwIGRpc2FibGVkOmJnLWdyYXktNzAwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCB0ZXh0LXdoaXRlIHB4LTYgcHktMyByb3VuZGVkLXhsIGZvbnQtYm9sZCB0cmFuc2l0aW9uLWNvbG9ycyBzaGFkb3ctbGcgc2hhZG93LWJsdWUtNTAwLzIwIHctZnVsbFwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICBTYXZlIENvbWJvXHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICB7LyogU2F2ZWQgQ29tYm9zICovfVxyXG4gICAgICAgICAgICB7Y29tYm9zLmxlbmd0aCA+IDAgJiYgKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWJsdWUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgICAgU2F2ZWQgQ29tYm9zICh7Y29tYm9zLmxlbmd0aH0pXHJcbiAgICAgICAgICAgICAgICA8L2gzPlxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktM1wiPlxyXG4gICAgICAgICAgICAgICAgICB7Y29tYm9zLm1hcCgoY29tYm8pID0+IChcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17Y29tYm8uaWR9IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIG1iLTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGg0IGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXdoaXRlXCI+e2NvbWJvLmNvbWJvX25hbWV9PC9oND5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IGRlbGV0ZUNvbWJvKGNvbWJvLmlkKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LXJlZC01MDAgaG92ZXI6dGV4dC1yZWQtNDAwIHRyYW5zaXRpb24tY29sb3JzIHAtMlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8VHJhc2gyIHNpemU9ezE4fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMiBtYi0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtjb21iby5pdGVtcy5tYXAoKGl0ZW0sIGlkeCkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYga2V5PXtpZHh9IGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcHgtMyBweS0yIHJvdW5kZWQtbGcgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIHRleHQtc21cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtd2hpdGVcIj57aXRlbS5wcm9kdWN0X25hbWUgfHwgJ1Vua25vd24gUHJvZHVjdCd9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS5wcm9kdWN0X3NrdSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMCB0ZXh0LXhzIG10LTAuNVwiPlNLVToge2l0ZW0ucHJvZHVjdF9za3V9PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00IHRleHQtZ3JheS00MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+UXR5OiB7aXRlbS5xdHl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS51bml0X3ByaWNlICYmIDxzcGFuPuKCqHtpdGVtLnVuaXRfcHJpY2UudG9GaXhlZCgyKX08L3NwYW4+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlXCI+4oKoeygoaXRlbS5xdHkgfHwgMCkgKiAoaXRlbS51bml0X3ByaWNlIHx8IDApKS50b0ZpeGVkKDIpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktNzAwIHB0LTMgc3BhY2UteS0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDBcIj5Ub3RhbCBJbmRpdmlkdWFsIFByaWNlOjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlXCI+4oKoe2NvbWJvLml0ZW1zLnJlZHVjZSgoc3VtLCBpdGVtKSA9PiBzdW0gKyAoaXRlbS5xdHkgfHwgMCkgKiAoaXRlbS51bml0X3ByaWNlIHx8IDApLCAwKS50b0ZpeGVkKDIpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JlZW4tNDAwXCI+Q29tYm8gUHJpY2U6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JlZW4tNDAwIGZvbnQtYm9sZFwiPuKCqHtjb21iby5jb21ib19wcmljZS50b0ZpeGVkKDIpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtYmx1ZS00MDBcIj5Zb3UgU2F2ZTo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ibHVlLTQwMCBmb250LXNlbWlib2xkXCI+4oKoeyhjb21iby5pdGVtcy5yZWR1Y2UoKHN1bSwgaXRlbSkgPT4gc3VtICsgKGl0ZW0ucXR5IHx8IDApICogKGl0ZW0udW5pdF9wcmljZSB8fCAwKSwgMCkgLSBjb21iby5jb21ib19wcmljZSkudG9GaXhlZCgyKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICB7LyogRW1wdHkgU3RhdGUgKi99XHJcbiAgICAgICAgICAgIHtjb21ib3MubGVuZ3RoID09PSAwICYmIGN1cnJlbnRDb21ib0l0ZW1zLmxlbmd0aCA9PT0gMCAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC04IHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgICAgICA8UGFja2FnZSBzaXplPXs0OH0gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTYwMCBteC1hdXRvIG1iLTNcIiAvPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCBtYi0yXCI+Tm8gY29tYm9zIGNyZWF0ZWQgeWV0PC9wPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNTAwXCI+XHJcbiAgICAgICAgICAgICAgICAgIFN0YXJ0IGFkZGluZyBwcm9kdWN0cyBhYm92ZSB0byBjcmVhdGUgeW91ciBmaXJzdCBjb21ibyBwYWNrYWdlXHJcbiAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC8+XHJcbiAgICAgICAgKX1cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtNiBib3JkZXItdCBib3JkZXItZ3JheS04MDAgYmctZ3JheS05MDAgc3RpY2t5IGJvdHRvbS0wIHotMTAgZmxleCBnYXAtNFwiPlxyXG4gICAgICAgIDxidXR0b25cclxuICAgICAgICAgIG9uQ2xpY2s9e29uQ2FuY2VsfVxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBjbGFzc05hbWU9XCJweC02IGJnLWdyYXktODAwIGhvdmVyOmJnLWdyYXktNzAwIHRleHQtd2hpdGUgcHktMyByb3VuZGVkLXhsIGZvbnQtYm9sZCB0cmFuc2l0aW9uLWNvbG9ycyBib3JkZXIgYm9yZGVyLWdyYXktNzAwXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICBDYW5jZWxcclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVTdWJtaXQoKGRhdGEpID0+XHJcbiAgICAgICAgICAgIG9uU3VibWl0KGRhdGEsIFwic2F2ZVwiKSxcclxuICAgICAgICAgICl9XHJcbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgIGRpc2FibGVkPXtzYXZpbmd9XHJcbiAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LTEgYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC13aGl0ZSBweS0zIHJvdW5kZWQteGwgZm9udC1ib2xkIHRyYW5zaXRpb24tY29sb3JzIGRpc2FibGVkOm9wYWNpdHktNTAgZGlzYWJsZWQ6cG9pbnRlci1ldmVudHMtbm9uZVwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAge3NhdmluZyA/ICdTYXZpbmcuLi4nIDogJ1NhdmUgUHJvZHVjdCd9XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAge29uU2F2ZUFuZEFkZCAmJiAoXHJcbiAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZVN1Ym1pdCgoZGF0YSkgPT5cclxuICAgICAgICAgICAgICBvblN1Ym1pdChkYXRhLCBcInNhdmVBbmRBZGRcIiksXHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICBkaXNhYmxlZD17c2F2aW5nfVxyXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LVsyXSBiZy1ibHVlLTUwMCBob3ZlcjpiZy1ibHVlLTYwMCB0ZXh0LXdoaXRlIHB5LTMgcm91bmRlZC14bCBmb250LWJvbGQgdHJhbnNpdGlvbi1jb2xvcnMgc2hhZG93LWxnIHNoYWRvdy1ibHVlLTUwMC8yMCBkaXNhYmxlZDpvcGFjaXR5LTUwIGRpc2FibGVkOnBvaW50ZXItZXZlbnRzLW5vbmVcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICB7c2F2aW5nID8gJ1NhdmluZy4uLicgOiAnU2F2ZSAmIEFkZCB0byBUcmFuc2FjdGlvbid9XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICApfVxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIHsvKiBQQVJUIDU6IE1vZGFsIHdoZW4gYmxvY2tpbmcgZW5hYmxlIHZhcmlhdGlvbnMgKHBhcmVudC1sZXZlbCBzdG9jayBleGlzdHMpICovfVxyXG4gICAgICA8RGlhbG9nIG9wZW49e2Jsb2NrVmFyaWF0aW9uc01vZGFsT3Blbn0gb25PcGVuQ2hhbmdlPXtzZXRCbG9ja1ZhcmlhdGlvbnNNb2RhbE9wZW59PlxyXG4gICAgICAgIDxEaWFsb2dDb250ZW50IGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG1heC13LW1kXCI+XHJcbiAgICAgICAgICA8RGlhbG9nSGVhZGVyPlxyXG4gICAgICAgICAgICA8RGlhbG9nVGl0bGUgY2xhc3NOYW1lPVwidGV4dC13aGl0ZVwiPkNhbm5vdCBlbmFibGUgdmFyaWF0aW9uczwvRGlhbG9nVGl0bGU+XHJcbiAgICAgICAgICA8L0RpYWxvZ0hlYWRlcj5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS0zMDAgdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICBQYXJlbnQtbGV2ZWwgc3RvY2sgZXhpc3RzLiBDbGVhciBvciBhZGp1c3Qgc3RvY2sgZmlyc3QuXHJcbiAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwIHRleHQteHMgbXQtMlwiPlxyXG4gICAgICAgICAgICBDbGVhciBvciBhZGp1c3Qgc3RvY2sgaW4gSW52ZW50b3J5IGZpcnN0LCB0aGVuIGFkZCB2YXJpYXRpb25zLiBPcGVuaW5nIHN0b2NrIGZvciBlYWNoIHNpemUvY29sb3IgY2FuIGJlIHNldCBpbiB0aGUgVmFyaWF0aW9ucyB0YWIgYWZ0ZXIgc2F2aW5nLlxyXG4gICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgPERpYWxvZ0Zvb3RlciBjbGFzc05hbWU9XCJtdC00XCI+XHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRCbG9ja1ZhcmlhdGlvbnNNb2RhbE9wZW4oZmFsc2UpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTQgcHktMiBiZy1ncmF5LTcwMCBob3ZlcjpiZy1ncmF5LTYwMCB0ZXh0LXdoaXRlIHJvdW5kZWQtbGcgdGV4dC1zbSBmb250LW1lZGl1bVwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICBPS1xyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvRGlhbG9nRm9vdGVyPlxyXG4gICAgICAgIDwvRGlhbG9nQ29udGVudD5cclxuICAgICAgPC9EaWFsb2c+XHJcblxyXG4gICAgICA8RGlhbG9nIG9wZW49e2Jsb2NrRGlzYWJsZVZhcmlhdGlvbnNNb2RhbE9wZW59IG9uT3BlbkNoYW5nZT17c2V0QmxvY2tEaXNhYmxlVmFyaWF0aW9uc01vZGFsT3Blbn0+XHJcbiAgICAgICAgPERpYWxvZ0NvbnRlbnQgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbWF4LXctbWRcIj5cclxuICAgICAgICAgIDxEaWFsb2dIZWFkZXI+XHJcbiAgICAgICAgICAgIDxEaWFsb2dUaXRsZSBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlXCI+Q2Fubm90IGRpc2FibGUgdmFyaWF0aW9uczwvRGlhbG9nVGl0bGU+XHJcbiAgICAgICAgICA8L0RpYWxvZ0hlYWRlcj5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS0zMDAgdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICBWYXJpYXRpb24tbGV2ZWwgc3RvY2sgZXhpc3RzLiBDYW5ub3QgZGlzYWJsZSB2YXJpYXRpb25zIHVudGlsIHZhcmlhdGlvbiBzdG9jayBpcyBjbGVhcmVkIG9yIGFkanVzdGVkLlxyXG4gICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgPERpYWxvZ0Zvb3RlciBjbGFzc05hbWU9XCJtdC00XCI+XHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRCbG9ja0Rpc2FibGVWYXJpYXRpb25zTW9kYWxPcGVuKGZhbHNlKX1cclxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC13aGl0ZSByb3VuZGVkLWxnIHRleHQtc20gZm9udC1tZWRpdW1cIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgT0tcclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L0RpYWxvZ0Zvb3Rlcj5cclxuICAgICAgICA8L0RpYWxvZ0NvbnRlbnQ+XHJcbiAgICAgIDwvRGlhbG9nPlxyXG5cclxuICAgICAgey8qIFBBUlQgNjogTW9kYWwgd2hlbiBibG9ja2luZyBlbmFibGUgY29tYm8gKHBhcmVudC1sZXZlbCBzdG9jayBleGlzdHMpICovfVxyXG4gICAgICA8RGlhbG9nIG9wZW49e2Jsb2NrRW5hYmxlQ29tYm9Nb2RhbE9wZW59IG9uT3BlbkNoYW5nZT17c2V0QmxvY2tFbmFibGVDb21ib01vZGFsT3Blbn0+XHJcbiAgICAgICAgPERpYWxvZ0NvbnRlbnQgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbWF4LXctbWRcIj5cclxuICAgICAgICAgIDxEaWFsb2dIZWFkZXI+XHJcbiAgICAgICAgICAgIDxEaWFsb2dUaXRsZSBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlXCI+Q2Fubm90IGVuYWJsZSBjb21ibzwvRGlhbG9nVGl0bGU+XHJcbiAgICAgICAgICA8L0RpYWxvZ0hlYWRlcj5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS0zMDAgdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICBUaGlzIHByb2R1Y3QgYWxyZWFkeSBoYXMgc3RvY2suIENsZWFyIHN0b2NrIGJlZm9yZSBlbmFibGluZyBDb21ibyBtb2RlLlxyXG4gICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhzIG10LTJcIj5cclxuICAgICAgICAgICAgQ2xlYXIgb3IgYWRqdXN0IHN0b2NrIGluIEludmVudG9yeSBmaXJzdCwgdGhlbiBlbmFibGUgQ29tYm8gbW9kZS4gQ29tYm8gcHJvZHVjdHMgZG8gbm90IGhvbGQgc3RvY2sgLSBzdG9jayBpcyBtYW5hZ2VkIHRocm91Z2ggY29tcG9uZW50IHByb2R1Y3RzLlxyXG4gICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgPERpYWxvZ0Zvb3RlciBjbGFzc05hbWU9XCJtdC00XCI+XHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRCbG9ja0VuYWJsZUNvbWJvTW9kYWxPcGVuKGZhbHNlKX1cclxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC13aGl0ZSByb3VuZGVkLWxnIHRleHQtc20gZm9udC1tZWRpdW1cIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgT0tcclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L0RpYWxvZ0Zvb3Rlcj5cclxuICAgICAgICA8L0RpYWxvZ0NvbnRlbnQ+XHJcbiAgICAgIDwvRGlhbG9nPlxyXG5cclxuICAgICAgey8qIFBBUlQgNzogTW9kYWwgd2hlbiBibG9ja2luZyBkaXNhYmxlIGNvbWJvIChjb21ibyBpdGVtcyBleGlzdCkgKi99XHJcbiAgICAgIDxEaWFsb2cgb3Blbj17YmxvY2tEaXNhYmxlQ29tYm9Nb2RhbE9wZW59IG9uT3BlbkNoYW5nZT17c2V0QmxvY2tEaXNhYmxlQ29tYm9Nb2RhbE9wZW59PlxyXG4gICAgICAgIDxEaWFsb2dDb250ZW50IGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG1heC13LW1kXCI+XHJcbiAgICAgICAgICA8RGlhbG9nSGVhZGVyPlxyXG4gICAgICAgICAgICA8RGlhbG9nVGl0bGUgY2xhc3NOYW1lPVwidGV4dC13aGl0ZVwiPkNhbm5vdCBkaXNhYmxlIGNvbWJvPC9EaWFsb2dUaXRsZT5cclxuICAgICAgICAgIDwvRGlhbG9nSGVhZGVyPlxyXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTMwMCB0ZXh0LXNtXCI+XHJcbiAgICAgICAgICAgIFRoaXMgcHJvZHVjdCBoYXMgY29tYm8gY29tcG9uZW50cy4gUmVtb3ZlIHRoZW0gYmVmb3JlIGRpc2FibGluZyBDb21ibyBtb2RlLlxyXG4gICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhzIG10LTJcIj5cclxuICAgICAgICAgICAgRGVsZXRlIGFsbCBjb21ibyBpdGVtcyBpbiB0aGUgQ29tYm9zIHRhYiBmaXJzdCwgdGhlbiB5b3UgY2FuIGRpc2FibGUgQ29tYm8gbW9kZS5cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICAgIDxEaWFsb2dGb290ZXIgY2xhc3NOYW1lPVwibXQtNFwiPlxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QmxvY2tEaXNhYmxlQ29tYm9Nb2RhbE9wZW4oZmFsc2UpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTQgcHktMiBiZy1ncmF5LTcwMCBob3ZlcjpiZy1ncmF5LTYwMCB0ZXh0LXdoaXRlIHJvdW5kZWQtbGcgdGV4dC1zbSBmb250LW1lZGl1bVwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICBPS1xyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDwvRGlhbG9nRm9vdGVyPlxyXG4gICAgICAgIDwvRGlhbG9nQ29udGVudD5cclxuICAgICAgPC9EaWFsb2c+XHJcbiAgICA8L2Rpdj5cclxuICApO1xyXG59O1xyXG4iXSwiZmlsZSI6IkM6L1VzZXJzL25kbTMxL2Rldi9Db3J1c3IvTkVXIFBPU1YzL3NyYy9hcHAvY29tcG9uZW50cy9wcm9kdWN0cy9FbmhhbmNlZFByb2R1Y3RGb3JtLnRzeCJ9