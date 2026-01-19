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
      <DialogContent className="sm:max-w-[700px] bg-gray-900 text-white border-gray-800 p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick Add Product</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-blue-500" />
            Quick Add Product
          </div>
          <div className="flex items-center gap-3">
             <Label htmlFor="type-mode" className="text-sm text-gray-400 font-medium cursor-pointer">
               {isVariable ? 'Variable' : 'Simple'} Product
             </Label>
             <Switch 
               id="type-mode"
               checked={isVariable}
               onCheckedChange={setIsVariable}
               className="data-[state=checked]:bg-blue-600"
             />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Row 1: Basic Info */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-5">
              <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Product Name</Label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product Name"
                className="bg-gray-800 border-gray-700 text-white focus:ring-blue-500/20"
              />
            </div>
            <div className="col-span-4 md:col-span-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-10">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="fabric">Fabric</SelectItem>
                  <SelectItem value="stitched">Stitched</SelectItem>
                  <SelectItem value="accessories">Accessories</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="col-span-4 md:col-span-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Brand</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-10">
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                   <SelectItem value="local">Local</SelectItem>
                   <SelectItem value="brand_a">Brand A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-4 md:col-span-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-10">
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="pcs">Pc</SelectItem>
                  <SelectItem value="suit">Suit</SelectItem>
                  <SelectItem value="mtr">Mtr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="bg-gray-800" />

          {/* Simple Product Mode */}
          {!isVariable && (
             <div className="grid grid-cols-3 gap-4">
                <div>
                   <Label className="text-gray-400 mb-1.5 block">Price</Label>
                   <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                     <Input 
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        type="number"
                        className="bg-gray-800 border-gray-700 text-white pl-8"
                     />
                   </div>
                </div>
                <div>
                   <Label className="text-gray-400 mb-1.5 block">Quantity</Label>
                   <Input 
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="0"
                      type="number"
                      className="bg-gray-800 border-gray-700 text-white"
                   />
                </div>
                <div>
                   <Label className="text-gray-400 mb-1.5 block">SKU (Auto)</Label>
                   <Input 
                      value={sku}
                      readOnly
                      className="bg-gray-800/50 border-gray-700 text-gray-400 font-mono text-sm"
                   />
                </div>
             </div>
          )}

          {/* Variable Product Mode */}
          {isVariable && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
              
              {/* Attribute Inputs */}
              <div className="grid grid-cols-2 gap-6 p-4 bg-gray-800/30 rounded-lg border border-gray-800">
                <div className="space-y-2">
                  <Label className="text-blue-400 font-medium">Colors</Label>
                  <Input 
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, colors, setColors, colorInput, setColorInput)}
                    placeholder="Type color & Enter (e.g. Red)"
                    className="bg-gray-900 border-gray-700 text-white h-9"
                  />
                  <div className="flex flex-wrap gap-2 min-h-[24px]">
                    {colors.map(c => (
                      <Badge key={c} variant="secondary" className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 gap-1 pr-1">
                        {c}
                        <button onClick={() => removeAttribute(c, colors, setColors)} className="hover:text-white"><X size={12} /></button>
                      </Badge>
                    ))}
                    {colors.length === 0 && <span className="text-xs text-gray-600 italic">No colors added</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-purple-400 font-medium">Sizes</Label>
                  <Input 
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, sizes, setSizes, sizeInput, setSizeInput)}
                    placeholder="Type size & Enter (e.g. Small)"
                    className="bg-gray-900 border-gray-700 text-white h-9"
                  />
                  <div className="flex flex-wrap gap-2 min-h-[24px]">
                    {sizes.map(s => (
                      <Badge key={s} variant="secondary" className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 gap-1 pr-1">
                        {s}
                        <button onClick={() => removeAttribute(s, sizes, setSizes)} className="hover:text-white"><X size={12} /></button>
                      </Badge>
                    ))}
                    {sizes.length === 0 && <span className="text-xs text-gray-600 italic">No sizes added</span>}
                  </div>
                </div>
              </div>

              {/* The Matrix Table */}
              {variants.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-gray-300">Generated Variants ({variants.length})</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={applyPriceToAll}
                      className="text-xs text-blue-400 h-7 hover:text-blue-300 hover:bg-blue-900/20"
                    >
                      <Copy size={12} className="mr-1.5" /> Apply first price to all
                    </Button>
                  </div>
                  
                  <div className="border border-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-950 text-gray-400">
                        <tr>
                          <th className="px-4 py-3 font-medium">Variant</th>
                          <th className="px-4 py-3 font-medium w-32">Price</th>
                          <th className="px-4 py-3 font-medium w-24">Qty</th>
                          <th className="px-4 py-3 font-medium w-40 text-right">SKU</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-gray-900">
                        {variants.map((variant) => (
                          <tr key={variant.id} className="group hover:bg-gray-800/50">
                            <td className="px-4 py-2 font-medium text-white">
                              {variant.name}
                            </td>
                            <td className="px-4 py-2">
                              <Input 
                                value={variant.price}
                                onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                                className="h-8 bg-gray-950 border-gray-700"
                                placeholder="0.00"
                                type="number"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input 
                                value={variant.qty}
                                onChange={(e) => updateVariant(variant.id, 'qty', e.target.value)}
                                className="h-8 bg-gray-950 border-gray-700"
                                placeholder="0"
                                type="number"
                              />
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-gray-500 font-mono">
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
        <div className="p-6 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20">
            Save & Add to Cart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};