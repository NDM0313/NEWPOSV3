import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Wand2, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndAdd: (product: any) => void;
  initialName?: string;
}

interface VariantRow {
  id: string;
  name: string;
  price: string;
  qty: string;
  sku: string;
}

export const QuickAddProductModal = ({ isOpen, onClose, onSaveAndAdd, initialName = '' }: QuickAddProductModalProps) => {
  const [isVariable, setIsVariable] = useState(false);
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('pcs');
  
  // Single product fields
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [sku, setSku] = useState('');

  // Variable product state
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([]);

  // Update name when prop changes
  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  // Generate SKU for single product
  useEffect(() => {
    if (!isVariable && isOpen && !sku) {
      setSku(`SKU-${Math.floor(Math.random() * 10000)}`);
    }
  }, [isOpen, isVariable, sku]);

  // Handle Attribute Inputs
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>, 
    input: string, 
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!list.includes(input.trim())) {
        setList([...list, input.trim()]);
      }
      setInput('');
    }
  };

  const removeAttribute = (
    item: string, 
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.filter(i => i !== item));
  };

  // Generate Matrix
  useEffect(() => {
    if (!isVariable) return;

    // If no attributes, clear variants
    if (colors.length === 0 && sizes.length === 0) {
      setVariants([]);
      return;
    }

    const newVariants: VariantRow[] = [];
    
    // Helper to generate combinations
    const generate = () => {
      const colorList = colors.length > 0 ? colors : ['Standard'];
      const sizeList = sizes.length > 0 ? sizes : ['Standard'];

      colorList.forEach(c => {
        sizeList.forEach(s => {
          // Skip "Standard-Standard" if both are empty
          if (c === 'Standard' && s === 'Standard') return;
          
          const variantName = c === 'Standard' ? s : (s === 'Standard' ? c : `${c} - ${s}`);
          const variantId = `${c}-${s}`.replace(/\s+/g, '-').toLowerCase();
          
          // Check if variant already exists to preserve values
          const existing = variants.find(v => v.id === variantId);
          
          newVariants.push({
            id: variantId,
            name: variantName,
            price: existing?.price || '',
            qty: existing?.qty || '',
            sku: existing?.sku || `SKU-${Math.floor(Math.random() * 10000)}`
          });
        });
      });
    };

    generate();
    setVariants(newVariants);
  }, [colors, sizes, isVariable]);

  const updateVariant = (id: string, field: keyof VariantRow, value: string) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const applyPriceToAll = () => {
    if (variants.length === 0) return;
    const firstPrice = variants[0].price;
    setVariants(prev => prev.map(v => ({ ...v, price: firstPrice })));
  };

  const handleSave = () => {
    const baseProduct = {
      name,
      category,
      brand,
      unit,
    };

    if (isVariable) {
      // Return variants as separate items or a bundled product
      // For this simplified POS, let's just add them as individual items for now, 
      // or if the cart supports it, a parent product. 
      // Assuming the cart expects simple items for now:
      variants.forEach(v => {
        if (v.qty && parseInt(v.qty) > 0) {
           onSaveAndAdd({
            ...baseProduct,
            id: Date.now() + Math.random(),
            name: `${name} (${v.name})`,
            sku: v.sku,
            price: parseFloat(v.price) || 0,
            stock: parseInt(v.qty) || 0
          });
        }
      });
    } else {
      onSaveAndAdd({
        ...baseProduct,
        id: Date.now(),
        sku,
        price: parseFloat(price) || 0,
        stock: parseInt(qty) || 0
      });
    }
    onClose();
    // Reset form
    setColors([]);
    setSizes([]);
    setVariants([]);
    setName('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-[700px] p-0 gap-0 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Quick Add Product</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div 
          className="p-6 border-b flex justify-between items-center"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <div 
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Wand2 className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            Quick Add Product
          </div>
          <div className="flex items-center gap-3">
             <Label 
               htmlFor="type-mode" 
               className="text-sm font-medium cursor-pointer"
               style={{ color: 'var(--color-text-secondary)' }}
             >
               {isVariable ? 'Variable' : 'Simple'} Product
             </Label>
             <Switch 
               id="type-mode"
               checked={isVariable}
               onCheckedChange={setIsVariable}
             />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Row 1: Basic Info */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-5">
              <Label 
                className="text-xs uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Product Name
              </Label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product Name"
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
            <div className="col-span-4 md:col-span-3">
              <Label 
                className="text-xs uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger 
                  className="h-10"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectItem value="fabric">Fabric</SelectItem>
                  <SelectItem value="stitched">Stitched</SelectItem>
                  <SelectItem value="accessories">Accessories</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="col-span-4 md:col-span-2">
              <Label 
                className="text-xs uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Brand
              </Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger 
                  className="h-10"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                   <SelectItem value="local">Local</SelectItem>
                   <SelectItem value="brand_a">Brand A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-4 md:col-span-2">
              <Label 
                className="text-xs uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Unit
              </Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger 
                  className="h-10"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectItem value="pcs">Pc</SelectItem>
                  <SelectItem value="suit">Suit</SelectItem>
                  <SelectItem value="mtr">Mtr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator style={{ backgroundColor: 'var(--color-border-primary)' }} />

          {/* Simple Product Mode */}
          {!isVariable && (
             <div className="grid grid-cols-3 gap-4">
                <div>
                   <Label 
                     className="mb-1.5 block"
                     style={{ color: 'var(--color-text-secondary)' }}
                   >
                     Price
                   </Label>
                   <div className="relative">
                     <span 
                       className="absolute left-3 top-1/2 -translate-y-1/2"
                       style={{ color: 'var(--color-text-tertiary)' }}
                     >
                       $
                     </span>
                     <Input 
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        type="number"
                        className="pl-8"
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
                <div>
                   <Label 
                     className="mb-1.5 block"
                     style={{ color: 'var(--color-text-secondary)' }}
                   >
                     Quantity
                   </Label>
                   <Input 
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="0"
                      type="number"
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
                <div>
                   <Label 
                     className="mb-1.5 block"
                     style={{ color: 'var(--color-text-secondary)' }}
                   >
                     SKU (Auto)
                   </Label>
                   <Input 
                      value={sku}
                      readOnly
                      className="font-mono text-sm"
                      style={{
                        backgroundColor: 'rgba(31, 41, 55, 0.5)',
                        borderColor: 'var(--color-border-secondary)',
                        color: 'var(--color-text-secondary)'
                      }}
                   />
                </div>
             </div>
          )}

          {/* Variable Product Mode */}
          {isVariable && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
              
              {/* Attribute Inputs */}
              <div 
                className="grid grid-cols-2 gap-6 p-4 rounded-lg border"
                style={{
                  backgroundColor: 'rgba(31, 41, 55, 0.3)',
                  borderColor: 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div className="space-y-2">
                  <Label 
                    className="font-medium"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Colors
                  </Label>
                  <Input 
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, colors, setColors, colorInput, setColorInput)}
                    placeholder="Type color & Enter (e.g. Red)"
                    className="h-9"
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
                  <div className="flex flex-wrap gap-2 min-h-[24px]">
                    {colors.map(c => (
                      <Badge 
                        key={c} 
                        variant="secondary" 
                        className="gap-1 pr-1"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: 'var(--color-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                        }}
                      >
                        {c}
                        <button 
                          onClick={() => removeAttribute(c, colors, setColors)}
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                    {colors.length === 0 && (
                      <span 
                        className="text-xs italic"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        No colors added
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label 
                    className="font-medium"
                    style={{ color: 'var(--color-wholesale)' }}
                  >
                    Sizes
                  </Label>
                  <Input 
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, sizes, setSizes, sizeInput, setSizeInput)}
                    placeholder="Type size & Enter (e.g. Small)"
                    className="h-9"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-wholesale)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--color-border-secondary)';
                    }}
                  />
                  <div className="flex flex-wrap gap-2 min-h-[24px]">
                    {sizes.map(s => (
                      <Badge 
                        key={s} 
                        variant="secondary" 
                        className="gap-1 pr-1"
                        style={{
                          backgroundColor: 'rgba(147, 51, 234, 0.2)',
                          color: 'var(--color-wholesale)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)';
                        }}
                      >
                        {s}
                        <button 
                          onClick={() => removeAttribute(s, sizes, setSizes)}
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                    {sizes.length === 0 && (
                      <span 
                        className="text-xs italic"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        No sizes added
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* The Matrix Table */}
              {variants.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Generated Variants ({variants.length})
                    </h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={applyPriceToAll}
                      className="text-xs h-7"
                      style={{ color: 'var(--color-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-primary)';
                        e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-primary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Copy size={12} className="mr-1.5" /> Apply first price to all
                    </Button>
                  </div>
                  
                  <div 
                    className="border rounded-lg overflow-hidden"
                    style={{
                      borderColor: 'var(--color-border-primary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <table className="w-full text-sm text-left">
                      <thead
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          color: 'var(--color-text-secondary)'
                        }}
                      >
                        <tr>
                          <th className="px-4 py-3 font-medium">Variant</th>
                          <th className="px-4 py-3 font-medium w-32">Price</th>
                          <th className="px-4 py-3 font-medium w-24">Qty</th>
                          <th className="px-4 py-3 font-medium w-40 text-right">SKU</th>
                        </tr>
                      </thead>
                      <tbody
                        className="divide-y"
                        style={{
                          borderColor: 'var(--color-border-primary)',
                          backgroundColor: 'var(--color-bg-card)'
                        }}
                      >
                        {variants.map((variant) => (
                          <tr 
                            key={variant.id} 
                            className="group"
                            style={{
                              borderColor: 'var(--color-border-primary)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                            }}
                          >
                            <td 
                              className="px-4 py-2 font-medium"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {variant.name}
                            </td>
                            <td className="px-4 py-2">
                              <Input 
                                value={variant.price}
                                onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                                className="h-8"
                                placeholder="0.00"
                                type="number"
                                style={{
                                  backgroundColor: 'var(--color-bg-tertiary)',
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
                            </td>
                            <td className="px-4 py-2">
                              <Input 
                                value={variant.qty}
                                onChange={(e) => updateVariant(variant.id, 'qty', e.target.value)}
                                className="h-8"
                                placeholder="0"
                                type="number"
                                style={{
                                  backgroundColor: 'var(--color-bg-tertiary)',
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
                            </td>
                            <td 
                              className="px-4 py-2 text-right text-xs font-mono"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              {variant.sku}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="p-6 border-t flex justify-end gap-3"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <Button 
            variant="ghost" 
            onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="font-semibold"
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
            Save & Add to Cart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};