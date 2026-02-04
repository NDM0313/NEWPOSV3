import React, { useState, useEffect } from 'react';
import {
  Check,
  Building2,
  Zap,
  Users,
  Home,
  Car,
  Utensils,
  ShoppingCart,
  Briefcase,
  Wallet,
  Loader2,
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "../ui/utils";
import { useSupabase } from '@/app/context/SupabaseContext';
import { expenseCategoryService, type ExpenseCategoryTreeItem, type ExpenseCategoryRow, type ExpenseCategoryType } from '@/app/services/expenseCategoryService';
import { toast } from 'sonner';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryToEdit?: ExpenseCategoryRow | null;
  onSuccess?: () => void;
}

const COLORS = [
  { name: 'Blue', value: 'bg-blue-500', slug: 'blue' },
  { name: 'Purple', value: 'bg-purple-500', slug: 'purple' },
  { name: 'Orange', value: 'bg-orange-500', slug: 'orange' },
  { name: 'Green', value: 'bg-green-500', slug: 'green' },
  { name: 'Yellow', value: 'bg-yellow-500', slug: 'yellow' },
  { name: 'Red', value: 'bg-red-500', slug: 'red' },
  { name: 'Cyan', value: 'bg-cyan-500', slug: 'cyan' },
  { name: 'Pink', value: 'bg-pink-500', slug: 'pink' },
  { name: 'Gray', value: 'bg-gray-500', slug: 'gray' },
];

// Generic icons: Electricity, Salary, Transport, Office, Food (+ utility)
const ICONS = [
  { name: 'Electricity', icon: Zap, slug: 'Zap' },
  { name: 'Salary', icon: Users, slug: 'Users' },
  { name: 'Transport', icon: Car, slug: 'Car' },
  { name: 'Office', icon: Building2, slug: 'Building2' },
  { name: 'Food', icon: Utensils, slug: 'Utensils' },
  { name: 'Wallet', icon: Wallet, slug: 'Wallet' },
  { name: 'Work', icon: Briefcase, slug: 'Briefcase' },
  { name: 'Home', icon: Home, slug: 'Home' },
  { name: 'Shopping', icon: ShoppingCart, slug: 'ShoppingCart' },
  { name: 'Other', icon: Wallet, slug: 'Other' },
];

export const AddCategoryModal = ({ isOpen, onClose, categoryToEdit, onSuccess }: AddCategoryModalProps) => {
  const { companyId } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState<ExpenseCategoryTreeItem[]>([]);
  const [parentId, setParentId] = useState<string>('');
  const [selectedColorSlug, setSelectedColorSlug] = useState('blue');
  const [selectedIconSlug, setSelectedIconSlug] = useState('Zap');
  const [categoryType, setCategoryType] = useState<ExpenseCategoryType>('general');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen || !companyId) return;
    expenseCategoryService.getTree(companyId).then(setTree).catch(() => setTree([]));
  }, [isOpen, companyId]);

  useEffect(() => {
    if (isOpen) {
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setDescription(categoryToEdit.description || '');
        setParentId(categoryToEdit.parent_id || '');
        setSelectedColorSlug(categoryToEdit.color || 'blue');
        setSelectedIconSlug(categoryToEdit.icon || 'Zap');
        setCategoryType((categoryToEdit as any).type === 'salary' ? 'salary' : (categoryToEdit as any).type === 'utility' ? 'utility' : 'general');
      } else {
        setName('');
        setDescription('');
        setParentId('');
        setSelectedColorSlug('blue');
        setSelectedIconSlug('Zap');
        setCategoryType('general');
      }
    }
  }, [isOpen, categoryToEdit]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Category name is required');
      return;
    }
    if (!companyId) {
      toast.error('Company not found');
      return;
    }
    setLoading(true);
    try {
      const isEdit = categoryToEdit?.id && (categoryToEdit as ExpenseCategoryRow).company_id;
      if (isEdit) {
        await expenseCategoryService.update(categoryToEdit!.id, {
          name: trimmedName,
          parent_id: parentId || null,
          type: categoryType,
          color: selectedColorSlug,
          icon: selectedIconSlug,
          description: description.trim() || null,
        });
        toast.success('Category updated');
      } else {
        await expenseCategoryService.create(companyId, {
          name: trimmedName,
          parent_id: parentId || null,
          type: categoryType,
          color: selectedColorSlug,
          icon: selectedIconSlug,
          description: description.trim() || null,
        });
        toast.success('Category created');
      }
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const selectedColor = COLORS.find((c) => c.slug === selectedColorSlug) || COLORS[0];
  const selectedIcon = ICONS.find((i) => i.slug === selectedIconSlug) || ICONS[0];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[#1F2937] border-gray-700 text-white p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {categoryToEdit ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Category Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Electricity Bill, Office Supplies"
              className="bg-gray-900 border-gray-700 text-white focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Category Type</Label>
            <Select value={categoryType} onValueChange={(v) => setCategoryType(v as ExpenseCategoryType)}>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                <SelectItem value="general" className="focus:bg-gray-800 focus:text-white cursor-pointer">General</SelectItem>
                <SelectItem value="utility" className="focus:bg-gray-800 focus:text-white cursor-pointer">Utility</SelectItem>
                <SelectItem value="salary" className="focus:bg-gray-800 focus:text-white cursor-pointer">Salary (Users only – Staff/Salesman/Operator)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Parent Category (optional)</Label>
            <Select value={parentId || 'none'} onValueChange={(v) => setParentId(v === 'none' ? '' : v)}>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="None (Main Category)" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                <SelectItem value="none" className="focus:bg-gray-800 focus:text-white cursor-pointer">
                  None (Main Category)
                </SelectItem>
                {tree.map((main) => (
                  <SelectItem key={main.id} value={main.id} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                    {main.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Select a parent to make this a sub-category.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.slug}
                  type="button"
                  onClick={() => setSelectedColorSlug(color.slug)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                    color.value,
                    selectedColorSlug === color.slug ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1F2937] scale-110' : 'opacity-70 hover:opacity-100'
                  )}
                >
                  {selectedColorSlug === color.slug && <Check size={14} className="text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Icon</Label>
            <div className="grid grid-cols-5 gap-2">
              {ICONS.map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => setSelectedIconSlug(item.slug)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl border transition-all',
                      selectedIconSlug === item.slug
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                    )}
                  >
                    <IconComp size={18} />
                    <span className="text-[9px] leading-tight">{item.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">Sub-categories can inherit parent icon or use this override.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Description (Optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description..."
              className="bg-gray-900 border-gray-700 text-white focus:border-blue-500"
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-2">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin mr-2" />}
            {categoryToEdit ? 'Update Category' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
