import { useState } from 'react';
import { X, SlidersHorizontal, Calendar, DollarSign, FileText } from 'lucide-react';

interface AdvancedFilterModalProps {
  onClose: () => void;
}

export function AdvancedFilterModal({ onClose }: AdvancedFilterModalProps) {
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const paymentAccounts = ['Cash Account', 'HBL Bank Account', 'UBL Bank Account', 'JazzCash Wallet', '-'];
  const documentTypes = ['Sale', 'Studio Sale', 'Payment', 'Discount'];

  const handleApply = () => {
    // Apply filters logic here
    onClose();
  };

  const handleReset = () => {
    setAmountMin('');
    setAmountMax('');
    setSelectedAccounts([]);
    setSelectedTypes([]);
  };

  const toggleAccount = (account: string) => {
    setSelectedAccounts(prev =>
      prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: '#273548' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          className="px-8 py-6"
          style={{ 
            borderBottom: '1px solid #334155',
            background: 'linear-gradient(to right, rgba(99, 102, 241, 0.1), rgba(59, 130, 246, 0.08))'
          }}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <SlidersHorizontal className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl" style={{ color: '#e2e8f0' }}>Advanced Filters</h2>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Refine your transaction search with multiple criteria</p>
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
          <div className="space-y-6">
            {/* Amount Range */}
            <div>
              <label className="flex items-center gap-2 text-sm mb-3" style={{ color: '#e2e8f0' }}>
                <DollarSign className="w-4 h-4" />
                Amount Range
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-2" style={{ color: '#94a3b8' }}>Minimum Amount</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ 
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(100, 116, 139, 0.3)',
                      color: '#e2e8f0'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-2" style={{ color: '#94a3b8' }}>Maximum Amount</label>
                  <input
                    type="number"
                    placeholder="999999"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ 
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(100, 116, 139, 0.3)',
                      color: '#e2e8f0'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Document Types */}
            <div>
              <label className="flex items-center gap-2 text-sm mb-3" style={{ color: '#e2e8f0' }}>
                <FileText className="w-4 h-4" />
                Document Types
              </label>
              <div className="grid grid-cols-3 gap-3">
                {documentTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className="p-4 rounded-xl transition-all"
                    style={{
                      border: selectedTypes.includes(type) 
                        ? '2px solid #6366f1' 
                        : '2px solid rgba(100, 116, 139, 0.3)',
                      background: selectedTypes.includes(type)
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'rgba(30, 41, 59, 0.3)'
                    }}
                  >
                    <div 
                      className="text-sm"
                      style={{ color: selectedTypes.includes(type) ? '#a5b4fc' : '#cbd5e1' }}
                    >
                      {type}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Accounts */}
            <div>
              <label className="flex items-center gap-2 text-sm mb-3" style={{ color: '#e2e8f0' }}>
                <Calendar className="w-4 h-4" />
                Payment Accounts
              </label>
              <div className="grid grid-cols-2 gap-3">
                {paymentAccounts.map((account) => (
                  <label
                    key={account}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      border: selectedAccounts.includes(account)
                        ? '2px solid #6366f1'
                        : '2px solid rgba(100, 116, 139, 0.3)',
                      background: selectedAccounts.includes(account)
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'rgba(30, 41, 59, 0.3)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account)}
                      onChange={() => toggleAccount(account)}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <span 
                      className="text-sm"
                      style={{ color: selectedAccounts.includes(account) ? '#a5b4fc' : '#cbd5e1' }}
                    >
                      {account === '-' ? 'No Payment Account' : account}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Active Filters Summary */}
            <div 
              className="rounded-xl p-4"
              style={{ 
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}
            >
              <div className="text-sm mb-2" style={{ color: '#a5b4fc' }}>Active Filters</div>
              <div className="text-xs" style={{ color: '#818cf8' }}>
                {amountMin || amountMax ? (
                  <div>• Amount: {amountMin || '0'} - {amountMax || '∞'}</div>
                ) : null}
                {selectedTypes.length > 0 && (
                  <div>• Types: {selectedTypes.join(', ')}</div>
                )}
                {selectedAccounts.length > 0 && (
                  <div>• Accounts: {selectedAccounts.length} selected</div>
                )}
                {!amountMin && !amountMax && selectedTypes.length === 0 && selectedAccounts.length === 0 && (
                  <div style={{ color: '#64748b' }}>No filters applied</div>
                )}
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
          <button
            onClick={handleReset}
            className="px-6 py-2.5 text-sm rounded-lg transition-colors"
            style={{ 
              background: 'rgba(100, 116, 139, 0.2)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              color: '#cbd5e1'
            }}
          >
            Reset All
          </button>
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
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
