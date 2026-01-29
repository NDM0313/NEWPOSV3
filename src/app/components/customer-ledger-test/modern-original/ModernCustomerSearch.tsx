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
        className="w-full px-4 py-3 rounded-lg text-left text-sm focus:outline-none transition-all shadow-sm bg-gray-900 border border-gray-700 text-white hover:border-gray-600"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500/10">
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <div className="text-white font-medium">{selectedCustomer.name}</div>
              <div className="text-xs text-gray-500">{selectedCustomer.code} • {selectedCustomer.phone}</div>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform text-gray-400 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-30 w-full mt-2 rounded-lg shadow-2xl overflow-hidden bg-gray-900 border border-gray-700">
          <div className="p-3 border-b border-gray-800 bg-gray-900">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-600"
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
                className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-3 border-l-4 ${
                  selectedCustomer.id === customer.id
                    ? 'bg-gray-800 border-blue-500'
                    : 'bg-transparent border-transparent hover:bg-gray-800/50'
                }`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-800 text-gray-300">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{customer.name}</div>
                  <div className="text-xs text-gray-500">{customer.code} • {customer.phone}</div>
                </div>
                <div className="text-xs text-gray-500">{customer.city}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
