/**
 * Settings → Inventory: Masters (Units, Categories, Sub-Categories, Brands)
 * List, Add, Edit, Activate/Deactivate per master.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Package, Ruler, FolderTree, FolderOpen, Tag, Plus, Edit, Power, PowerOff, Loader2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useSupabase } from '@/app/context/SupabaseContext';
import { unitService, type Unit } from '@/app/services/unitService';
import { brandService, type Brand } from '@/app/services/brandService';
import { productCategoryService, type ProductCategory } from '@/app/services/productCategoryService';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';

export type InventoryMasterTab = 'general' | 'units' | 'categories' | 'sub-categories' | 'brands';

interface InventoryMastersProps {
  /** Current sub-tab (from parent when embedded in Settings) */
  activeSubTab: InventoryMasterTab;
  onSubTabChange: (tab: InventoryMasterTab) => void;
  /** General settings content (low stock, valuation, etc.) - rendered when activeSubTab === 'general' */
  generalContent: React.ReactNode;
}

const SUB_TABS: { id: InventoryMasterTab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Package },
  { id: 'units', label: 'Units', icon: Ruler },
  { id: 'categories', label: 'Categories', icon: FolderTree },
  { id: 'sub-categories', label: 'Sub-Categories', icon: FolderOpen },
  { id: 'brands', label: 'Brands', icon: Tag },
];

