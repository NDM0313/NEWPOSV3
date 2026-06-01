import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/@fs/C:\\Users\\ndm31\\dev\\Corusr\\NEW POSV3\\src\\app\\components\\products\\EnhancedProductForm.tsx");import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false, "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.-Di5M1AY_6w7XksvYOOxS_yRpZRF4HYyB-Jn_UZGRq4", "VITE_SUPABASE_URL": "https://supabase.dincouture.pk"};import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=e89b1d71"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=e89b1d71"; const useCallback = __vite__cjsImport3_react["useCallback"]; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"];
import { useDropzone } from "/node_modules/.vite/deps/react-dropzone.js?v=e89b1d71";
import { useForm, Controller } from "/node_modules/.vite/deps/react-hook-form.js?v=e89b1d71";
import { zodResolver } from "/node_modules/.vite/deps/@hookform_resolvers_zod.js?v=e89b1d71";
import * as z from "/node_modules/.vite/deps/zod.js?v=e89b1d71";
import { useSupabase } from "/src/app/context/SupabaseContext.tsx?t=1779913712504";
import { useSettings } from "/src/app/context/SettingsContext.tsx?t=1779915133644";
import { useDocumentNumbering } from "/src/app/hooks/useDocumentNumbering.ts?t=1779915133644";
import {
  productService,
  mapProductVariationApiToFormRow,
  formatVariationName
} from "/src/app/services/productService.ts?t=1779915133644";
import { variationMasterService } from "/src/app/services/variationMasterService.ts?t=1779830890251";
import { variationLibraryService } from "/src/app/services/variationLibraryService.ts";
import { inventoryService } from "/src/app/services/inventoryService.ts?t=1779830890251";
import { brandService } from "/src/app/services/brandService.ts";
import { productCategoryService } from "/src/app/services/productCategoryService.ts";
import { unitService } from "/src/app/services/unitService.ts";
import { contactService } from "/src/app/services/contactService.ts?t=1779830890251";
import { branchService } from "/src/app/services/branchService.ts?t=1779913712504";
import { comboService } from "/src/app/services/comboService.ts";
import { supabase } from "/src/lib/supabase.ts";
import { uploadProductImages } from "/src/app/utils/productImageUpload.ts";
import { parseVariationAttributesRaw, publicVariationAttributes } from "/src/app/utils/variationFieldMap.ts";
import { ProductImage } from "/src/app/components/products/ProductImage.tsx";
import { getSupabaseStorageDashboardUrl } from "/src/app/utils/paymentAttachmentUrl.ts";
import { toast } from "/node_modules/.vite/deps/sonner.js?v=e89b1d71";
import {
  X,
  Upload,
  Plus,
  Trash2,
  RefreshCcw,
  Package,
  DollarSign
} from "/node_modules/.vite/deps/lucide-react.js?v=e89b1d71";
import { clsx } from "/node_modules/.vite/deps/clsx.js?v=e89b1d71";
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
export default EnhancedProductForm;
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

