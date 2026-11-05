import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ProductFormProps {
  onCancel: () => void;
  onSave: () => void;
}

export const ProductForm = ({ onCancel, onSave }: ProductFormProps) => {
  const [images, setImages] = useState<File[]>([]);
  const [variations, setVariations] = useState<{ size: string; color: string; price: string; qty: string }[]>([
    { size: 'M', color: 'Black', price: '0', qty: '0' }
  ]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setImages(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const addVariation = () => {
    setVariations([...variations, { size: '', color: '', price: '', qty: '' }]);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const updateVariation = (index: number, field: string, value: string) => {
    const newVariations = [...variations];
    (newVariations[index] as any)[field] = value;
    setVariations(newVariations);
  };

  return (
    <div className="flex flex-col h-full bg-card text-foreground">
      <div className="p-6 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10">
        <h2 className="text-xl font-bold">Add New Product</h2>
        <button onClick={onCancel} className="p-2 hover:bg-muted rounded-full">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Product Name" placeholder="e.g. Cotton T-Shirt" />
            <FormInput label="SKU / Barcode" placeholder="e.g. 12345678" />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
              <textarea 
                className="w-full bg-muted border border-border rounded-lg p-3 text-foreground focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                placeholder="Product description..."
              />
            </div>
          </div>
        </div>

        {/* Media */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">Media</h3>
          <div 
            {...getRootProps()} 
            className={clsx(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors",
              isDragActive ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-gray-500 bg-muted/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload size={32} className="text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-center">
              Drag & drop images here, or <span className="text-blue-500">browse</span>
            </p>
          </div>
          
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              {images.map((file, idx) => (
                <div key={idx} className="relative group aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setImages(images.filter((_, i) => i !== idx)); }}
                    className="absolute top-1 right-1 bg-red-500 text-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variations Matrix */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold border-l-4 border-blue-500 pl-3">Variations</h3>
            <button 
              onClick={addVariation}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Plus size={16} /> Add Variant
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground text-xs uppercase">
                  <th className="p-3 rounded-tl-lg">Size</th>
                  <th className="p-3">Color</th>
                  <th className="p-3">Price ($)</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3 rounded-tr-lg w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {variations.map((v, i) => (
                  <tr key={i} className="bg-card">
                    <td className="p-2">
                      <input 
                        value={v.size}
                        onChange={(e) => updateVariation(i, 'size', e.target.value)}
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="Size"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        value={v.color}
                        onChange={(e) => updateVariation(i, 'color', e.target.value)}
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="Color"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        value={v.price}
                        type="number"
                        onChange={(e) => updateVariation(i, 'price', e.target.value)}
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        value={v.qty}
                        type="number"
                        onChange={(e) => updateVariation(i, 'qty', e.target.value)}
                        className="w-full bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:border-blue-500 outline-none" 
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => removeVariation(i)}
                        className="text-red-500 hover:text-red-400 p-1"
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

      <div className="p-6 border-t border-border bg-card sticky bottom-0 z-10 flex gap-4">
        <button 
          onClick={onSave}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors"
        >
          Save Product
        </button>
        <button className="flex-1 bg-muted hover:bg-muted text-foreground py-3 rounded-xl font-bold transition-colors">
          Save & Add Another
        </button>
      </div>
    </div>
  );
};

const FormInput = ({ label, placeholder, type = "text" }: any) => (
  <div>
    <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>
    <input 
      type={type} 
      className="w-full bg-muted border border-border rounded-lg px-4 py-2 text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
      placeholder={placeholder}
    />
  </div>
);
