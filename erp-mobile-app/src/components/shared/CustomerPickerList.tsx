import type { ReactNode } from 'react';
import { Phone, Loader2, Star, UserRound } from 'lucide-react';
import { getPartyBalanceLabel } from '../../utils/balancePrivacy';

export interface CustomerPickerItem {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

const ACCENT = {
  blue: {
    hover: 'hover:border-[#3B82F6]',
    avatarBg: 'bg-[#3B82F6]/10',
    avatarText: 'text-[#3B82F6]',
    spinner: 'text-[#3B82F6]',
  },
  purple: {
    hover: 'hover:border-[#8B5CF6]',
    avatarBg: 'bg-[#8B5CF6]/10',
    avatarText: 'text-[#8B5CF6]',
    spinner: 'text-[#8B5CF6]',
  },
} as const;

function CustomerBalanceLine({ balance, canView }: { balance: number; canView: boolean }) {
  const label = getPartyBalanceLabel(balance, canView);
  if (!label) return null;
  return (
    <p className={`text-xs mt-2 ${balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{label}</p>
  );
}

export interface CustomerPickerListProps {
  customers: CustomerPickerItem[];
  loading: boolean;
  searchQuery: string;
  onSelect: (customer: CustomerPickerItem) => void;
  canViewBalances: boolean;
  accent?: keyof typeof ACCENT;
  recentCount?: number;
  emptyMessage?: string;
  footer?: ReactNode;
  /** Walk-in customer pinned above recent list; default selection. */
  defaultCustomer?: CustomerPickerItem | null;
  selectedCustomerId?: string | null;
  onSelectedCustomerIdChange?: (id: string) => void;
}

function customerCardClass(isSelected: boolean, hover: string): string {
  return `w-full bg-[#1F2937] border rounded-xl p-4 ${hover} transition-all text-left ${
    isSelected ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/40' : 'border-[#374151]'
  }`;
}

export function CustomerPickerList({
  customers,
  loading,
  searchQuery,
  onSelect,
  canViewBalances,
  accent = 'blue',
  recentCount = 3,
  emptyMessage = 'No customers found',
  footer,
  defaultCustomer,
  selectedCustomerId,
  onSelectedCustomerIdChange,
}: CustomerPickerListProps) {
  const styles = ACCENT[accent];

  const listExcludingDefault = defaultCustomer
    ? customers.filter((c) => c.id !== defaultCustomer.id)
    : customers;

  const filtered = listExcludingDefault.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone !== '—' && c.phone.includes(searchQuery))
  );
  const recentCustomers = !searchQuery.trim()
    ? listExcludingDefault.slice(0, recentCount)
    : [];

  const handleCustomerClick = (customer: CustomerPickerItem) => {
    if (selectedCustomerId != null && onSelectedCustomerIdChange) {
      if (selectedCustomerId === customer.id) {
        onSelect(customer);
      } else {
        onSelectedCustomerIdChange(customer.id);
      }
      return;
    }
    onSelect(customer);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${styles.spinner}`} />
      </div>
    );
  }

  return (
    <>
      {!searchQuery.trim() && defaultCustomer && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3 uppercase">Walk-in</h2>
          <button
            type="button"
            onClick={() => handleCustomerClick(defaultCustomer)}
            className={customerCardClass(selectedCustomerId === defaultCustomer.id, styles.hover)}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#10B981]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <UserRound className="w-5 h-5 text-[#10B981]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white mb-1">{defaultCustomer.name}</h3>
                {defaultCustomer.phone && defaultCustomer.phone !== '—' ? (
                  <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{defaultCustomer.phone}</span>
                  </div>
                ) : null}
                <CustomerBalanceLine balance={defaultCustomer.balance} canView={canViewBalances} />
              </div>
            </div>
          </button>
        </div>
      )}

      {recentCustomers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT CUSTOMERS</h2>
          <div className="space-y-2">
            {recentCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleCustomerClick(customer)}
                className={customerCardClass(selectedCustomerId === customer.id, styles.hover)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white mb-1">{customer.name}</h3>
                    {customer.phone && customer.phone !== '—' ? (
                      <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{customer.phone}</span>
                      </div>
                    ) : null}
                    <CustomerBalanceLine balance={customer.balance} canView={canViewBalances} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">
          {searchQuery.trim() ? 'SEARCH RESULTS' : 'ALL CUSTOMERS'}
        </h2>
        <div className="space-y-2">
          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => handleCustomerClick(customer)}
              className={customerCardClass(selectedCustomerId === customer.id, styles.hover)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 ${styles.avatarBg} rounded-full flex items-center justify-center flex-shrink-0`}
                >
                  <span className={`text-sm font-semibold ${styles.avatarText}`}>
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white mb-1">{customer.name}</h3>
                  {customer.phone && customer.phone !== '—' ? (
                    <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>{customer.phone}</span>
                    </div>
                  ) : null}
                  <CustomerBalanceLine balance={customer.balance} canView={canViewBalances} />
                </div>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#9CA3AF]">{emptyMessage}</div>
        )}
      </div>
      {footer}
    </>
  );
}