//# sourceMappingURL=data:application/json;base64,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QUEsV0FxQkE7QUFBQSxPQTVvREY7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQTZvREE7QUFFSjtBQUFFcEIsR0F6N0ZXTixxQkFBbUI7QUFBQSxVQU1FcEYsYUFDZkMsYUFFbUVDLHNCQXNHaEZOLFNBNGdCRkQsV0FBVztBQUFBO0FBQUEsS0EzbkJGeUY7QUEyN0ZiLGVBQWVBO0FBQW9CLElBQUFvYztBQUFBLGFBQUFBLElBQUEiLCJuYW1lcyI6WyJ1c2VDYWxsYmFjayIsInVzZVN0YXRlIiwidXNlRWZmZWN0IiwidXNlUmVmIiwidXNlRHJvcHpvbmUiLCJ1c2VGb3JtIiwiQ29udHJvbGxlciIsInpvZFJlc29sdmVyIiwieiIsInVzZVN1cGFiYXNlIiwidXNlU2V0dGluZ3MiLCJ1c2VEb2N1bWVudE51bWJlcmluZyIsInByb2R1Y3RTZXJ2aWNlIiwibWFwUHJvZHVjdFZhcmlhdGlvbkFwaVRvRm9ybVJvdyIsImZvcm1hdFZhcmlhdGlvbk5hbWUiLCJ2YXJpYXRpb25NYXN0ZXJTZXJ2aWNlIiwidmFyaWF0aW9uTGlicmFyeVNlcnZpY2UiLCJpbnZlbnRvcnlTZXJ2aWNlIiwiYnJhbmRTZXJ2aWNlIiwicHJvZHVjdENhdGVnb3J5U2VydmljZSIsInVuaXRTZXJ2aWNlIiwiY29udGFjdFNlcnZpY2UiLCJicmFuY2hTZXJ2aWNlIiwiY29tYm9TZXJ2aWNlIiwic3VwYWJhc2UiLCJ1cGxvYWRQcm9kdWN0SW1hZ2VzIiwicGFyc2VWYXJpYXRpb25BdHRyaWJ1dGVzUmF3IiwicHVibGljVmFyaWF0aW9uQXR0cmlidXRlcyIsIlByb2R1Y3RJbWFnZSIsImdldFN1cGFiYXNlU3RvcmFnZURhc2hib2FyZFVybCIsInRvYXN0IiwiWCIsIlVwbG9hZCIsIlBsdXMiLCJUcmFzaDIiLCJSZWZyZXNoQ2N3IiwiUGFja2FnZSIsIkRvbGxhclNpZ24iLCJjbHN4IiwiTGFiZWwiLCJJbnB1dCIsIlNlbGVjdCIsIlNlbGVjdENvbnRlbnQiLCJTZWxlY3RJdGVtIiwiU2VsZWN0VHJpZ2dlciIsIlNlbGVjdFZhbHVlIiwiU2VhcmNoYWJsZVNlbGVjdCIsIlN3aXRjaCIsIlRleHRhcmVhIiwiRGlhbG9nIiwiRGlhbG9nQ29udGVudCIsIkRpYWxvZ0hlYWRlciIsIkRpYWxvZ1RpdGxlIiwiRGlhbG9nRm9vdGVyIiwicHJvZHVjdFNjaGVtYSIsIm9iamVjdCIsIm5hbWUiLCJzdHJpbmciLCJtaW4iLCJza3UiLCJiYXJjb2RlVHlwZSIsIm9wdGlvbmFsIiwiYmFyY29kZSIsImJyYW5kIiwiY2F0ZWdvcnkiLCJzdWJDYXRlZ29yeSIsInVuaXQiLCJwdXJjaGFzZVByaWNlIiwiY29lcmNlIiwibnVtYmVyIiwibWFyZ2luIiwic2VsbGluZ1ByaWNlIiwid2hvbGVzYWxlUHJpY2UiLCJ0YXhUeXBlIiwicmVudGFsUHJpY2UiLCJzZWN1cml0eURlcG9zaXQiLCJyZW50YWxEdXJhdGlvbiIsInN0b2NrTWFuYWdlbWVudCIsImJvb2xlYW4iLCJkZWZhdWx0IiwiaW5pdGlhbFN0b2NrIiwiYWxlcnRRdHkiLCJtYXhTdG9jayIsImRlc2NyaXB0aW9uIiwibm90ZXMiLCJzdXBwbGllciIsInN1cHBsaWVyQ29kZSIsInNldFZhbHVlQXNOdW1iZXIiLCJ2IiwidW5kZWZpbmVkIiwibiIsIk51bWJlciIsImlzTmFOIiwiRW5oYW5jZWRQcm9kdWN0Rm9ybSIsInByb2R1Y3QiLCJpbml0aWFsUHJvZHVjdCIsIm9uQ2FuY2VsIiwib25TYXZlIiwib25TYXZlQW5kQWRkIiwiX3MiLCJjb21wYW55SWQiLCJicmFuY2hJZCIsInNldHRpbmdzIiwibW9kdWxlcyIsImdlbmVyYXRlRG9jdW1lbnROdW1iZXIiLCJnZW5lcmF0ZURvY3VtZW50TnVtYmVyU2FmZSIsImluY3JlbWVudE5leHROdW1iZXIiLCJzYXZpbmciLCJzZXRTYXZpbmciLCJzdWJtaXRJblByb2dyZXNzUmVmIiwiZW5hYmxlVmFyaWF0aW9ucyIsInNldEVuYWJsZVZhcmlhdGlvbnMiLCJibG9ja0Rpc2FibGVWYXJpYXRpb25zTW9kYWxPcGVuIiwic2V0QmxvY2tEaXNhYmxlVmFyaWF0aW9uc01vZGFsT3BlbiIsImlzQ29tYm9Qcm9kdWN0Iiwic2V0SXNDb21ib1Byb2R1Y3QiLCJibG9ja0VuYWJsZUNvbWJvTW9kYWxPcGVuIiwic2V0QmxvY2tFbmFibGVDb21ib01vZGFsT3BlbiIsImJsb2NrRGlzYWJsZUNvbWJvTW9kYWxPcGVuIiwic2V0QmxvY2tEaXNhYmxlQ29tYm9Nb2RhbE9wZW4iLCJpbWFnZXMiLCJzZXRJbWFnZXMiLCJleGlzdGluZ0ltYWdlVXJscyIsInNldEV4aXN0aW5nSW1hZ2VVcmxzIiwiaXNSZW50YWxPcHRpb25zT3BlbiIsInNldElzUmVudGFsT3B0aW9uc09wZW4iLCJhY3RpdmVUYWIiLCJzZXRBY3RpdmVUYWIiLCJjYXRlZ29yaWVzIiwic2V0Q2F0ZWdvcmllcyIsInN1YkNhdGVnb3JpZXMiLCJzZXRTdWJDYXRlZ29yaWVzIiwibG9hZGluZ0NhdGVnb3JpZXMiLCJzZXRMb2FkaW5nQ2F0ZWdvcmllcyIsImJyYW5kcyIsInNldEJyYW5kcyIsImxvYWRpbmdCcmFuZHMiLCJzZXRMb2FkaW5nQnJhbmRzIiwidW5pdHMiLCJzZXRVbml0cyIsImxvYWRpbmdVbml0cyIsInNldExvYWRpbmdVbml0cyIsInN1cHBsaWVycyIsInNldFN1cHBsaWVycyIsImxvYWRpbmdTdXBwbGllcnMiLCJzZXRMb2FkaW5nU3VwcGxpZXJzIiwiY29tcGFueUJyYW5jaGVzIiwic2V0Q29tcGFueUJyYW5jaGVzIiwic2VsZWN0ZWRCcmFuY2hJZHMiLCJzZXRTZWxlY3RlZEJyYW5jaElkcyIsInZhcmlhbnRBdHRyaWJ1dGVzIiwic2V0VmFyaWFudEF0dHJpYnV0ZXMiLCJuZXdBdHRyaWJ1dGVOYW1lIiwic2V0TmV3QXR0cmlidXRlTmFtZSIsIm5ld0F0dHJpYnV0ZVZhbHVlIiwic2V0TmV3QXR0cmlidXRlVmFsdWUiLCJzZWxlY3RlZEF0dHJpYnV0ZUluZGV4Iiwic2V0U2VsZWN0ZWRBdHRyaWJ1dGVJbmRleCIsImJsb2NrVmFyaWF0aW9uc01vZGFsT3BlbiIsInNldEJsb2NrVmFyaWF0aW9uc01vZGFsT3BlbiIsImZ1bGxQcm9kdWN0Rm9yRWRpdCIsInNldEZ1bGxQcm9kdWN0Rm9yRWRpdCIsImxvYWRpbmdGdWxsUHJvZHVjdCIsInNldExvYWRpbmdGdWxsUHJvZHVjdCIsImdlbmVyYXRlZFZhcmlhdGlvbnMiLCJzZXRHZW5lcmF0ZWRWYXJpYXRpb25zIiwidmFyaWF0aW9uTWFzdGVyIiwic2V0VmFyaWF0aW9uTWFzdGVyIiwicHJvZHVjdHNXaXRoVmFyaWF0aW9ucyIsInNldFByb2R1Y3RzV2l0aFZhcmlhdGlvbnMiLCJ2YXJpYXRpb25zRm9yQ29weSIsInNldFZhcmlhdGlvbnNGb3JDb3B5IiwibG9hZGluZ1Byb2R1Y3RzV2l0aFZhcmlhdGlvbnMiLCJzZXRMb2FkaW5nUHJvZHVjdHNXaXRoVmFyaWF0aW9ucyIsImNvcHlGcm9tVmFyaWF0aW9uSWQiLCJzZXRDb3B5RnJvbVZhcmlhdGlvbklkIiwiY29tYm9zIiwic2V0Q29tYm9zIiwiY3VycmVudENvbWJvSXRlbXMiLCJzZXRDdXJyZW50Q29tYm9JdGVtcyIsImNvbWJvTmFtZSIsInNldENvbWJvTmFtZSIsImNvbWJvRmluYWxQcmljZSIsInNldENvbWJvRmluYWxQcmljZSIsInByb2R1Y3RTZWFyY2hRdWVyeSIsInNldFByb2R1Y3RTZWFyY2hRdWVyeSIsInNob3dQcm9kdWN0RHJvcGRvd24iLCJzZXRTaG93UHJvZHVjdERyb3Bkb3duIiwiYXZhaWxhYmxlUHJvZHVjdHMiLCJzZXRBdmFpbGFibGVQcm9kdWN0cyIsImxvYWRpbmdQcm9kdWN0cyIsInNldExvYWRpbmdQcm9kdWN0cyIsInJlZ2lzdGVyIiwiaGFuZGxlU3VibWl0IiwiY29udHJvbCIsInNldFZhbHVlIiwid2F0Y2giLCJnZXRWYWx1ZXMiLCJmb3JtU3RhdGUiLCJlcnJvcnMiLCJyZXNvbHZlciIsImRlZmF1bHRWYWx1ZXMiLCJzZWxlY3RlZFVuaXRJZCIsInNlbGVjdGVkVW5pdEFsbG93c0RlY2ltYWwiLCJmaW5kIiwidSIsImlkIiwiYWxsb3dfZGVjaW1hbCIsInBhcnNlVmFyaWF0aW9uUXR5SW5wdXQiLCJyYXciLCJwYXJzZUZsb2F0IiwiaXNGaW5pdGUiLCJNYXRoIiwibWF4IiwicGFyc2VJbnQiLCJsb2FkQ2F0ZWdvcmllcyIsImRhdGEiLCJnZXRDYXRlZ29yaWVzIiwibWFwIiwiYyIsImVycm9yIiwiY29uc29sZSIsImxvYWRCcmFuZHMiLCJnZXRBbGwiLCJiIiwibG9hZFVuaXRzIiwic3ltYm9sIiwic2hvcnRfY29kZSIsImlzX2RlZmF1bHQiLCJjdXJyZW50VW5pdCIsInNldHRpbmdzRGVmYXVsdElkIiwiaW52ZW50b3J5U2V0dGluZ3MiLCJkZWZhdWx0VW5pdElkIiwiZGVmYXVsdFVuaXQiLCJsZWdhY3kiLCJsaWJyYXJ5IiwiUHJvbWlzZSIsImFsbCIsImdldCIsImNhdGNoIiwibGlzdEF0dHJpYnV0ZXMiLCJtZXJnZWQiLCJhdHRyIiwiZXhpc3RpbmciLCJTZXQiLCJ0b0xvd2VyQ2FzZSIsImFkZCIsInZhbHVlcyIsInZhbHVlIiwiZmlsdGVyIiwiaGFzIiwibG9hZFN1cHBsaWVycyIsImdldEFsbENvbnRhY3RzIiwiZ2V0QnJhbmNoZXNDYWNoZWQiLCJ0aGVuIiwiYnJhbmNoZXMiLCJsaXN0IiwicHJvZHVjdElkIiwidXVpZCIsImxlbmd0aCIsImdldFByb2R1Y3RCcmFuY2hJZHMiLCJpZHMiLCJjYW5jZWxsZWQiLCJnZXRBbGxQcm9kdWN0cyIsIndpdGhWYXJzIiwicCIsImhhc192YXJpYXRpb25zIiwiQXJyYXkiLCJpc0FycmF5IiwidmFyaWF0aW9ucyIsImZsYXQiLCJzdXBwbGllcklkIiwic3VwcGxpZXJfaWQiLCJzdXBwbGllck5hbWUiLCJzIiwiZm9yRWFjaCIsImlkeCIsImF0dHJzIiwiYXR0cmlidXRlcyIsImF0dHJOYW1lIiwidmFsIiwiT2JqZWN0IiwiZW50cmllcyIsImxhYmVsIiwicHVzaCIsInZhcmlhdGlvbklkIiwiU3RyaW5nIiwicmVwbGFjZSIsImZpbmFsbHkiLCJzZWxlY3RlZENhdGVnb3J5SWQiLCJsb2FkU3ViQ2F0ZWdvcmllcyIsImdldFN1YkNhdGVnb3JpZXMiLCJnZW5lcmF0ZVNLVSIsInRyaW0iLCJuZXh0U0tVIiwiZSIsImdldFByb2R1Y3QiLCJmdWxsIiwiZXJyIiwic291cmNlIiwiYmFyY29kZV90eXBlIiwiY29zdF9wcmljZSIsInJldGFpbF9wcmljZSIsIndob2xlc2FsZV9wcmljZSIsInJlbnRhbF9wcmljZV9kYWlseSIsIm1pbl9zdG9jayIsImxvd1N0b2NrVGhyZXNob2xkIiwibWF4X3N0b2NrIiwiYnJhbmRfaWQiLCJ1bml0X2lkIiwic3VwcGxpZXJfY29kZSIsImNhdElkIiwiY2F0ZWdvcnlfaWQiLCJnZXRCeUlkIiwiY2F0IiwicGFyZW50X2lkIiwiZmlyc3RQYXJzZWQiLCJhdHRyTmFtZXMiLCJrZXlzIiwic29ydCIsImEiLCJsb2NhbGVDb21wYXJlIiwidmFsdWVzQnlBdHRyIiwiayIsImZyb20iLCJtYXBwZWQiLCJwaWQiLCJzb21lIiwibSIsImJyYW5jaFNjb3BlIiwid2l0aE1vdmVtZW50Iiwicm93IiwicXR5IiwiZ2V0U3RvY2siLCJzdG9jayIsInVybHMiLCJpbWFnZV91cmxzIiwiaXNfY29tYm9fcHJvZHVjdCIsImxvYWRQcm9kdWN0Q29tYm9zIiwiaGFzVmFyIiwic2hvdWxkVmFsaWRhdGUiLCJzaG91bGREaXJ0eSIsInJvdW5kIiwiZmFsbGJhY2siLCJjdXJyZW50X3N0b2NrIiwiY29tYm9zRW5hYmxlZCIsImxvYWRBdmFpbGFibGVQcm9kdWN0cyIsImN1cnJlbnRQcm9kdWN0SWQiLCJpc1ZhbGlkVXVpZCIsInRlc3QiLCJxdWVyeSIsInNlbGVjdCIsImVxIiwibmVxIiwib3JkZXIiLCJjb21ibyIsImdldENvbWJvQnlQcm9kdWN0SWQiLCJpdGVtc1dpdGhEZXRhaWxzIiwiZ2V0Q29tYm9JdGVtc1dpdGhEZXRhaWxzIiwiY29tYm9fbmFtZSIsImNvbWJvX3ByaWNlIiwiaXRlbXMiLCJpdGVtIiwicHJvZHVjdF9pZCIsInByb2R1Y3RfbmFtZSIsInByb2R1Y3Rfc2t1IiwidmFyaWF0aW9uX2lkIiwidW5pdF9wcmljZSIsInB1cmNoYXNlUHJpY2VOdW0iLCJtYXJnaW5OdW0iLCJzcCIsInRvRml4ZWQiLCJvbkRyb3AiLCJhY2NlcHRlZEZpbGVzIiwicHJldiIsImdldFJvb3RQcm9wcyIsImdldElucHV0UHJvcHMiLCJpc0RyYWdBY3RpdmUiLCJhY2NlcHQiLCJtYXhTaXplIiwiZ2VuZXJhdGVTS1VGb3JGb3JtIiwiaGFuZGxlRW5hYmxlVmFyaWF0aW9uc0NoYW5nZSIsImNoZWNrZWQiLCJwYXJlbnRDb3VudCIsImdldFBhcmVudExldmVsTW92ZW1lbnRDb3VudCIsInZhcmlhdGlvbkNvdW50IiwiZ2V0VmFyaWF0aW9uTGV2ZWxNb3ZlbWVudENvdW50IiwiaGFuZGxlRW5hYmxlQ29tYm9DaGFuZ2UiLCJwZXJzaXN0VmFyaWF0aW9uTWFzdGVyTWVyZ2UiLCJuZXh0Iiwic2F2ZSIsImFkZFZhcmlhbnRBdHRyaWJ1dGUiLCJhZGRBdHRyaWJ1dGVWYWx1ZSIsInVwZGF0ZWRBdHRyaWJ1dGVzIiwiaW5jbHVkZXMiLCJyZW1vdmVWYXJpYW50QXR0cmlidXRlIiwicmVtb3ZlQXR0cmlidXRlVmFsdWUiLCJhdHRySW5kZXgiLCJ2YWx1ZUluZGV4Iiwic3BsaWNlIiwiY29weUF0dHJpYnV0ZXNGcm9tUHJvZHVjdCIsInZhcnMiLCJhdHRyTWFwIiwia2V5IiwiZGVyaXZlZCIsInNldCIsInN1Y2Nlc3MiLCJNQVhfVkFSSUFUSU9OUyIsImNhcnRlc2lhblByb2R1Y3QiLCJhcnJheXMiLCJyZWR1Y2UiLCJmbGF0TWFwIiwiZCIsInZhcmlhdGlvbkNvbWJvS2V5IiwiY29tYmluYXRpb25PYmoiLCJqb2luIiwiZ2VuZXJhdGVWYXJpYXRpb25zIiwiYXR0cmlidXRlVmFsdWVzIiwiY29tYmluYXRpb25zIiwiYmFzZVNrdSIsImJhc2ljU2VsbGluZ1ByaWNlIiwiYmFzaWNQdXJjaGFzZVByaWNlIiwiZXhpc3RpbmdCeUNvbWJvIiwiTWFwIiwiZXYiLCJjb21iaW5hdGlvbiIsIm5ld1ZhcmlhdGlvbnMiLCJpbmRleCIsImkiLCJwcmljZSIsImZpbHRlcmVkUHJvZHVjdHMiLCJzZWxlY3RQcm9kdWN0IiwicmVtb3ZlQ29tYm9JdGVtIiwiXyIsInVwZGF0ZUNvbWJvSXRlbVF0eSIsInVwZGF0ZWQiLCJ1cGRhdGVDb21ib0l0ZW1QcmljZSIsInNhdmVDb21ibyIsInVwZGF0ZUNvbWJvIiwidXBkYXRlQ29tYm9JdGVtcyIsIm5ld0NvbWJvIiwiY3JlYXRlQ29tYm8iLCJjb21wYW55X2lkIiwiY29tYm9fcHJvZHVjdF9pZCIsIm1lc3NhZ2UiLCJkZWxldGVDb21ibyIsIm9uU3VibWl0IiwiYWN0aW9uIiwiY3VycmVudCIsImZpbmFsQ29tcGFueUlkIiwiZmluYWxTS1UiLCJVVUlEX1JFR0VYIiwiYXNJZCIsInJhd1VuaXQiLCJyYXdDYXRlZ29yeSIsInJhd1N1YkNhdGVnb3J5IiwicmF3QnJhbmQiLCJjYXRlZ29yeUlkIiwiZm91bmQiLCJ1bml0SWQiLCJicmFuZElkIiwiYmFyY29kZVZhbHVlIiwiYmFyY29kZUVycm9yIiwid2FybiIsInByb2R1Y3REYXRhIiwiaXNfcmVudGFibGUiLCJpc19zZWxsYWJsZSIsInRyYWNrX3N0b2NrIiwiaXNfYWN0aXZlIiwiaXNFZGl0IiwiaW1hZ2VVcmxzIiwibmV3VXJscyIsInVwbG9hZEVyciIsIm1zZyIsImlzQnVja2V0TWlzc2luZyIsIm9uQ2xpY2siLCJ3aW5kb3ciLCJvcGVuIiwicGFyZW50TGV2ZWxDb3VudCIsImhhc1ZhcmlhdGlvbnMiLCJtb3ZlbWVudENvdW50IiwiZ2V0TW92ZW1lbnRDb3VudEZvclByb2R1Y3QiLCJyZXN1bHQiLCJ1cGRhdGVQcm9kdWN0IiwiYnJhbmNoSWRPck51bGwiLCJwYXJlbnRDb3N0IiwicGFyZW50U2VsbCIsInB1cmNoTiIsInNlbGxOIiwiY29zdCIsInNlbGxpbmciLCJpbXBvcnQiLCJlbnYiLCJERVYiLCJ1cGRhdGVWYXJpYXRpb24iLCJhbGxvd1YiLCJhbGxvd3NWYXJpYXRpb25PcGVuaW5nUmVjb25jaWxlRnJvbVByb2R1Y3RGb3JtIiwidk1vdkVyciIsInJlY29uY2lsZVZhcmlhdGlvbk9wZW5pbmdTdG9jayIsInEiLCJjcmVhdGVkIiwiY3JlYXRlVmFyaWF0aW9uIiwidmlkIiwibW92RXJyIiwiaW5zZXJ0T3BlbmluZ0JhbGFuY2VNb3ZlbWVudCIsInZlIiwid2FybmluZyIsImNhblJlY29uY2lsZU9wZW5pbmciLCJhbGxvd3NQYXJlbnRPcGVuaW5nUmVjb25jaWxlRnJvbVByb2R1Y3RGb3JtIiwicmVjb25jaWxlUGFyZW50TGV2ZWxPcGVuaW5nU3RvY2siLCJzZXRQcm9kdWN0QnJhbmNoQXZhaWxhYmlsaXR5IiwiYnJhbmNoRXJyIiwicGF5bG9hZCIsImlzU2VsbGFibGUiLCJpc1JlbnRhYmxlIiwidmFyaWF0aW9uUGF5bG9hZCIsInZhcmlhdGlvbiIsInJldGFpbCIsIm9wZW5pbmdfc3RvY2siLCJzYXZlUmVzdWx0Iiwic2F2ZVByb2R1Y3RXaXRoVmFyaWF0aW9ucyIsInBhcmVudCIsIndhc0VkaXQiLCJkdXJhdGlvbiIsInNlYXJjaFRleHQiLCJjcmVhdGUiLCJzZXRWYWx1ZUFzIiwiZmllbGQiLCJvbkNoYW5nZSIsInVybCIsInN0b3BQcm9wYWdhdGlvbiIsImZpbGUiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJlbnRyeSIsIngiLCJpbmZvIiwidGFyZ2V0IiwicHJldmVudERlZmF1bHQiLCJldmVyeSIsImNvdW50IiwiYWNjIiwiYXRMaW1pdCIsIm1heEhlaWdodCIsInN1bSIsIl9jIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkVuaGFuY2VkUHJvZHVjdEZvcm0udHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCwgeyB1c2VDYWxsYmFjaywgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlUmVmIH0gZnJvbSBcInJlYWN0XCI7XHJcbmltcG9ydCB7IHVzZURyb3B6b25lIH0gZnJvbSBcInJlYWN0LWRyb3B6b25lXCI7XHJcbmltcG9ydCB7IHVzZUZvcm0sIENvbnRyb2xsZXIgfSBmcm9tIFwicmVhY3QtaG9vay1mb3JtXCI7XHJcbmltcG9ydCB7IHpvZFJlc29sdmVyIH0gZnJvbSBcIkBob29rZm9ybS9yZXNvbHZlcnMvem9kXCI7XHJcbmltcG9ydCAqIGFzIHogZnJvbSBcInpvZFwiO1xyXG5pbXBvcnQgeyB1c2VTdXBhYmFzZSB9IGZyb20gJ0AvYXBwL2NvbnRleHQvU3VwYWJhc2VDb250ZXh0JztcclxuaW1wb3J0IHsgdXNlU2V0dGluZ3MgfSBmcm9tICdAL2FwcC9jb250ZXh0L1NldHRpbmdzQ29udGV4dCc7XHJcbmltcG9ydCB7IHVzZURvY3VtZW50TnVtYmVyaW5nIH0gZnJvbSAnQC9hcHAvaG9va3MvdXNlRG9jdW1lbnROdW1iZXJpbmcnO1xyXG5pbXBvcnQge1xyXG4gIHByb2R1Y3RTZXJ2aWNlLFxyXG4gIG1hcFByb2R1Y3RWYXJpYXRpb25BcGlUb0Zvcm1Sb3csXHJcbiAgZm9ybWF0VmFyaWF0aW9uTmFtZSxcclxufSBmcm9tICdAL2FwcC9zZXJ2aWNlcy9wcm9kdWN0U2VydmljZSc7XHJcbmltcG9ydCB7IHZhcmlhdGlvbk1hc3RlclNlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy92YXJpYXRpb25NYXN0ZXJTZXJ2aWNlJztcclxuaW1wb3J0IHsgdmFyaWF0aW9uTGlicmFyeVNlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy92YXJpYXRpb25MaWJyYXJ5U2VydmljZSc7XHJcbmltcG9ydCB7IGludmVudG9yeVNlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy9pbnZlbnRvcnlTZXJ2aWNlJztcclxuaW1wb3J0IHsgYnJhbmRTZXJ2aWNlIH0gZnJvbSAnQC9hcHAvc2VydmljZXMvYnJhbmRTZXJ2aWNlJztcclxuaW1wb3J0IHsgcHJvZHVjdENhdGVnb3J5U2VydmljZSB9IGZyb20gJ0AvYXBwL3NlcnZpY2VzL3Byb2R1Y3RDYXRlZ29yeVNlcnZpY2UnO1xyXG5pbXBvcnQgeyB1bml0U2VydmljZSB9IGZyb20gJ0AvYXBwL3NlcnZpY2VzL3VuaXRTZXJ2aWNlJztcclxuaW1wb3J0IHsgY29udGFjdFNlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy9jb250YWN0U2VydmljZSc7XHJcbmltcG9ydCB7IGJyYW5jaFNlcnZpY2UgfSBmcm9tICdAL2FwcC9zZXJ2aWNlcy9icmFuY2hTZXJ2aWNlJztcclxuaW1wb3J0IHsgY29tYm9TZXJ2aWNlIH0gZnJvbSAnQC9hcHAvc2VydmljZXMvY29tYm9TZXJ2aWNlJztcclxuaW1wb3J0IHsgc3VwYWJhc2UgfSBmcm9tICdAL2xpYi9zdXBhYmFzZSc7XHJcbmltcG9ydCB7IHVwbG9hZFByb2R1Y3RJbWFnZXMgfSBmcm9tICdAL2FwcC91dGlscy9wcm9kdWN0SW1hZ2VVcGxvYWQnO1xyXG5pbXBvcnQgeyBwYXJzZVZhcmlhdGlvbkF0dHJpYnV0ZXNSYXcsIHB1YmxpY1ZhcmlhdGlvbkF0dHJpYnV0ZXMgfSBmcm9tICdAL2FwcC91dGlscy92YXJpYXRpb25GaWVsZE1hcCc7XHJcbmltcG9ydCB7IFByb2R1Y3RJbWFnZSB9IGZyb20gJy4vUHJvZHVjdEltYWdlJztcclxuaW1wb3J0IHsgZ2V0U3VwYWJhc2VTdG9yYWdlRGFzaGJvYXJkVXJsIH0gZnJvbSAnQC9hcHAvdXRpbHMvcGF5bWVudEF0dGFjaG1lbnRVcmwnO1xyXG5pbXBvcnQgeyB0b2FzdCB9IGZyb20gJ3Nvbm5lcic7XHJcbmltcG9ydCB7XHJcbiAgWCxcclxuICBVcGxvYWQsXHJcbiAgUGx1cyxcclxuICBNaW51cyxcclxuICBUcmFzaDIsXHJcbiAgUmVmcmVzaENjdyxcclxuICBCYXJjb2RlLFxyXG4gIFBhY2thZ2UsXHJcbiAgRG9sbGFyU2lnbixcclxuICBDbG9jayxcclxuICBTaGllbGQsXHJcbiAgQ2hldnJvbkRvd24sXHJcbiAgU2VhcmNoLFxyXG59IGZyb20gXCJsdWNpZGUtcmVhY3RcIjtcclxuaW1wb3J0IHsgY2xzeCB9IGZyb20gXCJjbHN4XCI7XHJcbmltcG9ydCB7XHJcbiAgQWNjb3JkaW9uLFxyXG4gIEFjY29yZGlvbkNvbnRlbnQsXHJcbiAgQWNjb3JkaW9uSXRlbSxcclxuICBBY2NvcmRpb25UcmlnZ2VyLFxyXG59IGZyb20gXCIuLi91aS9hY2NvcmRpb25cIjtcclxuaW1wb3J0IHsgTGFiZWwgfSBmcm9tIFwiLi4vdWkvbGFiZWxcIjtcclxuaW1wb3J0IHsgSW5wdXQgfSBmcm9tIFwiLi4vdWkvaW5wdXRcIjtcclxuaW1wb3J0IHtcclxuICBTZWxlY3QsXHJcbiAgU2VsZWN0Q29udGVudCxcclxuICBTZWxlY3RJdGVtLFxyXG4gIFNlbGVjdFRyaWdnZXIsXHJcbiAgU2VsZWN0VmFsdWUsXHJcbn0gZnJvbSBcIi4uL3VpL3NlbGVjdFwiO1xyXG5pbXBvcnQgeyBTZWFyY2hhYmxlU2VsZWN0IH0gZnJvbSBcIi4uL3VpL3NlYXJjaGFibGUtc2VsZWN0XCI7XHJcbmltcG9ydCB7IFN3aXRjaCB9IGZyb20gXCIuLi91aS9zd2l0Y2hcIjtcclxuaW1wb3J0IHsgVGV4dGFyZWEgfSBmcm9tIFwiLi4vdWkvdGV4dGFyZWFcIjtcclxuaW1wb3J0IHsgU2VwYXJhdG9yIH0gZnJvbSBcIi4uL3VpL3NlcGFyYXRvclwiO1xyXG5pbXBvcnQge1xyXG4gIENvbGxhcHNpYmxlLFxyXG4gIENvbGxhcHNpYmxlQ29udGVudCxcclxuICBDb2xsYXBzaWJsZVRyaWdnZXIsXHJcbn0gZnJvbSBcIi4uL3VpL2NvbGxhcHNpYmxlXCI7XHJcbmltcG9ydCB7XHJcbiAgRGlhbG9nLFxyXG4gIERpYWxvZ0NvbnRlbnQsXHJcbiAgRGlhbG9nSGVhZGVyLFxyXG4gIERpYWxvZ1RpdGxlLFxyXG4gIERpYWxvZ0Zvb3RlcixcclxufSBmcm9tIFwiLi4vdWkvZGlhbG9nXCI7XHJcblxyXG4vLyBEZWZpbmUgdGhlIHZhbGlkYXRpb24gc2NoZW1hIChhbGlnbmVkIHdpdGggc3VibWl0IGFuZCBEQilcclxuY29uc3QgcHJvZHVjdFNjaGVtYSA9IHoub2JqZWN0KHtcclxuICBuYW1lOiB6LnN0cmluZygpLm1pbigxLCBcIlByb2R1Y3QgbmFtZSBpcyByZXF1aXJlZFwiKSxcclxuICBza3U6IHouc3RyaW5nKCkubWluKDEsIFwiU0tVIGlzIHJlcXVpcmVkXCIpLFxyXG4gIGJhcmNvZGVUeXBlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgYmFyY29kZTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gIGJyYW5kOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXHJcbiAgY2F0ZWdvcnk6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICBzdWJDYXRlZ29yeTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gIHVuaXQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuXHJcbiAgLy8gU2FsZXMgUHJpY2luZyAoQWx3YXlzIFNlbGxhYmxlIGluIFJldGFpbCBNb2RlKVxyXG4gIHB1cmNoYXNlUHJpY2U6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5vcHRpb25hbCgpLFxyXG4gIG1hcmdpbjogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm9wdGlvbmFsKCksXHJcbiAgc2VsbGluZ1ByaWNlOiB6LmNvZXJjZVxyXG4gICAgLm51bWJlcigpXHJcbiAgICAubWluKDAuMDEsIFwiU2VsbGluZyBwcmljZSBpcyByZXF1aXJlZFwiKSxcclxuICB3aG9sZXNhbGVQcmljZTogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm9wdGlvbmFsKCksXHJcbiAgdGF4VHlwZTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG5cclxuICAvLyBSZW50YWwgUHJpY2luZyAoT3B0aW9uYWwpXHJcbiAgcmVudGFsUHJpY2U6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5vcHRpb25hbCgpLFxyXG4gIHNlY3VyaXR5RGVwb3NpdDogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm9wdGlvbmFsKCksXHJcbiAgcmVudGFsRHVyYXRpb246IHouY29lcmNlLm51bWJlcigpLm1pbigxKS5vcHRpb25hbCgpLFxyXG5cclxuICAvLyBJbnZlbnRvcnkgKGluaXRpYWxTdG9jayA9IGN1cnJlbnRfc3RvY2ssIGFsZXJ0UXR5ID0gbWluX3N0b2NrKVxyXG4gIHN0b2NrTWFuYWdlbWVudDogei5ib29sZWFuKCkuZGVmYXVsdCh0cnVlKSxcclxuICBpbml0aWFsU3RvY2s6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5vcHRpb25hbCgpLFxyXG4gIGFsZXJ0UXR5OiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkub3B0aW9uYWwoKSxcclxuICBtYXhTdG9jazogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm9wdGlvbmFsKCksXHJcblxyXG4gIC8vIERldGFpbHNcclxuICBkZXNjcmlwdGlvbjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxyXG4gIG5vdGVzOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXHJcblxyXG4gIC8vIFN1cHBsaWVyXHJcbiAgc3VwcGxpZXI6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcclxuICBzdXBwbGllckNvZGU6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcclxufSk7XHJcblxyXG50eXBlIFByb2R1Y3RGb3JtVmFsdWVzID0gei5pbmZlcjx0eXBlb2YgcHJvZHVjdFNjaGVtYT47XHJcblxyXG4vLyBFbnN1cmUgbnVtYmVyIGlucHV0cyBuZXZlciBzaG93IGVtcHR5IG9uIGNsaWNrL2NsZWFyIOKAlCBzdG9yZSAwIGluc3RlYWQgb2YgXCJcIlxyXG5jb25zdCBzZXRWYWx1ZUFzTnVtYmVyID0gKHY6IHVua25vd24pOiBudW1iZXIgPT4ge1xyXG4gIGlmICh2ID09PSAnJyB8fCB2ID09PSB1bmRlZmluZWQgfHwgdiA9PT0gbnVsbCkgcmV0dXJuIDA7XHJcbiAgY29uc3QgbiA9IE51bWJlcih2KTtcclxuICByZXR1cm4gTnVtYmVyLmlzTmFOKG4pID8gMCA6IG47XHJcbn07XHJcblxyXG5pbnRlcmZhY2UgRW5oYW5jZWRQcm9kdWN0Rm9ybVByb3BzIHtcclxuICBwcm9kdWN0PzogYW55OyAvLyBQcm9kdWN0IGRhdGEgZm9yIGVkaXQgbW9kZVxyXG4gIG9uQ2FuY2VsOiAoKSA9PiB2b2lkO1xyXG4gIG9uU2F2ZTogKHByb2R1Y3Q/OiBhbnkpID0+IHZvaWQ7XHJcbiAgb25TYXZlQW5kQWRkPzogKHByb2R1Y3Q6IGFueSkgPT4gdm9pZDtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IEVuaGFuY2VkUHJvZHVjdEZvcm0gPSAoe1xyXG4gIHByb2R1Y3Q6IGluaXRpYWxQcm9kdWN0LFxyXG4gIG9uQ2FuY2VsLFxyXG4gIG9uU2F2ZSxcclxuICBvblNhdmVBbmRBZGQsXHJcbn06IEVuaGFuY2VkUHJvZHVjdEZvcm1Qcm9wcykgPT4ge1xyXG4gIGNvbnN0IHsgY29tcGFueUlkLCBicmFuY2hJZCB9ID0gdXNlU3VwYWJhc2UoKTtcclxuICBjb25zdCBzZXR0aW5ncyA9IHVzZVNldHRpbmdzKCk7XHJcbiAgY29uc3QgeyBtb2R1bGVzIH0gPSBzZXR0aW5ncztcclxuICBjb25zdCB7IGdlbmVyYXRlRG9jdW1lbnROdW1iZXIsIGdlbmVyYXRlRG9jdW1lbnROdW1iZXJTYWZlLCBpbmNyZW1lbnROZXh0TnVtYmVyIH0gPSB1c2VEb2N1bWVudE51bWJlcmluZygpO1xyXG4gIGNvbnN0IFtzYXZpbmcsIHNldFNhdmluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgLyoqIFN5bmNocm9ub3VzIGd1YXJkIHRvIHByZXZlbnQgZG91YmxlIHN1Ym1pdCAoc3RhdGUgdXBkYXRlIGlzIGFzeW5jKS4gKi9cclxuICBjb25zdCBzdWJtaXRJblByb2dyZXNzUmVmID0gdXNlUmVmKGZhbHNlKTtcclxuICAvKiogRW5hYmxlIFZhcmlhdGlvbnMgdG9nZ2xlOiBkZWZhdWx0IE9GRiBmb3IgbmV3IHByb2R1Y3QsIGZyb20gREIgZm9yIGVkaXQuIFdoZW4gT04sIHBhcmVudCBzdG9jayBsb2NrZWQgYXQgMC4gKi9cclxuICBjb25zdCBbZW5hYmxlVmFyaWF0aW9ucywgc2V0RW5hYmxlVmFyaWF0aW9uc10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2Jsb2NrRGlzYWJsZVZhcmlhdGlvbnNNb2RhbE9wZW4sIHNldEJsb2NrRGlzYWJsZVZhcmlhdGlvbnNNb2RhbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIFxyXG4gIC8qKiBFbmFibGUgQ29tYm8gUHJvZHVjdCB0b2dnbGU6IGRlZmF1bHQgT0ZGIGZvciBuZXcgcHJvZHVjdCwgZnJvbSBEQiBmb3IgZWRpdC4gV2hlbiBPTiwgcHJvZHVjdCBiZWNvbWVzIHZpcnR1YWwgYnVuZGxlIC0gbm8gc3RvY2suICovXHJcbiAgY29uc3QgW2lzQ29tYm9Qcm9kdWN0LCBzZXRJc0NvbWJvUHJvZHVjdF0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2Jsb2NrRW5hYmxlQ29tYm9Nb2RhbE9wZW4sIHNldEJsb2NrRW5hYmxlQ29tYm9Nb2RhbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtibG9ja0Rpc2FibGVDb21ib01vZGFsT3Blbiwgc2V0QmxvY2tEaXNhYmxlQ29tYm9Nb2RhbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtpbWFnZXMsIHNldEltYWdlc10gPSB1c2VTdGF0ZTxGaWxlW10+KFtdKTtcclxuICBjb25zdCBbZXhpc3RpbmdJbWFnZVVybHMsIHNldEV4aXN0aW5nSW1hZ2VVcmxzXSA9IHVzZVN0YXRlPHN0cmluZ1tdPihbXSk7XHJcbiAgY29uc3QgW2lzUmVudGFsT3B0aW9uc09wZW4sIHNldElzUmVudGFsT3B0aW9uc09wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSB1c2VTdGF0ZTwnYmFzaWMnIHwgJ3ByaWNpbmcnIHwgJ2ludmVudG9yeScgfCAnbWVkaWEnIHwgJ2RldGFpbHMnIHwgJ3ZhcmlhdGlvbnMnIHwgJ2NvbWJvcyc+KCdiYXNpYycpO1xyXG4gIGNvbnN0IFtjYXRlZ29yaWVzLCBzZXRDYXRlZ29yaWVzXSA9IHVzZVN0YXRlPEFycmF5PHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0+PihbXSk7XHJcbiAgY29uc3QgW3N1YkNhdGVnb3JpZXMsIHNldFN1YkNhdGVnb3JpZXNdID0gdXNlU3RhdGU8QXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4+KFtdKTtcclxuICBjb25zdCBbbG9hZGluZ0NhdGVnb3JpZXMsIHNldExvYWRpbmdDYXRlZ29yaWVzXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbYnJhbmRzLCBzZXRCcmFuZHNdID0gdXNlU3RhdGU8QXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4+KFtdKTtcclxuICBjb25zdCBbbG9hZGluZ0JyYW5kcywgc2V0TG9hZGluZ0JyYW5kc10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3VuaXRzLCBzZXRVbml0c10gPSB1c2VTdGF0ZTxBcnJheTx7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgc3ltYm9sPzogc3RyaW5nIH0+PihbXSk7XHJcbiAgY29uc3QgW2xvYWRpbmdVbml0cywgc2V0TG9hZGluZ1VuaXRzXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbc3VwcGxpZXJzLCBzZXRTdXBwbGllcnNdID0gdXNlU3RhdGU8QXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4+KFtdKTtcclxuICBjb25zdCBbbG9hZGluZ1N1cHBsaWVycywgc2V0TG9hZGluZ1N1cHBsaWVyc10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2NvbXBhbnlCcmFuY2hlcywgc2V0Q29tcGFueUJyYW5jaGVzXSA9IHVzZVN0YXRlPEFycmF5PHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0+PihbXSk7XHJcbiAgY29uc3QgW3NlbGVjdGVkQnJhbmNoSWRzLCBzZXRTZWxlY3RlZEJyYW5jaElkc10gPSB1c2VTdGF0ZTxzdHJpbmdbXT4oW10pO1xyXG5cclxuICAvLyBWYXJpYXRpb25zIFN0YXRlXHJcbiAgY29uc3QgW3ZhcmlhbnRBdHRyaWJ1dGVzLCBzZXRWYXJpYW50QXR0cmlidXRlc10gPSB1c2VTdGF0ZTxBcnJheTx7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICB2YWx1ZXM6IHN0cmluZ1tdO1xyXG4gIH0+PihbXSk7XHJcbiAgY29uc3QgW25ld0F0dHJpYnV0ZU5hbWUsIHNldE5ld0F0dHJpYnV0ZU5hbWVdID0gdXNlU3RhdGUoJycpO1xyXG4gIGNvbnN0IFtuZXdBdHRyaWJ1dGVWYWx1ZSwgc2V0TmV3QXR0cmlidXRlVmFsdWVdID0gdXNlU3RhdGUoJycpO1xyXG4gIGNvbnN0IFtzZWxlY3RlZEF0dHJpYnV0ZUluZGV4LCBzZXRTZWxlY3RlZEF0dHJpYnV0ZUluZGV4XSA9IHVzZVN0YXRlPG51bWJlciB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IFtibG9ja1ZhcmlhdGlvbnNNb2RhbE9wZW4sIHNldEJsb2NrVmFyaWF0aW9uc01vZGFsT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgLyoqIFdoZW4gaW4gZWRpdCBtb2RlLCBmdWxsIHByb2R1Y3QgZmV0Y2hlZCBmcm9tIEFQSSAod2l0aCB2YXJpYXRpb25zLCBjYXRlZ29yeV9pZCwgZXRjLikuIEZvcm0gaHlkcmF0ZXMgZnJvbSB0aGlzLiAqL1xyXG4gIGNvbnN0IFtmdWxsUHJvZHVjdEZvckVkaXQsIHNldEZ1bGxQcm9kdWN0Rm9yRWRpdF0gPSB1c2VTdGF0ZTxhbnk+KG51bGwpO1xyXG4gIGNvbnN0IFtsb2FkaW5nRnVsbFByb2R1Y3QsIHNldExvYWRpbmdGdWxsUHJvZHVjdF0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2dlbmVyYXRlZFZhcmlhdGlvbnMsIHNldEdlbmVyYXRlZFZhcmlhdGlvbnNdID0gdXNlU3RhdGU8XHJcbiAgICBBcnJheTx7XHJcbiAgICAgIGlkPzogc3RyaW5nO1xyXG4gICAgICBjb21iaW5hdGlvbjogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcclxuICAgICAgc2t1OiBzdHJpbmc7XHJcbiAgICAgIHByaWNlOiBudW1iZXI7XHJcbiAgICAgIHB1cmNoYXNlUHJpY2U6IG51bWJlcjtcclxuICAgICAgc3RvY2s6IG51bWJlcjtcclxuICAgICAgYmFyY29kZTogc3RyaW5nO1xyXG4gICAgfT5cclxuICA+KFtdKTtcclxuICAvKiogU2V0dGluZ3Mg4oaSIEludmVudG9yeSDihpIgVmFyaWF0aW9ucyBtYXN0ZXIgKHNlYXJjaGFibGUgcGlja3MgKyBpbmxpbmUgbWVyZ2UpLiAqL1xyXG4gIGNvbnN0IFt2YXJpYXRpb25NYXN0ZXIsIHNldFZhcmlhdGlvbk1hc3Rlcl0gPSB1c2VTdGF0ZTxSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4+KHt9KTtcclxuICBjb25zdCBbcHJvZHVjdHNXaXRoVmFyaWF0aW9ucywgc2V0UHJvZHVjdHNXaXRoVmFyaWF0aW9uc10gPSB1c2VTdGF0ZTxBcnJheTx7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgc2t1OiBzdHJpbmc7IHZhcmlhdGlvbnM/OiBBcnJheTx7IGF0dHJpYnV0ZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0+IH0+PihbXSk7XHJcbiAgY29uc3QgW3ZhcmlhdGlvbnNGb3JDb3B5LCBzZXRWYXJpYXRpb25zRm9yQ29weV0gPSB1c2VTdGF0ZTxBcnJheTx7IHByb2R1Y3RJZDogc3RyaW5nOyB2YXJpYXRpb25JZDogc3RyaW5nOyBwcm9kdWN0OiBhbnk7IHN1cHBsaWVyTmFtZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+PihbXSk7XHJcbiAgY29uc3QgW2xvYWRpbmdQcm9kdWN0c1dpdGhWYXJpYXRpb25zLCBzZXRMb2FkaW5nUHJvZHVjdHNXaXRoVmFyaWF0aW9uc10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2NvcHlGcm9tVmFyaWF0aW9uSWQsIHNldENvcHlGcm9tVmFyaWF0aW9uSWRdID0gdXNlU3RhdGU8c3RyaW5nPignJyk7XHJcblxyXG4gIC8vIENvbWJvcyBTdGF0ZVxyXG4gIGNvbnN0IFtjb21ib3MsIHNldENvbWJvc10gPSB1c2VTdGF0ZTxBcnJheTx7XHJcbiAgICBpZDogc3RyaW5nO1xyXG4gICAgY29tYm9fbmFtZTogc3RyaW5nO1xyXG4gICAgY29tYm9fcHJpY2U6IG51bWJlcjtcclxuICAgIGl0ZW1zOiBBcnJheTx7XHJcbiAgICAgIGlkPzogc3RyaW5nO1xyXG4gICAgICBwcm9kdWN0X2lkOiBzdHJpbmc7XHJcbiAgICAgIHByb2R1Y3RfbmFtZT86IHN0cmluZztcclxuICAgICAgcHJvZHVjdF9za3U/OiBzdHJpbmc7XHJcbiAgICAgIHZhcmlhdGlvbl9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICAgIHF0eTogbnVtYmVyO1xyXG4gICAgICB1bml0X3ByaWNlPzogbnVtYmVyIHwgbnVsbDtcclxuICAgIH0+O1xyXG4gIH0+PihbXSk7XHJcbiAgY29uc3QgW2N1cnJlbnRDb21ib0l0ZW1zLCBzZXRDdXJyZW50Q29tYm9JdGVtc10gPSB1c2VTdGF0ZTxBcnJheTx7XHJcbiAgICBwcm9kdWN0X2lkOiBzdHJpbmc7XHJcbiAgICBwcm9kdWN0X25hbWU6IHN0cmluZztcclxuICAgIHByb2R1Y3Rfc2t1OiBzdHJpbmc7XHJcbiAgICB2YXJpYXRpb25faWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgcXR5OiBudW1iZXI7XHJcbiAgICB1bml0X3ByaWNlPzogbnVtYmVyIHwgbnVsbDtcclxuICB9Pj4oW10pO1xyXG4gIGNvbnN0IFtjb21ib05hbWUsIHNldENvbWJvTmFtZV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2NvbWJvRmluYWxQcmljZSwgc2V0Q29tYm9GaW5hbFByaWNlXSA9IHVzZVN0YXRlKDApO1xyXG4gIGNvbnN0IFtwcm9kdWN0U2VhcmNoUXVlcnksIHNldFByb2R1Y3RTZWFyY2hRdWVyeV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW3Nob3dQcm9kdWN0RHJvcGRvd24sIHNldFNob3dQcm9kdWN0RHJvcGRvd25dID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFthdmFpbGFibGVQcm9kdWN0cywgc2V0QXZhaWxhYmxlUHJvZHVjdHNdID0gdXNlU3RhdGU8QXJyYXk8e1xyXG4gICAgaWQ6IHN0cmluZztcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIHNrdTogc3RyaW5nO1xyXG4gICAgcmV0YWlsX3ByaWNlOiBudW1iZXI7XHJcbiAgICBoYXNfdmFyaWF0aW9uczogYm9vbGVhbjtcclxuICB9Pj4oW10pO1xyXG4gIGNvbnN0IFtsb2FkaW5nUHJvZHVjdHMsIHNldExvYWRpbmdQcm9kdWN0c10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcblxyXG4gIGNvbnN0IHtcclxuICAgIHJlZ2lzdGVyLFxyXG4gICAgaGFuZGxlU3VibWl0LFxyXG4gICAgY29udHJvbCxcclxuICAgIHNldFZhbHVlLFxyXG4gICAgd2F0Y2gsXHJcbiAgICBnZXRWYWx1ZXMsXHJcbiAgICBmb3JtU3RhdGU6IHsgZXJyb3JzIH0sXHJcbiAgfSA9IHVzZUZvcm08UHJvZHVjdEZvcm1WYWx1ZXM+KHtcclxuICAgIHJlc29sdmVyOiB6b2RSZXNvbHZlcihwcm9kdWN0U2NoZW1hKSxcclxuICAgIGRlZmF1bHRWYWx1ZXM6IHtcclxuICAgICAgbmFtZTogXCJcIixcclxuICAgICAgc2t1OiBcIlwiLFxyXG4gICAgICBiYXJjb2RlVHlwZTogXCJjb2RlMTI4XCIsXHJcbiAgICAgIGJhcmNvZGU6IFwiXCIsXHJcbiAgICAgIHN0b2NrTWFuYWdlbWVudDogdHJ1ZSxcclxuICAgICAgcHVyY2hhc2VQcmljZTogMCxcclxuICAgICAgbWFyZ2luOiAzMCxcclxuICAgICAgc2VsbGluZ1ByaWNlOiAwLFxyXG4gICAgICB3aG9sZXNhbGVQcmljZTogMCxcclxuICAgICAgcmVudGFsUHJpY2U6IDAsXHJcbiAgICAgIHNlY3VyaXR5RGVwb3NpdDogMCxcclxuICAgICAgcmVudGFsRHVyYXRpb246IDMsXHJcbiAgICAgIGluaXRpYWxTdG9jazogMCxcclxuICAgICAgYWxlcnRRdHk6IDAsXHJcbiAgICAgIG1heFN0b2NrOiAxMDAwLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgY29uc3Qgc3RvY2tNYW5hZ2VtZW50ID0gd2F0Y2goXCJzdG9ja01hbmFnZW1lbnRcIik7XHJcbiAgY29uc3QgcHVyY2hhc2VQcmljZSA9IHdhdGNoKFwicHVyY2hhc2VQcmljZVwiKTtcclxuICBjb25zdCBtYXJnaW4gPSB3YXRjaChcIm1hcmdpblwiKTtcclxuICBjb25zdCBzZWxlY3RlZFVuaXRJZCA9IHdhdGNoKCd1bml0Jyk7XHJcbiAgY29uc3Qgc2VsZWN0ZWRVbml0QWxsb3dzRGVjaW1hbCA9XHJcbiAgICB1bml0cy5maW5kKCh1KSA9PiB1LmlkID09PSBzZWxlY3RlZFVuaXRJZCk/LmFsbG93X2RlY2ltYWwgPz8gZmFsc2U7XHJcblxyXG4gIGNvbnN0IHBhcnNlVmFyaWF0aW9uUXR5SW5wdXQgPSAocmF3OiBzdHJpbmcpOiBudW1iZXIgPT4ge1xyXG4gICAgaWYgKHNlbGVjdGVkVW5pdEFsbG93c0RlY2ltYWwpIHtcclxuICAgICAgY29uc3QgbiA9IHBhcnNlRmxvYXQocmF3KTtcclxuICAgICAgcmV0dXJuIE51bWJlci5pc0Zpbml0ZShuKSA/IE1hdGgubWF4KDAsIG4pIDogMDtcclxuICAgIH1cclxuICAgIHJldHVybiBNYXRoLm1heCgwLCBwYXJzZUludChyYXcsIDEwKSB8fCAwKTtcclxuICB9O1xyXG5cclxuICAvLyBMb2FkIG9ubHkgcGFyZW50LWxldmVsIGNhdGVnb3JpZXMgKG5vIHN1Yi1jYXRlZ29yaWVzIGluIHRoaXMgZHJvcGRvd24pXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IGxvYWRDYXRlZ29yaWVzID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHNldExvYWRpbmdDYXRlZ29yaWVzKHRydWUpO1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlLmdldENhdGVnb3JpZXMoY29tcGFueUlkKTtcclxuICAgICAgICBzZXRDYXRlZ29yaWVzKGRhdGEubWFwKChjKSA9PiAoeyBpZDogYy5pZCwgbmFtZTogYy5uYW1lIH0pKSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3IgbG9hZGluZyBjYXRlZ29yaWVzOicsIGVycm9yKTtcclxuICAgICAgICBzZXRDYXRlZ29yaWVzKFtdKTtcclxuICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICBzZXRMb2FkaW5nQ2F0ZWdvcmllcyhmYWxzZSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBsb2FkQ2F0ZWdvcmllcygpO1xyXG4gIH0sIFtjb21wYW55SWRdKTtcclxuXHJcbiAgLy8gTG9hZCBicmFuZHMgZnJvbSBkYXRhYmFzZVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBsb2FkQnJhbmRzID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHNldExvYWRpbmdCcmFuZHModHJ1ZSk7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGJyYW5kU2VydmljZS5nZXRBbGwoY29tcGFueUlkKTtcclxuICAgICAgICBzZXRCcmFuZHMoZGF0YS5tYXAoKGIpID0+ICh7IGlkOiBiLmlkLCBuYW1lOiBiLm5hbWUgfSkpKTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBFcnJvciBsb2FkaW5nIGJyYW5kczonLCBlcnJvcik7XHJcbiAgICAgICAgc2V0QnJhbmRzKFtdKTtcclxuICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICBzZXRMb2FkaW5nQnJhbmRzKGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIGxvYWRCcmFuZHMoKTtcclxuICB9LCBbY29tcGFueUlkXSk7XHJcblxyXG4gIC8vIExvYWQgdW5pdHMgZnJvbSBkYXRhYmFzZSAoU2V0dGluZ3Mg4oaSIEludmVudG9yeSDihpIgVW5pdHMpXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IGxvYWRVbml0cyA9IGFzeW5jICgpID0+IHtcclxuICAgICAgaWYgKCFjb21wYW55SWQpIHJldHVybjtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBzZXRMb2FkaW5nVW5pdHModHJ1ZSk7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHVuaXRTZXJ2aWNlLmdldEFsbChjb21wYW55SWQpO1xyXG4gICAgICAgIHNldFVuaXRzKGRhdGEubWFwKCh1KSA9PiAoeyBcclxuICAgICAgICAgIGlkOiB1LmlkLCBcclxuICAgICAgICAgIG5hbWU6IHUubmFtZSwgXHJcbiAgICAgICAgICBzeW1ib2w6IHUuc3ltYm9sLFxyXG4gICAgICAgICAgc2hvcnRfY29kZTogdS5zaG9ydF9jb2RlLFxyXG4gICAgICAgICAgaXNfZGVmYXVsdDogdS5pc19kZWZhdWx0LFxyXG4gICAgICAgICAgYWxsb3dfZGVjaW1hbDogdS5hbGxvd19kZWNpbWFsXHJcbiAgICAgICAgfSkpKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTZXQgZGVmYXVsdCB1bml0IHdoZW4gY3JlYXRpbmcgKG5vdCBlZGl0aW5nKTogdXNlIFNldHRpbmdzIOKGkiBJbnZlbnRvcnkg4oaSIERlZmF1bHQgVW5pdCwgZWxzZSB1bml0IHdpdGggaXNfZGVmYXVsdCwgZWxzZSBmaXJzdFxyXG4gICAgICAgIGlmICghaW5pdGlhbFByb2R1Y3QpIHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnRVbml0ID0gZ2V0VmFsdWVzKCd1bml0Jyk7XHJcbiAgICAgICAgICBpZiAoIWN1cnJlbnRVbml0KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzRGVmYXVsdElkID0gc2V0dGluZ3MuaW52ZW50b3J5U2V0dGluZ3M/LmRlZmF1bHRVbml0SWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRVbml0ID0gKHNldHRpbmdzRGVmYXVsdElkICYmIGRhdGEuZmluZCh1ID0+IHUuaWQgPT09IHNldHRpbmdzRGVmYXVsdElkKSlcclxuICAgICAgICAgICAgICB8fCBkYXRhLmZpbmQodSA9PiB1LmlzX2RlZmF1bHQpXHJcbiAgICAgICAgICAgICAgfHwgZGF0YVswXTtcclxuICAgICAgICAgICAgaWYgKGRlZmF1bHRVbml0KSB7XHJcbiAgICAgICAgICAgICAgc2V0VmFsdWUoJ3VuaXQnLCBkZWZhdWx0VW5pdC5pZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3IgbG9hZGluZyB1bml0czonLCBlcnJvcik7XHJcbiAgICAgICAgc2V0VW5pdHMoW10pO1xyXG4gICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgIHNldExvYWRpbmdVbml0cyhmYWxzZSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBsb2FkVW5pdHMoKTtcclxuICB9LCBbY29tcGFueUlkLCBpbml0aWFsUHJvZHVjdCwgc2V0VmFsdWUsIGdldFZhbHVlcywgc2V0dGluZ3MuaW52ZW50b3J5U2V0dGluZ3M/LmRlZmF1bHRVbml0SWRdKTtcclxuXHJcbiAgLy8gTG9hZCBmdWxsIHZhcmlhdGlvbiBtYXN0ZXIgd2hlbmV2ZXIgY29tcGFueSBpcyBrbm93biAobm90IGdhdGVkIG9uIGVuYWJsZVZhcmlhdGlvbnMg4oCUIGF2b2lkcyBlbXB0eVxyXG4gIC8vIGRhdGFsaXN0cyB1bnRpbCB0b2dnbGU7IGVuc3VyZXMgQ09MT1IvU0laRS9ldGMuIG1hdGNoIFNldHRpbmdzIOKGkiBJbnZlbnRvcnkg4oaSIFZhcmlhdGlvbnMpLlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgLy8gTWVyZ2UgU2V0dGluZ3Mg4oaSIEludmVudG9yeSDihpIgVmFyaWF0aW9ucyBtYXN0ZXIgV0lUSCB0aGUgZ2xvYmFsIGxpYnJhcnlcclxuICAgIC8vIChuZXcgMjAyNjA1MDAgdGFibGVzKSBzbyBuZXdseS1hZGRlZCBhdHRyaWJ1dGVzIGF1dG8tYXBwZWFyIGluIHRoZSBwaWNrZXIuXHJcbiAgICB2b2lkIChhc3luYyAoKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgW2xlZ2FjeSwgbGlicmFyeV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXHJcbiAgICAgICAgICB2YXJpYXRpb25NYXN0ZXJTZXJ2aWNlLmdldChjb21wYW55SWQpLmNhdGNoKCgpID0+ICh7fSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4pKSxcclxuICAgICAgICAgIHZhcmlhdGlvbkxpYnJhcnlTZXJ2aWNlLmxpc3RBdHRyaWJ1dGVzKGNvbXBhbnlJZCkuY2F0Y2goKCkgPT4gW10pLFxyXG4gICAgICAgIF0pO1xyXG4gICAgICAgIGNvbnN0IG1lcmdlZDogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0geyAuLi4obGVnYWN5IHx8IHt9KSB9O1xyXG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBsaWJyYXJ5KSB7XHJcbiAgICAgICAgICBjb25zdCBleGlzdGluZyA9IG5ldyBTZXQoKG1lcmdlZFthdHRyLm5hbWVdIHx8IFtdKS5tYXAoKHYpID0+IHYudG9Mb3dlckNhc2UoKSkpO1xyXG4gICAgICAgICAgY29uc3QgYWRkID0gYXR0ci52YWx1ZXMubWFwKCh2KSA9PiB2LnZhbHVlKS5maWx0ZXIoKHYpID0+ICFleGlzdGluZy5oYXModi50b0xvd2VyQ2FzZSgpKSk7XHJcbiAgICAgICAgICBtZXJnZWRbYXR0ci5uYW1lXSA9IFsuLi4obWVyZ2VkW2F0dHIubmFtZV0gfHwgW10pLCAuLi5hZGRdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzZXRWYXJpYXRpb25NYXN0ZXIobWVyZ2VkKTtcclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgc2V0VmFyaWF0aW9uTWFzdGVyKHt9KTtcclxuICAgICAgfVxyXG4gICAgfSkoKTtcclxuICB9LCBbY29tcGFueUlkXSk7XHJcblxyXG4gIC8vIExvYWQgc3VwcGxpZXJzIGZyb20gY29udGFjdHMgKHR5cGUgPSBzdXBwbGllcilcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3QgbG9hZFN1cHBsaWVycyA9IGFzeW5jICgpID0+IHtcclxuICAgICAgaWYgKCFjb21wYW55SWQpIHJldHVybjtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBzZXRMb2FkaW5nU3VwcGxpZXJzKHRydWUpO1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBjb250YWN0U2VydmljZS5nZXRBbGxDb250YWN0cyhjb21wYW55SWQsICdzdXBwbGllcicpO1xyXG4gICAgICAgIHNldFN1cHBsaWVycygoZGF0YSB8fCBbXSkubWFwKChjOiB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9KSA9PiAoeyBpZDogYy5pZCwgbmFtZTogYy5uYW1lIHx8ICdVbm5hbWVkJyB9KSkpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEVycm9yIGxvYWRpbmcgc3VwcGxpZXJzOicsIGVycm9yKTtcclxuICAgICAgICBzZXRTdXBwbGllcnMoW10pO1xyXG4gICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgIHNldExvYWRpbmdTdXBwbGllcnMoZmFsc2UpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgbG9hZFN1cHBsaWVycygpO1xyXG4gIH0sIFtjb21wYW55SWRdKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmICghY29tcGFueUlkKSByZXR1cm47XHJcbiAgICB2b2lkIGJyYW5jaFNlcnZpY2UuZ2V0QnJhbmNoZXNDYWNoZWQoY29tcGFueUlkKS50aGVuKChicmFuY2hlcykgPT4ge1xyXG4gICAgICBjb25zdCBsaXN0ID0gKGJyYW5jaGVzIHx8IFtdKS5tYXAoKGI6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0pID0+ICh7IGlkOiBiLmlkLCBuYW1lOiBiLm5hbWUgfSkpO1xyXG4gICAgICBzZXRDb21wYW55QnJhbmNoZXMobGlzdCk7XHJcbiAgICAgIGNvbnN0IHByb2R1Y3RJZCA9IGluaXRpYWxQcm9kdWN0Py51dWlkID8/IGluaXRpYWxQcm9kdWN0Py5pZDtcclxuICAgICAgaWYgKGxpc3QubGVuZ3RoID4gMSAmJiAhcHJvZHVjdElkKSB7XHJcbiAgICAgICAgc2V0U2VsZWN0ZWRCcmFuY2hJZHMobGlzdC5tYXAoKGIpID0+IGIuaWQpKTtcclxuICAgICAgfVxyXG4gICAgfSkuY2F0Y2goKCkgPT4gc2V0Q29tcGFueUJyYW5jaGVzKFtdKSk7XHJcbiAgfSwgW2NvbXBhbnlJZCwgaW5pdGlhbFByb2R1Y3Q/LnV1aWQsIGluaXRpYWxQcm9kdWN0Py5pZF0pO1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3QgcHJvZHVjdElkID0gaW5pdGlhbFByb2R1Y3Q/LnV1aWQgPz8gaW5pdGlhbFByb2R1Y3Q/LmlkO1xyXG4gICAgaWYgKCFjb21wYW55SWQgfHwgIXByb2R1Y3RJZCB8fCBjb21wYW55QnJhbmNoZXMubGVuZ3RoIDw9IDEpIHJldHVybjtcclxuICAgIHZvaWQgcHJvZHVjdFNlcnZpY2UuZ2V0UHJvZHVjdEJyYW5jaElkcyhjb21wYW55SWQsIHByb2R1Y3RJZCkudGhlbigoaWRzKSA9PiB7XHJcbiAgICAgIGlmIChpZHMubGVuZ3RoID4gMCkgc2V0U2VsZWN0ZWRCcmFuY2hJZHMoaWRzKTtcclxuICAgICAgZWxzZSBzZXRTZWxlY3RlZEJyYW5jaElkcyhjb21wYW55QnJhbmNoZXMubWFwKChiKSA9PiBiLmlkKSk7XHJcbiAgICB9KS5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgfSwgW2NvbXBhbnlJZCwgaW5pdGlhbFByb2R1Y3Q/LnV1aWQsIGluaXRpYWxQcm9kdWN0Py5pZCwgY29tcGFueUJyYW5jaGVzXSk7XHJcblxyXG4gIC8vIExvYWQgdmFyaWF0aW9ucyBmb3IgXCJjb3B5IGZyb21cIiDigJMgZm9ybWF0OiBTdXBwbGllciDigJQgQXR0cmlidXRlTmFtZTogVmFsdWUgKGUuZy4gdmFyaWFudDogU2l6ZTogTCwgU1VQTElFUjogSWJyYWhpbSlcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFjb21wYW55SWQgfHwgYWN0aXZlVGFiICE9PSAndmFyaWF0aW9ucycgfHwgIWVuYWJsZVZhcmlhdGlvbnMpIHJldHVybjtcclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcclxuICAgIHNldExvYWRpbmdQcm9kdWN0c1dpdGhWYXJpYXRpb25zKHRydWUpO1xyXG4gICAgcHJvZHVjdFNlcnZpY2UuZ2V0QWxsUHJvZHVjdHMoY29tcGFueUlkKVxyXG4gICAgICAudGhlbigoZGF0YTogYW55KSA9PiB7XHJcbiAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuO1xyXG4gICAgICAgIGNvbnN0IHdpdGhWYXJzID0gKGRhdGEgfHwgW10pLmZpbHRlcihcclxuICAgICAgICAgIChwOiBhbnkpID0+IHAuaGFzX3ZhcmlhdGlvbnMgJiYgQXJyYXkuaXNBcnJheShwLnZhcmlhdGlvbnMpICYmIHAudmFyaWF0aW9ucy5sZW5ndGggPiAwXHJcbiAgICAgICAgKTtcclxuICAgICAgICBzZXRQcm9kdWN0c1dpdGhWYXJpYXRpb25zKFxyXG4gICAgICAgICAgd2l0aFZhcnMubWFwKChwOiBhbnkpID0+ICh7XHJcbiAgICAgICAgICAgIGlkOiBwLmlkLFxyXG4gICAgICAgICAgICBuYW1lOiBwLm5hbWUgfHwgJ1VubmFtZWQnLFxyXG4gICAgICAgICAgICBza3U6IHAuc2t1IHx8ICcnLFxyXG4gICAgICAgICAgICB2YXJpYXRpb25zOiBwLnZhcmlhdGlvbnMgfHwgW10sXHJcbiAgICAgICAgICB9KSlcclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGZsYXQ6IEFycmF5PHsgcHJvZHVjdElkOiBzdHJpbmc7IHZhcmlhdGlvbklkOiBzdHJpbmc7IHByb2R1Y3Q6IGFueTsgc3VwcGxpZXJOYW1lOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfT4gPSBbXTtcclxuICAgICAgICBmb3IgKGNvbnN0IHAgb2Ygd2l0aFZhcnMpIHtcclxuICAgICAgICAgIGNvbnN0IHN1cHBsaWVySWQgPSAocCBhcyBhbnkpLnN1cHBsaWVyX2lkIHx8IChwIGFzIGFueSkuc3VwcGxpZXI7XHJcbiAgICAgICAgICBjb25zdCBzdXBwbGllck5hbWUgPSBzdXBwbGllcnMuZmluZCgocykgPT4gcy5pZCA9PT0gc3VwcGxpZXJJZCk/Lm5hbWUgPz8gJ+KAlCc7XHJcbiAgICAgICAgICAocC52YXJpYXRpb25zIHx8IFtdKS5mb3JFYWNoKCh2OiBhbnksIGlkeDogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGF0dHJzID0gdi5hdHRyaWJ1dGVzICYmIHR5cGVvZiB2LmF0dHJpYnV0ZXMgPT09ICdvYmplY3QnID8gdi5hdHRyaWJ1dGVzIDoge307XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2F0dHJOYW1lLCB2YWxdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJzKSkge1xyXG4gICAgICAgICAgICAgIGlmICghYXR0ck5hbWUgfHwgdmFsID09IG51bGwpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gYCR7YXR0ck5hbWV9OiAke3ZhbH1gO1xyXG4gICAgICAgICAgICAgIGZsYXQucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBwcm9kdWN0SWQ6IHAuaWQsXHJcbiAgICAgICAgICAgICAgICB2YXJpYXRpb25JZDogYCR7cC5pZH0tJHtpZHh9LSR7YXR0ck5hbWV9LSR7U3RyaW5nKHZhbCkucmVwbGFjZSgvXFxzL2csICdfJyl9YCxcclxuICAgICAgICAgICAgICAgIHByb2R1Y3Q6IHAsXHJcbiAgICAgICAgICAgICAgICBzdXBwbGllck5hbWUsXHJcbiAgICAgICAgICAgICAgICBsYWJlbCxcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldFZhcmlhdGlvbnNGb3JDb3B5KGZsYXQpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goKCkgPT4ge1xyXG4gICAgICAgIGlmICghY2FuY2VsbGVkKSBzZXRQcm9kdWN0c1dpdGhWYXJpYXRpb25zKFtdKTtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0VmFyaWF0aW9uc0ZvckNvcHkoW10pO1xyXG4gICAgICB9KVxyXG4gICAgICAuZmluYWxseSgoKSA9PiB7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldExvYWRpbmdQcm9kdWN0c1dpdGhWYXJpYXRpb25zKGZhbHNlKTtcclxuICAgICAgfSk7XHJcbiAgICByZXR1cm4gKCkgPT4geyBjYW5jZWxsZWQgPSB0cnVlOyB9O1xyXG4gIH0sIFtjb21wYW55SWQsIGFjdGl2ZVRhYiwgZW5hYmxlVmFyaWF0aW9ucywgc3VwcGxpZXJzXSk7XHJcblxyXG4gIGNvbnN0IHNlbGVjdGVkQ2F0ZWdvcnlJZCA9IHdhdGNoKCdjYXRlZ29yeScpO1xyXG5cclxuICAvLyBMb2FkIHN1Yi1jYXRlZ29yaWVzIG9ubHkgd2hlbiBhIGNhdGVnb3J5IGlzIHNlbGVjdGVkIChmaWx0ZXJlZCBieSBjYXRlZ29yeSlcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFjb21wYW55SWQgfHwgIXNlbGVjdGVkQ2F0ZWdvcnlJZCkge1xyXG4gICAgICBzZXRTdWJDYXRlZ29yaWVzKFtdKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbG9hZFN1YkNhdGVnb3JpZXMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHByb2R1Y3RDYXRlZ29yeVNlcnZpY2UuZ2V0U3ViQ2F0ZWdvcmllcyhjb21wYW55SWQsIHNlbGVjdGVkQ2F0ZWdvcnlJZCk7XHJcbiAgICAgICAgc2V0U3ViQ2F0ZWdvcmllcyhkYXRhLm1hcCgoYykgPT4gKHsgaWQ6IGMuaWQsIG5hbWU6IGMubmFtZSB9KSkpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEVycm9yIGxvYWRpbmcgc3ViLWNhdGVnb3JpZXM6JywgZXJyb3IpO1xyXG4gICAgICAgIHNldFN1YkNhdGVnb3JpZXMoW10pO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgbG9hZFN1YkNhdGVnb3JpZXMoKTtcclxuICB9LCBbY29tcGFueUlkLCBzZWxlY3RlZENhdGVnb3J5SWRdKTtcclxuXHJcbiAgLy8gUFJELTAwMDEgc3R5bGUgZnJvbSBTZXR0aW5ncyDihpIgTnVtYmVyaW5nIChtdXN0IGJlIGRlZmluZWQgYmVmb3JlIGVmZmVjdCB0aGF0IHVzZXMgaXQpXHJcbiAgY29uc3QgZ2VuZXJhdGVTS1UgPSB1c2VDYWxsYmFjaygoKSA9PiB7XHJcbiAgICBjb25zdCBuID0gZ2VuZXJhdGVEb2N1bWVudE51bWJlcigncHJvZHVjdGlvbicpO1xyXG4gICAgcmV0dXJuIChuICYmIFN0cmluZyhuKS50cmltKCkpID8gbiA6ICdQUkQtMDAwMSc7XHJcbiAgfSwgW2dlbmVyYXRlRG9jdW1lbnROdW1iZXJdKTtcclxuXHJcbiAgLy8gQXV0by1nZW5lcmF0ZSB1bmlxdWUgU0tVIGZvciBuZXcgcHJvZHVjdCBvbmx5IChjb2xsaXNpb24tc2FmZSB2aWEgREIgY2hlY2spXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChpbml0aWFsUHJvZHVjdCB8fCAhY29tcGFueUlkKSByZXR1cm47XHJcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XHJcbiAgICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IG5leHRTS1UgPSBhd2FpdCBnZW5lcmF0ZURvY3VtZW50TnVtYmVyU2FmZSgncHJvZHVjdGlvbicpO1xyXG4gICAgICAgIGlmICghY2FuY2VsbGVkICYmIG5leHRTS1UpIHNldFZhbHVlKCdza3UnLCBuZXh0U0tVKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGlmICghY2FuY2VsbGVkKSBzZXRWYWx1ZSgnc2t1JywgZ2VuZXJhdGVTS1UoKSk7XHJcbiAgICAgIH1cclxuICAgIH0pKCk7XHJcbiAgICByZXR1cm4gKCkgPT4geyBjYW5jZWxsZWQgPSB0cnVlOyB9O1xyXG4gIH0sIFtjb21wYW55SWQsIGluaXRpYWxQcm9kdWN0LCBzZXRWYWx1ZSwgZ2VuZXJhdGVEb2N1bWVudE51bWJlclNhZmUsIGdlbmVyYXRlU0tVXSk7XHJcblxyXG4gIC8vIEVkaXQgbW9kZTogZmV0Y2ggZnVsbCBwcm9kdWN0IGJ5IGlkIHNvIHdlIGhhdmUgdmFyaWF0aW9ucywgY2F0ZWdvcnlfaWQsIHVuaXRfaWQsIGJyYW5kX2lkIChsaXN0IHByb2R1Y3Qgb2Z0ZW4gaGFzIG9ubHkgZGlzcGxheSBmaWVsZHMpXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IHByb2R1Y3RJZCA9IGluaXRpYWxQcm9kdWN0Py51dWlkIHx8IGluaXRpYWxQcm9kdWN0Py5pZDtcclxuICAgIGlmICghcHJvZHVjdElkIHx8IHR5cGVvZiBwcm9kdWN0SWQgIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHNldEZ1bGxQcm9kdWN0Rm9yRWRpdChudWxsKTtcclxuICAgICAgc2V0TG9hZGluZ0Z1bGxQcm9kdWN0KGZhbHNlKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlO1xyXG4gICAgc2V0TG9hZGluZ0Z1bGxQcm9kdWN0KHRydWUpO1xyXG4gICAgc2V0RnVsbFByb2R1Y3RGb3JFZGl0KG51bGwpO1xyXG4gICAgcHJvZHVjdFNlcnZpY2UuZ2V0UHJvZHVjdChwcm9kdWN0SWQpXHJcbiAgICAgIC50aGVuKChmdWxsKSA9PiB7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHtcclxuICAgICAgICAgIHNldEZ1bGxQcm9kdWN0Rm9yRWRpdChmdWxsKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEZhaWxlZCB0byBsb2FkIGZ1bGwgcHJvZHVjdCBmb3IgZWRpdDonLCBlcnIpO1xyXG4gICAgICAgICAgc2V0RnVsbFByb2R1Y3RGb3JFZGl0KG51bGwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLmZpbmFsbHkoKCkgPT4ge1xyXG4gICAgICAgIGlmICghY2FuY2VsbGVkKSBzZXRMb2FkaW5nRnVsbFByb2R1Y3QoZmFsc2UpO1xyXG4gICAgICB9KTtcclxuICAgIHJldHVybiAoKSA9PiB7IGNhbmNlbGxlZCA9IHRydWU7IH07XHJcbiAgfSwgW2luaXRpYWxQcm9kdWN0Py51dWlkLCBpbml0aWFsUHJvZHVjdD8uaWRdKTtcclxuXHJcbiAgLy8gU3luYyBlbmFibGVWYXJpYXRpb25zIGZyb20gcHJvZHVjdCAodXNlIGZ1bGwgcHJvZHVjdCB3aGVuIGF2YWlsYWJsZSlcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3Qgc291cmNlID0gZnVsbFByb2R1Y3RGb3JFZGl0ID8/IGluaXRpYWxQcm9kdWN0O1xyXG4gICAgaWYgKHNvdXJjZSkge1xyXG4gICAgICBzZXRFbmFibGVWYXJpYXRpb25zKCEhKHNvdXJjZS5oYXNfdmFyaWF0aW9ucyA/PyAoc291cmNlLnZhcmlhdGlvbnM/Lmxlbmd0aCA+IDApKSk7XHJcbiAgICB9IGVsc2UgaWYgKCFpbml0aWFsUHJvZHVjdCkge1xyXG4gICAgICBzZXRFbmFibGVWYXJpYXRpb25zKGZhbHNlKTtcclxuICAgIH1cclxuICB9LCBbaW5pdGlhbFByb2R1Y3QsIGZ1bGxQcm9kdWN0Rm9yRWRpdF0pO1xyXG5cclxuICAvLyBQcmUtcG9wdWxhdGUgZm9ybSB3aGVuIGVkaXRpbmcg4oCTIHVzZSBmdWxsIHByb2R1Y3QgZnJvbSBBUEkgd2hlbiBhdmFpbGFibGUgc28gYWxsIGZpZWxkcyArIHZhcmlhdGlvbnMgaHlkcmF0ZVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XHJcbiAgICBjb25zdCBzb3VyY2UgPSBmdWxsUHJvZHVjdEZvckVkaXQgPz8gaW5pdGlhbFByb2R1Y3Q7XHJcbiAgICBpZiAoc291cmNlKSB7XHJcbiAgICAgIHNldFZhbHVlKCduYW1lJywgc291cmNlLm5hbWUgfHwgJycpO1xyXG4gICAgICBzZXRWYWx1ZSgnc2t1Jywgc291cmNlLnNrdSB8fCAnJyk7XHJcbiAgICAgIHNldFZhbHVlKCdiYXJjb2RlVHlwZScsIChzb3VyY2UgYXMgYW55KS5iYXJjb2RlX3R5cGUgfHwgJ2NvZGUxMjgnKTtcclxuICAgICAgc2V0VmFsdWUoJ2JhcmNvZGUnLCBzb3VyY2UuYmFyY29kZSB8fCAnJyk7XHJcbiAgICAgIHNldFZhbHVlKCdwdXJjaGFzZVByaWNlJywgc291cmNlLmNvc3RfcHJpY2UgPz8gKHNvdXJjZSBhcyBhbnkpLnB1cmNoYXNlUHJpY2UgPz8gMCk7XHJcbiAgICAgIHNldFZhbHVlKCdzZWxsaW5nUHJpY2UnLCBzb3VyY2UucmV0YWlsX3ByaWNlID8/IChzb3VyY2UgYXMgYW55KS5zZWxsaW5nUHJpY2UgPz8gMCk7XHJcbiAgICAgIHNldFZhbHVlKCd3aG9sZXNhbGVQcmljZScsIHNvdXJjZS53aG9sZXNhbGVfcHJpY2UgPz8gc291cmNlLnJldGFpbF9wcmljZSA/PyAwKTtcclxuICAgICAgc2V0VmFsdWUoJ3JlbnRhbFByaWNlJywgc291cmNlLnJlbnRhbF9wcmljZV9kYWlseSA/PyAwKTtcclxuICAgICAgc2V0VmFsdWUoJ2FsZXJ0UXR5Jywgc291cmNlLm1pbl9zdG9jayA/PyAoc291cmNlIGFzIGFueSkubG93U3RvY2tUaHJlc2hvbGQgPz8gMCk7XHJcbiAgICAgIHNldFZhbHVlKCdtYXhTdG9jaycsIHNvdXJjZS5tYXhfc3RvY2sgPz8gMTAwMCk7XHJcbiAgICAgIHNldFZhbHVlKCdkZXNjcmlwdGlvbicsIHNvdXJjZS5kZXNjcmlwdGlvbiB8fCAnJyk7XHJcbiAgICAgIHNldFZhbHVlKCdicmFuZCcsIHNvdXJjZS5icmFuZF9pZCB8fCAnJyk7XHJcbiAgICAgIHNldFZhbHVlKCd1bml0Jywgc291cmNlLnVuaXRfaWQgfHwgJycpO1xyXG4gICAgICBzZXRWYWx1ZSgnc3VwcGxpZXInLCAoc291cmNlIGFzIGFueSkuc3VwcGxpZXJfaWQgfHwgKHNvdXJjZSBhcyBhbnkpLnN1cHBsaWVyIHx8ICcnKTtcclxuICAgICAgc2V0VmFsdWUoJ3N1cHBsaWVyQ29kZScsIChzb3VyY2UgYXMgYW55KS5zdXBwbGllcl9jb2RlIHx8IChzb3VyY2UgYXMgYW55KS5zdXBwbGllckNvZGUgfHwgJycpO1xyXG4gICAgICBjb25zdCBjYXRJZCA9IHNvdXJjZS5jYXRlZ29yeV9pZCB8fCBzb3VyY2UuY2F0ZWdvcnk/LmlkIHx8ICcnO1xyXG4gICAgICBpZiAoY2F0SWQpIHtcclxuICAgICAgICBwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlLmdldEJ5SWQoY2F0SWQpLnRoZW4oKGNhdCkgPT4ge1xyXG4gICAgICAgICAgaWYgKGNhdC5wYXJlbnRfaWQpIHtcclxuICAgICAgICAgICAgc2V0VmFsdWUoJ2NhdGVnb3J5JywgY2F0LnBhcmVudF9pZCk7XHJcbiAgICAgICAgICAgIHNldFZhbHVlKCdzdWJDYXRlZ29yeScsIGNhdC5pZCk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzZXRWYWx1ZSgnY2F0ZWdvcnknLCBjYXQuaWQpO1xyXG4gICAgICAgICAgICBzZXRWYWx1ZSgnc3ViQ2F0ZWdvcnknLCAnJyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xyXG4gICAgICAgICAgc2V0VmFsdWUoJ2NhdGVnb3J5JywgY2F0SWQpO1xyXG4gICAgICAgICAgc2V0VmFsdWUoJ3N1YkNhdGVnb3J5JywgJycpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNldFZhbHVlKCdjYXRlZ29yeScsICcnKTtcclxuICAgICAgICBzZXRWYWx1ZSgnc3ViQ2F0ZWdvcnknLCAnJyk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHNvdXJjZS52YXJpYXRpb25zICYmIEFycmF5LmlzQXJyYXkoc291cmNlLnZhcmlhdGlvbnMpICYmIHNvdXJjZS52YXJpYXRpb25zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjb25zdCBmaXJzdFBhcnNlZCA9IHB1YmxpY1ZhcmlhdGlvbkF0dHJpYnV0ZXMoXHJcbiAgICAgICAgICBwYXJzZVZhcmlhdGlvbkF0dHJpYnV0ZXNSYXcoc291cmNlLnZhcmlhdGlvbnNbMF0/LmF0dHJpYnV0ZXMpXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBhdHRyTmFtZXMgPSBPYmplY3Qua2V5cyhmaXJzdFBhcnNlZCkuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcclxuICAgICAgICBpZiAoYXR0ck5hbWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIGNvbnN0IHZhbHVlc0J5QXR0cjogUmVjb3JkPHN0cmluZywgU2V0PHN0cmluZz4+ID0ge307XHJcbiAgICAgICAgICBhdHRyTmFtZXMuZm9yRWFjaCgoaykgPT4ge1xyXG4gICAgICAgICAgICB2YWx1ZXNCeUF0dHJba10gPSBuZXcgU2V0KCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHNvdXJjZS52YXJpYXRpb25zLmZvckVhY2goKHY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBhID0gcHVibGljVmFyaWF0aW9uQXR0cmlidXRlcyhwYXJzZVZhcmlhdGlvbkF0dHJpYnV0ZXNSYXcodi5hdHRyaWJ1dGVzKSk7XHJcbiAgICAgICAgICAgIGF0dHJOYW1lcy5mb3JFYWNoKChrKSA9PiB7XHJcbiAgICAgICAgICAgICAgaWYgKGFba10gIT0gbnVsbCAmJiBhW2tdICE9PSAnJykgdmFsdWVzQnlBdHRyW2tdLmFkZChTdHJpbmcoYVtrXSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgc2V0VmFyaWFudEF0dHJpYnV0ZXMoXHJcbiAgICAgICAgICAgIGF0dHJOYW1lcy5tYXAoKG5hbWUpID0+ICh7XHJcbiAgICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgICB2YWx1ZXM6IEFycmF5LmZyb20odmFsdWVzQnlBdHRyW25hbWVdIHx8IFtdKS5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpLFxyXG4gICAgICAgICAgICB9KSlcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHNldFZhcmlhbnRBdHRyaWJ1dGVzKFtdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgbWFwcGVkID0gKHNvdXJjZS52YXJpYXRpb25zIGFzIGFueVtdKS5tYXAoKHYpID0+XHJcbiAgICAgICAgICBtYXBQcm9kdWN0VmFyaWF0aW9uQXBpVG9Gb3JtUm93KHYgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBwaWQgPSAoc291cmNlIGFzIGFueSkudXVpZCB8fCAoc291cmNlIGFzIGFueSkuaWQ7XHJcbiAgICAgICAgKGFzeW5jICgpID0+IHtcclxuICAgICAgICAgIGlmIChjb21wYW55SWQgJiYgcGlkICYmIG1hcHBlZC5zb21lKChtKSA9PiBtLmlkKSkge1xyXG4gICAgICAgICAgICBjb25zdCBicmFuY2hTY29wZSA9IGJyYW5jaElkICYmIGJyYW5jaElkICE9PSAnYWxsJyA/IGJyYW5jaElkIDogbnVsbDtcclxuICAgICAgICAgICAgY29uc3Qgd2l0aE1vdmVtZW50ID0gYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgICAgICAgbWFwcGVkLm1hcChhc3luYyAocm93KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXJvdy5pZCkgcmV0dXJuIHJvdztcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHF0eSA9IGF3YWl0IGludmVudG9yeVNlcnZpY2UuZ2V0U3RvY2soY29tcGFueUlkLCBwaWQgYXMgc3RyaW5nLCByb3cuaWQsIGJyYW5jaFNjb3BlKTtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgLi4ucm93LCBzdG9jazogcXR5IH07XHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHJvdztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyh3aXRoTW92ZW1lbnQpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmICghY2FuY2VsbGVkKSB7XHJcbiAgICAgICAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnMobWFwcGVkKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KSgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnMoW10pO1xyXG4gICAgICAgIHNldFZhcmlhbnRBdHRyaWJ1dGVzKFtdKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCB1cmxzID0gKHNvdXJjZSBhcyBhbnkpPy5pbWFnZV91cmxzO1xyXG4gICAgICBzZXRFeGlzdGluZ0ltYWdlVXJscyhBcnJheS5pc0FycmF5KHVybHMpID8gWy4uLnVybHNdIDogW10pO1xyXG4gICAgICBpZiAoc291cmNlLmlzX2NvbWJvX3Byb2R1Y3QgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHNldElzQ29tYm9Qcm9kdWN0KCEhc291cmNlLmlzX2NvbWJvX3Byb2R1Y3QpO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHByb2R1Y3RJZCA9IHNvdXJjZS51dWlkIHx8IHNvdXJjZS5pZDtcclxuICAgICAgaWYgKHByb2R1Y3RJZCkgbG9hZFByb2R1Y3RDb21ib3MocHJvZHVjdElkKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHNldEV4aXN0aW5nSW1hZ2VVcmxzKFtdKTtcclxuICAgICAgc2V0SXNDb21ib1Byb2R1Y3QoZmFsc2UpO1xyXG4gICAgICBzZXRGdWxsUHJvZHVjdEZvckVkaXQobnVsbCk7XHJcbiAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnMoW10pO1xyXG4gICAgICBzZXRWYXJpYW50QXR0cmlidXRlcyhbXSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xyXG4gICAgfTtcclxuICB9LCBbZnVsbFByb2R1Y3RGb3JFZGl0LCBpbml0aWFsUHJvZHVjdCwgc2V0VmFsdWUsIGNvbXBhbnlJZCwgYnJhbmNoSWRdKTtcclxuXHJcbiAgLyoqIE1vdmVtZW50LWJhc2VkIHN0b2NrIGZvciBlZGl0IChwcm9kdWN0cy5jdXJyZW50X3N0b2NrIGlzIG5vdCBzZWxlY3RlZCBpbiBnZXRQcm9kdWN0KS4gKi9cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3Qgc291cmNlID0gZnVsbFByb2R1Y3RGb3JFZGl0ID8/IGluaXRpYWxQcm9kdWN0O1xyXG4gICAgY29uc3QgcGlkID0gc291cmNlPy51dWlkIHx8IHNvdXJjZT8uaWQ7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCB8fCAhcGlkIHx8IHR5cGVvZiBwaWQgIT09ICdzdHJpbmcnKSByZXR1cm47XHJcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XHJcbiAgICBjb25zdCBoYXNWYXIgPSAhIShzb3VyY2U/Lmhhc192YXJpYXRpb25zID8/IChzb3VyY2U/LnZhcmlhdGlvbnMgJiYgc291cmNlLnZhcmlhdGlvbnMubGVuZ3RoID4gMCkpO1xyXG4gICAgY29uc3QgYnJhbmNoU2NvcGUgPSBicmFuY2hJZCAmJiBicmFuY2hJZCAhPT0gJ2FsbCcgPyBicmFuY2hJZCA6IG51bGw7XHJcbiAgICBpZiAoaGFzVmFyIHx8IChzb3VyY2UgYXMgYW55KT8uaXNfY29tYm9fcHJvZHVjdCkge1xyXG4gICAgICBzZXRWYWx1ZSgnaW5pdGlhbFN0b2NrJywgMCwgeyBzaG91bGRWYWxpZGF0ZTogZmFsc2UsIHNob3VsZERpcnR5OiBmYWxzZSB9KTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgKGFzeW5jICgpID0+IHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBxdHkgPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmdldFN0b2NrKGNvbXBhbnlJZCwgcGlkLCBudWxsLCBicmFuY2hTY29wZSk7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldFZhbHVlKCdpbml0aWFsU3RvY2snLCBNYXRoLnJvdW5kKHF0eSAqIDEwMCkgLyAxMDAsIHsgc2hvdWxkVmFsaWRhdGU6IGZhbHNlLCBzaG91bGREaXJ0eTogZmFsc2UgfSk7XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIGNvbnN0IGZhbGxiYWNrID0gTnVtYmVyKChzb3VyY2UgYXMgYW55KT8uc3RvY2sgPz8gKHNvdXJjZSBhcyBhbnkpPy5jdXJyZW50X3N0b2NrID8/IDApIHx8IDA7XHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldFZhbHVlKCdpbml0aWFsU3RvY2snLCBmYWxsYmFjaywgeyBzaG91bGRWYWxpZGF0ZTogZmFsc2UsIHNob3VsZERpcnR5OiBmYWxzZSB9KTtcclxuICAgICAgfVxyXG4gICAgfSkoKTtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNhbmNlbGxlZCA9IHRydWU7XHJcbiAgICB9O1xyXG4gIH0sIFtmdWxsUHJvZHVjdEZvckVkaXQsIGluaXRpYWxQcm9kdWN0LCBjb21wYW55SWQsIGJyYW5jaElkLCBzZXRWYWx1ZV0pO1xyXG5cclxuICAvLyBMb2FkIGF2YWlsYWJsZSBwcm9kdWN0cyBmb3IgY29tYm8gc2VhcmNoIChleGNsdWRlIGNvbWJvIHByb2R1Y3RzIGFuZCBjdXJyZW50IHByb2R1Y3QpXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChtb2R1bGVzLmNvbWJvc0VuYWJsZWQgJiYgaXNDb21ib1Byb2R1Y3QgJiYgY29tcGFueUlkKSB7XHJcbiAgICAgIGxvYWRBdmFpbGFibGVQcm9kdWN0cygpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc2V0QXZhaWxhYmxlUHJvZHVjdHMoW10pO1xyXG4gICAgfVxyXG4gIH0sIFttb2R1bGVzLmNvbWJvc0VuYWJsZWQsIGlzQ29tYm9Qcm9kdWN0LCBjb21wYW55SWRdKTtcclxuXHJcbiAgLy8gTG9hZCBhdmFpbGFibGUgcHJvZHVjdHMgZm9yIGNvbWJvIChub24tY29tYm8gcHJvZHVjdHMgb25seSlcclxuICBjb25zdCBsb2FkQXZhaWxhYmxlUHJvZHVjdHMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWNvbXBhbnlJZCkgcmV0dXJuO1xyXG4gICAgc2V0TG9hZGluZ1Byb2R1Y3RzKHRydWUpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY3VycmVudFByb2R1Y3RJZCA9IGluaXRpYWxQcm9kdWN0Py51dWlkIHx8IGluaXRpYWxQcm9kdWN0Py5pZDtcclxuICAgICAgY29uc3QgaXNWYWxpZFV1aWQgPSB0eXBlb2YgY3VycmVudFByb2R1Y3RJZCA9PT0gJ3N0cmluZycgJiYgY3VycmVudFByb2R1Y3RJZC5sZW5ndGggPT09IDM2ICYmIC9eWzAtOWEtZi1dezM2fSQvaS50ZXN0KGN1cnJlbnRQcm9kdWN0SWQpO1xyXG4gICAgICBsZXQgcXVlcnkgPSBzdXBhYmFzZVxyXG4gICAgICAgIC5mcm9tKCdwcm9kdWN0cycpXHJcbiAgICAgICAgLnNlbGVjdCgnaWQsIG5hbWUsIHNrdSwgcmV0YWlsX3ByaWNlLCBoYXNfdmFyaWF0aW9ucycpXHJcbiAgICAgICAgLmVxKCdjb21wYW55X2lkJywgY29tcGFueUlkKVxyXG4gICAgICAgIC5lcSgnaXNfYWN0aXZlJywgdHJ1ZSlcclxuICAgICAgICAuZXEoJ2lzX2NvbWJvX3Byb2R1Y3QnLCBmYWxzZSk7IC8vIEV4Y2x1ZGUgY29tYm8gcHJvZHVjdHNcclxuICAgICAgaWYgKGlzVmFsaWRVdWlkKSB7XHJcbiAgICAgICAgcXVlcnkgPSBxdWVyeS5uZXEoJ2lkJywgY3VycmVudFByb2R1Y3RJZCk7IC8vIEV4Y2x1ZGUgY3VycmVudCBwcm9kdWN0IG9ubHkgd2hlbiBpZCBpcyBhIHZhbGlkIFVVSURcclxuICAgICAgfVxyXG4gICAgICBjb25zdCB7IGRhdGEsIGVycm9yIH0gPSBhd2FpdCBxdWVyeS5vcmRlcignbmFtZScpO1xyXG4gICAgICBcclxuICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgc2V0QXZhaWxhYmxlUHJvZHVjdHMoZGF0YSB8fCBbXSk7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEVycm9yIGxvYWRpbmcgcHJvZHVjdHMgZm9yIGNvbWJvOicsIGVycm9yKTtcclxuICAgICAgdG9hc3QuZXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHByb2R1Y3RzJyk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBzZXRMb2FkaW5nUHJvZHVjdHMoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIExvYWQgZXhpc3RpbmcgY29tYm9zIGZvciBwcm9kdWN0XHJcbiAgY29uc3QgbG9hZFByb2R1Y3RDb21ib3MgPSBhc3luYyAocHJvZHVjdElkOiBzdHJpbmcpID0+IHtcclxuICAgIGlmICghY29tcGFueUlkIHx8ICFwcm9kdWN0SWQpIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbWJvID0gYXdhaXQgY29tYm9TZXJ2aWNlLmdldENvbWJvQnlQcm9kdWN0SWQocHJvZHVjdElkLCBjb21wYW55SWQpO1xyXG4gICAgICBpZiAoY29tYm8pIHtcclxuICAgICAgICAvLyBMb2FkIGl0ZW1zIHdpdGggcHJvZHVjdCBkZXRhaWxzXHJcbiAgICAgICAgY29uc3QgaXRlbXNXaXRoRGV0YWlscyA9IGF3YWl0IGNvbWJvU2VydmljZS5nZXRDb21ib0l0ZW1zV2l0aERldGFpbHMoY29tYm8uaWQsIGNvbXBhbnlJZCk7XHJcbiAgICAgICAgc2V0Q29tYm9zKFt7XHJcbiAgICAgICAgICBpZDogY29tYm8uaWQsXHJcbiAgICAgICAgICBjb21ib19uYW1lOiBjb21iby5jb21ib19uYW1lLFxyXG4gICAgICAgICAgY29tYm9fcHJpY2U6IGNvbWJvLmNvbWJvX3ByaWNlLFxyXG4gICAgICAgICAgaXRlbXM6IGl0ZW1zV2l0aERldGFpbHMubWFwKGl0ZW0gPT4gKHtcclxuICAgICAgICAgICAgaWQ6IGl0ZW0uaWQsXHJcbiAgICAgICAgICAgIHByb2R1Y3RfaWQ6IGl0ZW0ucHJvZHVjdF9pZCxcclxuICAgICAgICAgICAgcHJvZHVjdF9uYW1lOiBpdGVtLnByb2R1Y3RfbmFtZSxcclxuICAgICAgICAgICAgcHJvZHVjdF9za3U6IGl0ZW0ucHJvZHVjdF9za3UsXHJcbiAgICAgICAgICAgIHZhcmlhdGlvbl9pZDogaXRlbS52YXJpYXRpb25faWQsXHJcbiAgICAgICAgICAgIHF0eTogaXRlbS5xdHksXHJcbiAgICAgICAgICAgIHVuaXRfcHJpY2U6IGl0ZW0udW5pdF9wcmljZSxcclxuICAgICAgICAgIH0pKSxcclxuICAgICAgICB9XSk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3IgbG9hZGluZyBjb21ib3M6JywgZXJyb3IpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIEF1dG8tY2FsY3VsYXRlIHNlbGxpbmcgcHJpY2Ugd2hlbiBwdXJjaGFzZSBwcmljZSBvciBtYXJnaW4gY2hhbmdlc1xyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBwdXJjaGFzZVByaWNlTnVtID0gdHlwZW9mIHB1cmNoYXNlUHJpY2UgPT09ICdudW1iZXInID8gcHVyY2hhc2VQcmljZSA6IHBhcnNlRmxvYXQoU3RyaW5nKHB1cmNoYXNlUHJpY2UgfHwgMCkpIHx8IDA7XHJcbiAgICBjb25zdCBtYXJnaW5OdW0gPSB0eXBlb2YgbWFyZ2luID09PSAnbnVtYmVyJyA/IG1hcmdpbiA6IHBhcnNlRmxvYXQoU3RyaW5nKG1hcmdpbiB8fCAwKSkgfHwgMDtcclxuICAgIFxyXG4gICAgaWYgKHB1cmNoYXNlUHJpY2VOdW0gPiAwICYmIG1hcmdpbk51bSA+IDApIHtcclxuICAgICAgY29uc3Qgc3AgPSBwdXJjaGFzZVByaWNlTnVtICsgKHB1cmNoYXNlUHJpY2VOdW0gKiBtYXJnaW5OdW0pIC8gMTAwO1xyXG4gICAgICBpZiAodHlwZW9mIHNwID09PSAnbnVtYmVyJyAmJiAhaXNOYU4oc3ApKSB7XHJcbiAgICAgICAgY29uc3Qgc2VsbGluZ1ByaWNlID0gTnVtYmVyKHNwLnRvRml4ZWQoMikpO1xyXG4gICAgICAgIHNldFZhbHVlKFwic2VsbGluZ1ByaWNlXCIsIHNlbGxpbmdQcmljZSwgeyBzaG91bGRWYWxpZGF0ZTogZmFsc2UsIHNob3VsZERpcnR5OiBmYWxzZSB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sIFtwdXJjaGFzZVByaWNlLCBtYXJnaW4sIHNldFZhbHVlXSk7XHJcblxyXG4gIGNvbnN0IG9uRHJvcCA9IHVzZUNhbGxiYWNrKChhY2NlcHRlZEZpbGVzOiBGaWxlW10pID0+IHtcclxuICAgIHNldEltYWdlcygocHJldikgPT4gWy4uLnByZXYsIC4uLmFjY2VwdGVkRmlsZXNdKTtcclxuICB9LCBbXSk7XHJcblxyXG4gIGNvbnN0IHsgZ2V0Um9vdFByb3BzLCBnZXRJbnB1dFByb3BzLCBpc0RyYWdBY3RpdmUgfSA9XHJcbiAgICB1c2VEcm9wem9uZSh7IG9uRHJvcCwgYWNjZXB0OiB7ICdpbWFnZS8qJzogWycucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLndlYnAnLCAnLmdpZiddIH0sIG1heFNpemU6IDUgKiAxMDI0ICogMTAyNCB9KTtcclxuXHJcbiAgY29uc3QgZ2VuZXJhdGVTS1VGb3JGb3JtID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKGluaXRpYWxQcm9kdWN0KSB7XHJcbiAgICAgIHNldFZhbHVlKFwic2t1XCIsIGluaXRpYWxQcm9kdWN0LnNrdSB8fCBnZXRWYWx1ZXMoJ3NrdScpKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbmV4dFNLVSA9IGF3YWl0IGdlbmVyYXRlRG9jdW1lbnROdW1iZXJTYWZlKCdwcm9kdWN0aW9uJyk7XHJcbiAgICBpZiAobmV4dFNLVSkgc2V0VmFsdWUoXCJza3VcIiwgbmV4dFNLVSk7XHJcbiAgICBlbHNlIHNldFZhbHVlKFwic2t1XCIsIGdlbmVyYXRlU0tVKCkpO1xyXG4gIH07XHJcblxyXG4gIC8vIEVuYWJsZSBWYXJpYXRpb25zIHRvZ2dsZTogd2l0aCBzYWZldHkgY2hlY2tzIHdoZW4gZWRpdGluZ1xyXG4gIGNvbnN0IGhhbmRsZUVuYWJsZVZhcmlhdGlvbnNDaGFuZ2UgPSBhc3luYyAoY2hlY2tlZDogYm9vbGVhbikgPT4ge1xyXG4gICAgY29uc3QgcHJvZHVjdElkID0gaW5pdGlhbFByb2R1Y3Q/LnV1aWQgPz8gaW5pdGlhbFByb2R1Y3Q/LmlkO1xyXG4gICAgaWYgKGNoZWNrZWQpIHtcclxuICAgICAgaWYgKHByb2R1Y3RJZCkge1xyXG4gICAgICAgIGNvbnN0IHBhcmVudENvdW50ID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5nZXRQYXJlbnRMZXZlbE1vdmVtZW50Q291bnQocHJvZHVjdElkKTtcclxuICAgICAgICBpZiAocGFyZW50Q291bnQgPiAwKSB7XHJcbiAgICAgICAgICBzZXRCbG9ja1ZhcmlhdGlvbnNNb2RhbE9wZW4odHJ1ZSk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHNldEVuYWJsZVZhcmlhdGlvbnModHJ1ZSk7XHJcbiAgICAgIHNldFZhbHVlKCdpbml0aWFsU3RvY2snLCAwLCB7IHNob3VsZFZhbGlkYXRlOiBmYWxzZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmIChwcm9kdWN0SWQgJiYgKGluaXRpYWxQcm9kdWN0Py5oYXNfdmFyaWF0aW9ucyB8fCBnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aCA+IDApKSB7XHJcbiAgICAgICAgY29uc3QgdmFyaWF0aW9uQ291bnQgPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmdldFZhcmlhdGlvbkxldmVsTW92ZW1lbnRDb3VudChwcm9kdWN0SWQpO1xyXG4gICAgICAgIGlmICh2YXJpYXRpb25Db3VudCA+IDApIHtcclxuICAgICAgICAgIHNldEJsb2NrRGlzYWJsZVZhcmlhdGlvbnNNb2RhbE9wZW4odHJ1ZSk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHNldEVuYWJsZVZhcmlhdGlvbnMoZmFsc2UpO1xyXG4gICAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKFtdKTtcclxuICAgICAgc2V0VmFyaWFudEF0dHJpYnV0ZXMoW10pO1xyXG4gICAgICBpZiAoYWN0aXZlVGFiID09PSAndmFyaWF0aW9ucycpIHNldEFjdGl2ZVRhYignaW52ZW50b3J5Jyk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gRW5hYmxlIENvbWJvIFByb2R1Y3QgdG9nZ2xlOiB3aXRoIHNhZmV0eSBjaGVja3MgKGxpa2UgdmFyaWF0aW9ucylcclxuICBjb25zdCBoYW5kbGVFbmFibGVDb21ib0NoYW5nZSA9IGFzeW5jIChjaGVja2VkOiBib29sZWFuKSA9PiB7XHJcbiAgICBjb25zdCBwcm9kdWN0SWQgPSBpbml0aWFsUHJvZHVjdD8udXVpZCA/PyBpbml0aWFsUHJvZHVjdD8uaWQ7XHJcbiAgICBpZiAoY2hlY2tlZCkge1xyXG4gICAgICAvLyBCTE9DSyAxOiBJZiBwcm9kdWN0IGhhcyBzdG9jayBtb3ZlbWVudHMsIGNhbm5vdCBlbmFibGUgY29tYm9cclxuICAgICAgaWYgKHByb2R1Y3RJZCkge1xyXG4gICAgICAgIGNvbnN0IHBhcmVudENvdW50ID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5nZXRQYXJlbnRMZXZlbE1vdmVtZW50Q291bnQocHJvZHVjdElkKTtcclxuICAgICAgICBpZiAocGFyZW50Q291bnQgPiAwKSB7XHJcbiAgICAgICAgICBzZXRCbG9ja0VuYWJsZUNvbWJvTW9kYWxPcGVuKHRydWUpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBzZXRJc0NvbWJvUHJvZHVjdCh0cnVlKTtcclxuICAgICAgc2V0VmFsdWUoJ2luaXRpYWxTdG9jaycsIDAsIHsgc2hvdWxkVmFsaWRhdGU6IGZhbHNlIH0pO1xyXG4gICAgICBpZiAoIW1vZHVsZXMuY29tYm9zRW5hYmxlZCkge1xyXG4gICAgICAgIHRvYXN0LmVycm9yKCdDb21ibyBtb2R1bGUgaXMgZGlzYWJsZWQuIEVuYWJsZSBpdCBpbiBTZXR0aW5ncyBmaXJzdC4nKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIEJMT0NLIDI6IElmIHByb2R1Y3QgaGFzIGNvbWJvIGl0ZW1zLCBjYW5ub3QgZGlzYWJsZSBjb21ib1xyXG4gICAgICBpZiAocHJvZHVjdElkICYmIGNvbWJvcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgc2V0QmxvY2tEaXNhYmxlQ29tYm9Nb2RhbE9wZW4odHJ1ZSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHNldElzQ29tYm9Qcm9kdWN0KGZhbHNlKTtcclxuICAgICAgc2V0Q29tYm9zKFtdKTtcclxuICAgICAgc2V0Q3VycmVudENvbWJvSXRlbXMoW10pO1xyXG4gICAgICBzZXRDb21ib05hbWUoJycpO1xyXG4gICAgICBzZXRDb21ib0ZpbmFsUHJpY2UoMCk7XHJcbiAgICAgIGlmIChhY3RpdmVUYWIgPT09ICdjb21ib3MnKSBzZXRBY3RpdmVUYWIoJ2ludmVudG9yeScpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIFZhcmlhdGlvbnMgRnVuY3Rpb25zXHJcbiAgY29uc3QgcGVyc2lzdFZhcmlhdGlvbk1hc3Rlck1lcmdlID0gYXN5bmMgKG5leHQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPikgPT4ge1xyXG4gICAgaWYgKCFjb21wYW55SWQpIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHZhcmlhdGlvbk1hc3RlclNlcnZpY2Uuc2F2ZShjb21wYW55SWQsIG5leHQpO1xyXG4gICAgICBzZXRWYXJpYXRpb25NYXN0ZXIobmV4dCk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgLyogbm9uLWJsb2NraW5nICovXHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYWRkVmFyaWFudEF0dHJpYnV0ZSA9ICgpID0+IHtcclxuICAgIGNvbnN0IG5hbWUgPSBuZXdBdHRyaWJ1dGVOYW1lLnRyaW0oKTtcclxuICAgIGlmIChuYW1lICYmICF2YXJpYW50QXR0cmlidXRlcy5zb21lKChhdHRyKSA9PiBhdHRyLm5hbWUgPT09IG5hbWUpKSB7XHJcbiAgICAgIHNldFZhcmlhbnRBdHRyaWJ1dGVzKFsuLi52YXJpYW50QXR0cmlidXRlcywgeyBuYW1lLCB2YWx1ZXM6IFtdIH1dKTtcclxuICAgICAgc2V0TmV3QXR0cmlidXRlTmFtZSgnJyk7XHJcbiAgICAgIGlmIChjb21wYW55SWQpIHtcclxuICAgICAgICBjb25zdCBuZXh0ID0geyAuLi52YXJpYXRpb25NYXN0ZXIgfTtcclxuICAgICAgICBpZiAoIW5leHRbbmFtZV0pIG5leHRbbmFtZV0gPSBbXTtcclxuICAgICAgICB2b2lkIHBlcnNpc3RWYXJpYXRpb25NYXN0ZXJNZXJnZShuZXh0KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGFkZEF0dHJpYnV0ZVZhbHVlID0gKCkgPT4ge1xyXG4gICAgaWYgKHNlbGVjdGVkQXR0cmlidXRlSW5kZXggIT09IG51bGwgJiYgbmV3QXR0cmlidXRlVmFsdWUudHJpbSgpKSB7XHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRBdHRyaWJ1dGVzID0gWy4uLnZhcmlhbnRBdHRyaWJ1dGVzXTtcclxuICAgICAgY29uc3QgdmFsID0gbmV3QXR0cmlidXRlVmFsdWUudHJpbSgpO1xyXG4gICAgICBjb25zdCBhdHRyTmFtZSA9IHVwZGF0ZWRBdHRyaWJ1dGVzW3NlbGVjdGVkQXR0cmlidXRlSW5kZXhdLm5hbWU7XHJcbiAgICAgIGlmICghdXBkYXRlZEF0dHJpYnV0ZXNbc2VsZWN0ZWRBdHRyaWJ1dGVJbmRleF0udmFsdWVzLmluY2x1ZGVzKHZhbCkpIHtcclxuICAgICAgICB1cGRhdGVkQXR0cmlidXRlc1tzZWxlY3RlZEF0dHJpYnV0ZUluZGV4XS52YWx1ZXMucHVzaCh2YWwpO1xyXG4gICAgICAgIHNldFZhcmlhbnRBdHRyaWJ1dGVzKHVwZGF0ZWRBdHRyaWJ1dGVzKTtcclxuICAgICAgICBzZXROZXdBdHRyaWJ1dGVWYWx1ZSgnJyk7XHJcbiAgICAgICAgaWYgKGNvbXBhbnlJZCAmJiBhdHRyTmFtZSkge1xyXG4gICAgICAgICAgY29uc3QgbmV4dCA9IHsgLi4udmFyaWF0aW9uTWFzdGVyIH07XHJcbiAgICAgICAgICBjb25zdCBsaXN0ID0gbmV3IFNldChbLi4uKG5leHRbYXR0ck5hbWVdIHx8IFtdKSwgdmFsXSk7XHJcbiAgICAgICAgICBuZXh0W2F0dHJOYW1lXSA9IEFycmF5LmZyb20obGlzdCkuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcclxuICAgICAgICAgIHZvaWQgcGVyc2lzdFZhcmlhdGlvbk1hc3Rlck1lcmdlKG5leHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJlbW92ZVZhcmlhbnRBdHRyaWJ1dGUgPSAoYXR0ck5hbWU6IHN0cmluZykgPT4ge1xyXG4gICAgc2V0VmFyaWFudEF0dHJpYnV0ZXModmFyaWFudEF0dHJpYnV0ZXMuZmlsdGVyKGEgPT4gYS5uYW1lICE9PSBhdHRyTmFtZSkpO1xyXG4gICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyhbXSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgcmVtb3ZlQXR0cmlidXRlVmFsdWUgPSAoYXR0ckluZGV4OiBudW1iZXIsIHZhbHVlSW5kZXg6IG51bWJlcikgPT4ge1xyXG4gICAgY29uc3QgdXBkYXRlZEF0dHJpYnV0ZXMgPSBbLi4udmFyaWFudEF0dHJpYnV0ZXNdO1xyXG4gICAgdXBkYXRlZEF0dHJpYnV0ZXNbYXR0ckluZGV4XS52YWx1ZXMuc3BsaWNlKHZhbHVlSW5kZXgsIDEpO1xyXG4gICAgc2V0VmFyaWFudEF0dHJpYnV0ZXModXBkYXRlZEF0dHJpYnV0ZXMpO1xyXG4gICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyhbXSk7XHJcbiAgfTtcclxuXHJcbiAgLyoqIENvcHkgYXR0cmlidXRlIHN0cnVjdHVyZSBmcm9tIGFuIGV4aXN0aW5nIHByb2R1Y3QncyB2YXJpYXRpb25zICovXHJcbiAgY29uc3QgY29weUF0dHJpYnV0ZXNGcm9tUHJvZHVjdCA9IChwcm9kdWN0OiB7IHZhcmlhdGlvbnM/OiBBcnJheTx7IGF0dHJpYnV0ZXM/OiB1bmtub3duIH0+IH0pID0+IHtcclxuICAgIGNvbnN0IHZhcnMgPSBwcm9kdWN0LnZhcmlhdGlvbnMgfHwgW107XHJcbiAgICBpZiAodmFycy5sZW5ndGggPT09IDApIHJldHVybjtcclxuICAgIGNvbnN0IGF0dHJNYXA6IFJlY29yZDxzdHJpbmcsIFNldDxzdHJpbmc+PiA9IHt9O1xyXG4gICAgZm9yIChjb25zdCB2IG9mIHZhcnMpIHtcclxuICAgICAgY29uc3QgYXR0cnMgPSBwdWJsaWNWYXJpYXRpb25BdHRyaWJ1dGVzKHBhcnNlVmFyaWF0aW9uQXR0cmlidXRlc1Jhdyh2LmF0dHJpYnV0ZXMpKTtcclxuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJzKSkge1xyXG4gICAgICAgIGlmICgha2V5IHx8IHZhbCA9PSBudWxsIHx8IHZhbCA9PT0gJycpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmICghYXR0ck1hcFtrZXldKSBhdHRyTWFwW2tleV0gPSBuZXcgU2V0KCk7XHJcbiAgICAgICAgYXR0ck1hcFtrZXldLmFkZChTdHJpbmcodmFsKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGNvbnN0IGRlcml2ZWQ6IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZXM6IHN0cmluZ1tdIH0+ID0gT2JqZWN0LmVudHJpZXMoYXR0ck1hcCkubWFwKChbbmFtZSwgc2V0XSkgPT4gKHtcclxuICAgICAgbmFtZSxcclxuICAgICAgdmFsdWVzOiBBcnJheS5mcm9tKHNldCkuc29ydCgpLFxyXG4gICAgfSkpO1xyXG4gICAgaWYgKGRlcml2ZWQubGVuZ3RoID4gMCkge1xyXG4gICAgICBzZXRWYXJpYW50QXR0cmlidXRlcyhkZXJpdmVkKTtcclxuICAgICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyhbXSk7XHJcbiAgICAgIHRvYXN0LnN1Y2Nlc3MoYENvcGllZCAke2Rlcml2ZWQubGVuZ3RofSBhdHRyaWJ1dGUocykgZnJvbSBleGlzdGluZyBwcm9kdWN0YCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLyoqIE1heCB2YXJpYXRpb25zIHBlciBwcm9kdWN0IChmcm9udGVuZCArIGJhY2tlbmQgY29uc2lzdGVuY3k7IGF2b2lkIHJ1bmF3YXkgY29tYmluYXRpb25zKSAqL1xyXG4gIGNvbnN0IE1BWF9WQVJJQVRJT05TID0gMTAwO1xyXG5cclxuICBjb25zdCBjYXJ0ZXNpYW5Qcm9kdWN0ID0gKGFycmF5czogc3RyaW5nW11bXSk6IHN0cmluZ1tdW10gPT4ge1xyXG4gICAgaWYgKGFycmF5cy5sZW5ndGggPT09IDApIHJldHVybiBbW11dO1xyXG4gICAgcmV0dXJuIGFycmF5cy5yZWR1Y2UoKGEsIGIpID0+IGEuZmxhdE1hcChkID0+IGIubWFwKGUgPT4gWy4uLihBcnJheS5pc0FycmF5KGQpID8gZCA6IFtkXSksIGVdKSksIFtbXV0gYXMgc3RyaW5nW11bXSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdmFyaWF0aW9uQ29tYm9LZXkgPSAoY29tYmluYXRpb25PYmo6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pID0+XHJcbiAgICB2YXJpYW50QXR0cmlidXRlcy5tYXAoKGEpID0+IGAke2EubmFtZX09JHtjb21iaW5hdGlvbk9ialthLm5hbWVdID8/ICcnfWApLmpvaW4oJ3wnKTtcclxuXHJcbiAgY29uc3QgZ2VuZXJhdGVWYXJpYXRpb25zID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYXR0cmlidXRlVmFsdWVzID0gdmFyaWFudEF0dHJpYnV0ZXMubWFwKChhdHRyKSA9PiBhdHRyLnZhbHVlcyk7XHJcbiAgICBjb25zdCBjb21iaW5hdGlvbnMgPSBjYXJ0ZXNpYW5Qcm9kdWN0KGF0dHJpYnV0ZVZhbHVlcyk7XHJcbiAgICBpZiAoY29tYmluYXRpb25zLmxlbmd0aCA+IE1BWF9WQVJJQVRJT05TKSB7XHJcbiAgICAgIHRvYXN0LmVycm9yKGBWYXJpYXRpb24gbGltaXQgKCR7TUFYX1ZBUklBVElPTlN9KSBleGNlZWRlZC4gWW91IGhhdmUgJHtjb21iaW5hdGlvbnMubGVuZ3RofSBjb21iaW5hdGlvbnMuIFJlZHVjZSBhdHRyaWJ1dGUgdmFsdWVzIG9yIHVzZSBmZXdlciBhdHRyaWJ1dGVzLmApO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBiYXNlU2t1ID0gKGdldFZhbHVlcygnc2t1JykgfHwgJycpLnRyaW0oKSB8fCBnZW5lcmF0ZVNLVSgpO1xyXG5cclxuICAgIGNvbnN0IGJhc2ljU2VsbGluZ1ByaWNlID0gZ2V0VmFsdWVzKCdzZWxsaW5nUHJpY2UnKSA/PyAwO1xyXG4gICAgY29uc3QgYmFzaWNQdXJjaGFzZVByaWNlID0gZ2V0VmFsdWVzKCdwdXJjaGFzZVByaWNlJykgPz8gMDtcclxuICAgIGNvbnN0IGV4aXN0aW5nQnlDb21ibyA9IG5ldyBNYXAoZ2VuZXJhdGVkVmFyaWF0aW9ucy5tYXAoKGV2KSA9PiBbdmFyaWF0aW9uQ29tYm9LZXkoZXYuY29tYmluYXRpb24pLCBldl0pKTtcclxuXHJcbiAgICBjb25zdCBuZXdWYXJpYXRpb25zID0gY29tYmluYXRpb25zLm1hcCgoY29tYmluYXRpb24sIGluZGV4KSA9PiB7XHJcbiAgICAgIGNvbnN0IGNvbWJpbmF0aW9uT2JqOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XHJcbiAgICAgIHZhcmlhbnRBdHRyaWJ1dGVzLmZvckVhY2goKGF0dHIsIGkpID0+IHtcclxuICAgICAgICBjb21iaW5hdGlvbk9ialthdHRyLm5hbWVdID0gY29tYmluYXRpb25baV07XHJcbiAgICAgIH0pO1xyXG4gICAgICBjb25zdCBwcmV2ID0gZXhpc3RpbmdCeUNvbWJvLmdldCh2YXJpYXRpb25Db21ib0tleShjb21iaW5hdGlvbk9iaikpO1xyXG4gICAgICBpZiAocHJldikge1xyXG4gICAgICAgIHJldHVybiB7IC4uLnByZXYsIGNvbWJpbmF0aW9uOiBjb21iaW5hdGlvbk9iaiB9O1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IHVuZGVmaW5lZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQsXHJcbiAgICAgICAgY29tYmluYXRpb246IGNvbWJpbmF0aW9uT2JqLFxyXG4gICAgICAgIHNrdTogYCR7YmFzZVNrdX0tViR7aW5kZXggKyAxfWAsXHJcbiAgICAgICAgcHJpY2U6IE51bWJlcihiYXNpY1NlbGxpbmdQcmljZSkgfHwgMCxcclxuICAgICAgICBwdXJjaGFzZVByaWNlOiBOdW1iZXIoYmFzaWNQdXJjaGFzZVByaWNlKSB8fCAwLFxyXG4gICAgICAgIHN0b2NrOiAwLFxyXG4gICAgICAgIGJhcmNvZGU6ICcnLFxyXG4gICAgICB9O1xyXG4gICAgfSk7XHJcblxyXG4gICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyhuZXdWYXJpYXRpb25zKTtcclxuICB9O1xyXG5cclxuICAvLyBDb21ib3MgRnVuY3Rpb25zXHJcbiAgLy8gRmlsdGVyIGF2YWlsYWJsZSBwcm9kdWN0cyBiYXNlZCBvbiBzZWFyY2ggcXVlcnlcclxuICBjb25zdCBmaWx0ZXJlZFByb2R1Y3RzID0gYXZhaWxhYmxlUHJvZHVjdHMuZmlsdGVyKHByb2R1Y3QgPT5cclxuICAgIHByb2R1Y3QubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHByb2R1Y3RTZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpKSB8fFxyXG4gICAgcHJvZHVjdC5za3UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhwcm9kdWN0U2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKSlcclxuICApO1xyXG5cclxuICBjb25zdCBzZWxlY3RQcm9kdWN0ID0gKHByb2R1Y3Q6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyByZXRhaWxfcHJpY2U6IG51bWJlcjsgc2t1OiBzdHJpbmc7IGhhc192YXJpYXRpb25zOiBib29sZWFuIH0pID0+IHtcclxuICAgIC8vIENoZWNrIGlmIHByb2R1Y3QgYWxyZWFkeSBpbiBjdXJyZW50IGNvbWJvXHJcbiAgICBpZiAoY3VycmVudENvbWJvSXRlbXMuc29tZShpdGVtID0+IGl0ZW0ucHJvZHVjdF9pZCA9PT0gcHJvZHVjdC5pZCAmJiAhaXRlbS52YXJpYXRpb25faWQpKSB7XHJcbiAgICAgIHRvYXN0LmVycm9yKCdQcm9kdWN0IGFscmVhZHkgYWRkZWQgdG8gY29tYm8nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBJZiBwcm9kdWN0IGhhcyB2YXJpYXRpb25zLCB3ZSBuZWVkIHZhcmlhdGlvbl9pZCAod2lsbCBiZSBoYW5kbGVkIGluIFVJKVxyXG4gICAgLy8gRm9yIG5vdywgYWRkIHdpdGhvdXQgdmFyaWF0aW9uICh1c2VyIGNhbiBlZGl0IGxhdGVyIGlmIG5lZWRlZClcclxuICAgIHNldEN1cnJlbnRDb21ib0l0ZW1zKFsuLi5jdXJyZW50Q29tYm9JdGVtcywge1xyXG4gICAgICBwcm9kdWN0X2lkOiBwcm9kdWN0LmlkLFxyXG4gICAgICBwcm9kdWN0X25hbWU6IHByb2R1Y3QubmFtZSxcclxuICAgICAgcHJvZHVjdF9za3U6IHByb2R1Y3Quc2t1LFxyXG4gICAgICB2YXJpYXRpb25faWQ6IG51bGwsIC8vIFRPRE86IEFkZCB2YXJpYXRpb24gc2VsZWN0aW9uIGlmIGhhc192YXJpYXRpb25zXHJcbiAgICAgIHF0eTogMSxcclxuICAgICAgdW5pdF9wcmljZTogcHJvZHVjdC5yZXRhaWxfcHJpY2UsXHJcbiAgICB9XSk7XHJcbiAgICAgIHNldFByb2R1Y3RTZWFyY2hRdWVyeSgnJyk7XHJcbiAgICAgIHNldFNob3dQcm9kdWN0RHJvcGRvd24oZmFsc2UpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJlbW92ZUNvbWJvSXRlbSA9IChpbmRleDogbnVtYmVyKSA9PiB7XHJcbiAgICBzZXRDdXJyZW50Q29tYm9JdGVtcyhjdXJyZW50Q29tYm9JdGVtcy5maWx0ZXIoKF8sIGkpID0+IGkgIT09IGluZGV4KSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdXBkYXRlQ29tYm9JdGVtUXR5ID0gKGluZGV4OiBudW1iZXIsIHF0eTogbnVtYmVyKSA9PiB7XHJcbiAgICBpZiAocXR5IDw9IDApIHJldHVybjtcclxuICAgIGNvbnN0IHVwZGF0ZWQgPSBbLi4uY3VycmVudENvbWJvSXRlbXNdO1xyXG4gICAgdXBkYXRlZFtpbmRleF0ucXR5ID0gcXR5O1xyXG4gICAgc2V0Q3VycmVudENvbWJvSXRlbXModXBkYXRlZCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdXBkYXRlQ29tYm9JdGVtUHJpY2UgPSAoaW5kZXg6IG51bWJlciwgcHJpY2U6IG51bWJlcikgPT4ge1xyXG4gICAgaWYgKHByaWNlIDwgMCkgcmV0dXJuO1xyXG4gICAgY29uc3QgdXBkYXRlZCA9IFsuLi5jdXJyZW50Q29tYm9JdGVtc107XHJcbiAgICB1cGRhdGVkW2luZGV4XS51bml0X3ByaWNlID0gcHJpY2U7XHJcbiAgICBzZXRDdXJyZW50Q29tYm9JdGVtcyh1cGRhdGVkKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzYXZlQ29tYm8gPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWNvbWJvTmFtZS50cmltKCkgfHwgY29tYm9GaW5hbFByaWNlIDw9IDAgfHwgY3VycmVudENvbWJvSXRlbXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRvYXN0LmVycm9yKCdQbGVhc2UgZmlsbCBhbGwgY29tYm8gZmllbGRzIGFuZCBhZGQgYXQgbGVhc3Qgb25lIHByb2R1Y3QnKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZiAoIWNvbXBhbnlJZCkge1xyXG4gICAgICB0b2FzdC5lcnJvcignQ29tcGFueSBJRCBtaXNzaW5nJyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwcm9kdWN0SWQgPSBpbml0aWFsUHJvZHVjdD8udXVpZCB8fCBpbml0aWFsUHJvZHVjdD8uaWQ7XHJcbiAgICBpZiAoIXByb2R1Y3RJZCkge1xyXG4gICAgICB0b2FzdC5lcnJvcignU2F2ZSB0aGUgcHJvZHVjdCBmaXJzdCAoQmFzaWMgdGFiKSwgdGhlbiB5b3UgY2FuIGFkZCBjb21ib3MgaGVyZS4nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIENyZWF0ZSBvciB1cGRhdGUgY29tYm9cclxuICAgICAgaWYgKGNvbWJvcy5sZW5ndGggPiAwICYmIGNvbWJvc1swXS5pZCkge1xyXG4gICAgICAgIC8vIFVwZGF0ZSBleGlzdGluZyBjb21ib1xyXG4gICAgICAgIGF3YWl0IGNvbWJvU2VydmljZS51cGRhdGVDb21ibyhjb21ib3NbMF0uaWQsIGNvbXBhbnlJZCwge1xyXG4gICAgICAgICAgY29tYm9fbmFtZTogY29tYm9OYW1lLFxyXG4gICAgICAgICAgY29tYm9fcHJpY2U6IGNvbWJvRmluYWxQcmljZSxcclxuICAgICAgICB9KTtcclxuICAgICAgICBhd2FpdCBjb21ib1NlcnZpY2UudXBkYXRlQ29tYm9JdGVtcyhjb21ib3NbMF0uaWQsIGNvbXBhbnlJZCwgY3VycmVudENvbWJvSXRlbXMpO1xyXG4gICAgICAgIHRvYXN0LnN1Y2Nlc3MoJ0NvbWJvIHVwZGF0ZWQhJyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gQ3JlYXRlIG5ldyBjb21ib1xyXG4gICAgICAgIGNvbnN0IG5ld0NvbWJvID0gYXdhaXQgY29tYm9TZXJ2aWNlLmNyZWF0ZUNvbWJvKHtcclxuICAgICAgICAgIGNvbXBhbnlfaWQ6IGNvbXBhbnlJZCxcclxuICAgICAgICAgIGNvbWJvX3Byb2R1Y3RfaWQ6IHByb2R1Y3RJZCxcclxuICAgICAgICAgIGNvbWJvX25hbWU6IGNvbWJvTmFtZSxcclxuICAgICAgICAgIGNvbWJvX3ByaWNlOiBjb21ib0ZpbmFsUHJpY2UsXHJcbiAgICAgICAgICBpdGVtczogY3VycmVudENvbWJvSXRlbXMsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2V0Q29tYm9zKFt7XHJcbiAgICAgICAgICBpZDogbmV3Q29tYm8uaWQsXHJcbiAgICAgICAgICBjb21ib19uYW1lOiBuZXdDb21iby5jb21ib19uYW1lLFxyXG4gICAgICAgICAgY29tYm9fcHJpY2U6IG5ld0NvbWJvLmNvbWJvX3ByaWNlLFxyXG4gICAgICAgICAgaXRlbXM6IG5ld0NvbWJvLml0ZW1zLm1hcChpdGVtID0+ICh7XHJcbiAgICAgICAgICAgIGlkOiBpdGVtLmlkLFxyXG4gICAgICAgICAgICBwcm9kdWN0X2lkOiBpdGVtLnByb2R1Y3RfaWQsXHJcbiAgICAgICAgICAgIHZhcmlhdGlvbl9pZDogaXRlbS52YXJpYXRpb25faWQsXHJcbiAgICAgICAgICAgIHF0eTogaXRlbS5xdHksXHJcbiAgICAgICAgICAgIHVuaXRfcHJpY2U6IGl0ZW0udW5pdF9wcmljZSxcclxuICAgICAgICAgIH0pKSxcclxuICAgICAgICB9XSk7XHJcbiAgICAgICAgdG9hc3Quc3VjY2VzcygnQ29tYm8gc2F2ZWQhJyk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFJlc2V0IGZvcm1cclxuICAgICAgc2V0Q3VycmVudENvbWJvSXRlbXMoW10pO1xyXG4gICAgICBzZXRDb21ib05hbWUoJycpO1xyXG4gICAgICBzZXRDb21ib0ZpbmFsUHJpY2UoMCk7XHJcbiAgICAgIHNldFByb2R1Y3RTZWFyY2hRdWVyeSgnJyk7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEVycm9yIHNhdmluZyBjb21ibzonLCBlcnJvcik7XHJcbiAgICAgIHRvYXN0LmVycm9yKGVycm9yPy5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gc2F2ZSBjb21ibycpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGRlbGV0ZUNvbWJvID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcclxuICAgIGlmICghY29tcGFueUlkKSB7XHJcbiAgICAgIHRvYXN0LmVycm9yKCdDb21wYW55IElEIG1pc3NpbmcnKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBjb21ib1NlcnZpY2UuZGVsZXRlQ29tYm8oaWQsIGNvbXBhbnlJZCk7XHJcbiAgICAgIHNldENvbWJvcyhjb21ib3MuZmlsdGVyKGMgPT4gYy5pZCAhPT0gaWQpKTtcclxuICAgICAgdG9hc3Quc3VjY2VzcygnQ29tYm8gZGVsZXRlZCEnKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3IgZGVsZXRpbmcgY29tYm86JywgZXJyb3IpO1xyXG4gICAgICB0b2FzdC5lcnJvcihlcnJvcj8ubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGRlbGV0ZSBjb21ibycpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IG9uU3VibWl0ID0gYXN5bmMgKFxyXG4gICAgZGF0YTogUHJvZHVjdEZvcm1WYWx1ZXMsXHJcbiAgICBhY3Rpb246IFwic2F2ZVwiIHwgXCJzYXZlQW5kQWRkXCIsXHJcbiAgKSA9PiB7XHJcbiAgICBpZiAoc3VibWl0SW5Qcm9ncmVzc1JlZi5jdXJyZW50KSByZXR1cm47XHJcbiAgICBzdWJtaXRJblByb2dyZXNzUmVmLmN1cnJlbnQgPSB0cnVlO1xyXG4gICAgaWYgKCFjb21wYW55SWQpIHtcclxuICAgICAgdG9hc3QuZXJyb3IoJ0NvbXBhbnkgSUQgbm90IGZvdW5kLiBQbGVhc2UgbG9naW4gYWdhaW4uJyk7XHJcbiAgICAgIHN1Ym1pdEluUHJvZ3Jlc3NSZWYuY3VycmVudCA9IGZhbHNlO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBmaW5hbENvbXBhbnlJZCA9IGNvbXBhbnlJZDtcclxuICAgIFxyXG4gICAgaWYgKCFmaW5hbENvbXBhbnlJZCkge1xyXG4gICAgICB0b2FzdC5lcnJvcignQ29tcGFueSBpbmZvcm1hdGlvbiByZXF1aXJlZC4gUGxlYXNlIGxvZ2luIGFnYWluLicpO1xyXG4gICAgICBzdWJtaXRJblByb2dyZXNzUmVmLmN1cnJlbnQgPSBmYWxzZTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRTYXZpbmcodHJ1ZSk7XHJcbiAgICAgIGNvbnN0IGZpbmFsU0tVID0gZGF0YS5za3UgJiYgZGF0YS5za3UudHJpbSgpICE9PSAnJyA/IGRhdGEuc2t1IDogZ2VuZXJhdGVTS1UoKTtcclxuXHJcbiAgICAgIGNvbnN0IFVVSURfUkVHRVggPSAvXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVswLTlhLWZdezR9LVswLTlhLWZdezR9LVswLTlhLWZdezEyfSQvaTtcclxuICAgICAgY29uc3QgYXNJZCA9ICh2OiB1bmtub3duKTogc3RyaW5nIHwgbnVsbCA9PiB7XHJcbiAgICAgICAgaWYgKHYgPT0gbnVsbCB8fCB2ID09PSAnJykgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2ID09PSAnc3RyaW5nJyAmJiBVVUlEX1JFR0VYLnRlc3QodikpIHJldHVybiB2O1xyXG4gICAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ29iamVjdCcgJiYgdiAhPT0gbnVsbCAmJiAnaWQnIGluIHYgJiYgdHlwZW9mICh2IGFzIGFueSkuaWQgPT09ICdzdHJpbmcnKSByZXR1cm4gKHYgYXMgYW55KS5pZDtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgfTtcclxuICAgICAgY29uc3QgcmF3VW5pdCA9IGdldFZhbHVlcygndW5pdCcpID8/IGRhdGEudW5pdDtcclxuICAgICAgY29uc3QgcmF3Q2F0ZWdvcnkgPSBnZXRWYWx1ZXMoJ2NhdGVnb3J5JykgPz8gZGF0YS5jYXRlZ29yeTtcclxuICAgICAgY29uc3QgcmF3U3ViQ2F0ZWdvcnkgPSBnZXRWYWx1ZXMoJ3N1YkNhdGVnb3J5JykgPz8gZGF0YS5zdWJDYXRlZ29yeTtcclxuICAgICAgY29uc3QgcmF3QnJhbmQgPSBnZXRWYWx1ZXMoJ2JyYW5kJykgPz8gZGF0YS5icmFuZDtcclxuXHJcbiAgICAgIGxldCBjYXRlZ29yeUlkOiBzdHJpbmcgfCBudWxsID0gYXNJZChyYXdTdWJDYXRlZ29yeSkgPz8gYXNJZChyYXdDYXRlZ29yeSkgPz8gbnVsbDtcclxuICAgICAgaWYgKCFjYXRlZ29yeUlkICYmIChyYXdDYXRlZ29yeSB8fCByYXdTdWJDYXRlZ29yeSkpIHtcclxuICAgICAgICBjb25zdCBmb3VuZCA9IGNhdGVnb3JpZXMuZmluZCgoYykgPT4gYy5pZCA9PT0gcmF3Q2F0ZWdvcnkgfHwgYy5pZCA9PT0gcmF3U3ViQ2F0ZWdvcnkpIHx8IHN1YkNhdGVnb3JpZXMuZmluZCgoYykgPT4gYy5pZCA9PT0gcmF3Q2F0ZWdvcnkgfHwgYy5pZCA9PT0gcmF3U3ViQ2F0ZWdvcnkpO1xyXG4gICAgICAgIGlmIChmb3VuZCkgY2F0ZWdvcnlJZCA9IGZvdW5kLmlkO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHVuaXRJZCA9IGFzSWQocmF3VW5pdCk7XHJcbiAgICAgIGNvbnN0IGJyYW5kSWQgPSBhc0lkKHJhd0JyYW5kKTtcclxuXHJcbiAgICAgIGxldCBiYXJjb2RlVmFsdWU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmIChkYXRhLmJhcmNvZGUgJiYgZGF0YS5iYXJjb2RlLnRyaW0oKSAhPT0gJycpIGJhcmNvZGVWYWx1ZSA9IGRhdGEuYmFyY29kZS50cmltKCk7XHJcbiAgICAgIH0gY2F0Y2ggKGJhcmNvZGVFcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignW1BST0RVQ1QgRk9STV0gQmFyY29kZSBlcnJvciAobm9uLWJsb2NraW5nKTonLCBiYXJjb2RlRXJyb3IpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBDb252ZXJ0IHRvIFN1cGFiYXNlIGZvcm1hdCAoZmllbGQgbmFtZXMgbWF0Y2ggc2NoZW1hKVxyXG4gICAgICBjb25zdCBwcm9kdWN0RGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XHJcbiAgICAgICAgY29tcGFueV9pZDogZmluYWxDb21wYW55SWQsXHJcbiAgICAgICAgY2F0ZWdvcnlfaWQ6IGNhdGVnb3J5SWQsXHJcbiAgICAgICAgYnJhbmRfaWQ6IGJyYW5kSWQsXHJcbiAgICAgICAgdW5pdF9pZDogdW5pdElkLFxyXG4gICAgICAgIG5hbWU6IGRhdGEubmFtZSxcclxuICAgICAgICBza3U6IGZpbmFsU0tVLFxyXG4gICAgICAgIGJhcmNvZGU6IGJhcmNvZGVWYWx1ZSxcclxuICAgICAgICBkZXNjcmlwdGlvbjogZGF0YS5kZXNjcmlwdGlvbiB8fCBudWxsLFxyXG4gICAgICAgIGNvc3RfcHJpY2U6IGRhdGEucHVyY2hhc2VQcmljZSA/PyAwLFxyXG4gICAgICAgIHJldGFpbF9wcmljZTogZGF0YS5zZWxsaW5nUHJpY2UsXHJcbiAgICAgICAgd2hvbGVzYWxlX3ByaWNlOiBkYXRhLndob2xlc2FsZVByaWNlID8/IGRhdGEuc2VsbGluZ1ByaWNlID8/IDAsXHJcbiAgICAgICAgcmVudGFsX3ByaWNlX2RhaWx5OiBkYXRhLnJlbnRhbFByaWNlID8/IG51bGwsXHJcbiAgICAgICAgLy8gUlVMRSAxOiBXaGVuIHZhcmlhdGlvbnMgZW5hYmxlZCwgcGFyZW50IGNhbm5vdCBob2xkIHN0b2NrIChvcGVuaW5nIHN0b2NrIHBlciB2YXJpYXRpb24gb25seSlcclxuICAgICAgICAvLyBSVUxFIDI6IFdoZW4gY29tYm8gZW5hYmxlZCwgcHJvZHVjdCBjYW5ub3QgaG9sZCBzdG9jayAodmlydHVhbCBidW5kbGUgLSBzdG9jayBmcm9tIGNvbXBvbmVudHMpXHJcbiAgICAgICAgY3VycmVudF9zdG9jazogKGVuYWJsZVZhcmlhdGlvbnMgfHwgaXNDb21ib1Byb2R1Y3QpID8gMCA6ICgoZGF0YS5pbml0aWFsU3RvY2sgPz8gMCkgPiAwICYmICFpbml0aWFsUHJvZHVjdD8uaWQgPyAwIDogKGRhdGEuaW5pdGlhbFN0b2NrID8/IDApKSxcclxuICAgICAgICBtaW5fc3RvY2s6IGRhdGEuYWxlcnRRdHkgPz8gMCxcclxuICAgICAgICBtYXhfc3RvY2s6IGRhdGEubWF4U3RvY2sgPz8gMTAwMCxcclxuICAgICAgICBoYXNfdmFyaWF0aW9uczogZW5hYmxlVmFyaWF0aW9ucyxcclxuICAgICAgICBpc19jb21ib19wcm9kdWN0OiBpc0NvbWJvUHJvZHVjdCwgLy8gU2F2ZSBjb21ibyBmbGFnXHJcbiAgICAgICAgaXNfcmVudGFibGU6IChkYXRhLnJlbnRhbFByaWNlID8/IDApID4gMCxcclxuICAgICAgICBpc19zZWxsYWJsZTogdHJ1ZSxcclxuICAgICAgICB0cmFja19zdG9jazogZGF0YS5zdG9ja01hbmFnZW1lbnQgIT09IGZhbHNlLFxyXG4gICAgICAgIGlzX2FjdGl2ZTogdHJ1ZSxcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IHByb2R1Y3RJZCA9IGluaXRpYWxQcm9kdWN0Py51dWlkID8/IGluaXRpYWxQcm9kdWN0Py5pZDsgLy8gRWRpdDogVVVJRCBmcm9tIGxpc3Qgb3IgQVBJXHJcbiAgICAgIGNvbnN0IGlzRWRpdCA9ICEhcHJvZHVjdElkO1xyXG5cclxuICAgICAgaWYgKGlzRWRpdCkge1xyXG4gICAgICAgIC8vIFVQREFURTogbWVyZ2UgZXhpc3RpbmcgaW1hZ2VfdXJscyAoaW5jbHVkaW5nIGFueSB1c2VyLXJlbW92ZWQpIHdpdGggbmV3bHkgdXBsb2FkZWQgZmlsZXNcclxuICAgICAgICBsZXQgaW1hZ2VVcmxzOiBzdHJpbmdbXSA9IFsuLi5leGlzdGluZ0ltYWdlVXJsc107XHJcbiAgICAgICAgaWYgKGltYWdlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBuZXdVcmxzID0gYXdhaXQgdXBsb2FkUHJvZHVjdEltYWdlcyhmaW5hbENvbXBhbnlJZCwgcHJvZHVjdElkLCBpbWFnZXMpO1xyXG4gICAgICAgICAgICBpbWFnZVVybHMgPSBbLi4uaW1hZ2VVcmxzLCAuLi5uZXdVcmxzXTtcclxuICAgICAgICAgIH0gY2F0Y2ggKHVwbG9hZEVycjogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEltYWdlIHVwbG9hZCBmYWlsZWQ6JywgdXBsb2FkRXJyKTtcclxuICAgICAgICAgICAgY29uc3QgbXNnID0gdXBsb2FkRXJyPy5tZXNzYWdlIHx8ICdJbWFnZXMgZmFpbGVkIHRvIHVwbG9hZC4nO1xyXG4gICAgICAgICAgICBjb25zdCBpc0J1Y2tldE1pc3NpbmcgPSBTdHJpbmcobXNnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdidWNrZXQgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgIHRvYXN0LmVycm9yKG1zZywgaXNCdWNrZXRNaXNzaW5nID8geyBhY3Rpb246IHsgbGFiZWw6ICdPcGVuIFN0b3JhZ2UnLCBvbkNsaWNrOiAoKSA9PiB3aW5kb3cub3BlbihnZXRTdXBhYmFzZVN0b3JhZ2VEYXNoYm9hcmRVcmwoKSwgJ19ibGFuaycpIH0gfSA6IHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpbWFnZVVybHMubGVuZ3RoID4gMCkgKHByb2R1Y3REYXRhIGFzIGFueSkuaW1hZ2VfdXJscyA9IGltYWdlVXJscztcclxuXHJcbiAgICAgICAgLy8gUlVMRSA1OiBCbG9jayBlbmFibGluZyB2YXJpYXRpb25zIHdoZW4gcHJvZHVjdCBoYXMgcGFyZW50LWxldmVsIHN0b2NrIChzaG93IG1vZGFsKVxyXG4gICAgICAgIGlmIChlbmFibGVWYXJpYXRpb25zKSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJlbnRMZXZlbENvdW50ID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5nZXRQYXJlbnRMZXZlbE1vdmVtZW50Q291bnQocHJvZHVjdElkKTtcclxuICAgICAgICAgIGlmIChwYXJlbnRMZXZlbENvdW50ID4gMCkge1xyXG4gICAgICAgICAgICBzZXRCbG9ja1ZhcmlhdGlvbnNNb2RhbE9wZW4odHJ1ZSk7XHJcbiAgICAgICAgICAgIHNldFNhdmluZyhmYWxzZSk7XHJcbiAgICAgICAgICAgIHN1Ym1pdEluUHJvZ3Jlc3NSZWYuY3VycmVudCA9IGZhbHNlO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBPcGVuaW5nIHN0b2NrOiBtb3ZlbWVudC1iYXNlZCBvbmx5OyBuZXZlciBzZW5kIGN1cnJlbnRfc3RvY2sgKHByb2R1Y3RTZXJ2aWNlIHN0cmlwcyBpdCkuXHJcbiAgICAgICAgY29uc3QgaGFzVmFyaWF0aW9ucyA9IGVuYWJsZVZhcmlhdGlvbnM7XHJcbiAgICAgICAgY29uc3QgaW5pdGlhbFN0b2NrID0gTnVtYmVyKGRhdGEuaW5pdGlhbFN0b2NrKSB8fCAwO1xyXG4gICAgICAgIGNvbnN0IG1vdmVtZW50Q291bnQgPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmdldE1vdmVtZW50Q291bnRGb3JQcm9kdWN0KHByb2R1Y3RJZCk7XHJcbiAgICAgICAgZGVsZXRlIChwcm9kdWN0RGF0YSBhcyBhbnkpLmN1cnJlbnRfc3RvY2s7XHJcbiAgICAgICAgaWYgKGhhc1ZhcmlhdGlvbnMpIChwcm9kdWN0RGF0YSBhcyBhbnkpLmN1cnJlbnRfc3RvY2sgPSAwOyAvLyBSVUxFIDE6IHBhcmVudCBuZXZlciBob2xkcyBzdG9ja1xyXG5cclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcm9kdWN0U2VydmljZS51cGRhdGVQcm9kdWN0KHByb2R1Y3RJZCwgcHJvZHVjdERhdGEpO1xyXG5cclxuICAgICAgICBjb25zdCBicmFuY2hJZE9yTnVsbCA9IGJyYW5jaElkICYmIGJyYW5jaElkICE9PSAnYWxsJyA/IGJyYW5jaElkIDogbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKGVuYWJsZVZhcmlhdGlvbnMgJiYgZ2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGggPiAwICYmIGZpbmFsQ29tcGFueUlkKSB7XHJcbiAgICAgICAgICBjb25zdCBwYXJlbnRDb3N0ID0gTnVtYmVyKGRhdGEucHVyY2hhc2VQcmljZSkgfHwgMDtcclxuICAgICAgICAgIGNvbnN0IHBhcmVudFNlbGwgPSBOdW1iZXIoZGF0YS5zZWxsaW5nUHJpY2UpIHx8IDA7XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiBnZW5lcmF0ZWRWYXJpYXRpb25zKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHB1cmNoTiA9IE51bWJlcihyb3cucHVyY2hhc2VQcmljZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbGxOID0gTnVtYmVyKHJvdy5wcmljZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvc3QgPSBOdW1iZXIuaXNGaW5pdGUocHVyY2hOKSA/IHB1cmNoTiA6IHBhcmVudENvc3Q7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbGxpbmcgPSBOdW1iZXIuaXNGaW5pdGUoc2VsbE4pID8gc2VsbE4gOiBwYXJlbnRTZWxsO1xyXG4gICAgICAgICAgICBpZiAoaW1wb3J0Lm1ldGEuZW52LkRFVikge1xyXG4gICAgICAgICAgICAgIGlmIChyb3cuaWQgJiYgIU51bWJlci5pc0Zpbml0ZShwdXJjaE4pKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXHJcbiAgICAgICAgICAgICAgICAgICdbUFJPRFVDVCBGT1JNXSBWYXJpYXRpb24gdXBkYXRlOiBwdXJjaGFzZVByaWNlIG5vdCBhIGZpbml0ZSBudW1iZXI7IHVzaW5nIHBhcmVudCBjb3N0JyxcclxuICAgICAgICAgICAgICAgICAgcm93LmlkLFxyXG4gICAgICAgICAgICAgICAgICByb3dcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIGlmIChyb3cuaWQgJiYgIU51bWJlci5pc0Zpbml0ZShzZWxsTikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcclxuICAgICAgICAgICAgICAgICAgJ1tQUk9EVUNUIEZPUk1dIFZhcmlhdGlvbiB1cGRhdGU6IHNlbGxpbmcgcHJpY2Ugbm90IGZpbml0ZTsgdXNpbmcgcGFyZW50IHNlbGxpbmcgcHJpY2UnLFxyXG4gICAgICAgICAgICAgICAgICByb3cuaWQsXHJcbiAgICAgICAgICAgICAgICAgIHJvd1xyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IGZvcm1hdFZhcmlhdGlvbk5hbWUocm93LmNvbWJpbmF0aW9uKTtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBpZiAocm93LmlkKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBwcm9kdWN0U2VydmljZS51cGRhdGVWYXJpYXRpb24ocm93LmlkLCB7XHJcbiAgICAgICAgICAgICAgICAgIHNrdTogcm93LnNrdSxcclxuICAgICAgICAgICAgICAgICAgYmFyY29kZTogcm93LmJhcmNvZGUgfHwgbnVsbCxcclxuICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogcm93LmNvbWJpbmF0aW9uLFxyXG4gICAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICBjb3N0X3ByaWNlOiBjb3N0LFxyXG4gICAgICAgICAgICAgICAgICByZXRhaWxfcHJpY2U6IHNlbGxpbmcsXHJcbiAgICAgICAgICAgICAgICAgIHdob2xlc2FsZV9wcmljZTogbnVsbCxcclxuICAgICAgICAgICAgICAgICAgcHJpY2U6IHNlbGxpbmcsXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGFsbG93ViA9IGF3YWl0IGludmVudG9yeVNlcnZpY2UuYWxsb3dzVmFyaWF0aW9uT3BlbmluZ1JlY29uY2lsZUZyb21Qcm9kdWN0Rm9ybShcclxuICAgICAgICAgICAgICAgICAgZmluYWxDb21wYW55SWQsXHJcbiAgICAgICAgICAgICAgICAgIHByb2R1Y3RJZCxcclxuICAgICAgICAgICAgICAgICAgcm93LmlkLFxyXG4gICAgICAgICAgICAgICAgICBicmFuY2hJZE9yTnVsbFxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIGlmIChhbGxvd1YpIHtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgeyBlcnJvcjogdk1vdkVyciB9ID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5yZWNvbmNpbGVWYXJpYXRpb25PcGVuaW5nU3RvY2soXHJcbiAgICAgICAgICAgICAgICAgICAgZmluYWxDb21wYW55SWQsXHJcbiAgICAgICAgICAgICAgICAgICAgYnJhbmNoSWRPck51bGwsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvZHVjdElkLFxyXG4gICAgICAgICAgICAgICAgICAgIHJvdy5pZCxcclxuICAgICAgICAgICAgICAgICAgICBwYXJzZVZhcmlhdGlvblF0eUlucHV0KFN0cmluZyhyb3cuc3RvY2sgPz8gJycpKSxcclxuICAgICAgICAgICAgICAgICAgICBjb3N0XHJcbiAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgIGlmICh2TW92RXJyKSBjb25zb2xlLmVycm9yKCdbUFJPRFVDVCBGT1JNXSBWYXJpYXRpb24gb3BlbmluZyByZWNvbmNpbGUgZmFpbGVkOicsIHZNb3ZFcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBxID0gcGFyc2VWYXJpYXRpb25RdHlJbnB1dChTdHJpbmcocm93LnN0b2NrID8/ICcnKSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJvZHVjdFNlcnZpY2UuY3JlYXRlVmFyaWF0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgcHJvZHVjdF9pZDogcHJvZHVjdElkLFxyXG4gICAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICBza3U6IHJvdy5za3UsXHJcbiAgICAgICAgICAgICAgICAgIGJhcmNvZGU6IHJvdy5iYXJjb2RlIHx8IG51bGwsXHJcbiAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHJvdy5jb21iaW5hdGlvbixcclxuICAgICAgICAgICAgICAgICAgY29zdF9wcmljZTogY29zdCxcclxuICAgICAgICAgICAgICAgICAgcmV0YWlsX3ByaWNlOiBzZWxsaW5nLFxyXG4gICAgICAgICAgICAgICAgICBjdXJyZW50X3N0b2NrOiBxLFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2aWQgPSAoY3JlYXRlZCBhcyB7IGlkPzogc3RyaW5nIH0pPy5pZDtcclxuICAgICAgICAgICAgICAgIGlmIChxID4gMCAmJiB2aWQgJiYgZmluYWxDb21wYW55SWQpIHtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgeyBlcnJvcjogbW92RXJyIH0gPSBhd2FpdCBpbnZlbnRvcnlTZXJ2aWNlLmluc2VydE9wZW5pbmdCYWxhbmNlTW92ZW1lbnQoXHJcbiAgICAgICAgICAgICAgICAgICAgZmluYWxDb21wYW55SWQsXHJcbiAgICAgICAgICAgICAgICAgICAgYnJhbmNoSWRPck51bGwsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvZHVjdElkLFxyXG4gICAgICAgICAgICAgICAgICAgIHEsXHJcbiAgICAgICAgICAgICAgICAgICAgY29zdCxcclxuICAgICAgICAgICAgICAgICAgICB2aWRcclxuICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgaWYgKG1vdkVycikgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gVmFyaWF0aW9uIG9wZW5pbmcgbW92ZW1lbnQgZmFpbGVkOicsIG1vdkVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoICh2ZTogdW5rbm93bikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIFZhcmlhdGlvbiBzYXZlIGZhaWxlZDonLCB2ZSk7XHJcbiAgICAgICAgICAgICAgdG9hc3Qud2FybmluZygnUHJvZHVjdCBzYXZlZCBidXQgb25lIG9yIG1vcmUgdmFyaWF0aW9ucyBmYWlsZWQgdG8gc2F2ZS4gQ2hlY2sgdGhlIFZhcmlhdGlvbnMgdGFiLicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBjYW5SZWNvbmNpbGVPcGVuaW5nID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5hbGxvd3NQYXJlbnRPcGVuaW5nUmVjb25jaWxlRnJvbVByb2R1Y3RGb3JtKFxyXG4gICAgICAgICAgZmluYWxDb21wYW55SWQsXHJcbiAgICAgICAgICBwcm9kdWN0SWQsXHJcbiAgICAgICAgICBicmFuY2hJZE9yTnVsbFxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIC8vIFBhcmVudC1sZXZlbCBvcGVuaW5nOiBvbmx5IHdoZW4gc2FmZSAobm8gc2FsZXMvcHVyY2hhc2VzIGFmdGVyIG9wZW5pbmcg4oCUIGF2b2lkcyBvdmVyd3JpdGluZyBvcGVuaW5nIHdpdGggb24taGFuZCB0b3RhbCkuXHJcbiAgICAgICAgaWYgKCFoYXNWYXJpYXRpb25zICYmIGZpbmFsQ29tcGFueUlkICYmIGNhblJlY29uY2lsZU9wZW5pbmcpIHtcclxuICAgICAgICAgIGNvbnN0IHsgZXJyb3I6IG1vdkVyciB9ID0gYXdhaXQgaW52ZW50b3J5U2VydmljZS5yZWNvbmNpbGVQYXJlbnRMZXZlbE9wZW5pbmdTdG9jayhcclxuICAgICAgICAgICAgZmluYWxDb21wYW55SWQsXHJcbiAgICAgICAgICAgIGJyYW5jaElkT3JOdWxsLFxyXG4gICAgICAgICAgICBwcm9kdWN0SWQsXHJcbiAgICAgICAgICAgIGluaXRpYWxTdG9jayxcclxuICAgICAgICAgICAgTnVtYmVyKGRhdGEucHVyY2hhc2VQcmljZSkgfHwgMCxcclxuICAgICAgICAgICAgbW92ZW1lbnRDb3VudFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIGlmIChtb3ZFcnIpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gT3BlbmluZyBiYWxhbmNlIG1vdmVtZW50IGZhaWxlZDonLCBtb3ZFcnIpO1xyXG4gICAgICAgICAgICB0b2FzdC5lcnJvcignUHJvZHVjdCB1cGRhdGVkIGJ1dCBvcGVuaW5nIHN0b2NrIGNvdWxkIG5vdCBiZSByZWNvcmRlZC4gWW91IGNhbiBhZGQgYW4gYWRqdXN0bWVudCBpbiBJbnZlbnRvcnkuJyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChjb21wYW55QnJhbmNoZXMubGVuZ3RoID4gMSAmJiBwcm9kdWN0SWQpIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHByb2R1Y3RTZXJ2aWNlLnNldFByb2R1Y3RCcmFuY2hBdmFpbGFiaWxpdHkoXHJcbiAgICAgICAgICAgICAgZmluYWxDb21wYW55SWQsXHJcbiAgICAgICAgICAgICAgcHJvZHVjdElkLFxyXG4gICAgICAgICAgICAgIHNlbGVjdGVkQnJhbmNoSWRzLFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgfSBjYXRjaCAoYnJhbmNoRXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignW1BST0RVQ1QgRk9STV0gYnJhbmNoIGF2YWlsYWJpbGl0eSBzYXZlIGZhaWxlZDonLCBicmFuY2hFcnIpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xyXG4gICAgICAgICAgLi4uZGF0YSxcclxuICAgICAgICAgIHNrdTogZmluYWxTS1UsXHJcbiAgICAgICAgICBpZDogcmVzdWx0LmlkLFxyXG4gICAgICAgICAgdXVpZDogcmVzdWx0LmlkLFxyXG4gICAgICAgICAgaXNTZWxsYWJsZTogdHJ1ZSxcclxuICAgICAgICAgIGlzUmVudGFibGU6IChkYXRhLnJlbnRhbFByaWNlIHx8IDApID4gMCxcclxuICAgICAgICAgIHZhcmlhdGlvbnM6IGdlbmVyYXRlZFZhcmlhdGlvbnMsXHJcbiAgICAgICAgICBjb21ib3M6IGNvbWJvcyxcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRvYXN0LnN1Y2Nlc3MoJ1Byb2R1Y3QgdXBkYXRlZCBzdWNjZXNzZnVsbHkhJyk7XHJcbiAgICAgICAgaWYgKGFjdGlvbiA9PT0gXCJzYXZlQW5kQWRkXCIgJiYgb25TYXZlQW5kQWRkKSB7XHJcbiAgICAgICAgICBvblNhdmVBbmRBZGQocGF5bG9hZCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG9uU2F2ZShwYXlsb2FkKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gQ1JFQVRFIG5ldyBwcm9kdWN0IChvcmNoZXN0cmF0ZWQgcGFyZW50ICsgdmFyaWF0aW9ucylcclxuICAgICAgICBjb25zdCBicmFuY2hJZE9yTnVsbCA9IGJyYW5jaElkICYmIGJyYW5jaElkICE9PSAnYWxsJyA/IGJyYW5jaElkIDogbnVsbDtcclxuICAgICAgICBjb25zdCBoYXNWYXJpYXRpb25zID0gZW5hYmxlVmFyaWF0aW9ucztcclxuICAgICAgICBjb25zdCBpbml0aWFsU3RvY2sgPSBOdW1iZXIoZGF0YS5pbml0aWFsU3RvY2spIHx8IDA7XHJcblxyXG4gICAgICAgIGlmIChoYXNWYXJpYXRpb25zICYmIGdlbmVyYXRlZFZhcmlhdGlvbnMubGVuZ3RoID4gTUFYX1ZBUklBVElPTlMpIHtcclxuICAgICAgICAgIHRvYXN0LmVycm9yKGBWYXJpYXRpb24gbGltaXQgKCR7TUFYX1ZBUklBVElPTlN9KSBleGNlZWRlZC4gU2F2ZSB3aXRob3V0IHZhcmlhdGlvbnMgb3IgcmVkdWNlIHRvICR7TUFYX1ZBUklBVElPTlN9IG9yIGZld2VyLmApO1xyXG4gICAgICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcclxuICAgICAgICAgIHN1Ym1pdEluUHJvZ3Jlc3NSZWYuY3VycmVudCA9IGZhbHNlO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcGFyZW50Q29zdCA9IE51bWJlcihkYXRhLnB1cmNoYXNlUHJpY2UpIHx8IDA7XHJcbiAgICAgICAgY29uc3QgcGFyZW50U2VsbCA9IE51bWJlcihkYXRhLnNlbGxpbmdQcmljZSkgfHwgMDtcclxuICAgICAgICBjb25zdCB2YXJpYXRpb25QYXlsb2FkID1cclxuICAgICAgICAgIGhhc1ZhcmlhdGlvbnMgJiYgZ2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgID8gZ2VuZXJhdGVkVmFyaWF0aW9ucy5tYXAoKHZhcmlhdGlvbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcHVyY2hOID0gTnVtYmVyKHZhcmlhdGlvbi5wdXJjaGFzZVByaWNlKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNlbGxOID0gTnVtYmVyKHZhcmlhdGlvbi5wcmljZSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb3N0ID0gTnVtYmVyLmlzRmluaXRlKHB1cmNoTikgPyBwdXJjaE4gOiBwYXJlbnRDb3N0O1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmV0YWlsID0gTnVtYmVyLmlzRmluaXRlKHNlbGxOKSA/IHNlbGxOIDogcGFyZW50U2VsbDtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgIG5hbWU6IGZvcm1hdFZhcmlhdGlvbk5hbWUodmFyaWF0aW9uLmNvbWJpbmF0aW9uKSxcclxuICAgICAgICAgICAgICAgICAgc2t1OiB2YXJpYXRpb24uc2t1LFxyXG4gICAgICAgICAgICAgICAgICBiYXJjb2RlOiB2YXJpYXRpb24uYmFyY29kZSB8fCBudWxsLFxyXG4gICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB2YXJpYXRpb24uY29tYmluYXRpb24sXHJcbiAgICAgICAgICAgICAgICAgIGNvc3RfcHJpY2U6IGNvc3QsXHJcbiAgICAgICAgICAgICAgICAgIHJldGFpbF9wcmljZTogcmV0YWlsLFxyXG4gICAgICAgICAgICAgICAgICBvcGVuaW5nX3N0b2NrOiBwYXJzZVZhcmlhdGlvblF0eUlucHV0KFN0cmluZyh2YXJpYXRpb24uc3RvY2sgPz8gJycpKSxcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgOiBbXTtcclxuXHJcbiAgICAgICAgY29uc3Qgc2F2ZVJlc3VsdCA9IGF3YWl0IHByb2R1Y3RTZXJ2aWNlLnNhdmVQcm9kdWN0V2l0aFZhcmlhdGlvbnMoe1xyXG4gICAgICAgICAgY29tcGFueUlkOiBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgIGJyYW5jaElkT3JOdWxsLFxyXG4gICAgICAgICAgcGFyZW50OiB7XHJcbiAgICAgICAgICAgIC4uLnByb2R1Y3REYXRhLFxyXG4gICAgICAgICAgICBvcGVuaW5nX3N0b2NrOiBoYXNWYXJpYXRpb25zID8gMCA6IGluaXRpYWxTdG9jayxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB2YXJpYXRpb25zOiB2YXJpYXRpb25QYXlsb2FkLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGluY3JlbWVudE5leHROdW1iZXIoJ3Byb2R1Y3Rpb24nKTtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSB7IGlkOiBzYXZlUmVzdWx0LnByb2R1Y3RJZCB9O1xyXG5cclxuICAgICAgICBpZiAoY29tcGFueUJyYW5jaGVzLmxlbmd0aCA+IDEgJiYgcmVzdWx0Py5pZCkge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgcHJvZHVjdFNlcnZpY2Uuc2V0UHJvZHVjdEJyYW5jaEF2YWlsYWJpbGl0eShcclxuICAgICAgICAgICAgICBmaW5hbENvbXBhbnlJZCxcclxuICAgICAgICAgICAgICByZXN1bHQuaWQsXHJcbiAgICAgICAgICAgICAgc2VsZWN0ZWRCcmFuY2hJZHMsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9IGNhdGNoIChicmFuY2hFcnIpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbUFJPRFVDVCBGT1JNXSBicmFuY2ggYXZhaWxhYmlsaXR5IHNhdmUgZmFpbGVkOicsIGJyYW5jaEVycik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBVcGxvYWQgcHJvZHVjdCBpbWFnZXMgYW5kIHNhdmUgVVJMc1xyXG4gICAgICAgIGlmIChpbWFnZXMubGVuZ3RoID4gMCAmJiByZXN1bHQ/LmlkKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBpbWFnZVVybHMgPSBhd2FpdCB1cGxvYWRQcm9kdWN0SW1hZ2VzKGZpbmFsQ29tcGFueUlkLCByZXN1bHQuaWQsIGltYWdlcyk7XHJcbiAgICAgICAgICAgIGF3YWl0IHByb2R1Y3RTZXJ2aWNlLnVwZGF0ZVByb2R1Y3QocmVzdWx0LmlkLCB7IGltYWdlX3VybHM6IGltYWdlVXJscyB9KTtcclxuICAgICAgICAgIH0gY2F0Y2ggKHVwbG9hZEVycjogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQUk9EVUNUIEZPUk1dIEltYWdlIHVwbG9hZCBmYWlsZWQ6JywgdXBsb2FkRXJyKTtcclxuICAgICAgICAgICAgY29uc3QgbXNnID0gdXBsb2FkRXJyPy5tZXNzYWdlIHx8ICdQcm9kdWN0IHNhdmVkIGJ1dCBpbWFnZXMgZmFpbGVkIHRvIHVwbG9hZC4nO1xyXG4gICAgICAgICAgICBjb25zdCBpc0J1Y2tldE1pc3NpbmcgPSBTdHJpbmcobXNnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdidWNrZXQgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgIHRvYXN0LmVycm9yKG1zZywgaXNCdWNrZXRNaXNzaW5nID8geyBhY3Rpb246IHsgbGFiZWw6ICdPcGVuIFN0b3JhZ2UnLCBvbkNsaWNrOiAoKSA9PiB3aW5kb3cub3BlbihnZXRTdXBhYmFzZVN0b3JhZ2VEYXNoYm9hcmRVcmwoKSwgJ19ibGFuaycpIH0gfSA6IHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBwYXlsb2FkID0ge1xyXG4gICAgICAgICAgLi4uZGF0YSxcclxuICAgICAgICAgIHNrdTogZmluYWxTS1UsXHJcbiAgICAgICAgICBpZDogcmVzdWx0LmlkLFxyXG4gICAgICAgICAgaXNTZWxsYWJsZTogdHJ1ZSxcclxuICAgICAgICAgIGlzUmVudGFibGU6IChkYXRhLnJlbnRhbFByaWNlIHx8IDApID4gMCxcclxuICAgICAgICAgIHZhcmlhdGlvbnM6IGdlbmVyYXRlZFZhcmlhdGlvbnMsXHJcbiAgICAgICAgICBjb21ib3M6IGNvbWJvcyxcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoZ2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICB0b2FzdC5zdWNjZXNzKGBQcm9kdWN0IGNyZWF0ZWQgd2l0aCAke2dlbmVyYXRlZFZhcmlhdGlvbnMubGVuZ3RofSB2YXJpYXRpb25zIWApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0b2FzdC5zdWNjZXNzKCdQcm9kdWN0IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5IScpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGFjdGlvbiA9PT0gXCJzYXZlQW5kQWRkXCIgJiYgb25TYXZlQW5kQWRkKSB7XHJcbiAgICAgICAgICBvblNhdmVBbmRBZGQocGF5bG9hZCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG9uU2F2ZShwYXlsb2FkKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc3Qgd2FzRWRpdCA9ICEhKGluaXRpYWxQcm9kdWN0Py51dWlkID8/IGluaXRpYWxQcm9kdWN0Py5pZCk7XHJcbiAgICAgIGNvbnN0IG1zZyA9IGVycm9yPy5tZXNzYWdlIHx8ICdVbmtub3duIGVycm9yJztcclxuICAgICAgY29uc29sZS5lcnJvcignW1BST0RVQ1QgRk9STV0gRXJyb3Igc2F2aW5nIHByb2R1Y3Q6JywgZXJyb3IpO1xyXG4gICAgICBpZiAobXNnLmluY2x1ZGVzKCdTS1UnKSAmJiBtc2cuaW5jbHVkZXMoJ2FscmVhZHknKSAmJiAhd2FzRWRpdCkge1xyXG4gICAgICAgIHRvYXN0LmVycm9yKG1zZywgeyBkdXJhdGlvbjogNjAwMCB9KTtcclxuICAgICAgICBpbmNyZW1lbnROZXh0TnVtYmVyKCdwcm9kdWN0aW9uJyk7IC8vIGZyZWUgdGhlIGR1cGxpY2F0ZSBudW1iZXIgc28gbmV4dCBnZW5lcmF0ZSBpcyB1bmlxdWVcclxuICAgICAgICBzZXRWYWx1ZSgnc2t1JywgZ2VuZXJhdGVTS1UoKSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdG9hc3QuZXJyb3Iod2FzRWRpdCA/ICdGYWlsZWQgdG8gdXBkYXRlIHByb2R1Y3Q6ICcgKyBtc2cgOiAnRmFpbGVkIHRvIGNyZWF0ZSBwcm9kdWN0OiAnICsgbXNnKTtcclxuICAgICAgfVxyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcclxuICAgICAgc3VibWl0SW5Qcm9ncmVzc1JlZi5jdXJyZW50ID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIChcclxuICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBoLWZ1bGwgbWluLWgtMCBiZy1ncmF5LTk1MCB0ZXh0LXdoaXRlIHJlbGF0aXZlXCI+XHJcbiAgICAgIHtsb2FkaW5nRnVsbFByb2R1Y3QgJiYgaW5pdGlhbFByb2R1Y3QgJiYgKFxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgaW5zZXQtMCBiZy1ncmF5LTk1MC84MCB6LTIwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQteGxcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgPFJlZnJlc2hDY3cgc2l6ZT17MzJ9IGNsYXNzTmFtZT1cInRleHQtYmx1ZS00MDAgYW5pbWF0ZS1zcGluXCIgLz5cclxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+TG9hZGluZyBwcm9kdWN0Li4uPC9wPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICl9XHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC02IGJvcmRlci1iIGJvcmRlci1ncmF5LTgwMCBmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXIgYmctZ3JheS05MDAgc3RpY2t5IHRvcC0wIHotMTBcIj5cclxuICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgPGgyIGNsYXNzTmFtZT1cInRleHQteGwgZm9udC1ib2xkXCI+e2luaXRpYWxQcm9kdWN0ID8gJ0VkaXQgUHJvZHVjdCcgOiAnQWRkIE5ldyBQcm9kdWN0J308L2gyPlxyXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+XHJcbiAgICAgICAgICAgIHtpbml0aWFsUHJvZHVjdCA/ICdVcGRhdGUgcHJvZHVjdCBkZXRhaWxzJyA6ICdDb21wbGV0ZSBwcm9kdWN0IGRldGFpbHMgZm9yIGludmVudG9yeSd9XHJcbiAgICAgICAgICA8L3A+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgb25DbGljaz17b25DYW5jZWx9XHJcbiAgICAgICAgICBjbGFzc05hbWU9XCJwLTIgaG92ZXI6YmctZ3JheS04MDAgcm91bmRlZC1mdWxsXCJcclxuICAgICAgICA+XHJcbiAgICAgICAgICA8WCBzaXplPXsyMH0gLz5cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICB7LyogVGFiIE5hdmlnYXRpb24gKi99XHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyLWIgYm9yZGVyLWdyYXktODAwIGJnLWdyYXktOTAwIHN0aWNreSB0b3AtWzg5cHhdIHotMTBcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggcHgtNiBvdmVyZmxvdy14LWF1dG9cIj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QWN0aXZlVGFiKCdiYXNpYycpfVxyXG4gICAgICAgICAgICBjbGFzc05hbWU9e2Nsc3goXHJcbiAgICAgICAgICAgICAgXCJweC02IHB5LTMgdGV4dC1zbSBmb250LW1lZGl1bSBib3JkZXItYi0yIHRyYW5zaXRpb24tY29sb3JzIHdoaXRlc3BhY2Utbm93cmFwXCIsXHJcbiAgICAgICAgICAgICAgYWN0aXZlVGFiID09PSAnYmFzaWMnXHJcbiAgICAgICAgICAgICAgICA/IFwiYm9yZGVyLWJsdWUtNTAwIHRleHQtd2hpdGVcIlxyXG4gICAgICAgICAgICAgICAgOiBcImJvcmRlci10cmFuc3BhcmVudCB0ZXh0LWdyYXktNDAwIGhvdmVyOnRleHQtZ3JheS0zMDBcIlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICBCYXNpYyBJbmZvXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QWN0aXZlVGFiKCdwcmljaW5nJyl9XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICBcInB4LTYgcHktMyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGJvcmRlci1iLTIgdHJhbnNpdGlvbi1jb2xvcnMgd2hpdGVzcGFjZS1ub3dyYXBcIixcclxuICAgICAgICAgICAgICBhY3RpdmVUYWIgPT09ICdwcmljaW5nJ1xyXG4gICAgICAgICAgICAgICAgPyBcImJvcmRlci1ibHVlLTUwMCB0ZXh0LXdoaXRlXCJcclxuICAgICAgICAgICAgICAgIDogXCJib3JkZXItdHJhbnNwYXJlbnQgdGV4dC1ncmF5LTQwMCBob3Zlcjp0ZXh0LWdyYXktMzAwXCJcclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgUHJpY2luZyAmIFRheFxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEFjdGl2ZVRhYignaW52ZW50b3J5Jyl9XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICBcInB4LTYgcHktMyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGJvcmRlci1iLTIgdHJhbnNpdGlvbi1jb2xvcnMgd2hpdGVzcGFjZS1ub3dyYXBcIixcclxuICAgICAgICAgICAgICBhY3RpdmVUYWIgPT09ICdpbnZlbnRvcnknXHJcbiAgICAgICAgICAgICAgICA/IFwiYm9yZGVyLWJsdWUtNTAwIHRleHQtd2hpdGVcIlxyXG4gICAgICAgICAgICAgICAgOiBcImJvcmRlci10cmFuc3BhcmVudCB0ZXh0LWdyYXktNDAwIGhvdmVyOnRleHQtZ3JheS0zMDBcIlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICBJbnZlbnRvcnlcclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRBY3RpdmVUYWIoJ21lZGlhJyl9XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICBcInB4LTYgcHktMyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGJvcmRlci1iLTIgdHJhbnNpdGlvbi1jb2xvcnMgd2hpdGVzcGFjZS1ub3dyYXBcIixcclxuICAgICAgICAgICAgICBhY3RpdmVUYWIgPT09ICdtZWRpYSdcclxuICAgICAgICAgICAgICAgID8gXCJib3JkZXItYmx1ZS01MDAgdGV4dC13aGl0ZVwiXHJcbiAgICAgICAgICAgICAgICA6IFwiYm9yZGVyLXRyYW5zcGFyZW50IHRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC1ncmF5LTMwMFwiXHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIE1lZGlhXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QWN0aXZlVGFiKCdkZXRhaWxzJyl9XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICBcInB4LTYgcHktMyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGJvcmRlci1iLTIgdHJhbnNpdGlvbi1jb2xvcnMgd2hpdGVzcGFjZS1ub3dyYXBcIixcclxuICAgICAgICAgICAgICBhY3RpdmVUYWIgPT09ICdkZXRhaWxzJ1xyXG4gICAgICAgICAgICAgICAgPyBcImJvcmRlci1ibHVlLTUwMCB0ZXh0LXdoaXRlXCJcclxuICAgICAgICAgICAgICAgIDogXCJib3JkZXItdHJhbnNwYXJlbnQgdGV4dC1ncmF5LTQwMCBob3Zlcjp0ZXh0LWdyYXktMzAwXCJcclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgRGV0YWlsc1xyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICB7ZW5hYmxlVmFyaWF0aW9ucyAmJiAoXHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRBY3RpdmVUYWIoJ3ZhcmlhdGlvbnMnKX1cclxuICAgICAgICAgICAgICBjbGFzc05hbWU9e2Nsc3goXHJcbiAgICAgICAgICAgICAgICBcInB4LTYgcHktMyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGJvcmRlci1iLTIgdHJhbnNpdGlvbi1jb2xvcnMgd2hpdGVzcGFjZS1ub3dyYXBcIixcclxuICAgICAgICAgICAgICAgIGFjdGl2ZVRhYiA9PT0gJ3ZhcmlhdGlvbnMnXHJcbiAgICAgICAgICAgICAgICAgID8gXCJib3JkZXItYmx1ZS01MDAgdGV4dC13aGl0ZVwiXHJcbiAgICAgICAgICAgICAgICAgIDogXCJib3JkZXItdHJhbnNwYXJlbnQgdGV4dC1ncmF5LTQwMCBob3Zlcjp0ZXh0LWdyYXktMzAwXCJcclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgVmFyaWF0aW9ucyB7Z2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGggPiAwICYmIGAoJHtnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aH0gLyAke01BWF9WQVJJQVRJT05TfSlgfVxyXG4gICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICl9XHJcbiAgICAgICAgICB7bW9kdWxlcy5jb21ib3NFbmFibGVkICYmIGlzQ29tYm9Qcm9kdWN0ICYmIChcclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QWN0aXZlVGFiKCdjb21ib3MnKX1cclxuICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgIFwicHgtNiBweS0zIHRleHQtc20gZm9udC1tZWRpdW0gYm9yZGVyLWItMiB0cmFuc2l0aW9uLWNvbG9ycyB3aGl0ZXNwYWNlLW5vd3JhcFwiLFxyXG4gICAgICAgICAgICAgIGFjdGl2ZVRhYiA9PT0gJ2NvbWJvcydcclxuICAgICAgICAgICAgICAgID8gXCJib3JkZXItYmx1ZS01MDAgdGV4dC13aGl0ZVwiXHJcbiAgICAgICAgICAgICAgICA6IFwiYm9yZGVyLXRyYW5zcGFyZW50IHRleHQtZ3JheS00MDAgaG92ZXI6dGV4dC1ncmF5LTMwMFwiXHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIENvbWJvcyB7Y29tYm9zLmxlbmd0aCA+IDAgJiYgYCgke2NvbWJvcy5sZW5ndGh9KWB9XHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICl9XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgb3ZlcmZsb3cteS1hdXRvIHAtNiBzcGFjZS15LTZcIj5cclxuICAgICAgICB7LyogVEFCIDEgLSBCQVNJQyBJTkZPICovfVxyXG4gICAgICAgIHthY3RpdmVUYWIgPT09ICdiYXNpYycgJiYgKFxyXG4gICAgICAgICAgPD5cclxuICAgICAgICAgICAgey8qIFNlY3Rpb24gMTogQmFzaWMgSW5mbyAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWJsdWUtNTAwIHBsLTMgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgIDxQYWNrYWdlIHNpemU9ezIwfSAvPlxyXG4gICAgICAgICAgICAgICAgUHJvZHVjdCBJZGVudGl0eVxyXG4gICAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1kOmNvbC1zcGFuLTJcIj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGh0bWxGb3I9XCJuYW1lXCIgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIFByb2R1Y3QgTmFtZSAqXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIGlkPVwibmFtZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwibmFtZVwiKX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cImUuZy4gQ290dG9uIFByZW1pdW0gU2hpcnRcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICB7ZXJyb3JzLm5hbWUgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtcmVkLTUwMCB0ZXh0LXhzIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtlcnJvcnMubmFtZS5tZXNzYWdlfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBodG1sRm9yPVwic2t1XCIgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIFNLVSAvIENvZGUgKlxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJlbGF0aXZlIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgIGlkPVwic2t1XCJcclxuICAgICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcInNrdVwiKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiQVVUTy1HRU5FUkFURURcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgcHItMTBcIlxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtnZW5lcmF0ZVNLVUZvckZvcm19XHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJhYnNvbHV0ZSByaWdodC0yIHRvcC0xLzIgLXRyYW5zbGF0ZS15LTEvMiB0ZXh0LWdyYXktNDAwIGhvdmVyOnRleHQtd2hpdGUgdHJhbnNpdGlvbi1jb2xvcnNcIlxyXG4gICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgIDxSZWZyZXNoQ2N3IHNpemU9ezE2fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAge2Vycm9ycy5za3UgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtcmVkLTUwMCB0ZXh0LXhzIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtlcnJvcnMuc2t1Lm1lc3NhZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBTZWN0aW9uIDI6IENsYXNzaWZpY2F0aW9uICovfVxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgYm9yZGVyLWwtNCBib3JkZXItcHVycGxlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBDbGFzc2lmaWNhdGlvblxyXG4gICAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPkJyYW5kPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAge2xvYWRpbmdCcmFuZHMgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaC05IGl0ZW1zLWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItZ3JheS03MDAgYmctZ3JheS04MDAgcHgtMyB0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5Mb2FkaW5nIGJyYW5kcy4uLjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8U2VhcmNoYWJsZVNlbGVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17d2F0Y2goJ2JyYW5kJykgPz8gJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uVmFsdWVDaGFuZ2U9eyh2KSA9PiBzZXRWYWx1ZSgnYnJhbmQnLCB2KX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucz17YnJhbmRzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlbGVjdCBCcmFuZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaFBsYWNlaG9sZGVyPVwiU2VhcmNoIGJyYW5kLi4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW1wdHlUZXh0PVwiTm8gYnJhbmQgZm91bmQuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgaC05XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlQWRkTmV3XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZE5ld0xhYmVsPVwiQWRkIEJyYW5kXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25BZGROZXc9e2FzeW5jIChzZWFyY2hUZXh0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjb21wYW55SWQpIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChzZWFyY2hUZXh0IHx8ICcnKS50cmltKCkgfHwgJ05ldyBCcmFuZCc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgYnJhbmRTZXJ2aWNlLmNyZWF0ZSh7IGNvbXBhbnlfaWQ6IGNvbXBhbnlJZCwgbmFtZSB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEJyYW5kcygocHJldikgPT4gWy4uLnByZXYsIHsgaWQ6IGNyZWF0ZWQuaWQsIG5hbWU6IGNyZWF0ZWQubmFtZSB9XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZSgnYnJhbmQnLCBjcmVhdGVkLmlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvYXN0LnN1Y2Nlc3MoJ0JyYW5kIGFkZGVkJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9hc3QuZXJyb3IoJ0ZhaWxlZCB0byBhZGQgYnJhbmQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5DYXRlZ29yeTwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIHtsb2FkaW5nQ2F0ZWdvcmllcyA/IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBoLTkgaXRlbXMtY2VudGVyIHJvdW5kZWQtbWQgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCBiZy1ncmF5LTgwMCBweC0zIHRleHQtc20gdGV4dC1ncmF5LTQwMFwiPkxvYWRpbmcgY2F0ZWdvcmllcy4uLjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8U2VhcmNoYWJsZVNlbGVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17d2F0Y2goJ2NhdGVnb3J5JykgPz8gJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uVmFsdWVDaGFuZ2U9eyh2KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoJ2NhdGVnb3J5Jywgdik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoJ3N1YkNhdGVnb3J5JywgJycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zPXtjYXRlZ29yaWVzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlbGVjdCBDYXRlZ29yeVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaFBsYWNlaG9sZGVyPVwiU2VhcmNoIGNhdGVnb3J5Li4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW1wdHlUZXh0PVwiTm8gY2F0ZWdvcnkgZm91bmQuXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgaC05XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlQWRkTmV3XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZE5ld0xhYmVsPVwiQWRkIENhdGVnb3J5XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25BZGROZXc9e2FzeW5jIChzZWFyY2hUZXh0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjb21wYW55SWQpIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChzZWFyY2hUZXh0IHx8ICcnKS50cmltKCkgfHwgJ05ldyBDYXRlZ29yeSc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJvZHVjdENhdGVnb3J5U2VydmljZS5jcmVhdGUoeyBjb21wYW55X2lkOiBjb21wYW55SWQsIG5hbWUsIHBhcmVudF9pZDogbnVsbCB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldENhdGVnb3JpZXMoKHByZXYpID0+IFsuLi5wcmV2LCB7IGlkOiBjcmVhdGVkLmlkLCBuYW1lOiBjcmVhdGVkLm5hbWUgfV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0VmFsdWUoJ2NhdGVnb3J5JywgY3JlYXRlZC5pZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRWYWx1ZSgnc3ViQ2F0ZWdvcnknLCAnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2FzdC5zdWNjZXNzKCdDYXRlZ29yeSBhZGRlZCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvYXN0LmVycm9yKCdGYWlsZWQgdG8gYWRkIGNhdGVnb3J5Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+U3ViLUNhdGVnb3J5PC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgeyFzZWxlY3RlZENhdGVnb3J5SWQgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaC05IGl0ZW1zLWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItZ3JheS03MDAgYmctZ3JheS04MDAgcHgtMyB0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5TZWxlY3QgYSBjYXRlZ29yeSBmaXJzdDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8U2VhcmNoYWJsZVNlbGVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17d2F0Y2goJ3N1YkNhdGVnb3J5JykgPz8gJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uVmFsdWVDaGFuZ2U9eyh2KSA9PiBzZXRWYWx1ZSgnc3ViQ2F0ZWdvcnknLCB2KX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucz17c3ViQ2F0ZWdvcmllc31cclxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWxlY3QgU3ViLUNhdGVnb3J5XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VhcmNoUGxhY2Vob2xkZXI9XCJTZWFyY2ggc3ViLWNhdGVnb3J5Li4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZW1wdHlUZXh0PVwiTm8gc3ViLWNhdGVnb3J5IGZvdW5kLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIGgtOVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZUFkZE5ld1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGROZXdMYWJlbD1cIkFkZCBTdWItQ2F0ZWdvcnlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkFkZE5ldz17YXN5bmMgKHNlYXJjaFRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbXBhbnlJZCB8fCAhc2VsZWN0ZWRDYXRlZ29yeUlkKSByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSAoc2VhcmNoVGV4dCB8fCAnJykudHJpbSgpIHx8ICdOZXcgU3ViLUNhdGVnb3J5JztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcm9kdWN0Q2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZSh7IGNvbXBhbnlfaWQ6IGNvbXBhbnlJZCwgbmFtZSwgcGFyZW50X2lkOiBzZWxlY3RlZENhdGVnb3J5SWQgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTdWJDYXRlZ29yaWVzKChwcmV2KSA9PiBbLi4ucHJldiwgeyBpZDogY3JlYXRlZC5pZCwgbmFtZTogY3JlYXRlZC5uYW1lIH1dKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFZhbHVlKCdzdWJDYXRlZ29yeScsIGNyZWF0ZWQuaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9hc3Quc3VjY2VzcygnU3ViLWNhdGVnb3J5IGFkZGVkJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9hc3QuZXJyb3IoJ0ZhaWxlZCB0byBhZGQgc3ViLWNhdGVnb3J5Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+VW5pdDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIHtsb2FkaW5nVW5pdHMgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaC05IGl0ZW1zLWNlbnRlciByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItZ3JheS03MDAgYmctZ3JheS04MDAgcHgtMyB0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5Mb2FkaW5nIHVuaXRzLi4uPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxTZWFyY2hhYmxlU2VsZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXt3YXRjaCgndW5pdCcpID8/ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvblZhbHVlQ2hhbmdlPXsodikgPT4gc2V0VmFsdWUoJ3VuaXQnLCB2KX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucz17dW5pdHMubWFwKCh1KSA9PiAoeyBpZDogdS5pZCwgbmFtZTogYCR7dS5uYW1lfSAoJHt1LnNob3J0X2NvZGUgfHwgdS5zeW1ib2wgfHwgJ+KAlCd9KWAgfSkpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlbGVjdCBVbml0XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VhcmNoUGxhY2Vob2xkZXI9XCJTZWFyY2ggdW5pdC4uLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtcHR5VGV4dD1cIk5vIHVuaXQgZm91bmQuIEFkZCB1bml0cyBpbiBTZXR0aW5ncyDihpIgSW52ZW50b3J5IOKGkiBVbml0cy5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBoLTlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBTZWN0aW9uIDM6IEJhc2ljIFByaWNpbmcgKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1ncmVlbi01MDAgcGwtMyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgPERvbGxhclNpZ24gc2l6ZT17MjB9IC8+XHJcbiAgICAgICAgICAgICAgICBRdWljayBQcmljaW5nXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgUHVyY2hhc2UgUHJpY2VcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwicHVyY2hhc2VQcmljZVwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICBDb3N0IHByaWNlIGZyb20gc3VwcGxpZXJcclxuICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBTZWxsaW5nIFByaWNlICpcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwic2VsbGluZ1ByaWNlXCIsIHsgc2V0VmFsdWVBczogc2V0VmFsdWVBc051bWJlciB9KX1cclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjAuMDBcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICAgICAgICAgIFwiYmctZ3JlZW4tOTAwLzMwIGJvcmRlci1ncmVlbi03MDAgdGV4dC13aGl0ZSBtdC0xIGZvbnQtYm9sZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnNlbGxpbmdQcmljZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImJvcmRlci1yZWQtNTAwIHJpbmctMSByaW5nLXJlZC01MDBcIixcclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICB7ZXJyb3JzLnNlbGxpbmdQcmljZSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNTAwIHRleHQteHMgbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAge2Vycm9ycy5zZWxsaW5nUHJpY2UubWVzc2FnZX1cclxuICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgRmluYWwgcHJpY2UgZm9yIGN1c3RvbWVyc1xyXG4gICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWJsdWUtOTAwLzEwIGJvcmRlciBib3JkZXItYmx1ZS05MDAvMzAgcC0zIHJvdW5kZWQtbWQgdGV4dC14cyB0ZXh0LWJsdWUtMzAwXCI+XHJcbiAgICAgICAgICAgICAgICDwn5KhIDxzdHJvbmc+VGlwOjwvc3Ryb25nPiBGb3IgYWR2YW5jZWQgcHJpY2luZyBvcHRpb25zICh3aG9sZXNhbGUsIGJ1bGssIHJldGFpbCksIGdvIHRvIHRoZSBcIlByaWNpbmcgJiBUYXhcIiB0YWIuXHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIDwvPlxyXG4gICAgICAgICl9XHJcblxyXG4gICAgICAgIHsvKiBUQUIgMiAtIFBSSUNJTkcgJiBUQVggKi99XHJcbiAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ3ByaWNpbmcnICYmIChcclxuICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1ncmVlbi01MDAgcGwtMyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgPERvbGxhclNpZ24gc2l6ZT17MjB9IC8+XHJcbiAgICAgICAgICAgICAgICBCYXNpYyBQcmljaW5nXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0zIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIFB1cmNoYXNlIFByaWNlXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcInB1cmNoYXNlUHJpY2VcIiwgeyBzZXRWYWx1ZUFzOiBzZXRWYWx1ZUFzTnVtYmVyIH0pfVxyXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMC4wMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+Q29zdCBmcm9tIHN1cHBsaWVyPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBQcm9maXQgTWFyZ2luICglKVxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJtYXJnaW5cIiwgeyBzZXRWYWx1ZUFzOiBzZXRWYWx1ZUFzTnVtYmVyIH0pfVxyXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+QXV0by1jYWxjdWxhdGUgc2VsbGluZyBwcmljZTwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgU2VsbGluZyBQcmljZSAqXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcInNlbGxpbmdQcmljZVwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2Nsc3goXHJcbiAgICAgICAgICAgICAgICAgICAgICBcImJnLWdyZWVuLTkwMC8zMCBib3JkZXItZ3JlZW4tNzAwIHRleHQtd2hpdGUgbXQtMSBmb250LWJvbGRcIixcclxuICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5zZWxsaW5nUHJpY2UgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJib3JkZXItcmVkLTUwMCByaW5nLTEgcmluZy1yZWQtNTAwXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAge2Vycm9ycy5zZWxsaW5nUHJpY2UgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtcmVkLTUwMCB0ZXh0LXhzIG10LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtlcnJvcnMuc2VsbGluZ1ByaWNlLm1lc3NhZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgbXQtMVwiPlJldGFpbCBwcmljZTwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1ibHVlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBBZHZhbmNlZCBQcmljaW5nIFRpZXJzXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIFdob2xlc2FsZSBQcmljZVxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJ3aG9sZXNhbGVQcmljZVwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5QcmljZSBmb3Igd2hvbGVzYWxlIGN1c3RvbWVyczwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgUmV0YWlsIFByaWNlXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMC4wMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+UHJpY2UgZm9yIHJldGFpbCBjdXN0b21lcnM8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIEJ1bGsgUHJpY2UgKDEwKyBpdGVtcylcclxuICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5TcGVjaWFsIHByaWNlIGZvciBidWxrIG9yZGVyczwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgTWluaW11bSBPcmRlciBRdWFudGl0eVxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjFcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgbXQtMVwiPk1pbmltdW0gcXVhbnRpdHkgdG8gb3JkZXI8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1wdXJwbGUtOTAwLzEwIGJvcmRlciBib3JkZXItcHVycGxlLTgwMCBwLTQgcm91bmRlZC1sZ1wiPlxyXG4gICAgICAgICAgICAgICAgPGg0IGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LXB1cnBsZS0zMDAgbWItMlwiPvCfkrAgUHJpY2luZyBTdW1tYXJ5PC9oND5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMiBtZDpncmlkLWNvbHMtNCBnYXAtMyB0ZXh0LXhzXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMFwiPlB1cmNoYXNlOjwvcD5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlIGZvbnQtYm9sZFwiPuKCqHt3YXRjaCgncHVyY2hhc2VQcmljZScpIHx8IDB9PC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwXCI+U2VsbGluZzo8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmVlbi00MDAgZm9udC1ib2xkXCI+4oKoe3dhdGNoKCdzZWxsaW5nUHJpY2UnKSB8fCAwfTwvcD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMFwiPk1hcmdpbjo8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ibHVlLTQwMCBmb250LWJvbGRcIj57d2F0Y2goJ21hcmdpbicpIHx8IDB9JTwvcD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMFwiPlByb2ZpdDo8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC15ZWxsb3ctNDAwIGZvbnQtYm9sZFwiPuKCqHsoKHdhdGNoKCdzZWxsaW5nUHJpY2UnKSB8fCAwKSAtICh3YXRjaCgncHVyY2hhc2VQcmljZScpIHx8IDApKS50b0ZpeGVkKDIpfTwvcD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgYm9yZGVyLWwtNCBib3JkZXItcHVycGxlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBUYXggQ29uZmlndXJhdGlvblxyXG4gICAgICAgICAgICAgIDwvaDM+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5UYXggVHlwZTwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxDb250cm9sbGVyXHJcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbD17Y29udHJvbH1cclxuICAgICAgICAgICAgICAgICAgICBuYW1lPVwidGF4VHlwZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyPXsoeyBmaWVsZCB9KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uVmFsdWVDaGFuZ2U9e2ZpZWxkLm9uQ2hhbmdlfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0VmFsdWU9e2ZpZWxkLnZhbHVlfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0VHJpZ2dlciBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdFZhbHVlIHBsYWNlaG9sZGVyPVwiU2VsZWN0IFRheCBUeXBlXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3RUcmlnZ2VyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0Q29udGVudCBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS04MDAgdGV4dC13aGl0ZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RJdGVtIHZhbHVlPVwiZXhjbHVzaXZlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBFeGNsdXNpdmUgKFRheCBBZGRlZClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L1NlbGVjdEl0ZW0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdEl0ZW0gdmFsdWU9XCJpbmNsdXNpdmVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEluY2x1c2l2ZSAoVGF4IEluY2x1ZGVkKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvU2VsZWN0SXRlbT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8U2VsZWN0SXRlbSB2YWx1ZT1cImV4ZW1wdFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgVGF4IEV4ZW1wdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvU2VsZWN0SXRlbT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3RDb250ZW50PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3Q+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1ibHVlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBSZW50YWwgUHJpY2luZyAoT3B0aW9uYWwpXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ibHVlLTkwMC8xMCBib3JkZXIgYm9yZGVyLWJsdWUtOTAwLzMwIHAtMyByb3VuZGVkLW1kIHRleHQteHMgdGV4dC1ibHVlLTMwMCBtYi00XCI+XHJcbiAgICAgICAgICAgICAgICBMZWF2ZSB0aGVzZSBmaWVsZHMgZW1wdHkgdG8gZGVjaWRlIHRoZSByZW50YWwgcHJpY2UgYXQgdGhlIHRpbWUgb2YgYm9va2luZy5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIERlZmF1bHQgUmVudCBQcmljZVxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJyZW50YWxQcmljZVwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwLjAwXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgU2VjdXJpdHkgRGVwb3NpdFxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJzZWN1cml0eURlcG9zaXRcIiwgeyBzZXRWYWx1ZUFzOiBzZXRWYWx1ZUFzTnVtYmVyIH0pfVxyXG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMC4wMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8Lz5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7LyogVEFCIDMgLSBJTlZFTlRPUlkgKi99XHJcbiAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ2ludmVudG9yeScgJiYgKFxyXG4gICAgICAgICAgPD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICB7Y29tcGFueUJyYW5jaGVzLmxlbmd0aCA+IDEgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwLTMgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHNwYWNlLXktMlwiPlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMCBmb250LW1lZGl1bVwiPkF2YWlsYWJsZSBpbiBicmFuY2hlczwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMFwiPlNlbGVjdCB3aGljaCBicmFuY2hlcyBjYW4gc2VsbCB0aGlzIHByb2R1Y3QuPC9wPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgIHtjb21wYW55QnJhbmNoZXMubWFwKChiKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGVja2VkID0gc2VsZWN0ZWRCcmFuY2hJZHMuaW5jbHVkZXMoYi5pZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwga2V5PXtiLmlkfSBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXNtIHRleHQtZ3JheS0yMDAgY3Vyc29yLXBvaW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJjaGVja2JveFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja2VkPXtjaGVja2VkfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eygpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRCcmFuY2hJZHMoKHByZXYpID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZCA/IHByZXYuZmlsdGVyKChpZCkgPT4gaWQgIT09IGIuaWQpIDogWy4uLnByZXYsIGIuaWRdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQgYm9yZGVyLWdyYXktNjAwXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtiLm5hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICAgIHsvKiBFbmFibGUgVmFyaWF0aW9ucyB0b2dnbGUgKG9wdC1pbiwgZGVmYXVsdCBPRkYgZm9yIG5ldyBwcm9kdWN0KSAqL31cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBwLTMgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgaHRtbEZvcj1cImVuYWJsZS12YXJpYXRpb25zXCIgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMCBmb250LW1lZGl1bVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIEVuYWJsZSBWYXJpYXRpb25zXHJcbiAgICAgICAgICAgICAgICAgIDwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0wLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICBFbmFibGUgc2l6ZS9jb2xvciB2YXJpYXRpb25zLiBTdG9jayB3aWxsIGJlIHRyYWNrZWQgcGVyIHZhcmlhdGlvbi5cclxuICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8U3dpdGNoXHJcbiAgICAgICAgICAgICAgICAgIGlkPVwiZW5hYmxlLXZhcmlhdGlvbnNcIlxyXG4gICAgICAgICAgICAgICAgICBjaGVja2VkPXtlbmFibGVWYXJpYXRpb25zfVxyXG4gICAgICAgICAgICAgICAgICBvbkNoZWNrZWRDaGFuZ2U9e2hhbmRsZUVuYWJsZVZhcmlhdGlvbnNDaGFuZ2V9XHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICB7ZW5hYmxlVmFyaWF0aW9ucyAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtMyBiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGdcIj5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+UGFyZW50IHByb2R1Y3QgZG9lcyBub3QgaG9sZCBzdG9jayB3aGVuIHZhcmlhdGlvbnMgYXJlIGVuYWJsZWQuPC9wPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgey8qIEVuYWJsZSBDb21ibyBQcm9kdWN0IHRvZ2dsZSAob25seSBpZiBtb2R1bGUgZW5hYmxlZCkgKi99XHJcbiAgICAgICAgICAgICAge21vZHVsZXMuY29tYm9zRW5hYmxlZCAmJiAoXHJcbiAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBwLTMgYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxMYWJlbCBodG1sRm9yPVwiZW5hYmxlLWNvbWJvXCIgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMCBmb250LW1lZGl1bVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBFbmFibGUgQ29tYm8gUHJvZHVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0wLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgTWFrZSB0aGlzIHByb2R1Y3QgYSBjb21iby9idW5kbGUuIFN0b2NrIHdpbGwgYmUgbWFuYWdlZCB0aHJvdWdoIGNvbXBvbmVudCBwcm9kdWN0cy5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8U3dpdGNoXHJcbiAgICAgICAgICAgICAgICAgICAgICBpZD1cImVuYWJsZS1jb21ib1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjaGVja2VkPXtpc0NvbWJvUHJvZHVjdH1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hlY2tlZENoYW5nZT17aGFuZGxlRW5hYmxlQ29tYm9DaGFuZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICB7aXNDb21ib1Byb2R1Y3QgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC0zIGJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZ1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+Q29tYm8gcHJvZHVjdHMgZG8gbm90IGhvbGQgc3RvY2suIFN0b2NrIGlzIG1hbmFnZWQgdGhyb3VnaCBjb21wb25lbnQgcHJvZHVjdHMuPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cclxuICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgYm9yZGVyLWwtNCBib3JkZXIteWVsbG93LTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICAgIFN0b2NrIE1hbmFnZW1lbnRcclxuICAgICAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbFxyXG4gICAgICAgICAgICAgICAgICAgIGh0bWxGb3I9XCJzdG9jay1tZ210XCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIEVuYWJsZSBUcmFja2luZ1xyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8Q29udHJvbGxlclxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2w9e2NvbnRyb2x9XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZT1cInN0b2NrTWFuYWdlbWVudFwiXHJcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyPXsoeyBmaWVsZCB9KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8U3dpdGNoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e2ZpZWxkLnZhbHVlfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoZWNrZWRDaGFuZ2U9e2ZpZWxkLm9uQ2hhbmdlfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZD1cInN0b2NrLW1nbXRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIHtzdG9ja01hbmFnZW1lbnQgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPExhYmVsXHJcbiAgICAgICAgICAgICAgICAgICAgICBodG1sRm9yPVwiaW5pdGlhbC1zdG9ja1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCJcclxuICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICBJbml0aWFsIFN0b2NrXHJcbiAgICAgICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgIGlkPVwiaW5pdGlhbC1zdG9ja1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgIHN0ZXA9e3NlbGVjdGVkVW5pdEFsbG93c0RlY2ltYWwgPyAnYW55JyA6IDF9XHJcbiAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17ZW5hYmxlVmFyaWF0aW9ucyB8fCBpc0NvbWJvUHJvZHVjdH1cclxuICAgICAgICAgICAgICAgICAgICAgIHsuLi5yZWdpc3RlcihcImluaXRpYWxTdG9ja1wiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFwibXQtMVwiLCAoZW5hYmxlVmFyaWF0aW9ucyB8fCBpc0NvbWJvUHJvZHVjdCkgPyBcImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LWdyYXktNTAwIGN1cnNvci1ub3QtYWxsb3dlZFwiIDogXCJiZy1ncmF5LTgwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZVwiKX1cclxuICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgIHtlbmFibGVWYXJpYXRpb25zICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+T3BlbmluZyBzdG9jayBpcyBkZWZpbmVkIHBlciB2YXJpYXRpb24uPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAge2lzQ29tYm9Qcm9kdWN0ICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+Q29tYm8gcHJvZHVjdHMgZG8gbm90IGhvbGQgc3RvY2suIFN0b2NrIGlzIG1hbmFnZWQgdGhyb3VnaCBjb21wb25lbnQgcHJvZHVjdHMuPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8TGFiZWxcclxuICAgICAgICAgICAgICAgICAgICAgIGh0bWxGb3I9XCJhbGVydC1xdHlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgQWxlcnQgUXVhbnRpdHlcclxuICAgICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgaWQ9XCJhbGVydC1xdHlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJhbGVydFF0eVwiLCB7IHNldFZhbHVlQXM6IHNldFZhbHVlQXNOdW1iZXIgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLXJlZC05MDAvNTAgdGV4dC13aGl0ZSBtdC0xXCJcclxuICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICBHZXQgbm90aWZpZWQgd2hlbiBzdG9jayBmYWxscyBiZWxvdyB0aGlzIGxldmVsXHJcbiAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPExhYmVsIGh0bWxGb3I9XCJtYXgtc3RvY2tcIiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+TWF4IFN0b2NrPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgIGlkPVwibWF4LXN0b2NrXCJcclxuICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwibWF4U3RvY2tcIiwgeyBzZXRWYWx1ZUFzOiBzZXRWYWx1ZUFzTnVtYmVyIH0pfVxyXG4gICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIxMDAwXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwIG10LTFcIj5NYXhpbXVtIHN0b2NrIGNhcGFjaXR5PC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICAgIHshc3RvY2tNYW5hZ2VtZW50ICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNiB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwXCI+U3RvY2sgdHJhY2tpbmcgaXMgZGlzYWJsZWQgZm9yIHRoaXMgcHJvZHVjdDwvcD5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNTAwIG10LTFcIj5FbmFibGUgdHJhY2tpbmcgYWJvdmUgdG8gbWFuYWdlIGludmVudG9yeSBsZXZlbHM8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvPlxyXG4gICAgICAgICl9XHJcblxyXG4gICAgICAgIHsvKiBUQUIgNCAtIE1FRElBICovfVxyXG4gICAgICAgIHthY3RpdmVUYWIgPT09ICdtZWRpYScgJiYgKFxyXG4gICAgICAgICAgPD5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLXBpbmstNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgIFByb2R1Y3QgSW1hZ2VzXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgey4uLmdldFJvb3RQcm9wcygpfVxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgICAgICBcImJvcmRlci0yIGJvcmRlci1kYXNoZWQgcm91bmRlZC14bCBwLTggZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgY3Vyc29yLXBvaW50ZXIgdHJhbnNpdGlvbi1jb2xvcnNcIixcclxuICAgICAgICAgICAgICAgICAgaXNEcmFnQWN0aXZlXHJcbiAgICAgICAgICAgICAgICAgICAgPyBcImJvcmRlci1ibHVlLTUwMCBiZy1ibHVlLTUwMC8xMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgOiBcImJvcmRlci1ncmF5LTcwMCBob3Zlcjpib3JkZXItZ3JheS01MDAgYmctZ3JheS04MDAvNTBcIixcclxuICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPGlucHV0IHsuLi5nZXRJbnB1dFByb3BzKCl9IC8+XHJcbiAgICAgICAgICAgICAgICA8VXBsb2FkXHJcbiAgICAgICAgICAgICAgICAgIHNpemU9ezMyfVxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwIG1iLTNcIlxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDAgdGV4dC1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgRHJhZyAmIGRyb3AgaW1hZ2VzIGhlcmUsIG9ye1wiIFwifVxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNTAwXCI+YnJvd3NlPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICB7ZXhpc3RpbmdJbWFnZVVybHMubGVuZ3RoID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTQgZ2FwLTQgbXQtNFwiPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJjb2wtc3Bhbi1mdWxsIHRleHQtc20gdGV4dC1ncmF5LTUwMFwiPlNhdmVkIGltYWdlczwvcD5cclxuICAgICAgICAgICAgICAgICAge2V4aXN0aW5nSW1hZ2VVcmxzLm1hcCgodXJsLCBpZHgpID0+IChcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e3VybCArIGlkeH1cclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInJlbGF0aXZlIGdyb3VwIGFzcGVjdC1zcXVhcmUgYmctZ3JheS04MDAgcm91bmRlZC1sZyBvdmVyZmxvdy1oaWRkZW4gYm9yZGVyIGJvcmRlci1ncmF5LTcwMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPFByb2R1Y3RJbWFnZSBzcmM9e3VybH0gYWx0PVwicHJvZHVjdFwiIGNsYXNzTmFtZT1cInctZnVsbCBoLWZ1bGwgb2JqZWN0LWNvdmVyXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRFeGlzdGluZ0ltYWdlVXJscyhleGlzdGluZ0ltYWdlVXJscy5maWx0ZXIoKF8sIGkpID0+IGkgIT09IGlkeCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJhYnNvbHV0ZSB0b3AtMSByaWdodC0xIGJnLXJlZC01MDAgdGV4dC13aGl0ZSBwLTEgcm91bmRlZC1mdWxsIG9wYWNpdHktMCBncm91cC1ob3ZlcjpvcGFjaXR5LTEwMCB0cmFuc2l0aW9uLW9wYWNpdHlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8WCBzaXplPXsxMn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICAgIHtpbWFnZXMubGVuZ3RoID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTQgZ2FwLTQgbXQtNFwiPlxyXG4gICAgICAgICAgICAgICAgICB7ZXhpc3RpbmdJbWFnZVVybHMubGVuZ3RoID4gMCAmJiA8cCBjbGFzc05hbWU9XCJjb2wtc3Bhbi1mdWxsIHRleHQtc20gdGV4dC1ncmF5LTUwMFwiPk5ldyBpbWFnZXMgKHdpbGwgc2F2ZSBvbiBTdWJtaXQpPC9wPn1cclxuICAgICAgICAgICAgICAgICAge2ltYWdlcy5tYXAoKGZpbGUsIGlkeCkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgIGtleT17aWR4fVxyXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicmVsYXRpdmUgZ3JvdXAgYXNwZWN0LXNxdWFyZSBiZy1ncmF5LTgwMCByb3VuZGVkLWxnIG92ZXJmbG93LWhpZGRlbiBib3JkZXIgYm9yZGVyLWdyYXktNzAwXCJcclxuICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8aW1nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYz17VVJMLmNyZWF0ZU9iamVjdFVSTChmaWxlKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYWx0PVwicHJldmlld1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBoLWZ1bGwgb2JqZWN0LWNvdmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0SW1hZ2VzKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2VzLmZpbHRlcigoXywgaSkgPT4gaSAhPT0gaWR4KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJhYnNvbHV0ZSB0b3AtMSByaWdodC0xIGJnLXJlZC01MDAgdGV4dC13aGl0ZSBwLTEgcm91bmRlZC1mdWxsIG9wYWNpdHktMCBncm91cC1ob3ZlcjpvcGFjaXR5LTEwMCB0cmFuc2l0aW9uLW9wYWNpdHlcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8WCBzaXplPXsxMn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICAgIHtpbWFnZXMubGVuZ3RoID09PSAwICYmIGV4aXN0aW5nSW1hZ2VVcmxzLmxlbmd0aCA9PT0gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTYgdGV4dC1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMFwiPk5vIGltYWdlcyB1cGxvYWRlZCB5ZXQ8L3A+XHJcbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ncmF5LTUwMCBtdC0xXCI+VXBsb2FkIGltYWdlcyB0byBzaG93Y2FzZSB5b3VyIHByb2R1Y3Q8L3A+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvPlxyXG4gICAgICAgICl9XHJcblxyXG4gICAgICAgIHsvKiBUQUIgNSAtIERFVEFJTFMgKi99XHJcbiAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ2RldGFpbHMnICYmIChcclxuICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1jeWFuLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBEZXNjcmlwdGlvbiAmIE5vdGVzXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuXHJcbiAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxMYWJlbFxyXG4gICAgICAgICAgICAgICAgICBodG1sRm9yPVwiZGVzY3JpcHRpb25cIlxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCJcclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgUHJvZHVjdCBEZXNjcmlwdGlvblxyXG4gICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgIDxUZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICBpZD1cImRlc2NyaXB0aW9uXCJcclxuICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwiZGVzY3JpcHRpb25cIil9XHJcbiAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRGV0YWlsZWQgcHJvZHVjdCBkZXNjcmlwdGlvbi4uLlwiXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTEgbWluLWgtWzEyMHB4XVwiXHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgPExhYmVsXHJcbiAgICAgICAgICAgICAgICAgIGh0bWxGb3I9XCJub3Rlc1wiXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIlxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICBJbnRlcm5hbCBOb3Rlc1xyXG4gICAgICAgICAgICAgICAgPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgIDxUZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICBpZD1cIm5vdGVzXCJcclxuICAgICAgICAgICAgICAgICAgey4uLnJlZ2lzdGVyKFwibm90ZXNcIil9XHJcbiAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiUHJpdmF0ZSBub3RlcyAobm90IHZpc2libGUgdG8gY3VzdG9tZXJzKS4uLlwiXHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG10LTEgbWluLWgtWzgwcHhdXCJcclxuICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLW9yYW5nZS01MDAgcGwtM1wiPlxyXG4gICAgICAgICAgICAgICAgU3VwcGxpZXIgSW5mb3JtYXRpb25cclxuICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgRGVmYXVsdCBTdXBwbGllclxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8Q29udHJvbGxlclxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2w9e2NvbnRyb2x9XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZT1cInN1cHBsaWVyXCJcclxuICAgICAgICAgICAgICAgICAgICByZW5kZXI9eyh7IGZpZWxkIH0pID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25WYWx1ZUNoYW5nZT17ZmllbGQub25DaGFuZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtmaWVsZC52YWx1ZSA/PyAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdFRyaWdnZXIgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RWYWx1ZSBwbGFjZWhvbGRlcj1cIlNlbGVjdCBTdXBwbGllclwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvU2VsZWN0VHJpZ2dlcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPFNlbGVjdENvbnRlbnQgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktODAwIHRleHQtd2hpdGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7bG9hZGluZ1N1cHBsaWVycyA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHgtMiBweS0xLjUgdGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+TG9hZGluZyBzdXBwbGllcnMuLi48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApIDogc3VwcGxpZXJzLmxlbmd0aCA+IDAgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdXBwbGllcnMubWFwKChzKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RJdGVtIGtleT17cy5pZH0gdmFsdWU9e3MuaWR9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzLm5hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvU2VsZWN0SXRlbT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHgtMiBweS0xLjUgdGV4dC1zbSB0ZXh0LWdyYXktNTAwXCI+Tm8gc3VwcGxpZXJzLiBBZGQgaW4gQ29udGFjdHMgKHR5cGU6IFN1cHBsaWVyKS48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L1NlbGVjdENvbnRlbnQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L1NlbGVjdD5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIFN1cHBsaWVyIFByb2R1Y3QgQ29kZVxyXG4gICAgICAgICAgICAgICAgICA8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICB7Li4ucmVnaXN0ZXIoXCJzdXBwbGllckNvZGVcIil9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTdXBwbGllcidzIFNLVVwiXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgbXQtMVwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8Lz5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7LyogVEFCIDIgLSBWQVJJQVRJT05TICovfVxyXG4gICAgICAgIHthY3RpdmVUYWIgPT09ICd2YXJpYXRpb25zJyAmJiAoXHJcbiAgICAgICAgICA8PlxyXG4gICAgICAgICAgICB7LyogU3VwcGxpZXIgZGlzcGxheSAtIHNob3dzIHNlbGVjdGVkIHN1cHBsaWVyIGZyb20gRGV0YWlscyB0YWIgKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwIHRleHQteHMgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVcIj5TdXBwbGllciBmb3IgdGhpcyBwcm9kdWN0PC9MYWJlbD5cclxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlIGZvbnQtbWVkaXVtIG10LTFcIj5cclxuICAgICAgICAgICAgICAgIHt3YXRjaCgnc3VwcGxpZXInKSAmJiBzdXBwbGllcnMubGVuZ3RoID4gMFxyXG4gICAgICAgICAgICAgICAgICA/IHN1cHBsaWVycy5maW5kKChzKSA9PiBzLmlkID09PSB3YXRjaCgnc3VwcGxpZXInKSk/Lm5hbWUgPz8gJ+KAlCdcclxuICAgICAgICAgICAgICAgICAgOiAnU2VsZWN0IHN1cHBsaWVyIGluIERldGFpbHMgdGFiJ31cclxuICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAge3dhdGNoKCdzdXBwbGllcicpICYmIChcclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtdC0wLjVcIj5WYXJpYXRpb25zIHdpbGwgYmUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgc3VwcGxpZXI8L3A+XHJcbiAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICB7LyogSW5mbyBCYW5uZXIgKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctYmx1ZS05MDAvMjAgYm9yZGVyIGJvcmRlci1ibHVlLTgwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ibHVlLTMwMFwiPlxyXG4gICAgICAgICAgICAgICAgPHN0cm9uZz5Qcm9kdWN0IFZhcmlhdGlvbnM6PC9zdHJvbmc+IENyZWF0ZSBkaWZmZXJlbnQgdmFyaWFudHMgb2YgeW91ciBwcm9kdWN0IChlLmcuLCBkaWZmZXJlbnQgc2l6ZXMsIGNvbG9ycywgbWF0ZXJpYWxzKS4gXHJcbiAgICAgICAgICAgICAgICBFYWNoIHZhcmlhbnQgd2lsbCBoYXZlIGl0cyBvd24gU0tVLCBwcmljZSwgYW5kIHN0b2NrIGxldmVsLlxyXG4gICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICB7LyogQ29weSBmcm9tIGV4aXN0aW5nIHZhcmlhdGlvbiDigJMgZm9ybWF0OiBTdXBwbGllciDigJQgQXR0cmlidXRlTmFtZTogVmFsdWUgKGUuZy4gdmFyaWFudDogU2l6ZTogTCwgU1VQTElFUjogSWJyYWhpbSkgKi99XHJcbiAgICAgICAgICAgIHt2YXJpYXRpb25zRm9yQ29weS5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIG1iLTIgYmxvY2tcIj5Db3B5IGZyb20gZXhpc3RpbmcgdmFyaWF0aW9uPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTUwMCBtYi0yXCI+U2VsZWN0IGFuIGV4aXN0aW5nIHZhcmlhdGlvbiB0byBjb3B5IGl0cyBhdHRyaWJ1dGVzLiBTaG93czogU3VwcGxpZXIsIEF0dHJpYnV0ZTogVmFsdWUgKGUuZy4gU2l6ZTogTGFyZ2UsIENvbG9yOiBSZWQpLjwvcD5cclxuICAgICAgICAgICAgICAgIDxTZWxlY3RcclxuICAgICAgICAgICAgICAgICAgdmFsdWU9e2NvcHlGcm9tVmFyaWF0aW9uSWR9XHJcbiAgICAgICAgICAgICAgICAgIG9uVmFsdWVDaGFuZ2U9eyhpZCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHNldENvcHlGcm9tVmFyaWF0aW9uSWQoaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gdmFyaWF0aW9uc0ZvckNvcHkuZmluZCgoeCkgPT4geC52YXJpYXRpb25JZCA9PT0gaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlbnRyeSAmJiBlbnRyeS5wcm9kdWN0SWQgIT09IChpbml0aWFsUHJvZHVjdD8udXVpZCB8fCBpbml0aWFsUHJvZHVjdD8uaWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb3B5QXR0cmlidXRlc0Zyb21Qcm9kdWN0KGVudHJ5LnByb2R1Y3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgc2V0Q29weUZyb21WYXJpYXRpb25JZCgnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbnRyeSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgdG9hc3QuaW5mbygnVGhpcyBpcyB0aGUgY3VycmVudCBwcm9kdWN0Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICBzZXRDb3B5RnJvbVZhcmlhdGlvbklkKCcnKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIDxTZWxlY3RUcmlnZ2VyIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPFNlbGVjdFZhbHVlIHBsYWNlaG9sZGVyPVwiU2VsZWN0IHZhcmlhdGlvbiB0byBjb3B5IGZyb20uLi5cIiAvPlxyXG4gICAgICAgICAgICAgICAgICA8L1NlbGVjdFRyaWdnZXI+XHJcbiAgICAgICAgICAgICAgICAgIDxTZWxlY3RDb250ZW50IGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTgwMCB0ZXh0LXdoaXRlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAge2xvYWRpbmdQcm9kdWN0c1dpdGhWYXJpYXRpb25zID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJweC0yIHB5LTEuNSB0ZXh0LXNtIHRleHQtZ3JheS00MDBcIj5Mb2FkaW5nLi4uPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICAgIHZhcmlhdGlvbnNGb3JDb3B5XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKGUpID0+IGUucHJvZHVjdElkICE9PSAoaW5pdGlhbFByb2R1Y3Q/LnV1aWQgfHwgaW5pdGlhbFByb2R1Y3Q/LmlkKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoZSkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxTZWxlY3RJdGVtIGtleT17ZS52YXJpYXRpb25JZH0gdmFsdWU9e2UudmFyaWF0aW9uSWR9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2Uuc3VwcGxpZXJOYW1lfSDigJQge2UubGFiZWx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9TZWxlY3RJdGVtPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApKVxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvU2VsZWN0Q29udGVudD5cclxuICAgICAgICAgICAgICAgIDwvU2VsZWN0PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgey8qIFN0ZXAgMTogQWRkIEF0dHJpYnV0ZXMgKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1ibHVlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBTdGVwIDE6IERlZmluZSBWYXJpYXRpb24gQXR0cmlidXRlc1xyXG4gICAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwXCI+XHJcbiAgICAgICAgICAgICAgICBQaWNrIGZyb20gU2V0dGluZ3Mg4oaSIEludmVudG9yeSDihpIgVmFyaWF0aW9ucyBtYXN0ZXIgb3IgdHlwZSBuZXcgbmFtZXM7IHZhbHVlcyBjYW4gYmUgY2hvc2VuIGZyb20gc2F2ZWQgbGlzdHMgcGVyIGF0dHJpYnV0ZS5cclxuICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgPGRhdGFsaXN0IGlkPVwidmFyaWF0aW9uLW1hc3Rlci1hdHRyLW5hbWVzXCI+XHJcbiAgICAgICAgICAgICAgICB7T2JqZWN0LmtleXModmFyaWF0aW9uTWFzdGVyKVxyXG4gICAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKVxyXG4gICAgICAgICAgICAgICAgICAubWFwKChrKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e2t9IHZhbHVlPXtrfSAvPlxyXG4gICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICA8L2RhdGFsaXN0PlxyXG5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIG1iLTIgYmxvY2tcIj5BZGQgTmV3IEF0dHJpYnV0ZSAoZS5nLiwgU2l6ZSwgQ29sb3IsIE1hdGVyaWFsKTwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXtuZXdBdHRyaWJ1dGVOYW1lfVxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0TmV3QXR0cmlidXRlTmFtZShlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgb25LZXlQcmVzcz17KGUpID0+IGUua2V5ID09PSAnRW50ZXInICYmIChlLnByZXZlbnREZWZhdWx0KCksIGFkZFZhcmlhbnRBdHRyaWJ1dGUoKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJFbnRlciBhdHRyaWJ1dGUgbmFtZSAoZS5nLiwgQ29sb3IpXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgbGlzdD1cInZhcmlhdGlvbi1tYXN0ZXItYXR0ci1uYW1lc1wiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXthZGRWYXJpYW50QXR0cmlidXRlfVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWJsdWUtNTAwIGhvdmVyOmJnLWJsdWUtNjAwIHRleHQtd2hpdGUgcHgtNiBweS0yIHJvdW5kZWQtbGcgZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1jb2xvcnMgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgd2hpdGVzcGFjZS1ub3dyYXBcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgPFBsdXMgc2l6ZT17MTZ9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgQWRkXHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIHsvKiBEaXNwbGF5IEF0dHJpYnV0ZXMgKi99XHJcbiAgICAgICAgICAgICAge3ZhcmlhbnRBdHRyaWJ1dGVzLmxlbmd0aCA+IDAgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICAgICAge3ZhcmlhbnRBdHRyaWJ1dGVzLm1hcCgoYXR0ciwgYXR0ckluZGV4KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBrZXk9e2F0dHIubmFtZX0gY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gbWItM1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwidGV4dC1tZCBmb250LXNlbWlib2xkIHRleHQtd2hpdGUgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7YXR0ci5uYW1lfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2g0PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcmVtb3ZlVmFyaWFudEF0dHJpYnV0ZShhdHRyLm5hbWUpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtcmVkLTUwMCBob3Zlcjp0ZXh0LXJlZC00MDAgdHJhbnNpdGlvbi1jb2xvcnMgcC0yXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUcmFzaDIgc2l6ZT17MTZ9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgey8qIEFkZCBWYWx1ZXMgKi99XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRhdGFsaXN0IGlkPXtgdmFyaWF0aW9uLW1hc3Rlci12YWx1ZXMtJHthdHRyLm5hbWUucmVwbGFjZSgvXFxzKy9nLCAnLScpfWB9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsodmFyaWF0aW9uTWFzdGVyW2F0dHIubmFtZV0gfHwgW10pLm1hcCgodikgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e3Z9IHZhbHVlPXt2fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2RhdGFsaXN0PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17c2VsZWN0ZWRBdHRyaWJ1dGVJbmRleCA9PT0gYXR0ckluZGV4ID8gbmV3QXR0cmlidXRlVmFsdWUgOiAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uRm9jdXM9eygpID0+IHNldFNlbGVjdGVkQXR0cmlidXRlSW5kZXgoYXR0ckluZGV4KX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0TmV3QXR0cmlidXRlVmFsdWUoZS50YXJnZXQudmFsdWUpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25LZXlQcmVzcz17KGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkQXR0cmlidXRlSW5kZXgoYXR0ckluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRBdHRyaWJ1dGVWYWx1ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e2BBZGQgJHthdHRyLm5hbWV9IHZhbHVlIChlLmcuLCBSZWQsIEJsdWUpYH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIHRleHQtc21cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlzdD17YHZhcmlhdGlvbi1tYXN0ZXItdmFsdWVzLSR7YXR0ci5uYW1lLnJlcGxhY2UoL1xccysvZywgJy0nKX1gfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkQXR0cmlidXRlSW5kZXgoYXR0ckluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQXR0cmlidXRlVmFsdWUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ibHVlLTYwMCBob3ZlcjpiZy1ibHVlLTcwMCB0ZXh0LXdoaXRlIHB4LTQgcHktMiByb3VuZGVkLWxnIHRleHQtc20gZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1jb2xvcnMgd2hpdGVzcGFjZS1ub3dyYXBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFkZCBWYWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBEaXNwbGF5IFZhbHVlcyAqL31cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXdyYXAgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2F0dHIudmFsdWVzLm1hcCgodmFsdWUsIHZhbHVlSW5kZXgpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e3ZhbHVlfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIHB4LTMgcHktMS41IHJvdW5kZWQtbGcgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgdGV4dC1zbVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+e3ZhbHVlfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHJlbW92ZUF0dHJpYnV0ZVZhbHVlKGF0dHJJbmRleCwgdmFsdWVJbmRleCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtcmVkLTQwMCBob3Zlcjp0ZXh0LXJlZC0zMDAgdHJhbnNpdGlvbi1jb2xvcnNcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8WCBzaXplPXsxNH0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAge2F0dHIudmFsdWVzLmxlbmd0aCA9PT0gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMCB0ZXh0LXNtIGl0YWxpY1wiPk5vIHZhbHVlcyBhZGRlZCB5ZXQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBTdGVwIDI6IEdlbmVyYXRlIFZhcmlhdGlvbnMgKi99XHJcbiAgICAgICAgICAgIHt2YXJpYW50QXR0cmlidXRlcy5sZW5ndGggPiAwICYmIHZhcmlhbnRBdHRyaWJ1dGVzLmV2ZXJ5KGF0dHIgPT4gYXR0ci52YWx1ZXMubGVuZ3RoID4gMCkgJiYgKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIGJvcmRlci1sLTQgYm9yZGVyLWJsdWUtNTAwIHBsLTNcIj5cclxuICAgICAgICAgICAgICAgICAgU3RlcCAyOiBHZW5lcmF0ZSAmIENvbmZpZ3VyZSBWYXJpYXRpb25zXHJcbiAgICAgICAgICAgICAgICA8L2gzPlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00IGZsZXgtd3JhcFwiPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS00MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICBMaW1pdDoge01BWF9WQVJJQVRJT05TfSB2YXJpYXRpb25zIHBlciBwcm9kdWN0LiBPcGVuaW5nIHN0b2NrIGlzIHNldCBwZXIgcm93IGFuZCBzYXZlZCBhcyBzdG9jayBtb3ZlbWVudHMgb24gc2F2ZS5cclxuICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS01MDAgZm9udC1tb25vXCI+XHJcbiAgICAgICAgICAgICAgICAgICAge2dlbmVyYXRlZFZhcmlhdGlvbnMubGVuZ3RofSAvIHtNQVhfVkFSSUFUSU9OU31cclxuICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNFwiPlxyXG4gICAgICAgICAgICAgICAgICB7KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb3VudCA9IHZhcmlhbnRBdHRyaWJ1dGVzLnJlZHVjZSgoYWNjLCBhdHRyKSA9PiBhY2MgKiBhdHRyLnZhbHVlcy5sZW5ndGgsIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGF0TGltaXQgPSBjb3VudCA+IE1BWF9WQVJJQVRJT05TO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17Z2VuZXJhdGVWYXJpYXRpb25zfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXthdExpbWl0fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidGV4dC13aGl0ZSBweC02IHB5LTMgcm91bmRlZC14bCBmb250LWJvbGQgdHJhbnNpdGlvbi1jb2xvcnMgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF0TGltaXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcImJnLWdyYXktNjAwIGN1cnNvci1ub3QtYWxsb3dlZCBvcGFjaXR5LTYwXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcImJnLWJsdWUtNTAwIGhvdmVyOmJnLWJsdWUtNjAwIHNoYWRvdy1sZyBzaGFkb3ctYmx1ZS01MDAvMjBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8UmVmcmVzaENjdyBzaXplPXsxOH0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBHZW5lcmF0ZSB7Y291bnR9IFZhcmlhdGlvbnNcclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTQwMCBtdC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2F0TGltaXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYFJlZHVjZSBhdHRyaWJ1dGVzIG9yIHZhbHVlcyB0byBzdGF5IHVuZGVyICR7TUFYX1ZBUklBVElPTlN9IHZhcmlhdGlvbnMuYFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcIkFsbCBwb3NzaWJsZSBjb21iaW5hdGlvbnMgb2YgeW91ciBhdHRyaWJ1dGUgdmFsdWVzLlwifVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICB9KSgpfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgey8qIFZhcmlhdGlvbnMgVGFibGUgKi99XHJcbiAgICAgICAgICAgICAgICB7Z2VuZXJhdGVkVmFyaWF0aW9ucy5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgb3ZlcmZsb3ctaGlkZGVuXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJvdmVyZmxvdy14LWF1dG8gb3ZlcmZsb3cteS1hdXRvXCIgc3R5bGU9e3sgbWF4SGVpZ2h0OiAnbWluKDYwdmgsIDQyMHB4KScgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwidy1mdWxsIGJvcmRlci1jb2xsYXBzZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGhlYWQgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWIgYm9yZGVyLWdyYXktNzAwIHN0aWNreSB0b3AtMCB6LVsxXVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJweC00IHB5LTMgdGV4dC1sZWZ0IHRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktMzAwXCI+IzwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dmFyaWFudEF0dHJpYnV0ZXMubWFwKGF0dHIgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGgga2V5PXthdHRyLm5hbWV9IGNsYXNzTmFtZT1cInB4LTQgcHktMyB0ZXh0LWxlZnQgdGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZ3JheS0zMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7YXR0ci5uYW1lfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwicHgtNCBweS0zIHRleHQtbGVmdCB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTMwMFwiPlNLVTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwicHgtNCBweS0zIHRleHQtbGVmdCB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTMwMFwiPlB1cmNoYXNlIFByaWNlPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJweC00IHB5LTMgdGV4dC1sZWZ0IHRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LWdyYXktMzAwXCI+U2VsbGluZyBQcmljZTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwicHgtNCBweS0zIHRleHQtbGVmdCB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTMwMFwiPk9wZW5pbmcgU3RvY2s8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cInB4LTQgcHktMyB0ZXh0LWxlZnQgdGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZ3JheS0zMDBcIj5CYXJjb2RlPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2dlbmVyYXRlZFZhcmlhdGlvbnMubWFwKCh2YXJpYXRpb24sIGluZGV4KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtpbmRleH0gY2xhc3NOYW1lPVwiYm9yZGVyLWIgYm9yZGVyLWdyYXktNzAwIGhvdmVyOmJnLWdyYXktOTAwLzUwIHRyYW5zaXRpb24tY29sb3JzXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJweC00IHB5LTMgdGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+e2luZGV4ICsgMX08L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dmFyaWFudEF0dHJpYnV0ZXMubWFwKGF0dHIgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBrZXk9e2F0dHIubmFtZX0gY2xhc3NOYW1lPVwicHgtNCBweS0zIHRleHQtc20gdGV4dC13aGl0ZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiYmctYmx1ZS05MDAvMzAgYm9yZGVyIGJvcmRlci1ibHVlLTgwMCBweC0yIHB5LTEgcm91bmRlZCB0ZXh0LXhzXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt2YXJpYXRpb24uY29tYmluYXRpb25bYXR0ci5uYW1lXX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInB4LTQgcHktM1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3ZhcmlhdGlvbi5za3V9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IFsuLi5nZW5lcmF0ZWRWYXJpYXRpb25zXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZFtpbmRleF0uc2t1ID0gZS50YXJnZXQudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnModXBkYXRlZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbSB3LTMyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU0tVXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicHgtNCBweS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXA9ezAuMDF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW49ezB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17TnVtYmVyLmlzRmluaXRlKE51bWJlcih2YXJpYXRpb24ucHVyY2hhc2VQcmljZSkpID8gdmFyaWF0aW9uLnB1cmNoYXNlUHJpY2UgOiAwfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWQgPSBbLi4uZ2VuZXJhdGVkVmFyaWF0aW9uc107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHYgPSBwYXJzZUZsb2F0KGUudGFyZ2V0LnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZFtpbmRleF0ucHVyY2hhc2VQcmljZSA9IE51bWJlci5pc05hTih2KSA/IDAgOiB2O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKHVwZGF0ZWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIHRleHQtc20gdy0yNFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17U3RyaW5nKHdhdGNoKCdwdXJjaGFzZVByaWNlJykgPz8gMCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIlB1cmNoYXNlIGNvc3QgZm9yIHRoaXMgdmFyaWF0aW9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicHgtNCBweS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXA9ezAuMDF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW49ezB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17TnVtYmVyLmlzRmluaXRlKE51bWJlcih2YXJpYXRpb24ucHJpY2UpKSA/IHZhcmlhdGlvbi5wcmljZSA6IDB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IFsuLi5nZW5lcmF0ZWRWYXJpYXRpb25zXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdiA9IHBhcnNlRmxvYXQoZS50YXJnZXQudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkW2luZGV4XS5wcmljZSA9IE51bWJlci5pc05hTih2KSA/IDAgOiB2O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRHZW5lcmF0ZWRWYXJpYXRpb25zKHVwZGF0ZWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIHRleHQtc20gdy0yNFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17U3RyaW5nKHdhdGNoKCdzZWxsaW5nUHJpY2UnKSA/PyAwKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiU2VsbGluZyBwcmljZSBmb3IgdGhpcyB2YXJpYXRpb25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJweC00IHB5LTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluPXswfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RlcD17c2VsZWN0ZWRVbml0QWxsb3dzRGVjaW1hbCA/ICdhbnknIDogMX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXt2YXJpYXRpb24uc3RvY2t9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IFsuLi5nZW5lcmF0ZWRWYXJpYXRpb25zXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZFtpbmRleF0uc3RvY2sgPSBwYXJzZVZhcmlhdGlvblF0eUlucHV0KGUudGFyZ2V0LnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0R2VuZXJhdGVkVmFyaWF0aW9ucyh1cGRhdGVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSB0ZXh0LXNtIHctMjRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0ZWRVbml0QWxsb3dzRGVjaW1hbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gJ09wZW5pbmcgcXR5IGZyb20gc3RvY2sgbW92ZW1lbnRzIChlZGl0YWJsZSB3aGVuIG9ubHkgb3BlbmluZyBleGlzdHMpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJ1dob2xlIHVuaXRzIG9ubHkgZm9yIHRoaXMgcHJvZHVjdCB1bml0J1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJweC00IHB5LTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXt2YXJpYXRpb24uYmFyY29kZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkID0gWy4uLmdlbmVyYXRlZFZhcmlhdGlvbnNdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkW2luZGV4XS5iYXJjb2RlID0gZS50YXJnZXQudmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEdlbmVyYXRlZFZhcmlhdGlvbnModXBkYXRlZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbSB3LTMyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiQmFyY29kZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgcHgtNCBweS0zIGJvcmRlci10IGJvcmRlci1ncmF5LTcwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNDAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFRvdGFsIFZhcmlhdGlvbnM6IDxzcGFuIGNsYXNzTmFtZT1cInRleHQtd2hpdGUgZm9udC1zZW1pYm9sZFwiPntnZW5lcmF0ZWRWYXJpYXRpb25zLmxlbmd0aH08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgIHsvKiBFbXB0eSBTdGF0ZSAqL31cclxuICAgICAgICAgICAge3ZhcmlhbnRBdHRyaWJ1dGVzLmxlbmd0aCA9PT0gMCAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC04IHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgICAgICA8UGFja2FnZSBzaXplPXs0OH0gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTYwMCBteC1hdXRvIG1iLTNcIiAvPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCBtYi0yXCI+Tm8gdmFyaWF0aW9uIGF0dHJpYnV0ZXMgYWRkZWQgeWV0PC9wPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LWdyYXktNTAwXCI+XHJcbiAgICAgICAgICAgICAgICAgIEFkZCBhdHRyaWJ1dGVzIGxpa2UgU2l6ZSwgQ29sb3IsIG9yIE1hdGVyaWFsIHRvIGNyZWF0ZSBwcm9kdWN0IHZhcmlhdGlvbnNcclxuICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgIDwvPlxyXG4gICAgICAgICl9XHJcblxyXG4gICAgICAgIHsvKiBUQUIgMyAtIENPTUJPUyAqL31cclxuICAgICAgICB7YWN0aXZlVGFiID09PSAnY29tYm9zJyAmJiBtb2R1bGVzLmNvbWJvc0VuYWJsZWQgJiYgaXNDb21ib1Byb2R1Y3QgJiYgKFxyXG4gICAgICAgICAgPD5cclxuICAgICAgICAgICAgey8qIFJlcXVpcmUgcHJvZHVjdCB0byBiZSBzYXZlZCBiZWZvcmUgYWRkaW5nIGNvbWJvcyAqL31cclxuICAgICAgICAgICAgeyEoaW5pdGlhbFByb2R1Y3Q/LnV1aWQgfHwgaW5pdGlhbFByb2R1Y3Q/LmlkKSA/IChcclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWFtYmVyLTkwMC8zMCBib3JkZXIgYm9yZGVyLWFtYmVyLTcwMCByb3VuZGVkLXhsIHAtNiB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1hbWJlci0yMDAgZm9udC1tZWRpdW1cIj5TYXZlIHRoZSBwcm9kdWN0IGZpcnN0IHRvIGFkZCBjb21ib3M8L3A+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWFtYmVyLTIwMC84MCB0ZXh0LXNtIG10LTJcIj5cclxuICAgICAgICAgICAgICAgICAgR28gdG8gdGhlIDxzdHJvbmc+QmFzaWM8L3N0cm9uZz4gdGFiLCBmaWxsIGluIG5hbWUgYW5kIG90aGVyIHJlcXVpcmVkIGZpZWxkcywgdGhlbiBjbGljayA8c3Ryb25nPlNhdmU8L3N0cm9uZz4uIFxyXG4gICAgICAgICAgICAgICAgICBBZnRlciB0aGUgcHJvZHVjdCBpcyBzYXZlZCwgeW91IGNhbiByZXR1cm4gaGVyZSB0byBjcmVhdGUgY29tYm8gYnVuZGxlcy5cclxuICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgPD5cclxuICAgICAgICAgICAgey8qIEluZm8gQmFubmVyICovfVxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWJsdWUtOTAwLzIwIGJvcmRlciBib3JkZXItYmx1ZS04MDAgcm91bmRlZC14bCBwLTRcIj5cclxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtYmx1ZS0zMDBcIj5cclxuICAgICAgICAgICAgICAgIDxzdHJvbmc+UHJvZHVjdCBDb21ib3M6PC9zdHJvbmc+IENyZWF0ZSBidW5kbGVkIHBhY2thZ2VzIGJ5IGNvbWJpbmluZyBtdWx0aXBsZSBwcm9kdWN0cy4gXHJcbiAgICAgICAgICAgICAgICBTZXQgYSBzcGVjaWFsIGNvbWJvIHByaWNlIHRvIG9mZmVyIGRpc2NvdW50cyBvbiBidW5kbGUgcHVyY2hhc2VzLlxyXG4gICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICB7LyogU3RlcCAxOiBDcmVhdGUgQ29tYm8gKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1ibHVlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICBDcmVhdGUgTmV3IENvbWJvXHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICB7LyogQ29tYm8gTmFtZSAqL31cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTRcIj5cclxuICAgICAgICAgICAgICAgIDxMYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMjAwIG1iLTIgYmxvY2tcIj5Db21ibyBOYW1lPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICB2YWx1ZT17Y29tYm9OYW1lfVxyXG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldENvbWJvTmFtZShlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiZS5nLiwgV2VkZGluZyBQYWNrYWdlLCBTdW1tZXIgQnVuZGxlXCJcclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGVcIlxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgey8qIEFkZCBQcm9kdWN0cyB0byBDb21ibyAqL31cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWdyYXktODAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC14bCBwLTQgc3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgICAgICA8TGFiZWwgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTIwMCBibG9ja1wiPkFkZCBQcm9kdWN0cyB0byBDb21ibzwvTGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTQgZ2FwLTJcIj5cclxuICAgICAgICAgICAgICAgICAgey8qIFByb2R1Y3QgU2VhcmNoIHdpdGggRHJvcGRvd24gKi99XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWQ6Y29sLXNwYW4tMiByZWxhdGl2ZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3Byb2R1Y3RTZWFyY2hRdWVyeX1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRQcm9kdWN0U2VhcmNoUXVlcnkoZS50YXJnZXQudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93UHJvZHVjdERyb3Bkb3duKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uRm9jdXM9eygpID0+IHNldFNob3dQcm9kdWN0RHJvcGRvd24odHJ1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlNlYXJjaCBwcm9kdWN0IGJ5IG5hbWUgb3IgU0tVLi4uXCJcclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIHRleHQtc21cIlxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgey8qIFByb2R1Y3QgRHJvcGRvd24gKi99XHJcbiAgICAgICAgICAgICAgICAgICAge3Nob3dQcm9kdWN0RHJvcGRvd24gJiYgcHJvZHVjdFNlYXJjaFF1ZXJ5ICYmIGZpbHRlcmVkUHJvZHVjdHMubGVuZ3RoID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIHotNTAgdy1mdWxsIG10LTEgYmctZ3JheS05MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHNoYWRvdy14bCBtYXgtaC02MCBvdmVyZmxvdy15LWF1dG9cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2ZpbHRlcmVkUHJvZHVjdHMubWFwKChwcm9kdWN0KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtwcm9kdWN0LmlkfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZWxlY3RQcm9kdWN0KHByb2R1Y3QpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHB4LTQgcHktMyB0ZXh0LWxlZnQgaG92ZXI6YmctZ3JheS04MDAgdHJhbnNpdGlvbi1jb2xvcnMgYm9yZGVyLWIgYm9yZGVyLWdyYXktODAwIGxhc3Q6Ym9yZGVyLWItMFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1zdGFydFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtd2hpdGUgdGV4dC1zbSBmb250LW1lZGl1bVwiPntwcm9kdWN0Lm5hbWV9PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDAgdGV4dC14cyBtdC0xXCI+U0tVOiB7cHJvZHVjdC5za3V9PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmVlbi00MDAgdGV4dC1zbSBmb250LXNlbWlib2xkXCI+4oKoe3Byb2R1Y3QucmV0YWlsX3ByaWNlfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAge3Nob3dQcm9kdWN0RHJvcGRvd24gJiYgcHJvZHVjdFNlYXJjaFF1ZXJ5ICYmIGZpbHRlcmVkUHJvZHVjdHMubGVuZ3RoID09PSAwICYmICFsb2FkaW5nUHJvZHVjdHMgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSB6LTUwIHctZnVsbCBtdC0xIGJnLWdyYXktOTAwIGJvcmRlciBib3JkZXItZ3JheS03MDAgcm91bmRlZC1sZyBzaGFkb3cteGwgcC00IHRleHQtY2VudGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDAgdGV4dC1zbVwiPk5vIHByb2R1Y3RzIGF2YWlsYWJsZSB0byBhZGQuPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICB7bG9hZGluZ1Byb2R1Y3RzICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgei01MCB3LWZ1bGwgbXQtMSBiZy1ncmF5LTkwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQtbGcgc2hhZG93LXhsIHAtNCB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwIHRleHQtc21cIj5Mb2FkaW5nIHByb2R1Y3RzLi4uPC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIHthdmFpbGFibGVQcm9kdWN0cy5sZW5ndGggPT09IDAgJiYgIWxvYWRpbmdQcm9kdWN0cyAmJiAoXHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLWxnIHAtNCB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDAgdGV4dC1zbVwiPk5vIHByb2R1Y3RzIGF2YWlsYWJsZSB0byBhZGQuPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS02MDAgdGV4dC14cyBtdC0xXCI+Q3JlYXRlIHByb2R1Y3RzIGZpcnN0LCB0aGVuIGFkZCB0aGVtIHRvIHRoaXMgY29tYm8uPC9wPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIHsvKiBDdXJyZW50IENvbWJvIEl0ZW1zICovfVxyXG4gICAgICAgICAgICAgIHtjdXJyZW50Q29tYm9JdGVtcy5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtNCBzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDAgYmxvY2tcIj5Qcm9kdWN0cyBpbiBUaGlzIENvbWJvPC9MYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTJcIj5cclxuICAgICAgICAgICAgICAgICAgICB7Y3VycmVudENvbWJvSXRlbXMubWFwKChpdGVtLCBpbmRleCkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2luZGV4fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHB4LTQgcHktMyByb3VuZGVkLWxnIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTQgZmxleC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtd2hpdGUgZm9udC1tZWRpdW1cIj57aXRlbS5wcm9kdWN0X25hbWV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMCB0ZXh0LXhzIG10LTAuNVwiPlNLVToge2l0ZW0ucHJvZHVjdF9za3V9PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW49ezAuMDF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGVwPXswLjAxfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2l0ZW0ucXR5IHx8ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB1cGRhdGVDb21ib0l0ZW1RdHkoaW5kZXgsIHBhcnNlRmxvYXQoZS50YXJnZXQudmFsdWUpIHx8IDEpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbSB3LTIwXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiUXR5XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW49ezB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGVwPXswLjAxfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2l0ZW0udW5pdF9wcmljZSB8fCAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gdXBkYXRlQ29tYm9JdGVtUHJpY2UoaW5kZXgsIHBhcnNlRmxvYXQoZS50YXJnZXQudmFsdWUpIHx8IDApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgdGV4dC1zbSB3LTI0XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiUHJpY2VcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmF5LTUwMCB0ZXh0LXNtIHctMjQgdGV4dC1yaWdodFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgU3VidG90YWw6IOKCqHsoKGl0ZW0ucXR5IHx8IDApICogKGl0ZW0udW5pdF9wcmljZSB8fCAwKSkudG9GaXhlZCgyKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcmVtb3ZlQ29tYm9JdGVtKGluZGV4KX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LXJlZC01MDAgaG92ZXI6dGV4dC1yZWQtNDAwIHRyYW5zaXRpb24tY29sb3JzIHAtMiBtbC0yXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUcmFzaDIgc2l6ZT17MTZ9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgey8qIENvbWJvIFByaWNpbmcgKi99XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyLXQgYm9yZGVyLWdyYXktNzAwIHB0LTQgc3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDBcIj5Ub3RhbCBJbmRpdmlkdWFsIFByaWNlOjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtd2hpdGUgZm9udC1zZW1pYm9sZFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICDigqh7Y3VycmVudENvbWJvSXRlbXMucmVkdWNlKChzdW0sIGl0ZW0pID0+IHN1bSArIChpdGVtLnF0eSB8fCAwKSAqIChpdGVtLnVuaXRfcHJpY2UgfHwgMCksIDApLnRvRml4ZWQoMil9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPExhYmVsIGNsYXNzTmFtZT1cInRleHQtZ3JheS0yMDBcIj5Db21ibyBQcmljZTo8L0xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPElucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW49ezB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXA9ezAuMDF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtjb21ib0ZpbmFsUHJpY2UgfHwgJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0Q29tYm9GaW5hbFByaWNlKHBhcnNlRmxvYXQoZS50YXJnZXQudmFsdWUpIHx8IDApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkVudGVyIGNvbWJvIHByaWNlXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZ3JheS05MDAgYm9yZGVyLWdyYXktNzAwIHRleHQtd2hpdGUgZmxleC0xXCJcclxuICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAge2NvbWJvRmluYWxQcmljZSA+IDAgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXIgdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTQwMFwiPkRpc2NvdW50Ojwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ncmVlbi00MDAgZm9udC1zZW1pYm9sZFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIOKCqHsoY3VycmVudENvbWJvSXRlbXMucmVkdWNlKChzdW0sIGl0ZW0pID0+IHN1bSArIChpdGVtLnF0eSB8fCAwKSAqIChpdGVtLnVuaXRfcHJpY2UgfHwgMCksIDApIC0gY29tYm9GaW5hbFByaWNlKS50b0ZpeGVkKDIpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtzYXZlQ29tYm99XHJcbiAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFjb21ib05hbWUudHJpbSgpIHx8IGNvbWJvRmluYWxQcmljZSA8PSAwIHx8IGN1cnJlbnRDb21ib0l0ZW1zLmxlbmd0aCA9PT0gMH1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1ibHVlLTUwMCBob3ZlcjpiZy1ibHVlLTYwMCBkaXNhYmxlZDpiZy1ncmF5LTcwMCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgdGV4dC13aGl0ZSBweC02IHB5LTMgcm91bmRlZC14bCBmb250LWJvbGQgdHJhbnNpdGlvbi1jb2xvcnMgc2hhZG93LWxnIHNoYWRvdy1ibHVlLTUwMC8yMCB3LWZ1bGxcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgU2F2ZSBDb21ib1xyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgey8qIFNhdmVkIENvbWJvcyAqL31cclxuICAgICAgICAgICAge2NvbWJvcy5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCBib3JkZXItbC00IGJvcmRlci1ibHVlLTUwMCBwbC0zXCI+XHJcbiAgICAgICAgICAgICAgICAgIFNhdmVkIENvbWJvcyAoe2NvbWJvcy5sZW5ndGh9KVxyXG4gICAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgICAgICAge2NvbWJvcy5tYXAoKGNvbWJvKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBrZXk9e2NvbWJvLmlkfSBjbGFzc05hbWU9XCJiZy1ncmF5LTgwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHJvdW5kZWQteGwgcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBtYi0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZVwiPntjb21iby5jb21ib19uYW1lfTwvaDQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBkZWxldGVDb21ibyhjb21iby5pZCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNTAwIGhvdmVyOnRleHQtcmVkLTQwMCB0cmFuc2l0aW9uLWNvbG9ycyBwLTJcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFRyYXNoMiBzaXplPXsxOH0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTIgbWItM1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7Y29tYm8uaXRlbXMubWFwKChpdGVtLCBpZHgpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aWR4fSBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHB4LTMgcHktMiByb3VuZGVkLWxnIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiB0ZXh0LXNtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXdoaXRlXCI+e2l0ZW0ucHJvZHVjdF9uYW1lIHx8ICdVbmtub3duIFByb2R1Y3QnfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2l0ZW0ucHJvZHVjdF9za3UgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS01MDAgdGV4dC14cyBtdC0wLjVcIj5TS1U6IHtpdGVtLnByb2R1Y3Rfc2t1fTwvcD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNCB0ZXh0LWdyYXktNDAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPlF0eToge2l0ZW0ucXR5fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2l0ZW0udW5pdF9wcmljZSAmJiA8c3Bhbj7igqh7aXRlbS51bml0X3ByaWNlLnRvRml4ZWQoMil9PC9zcGFuPn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC13aGl0ZVwiPuKCqHsoKGl0ZW0ucXR5IHx8IDApICogKGl0ZW0udW5pdF9wcmljZSB8fCAwKSkudG9GaXhlZCgyKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci10IGJvcmRlci1ncmF5LTcwMCBwdC0zIHNwYWNlLXktMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIHRleHQtc21cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNDAwXCI+VG90YWwgSW5kaXZpZHVhbCBQcmljZTo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC13aGl0ZVwiPuKCqHtjb21iby5pdGVtcy5yZWR1Y2UoKHN1bSwgaXRlbSkgPT4gc3VtICsgKGl0ZW0ucXR5IHx8IDApICogKGl0ZW0udW5pdF9wcmljZSB8fCAwKSwgMCkudG9GaXhlZCgyKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIHRleHQtc21cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTQwMFwiPkNvbWJvIFByaWNlOjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTQwMCBmb250LWJvbGRcIj7igqh7Y29tYm8uY29tYm9fcHJpY2UudG9GaXhlZCgyKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIHRleHQtc21cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNDAwXCI+WW91IFNhdmU6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtYmx1ZS00MDAgZm9udC1zZW1pYm9sZFwiPuKCqHsoY29tYm8uaXRlbXMucmVkdWNlKChzdW0sIGl0ZW0pID0+IHN1bSArIChpdGVtLnF0eSB8fCAwKSAqIChpdGVtLnVuaXRfcHJpY2UgfHwgMCksIDApIC0gY29tYm8uY29tYm9fcHJpY2UpLnRvRml4ZWQoMil9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgey8qIEVtcHR5IFN0YXRlICovfVxyXG4gICAgICAgICAgICB7Y29tYm9zLmxlbmd0aCA9PT0gMCAmJiBjdXJyZW50Q29tYm9JdGVtcy5sZW5ndGggPT09IDAgJiYgKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCByb3VuZGVkLXhsIHAtOCB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgPFBhY2thZ2Ugc2l6ZT17NDh9IGNsYXNzTmFtZT1cInRleHQtZ3JheS02MDAgbXgtYXV0byBtYi0zXCIgLz5cclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDAgbWItMlwiPk5vIGNvbWJvcyBjcmVhdGVkIHlldDwvcD5cclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ncmF5LTUwMFwiPlxyXG4gICAgICAgICAgICAgICAgICBTdGFydCBhZGRpbmcgcHJvZHVjdHMgYWJvdmUgdG8gY3JlYXRlIHlvdXIgZmlyc3QgY29tYm8gcGFja2FnZVxyXG4gICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgIDwvPlxyXG4gICAgICAgICl9XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJwLTYgYm9yZGVyLXQgYm9yZGVyLWdyYXktODAwIGJnLWdyYXktOTAwIHN0aWNreSBib3R0b20tMCB6LTEwIGZsZXggZ2FwLTRcIj5cclxuICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICBvbkNsaWNrPXtvbkNhbmNlbH1cclxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgY2xhc3NOYW1lPVwicHgtNiBiZy1ncmF5LTgwMCBob3ZlcjpiZy1ncmF5LTcwMCB0ZXh0LXdoaXRlIHB5LTMgcm91bmRlZC14bCBmb250LWJvbGQgdHJhbnNpdGlvbi1jb2xvcnMgYm9yZGVyIGJvcmRlci1ncmF5LTcwMFwiXHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgQ2FuY2VsXHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgb25DbGljaz17aGFuZGxlU3VibWl0KChkYXRhKSA9PlxyXG4gICAgICAgICAgICBvblN1Ym1pdChkYXRhLCBcInNhdmVcIiksXHJcbiAgICAgICAgICApfVxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBkaXNhYmxlZD17c2F2aW5nfVxyXG4gICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC0xIGJnLWdyYXktNzAwIGhvdmVyOmJnLWdyYXktNjAwIHRleHQtd2hpdGUgcHktMyByb3VuZGVkLXhsIGZvbnQtYm9sZCB0cmFuc2l0aW9uLWNvbG9ycyBkaXNhYmxlZDpvcGFjaXR5LTUwIGRpc2FibGVkOnBvaW50ZXItZXZlbnRzLW5vbmVcIlxyXG4gICAgICAgID5cclxuICAgICAgICAgIHtzYXZpbmcgPyAnU2F2aW5nLi4uJyA6ICdTYXZlIFByb2R1Y3QnfVxyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgIHtvblNhdmVBbmRBZGQgJiYgKFxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVTdWJtaXQoKGRhdGEpID0+XHJcbiAgICAgICAgICAgICAgb25TdWJtaXQoZGF0YSwgXCJzYXZlQW5kQWRkXCIpLFxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgZGlzYWJsZWQ9e3NhdmluZ31cclxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC1bMl0gYmctYmx1ZS01MDAgaG92ZXI6YmctYmx1ZS02MDAgdGV4dC13aGl0ZSBweS0zIHJvdW5kZWQteGwgZm9udC1ib2xkIHRyYW5zaXRpb24tY29sb3JzIHNoYWRvdy1sZyBzaGFkb3ctYmx1ZS01MDAvMjAgZGlzYWJsZWQ6b3BhY2l0eS01MCBkaXNhYmxlZDpwb2ludGVyLWV2ZW50cy1ub25lXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAge3NhdmluZyA/ICdTYXZpbmcuLi4nIDogJ1NhdmUgJiBBZGQgdG8gVHJhbnNhY3Rpb24nfVxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgKX1cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICB7LyogUEFSVCA1OiBNb2RhbCB3aGVuIGJsb2NraW5nIGVuYWJsZSB2YXJpYXRpb25zIChwYXJlbnQtbGV2ZWwgc3RvY2sgZXhpc3RzKSAqL31cclxuICAgICAgPERpYWxvZyBvcGVuPXtibG9ja1ZhcmlhdGlvbnNNb2RhbE9wZW59IG9uT3BlbkNoYW5nZT17c2V0QmxvY2tWYXJpYXRpb25zTW9kYWxPcGVufT5cclxuICAgICAgICA8RGlhbG9nQ29udGVudCBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtYXgtdy1tZFwiPlxyXG4gICAgICAgICAgPERpYWxvZ0hlYWRlcj5cclxuICAgICAgICAgICAgPERpYWxvZ1RpdGxlIGNsYXNzTmFtZT1cInRleHQtd2hpdGVcIj5DYW5ub3QgZW5hYmxlIHZhcmlhdGlvbnM8L0RpYWxvZ1RpdGxlPlxyXG4gICAgICAgICAgPC9EaWFsb2dIZWFkZXI+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMzAwIHRleHQtc21cIj5cclxuICAgICAgICAgICAgUGFyZW50LWxldmVsIHN0b2NrIGV4aXN0cy4gQ2xlYXIgb3IgYWRqdXN0IHN0b2NrIGZpcnN0LlxyXG4gICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1ncmF5LTQwMCB0ZXh0LXhzIG10LTJcIj5cclxuICAgICAgICAgICAgQ2xlYXIgb3IgYWRqdXN0IHN0b2NrIGluIEludmVudG9yeSBmaXJzdCwgdGhlbiBhZGQgdmFyaWF0aW9ucy4gT3BlbmluZyBzdG9jayBmb3IgZWFjaCBzaXplL2NvbG9yIGNhbiBiZSBzZXQgaW4gdGhlIFZhcmlhdGlvbnMgdGFiIGFmdGVyIHNhdmluZy5cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICAgIDxEaWFsb2dGb290ZXIgY2xhc3NOYW1lPVwibXQtNFwiPlxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QmxvY2tWYXJpYXRpb25zTW9kYWxPcGVuKGZhbHNlKX1cclxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC13aGl0ZSByb3VuZGVkLWxnIHRleHQtc20gZm9udC1tZWRpdW1cIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgT0tcclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L0RpYWxvZ0Zvb3Rlcj5cclxuICAgICAgICA8L0RpYWxvZ0NvbnRlbnQ+XHJcbiAgICAgIDwvRGlhbG9nPlxyXG5cclxuICAgICAgPERpYWxvZyBvcGVuPXtibG9ja0Rpc2FibGVWYXJpYXRpb25zTW9kYWxPcGVufSBvbk9wZW5DaGFuZ2U9e3NldEJsb2NrRGlzYWJsZVZhcmlhdGlvbnNNb2RhbE9wZW59PlxyXG4gICAgICAgIDxEaWFsb2dDb250ZW50IGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG1heC13LW1kXCI+XHJcbiAgICAgICAgICA8RGlhbG9nSGVhZGVyPlxyXG4gICAgICAgICAgICA8RGlhbG9nVGl0bGUgY2xhc3NOYW1lPVwidGV4dC13aGl0ZVwiPkNhbm5vdCBkaXNhYmxlIHZhcmlhdGlvbnM8L0RpYWxvZ1RpdGxlPlxyXG4gICAgICAgICAgPC9EaWFsb2dIZWFkZXI+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMzAwIHRleHQtc21cIj5cclxuICAgICAgICAgICAgVmFyaWF0aW9uLWxldmVsIHN0b2NrIGV4aXN0cy4gQ2Fubm90IGRpc2FibGUgdmFyaWF0aW9ucyB1bnRpbCB2YXJpYXRpb24gc3RvY2sgaXMgY2xlYXJlZCBvciBhZGp1c3RlZC5cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICAgIDxEaWFsb2dGb290ZXIgY2xhc3NOYW1lPVwibXQtNFwiPlxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QmxvY2tEaXNhYmxlVmFyaWF0aW9uc01vZGFsT3BlbihmYWxzZSl9XHJcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIGJnLWdyYXktNzAwIGhvdmVyOmJnLWdyYXktNjAwIHRleHQtd2hpdGUgcm91bmRlZC1sZyB0ZXh0LXNtIGZvbnQtbWVkaXVtXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIE9LXHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9EaWFsb2dGb290ZXI+XHJcbiAgICAgICAgPC9EaWFsb2dDb250ZW50PlxyXG4gICAgICA8L0RpYWxvZz5cclxuXHJcbiAgICAgIHsvKiBQQVJUIDY6IE1vZGFsIHdoZW4gYmxvY2tpbmcgZW5hYmxlIGNvbWJvIChwYXJlbnQtbGV2ZWwgc3RvY2sgZXhpc3RzKSAqL31cclxuICAgICAgPERpYWxvZyBvcGVuPXtibG9ja0VuYWJsZUNvbWJvTW9kYWxPcGVufSBvbk9wZW5DaGFuZ2U9e3NldEJsb2NrRW5hYmxlQ29tYm9Nb2RhbE9wZW59PlxyXG4gICAgICAgIDxEaWFsb2dDb250ZW50IGNsYXNzTmFtZT1cImJnLWdyYXktOTAwIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXdoaXRlIG1heC13LW1kXCI+XHJcbiAgICAgICAgICA8RGlhbG9nSGVhZGVyPlxyXG4gICAgICAgICAgICA8RGlhbG9nVGl0bGUgY2xhc3NOYW1lPVwidGV4dC13aGl0ZVwiPkNhbm5vdCBlbmFibGUgY29tYm88L0RpYWxvZ1RpdGxlPlxyXG4gICAgICAgICAgPC9EaWFsb2dIZWFkZXI+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktMzAwIHRleHQtc21cIj5cclxuICAgICAgICAgICAgVGhpcyBwcm9kdWN0IGFscmVhZHkgaGFzIHN0b2NrLiBDbGVhciBzdG9jayBiZWZvcmUgZW5hYmxpbmcgQ29tYm8gbW9kZS5cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDAgdGV4dC14cyBtdC0yXCI+XHJcbiAgICAgICAgICAgIENsZWFyIG9yIGFkanVzdCBzdG9jayBpbiBJbnZlbnRvcnkgZmlyc3QsIHRoZW4gZW5hYmxlIENvbWJvIG1vZGUuIENvbWJvIHByb2R1Y3RzIGRvIG5vdCBob2xkIHN0b2NrIC0gc3RvY2sgaXMgbWFuYWdlZCB0aHJvdWdoIGNvbXBvbmVudCBwcm9kdWN0cy5cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICAgIDxEaWFsb2dGb290ZXIgY2xhc3NOYW1lPVwibXQtNFwiPlxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0QmxvY2tFbmFibGVDb21ib01vZGFsT3BlbihmYWxzZSl9XHJcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIGJnLWdyYXktNzAwIGhvdmVyOmJnLWdyYXktNjAwIHRleHQtd2hpdGUgcm91bmRlZC1sZyB0ZXh0LXNtIGZvbnQtbWVkaXVtXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIE9LXHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9EaWFsb2dGb290ZXI+XHJcbiAgICAgICAgPC9EaWFsb2dDb250ZW50PlxyXG4gICAgICA8L0RpYWxvZz5cclxuXHJcbiAgICAgIHsvKiBQQVJUIDc6IE1vZGFsIHdoZW4gYmxvY2tpbmcgZGlzYWJsZSBjb21ibyAoY29tYm8gaXRlbXMgZXhpc3QpICovfVxyXG4gICAgICA8RGlhbG9nIG9wZW49e2Jsb2NrRGlzYWJsZUNvbWJvTW9kYWxPcGVufSBvbk9wZW5DaGFuZ2U9e3NldEJsb2NrRGlzYWJsZUNvbWJvTW9kYWxPcGVufT5cclxuICAgICAgICA8RGlhbG9nQ29udGVudCBjbGFzc05hbWU9XCJiZy1ncmF5LTkwMCBib3JkZXItZ3JheS03MDAgdGV4dC13aGl0ZSBtYXgtdy1tZFwiPlxyXG4gICAgICAgICAgPERpYWxvZ0hlYWRlcj5cclxuICAgICAgICAgICAgPERpYWxvZ1RpdGxlIGNsYXNzTmFtZT1cInRleHQtd2hpdGVcIj5DYW5ub3QgZGlzYWJsZSBjb21ibzwvRGlhbG9nVGl0bGU+XHJcbiAgICAgICAgICA8L0RpYWxvZ0hlYWRlcj5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS0zMDAgdGV4dC1zbVwiPlxyXG4gICAgICAgICAgICBUaGlzIHByb2R1Y3QgaGFzIGNvbWJvIGNvbXBvbmVudHMuIFJlbW92ZSB0aGVtIGJlZm9yZSBkaXNhYmxpbmcgQ29tYm8gbW9kZS5cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS00MDAgdGV4dC14cyBtdC0yXCI+XHJcbiAgICAgICAgICAgIERlbGV0ZSBhbGwgY29tYm8gaXRlbXMgaW4gdGhlIENvbWJvcyB0YWIgZmlyc3QsIHRoZW4geW91IGNhbiBkaXNhYmxlIENvbWJvIG1vZGUuXHJcbiAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICA8RGlhbG9nRm9vdGVyIGNsYXNzTmFtZT1cIm10LTRcIj5cclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEJsb2NrRGlzYWJsZUNvbWJvTW9kYWxPcGVuKGZhbHNlKX1cclxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTIgYmctZ3JheS03MDAgaG92ZXI6YmctZ3JheS02MDAgdGV4dC13aGl0ZSByb3VuZGVkLWxnIHRleHQtc20gZm9udC1tZWRpdW1cIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgT0tcclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICA8L0RpYWxvZ0Zvb3Rlcj5cclxuICAgICAgICA8L0RpYWxvZ0NvbnRlbnQ+XHJcbiAgICAgIDwvRGlhbG9nPlxyXG4gICAgPC9kaXY+XHJcbiAgKTtcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IEVuaGFuY2VkUHJvZHVjdEZvcm07XHJcbiJdLCJmaWxlIjoiQzovVXNlcnMvbmRtMzEvZGV2L0NvcnVzci9ORVcgUE9TVjMvc3JjL2FwcC9jb21wb25lbnRzL3Byb2R1Y3RzL0VuaGFuY2VkUHJvZHVjdEZvcm0udHN4In0=