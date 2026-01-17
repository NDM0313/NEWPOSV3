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
      <DialogContent 
        className="sm:max-w-[425px] p-0 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-secondary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {categoryToEdit ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label 
              className="text-xs uppercase font-bold tracking-wider"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Category Name
            </Label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Supplies"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-border-secondary)';
              }}
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label 
              className="text-xs uppercase font-bold tracking-wider"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Color Code
            </Label>
            <div className="flex items-center gap-3">
              {COLORS.map((color) => {
                const getColorValue = (colorName: string) => {
                  const colorMap: Record<string, string> = {
                    'Blue': 'var(--color-primary)',
                    'Purple': 'var(--color-wholesale)',
                    'Orange': 'var(--color-warning)',
                    'Green': 'var(--color-success)',
                    'Yellow': 'rgba(234, 179, 8, 1)',
                    'Red': 'var(--color-error)'
                  };
                  return colorMap[colorName] || 'var(--color-primary)';
                };
                
                return (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color)}
                    className="w-8 h-8 rounded-full transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: getColorValue(color.name),
                      opacity: selectedColor.name === color.name ? 1 : 0.7,
                      transform: selectedColor.name === color.name ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: selectedColor.name === color.name 
                        ? '0 0 0 2px var(--color-text-primary), 0 0 0 4px var(--color-bg-card)' 
                        : 'none',
                      borderRadius: 'var(--radius-full)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedColor.name !== color.name) {
                        e.currentTarget.style.opacity = '1';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedColor.name !== color.name) {
                        e.currentTarget.style.opacity = '0.7';
                      }
                    }}
                  >
                    {selectedColor.name === color.name && (
                      <Check 
                        size={14} 
                        style={{ 
                          color: 'var(--color-text-primary)',
                          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))'
                        }} 
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <Label 
              className="text-xs uppercase font-bold tracking-wider"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Icon
            </Label>
            <div className="grid grid-cols-4 gap-3">
              {ICONS.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setSelectedIcon(item.name)}
                  className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border transition-all"
                  style={{
                    backgroundColor: selectedIcon === item.name 
                      ? 'rgba(59, 130, 246, 0.2)' 
                      : 'var(--color-bg-card)',
                    borderColor: selectedIcon === item.name 
                      ? 'var(--color-primary)' 
                      : 'var(--color-border-secondary)',
                    color: selectedIcon === item.name 
                      ? 'var(--color-primary)' 
                      : 'var(--color-text-tertiary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedIcon !== item.name) {
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedIcon !== item.name) {
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      e.currentTarget.style.color = 'var(--color-text-tertiary)';
                    }
                  }}
                >
                  <item.icon size={20} />
                  <span className="text-[10px]">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

           {/* Description Input */}
           <div className="space-y-2">
            <Label 
              className="text-xs uppercase font-bold tracking-wider"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Description (Optional)
            </Label>
            <Input 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description..."
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-border-secondary)';
              }}
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            style={{
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.opacity = '1';
            }}
          >
            {categoryToEdit ? 'Update Category' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
