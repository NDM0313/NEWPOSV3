'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { contactService, Contact } from '@/app/services/contactService';
import { cn } from '@/app/components/ui/utils';

interface CustomerSelectorProps {
  companyId: string;
  selectedCustomer: Contact | null;
  onSelect: (customer: Contact | null) => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  companyId,
  selectedCustomer,
  onSelect,
}) => {
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadCustomers();
    }
  }, [companyId]);

  const loadCustomers = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await contactService.getAllContacts(companyId);
      setCustomers(
        (data || []).filter((c) => c.type === 'customer' || c.type === 'both'),
      );
    } catch (error) {
      console.error('[CUSTOMER SELECTOR] Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(search) ||
      customer.phone?.toLowerCase().includes(search) ||
      customer.mobile?.toLowerCase().includes(search) ||
      customer.code?.toLowerCase().includes(search)
    );
  });

  const handleSelect = (customer: Contact) => {
    onSelect(customer);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2 cursor-pointer hover:border-gray-600"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Search size={16} className="text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground">
          {selectedCustomer ? selectedCustomer.name : 'Search by Name / Phone / Code'}
        </span>
        <ChevronDown size={16} className="text-muted-foreground" />
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-xl z-20 max-h-96 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-border">
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-muted border-border text-foreground"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">No customers found</div>
              ) : (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => handleSelect(customer)}
                    className={cn(
                      "p-3 hover:bg-muted cursor-pointer border-b border-border",
                      selectedCustomer?.id === customer.id && "bg-muted"
                    )}
                  >
                    <div className="font-medium text-foreground">{customer.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {customer.code && <span>Code: {customer.code}</span>}
                      {customer.phone && (
                        <span className={customer.code ? ' | ' : ''}>Phone: {customer.phone}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
