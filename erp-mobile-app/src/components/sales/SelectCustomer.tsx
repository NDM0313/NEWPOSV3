import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, Loader2, ShoppingCart, Palette } from 'lucide-react';
import type { Customer } from './SalesModule';
import type { AddContactFormData } from '../contacts/AddContactFlow';
import { AddContactFlow } from '../contacts/AddContactFlow';
import { SwipeBackShell } from '../common';
import { CustomerPickerList } from '../shared/CustomerPickerList';
import * as contactsApi from '../../api/contacts';
import { getContactDisplayPhone } from '../../api/contacts';
import { usePermissions } from '../../context/PermissionContext';
import { DateInputField } from '../shared/DateTimePicker';
import { localDatePlusDays } from '../../utils/localDate';

export type SaleDocumentStatus = 'draft' | 'quotation' | 'order' | 'final';

export interface SelectCustomerExtras {
  documentStatus?: SaleDocumentStatus;
  deadlineDate?: string;
}

interface SelectCustomerProps {
  companyId: string | null;
  branchId?: string | null;
  sessionUserId?: string | null;
  onBack: () => void;
  onSelect: (customer: Customer, saleType: 'regular' | 'studio', extras?: SelectCustomerExtras) => void;
  initialSaleType?: 'regular' | 'studio';
  onSaleTypeChange?: (saleType: 'regular' | 'studio') => void;
  initialDocumentStatus?: SaleDocumentStatus;
  initialDeadlineDate?: string;
}

function contactToCustomer(c: contactsApi.Contact): Customer {
  return { id: c.id, name: c.name, phone: getContactDisplayPhone(c) || '—', balance: c.balance };
}

