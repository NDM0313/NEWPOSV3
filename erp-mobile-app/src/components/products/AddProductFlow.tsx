import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, Image as ImageIcon, Package, Plus, RefreshCcw, Save, Trash2, X } from 'lucide-react';
import type { Product } from '../../api/products';
import * as productCategoriesApi from '../../api/productCategories';
import * as brandsApi from '../../api/brands';
import * as unitsApi from '../../api/units';
import * as productsApi from '../../api/products';
import * as variationLibrary from '../../api/variationLibrary';
import type { AttributeWithValues } from '../../api/variationLibrary';

export interface AddProductFlowSavePayload {
  id?: string;
  sku: string;
  name: string;
  category: string;
  categoryId?: string | null;
  brandId?: string | null;
  costPrice: number;
  retailPrice: number;
  stock: number;
  unit: string;
  unitId?: string | null;
  status: 'active' | 'inactive';
  description?: string;
  barcode?: string;
  minStock?: number;
  wholesalePrice?: number;
  hasVariations?: boolean;
  variations?: { sku: string; attributes: Record<string, string>; price: number; stock: number }[];
  /** Newly selected image files to upload after the product is persisted. */
  imageFiles?: File[];
  /** Already-uploaded image URLs to keep (edit flow). */
  existingImageUrls?: string[];
  /** Combo item lines. */
  isCombo?: boolean;
  comboItems?: Array<{ productId: string; variationId?: string | null; name: string; quantity: number; unitPrice: number }>;
}

interface AddProductFlowProps {
  onClose: () => void;
  onSave: (payload: AddProductFlowSavePayload) => void;
  product?: Product | null;
  companyId?: string | null;
  branchId?: string | null;
  saving?: boolean;
  error?: string;
}

const FALLBACK_UNITS = ['Piece', 'Meter', 'Yard', 'Set', 'Pair', 'Dozen'];

