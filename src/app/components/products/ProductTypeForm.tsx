import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, Plus, Trash2, RefreshCcw, Package, DollarSign, Box } from 'lucide-react';
import { clsx } from 'clsx';
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { QuickAddDropdown } from "./QuickAddDropdown";

type ProductType = 'standard' | 'variable' | 'combo';

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

interface ComboProduct {
  id: string;
  name: string;
  quantity: number;
  image?: string;
}

interface ProductTypeFormProps {
  onCancel: () => void;
  onSave: () => void;
}

export const ProductTypeForm = ({ onCancel, onSave }: ProductTypeFormProps) => {
  const [productType, setProductType] = useState<ProductType>('standard');
  const [images, setImages] = useState<File[]>([]);
  const [variants, setVariants] = useState<Variant[]>([
    { id: '1', name: 'Small', sku: 'PRD-001-S', price: 100, stock: 10 },
    { id: '2', name: 'Medium', sku: 'PRD-001-M', price: 120, stock: 15 },
    { id: '3', name: 'Large', sku: 'PRD-001-L', price: 140, stock: 8 },
  ]);
  const [comboProducts, setComboProducts] = useState<ComboProduct[]>([
    { id: '1', name: 'Cotton Shirt', quantity: 1 },
    { id: '2', name: 'Denim Jeans', quantity: 1 },
  ]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setImages(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] }
  });

  const addVariant = () => {
    const newVariant: Variant = {
      id: Date.now().toString(),
      name: '',
      sku: '',
      price: 0,
      stock: 0,
    };
    setVariants([...variants, newVariant]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setVariants(variants.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const addComboProduct = () => {
    const newProduct: ComboProduct = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
    };
    setComboProducts([...comboProducts, newProduct]);
  };

  const removeComboProduct = (id: string) => {
    setComboProducts(comboProducts.filter(p => p.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold">Add New Product</h2>
          <p className="text-sm text-gray-400">Complete product details for inventory</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-gray-800 rounded-full">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Product Type Segmented Control */}
        <div className="space-y-3">
          <Label className="text-gray-200">Product Type *</Label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-gray-800/50 rounded-lg border border-gray-700">
            <button
              type="button"
              onClick={() => setProductType('standard')}
              className={clsx(
                "py-3 px-4 rounded-md font-medium text-sm transition-all duration-200",
                productType === 'standard'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              )}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setProductType('variable')}
              className={clsx(
                "py-3 px-4 rounded-md font-medium text-sm transition-all duration-200",
                productType === 'variable'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              )}
            >
              Variable
            </button>
            <button
              type="button"
              onClick={() => setProductType('combo')}
              className={clsx(
                "py-3 px-4 rounded-md font-medium text-sm transition-all duration-200",
                productType === 'combo'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              )}
            >
              Combo
            </button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3 flex items-center gap-2">
            <Package size={20} />
            Product Identity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="p-name" className="text-gray-200">Product Name *</Label>
              <Input 
                id="p-name" 
                placeholder="e.g. Cotton Premium Shirt" 
                className="bg-gray-800 border-gray-700 text-white mt-1" 
                required 
              />
            </div>

            {productType === 'standard' && (
              <>
                <div>
                  <Label htmlFor="sku" className="text-gray-200">SKU / Code *</Label>
                  <Input 
                    id="sku" 
                    placeholder="AUTO-GENERATED" 
                    className="bg-gray-800 border-gray-700 text-white mt-1" 
                  />
                </div>
                <div>
                  <Label htmlFor="barcode" className="text-gray-200">Barcode</Label>
                  <Input 
                    id="barcode" 
                    placeholder="Enter barcode" 
                    className="bg-gray-800 border-gray-700 text-white mt-1" 
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Classification */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-purple-500 pl-3">Classification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="brand" className="text-gray-200">Brand</Label>
              <QuickAddDropdown
                placeholder="Select Brand"
                items={[
                  { value: 'gul_ahmed', label: 'Gul Ahmed' },
                  { value: 'sapphire', label: 'Sapphire' },
                  { value: 'khaadi', label: 'Khaadi' },
                ]}
                onAddNew={() => console.log('Add new brand')}
                addNewLabel="Add New Brand"
              />
            </div>

            <div>
              <Label htmlFor="category" className="text-gray-200">Category *</Label>
              <QuickAddDropdown
                placeholder="Select Category"
                items={[
                  { value: 'unstitched', label: 'Unstitched' },
                  { value: 'pret', label: 'Pret (Ready to Wear)' },
                  { value: 'bedding', label: 'Bedding' },
                ]}
                onAddNew={() => console.log('Add new category')}
                addNewLabel="Add New Category"
              />
            </div>
          </div>
        </div>

        {/* Variable Product - Variants Table */}
        {productType === 'variable' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold border-l-4 border-orange-500 pl-3">
                Attributes & Variants
              </h3>
              <Button
                type="button"
                onClick={addVariant}
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
              >
                <Plus size={16} />
                Add Variant
              </Button>
            </div>

            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Variant Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Stock
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase w-16">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {variants.map((variant) => (
                      <tr key={variant.id} className="hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <Input
                            value={variant.name}
                            onChange={(e) => updateVariant(variant.id, 'name', e.target.value)}
                            placeholder="e.g., Small"
                            className="bg-gray-800 border-gray-700 text-white h-9"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={variant.sku}
                            onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                            placeholder="SKU-001"
                            className="bg-gray-800 border-gray-700 text-white h-9"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={variant.price}
                            onChange={(e) => updateVariant(variant.id, 'price', parseFloat(e.target.value))}
                            placeholder="0"
                            className="bg-gray-800 border-gray-700 text-white h-9"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={variant.stock}
                            onChange={(e) => updateVariant(variant.id, 'stock', parseInt(e.target.value))}
                            placeholder="0"
                            className="bg-gray-800 border-gray-700 text-white h-9"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeVariant(variant.id)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Combo Product - Included Products */}
        {productType === 'combo' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold border-l-4 border-green-500 pl-3">
                Included Products
              </h3>
              <Button
                type="button"
                onClick={addComboProduct}
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
              >
                <Plus size={16} />
                Add Product
              </Button>
            </div>

            <div className="space-y-3">
              {comboProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                >
                  {/* Thumbnail placeholder */}
                  <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
                    <Box size={24} className="text-gray-500" />
                  </div>

                  {/* Product selector */}
                  <div className="flex-1">
                    <Select>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select Product" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-800 text-white">
                        <SelectItem value="shirt">Cotton Shirt</SelectItem>
                        <SelectItem value="jeans">Denim Jeans</SelectItem>
                        <SelectItem value="jacket">Leather Jacket</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity */}
                  <div className="w-24">
                    <Input
                      type="number"
                      value={product.quantity}
                      min="1"
                      placeholder="Qty"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeComboProduct(product.id)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pricing - Standard & Combo only */}
        {productType !== 'variable' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-l-4 border-green-500 pl-3 flex items-center gap-2">
              <DollarSign size={20} />
              Pricing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="purchase-price" className="text-gray-200">Purchase Price</Label>
                <Input 
                  id="purchase-price" 
                  type="number" 
                  placeholder="0.00" 
                  className="bg-gray-800 border-gray-700 text-white mt-1" 
                />
              </div>
              <div>
                <Label htmlFor="selling-price" className="text-gray-200">Selling Price *</Label>
                <Input 
                  id="selling-price" 
                  type="number" 
                  placeholder="0.00" 
                  className="bg-green-900/30 border-green-700 text-white mt-1" 
                  required 
                />
              </div>
            </div>
          </div>
        )}

        {/* Product Images */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-indigo-500 pl-3">Product Images</h3>
          <div 
            {...getRootProps()} 
            className={clsx(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors",
              isDragActive ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-500 bg-gray-800/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload size={32} className="text-gray-500 mb-3" />
            <p className="text-gray-400 text-center">
              Drag & drop images here, or <span className="text-blue-500">browse</span>
            </p>
          </div>
          
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {images.map((file, idx) => (
                <div key={idx} className="relative group aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setImages(images.filter((_, i) => i !== idx)); }}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-800 bg-gray-900 sticky bottom-0 z-10 flex gap-4">
        <button 
          onClick={onCancel}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={onSave}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors"
        >
          Save Product
        </button>
      </div>
    </div>
  );
};
