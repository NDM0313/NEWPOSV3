import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Loader2, Plus, Minus, Search, ChevronDown, FileText } from 'lucide-react';
import { ProductImage } from '../products/ProductImage';
import { DateInputField } from '../shared/DateTimePicker';
import { CustomerPickerList } from '../shared/CustomerPickerList';
import { AddContactFlow, type AddContactFormData } from '../contacts/AddContactFlow';
import { getContactDisplayPhone } from '../../api/contacts';
import { usePermissions } from '../../context/PermissionContext';
import { useResponsive } from '../../hooks/useResponsive';
import * as contactsApi from '../../api/contacts';
import { SelectRentalCustomerTablet, type RentalCustomer } from './SelectRentalCustomerTablet';
import * as productsApi from '../../api/products';
import * as rentalsApi from '../../api/rentals';
import * as branchesApi from '../../api/branches';
import * as accountsApi from '../../api/accounts';
import * as usersApi from '../../api/users';
import { TransactionSuccessModal, type TransactionSuccessData } from '../shared/TransactionSuccessModal';
import { CustomSelect, CustomSearchableSheet, NumericInput } from '../common';
import { localNowDateString, formatLocalDateTimeDisplay } from '../../utils/localDate';
import type { User } from '../../types';
import { useEffectiveWorkerId, useEffectiveWorkerProfileId, useEffectiveWorkerRole } from '../../context/CounterWorkerContext';
import { useWriteBranchSelection } from '../../hooks/useWriteBranchSelection';
import { WriteBranchPickerField } from '../shared/WriteBranchPickerField';
import { isRealBranchUuid } from '../../utils/branchId';
import { useSubmitLock } from '../../contexts/LoadingContext';

interface CreateRentalFlowProps {
  companyId: string | null;
  branchId: string | null;
  userId: string | null;
  userRole?: User['role'];
  onBack: () => void;
  onSuccess: () => void;
}

/** Step order: customer → products (qty + variation) → duration → rent → salesman → advance → payment_confirm (if advance > 0) → documents (NSC) → confirm */
type Step = 'customer' | 'products' | 'duration' | 'rent' | 'salesman' | 'advance' | 'payment_confirm' | 'documents' | 'confirm';

interface SelectedRentalItem {
  key: string; // product.id + optional variationId
  product: productsApi.RentalProduct;
  variationId: string | null;
  variationLabel: string | null;
  quantity: number;
}

const SECURITY_DOC_TYPES = ['CNIC', 'Passport', 'Driver License', 'Other'] as const;

