import { useState } from 'react';
import { X, Settings2, Eye, EyeOff, RotateCcw } from 'lucide-react';

interface CustomizeColumnsModalProps {
  visibleColumns: Record<string, boolean>;
  onUpdate: (columns: Record<string, boolean>) => void;
  onClose: () => void;
}

export function CustomizeColumnsModal({ visibleColumns, onUpdate, onClose }: CustomizeColumnsModalProps) {
  const [localColumns, setLocalColumns] = useState({ ...visibleColumns });

  const columnDefinitions = [
    { key: 'date', label: 'Date', description: 'Transaction date', required: true },
    { key: 'reference', label: 'Reference No', description: 'Transaction reference number', required: true },
    { key: 'type', label: 'Type', description: 'Document type (Sale/Payment/Discount)', required: false },
    { key: 'description', label: 'Description', description: 'Transaction description', required: false },
    { key: 'paymentAccount', label: 'Payment Method', description: 'Payment account used', required: false },
    { key: 'notes', label: 'Notes', description: 'Additional notes', required: false },
    { key: 'debit', label: 'Debit', description: 'Debit amount', required: true },
    { key: 'credit', label: 'Credit', description: 'Credit amount', required: true },
    { key: 'balance', label: 'Running Balance', description: 'Current balance', required: true },
  ];

  const handleToggle = (key: string, required: boolean) => {
    if (required) return; // Don't allow toggling required columns
    setLocalColumns({ ...localColumns, [key]: !localColumns[key] });
  };

  const handleSelectAll = () => {
    const allSelected = columnDefinitions.reduce((acc, col) => {
      acc[col.key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setLocalColumns(allSelected);
  };

  const handleReset = () => {
    const defaultColumns = {
      date: true,
      reference: true,
      type: true,
      description: true,
      paymentAccount: true,
      notes: true,
      debit: true,
      credit: true,
      balance: true,
    };
    setLocalColumns(defaultColumns);
  };

  const handleApply = () => {
    onUpdate(localColumns);
    onClose();
  };

  const visibleCount = Object.values(localColumns).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: '#273548' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          className="px-8 py-6"
          style={{ 
            borderBottom: '1px solid #334155',
            background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(100, 116, 139, 0.08))'
          }}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <Settings2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl" style={{ color: '#e2e8f0' }}>Customize Columns</h2>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Choose which columns to display in the table</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-8 py-6">
          {/* Quick Actions */}
          <div 
            className="flex items-center justify-between mb-6 pb-4"
            style={{ borderBottom: '1px solid rgba(100, 116, 139, 0.2)' }}
          >
            <div className="text-sm" style={{ color: '#94a3b8' }}>
              {visibleCount} of {columnDefinitions.length} columns visible
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2"
                style={{ 
                  background: 'rgba(100, 116, 139, 0.2)',
                  color: '#cbd5e1'
                }}
              >
                <Eye className="w-4 h-4" />
                Show All
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2"
                style={{ 
                  background: 'rgba(100, 116, 139, 0.2)',
                  color: '#cbd5e1'
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Default
              </button>
            </div>
          </div>

          {/* Column List */}
          <div className="space-y-2">
            {columnDefinitions.map((column) => {
              const isVisible = localColumns[column.key];
              const isRequired = column.required;

              return (
                <div
                  key={column.key}
                  onClick={() => handleToggle(column.key, isRequired)}
                  className="p-4 rounded-xl transition-all cursor-pointer"
                  style={{
                    border: isVisible
                      ? '2px solid rgba(59, 130, 246, 0.5)'
                      : '2px solid rgba(100, 116, 139, 0.3)',
                    background: isVisible
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(30, 41, 59, 0.3)',
                    opacity: isRequired ? 0.75 : 1,
                    cursor: isRequired ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: isVisible ? '#3b82f6' : 'rgba(100, 116, 139, 0.3)'
                        }}
                      >
                        {isVisible ? (
                          <Eye className="w-5 h-5 text-white" />
                        ) : (
                          <EyeOff className="w-5 h-5" style={{ color: '#64748b' }} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="text-sm"
                            style={{ color: isVisible ? '#60a5fa' : '#cbd5e1' }}
                          >
                            {column.label}
                          </div>
                          {isRequired && (
                            <span 
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ 
                                background: 'rgba(249, 115, 22, 0.2)',
                                color: '#fb923c'
                              }}
                            >
                              Required
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                          {column.description}
                        </div>
                      </div>
                    </div>
                    <div 
                      className="w-12 h-6 rounded-full transition-colors relative"
                      style={{
                        background: isVisible ? '#3b82f6' : 'rgba(100, 116, 139, 0.3)'
                      }}
                    >
                      <div 
                        className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                        style={{
                          transform: isVisible ? 'translateX(1.75rem)' : 'translateX(0.25rem)'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Box */}
          <div 
            className="mt-6 p-4 rounded-xl"
            style={{ 
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Settings2 className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <div className="text-sm mb-1" style={{ color: '#60a5fa' }}>Column Customization Tips</div>
                <ul className="text-xs space-y-1" style={{ color: '#93c5fd' }}>
                  <li>• Required columns (Date, Reference, Debit, Credit, Balance) cannot be hidden</li>
                  <li>• Your customization will apply to the table view and exports</li>
                  <li>• Use "Show All" to display all available columns</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div 
          className="px-8 py-5 flex justify-between items-center"
          style={{ 
            borderTop: '1px solid #334155',
            background: 'rgba(30, 41, 59, 0.5)'
          }}
        >
          <div className="text-sm" style={{ color: '#94a3b8' }}>
            Changes will be applied immediately
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm rounded-lg transition-colors"
              style={{ 
                background: 'rgba(100, 116, 139, 0.2)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#cbd5e1'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