export function AddProductFlow({ onClose, onSave, product: editProduct, companyId, branchId, saving, error }: AddProductFlowProps) {
  const [categories, setCategories] = useState<productCategoriesApi.ProductCategory[]>([]);
  const [brands, setBrands] = useState<brandsApi.Brand[]>([]);
  const [units, setUnits] = useState<unitsApi.Unit[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  const [formData, setFormData] = useState({
    sku: editProduct?.sku || '',
    name: editProduct?.name || '',
    categoryId: (editProduct as Product & { categoryId?: string })?.categoryId || '',
    category: editProduct?.category || '',
    brandId: (editProduct as Product & { brandId?: string })?.brandId || '',
    description: (editProduct as { description?: string })?.description || '',
    costPrice: editProduct ? String(editProduct.costPrice) : '',
    retailPrice: editProduct ? String(editProduct.retailPrice) : '',
    wholesalePrice: (editProduct as { wholesalePrice?: number })?.wholesalePrice ? String((editProduct as { wholesalePrice?: number }).wholesalePrice) : '',
    stock: editProduct ? String(editProduct.stock) : '',
    minStock: (editProduct as { minStock?: number })?.minStock ? String((editProduct as { minStock?: number }).minStock) : '',
    unitId: (editProduct as Product & { unitId?: string })?.unitId || '',
    unit: editProduct?.unit || 'Piece',
    barcode: (editProduct as { barcode?: string })?.barcode || '',
    status: (editProduct?.status || 'active') as 'active' | 'inactive',
    hasVariations: (editProduct as { hasVariations?: boolean })?.hasVariations || false,
  });

  // Image upload state (mobile parity with web EnhancedProductForm)
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(
    Array.isArray((editProduct as { imageUrls?: string[] } | undefined)?.imageUrls)
      ? ((editProduct as { imageUrls?: string[] }).imageUrls as string[])
      : [],
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Combo product state
  const [isCombo, setIsCombo] = useState<boolean>(
    Boolean((editProduct as { isCombo?: boolean } | undefined)?.isCombo),
  );
  const [comboItems, setComboItems] = useState<
    Array<{ productId: string; variationId?: string | null; name: string; quantity: number; unitPrice: number }>
  >([]);
  const [comboProductPicker, setComboProductPicker] = useState<boolean>(false);
  const [availableComboProducts, setAvailableComboProducts] = useState<productsApi.Product[]>([]);

  // Global variation library (company-level attribute suggestions)
  const [library, setLibrary] = useState<AttributeWithValues[]>([]);
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void variationLibrary
      .listAttributes(companyId)
      .then((rows) => {
        if (!cancelled) setLibrary(rows);
      })
      .catch((e) => {
        if (!cancelled) console.warn('[AddProductFlow] variation library load failed:', e);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Web ERP style: dynamic attributes + generated variations
  const [variantAttributes, setVariantAttributes] = useState<Array<{ name: string; values: string[] }>>([]);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [selectedAttributeIndex, setSelectedAttributeIndex] = useState<number | null>(null);
  const [generatedVariations, setGeneratedVariations] = useState<Array<{
    combination: Record<string, string>;
    sku: string;
    price: number;
    stock: number;
    barcode: string;
  }>>([]);
  const [productsWithVariations, setProductsWithVariations] = useState<Array<{ id: string; name: string; variations?: Array<{ attributes?: Record<string, string> }> }>>([]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    Promise.all([
      productCategoriesApi.getCategories(companyId),
      brandsApi.getBrands(companyId),
      unitsApi.getUnits(companyId),
    ]).then(([catRes, brandRes, unitRes]) => {
      if (cancelled) return;
      if (catRes.data) setCategories(catRes.data);
      if (brandRes.data) setBrands(brandRes.data);
      if (unitRes.data) setUnits(unitRes.data);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  // Auto-fill SKU with next number (PRD-0001 format, same as web ERP) when creating new product
  useEffect(() => {
    if (editProduct || !companyId) return;
    let cancelled = false;
    productsApi.getNextProductSKU(companyId, branchId ?? null).then((sku) => {
      if (cancelled) return;
      setFormData((prev) => (prev.sku ? prev : { ...prev, sku })); // Only set if user hasn't typed
    });
    return () => { cancelled = true; };
  }, [companyId, branchId, editProduct]);

  // Load products with variations for "copy from" (when variations enabled)
  useEffect(() => {
    if (!companyId || !formData.hasVariations) return;
    let cancelled = false;
    productsApi.getProducts(companyId).then(({ data }) => {
      if (cancelled) return;
      const withVars = (data || []).filter(
        (p) => p.hasVariations && (p.variations?.length ?? 0) > 0
      );
      setProductsWithVariations(
        withVars.map((p) => ({ id: p.id, name: p.name, variations: p.variations }))
      );
    });
    return () => { cancelled = true; };
  }, [companyId, formData.hasVariations]);

  // Hydrate from editProduct when it has variations
  useEffect(() => {
    if (!editProduct?.hasVariations || !(editProduct as Product & { variations?: Array<{ attributes?: Record<string, string> }> }).variations?.length) return;
    const vars = (editProduct as Product & { variations?: Array<{ attributes?: Record<string, string> }> }).variations || [];
    const attrMap: Record<string, Set<string>> = {};
    for (const v of vars) {
      const attrs = v.attributes || {};
      for (const [key, val] of Object.entries(attrs)) {
        if (!key || val == null) continue;
        if (!attrMap[key]) attrMap[key] = new Set();
        attrMap[key].add(String(val));
      }
    }
    const derived = Object.entries(attrMap).map(([name, set]) => ({ name, values: Array.from(set).sort() }));
    if (derived.length > 0) setVariantAttributes(derived);
  }, [editProduct?.id]);

  const unitOptions = units.length > 0 ? units : FALLBACK_UNITS.map((u) => ({ id: '', name: u }));

  const handleAddCategory = async () => {
    if (!companyId || !newCategoryName.trim()) return;
    const { data, error } = await productCategoriesApi.createCategory(companyId, newCategoryName.trim());
    if (error) return;
    if (data) {
      setCategories((prev) => [...prev, data]);
      setFormData((prev) => ({ ...prev, categoryId: data.id, category: data.name }));
      setNewCategoryName('');
      setShowAddCategory(false);
    }
  };

  const handleAddBrand = async () => {
    if (!companyId || !newBrandName.trim()) return;
    const { data, error } = await brandsApi.createBrand(companyId, newBrandName.trim());
    if (error) return;
    if (data) {
      setBrands((prev) => [...prev, data]);
      setFormData((prev) => ({ ...prev, brandId: data.id }));
      setNewBrandName('');
      setShowAddBrand(false);
    }
  };

  const handleAddUnit = async () => {
    if (!companyId || !newUnitName.trim()) return;
    const { data, error } = await unitsApi.createUnit(companyId, newUnitName.trim());
    if (error) return;
    if (data) {
      setUnits((prev) => [...prev, data]);
      setFormData((prev) => ({ ...prev, unitId: data.id, unit: data.name }));
      setNewUnitName('');
      setShowAddUnit(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean | { sizes: string[]; colors: string[]; fabrics: string[] }) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const MAX_VARIATIONS = 100;

  const addVariantAttribute = () => {
    if (newAttributeName.trim() && !variantAttributes.some((a) => a.name === newAttributeName.trim())) {
      setVariantAttributes([...variantAttributes, { name: newAttributeName.trim(), values: [] }]);
      setNewAttributeName('');
    }
  };

  const addAttributeValue = (attrIndex?: number) => {
    const idx = attrIndex ?? selectedAttributeIndex;
    if (idx !== null && newAttributeValue.trim()) {
      const updated = [...variantAttributes];
      if (!updated[idx].values.includes(newAttributeValue.trim())) {
        updated[idx].values.push(newAttributeValue.trim());
        setVariantAttributes(updated);
        setNewAttributeValue('');
      }
    }
  };

  const removeVariantAttribute = (attrName: string) => {
    setVariantAttributes(variantAttributes.filter((a) => a.name !== attrName));
    setGeneratedVariations([]);
  };

  const removeAttributeValue = (attrIndex: number, valueIndex: number) => {
    const updated = [...variantAttributes];
    updated[attrIndex].values.splice(valueIndex, 1);
    setVariantAttributes(updated);
    setGeneratedVariations([]);
  };

  const cartesianProduct = (arrays: string[][]): string[][] => {
    if (arrays.length === 0) return [[]];
    return arrays.reduce((a, b) => a.flatMap((d) => b.map((e) => [...(Array.isArray(d) ? d : [d]), e])), [[]] as string[][]);
  };

  const generateVariations = () => {
    const attributeValues = variantAttributes.map((a) => a.values);
    const combinations = cartesianProduct(attributeValues);
    if (combinations.length > MAX_VARIATIONS) return;
    const baseSku = (formData.sku || `PRD-${String(Date.now()).slice(-4)}`).trim();
    const retailPrice = parseFloat(formData.retailPrice) || 0;
    const totalStock = parseInt(formData.stock, 10) || 0;
    const perVar = Math.max(0, Math.floor(totalStock / combinations.length)) || 0;
    const newVars = combinations.map((combo, i) => {
      const combination: Record<string, string> = {};
      variantAttributes.forEach((attr, j) => { combination[attr.name] = combo[j]; });
      return {
        combination,
        sku: `${baseSku}-V${i + 1}`,
        price: retailPrice,
        stock: perVar,
        barcode: '',
      };
    });
    setGeneratedVariations(newVars);
  };

  const copyAttributesFromProduct = (product: { variations?: Array<{ attributes?: Record<string, string> }> }) => {
    const vars = product.variations || [];
    if (vars.length === 0) return;
    const attrMap: Record<string, Set<string>> = {};
    for (const v of vars) {
      for (const [key, val] of Object.entries(v.attributes || {})) {
        if (!key || val == null) continue;
        if (!attrMap[key]) attrMap[key] = new Set();
        attrMap[key].add(String(val));
      }
    }
    const derived = Object.entries(attrMap).map(([name, set]) => ({ name, values: Array.from(set).sort() }));
    if (derived.length > 0) {
      setVariantAttributes(derived);
      setGeneratedVariations([]);
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    if (!formData.retailPrice || parseFloat(formData.retailPrice) <= 0) return;

    const costPrice = parseFloat(formData.costPrice) || 0;
    const retailPrice = parseFloat(formData.retailPrice);
    const wholesalePrice = formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : retailPrice;
    const stock = parseInt(formData.stock, 10) || 0;
    const minStock = parseInt(formData.minStock, 10) || 0;

    const categoryName = categories.find((c) => c.id === formData.categoryId)?.name ?? formData.category;
    const unitName = unitOptions.find((u) => u.id === formData.unitId || u.name === formData.unit)?.name ?? formData.unit;

    if (editProduct) {
      onSave({
        id: editProduct.id,
        sku: formData.sku || editProduct.sku,
        name: formData.name,
        category: categoryName,
        categoryId: formData.categoryId || null,
        brandId: formData.brandId || null,
        unitId: formData.unitId || null,
        costPrice,
        retailPrice,
        stock,
        unit: unitName,
        status: formData.status,
        description: formData.description || undefined,
        barcode: formData.barcode || undefined,
        minStock,
        wholesalePrice,
        imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
        existingImageUrls,
        isCombo,
        comboItems: isCombo ? comboItems : undefined,
      });
    } else {
      const variations: { sku: string; attributes: Record<string, string>; price: number; stock: number }[] = [];
      if (formData.hasVariations && generatedVariations.length > 0) {
        for (const v of generatedVariations) {
          variations.push({
            sku: v.sku,
            attributes: v.combination,
            price: v.price,
            stock: v.stock,
          });
        }
      }
      const baseSku = formData.sku || `PRD-${String(Date.now()).slice(-4)}`;
      const totalStock = formData.hasVariations && generatedVariations.length > 0
        ? generatedVariations.reduce((s, v) => s + v.stock, 0)
        : stock;
      onSave({
        sku: baseSku,
        name: formData.name,
        category: categoryName,
        categoryId: formData.categoryId || null,
        brandId: formData.brandId || null,
        unitId: formData.unitId || null,
        costPrice,
        retailPrice,
        stock: formData.hasVariations ? 0 : totalStock,
        unit: unitName,
        status: formData.status,
        description: formData.description || undefined,
        barcode: formData.barcode || undefined,
        minStock,
        wholesalePrice,
        hasVariations: formData.hasVariations,
        variations: formData.hasVariations ? variations : undefined,
        imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
        isCombo,
        comboItems: isCombo ? comboItems : undefined,
      });
    }
  };

  const handleImagePick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setImageFiles((prev) => [...prev, ...arr].slice(0, 8));
    arr.forEach((f) => {
      const url = URL.createObjectURL(f);
      setImagePreviews((prev) => [...prev, url].slice(0, 8));
    });
  };
  const removePickedImage = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };
  const removeExistingImage = (idx: number) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (!comboProductPicker || !companyId) return;
    void (async () => {
      const { data } = await productsApi.getProducts(companyId);
      setAvailableComboProducts(data ?? []);
    })();
  }, [comboProductPicker, companyId]);

  const addComboItem = (prod: productsApi.Product) => {
    setComboItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        variationId: null,
        name: prod.name,
        quantity: 1,
        unitPrice: Number(prod.retailPrice) || 0,
      },
    ]);
    setComboProductPicker(false);
  };
  const updateComboItem = (idx: number, patch: Partial<{ quantity: number; unitPrice: number }>) => {
    setComboItems((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const removeComboItem = (idx: number) => {
    setComboItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 bg-[#111827] z-50 overflow-y-auto pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">
              {editProduct ? 'Edit Product' : 'Add New Product'}
            </h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={
              !formData.name.trim() ||
              !formData.retailPrice ||
              parseFloat(formData.retailPrice) <= 0 ||
              saving ||
              (formData.hasVariations && generatedVariations.length === 0)
            }
            className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-medium transition-colors"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Basic Information</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter product name"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                  placeholder="Auto-generated"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Category</label>
                {showAddCategory ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      className="flex-1 h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                      autoFocus
                    />
                    <button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="h-12 px-4 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] text-white rounded-lg font-medium">
                      Add
                    </button>
                    <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="h-12 px-4 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={formData.categoryId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__add__') setShowAddCategory(true);
                        else {
                          const cat = categories.find((c) => c.id === v);
                          setFormData((prev) => ({ ...prev, categoryId: v || '', category: cat?.name ?? '' }));
                        }
                      }}
                      className="flex-1 h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat, i) => (
                        <option key={cat?.id ?? `cat-${i}`} value={String(cat?.id ?? '')}>{String(cat?.name ?? '')}</option>
                      ))}
                      <option value="__add__">+ Add new category</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Brand</label>
              {showAddBrand ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="New brand name"
                    className="flex-1 h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                    autoFocus
                  />
                  <button type="button" onClick={handleAddBrand} disabled={!newBrandName.trim()} className="h-12 px-4 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] text-white rounded-lg font-medium">
                    Add
                  </button>
                  <button type="button" onClick={() => { setShowAddBrand(false); setNewBrandName(''); }} className="h-12 px-4 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <select
                  value={formData.brandId || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__add__') setShowAddBrand(true);
                    else setFormData((prev) => ({ ...prev, brandId: v || '' }));
                  }}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#3B82F6]"
                >
                  <option value="">Select brand (optional)</option>
                  {brands.map((b, i) => (
                    <option key={b?.id ?? `brand-${i}`} value={String(b?.id ?? '')}>{String(b?.name ?? '')}</option>
                  ))}
                  <option value="__add__">+ Add new brand</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => handleInputChange('barcode', e.target.value)}
                placeholder="Optional barcode"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Description</h3>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Enter product description"
            className="w-full h-24 bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Pricing</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Cost Price</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={formData.costPrice}
                onChange={(e) => handleInputChange('costPrice', e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Retail Price *</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={formData.retailPrice}
                onChange={(e) => handleInputChange('retailPrice', e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Wholesale Price</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={formData.wholesalePrice}
                onChange={(e) => handleInputChange('wholesalePrice', e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Inventory</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Current Stock</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', e.target.value)}
                  placeholder="0"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Min Stock</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.minStock}
                  onChange={(e) => handleInputChange('minStock', e.target.value)}
                  placeholder="0"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Unit</label>
              {showAddUnit ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="New unit (e.g. Meter, Yard)"
                    className="flex-1 h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                    autoFocus
                  />
                  <button type="button" onClick={handleAddUnit} disabled={!newUnitName.trim()} className="h-12 px-4 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] text-white rounded-lg font-medium">
                    Add
                  </button>
                  <button type="button" onClick={() => { setShowAddUnit(false); setNewUnitName(''); }} className="h-12 px-4 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <select
                  value={formData.unitId || formData.unit || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__add__') setShowAddUnit(true);
                    else {
                      const u = unitOptions.find((o) => o.id === v || o.name === v);
                      setFormData((prev) => ({ ...prev, unitId: u?.id || '', unit: u?.name ?? 'Piece' }));
                    }
                  }}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#3B82F6]"
                >
                  {unitOptions.map((u, i) => (
                    <option key={String(u?.id || u?.name || `unit-${i}`)} value={String(u?.id || u?.name || '')}>{String(u?.name ?? '')}</option>
                  ))}
                  <option value="__add__">+ Add new unit</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {!editProduct && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Product Variations</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasVariations}
                  onChange={(e) => handleInputChange('hasVariations', e.target.checked)}
                  className="w-4 h-4 rounded border-[#374151] bg-[#111827] text-[#3B82F6]"
                />
                <span className="text-sm text-[#9CA3AF]">Enable</span>
              </label>
            </div>
            {formData.hasVariations && (
              <div className="space-y-4">
                <p className="text-xs text-[#9CA3AF]">Same as Web ERP: Add attributes (Size, Color, Fabric, etc.) and values, then generate variations.</p>

                {/* Copy from existing product */}
                {productsWithVariations.length > 0 && (
                  <div>
                    <label className="block text-sm text-[#9CA3AF] mb-2">Copy from existing product</label>
                    <select
                      onChange={(e) => {
                        const id = e.target.value;
                        e.target.value = '';
                        if (!id) return;
                        const p = productsWithVariations.find((x) => x.id === id);
                        if (p) copyAttributesFromProduct(p);
                      }}
                      className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="">Select product to copy attributes...</option>
                      {productsWithVariations.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.variations?.length ?? 0} vars)</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Step 1: Add New Attribute */}
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Add New Attribute (e.g., Size, Color, Fabric)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAttributeName}
                      onChange={(e) => setNewAttributeName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVariantAttribute())}
                      placeholder="Attribute name"
                      className="flex-1 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                    />
                    <button
                      type="button"
                      onClick={addVariantAttribute}
                      className="h-10 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>
                  {library.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] text-[#6B7280] uppercase tracking-wider mr-1 self-center">From library:</span>
                      {library
                        .filter((a) => !variantAttributes.some((va) => va.name.toLowerCase() === a.name.toLowerCase()))
                        .filter((a) =>
                          newAttributeName.trim()
                            ? a.name.toLowerCase().includes(newAttributeName.trim().toLowerCase())
                            : true,
                        )
                        .slice(0, 6)
                        .map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setVariantAttributes([
                                ...variantAttributes,
                                { name: a.name, values: [] },
                              ]);
                              setNewAttributeName('');
                            }}
                            className="px-2 py-0.5 rounded-full bg-[#1F2937] border border-[#374151] text-xs text-[#9CA3AF] hover:bg-[#3B82F6]/20 hover:text-[#60A5FA]"
                          >
                            {a.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Display Attributes + Values */}
                {variantAttributes.map((attr, attrIndex) => (
                  <div key={attr.name} className="bg-[#111827] border border-[#374151] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-white">{attr.name} ({attr.values.length})</h4>
                      <button
                        type="button"
                        onClick={() => removeVariantAttribute(attr.name)}
                        className="p-1 text-[#EF4444] hover:bg-[#EF4444]/20 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={selectedAttributeIndex === attrIndex ? newAttributeValue : ''}
                        onFocus={() => setSelectedAttributeIndex(attrIndex)}
                        onChange={(e) => setNewAttributeValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAttributeValue(attrIndex))}
                        placeholder={`Add ${attr.name} value`}
                        className="flex-1 h-9 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                      />
                      <button
                        type="button"
                        onClick={() => { setSelectedAttributeIndex(attrIndex); addAttributeValue(attrIndex); }}
                        className="h-9 px-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-sm"
                      >
                        Add Value
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attr.values.map((val, vi) => (
                        <span
                          key={val}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-[#374151] rounded text-xs text-white"
                        >
                          {val}
                          <button type="button" onClick={() => removeAttributeValue(attrIndex, vi)} className="text-[#9CA3AF] hover:text-[#EF4444]">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    {(() => {
                      const libEntry = library.find((l) => l.name.toLowerCase() === attr.name.toLowerCase());
                      const suggestions = (libEntry?.values || [])
                        .filter((v) => !attr.values.some((av) => av.toLowerCase() === v.value.toLowerCase()))
                        .filter((v) =>
                          selectedAttributeIndex === attrIndex && newAttributeValue.trim()
                            ? v.value.toLowerCase().includes(newAttributeValue.trim().toLowerCase())
                            : true,
                        )
                        .slice(0, 8);
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="text-[10px] text-[#6B7280] uppercase tracking-wider mr-1 self-center">Suggestions:</span>
                          {suggestions.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                const updated = [...variantAttributes];
                                if (!updated[attrIndex].values.includes(v.value)) {
                                  updated[attrIndex].values.push(v.value);
                                  setVariantAttributes(updated);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1F2937] border border-[#374151] text-xs text-[#9CA3AF] hover:bg-[#3B82F6]/20 hover:text-[#60A5FA]"
                            >
                              {v.hex_color && (
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full border border-white/10"
                                  style={{ backgroundColor: v.hex_color }}
                                />
                              )}
                              {v.value}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ))}

                {/* Step 2: Generate Variations */}
                {variantAttributes.length > 0 && variantAttributes.every((a) => a.values.length > 0) && (
                  <div>
                    <label className="block text-sm text-[#9CA3AF] mb-2">Step 2: Generate Variations</label>
                    <button
                      type="button"
                      onClick={generateVariations}
                      disabled={variantAttributes.reduce((a, b) => a * b.values.length, 1) > MAX_VARIATIONS}
                      className="w-full h-11 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <RefreshCcw size={18} />
                      Generate {variantAttributes.reduce((a, b) => a * b.values.length, 1)} Variations
                    </button>
                    <p className="text-xs text-[#6B7280] mt-1">
                      {generatedVariations.length} / {MAX_VARIATIONS} variations
                    </p>
                  </div>
                )}

                {/* Generated Variations List */}
                {generatedVariations.length > 0 && (
                  <div className="bg-[#111827] border border-[#374151] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <div className="sticky top-0 bg-[#1F2937] px-3 py-2 text-xs font-medium text-[#9CA3AF] border-b border-[#374151]">
                      Generated Variations
                    </div>
                    <div className="divide-y divide-[#374151]">
                      {generatedVariations.slice(0, 20).map((v, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-white truncate">
                            {Object.entries(v.combination).map(([k, val]) => `${k}: ${val}`).join(' • ')}
                          </span>
                          <span className="text-[#10B981] shrink-0">Rs. {v.price.toLocaleString()}</span>
                        </div>
                      ))}
                      {generatedVariations.length > 20 && (
                        <div className="px-3 py-2 text-xs text-[#6B7280]">
                          +{generatedVariations.length - 20} more
                        </div>
                      )}
                    </div>
                    <p className="px-3 py-2 text-xs text-[#6B7280] border-t border-[#374151]">
                      Price from Retail Price. Stock split across variations. Re-generate after changing prices.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Images */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Product Images</h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-medium"
            >
              <Camera size={14} /> Add
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleImagePick(e.target.files);
              if (e.target) e.target.value = '';
            }}
          />
          {existingImageUrls.length === 0 && imagePreviews.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-28 rounded-lg border-2 border-dashed border-[#374151] bg-[#111827] flex flex-col items-center justify-center gap-1 text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6]"
            >
              <ImageIcon size={24} />
              <span className="text-xs">Tap to add product pictures</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {existingImageUrls.map((url, idx) => (
                <div key={`existing-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-[#111827]">
                  <img src={url} alt="Product" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {imagePreviews.map((url, idx) => (
                <div key={`new-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-[#111827] ring-2 ring-[#3B82F6]/50">
                  <img src={url} alt="New" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePickedImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Combo Product */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Combo Product</h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isCombo}
                onChange={(e) => setIsCombo(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#374151] peer-checked:bg-[#10B981] rounded-full transition-colors peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>
          {isCombo && (
            <>
              <p className="text-xs text-[#9CA3AF] mb-3">
                A combo product bundles multiple products into one SKU. Stock is managed at the component level.
              </p>
              <div className="space-y-2">
                {comboItems.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`} className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.name}</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateComboItem(idx, { quantity: Number(e.target.value) || 0 })}
                      className="w-16 h-9 rounded bg-[#1F2937] border border-[#374151] text-white text-xs px-2"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateComboItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                      className="w-20 h-9 rounded bg-[#1F2937] border border-[#374151] text-white text-xs px-2"
                    />
                    <button
                      type="button"
                      onClick={() => removeComboItem(idx)}
                      className="p-1 text-[#EF4444] hover:bg-[#374151] rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setComboProductPicker(true)}
                  className="w-full h-10 rounded-lg border border-dashed border-[#374151] text-[#3B82F6] text-sm font-medium hover:border-[#3B82F6]"
                >
                  + Add component
                </button>
              </div>
            </>
          )}
        </div>

        {comboProductPicker && (
          <div
            className="fixed inset-0 z-[90] bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={() => setComboProductPicker(false)}
          >
            <div
              className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[#374151] flex items-center justify-between">
                <h3 className="text-white font-semibold">Select Component</h3>
                <button onClick={() => setComboProductPicker(false)} className="p-1 text-[#9CA3AF] hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {availableComboProducts.length === 0 ? (
                  <p className="p-4 text-sm text-[#9CA3AF]">Loading products...</p>
                ) : (
                  availableComboProducts
                    .filter((p) => p.id !== editProduct?.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addComboItem(p)}
                        className="w-full px-4 py-3 text-left border-b border-[#374151] hover:bg-[#111827]"
                      >
                        <p className="text-sm text-white">{p.name}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          {p.sku} • Rs. {Number(p.retailPrice).toLocaleString()}
                        </p>
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Status</h3>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleInputChange('status', 'active')}
              className={`flex-1 h-12 rounded-lg font-medium transition-colors ${
                formData.status === 'active' ? 'bg-[#10B981] text-white' : 'bg-[#111827] border border-[#374151] text-[#9CA3AF]'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => handleInputChange('status', 'inactive')}
              className={`flex-1 h-12 rounded-lg font-medium transition-colors ${
                formData.status === 'inactive' ? 'bg-[#EF4444] text-white' : 'bg-[#111827] border border-[#374151] text-[#9CA3AF]'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={
            !formData.name.trim() ||
            !formData.retailPrice ||
            parseFloat(formData.retailPrice) <= 0 ||
            saving ||
            (formData.hasVariations && generatedVariations.length === 0)
          }
          className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] text-white rounded-lg font-semibold transition-colors"
        >
          {saving ? 'Saving...' : editProduct ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </div>
  );
}
