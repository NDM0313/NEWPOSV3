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
    <div 
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}
    >
      <div 
        className="p-6 border-b flex justify-between items-center sticky top-0 z-10"
        style={{
          borderBottomColor: 'var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-primary)'
        }}
      >
        <h2 
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Add New Product
        </h2>
        <button 
          onClick={onCancel} 
          className="p-2 rounded-full"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 
            className="text-lg font-semibold border-l-4 pl-3"
            style={{
              borderLeftColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Product Name" placeholder="e.g. Cotton T-Shirt" />
            <FormInput label="SKU / Barcode" placeholder="e.g. 12345678" />
            <div className="md:col-span-2">
              <label 
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Description
              </label>
              <textarea 
                className="w-full rounded-lg p-3 outline-none min-h-[100px]"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  borderWidth: '1px',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                placeholder="Product description..."
              />
            </div>
          </div>
        </div>

        {/* Media */}
        <div className="space-y-4">
          <h3 
            className="text-lg font-semibold border-l-4 pl-3"
            style={{
              borderLeftColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            Media
          </h3>
          <div 
            {...getRootProps()} 
            className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors"
            style={{
              borderColor: isDragActive ? 'var(--color-primary)' : 'var(--color-border-secondary)',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: isDragActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(31, 41, 55, 0.5)'
            }}
            onMouseEnter={(e) => {
              if (!isDragActive) {
                e.currentTarget.style.borderColor = 'var(--color-text-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDragActive) {
                e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
              }
            }}
          >
            <input {...getInputProps()} />
            <Upload 
              size={32} 
              className="mb-3"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <p 
              className="text-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Drag & drop images here, or <span style={{ color: 'var(--color-primary)' }}>browse</span>
            </p>
          </div>
          
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              {images.map((file, idx) => (
                <div 
                  key={idx} 
                  className="relative group aspect-square rounded-lg overflow-hidden border"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    borderColor: 'var(--color-border-secondary)'
                  }}
                >
                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setImages(images.filter((_, i) => i !== idx)); }}
                    className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: 'var(--color-error)',
                      color: 'var(--color-text-primary)',
                      borderRadius: '50%'
                    }}
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
            <h3 
              className="text-lg font-semibold border-l-4 pl-3"
              style={{
                borderLeftColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              Variations
            </h3>
            <button 
              onClick={addVariation}
              className="text-sm flex items-center gap-1"
              style={{ color: 'var(--color-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(96, 165, 250, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-primary)';
              }}
            >
              <Plus size={16} /> Add Variant
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr 
                  className="text-xs uppercase"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  <th className="p-3 rounded-tl-lg">Size</th>
                  <th className="p-3">Color</th>
                  <th className="p-3">Price ($)</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3 rounded-tr-lg w-10"></th>
                </tr>
              </thead>
              <tbody>
                {variations.map((v, i) => (
                  <tr 
                    key={i}
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderTopColor: i > 0 ? 'var(--color-border-primary)' : 'transparent',
                      borderTopWidth: i > 0 ? '1px' : '0'
                    }}
                  >
                    <td className="p-2">
                      <input 
                        value={v.size}
                        onChange={(e) => updateVariation(i, 'size', e.target.value)}
                        className="w-full rounded px-2 py-1 text-sm outline-none" 
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderWidth: '1px',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }}
                        placeholder="Size"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        value={v.color}
                        onChange={(e) => updateVariation(i, 'color', e.target.value)}
                        className="w-full rounded px-2 py-1 text-sm outline-none" 
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderWidth: '1px',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }}
                        placeholder="Color"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        value={v.price}
                        type="number"
                        onChange={(e) => updateVariation(i, 'price', e.target.value)}
                        className="w-full rounded px-2 py-1 text-sm outline-none" 
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderWidth: '1px',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        value={v.qty}
                        type="number"
                        onChange={(e) => updateVariation(i, 'qty', e.target.value)}
                        className="w-full rounded px-2 py-1 text-sm outline-none" 
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          borderWidth: '1px',
                          color: 'var(--color-text-primary)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => removeVariation(i)}
                        className="p-1"
                        style={{ color: 'var(--color-error)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'rgba(248, 113, 113, 1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-error)';
                        }}
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

      <div 
        className="p-6 border-t sticky bottom-0 z-10 flex gap-4"
        style={{
          borderTopColor: 'var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-primary)'
        }}
      >
        <button 
          onClick={onSave}
          className="flex-1 py-3 rounded-xl font-bold transition-colors"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          Save Product
        </button>
        <button 
          className="flex-1 py-3 rounded-xl font-bold transition-colors"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
          }}
        >
          Save & Add Another
        </button>
      </div>
    </div>
  );
};

const FormInput = ({ label, placeholder, type = "text" }: any) => (
  <div>
    <label 
      className="block text-sm font-medium mb-1"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {label}
    </label>
    <input 
      type={type} 
      className="w-full rounded-lg px-4 py-2 outline-none"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-secondary)',
        borderWidth: '1px',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--color-text-primary)'
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)';
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      placeholder={placeholder}
    />
  </div>
);
