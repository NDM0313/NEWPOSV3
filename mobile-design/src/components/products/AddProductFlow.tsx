import { useState } from 'react';
import { ArrowLeft, Package, Plus, Minus, X, Save, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface AddProductFlowProps {
  onClose: () => void;
  onSave: (product: any) => void;
  product?: any;
}

export function AddProductFlow({ onClose, onSave, product: editProduct }: AddProductFlowProps) {
  const [formData, setFormData] = useState({
    sku: editProduct?.sku || '',
    name: editProduct?.name || '',
    category: editProduct?.category || '',
    description: editProduct?.description || '',
    images: editProduct?.images || [],
    costPrice: editProduct?.costPrice || '',
    retailPrice: editProduct?.retailPrice || '',
    wholesalePrice: editProduct?.wholesalePrice || '',
    stock: editProduct?.stock || '',
    minStock: editProduct?.minStock || '',
    unit: editProduct?.unit || 'Piece',
    barcode: editProduct?.barcode || '',
    status: editProduct?.status || 'active',
    hasVariations: editProduct?.hasVariations || false,
    variations: editProduct?.variations || {
      sizes: [],
      colors: [],
      fabrics: [],
    },
  });

  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newFabric, setNewFabric] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  const categories = [
    'Bridal', 'Accessories', 'Fabric', 'Jewelry', 'Footwear', 
    'Clothing', 'Stitched', 'Unstitched', 'Other'
  ];

  const units = ['Piece', 'Meter', 'Yard', 'Set', 'Pair', 'Dozen'];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addVariation = (type: 'sizes' | 'colors' | 'fabrics', value: string) => {
    if (!value.trim()) return;
    
    const variations = { ...formData.variations };
    if (!variations[type].includes(value.trim())) {
      variations[type].push(value.trim());
      setFormData(prev => ({ ...prev, variations }));
      
      // Clear input
      if (type === 'sizes') setNewSize('');
      if (type === 'colors') setNewColor('');
      if (type === 'fabrics') setNewFabric('');
    }
  };

  const removeVariation = (type: 'sizes' | 'colors' | 'fabrics', value: string) => {
    const variations = { ...formData.variations };
    variations[type] = variations[type].filter(v => v !== value);
    setFormData(prev => ({ ...prev, variations }));
  };

  const addImage = (url: string) => {
    if (!url.trim()) return;
    
    const images = [...formData.images];
    if (!images.includes(url.trim())) {
      images.push(url.trim());
      setFormData(prev => ({ ...prev, images }));
      
      // Clear input
      setNewImageUrl('');
    }
  };

  const removeImage = (url: string) => {
    const images = [...formData.images];
    const index = images.indexOf(url);
    if (index > -1) {
      images.splice(index, 1);
      setFormData(prev => ({ ...prev, images }));
    }
  };

  const handleSubmit = () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }
    if (!formData.retailPrice || parseFloat(formData.retailPrice) <= 0) {
      toast.error('Valid retail price is required');
      return;
    }

    const productData = {
      id: editProduct?.id || `p_${Date.now()}`,
      sku: formData.sku || `SKU-${Date.now()}`,
      name: formData.name,
      category: formData.category,
      description: formData.description,
      images: formData.images,
      costPrice: parseFloat(formData.costPrice) || 0,
      retailPrice: parseFloat(formData.retailPrice),
      wholesalePrice: parseFloat(formData.wholesalePrice) || parseFloat(formData.retailPrice),
      stock: parseInt(formData.stock) || 0,
      minStock: parseInt(formData.minStock) || 0,
      unit: formData.unit,
      barcode: formData.barcode,
      status: formData.status,
      hasVariations: formData.hasVariations,
      variations: formData.hasVariations ? formData.variations : undefined,
      createdAt: editProduct?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    onSave(productData);
    toast.success(editProduct ? 'Product updated successfully!' : 'Product added successfully!');
  };

  return (
    <div className="fixed inset-0 bg-[#111827] z-50 overflow-y-auto pb-24">
      {/* Header */}
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
            className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-medium transition-colors"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Information */}
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
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
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
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </div>

              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                >
                  <option value="">Select</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => handleInputChange('barcode', e.target.value)}
                placeholder="Optional barcode"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Description</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Product Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter product description"
                className="w-full h-24 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Images</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Add Image URL</label>
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addImage(newImageUrl)}
                placeholder="Enter image URL"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.images.map(url => (
                <div
                  key={url}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#111827] border border-[#374151] rounded-lg text-sm text-white"
                >
                  <img
                    src={url}
                    alt="Product"
                    className="w-10 h-10 object-cover"
                  />
                  <button
                    onClick={() => removeImage(url)}
                    className="text-[#6B7280] hover:text-[#EF4444]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Pricing</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Cost Price</label>
              <input
                type="number"
                value={formData.costPrice}
                onChange={(e) => handleInputChange('costPrice', e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>

            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Retail Price *</label>
              <input
                type="number"
                value={formData.retailPrice}
                onChange={(e) => handleInputChange('retailPrice', e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>

            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Wholesale Price</label>
              <input
                type="number"
                value={formData.wholesalePrice}
                onChange={(e) => handleInputChange('wholesalePrice', e.target.value)}
                placeholder="0"
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Inventory</h3>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Current Stock</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', e.target.value)}
                  placeholder="0"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </div>

              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Min Stock</label>
                <input
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => handleInputChange('minStock', e.target.value)}
                  placeholder="0"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#9CA3AF] mb-1.5">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              >
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Variations */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Product Variations</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasVariations}
                onChange={(e) => handleInputChange('hasVariations', e.target.checked)}
                className="w-4 h-4 rounded border-[#374151] bg-[#111827] text-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
              <span className="text-sm text-[#9CA3AF]">Enable</span>
            </label>
          </div>

          {formData.hasVariations && (
            <div className="space-y-4">
              {/* Sizes */}
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Sizes</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addVariation('sizes', newSize)}
                    placeholder="Add size (e.g., S, M, L)"
                    className="flex-1 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <button
                    onClick={() => addVariation('sizes', newSize)}
                    className="h-10 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.variations.sizes.map(size => (
                    <span
                      key={size}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-[#111827] border border-[#374151] rounded-lg text-sm text-white"
                    >
                      {size}
                      <button
                        onClick={() => removeVariation('sizes', size)}
                        className="text-[#6B7280] hover:text-[#EF4444]"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Colors</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addVariation('colors', newColor)}
                    placeholder="Add color (e.g., Red, Blue)"
                    className="flex-1 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <button
                    onClick={() => addVariation('colors', newColor)}
                    className="h-10 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.variations.colors.map(color => (
                    <span
                      key={color}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-[#111827] border border-[#374151] rounded-lg text-sm text-white"
                    >
                      {color}
                      <button
                        onClick={() => removeVariation('colors', color)}
                        className="text-[#6B7280] hover:text-[#EF4444]"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Fabrics */}
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-2">Fabrics</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newFabric}
                    onChange={(e) => setNewFabric(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addVariation('fabrics', newFabric)}
                    placeholder="Add fabric (e.g., Silk, Cotton)"
                    className="flex-1 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <button
                    onClick={() => addVariation('fabrics', newFabric)}
                    className="h-10 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.variations.fabrics.map(fabric => (
                    <span
                      key={fabric}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-[#111827] border border-[#374151] rounded-lg text-sm text-white"
                    >
                      {fabric}
                      <button
                        onClick={() => removeVariation('fabrics', fabric)}
                        className="text-[#6B7280] hover:text-[#EF4444]"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Status</h3>
          <div className="flex gap-3">
            <button
              onClick={() => handleInputChange('status', 'active')}
              className={`flex-1 h-12 rounded-lg font-medium transition-colors ${
                formData.status === 'active'
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#111827] border border-[#374151] text-[#9CA3AF]'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => handleInputChange('status', 'inactive')}
              className={`flex-1 h-12 rounded-lg font-medium transition-colors ${
                formData.status === 'inactive'
                  ? 'bg-[#EF4444] text-white'
                  : 'bg-[#111827] border border-[#374151] text-[#9CA3AF]'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSubmit}
          className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold transition-colors"
        >
          {editProduct ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </div>
  );
}