export function CreateRentalFlow({ companyId, branchId, userId, userRole, onBack, onSuccess }: CreateRentalFlowProps) {
  const responsive = useResponsive();
  const effectiveUserId = useEffectiveWorkerId(userId ?? '');
  const effectiveProfileId = useEffectiveWorkerProfileId();
  const effectiveRole = useEffectiveWorkerRole(userRole ?? 'admin');
  const {
    effectiveBranchId: writeBranchId,
    needsPicker,
    pickerBranches,
    pickedBranchId,
    setPickedBranchId,
  } = useWriteBranchSelection({
    companyId,
    globalBranchId: branchId,
    userRole: effectiveRole,
    authUserId: effectiveUserId,
    profileId: effectiveProfileId,
  });
  const { canViewBalances } = usePermissions();
  const [step, setStep] = useState<Step>('customer');
  const [customers, setCustomers] = useState<RentalCustomer[]>([]);
  const [defaultCustomer, setDefaultCustomer] = useState<RentalCustomer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const walkingInitRef = useRef(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPickView, setCustomerPickView] = useState<'pick' | 'addContact'>('pick');
  const [addCustomerError, setAddCustomerError] = useState('');
  const [addCustomerSaving, setAddCustomerSaving] = useState(false);
  const [products, setProducts] = useState<productsApi.RentalProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [variationPickerProduct, setVariationPickerProduct] = useState<productsApi.RentalProduct | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<RentalCustomer | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedRentalItem[]>([]);
  const [lineRateMap, setLineRateMap] = useState<Record<string, string>>({});
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [advancePaymentAccountId, setAdvancePaymentAccountId] = useState<string | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [salesmen, setSalesmen] = useState<usersApi.SalesmanRow[]>([]);
  const [salesmanId, setSalesmanId] = useState<string | null>(null);
  const [commissionPct, setCommissionPct] = useState('');
  const [securityDocType, setSecurityDocType] = useState<string>('');
  const [securityDocNumber, setSecurityDocNumber] = useState('');
  const [securityDocImageUrl, setSecurityDocImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { run: runSave, busy: saving } = useSubmitLock();
  const [error, setError] = useState('');
  const [confirmationData, setConfirmationData] = useState<TransactionSuccessData | null>(null);
  /** Local calendar "today" for date pickers (not UTC). */
  const today = localNowDateString();

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }, [products, productSearch]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setCustomersLoading(true);
    void (async () => {
      await contactsApi.ensureDefaultWalkingCustomerForCompany(companyId);
      const [contactsRes, walkingRes] = await Promise.all([
        contactsApi.getContacts(companyId, 'customer', branchId ?? undefined),
        contactsApi.getWalkingCustomer(companyId),
      ]);
      if (cancelled) return;
      setCustomersLoading(false);
      const list = (contactsRes.data || []).map((x) => ({
        id: x.id,
        name: x.name,
        phone: getContactDisplayPhone(x) || '—',
        balance: x.balance,
      }));
      const walking = walkingRes.data
        ? {
            id: walkingRes.data.id,
            name: walkingRes.data.name,
            phone: getContactDisplayPhone(walkingRes.data) || '—',
            balance: walkingRes.data.balance,
          }
        : null;
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
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  const handleAddRentalCustomer = async (data: AddContactFormData) => {
    if (!companyId) return;
    setAddCustomerError('');
    setAddCustomerSaving(true);
    try {
      const { data: created, error } = await contactsApi.createContact(companyId, {
        name: data.name.trim(),
        phone: data.phone.trim(),
        mobile: data.mobile.trim(),
        email: data.email?.trim() || undefined,
        city: data.city?.trim() || undefined,
        address: data.address?.trim() || undefined,
        roles: data.roles.length ? data.roles : ['customer'],
        openingBalance: data.balance,
        creditLimit: data.creditLimit || undefined,
      });
      if (error) {
        setAddCustomerError(error);
        return;
      }
      if (created) {
        const customer: RentalCustomer = {
          id: created.id,
          name: created.name,
          phone: getContactDisplayPhone(created) || '—',
          balance: created.balance,
        };
        setCustomers((prev) => [customer, ...prev]);
        setCustomerPickView('pick');
        setSelectedCustomer(customer);
        setStep('products');
      }
    } finally {
      setAddCustomerSaving(false);
    }
  };

  useEffect(() => {
    if (!companyId || step !== 'products') return;
    let c = false;
    setLoading(true);
    void (async () => {
      await productsApi.invalidateProductsListCache(companyId);
      const { data } = await productsApi.getRentalProducts(companyId);
      if (c) return;
      setLoading(false);
      setProducts(data || []);
    })();
    return () => { c = true; };
  }, [companyId, step]);

  useEffect(() => {
    if (!companyId || (step !== 'advance' && step !== 'payment_confirm' && step !== 'confirm')) return;
    let c = false;
    accountsApi.getPaymentAccounts(companyId).then(({ data }) => {
      if (c) return;
      setPaymentAccounts(data || []);
      if (data?.length === 1 && !advancePaymentAccountId) setAdvancePaymentAccountId(data[0].id);
    });
    return () => { c = true; };
  }, [companyId, step, advancePaymentAccountId]);

  useEffect(() => {
    if (!companyId || step !== 'salesman' || salesmen.length > 0) return;
    let c = false;
    usersApi.getSalesmen(companyId).then(({ data }) => {
      if (c) return;
      setSalesmen(data || []);
    });
    return () => { c = true; };
  }, [companyId, step, salesmen.length]);

  useEffect(() => {
    if (step !== 'salesman') return;
    if (salesmanId) return;
    if (!userId || userRole === 'admin' || userRole === 'owner') return;
    const me = salesmen.find((s) => s.id === userId);
    if (!me) return;
    setSalesmanId(me.id);
    const defPct = me.rentalCommissionPercent ?? me.defaultCommissionPercent ?? null;
    if (defPct != null) setCommissionPct(String(defPct));
  }, [step, salesmanId, userId, userRole, salesmen]);

  const itemKey = (productId: string, variationId?: string | null) =>
    variationId ? `${productId}:${variationId}` : productId;

  const addSimpleItem = (product: productsApi.RentalProduct) => {
    if (product.hasVariations && product.variations.length > 0) {
      setVariationPickerProduct(product);
      return;
    }
    const key = itemKey(product.id, null);
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      return [
        ...prev,
        { key, product, variationId: null, variationLabel: null, quantity: 1 },
      ];
    });
  };

  const addVariation = (product: productsApi.RentalProduct, variation: productsApi.RentalProductVariation) => {
    const key = itemKey(product.id, variation.id);
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      return [
        ...prev,
        { key, product, variationId: variation.id, variationLabel: variation.label, quantity: 1 },
      ];
    });
    setVariationPickerProduct(null);
  };

  const updateQty = (key: string, delta: number) => {
    setSelectedItems((prev) => {
      const next = prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i));
      return next.filter((i) => i.quantity > 0);
    });
  };

  useEffect(() => {
    setLineRateMap((prev) => {
      const next = { ...prev };
      selectedItems.forEach((item) => {
        if (next[item.key] == null) {
          next[item.key] = String(Number(item.product.rentPricePerDay || 0));
        }
      });
      Object.keys(next).forEach((k) => {
        if (!selectedItems.some((item) => item.key === k)) delete next[k];
      });
      return next;
    });
  }, [selectedItems]);

  const pickup = pickupDate ? new Date(pickupDate) : null;
  const ret = returnDate ? new Date(returnDate) : null;
  const durationDays = pickup && ret && ret >= pickup ? Math.ceil((ret.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) || 1 : 0;
  const itemsRentAmount = selectedItems.reduce((sum, item) => {
    const lineRate = Number(lineRateMap[item.key] ?? item.product.rentPricePerDay ?? 0) || 0;
    return sum + lineRate * item.quantity;
  }, 0);
  const extraExpense = 0;
  /** Line rent only (posted as rental_charges); devaluation posts Dr Rental Expense / Cr Rental Income, not added into rental_charges. */
  const customerRentTotal = Math.max(0, itemsRentAmount);
  const paidAmount = parseFloat(advancePaid) || 0;
  const balanceDue = Math.max(0, customerRentTotal - paidAmount);
  const commissionBasePreview = Math.max(0, customerRentTotal - extraExpense);

  const handleSave = async () => {
    if (!companyId || !writeBranchId || !isRealBranchUuid(writeBranchId)) {
      setError('Select a specific branch.');
      return;
    }
    if (!selectedCustomer) {
      setError('Select a customer.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Add at least one product.');
      return;
    }
    if (customerRentTotal <= 0) {
      setError('Enter a valid rent amount.');
      return;
    }
    if (!pickupDate || !returnDate) {
      setError('Select pickup and return dates.');
      return;
    }
    if (ret && pickup && ret < pickup) {
      setError('Return date must be after pickup date.');
      return;
    }
    if (paidAmount > 0 && !advancePaymentAccountId) {
      setError('Select payment account (Receive Advance Into).');
      return;
    }

    await runSave('Creating booking...', async () => {
    setError('');
    const items = selectedItems.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      ratePerDay: Number(lineRateMap[item.key] ?? item.product.rentPricePerDay ?? 0) || 0,
      durationDays,
      total: (Number(lineRateMap[item.key] ?? item.product.rentPricePerDay ?? 0) || 0) * item.quantity,
      variationId: item.variationId,
      variationLabel: item.variationLabel,
    }));

    const commissionPctNum = commissionPct.trim() ? parseFloat(commissionPct) : NaN;

    const { data: createResult, error: err } = await rentalsApi.createBooking({
      companyId,
      branchId: writeBranchId,
      userId,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      bookingDate: localNowDateString(),
      pickupDate,
      returnDate,
      rentalCharges: customerRentTotal,
      paidAmount,
      advancePaymentAccountId: paidAmount > 0 ? advancePaymentAccountId ?? undefined : undefined,
      notes: [notes.trim()]
        .filter(Boolean)
        .join(' | ') || null,
      salesmanId: salesmanId || null,
      commissionPercent: Number.isFinite(commissionPctNum) ? commissionPctNum : null,
      securityDocumentType: securityDocType || null,
      securityDocumentNumber: securityDocNumber.trim() || null,
      securityDocumentImageUrl: securityDocImageUrl.trim() || null,
      items,
    });

    if (err) {
      setError(err);
      return;
    }
    let branchName: string | null = pickerBranches.find((b) => b.id === writeBranchId)?.name ?? null;
    if (!branchName && companyId) {
      const { data: branchList } = await branchesApi.getBranches(companyId);
      branchName = branchList?.find((b) => b.id === writeBranchId)?.name ?? null;
    }
    setConfirmationData({
      type: 'rental',
      title: 'Booking Saved Successfully',
      transactionNo: createResult?.booking_no ?? null,
      amount: customerRentTotal,
      partyName: selectedCustomer.name,
      date: undefined,
      dateDisplay: formatLocalDateTimeDisplay(new Date()),
      branch: branchName ?? undefined,
      entityId: createResult?.id ?? null,
    });
    });
  };

  const goNextFromAdvance = () => {
    if (paidAmount > 0 && !advancePaymentAccountId) {
      setError('Select payment account (Receive Advance Into).');
      return;
    }
    setStep('documents');
  };

  const closeRentalSuccessModal = () => {
    setConfirmationData(null);
    onSuccess();
  };

  if (confirmationData) {
    return (
      <>
        <div className="fixed inset-0 bg-[#111827]" />
        <TransactionSuccessModal
          isOpen={true}
          data={confirmationData}
          onClose={closeRentalSuccessModal}
          onViewPurchase={closeRentalSuccessModal}
          onBack={closeRentalSuccessModal}
        />
      </>
    );
  }

  // ─── Step: Customer ─────────────────────────────────────────────────────
  if (step === 'customer') {
    if (responsive.isTablet && companyId) {
      return (
        <SelectRentalCustomerTablet
          companyId={companyId}
          onBack={onBack}
          onSelect={(c: RentalCustomer) => {
            setSelectedCustomer(c);
            setStep('products');
          }}
        />
      );
    }
    if (customerPickView === 'addContact') {
      return (
        <>
          <AddContactFlow
            onBack={() => { setCustomerPickView('pick'); setAddCustomerError(''); }}
            onSubmit={handleAddRentalCustomer}
            error={addCustomerError}
            defaultRoles={['customer']}
            lockRoles
            title="Add New Customer"
          />
          {addCustomerSaving && (
            <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
          )}
        </>
      );
    }

    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-10 flow-screen-header">
          <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">New Booking</h1>
                <p className="text-xs text-white/80">Select customer</p>
              </div>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer..."
                className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>
        </div>
        <div className="p-4 pb-24">
          <CustomerPickerList
            customers={customers}
            loading={customersLoading}
            searchQuery={customerSearch}
            onSelect={(c) => {
              setSelectedCustomer(c);
              setStep('products');
            }}
            canViewBalances={canViewBalances}
            accent="purple"
            defaultCustomer={defaultCustomer}
            selectedCustomerId={selectedCustomerId}
            onSelectedCustomerIdChange={setSelectedCustomerId}
            emptyMessage={customers.length === 0 && !customersLoading ? 'No customers. Add a customer below.' : 'No customers found'}
          />
        </div>
        <button
          type="button"
          onClick={() => setCustomerPickView('addContact')}
          className="mx-4 mb-6 w-[calc(100%-2rem)] py-4 border-2 border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#8B5CF6] hover:text-[#8B5CF6] flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Customer
        </button>
      </div>
    );
  }

  // ─── Step 1: Product Selection ──────────────────────────────────────────
  if (step === 'products') {
    return (
      <div className={`min-h-screen bg-[#111827] ${selectedItems.length > 0 ? 'pb-28' : 'pb-8'}`}>
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setStep('customer')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white">Select Products</h1>
              <p className="text-xs text-white/80 truncate">{selectedCustomer?.name}</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Product search bar at top */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search product by name or SKU"
              className="w-full h-12 pl-10 pr-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280]"
            />
          </div>
          {/* Selected product card(s) */}
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-[#9CA3AF]">Selected</p>
              {selectedItems.map((i) => (
                <div key={i.key} className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-[#374151] overflow-hidden shrink-0 flex items-center justify-center">
                      <ProductImage
                        src={i.product.imageUrls?.[0]}
                        alt={i.product.name}
                        variant="thumb"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{i.product.name}</p>
                      {i.variationLabel ? (
                        <p className="text-xs text-[#8B5CF6] truncate">{i.variationLabel}</p>
                      ) : null}
                      <p className="text-sm text-[#6B7280]">SKU: {i.product.sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(i.key, -1)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-white font-medium w-8 text-center">{i.quantity}</span>
                    <button
                      onClick={() => {
                        if (i.variationId) {
                          setSelectedItems((prev) => prev.map((x) => (x.key === i.key ? { ...x, quantity: x.quantity + 1 } : x)));
                        } else {
                          addSimpleItem(i.product);
                        }
                      }}
                      className="p-2 hover:bg-[#374151] rounded-lg text-white"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h2 className="text-sm font-medium text-[#9CA3AF]">Add from list</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="text-[#9CA3AF] text-sm">No rentable products found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const totalQty = selectedItems
                  .filter((i) => i.product.id === p.id)
                  .reduce((s, i) => s + i.quantity, 0);
                const hasVars = p.hasVariations && p.variations.length > 0;
                const rentHint = p.rentPricePerDay ? `Rs. ${p.rentPricePerDay.toLocaleString()}/day` : 'Rent';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addSimpleItem(p)}
                    className={`bg-[#1F2937] border rounded-xl p-3 text-left transition-all active:scale-95 ${
                      totalQty > 0 ? 'border-[#8B5CF6] ring-1 ring-[#8B5CF6]/30' : 'border-[#374151] hover:border-[#8B5CF6]'
                    }`}
                  >
                    <div className="w-full h-16 bg-[#111827] rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                      <ProductImage
                        src={p.imageUrls?.[0]}
                        alt={p.name}
                        variant="thumb"
                        deferUntilVisible
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h4 className="font-medium text-sm text-white line-clamp-2 leading-tight mb-1">{p.name}</h4>
                    <p className="text-[10px] text-[#6B7280] line-clamp-1">SKU: {p.sku}</p>
                    <div className="flex items-center justify-between mt-2 gap-1">
                      <span className="text-xs font-semibold text-[#8B5CF6]">{rentHint}</span>
                      {totalQty > 0 ? (
                        <span className="text-xs bg-[#8B5CF6]/20 text-[#C4B5FD] px-1.5 py-0.5 rounded">×{totalQty}</span>
                      ) : hasVars ? (
                        <ChevronDown className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                      ) : (
                        <Plus className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {variationPickerProduct && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setVariationPickerProduct(null)}>
            <div className="w-full max-w-md bg-[#1F2937] border border-[#374151] rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{variationPickerProduct.name}</p>
                  <p className="text-xs text-[#9CA3AF]">Pick a variation</p>
                </div>
                <button onClick={() => setVariationPickerProduct(null)} className="text-[#9CA3AF] hover:text-white text-sm">Close</button>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {variationPickerProduct.variations.map((v) => {
                  const key = itemKey(variationPickerProduct.id, v.id);
                  const qty = selectedItems.find((i) => i.key === key)?.quantity ?? 0;
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between bg-[#111827] border border-[#374151] rounded-xl p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate">{v.label}</p>
                        <p className="text-xs text-[#6B7280]">SKU: {v.sku || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(key, -1)}
                          className="p-2 hover:bg-[#374151] rounded-lg text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-white font-medium w-6 text-center text-sm">{qty}</span>
                        <button
                          type="button"
                          onClick={() => addVariation(variationPickerProduct, v)}
                          className="p-2 hover:bg-[#374151] rounded-lg text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {variationPickerProduct.variations.length === 0 && (
                  <p className="text-sm text-[#9CA3AF] text-center py-4">No variations available.</p>
                )}
              </div>
            </div>
          </div>
        )}
        {selectedItems.length > 0 && (
          <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
            <button
              onClick={() => setStep('duration')}
              className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
            >
              Next ({selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}) →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Step 2: Duration Selection ──────────────────────────────────────────
  if (step === 'duration') {
    const datesValid = pickupDate && returnDate && (!pickup || !ret || ret >= pickup);
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('products')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-white">Duration</h1>
                <p className="text-xs text-white/80 truncate">{selectedCustomer?.name}</p>
              </div>
            </div>
            {datesValid && (
              <button
                onClick={() => setStep('rent')}
                className="shrink-0 px-4 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow"
              >
                Next
              </button>
            )}
          </div>
        </div>
        <div className="p-4 space-y-4 max-w-full min-w-0 w-full box-border overflow-x-hidden">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-sm text-[#9CA3AF] mb-2">Selected items</p>
            {selectedItems.map((i) => (
              <div key={i.key} className="flex justify-between text-sm py-1">
                <span className="text-white">{i.product.name}{i.variationLabel ? ` (${i.variationLabel})` : ''} × {i.quantity}</span>
                <span className="text-[#6B7280]">{i.product.sku}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInputField
              label="Pickup Date"
              value={pickupDate}
              min={today}
              accent="rental"
              onChange={(value) => {
                const v = value && value < today ? today : value;
                setPickupDate(v);
                if (returnDate && v && returnDate < v) setReturnDate(v);
              }}
              required
            />
            <DateInputField
              label="Return Date"
              value={returnDate}
              min={pickupDate || today}
              accent="rental"
              onChange={(value) => {
                const minReturn = pickupDate || today;
                const v = value && value < minReturn ? minReturn : value;
                setReturnDate(v);
              }}
              required
            />
          </div>
          <p className="text-xs text-[#6B7280]">Dates are for booking period and availability. Rent amount is entered in the next step.</p>
        </div>
        {datesValid && (
          <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
            <button
              onClick={() => setStep('rent')}
              className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
            >
              Next: Rent Amount →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Step 3: Manual Rent Entry ───────────────────────────────────────────
  if (step === 'rent') {
    const canNext = customerRentTotal > 0;
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('duration')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-white">Rent Amount</h1>
                <p className="text-xs text-white/80 truncate">{selectedCustomer?.name}</p>
              </div>
            </div>
            {canNext && (
              <button
                onClick={() => setStep('salesman')}
                className="shrink-0 px-4 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow"
              >
                Next
              </button>
            )}
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-sm text-[#9CA3AF]">Dates</p>
            <p className="font-medium text-white">{pickupDate} → {returnDate}</p>
            <p className="text-xs text-[#6B7280]">{durationDays} days (for reservation only)</p>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#9CA3AF]">Set rent per selected dress *</label>
            {selectedItems.map((item) => (
              <div key={item.key} className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {item.product.name}
                      {item.variationLabel ? ` (${item.variationLabel})` : ''}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">Qty: {item.quantity}</p>
                  </div>
                  <NumericInput
                    value={lineRateMap[item.key] ?? String(item.product.rentPricePerDay || 0)}
                    onChange={(v) => setLineRateMap((prev) => ({ ...prev, [item.key]: v }))}
                    allowDecimal
                    min={0}
                    className="w-28 shrink-0"
                    inputClassName="h-10 text-sm text-right"
                  />
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-[#6B7280]">Line total</span>
                  <span className="text-[#D1D5DB]">
                    Rs. {((Number(lineRateMap[item.key] ?? item.product.rentPricePerDay ?? 0) || 0) * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Items rent</span>
              <span className="text-white">Rs. {itemsRentAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Dress devaluation (wear)</span>
              <span className="text-white">Auto (from Settings)</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#374151]">
              <span className="text-[#9CA3AF]">Customer rent (ledger)</span>
              <span className="text-[#10B981] font-semibold">Rs. {customerRentTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
        {canNext && (
          <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
            <button
              onClick={() => setStep('salesman')}
              className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
            >
              Next: Salesman →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Step: Salesman + Commission ─────────────────────────────────────────
  if (step === 'salesman') {
    const commissionNum = parseFloat(commissionPct);
    const commissionValid = commissionPct.trim() === '' || (Number.isFinite(commissionNum) && commissionNum >= 0 && commissionNum <= 100);
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('rent')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-white">Salesman</h1>
                <p className="text-xs text-white/80 truncate">Optional — commission tracking</p>
              </div>
            </div>
            <button
              disabled={!commissionValid}
              onClick={() => setStep('advance')}
              className="shrink-0 px-4 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 disabled:opacity-60 rounded-lg font-medium text-sm shadow"
            >
              Next
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <CustomSearchableSheet
              label="Salesman"
              sheetTitle="Salesman"
              value={salesmanId ?? ''}
              onChange={(id) => {
                if (!id) {
                  setSalesmanId(null);
                  setCommissionPct('');
                  return;
                }
                setSalesmanId(id);
                const picked = salesmen.find((s) => s.id === id);
                const defPct = picked?.rentalCommissionPercent ?? picked?.defaultCommissionPercent ?? null;
                if (defPct != null) setCommissionPct(String(defPct));
                else setCommissionPct('');
              }}
              options={[
                { value: '', label: '— None —' },
                ...salesmen.map((s) => ({
                  value: s.id,
                  label: s.name,
                  description: s.role || undefined,
                })),
              ]}
              placeholder="Search salesman…"
              searchPlaceholder="Search…"
              hint={salesmen.length === 0 ? 'No salesmen configured. Enable "can be salesman" in user permissions.' : undefined}
              zIndexClass="z-[100]"
            />
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Commission %</label>
            <NumericInput
              value={commissionPct}
              onChange={setCommissionPct}
              allowDecimal
              min={0}
              max={100}
              placeholder="0"
              disabled={!salesmanId}
            />
            {salesmanId && commissionNum > 0 && Number.isFinite(commissionNum) && (
              <p className="text-xs text-[#10B981] mt-1">
                Commission amount: Rs.{' '}
                {Math.round(commissionBasePreview * (commissionNum / 100)).toLocaleString()} on Rs.{' '}
                {commissionBasePreview.toLocaleString()} (after devaluation)
              </p>
            )}
            {!commissionValid && <p className="text-xs text-[#EF4444] mt-1">Enter a percentage between 0 and 100.</p>}
          </div>
        </div>
        <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
          <button
            disabled={!commissionValid}
            onClick={() => setStep('advance')}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 rounded-lg font-medium text-white"
          >
            Next: Advance →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 4: Advance Entry ───────────────────────────────────────────────
  if (step === 'advance') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('salesman')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-white">Advance</h1>
                <p className="text-xs text-white/80 truncate">{selectedCustomer?.name}</p>
              </div>
            </div>
            <button
              onClick={goNextFromAdvance}
              className="shrink-0 px-4 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow"
            >
              Next
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Rent amount</span>
              <span className="font-bold text-white">Rs. {customerRentTotal.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Advance (Rs.) — optional</label>
            <NumericInput
              value={advancePaid}
              onChange={setAdvancePaid}
              allowDecimal
              min={0}
              prefix="Rs."
              placeholder="0"
            />
          </div>
          {paidAmount > 0 && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <CustomSelect
                label="Receive Advance Into *"
                value={advancePaymentAccountId ?? ''}
                onChange={(v) => setAdvancePaymentAccountId(v || null)}
                options={[
                  { value: '', label: 'Select account' },
                  ...paymentAccounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} (${acc.code})`,
                  })),
                ]}
                zIndexClass="z-[100]"
              />
              {paymentAccounts.length === 0 && <p className="text-xs text-[#F59E0B] mt-1">No payment accounts. Add Cash/Bank in Accounts.</p>}
            </div>
          )}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex justify-between pt-2 border-t border-[#374151]">
              <span className="text-[#9CA3AF]">Balance due</span>
              <span className="font-bold text-[#F59E0B]">Rs. {balanceDue.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
          <button
            onClick={goNextFromAdvance}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
          >
            Next: Documents →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step: Documents (NSC security doc) ──────────────────────────────────
  if (step === 'documents') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('advance')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-white">Security Document</h1>
                <p className="text-xs text-white/80 truncate">Optional — collected at booking</p>
              </div>
            </div>
            <button
              onClick={() => setStep('confirm')}
              className="shrink-0 px-4 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow"
            >
              Next
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-start gap-2">
            <FileText className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5" />
            <p className="text-xs text-[#9CA3AF]">
              Record the customer’s identity document held as security (CNIC, Passport, etc.). You can also skip and capture it at pickup.
            </p>
          </div>
          <div>
            <CustomSelect
              label="Document Type"
              value={securityDocType}
              onChange={setSecurityDocType}
              options={[{ value: '', label: '— None —' }, ...SECURITY_DOC_TYPES.map((t) => ({ value: t, label: t }))]}
              zIndexClass="z-[100]"
            />
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Document Number</label>
            <input
              type="text"
              value={securityDocNumber}
              onChange={(e) => setSecurityDocNumber(e.target.value)}
              placeholder="e.g. 42101-1234567-8"
              disabled={!securityDocType}
              className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-xl px-4 text-white disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Document Image URL (optional)</label>
            <input
              type="url"
              value={securityDocImageUrl}
              onChange={(e) => setSecurityDocImageUrl(e.target.value)}
              placeholder="https://…"
              className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-xl px-4 text-white"
            />
            <p className="text-xs text-[#6B7280] mt-1">Paste a link to an uploaded scan (Supabase storage etc.).</p>
          </div>
        </div>
        <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
          <button
            onClick={() => setStep('confirm')}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
          >
            Next: Confirm Booking →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 5: Payment Confirmation (Receive Advance Into) ─────────────────
  if (step === 'payment_confirm') {
    const needAccount = paidAmount > 0;
    const canNext = !needAccount || advancePaymentAccountId;
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('advance')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-white">Payment</h1>
                <p className="text-xs text-white/80 truncate">Receive advance into</p>
              </div>
            </div>
            {canNext && (
              <button
                onClick={() => setStep('documents')}
                className="shrink-0 px-4 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow"
              >
                Next
              </button>
            )}
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <p className="text-sm text-[#9CA3AF]">Summary</p>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Product</span><span className="text-white">{selectedItems.map((i) => i.product.name + (i.variationLabel ? ` (${i.variationLabel})` : '')).join(', ')}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Pickup</span><span className="text-white">{pickupDate}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Return</span><span className="text-white">{returnDate}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Rent</span><span className="text-white">Rs. {customerRentTotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Advance</span><span className="text-white">Rs. {paidAmount.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#374151]"><span className="text-[#9CA3AF]">Balance due</span><span className="text-[#F59E0B] font-medium">Rs. {balanceDue.toLocaleString()}</span></div>
          </div>
          {needAccount && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <CustomSelect
                label="Receive Advance Into *"
                value={advancePaymentAccountId ?? ''}
                onChange={(v) => setAdvancePaymentAccountId(v || null)}
                options={[
                  { value: '', label: 'Select account' },
                  ...paymentAccounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} (${acc.code})`,
                  })),
                ]}
                zIndexClass="z-[100]"
              />
              {paymentAccounts.length === 0 && <p className="text-xs text-[#F59E0B] mt-1">No payment accounts. Add Cash/Bank in Accounts.</p>}
              <p className="text-xs text-[#6B7280] mt-1">Dr Cash/Bank, Cr customer receivable; rental charges Dr AR / Cr Rental Income.</p>
            </div>
          )}
        </div>
        <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
          <button
            onClick={() => setStep('documents')}
            disabled={needAccount && !advancePaymentAccountId}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 rounded-lg font-medium text-white"
          >
            Next: Documents →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 6: Final Confirmation ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('documents')} className="p-2 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white">Confirm Booking</h1>
            <p className="text-xs text-white/80">{selectedCustomer?.name}</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {error && <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-xl text-[#FCA5A5] text-sm">{error}</div>}
        {needsPicker && pickerBranches.length > 1 && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <WriteBranchPickerField
              branches={pickerBranches}
              value={pickedBranchId}
              onChange={setPickedBranchId}
              helperText="Rental booking will be recorded under the selected branch."
              zIndexClass="z-[100]"
            />
          </div>
        )}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="text-sm text-[#9CA3AF]">Customer</p>
          <p className="font-medium text-white">{selectedCustomer?.name}</p>
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="text-sm text-[#9CA3AF]">Dates</p>
          <p className="font-medium text-white">{pickupDate} → {returnDate}</p>
          <p className="text-xs text-[#6B7280]">{durationDays} days</p>
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="text-sm text-[#9CA3AF] mb-2">Selected items</p>
          {selectedItems.map((i) => (
            <div key={i.key} className="flex justify-between text-sm">
              <span className="text-white">
                {i.product.name}
                {i.variationLabel ? <span className="text-[#8B5CF6]"> ({i.variationLabel})</span> : null}
                {' × '}{i.quantity}
              </span>
              <span className="text-[#6B7280]">{i.product.sku}</span>
            </div>
          ))}
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
          <div className="flex justify-between"><span className="text-[#9CA3AF]">Rent</span><span className="font-bold text-white">Rs. {customerRentTotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-[#9CA3AF]">Advance</span><span className="text-white">Rs. {paidAmount.toLocaleString()}</span></div>
          {paidAmount > 0 && advancePaymentAccountId && <div className="flex justify-between text-xs text-[#6B7280]"><span>Receive into</span><span>{paymentAccounts.find((a) => a.id === advancePaymentAccountId)?.name ?? '—'}</span></div>}
          <div className="flex justify-between pt-2 border-t border-[#374151]"><span className="text-[#9CA3AF]">Balance due</span><span className="font-bold text-[#F59E0B]">Rs. {balanceDue.toLocaleString()}</span></div>
        </div>
        {salesmanId && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-1">
            <p className="text-sm text-[#9CA3AF]">Salesman</p>
            <p className="text-white font-medium">{salesmen.find((s) => s.id === salesmanId)?.name ?? '—'}</p>
            {commissionPct.trim() !== '' && Number.isFinite(parseFloat(commissionPct)) && (
              <p className="text-xs text-[#10B981]">
                Commission: {commissionPct}% → Rs.{' '}
                {Math.round(commissionBasePreview * (parseFloat(commissionPct) / 100)).toLocaleString()}
              </p>
            )}
          </div>
        )}
        {securityDocType && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-1">
            <p className="text-sm text-[#9CA3AF]">Security Document</p>
            <p className="text-white font-medium">
              {securityDocType}
              {securityDocNumber ? ` — ${securityDocNumber}` : ''}
            </p>
            {securityDocImageUrl && <p className="text-xs text-[#6B7280] truncate">{securityDocImageUrl}</p>}
          </div>
        )}
        <div>
          <label className="block text-sm text-[#9CA3AF] mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={2}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl px-4 py-2 text-white"
          />
        </div>
      </div>
      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom fixed-bottom-above-nav z-40">
        <button
          onClick={handleSave}
          disabled={saving || !writeBranchId || (paidAmount > 0 && !advancePaymentAccountId)}
          className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 rounded-lg font-medium text-white flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Create Booking'}
        </button>
      </div>
    </div>
  );
}
