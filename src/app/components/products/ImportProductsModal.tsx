import React, { useState } from 'react';
import { X, Upload, FileText, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportProductsModal = ({ isOpen, onClose }: ImportProductsModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = () => {
    if (!selectedFile) return;
    
    setImportStatus('processing');
    
    // Simulate import process
    setTimeout(() => {
      setImportStatus('success');
      setTimeout(() => {
        onClose();
        setSelectedFile(null);
        setImportStatus('idle');
      }, 2000);
    }, 2000);
  };

  const downloadTemplate = () => {
    // In real implementation, this would download an actual template file
    console.log('Downloading template...');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Upload size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Products</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload CSV or Excel file to bulk import products</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">Before You Import</h3>
                  <ul className="text-xs text-gray-300 space-y-1">
                    <li>• Download the template file and fill in your product data</li>
                    <li>• Ensure all mandatory fields are filled</li>
                    <li>• File format: CSV or Excel (.xlsx, .xls)</li>
                    <li>• Maximum file size: 5 MB</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Download Template */}
            <div>
              <label className="text-sm font-semibold text-white mb-3 block">Step 1: Download Template</label>
              <div className="flex gap-3">
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  className="flex-1 h-12 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white gap-2"
                >
                  <Download size={16} />
                  Download CSV Template
                </Button>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  className="flex-1 h-12 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white gap-2"
                >
                  <Download size={16} />
                  Download Excel Template
                </Button>
              </div>
            </div>

            {/* Required Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-white mb-2 block">Mandatory Fields</label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-1.5">
                  {[
                    'Product Name',
                    'Branch',
                    'Category',
                    'Unit',
                    'Purchase Price',
                    'Selling Price',
                    'Opening Stock',
                  ].map((field) => (
                    <div key={field} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <span className="text-gray-300">{field}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-white mb-2 block">Optional Fields</label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-1.5">
                  {[
                    'SKU (auto-generated if empty)',
                    'Brand',
                    'Product Type',
                    'Image URL',
                    'Rental Enabled (Yes/No)',
                    'Studio Enabled (Yes/No)',
                  ].map((field) => (
                    <div key={field} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                      <span className="text-gray-400">{field}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div>
              <label className="text-sm font-semibold text-white mb-3 block">Step 2: Upload File</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 transition-all",
                  isDragging 
                    ? "border-blue-500 bg-blue-500/10" 
                    : selectedFile 
                    ? "border-green-500 bg-green-500/10"
                    : "border-gray-700 bg-gray-800/30"
                )}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 mx-auto flex items-center justify-center mb-3">
                      <FileText size={32} className="text-green-500" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-700 mx-auto flex items-center justify-center mb-3">
                      <Upload size={32} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">
                      Drag and drop your file here
                    </p>
                    <p className="text-xs text-gray-400 mb-4">or</p>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg cursor-pointer inline-block transition-colors">
                        Browse Files
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-3">Supports: CSV, Excel (.xlsx, .xls)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Import Status */}
            {importStatus !== 'idle' && (
              <div className={cn(
                "p-4 rounded-xl border",
                importStatus === 'processing' && "bg-blue-500/10 border-blue-500/30",
                importStatus === 'success' && "bg-green-500/10 border-green-500/30",
                importStatus === 'error' && "bg-red-500/10 border-red-500/30"
              )}>
                <div className="flex items-center gap-3">
                  {importStatus === 'processing' && (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-blue-400">Processing import...</span>
                    </>
                  )}
                  {importStatus === 'success' && (
                    <>
                      <CheckCircle2 size={20} className="text-green-500" />
                      <span className="text-sm text-green-400">Import completed successfully!</span>
                    </>
                  )}
                  {importStatus === 'error' && (
                    <>
                      <AlertCircle size={20} className="text-red-500" />
                      <span className="text-sm text-red-400">Import failed. Please check your file.</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
            <Button
              onClick={onClose}
              variant="outline"
              className="h-10 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || importStatus === 'processing'}
              className="h-10 bg-blue-600 hover:bg-blue-500 text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importStatus === 'processing' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Import Products
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