export function SelectCustomer({
  companyId,
  branchId,
  sessionUserId,
  onBack,
  onSelect,
  initialSaleType = 'regular',
  onSaleTypeChange,
  initialDocumentStatus = 'order',
  initialDeadlineDate,
}: SelectCustomerProps) {
  const { canViewBalances, isModuleEnabled } = usePermissions();
  const studioModuleEnabled = isModuleEnabled('studio');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [defaultCustomer, setDefaultCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!companyId);
  const walkingInitRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saleType, setSaleType] = useState<'regular' | 'studio'>(
    studioModuleEnabled && initialSaleType === 'studio' ? 'studio' : 'regular'
  );
  const [documentStatus, setDocumentStatus] = useState<SaleDocumentStatus>(initialDocumentStatus || 'order');
  const [deadlineDate, setDeadlineDate] = useState(initialDeadlineDate || localDatePlusDays(7));
  const [view, setView] = useState<'pick' | 'addContact'>('pick');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    const next = studioModuleEnabled && initialSaleType === 'studio' ? 'studio' : 'regular';
    setSaleType(next);
    if (!studioModuleEnabled && initialSaleType === 'studio') {
      onSaleTypeChange?.('regular');
    }
  }, [initialSaleType, studioModuleEnabled, onSaleTypeChange]);

  useEffect(() => {
    setDocumentStatus(initialDocumentStatus || 'order');
  }, [initialDocumentStatus]);

  useEffect(() => {
    if (initialDeadlineDate) setDeadlineDate(initialDeadlineDate);
  }, [initialDeadlineDate]);

  const handleSaleTypeChange = (type: 'regular' | 'studio') => {
    if (type === 'studio' && !studioModuleEnabled) return;
    setSaleType(type);
    onSaleTypeChange?.(type);
  };

  const buildExtras = (): SelectCustomerExtras | undefined => {
    if (saleType !== 'regular') return undefined;
    return {
      documentStatus,
      deadlineDate: documentStatus === 'order' ? deadlineDate : undefined,
    };
  };

  useEffect(() => {
    walkingInitRef.current = false;
    if (!companyId) {
      setCustomers([]);
      setDefaultCustomer(null);
      setSelectedCustomerId(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      await contactsApi.ensureDefaultWalkingCustomerForCompany(companyId);
      const [contactsRes, walkingRes] = await Promise.all([
        contactsApi.getContacts(companyId, 'customer', branchId ?? undefined),
        contactsApi.getWalkingCustomer(companyId),
      ]);
      if (cancelled) return;
      setLoading(false);
      const list = contactsRes.error ? [] : contactsRes.data.map(contactToCustomer);
      const walking = walkingRes.data ? contactToCustomer(walkingRes.data) : null;
      if (walking && !list.some((c) => c.id === walking.id)) {
        setCustomers([walking, ...list]);
      } else {
        setCustomers(list);
      }
      setDefaultCustomer(walking);
      if (walking && !walkingInitRef.current) {
        walkingInitRef.current = true;
        setSelectedCustomerId(walking.id);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const handleAddContactSubmit = async (data: AddContactFormData) => {
    setAddError('');
    setAddSaving(true);
    try {
      if (companyId) {
        const { data: created, error } = await contactsApi.createContact(companyId, {
          name: data.name.trim(),
          phone: data.phone.trim(),
          mobile: data.mobile.trim(),
          email: data.email?.trim() || undefined,
          address: data.address?.trim() || undefined,
          city: data.city?.trim() || undefined,
          roles: data.roles.length ? data.roles : ['customer'],
          openingBalance: data.balance,
          creditLimit: data.creditLimit || undefined,
          workerType: data.workerType || undefined,
          workerRate: data.workerRate || undefined,
        });
        if (error) {
          setAddError(error);
          return;
        }
        if (created) {
          const c = contactToCustomer(created);
          setCustomers((prev) => [c, ...prev]);
          setView('pick');
          onSelect(c, saleType, buildExtras());
        }
      } else {
        const c: Customer = {
          id: `c${Date.now()}`,
          name: data.name.trim(),
          phone: getContactDisplayPhone({ phone: data.phone, mobile: data.mobile }),
          balance: 0,
        };
        setCustomers((prev) => [c, ...prev]);
        setView('pick');
        onSelect(c, saleType, buildExtras());
      }
    } finally {
      setAddSaving(false);
    }
  };

  if (view === 'addContact') {
    return (
      <SwipeBackShell onBack={() => { setView('pick'); setAddError(''); }}>
        <AddContactFlow
          onBack={() => { setView('pick'); setAddError(''); }}
          onSubmit={handleAddContactSubmit}
          error={addError}
          defaultRoles={['customer']}
          lockRoles
          title="Add New Customer"
          companyId={companyId}
          sessionUserId={sessionUserId}
          draftId="sale-customer-add"
        />
        {addSaving && (
          <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </SwipeBackShell>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-[#F9FAFB]">
            <ArrowLeft className="w-5 h-5" />
          </button>
            <h1 className="text-lg font-semibold text-[#F9FAFB]">Select Customer</h1>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-[#9CA3AF] mb-2">SALE TYPE</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleSaleTypeChange('regular')}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                saleType === 'regular' ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:border-[#10B981]/50'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Regular Sale
            </button>
            {studioModuleEnabled && (
              <button
                onClick={() => handleSaleTypeChange('studio')}
                className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  saleType === 'studio' ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:border-[#8B5CF6]/50'
                }`}
              >
                <Palette className="w-4 h-4" />
                Studio Sale
              </button>
            )}
          </div>
        </div>
        {saleType === 'regular' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-[#9CA3AF] mb-2">DOCUMENT TYPE</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'draft', label: 'Draft' },
                  { id: 'quotation', label: 'Quotation' },
                  { id: 'order', label: 'Order' },
                  { id: 'final', label: 'Final' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDocumentStatus(opt.id)}
                  className={`h-9 rounded-lg text-xs font-medium border ${
                    documentStatus === opt.id
                      ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-white'
                      : 'border-[#374151] text-[#9CA3AF]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {documentStatus === 'order' && (
              <div className="mt-3">
                <DateInputField label="Delivery Date" value={deadlineDate} onChange={setDeadlineDate} />
              </div>
            )}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer..."
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
      </div>

      <div className="p-4 pb-24">
        <CustomerPickerList
          customers={customers}
          loading={loading}
          searchQuery={searchQuery}
          onSelect={(c) => onSelect(c, saleType, buildExtras())}
          canViewBalances={canViewBalances}
          accent="blue"
          defaultCustomer={defaultCustomer}
          selectedCustomerId={selectedCustomerId}
          onSelectedCustomerIdChange={setSelectedCustomerId}
        />
      </div>

      <button
        onClick={() => setView('addContact')}
        className="mx-4 mt-4 w-[calc(100%-2rem)] py-4 border-2 border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add New Customer
      </button>
    </div>
  );
}