export function InventoryMasters({ activeSubTab, onSubTabChange, generalContent }: InventoryMastersProps) {
  const { companyId } = useSupabase();
  const [units, setUnits] = useState<Unit[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [subCategories, setSubCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModal, setAddModal] = useState<'unit' | 'brand' | 'category' | 'sub-category' | null>(null);
  const [editItem, setEditItem] = useState<Unit | Brand | ProductCategory | null>(null);
  const [formName, setFormName] = useState('');
  const [formSymbol, setFormSymbol] = useState('');
  const [formShortCode, setFormShortCode] = useState('');
  const [formAllowDecimal, setFormAllowDecimal] = useState(false);
  const [formParentId, setFormParentId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadUnits = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await unitService.getAll(companyId, { includeInactive: true });
      setUnits(data);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load units');
    }
  }, [companyId]);

  const loadBrands = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await brandService.getAll(companyId, { includeInactive: true });
      setBrands(data);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load brands');
    }
  }, [companyId]);

  const loadCategories = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await productCategoryService.getCategories(companyId, { includeInactive: true });
      setCategories(data);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load categories');
    }
  }, [companyId]);

  const loadSubCategories = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await productCategoryService.getAllCategoriesFlat(companyId, { includeInactive: true });
      setSubCategories(data.filter((c) => c.parent_id != null));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load sub-categories');
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([loadUnits(), loadBrands(), loadCategories(), loadSubCategories()]).finally(() =>
      setLoading(false)
    );
  }, [companyId, loadUnits, loadBrands, loadCategories, loadSubCategories]);

  useEffect(() => {
    if (activeSubTab === 'units') loadUnits();
    if (activeSubTab === 'brands') loadBrands();
    if (activeSubTab === 'categories') loadCategories();
    if (activeSubTab === 'sub-categories') loadSubCategories();
  }, [activeSubTab, loadUnits, loadBrands, loadCategories, loadSubCategories]);

  const openAdd = (type: 'unit' | 'brand' | 'category' | 'sub-category') => {
    setFormName('');
    setFormSymbol('');
    setFormShortCode('');
    setFormAllowDecimal(false);
    setFormParentId('');
    setEditItem(null);
    setAddModal(type);
  };

  const openEdit = (item: Unit | Brand | ProductCategory, type: 'unit' | 'brand' | 'category' | 'sub-category') => {
    setFormName(item.name);
    if (type === 'unit') {
      const unit = item as Unit;
      setFormSymbol(unit.symbol ?? '');
      setFormShortCode(unit.short_code ?? '');
      setFormAllowDecimal(unit.allow_decimal ?? false);
    } else {
      setFormSymbol('');
      setFormShortCode('');
      setFormAllowDecimal(false);
    }
    setFormParentId((item as ProductCategory).parent_id ?? '');
    setEditItem(item);
    setAddModal(type);
  };

  const closeModal = () => {
    setAddModal(null);
    setEditItem(null);
  };

  const saveUnit = async () => {
    if (!companyId || !formName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formShortCode.trim()) {
      toast.error('Short code is required (e.g., pcs, m, kg)');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        const unit = editItem as Unit;
        await unitService.update(unit.id, { 
          name: formName.trim(), 
          short_code: formShortCode.trim(),
          symbol: formSymbol.trim() || formShortCode.trim() || undefined,
          allow_decimal: formAllowDecimal
        });
        toast.success('Unit updated');
      } else {
        await unitService.create({ 
          company_id: companyId, 
          name: formName.trim(), 
          short_code: formShortCode.trim(),
          symbol: formSymbol.trim() || formShortCode.trim() || undefined,
          allow_decimal: formAllowDecimal
        });
        toast.success('Unit added');
      }
      closeModal();
      loadUnits();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveBrand = async () => {
    if (!companyId || !formName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await brandService.update((editItem as Brand).id, { name: formName.trim() });
        toast.success('Brand updated');
      } else {
        await brandService.create({ company_id: companyId, name: formName.trim() });
        toast.success('Brand added');
      }
      closeModal();
      loadBrands();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!companyId || !formName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await productCategoryService.update((editItem as ProductCategory).id, { name: formName.trim() });
        toast.success('Category updated');
      } else {
        await productCategoryService.create({ company_id: companyId, name: formName.trim(), parent_id: null });
        toast.success('Category added');
      }
      closeModal();
      loadCategories();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveSubCategory = async () => {
    if (!companyId || !formName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formParentId) {
      toast.error('Select a category');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await productCategoryService.update((editItem as ProductCategory).id, {
          name: formName.trim(),
          parent_id: formParentId,
        });
        toast.success('Sub-category updated');
      } else {
        await productCategoryService.create({
          company_id: companyId,
          name: formName.trim(),
          parent_id: formParentId,
        });
        toast.success('Sub-category added');
      }
      closeModal();
      loadSubCategories();
      loadCategories();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (
    type: 'unit' | 'brand' | 'category' | 'sub-category',
    item: Unit | Brand | ProductCategory,
    isActive: boolean
  ) => {
    try {
      if (type === 'unit') await unitService.setActive((item as Unit).id, isActive);
      if (type === 'brand') await brandService.setActive((item as Brand).id, isActive);
      if (type === 'category' || type === 'sub-category')
        await productCategoryService.setActive((item as ProductCategory).id, isActive);
      toast.success(isActive ? 'Activated' : 'Deactivated');
      loadUnits();
      loadBrands();
      loadCategories();
      loadSubCategories();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    }
  };

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeSubTab === tab.id
                ? 'bg-teal-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'general' && generalContent}

      {activeSubTab === 'units' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-white font-semibold">Units</h4>
            <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-500" onClick={() => openAdd('unit')}>
              <Plus size={14} /> Add Unit
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 size={18} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-950 text-gray-400 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Short Code</th>
                    <th className="p-3">Allow Decimal</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {units.map((u) => (
                    <tr key={u.id} className={cn("hover:bg-gray-800/30", u.is_default && "bg-blue-500/5")}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{u.name}</span>
                          {u.is_default && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Default</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-400 font-mono">{u.short_code || u.symbol || '—'}</td>
                      <td className="p-3">
                        <Badge className={u.allow_decimal ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                          {u.allow_decimal ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-gray-400 h-8" 
                          onClick={() => openEdit(u, 'unit')}
                          disabled={u.is_default}
                          title={u.is_default ? 'Default unit cannot be edited' : 'Edit unit'}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={u.is_active ? 'text-amber-400 h-8' : 'text-green-400 h-8'}
                          onClick={() => toggleActive('unit', u, !u.is_active)}
                          disabled={u.is_default}
                          title={u.is_default ? 'Default unit cannot be disabled' : u.is_active ? 'Disable unit' : 'Enable unit'}
                        >
                          {u.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                        </Button>
                        {!u.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 h-8"
                            onClick={async () => {
                              if (confirm(`Delete unit "${u.name}"? This cannot be undone.`)) {
                                try {
                                  await unitService.delete(u.id);
                                  toast.success('Unit deleted');
                                  loadUnits();
                                } catch (e: any) {
                                  toast.error(e?.message || 'Failed to delete');
                                }
                              }
                            }}
                            title="Delete unit"
                          >
                            <X size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {units.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No units. Add one to use in products.</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'categories' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-white font-semibold">Categories (parent level)</h4>
            <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-500" onClick={() => openAdd('category')}>
              <Plus size={14} /> Add Category
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 size={18} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-950 text-gray-400 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-800/30">
                      <td className="p-3 text-white">{c.name}</td>
                      <td className="p-3">
                        <Badge className={c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 flex gap-1">
                        <Button variant="ghost" size="sm" className="text-gray-400 h-8" onClick={() => openEdit(c, 'category')}>
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={c.is_active ? 'text-amber-400 h-8' : 'text-green-400 h-8'}
                          onClick={() => toggleActive('category', c, !c.is_active)}
                        >
                          {c.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categories.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No categories. Add one to link products.</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'sub-categories' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-white font-semibold">Sub-Categories (linked to category)</h4>
            <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-500" onClick={() => openAdd('sub-category')}>
              <Plus size={14} /> Add Sub-Category
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 size={18} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-950 text-gray-400 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {subCategories.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-800/30">
                      <td className="p-3 text-white">{c.name}</td>
                      <td className="p-3 text-gray-400">{getCategoryName(c.parent_id!)}</td>
                      <td className="p-3">
                        <Badge className={c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 flex gap-1">
                        <Button variant="ghost" size="sm" className="text-gray-400 h-8" onClick={() => openEdit(c, 'sub-category')}>
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={c.is_active ? 'text-amber-400 h-8' : 'text-green-400 h-8'}
                          onClick={() => toggleActive('sub-category', c, !c.is_active)}
                        >
                          {c.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {subCategories.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No sub-categories. Add categories first, then sub-categories.</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'brands' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-white font-semibold">Brands</h4>
            <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-500" onClick={() => openAdd('brand')}>
              <Plus size={14} /> Add Brand
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 size={18} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-950 text-gray-400 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {brands.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-800/30">
                      <td className="p-3 text-white">{b.name}</td>
                      <td className="p-3">
                        <Badge className={b.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                          {b.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 flex gap-1">
                        <Button variant="ghost" size="sm" className="text-gray-400 h-8" onClick={() => openEdit(b, 'brand')}>
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={b.is_active ? 'text-amber-400 h-8' : 'text-green-400 h-8'}
                          onClick={() => toggleActive('brand', b, !b.is_active)}
                        >
                          {b.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {brands.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No brands. Add one to assign to products.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit modals */}
      <Dialog open={addModal !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {addModal === 'unit' && (editItem ? 'Edit Unit' : 'Add Unit')}
              {addModal === 'brand' && (editItem ? 'Edit Brand' : 'Add Brand')}
              {addModal === 'category' && (editItem ? 'Edit Category' : 'Add Category')}
              {addModal === 'sub-category' && (editItem ? 'Edit Sub-Category' : 'Add Sub-Category')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-300">Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="bg-gray-950 border-gray-700 text-white mt-1"
                placeholder={addModal === 'unit' ? 'e.g. Piece' : addModal === 'brand' ? 'e.g. Nike' : 'e.g. Clothing'}
              />
            </div>
            {addModal === 'unit' && (
              <>
                <div>
                  <Label className="text-gray-300">Short Code *</Label>
                  <Input
                    value={formShortCode}
                    onChange={(e) => setFormShortCode(e.target.value)}
                    className="bg-gray-950 border-gray-700 text-white mt-1"
                    placeholder="e.g. pcs, m, kg, yd"
                    disabled={editItem && (editItem as Unit).is_default}
                  />
                  <p className="text-xs text-gray-500 mt-1">Short code for this unit (e.g., pcs for Piece, m for Meter)</p>
                </div>
                <div>
                  <Label className="text-gray-300">Symbol (optional)</Label>
                  <Input
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    className="bg-gray-950 border-gray-700 text-white mt-1"
                    placeholder="e.g. pcs, m (usually same as short code)"
                    disabled={editItem && (editItem as Unit).is_default}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="allowDecimal"
                    checked={formAllowDecimal}
                    onChange={(e) => setFormAllowDecimal(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-950 text-teal-600 focus:ring-teal-500"
                    disabled={editItem && (editItem as Unit).is_default}
                  />
                  <Label htmlFor="allowDecimal" className="text-gray-300 cursor-pointer">
                    Allow decimal quantities (e.g., 1.5 meters, 2.3 kg)
                  </Label>
                </div>
                {editItem && (editItem as Unit).is_default && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-400">
                      ⚠️ This is the default unit (Piece). Some properties cannot be changed.
                    </p>
                  </div>
                )}
              </>
            )}
            {addModal === 'sub-category' && (
              <div>
                <Label className="text-gray-300">Category *</Label>
                <select
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white mt-1"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-500"
              disabled={saving || !formName.trim()}
              onClick={() => {
                if (addModal === 'unit') saveUnit();
                if (addModal === 'brand') saveBrand();
                if (addModal === 'category') saveCategory();
                if (addModal === 'sub-category') saveSubCategory();
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : (editItem ? 'Update' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
