import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Loader2, Plus, Minus, Search } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import * as contactsApi from '../../api/contacts';
import { SelectRentalCustomerTablet, type RentalCustomer } from './SelectRentalCustomerTablet';
import * as productsApi from '../../api/products';
import * as rentalsApi from '../../api/rentals';
import * as branchesApi from '../../api/branches';
import * as accountsApi from '../../api/accounts';

interface CreateRentalFlowProps {
  companyId: string | null;
  branchId: string | null;
  userId: string | null;
  onBack: () => void;
  onSuccess: () => void;
}

/** Step order: customer → products → duration → rent → advance → payment_confirm (if advance > 0) → confirm */
type Step = 'customer' | 'products' | 'duration' | 'rent' | 'advance' | 'payment_confirm' | 'confirm';

export function CreateRentalFlow({ companyId, branchId, userId, onBack, onSuccess }: CreateRentalFlowProps) {
  const responsive = useResponsive();
  const [step, setStep] = useState<Step>('customer');
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [products, setProducts] = useState<productsApi.RentalProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ product: productsApi.RentalProduct; quantity: number }[]>([]);
  const [manualRentAmount, setManualRentAmount] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [advancePaymentAccountId, setAdvancePaymentAccountId] = useState<string | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const needsBranchSelection = !branchId || branchId === 'all';
  const effectiveBranchId = needsBranchSelection ? selectedBranchId : branchId;

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }, [products, productSearch]);

  useEffect(() => {
    if (!companyId || !needsBranchSelection) return;
    let c = false;
    branchesApi.getBranches(companyId).then(({ data }) => {
      if (c) return;
      const list = (data || []).map((b) => ({ id: b.id, name: b.name }));
      setBranches(list);
      if (list.length === 1) setSelectedBranchId(list[0].id);
    });
    return () => { c = true; };
  }, [companyId, needsBranchSelection]);

  useEffect(() => {
    if (!companyId) return;
    let c = false;
    contactsApi.getContacts(companyId, 'customer').then(({ data }) => {
      if (c) return;
      setCustomers((data || []).map((x) => ({ id: x.id, name: x.name, phone: x.phone || '—' })));
    });
    return () => { c = true; };
  }, [companyId]);

  useEffect(() => {
    if (!companyId || step !== 'products') return;
    let c = false;
    setLoading(true);
    productsApi.getRentalProducts(companyId).then(({ data }) => {
      if (c) return;
      setLoading(false);
      setProducts(data || []);
    });
    return () => { c = true; };
  }, [companyId, step]);

  useEffect(() => {
    if (!companyId || (step !== 'payment_confirm' && step !== 'confirm')) return;
    let c = false;
    accountsApi.getPaymentAccounts(companyId).then(({ data }) => {
      if (c) return;
      setPaymentAccounts(data || []);
      if (data?.length === 1 && !advancePaymentAccountId) setAdvancePaymentAccountId(data[0].id);
    });
    return () => { c = true; };
  }, [companyId, step]);

  const addItem = (product: productsApi.RentalProduct) => {
    const existing = selectedItems.find((i) => i.product.id === product.id);
    if (existing) {
      setSelectedItems((prev) => prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setSelectedItems((prev) => [...prev, { product, quantity: 1 }]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setSelectedItems((prev) => {
      const next = prev.map((i) => (i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i));
      return next.filter((i) => i.quantity > 0);
    });
  };

  const pickup = pickupDate ? new Date(pickupDate) : null;
  const ret = returnDate ? new Date(returnDate) : null;
  const durationDays = pickup && ret && ret >= pickup ? Math.ceil((ret.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) || 1 : 0;
  const rentAmount = parseFloat(manualRentAmount) || 0;
  const paidAmount = parseFloat(advancePaid) || 0;
  const balanceDue = Math.max(0, rentAmount - paidAmount);

  const handleSave = async () => {
    if (!companyId || !effectiveBranchId || effectiveBranchId === 'all') {
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
    if (rentAmount <= 0) {
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

    setSaving(true);
    setError('');
    const n = selectedItems.length;
    const base = n === 1 ? rentAmount : Math.floor((rentAmount / n) * 100) / 100;
    const remainder = n === 1 ? 0 : Math.round((rentAmount - base * (n - 1)) * 100) / 100;
    const items = selectedItems.map((item, i) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      ratePerDay: 0,
      durationDays,
      total: i === n - 1 ? remainder : base,
    }));

    const { error: err } = await rentalsApi.createBooking({
      companyId,
      branchId: effectiveBranchId,
      userId,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      bookingDate: today,
      pickupDate,
      returnDate,
      rentalCharges: rentAmount,
      paidAmount,
      advancePaymentAccountId: paidAmount > 0 ? advancePaymentAccountId ?? undefined : undefined,
      notes: notes.trim() || null,
      items,
    });

    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onSuccess();
  };

  const goNextFromAdvance = () => {
    if (paidAmount > 0) setStep('payment_confirm');
    else setStep('confirm');
  };

  // ─── Step: Customer ─────────────────────────────────────────────────────
  if (step === 'customer') {
    if (responsive.isTablet && companyId) {
      return (
        <SelectRentalCustomerTablet
          companyId={companyId}
          onBack={onBack}
          onSelect={(c: RentalCustomer) => {
            setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone });
            setStep('products');
          }}
        />
      );
    }
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
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
        <div className="p-4 space-y-2">
          {customers.length === 0 ? (
            <p className="text-[#9CA3AF] text-center py-8">No customers. Add customers in Contacts.</p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCustomer(c);
                  setStep('products');
                }}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 text-left hover:border-[#8B5CF6]"
              >
                <p className="font-medium text-white">{c.name}</p>
                <p className="text-sm text-[#9CA3AF]">{c.phone}</p>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ─── Step 1: Product Selection ──────────────────────────────────────────
  if (step === 'products') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('customer')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-white">Select Products</h1>
                <p className="text-xs text-white/80 truncate">{selectedCustomer?.name}</p>
              </div>
            </div>
            {selectedItems.length > 0 && (
              <button
                onClick={() => setStep('duration')}
                className="shrink-0 px-4 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow"
              >
                Next
              </button>
            )}
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
                <div key={i.product.id} className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-[#374151] flex items-center justify-center text-[#9CA3AF] shrink-0">—</div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{i.product.name}</p>
                      <p className="text-sm text-[#6B7280]">SKU: {i.product.sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(i.product.id, -1)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-white font-medium w-8 text-center">{i.quantity}</span>
                    <button onClick={() => addItem(i.product)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Product list */}
          <div>
            <h2 className="text-sm font-medium text-[#9CA3AF] mb-2">Products</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-[#9CA3AF] text-sm">No rentable products found.</p>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map((p) => {
                  const item = selectedItems.find((i) => i.product.id === p.id);
                  const qty = item?.quantity ?? 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{p.name}</p>
                        <p className="text-sm text-[#6B7280]">SKU: {p.sku}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => updateQty(p.id, -1)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-white font-medium w-8 text-center">{qty}</span>
                        <button onClick={() => addItem(p)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {selectedItems.length > 0 && (
          <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
            <button
              onClick={() => setStep('duration')}
              className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
            >
              Next: Duration →
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
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
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
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-sm text-[#9CA3AF] mb-2">Selected items</p>
            {selectedItems.map((i) => (
              <div key={i.product.id} className="flex justify-between text-sm py-1">
                <span className="text-white">{i.product.name} × {i.quantity}</span>
                <span className="text-[#6B7280]">{i.product.sku}</span>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Pickup Date</label>
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              min={today}
              className="w-full max-w-full min-w-0 h-12 bg-[#1F2937] border border-[#374151] rounded-xl px-4 text-white box-border"
            />
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Return Date</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={pickupDate || today}
              className="w-full max-w-full min-w-0 h-12 bg-[#1F2937] border border-[#374151] rounded-xl px-4 text-white box-border"
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
    const canNext = rentAmount > 0;
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
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
                onClick={() => setStep('advance')}
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
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Enter Rent Amount (Rs.) *</label>
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9.]*"
              min="0"
              step="1"
              value={manualRentAmount}
              onChange={(e) => setManualRentAmount(e.target.value)}
              placeholder="Amount decided for this rental"
              className="w-full max-w-full min-w-0 h-12 bg-[#1F2937] border border-[#374151] rounded-xl px-4 text-white font-medium box-border"
            />
            <p className="text-xs text-[#6B7280] mt-1">Manager decides rent. No auto calculation from days.</p>
          </div>
        </div>
        {canNext && (
          <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
            <button
              onClick={() => setStep('advance')}
              className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
            >
              Next: Advance →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Step 4: Advance Entry ───────────────────────────────────────────────
  if (step === 'advance') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setStep('rent')} className="p-2 hover:bg-white/10 rounded-lg text-white shrink-0">
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
              <span className="font-bold text-white">Rs. {rentAmount.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Advance (Rs.) — optional</label>
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9.]*"
              min="0"
              value={advancePaid}
              onChange={(e) => setAdvancePaid(e.target.value)}
              placeholder="0"
              className="w-full max-w-full min-w-0 h-12 bg-[#1F2937] border border-[#374151] rounded-xl px-4 text-white box-border"
            />
          </div>
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
            {paidAmount > 0 ? 'Next: Payment →' : 'Next: Confirm →'}
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
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
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
                onClick={() => setStep('confirm')}
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
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Product</span><span className="text-white">{selectedItems.map((i) => i.product.name).join(', ')}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Pickup</span><span className="text-white">{pickupDate}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Return</span><span className="text-white">{returnDate}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Rent</span><span className="text-white">Rs. {rentAmount.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#9CA3AF]">Advance</span><span className="text-white">Rs. {paidAmount.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#374151]"><span className="text-[#9CA3AF]">Balance due</span><span className="text-[#F59E0B] font-medium">Rs. {balanceDue.toLocaleString()}</span></div>
          </div>
          {needAccount && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm text-[#9CA3AF] mb-2">Receive Advance Into *</label>
              <select
                value={advancePaymentAccountId ?? ''}
                onChange={(e) => setAdvancePaymentAccountId(e.target.value || null)}
                className="w-full max-w-full min-w-0 h-12 bg-[#111827] border border-[#374151] rounded-xl px-4 text-white box-border"
              >
                <option value="">Select account</option>
                {paymentAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                ))}
              </select>
              {paymentAccounts.length === 0 && <p className="text-xs text-[#F59E0B] mt-1">No payment accounts. Add Cash/Bank in Accounts.</p>}
              <p className="text-xs text-[#6B7280] mt-1">Dr Cash/Bank, Cr Rental Advance Liability.</p>
            </div>
          )}
        </div>
        <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 z-40 pb-[calc(1rem+env(safe-area-inset-bottom,0))]">
          <button
            onClick={() => setStep('confirm')}
            disabled={needAccount && !advancePaymentAccountId}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 rounded-lg font-medium text-white"
          >
            Next: Confirm Booking →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 6: Final Confirmation ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep(paidAmount > 0 ? 'payment_confirm' : 'advance')} className="p-2 hover:bg-white/10 rounded-lg text-white">
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
        {needsBranchSelection && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="block text-sm text-[#9CA3AF] mb-2">Branch *</label>
            <select
              value={selectedBranchId ?? ''}
              onChange={(e) => setSelectedBranchId(e.target.value || null)}
              className={`w-full h-12 bg-[#111827] border rounded-xl px-4 text-white ${!selectedBranchId ? 'border-[#EF4444]' : 'border-[#374151]'}`}
            >
              <option value="">Select a specific branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
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
            <div key={i.product.id} className="flex justify-between text-sm">
              <span className="text-white">{i.product.name} × {i.quantity}</span>
              <span className="text-[#6B7280]">{i.product.sku}</span>
            </div>
          ))}
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
          <div className="flex justify-between"><span className="text-[#9CA3AF]">Rent</span><span className="font-bold text-white">Rs. {rentAmount.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-[#9CA3AF]">Advance</span><span className="text-white">Rs. {paidAmount.toLocaleString()}</span></div>
          {paidAmount > 0 && advancePaymentAccountId && <div className="flex justify-between text-xs text-[#6B7280]"><span>Receive into</span><span>{paymentAccounts.find((a) => a.id === advancePaymentAccountId)?.name ?? '—'}</span></div>}
          <div className="flex justify-between pt-2 border-t border-[#374151]"><span className="text-[#9CA3AF]">Balance due</span><span className="font-bold text-[#F59E0B]">Rs. {balanceDue.toLocaleString()}</span></div>
        </div>
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
          disabled={saving || (needsBranchSelection && !effectiveBranchId) || (paidAmount > 0 && !advancePaymentAccountId)}
          className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 rounded-lg font-medium text-white flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Create Booking'}
        </button>
      </div>
    </div>
  );
}
