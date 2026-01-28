import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, User } from 'lucide-react';
import type { Customer } from '@/app/services/customerLedgerTypes';

interface ModernCustomerSearchProps {
  customers: Customer[];
  selectedCustomer: Customer;
  onSelect: (customer: Customer) => void;
}

export function ModernCustomerSearch({ customers, selectedCustomer, onSelect }: ModernCustomerSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  return (
    <div className="relative flex-1 max-w-md" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-lg text-left text-sm focus:outline-none transition-all shadow-sm"
        style={{
          background: '#273548',
          border: '1px solid #334155',
          color: '#ffffff'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            }}>
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <div style={{ color: '#ffffff' }}>{selectedCustomer.name}</div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>{selectedCustomer.code} • {selectedCustomer.phone}</div>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: '#94a3b8' }} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-30 w-full mt-2 rounded-xl shadow-xl overflow-hidden" style={{
          background: '#273548',
          border: '1px solid #334155'
        }}>
          <div className="p-3" style={{ 
            borderBottom: '1px solid #334155',
            background: '#1e293b'
          }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none"
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#ffffff'
                }}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-80">
            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  onSelect(customer);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-3`}
                style={{
                  background: selectedCustomer.id === customer.id ? '#334155' : 'transparent',
                  borderLeft: selectedCustomer.id === customer.id ? '4px solid #3b82f6' : '4px solid transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                onMouseLeave={(e) => e.currentTarget.style.background = selectedCustomer.id === customer.id ? '#334155' : 'transparent'}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{
                  background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                }}>
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div style={{ color: '#ffffff' }}>{customer.name}</div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>{customer.code} • {customer.phone}</div>
                </div>
                <div className="text-xs" style={{ color: '#64748b' }}>{customer.city}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
