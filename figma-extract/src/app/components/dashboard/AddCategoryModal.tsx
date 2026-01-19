import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Building2, 
  Zap, 
  Users, 
  Home, 
  Car, 
  Utensils, 
  ShoppingCart, 
  Briefcase,
  AlertCircle
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
import { cn } from "../ui/utils";

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryToEdit?: any; // For edit mode
}

const COLORS = [
  { name: 'Blue', value: 'bg-blue-500', border: 'border-blue-500' },
  { name: 'Purple', value: 'bg-purple-500', border: 'border-purple-500' },
  { name: 'Orange', value: 'bg-orange-500', border: 'border-orange-500' },
  { name: 'Green', value: 'bg-green-500', border: 'border-green-500' },
  { name: 'Yellow', value: 'bg-yellow-500', border: 'border-yellow-500' },
  { name: 'Red', value: 'bg-red-500', border: 'border-red-500' },
];

const ICONS = [
  { name: 'Building', icon: Building2 },
  { name: 'Electricity', icon: Zap },
  { name: 'Users', icon: Users },
  { name: 'Home', icon: Home },
  { name: 'Car', icon: Car },
  { name: 'Food', icon: Utensils },
  { name: 'Shopping', icon: ShoppingCart },
  { name: 'Work', icon: Briefcase },
];

export const AddCategoryModal = ({ isOpen, onClose, categoryToEdit }: AddCategoryModalProps) => {
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0].name);
  const [name, setName] = useState(categoryToEdit?.name || '');
  const [description, setDescription] = useState(categoryToEdit?.description || '');

  // Reset state when opening for new category
  React.useEffect(() => {
    if (isOpen && !categoryToEdit) {
      setName('');
      setDescription('');
      setSelectedColor(COLORS[0]);
      setSelectedIcon(ICONS[0].name);
    } else if (isOpen && categoryToEdit) {
      setName(categoryToEdit.name);
      setDescription(categoryToEdit.description || '');
      // Find and set color/icon logic would go here
    }
  }, [isOpen, categoryToEdit]);

  const handleSubmit = () => {
    // Logic to save category
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[#1F2937] border-gray-700 text-white p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {categoryToEdit ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Category Name</Label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Supplies" 
              className="bg-gray-900 border-gray-700 text-white focus:border-blue-500"
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Color Code</Label>
            <div className="flex items-center gap-3">
              {COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all flex items-center justify-center",
                    color.value,
                    selectedColor.name === color.name ? "ring-2 ring-white ring-offset-2 ring-offset-[#1F2937] scale-110" : "opacity-70 hover:opacity-100"
                  )}
                >
                  {selectedColor.name === color.name && <Check size={14} className="text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Icon</Label>
            <div className="grid grid-cols-4 gap-3">
              {ICONS.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setSelectedIcon(item.name)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 h-16 rounded-xl border transition-all",
                    selectedIcon === item.name 
                      ? "bg-blue-600/20 border-blue-500 text-blue-400" 
                      : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  )}
                >
                  <item.icon size={20} />
                  <span className="text-[10px]">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

           {/* Description Input */}
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
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20">
            {categoryToEdit ? 'Update Category' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
