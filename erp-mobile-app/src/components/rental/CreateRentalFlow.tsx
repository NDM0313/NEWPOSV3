import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Plus, Minus } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import * as contactsApi from '../../api/contacts';
import { SelectRentalCustomerTablet, type RentalCustomer } from './SelectRentalCustomerTablet';
import * as productsApi from '../../api/products';
import * as rentalsApi from '../../api/rentals';

interface CreateRentalFlowProps {
  companyId: string | null;
  branchId: string | null;
  userId: string | null;
  onBack: () => void;
  onSuccess: () => void;
}

type Step = 'customer' | 'products' | 'confirm';

export function CreateRentalFlow({ companyId, branchId, userId, onBack, onSuccess }: CreateRentalFlowProps) {
  const responsive = useResponsive();
  const [step, setStep] = useState<Step>('customer');
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [products, setProducts] = useState<productsApi.RentalProduct[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ product: productsApi.RentalProduct; quantity: number }[]>([]);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

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
  const rentalCharges = selectedItems.reduce(
    (sum, i) => sum + (i.product.rentPricePerDay * durationDays * i.quantity),
    0
  );
  const paidAmount = parseFloat(advancePaid) || 0;

  const handleSave = async () => {
    if (!companyId || !branchId || branchId === 'all') {
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
    if (!pickupDate || !returnDate) {
      setError('Select pickup and return dates.');
      return;
    }
    if (ret && pickup && ret < pickup) {
      setError('Return date must be after pickup date.');
      return;
    }

    setSaving(true);
    setError('');
    const items = selectedItems.map((i) => ({
      productId: i.product.id,
      productName: i.product.name,
      quantity: i.quantity,
      ratePerDay: i.product.rentPricePerDay,
      durationDays,
      total: i.product.rentPricePerDay * durationDays * i.quantity,
    }));

    const { error: err } = await rentalsApi.createBooking({
      companyId,
      branchId,
      userId,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      bookingDate: today,
      pickupDate,
      returnDate,
      rentalCharges,
      paidAmount,
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

  if (step === 'products') {
    return (
      <div className="min-h-screen bg-[#111827] pb-32">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('customer')} className="p-2 hover:bg-white/10 rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">Add Items</h1>
              <p className="text-xs text-white/80">{selectedCustomer?.name}</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Pickup Date</label>
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              min={today}
              className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Return Date</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={pickupDate || today}
              className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white"
            />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#9CA3AF] mb-2">Products ({products.length})</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-[#9CA3AF] text-sm">No rentable products. Enable rental on products in web.</p>
            ) : (
              <div className="space-y-2">
                {products.map((p) => {
                  const item = selectedItems.find((i) => i.product.id === p.id);
                  const qty = item?.quantity ?? 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="text-sm text-[#8B5CF6]">Rs. {p.rentPricePerDay.toLocaleString()}/day</p>
                      </div>
                      <div className="flex items-center gap-2">
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
          {selectedItems.length > 0 && (
            <div className="pt-4 border-t border-[#374151]">
              <p className="text-sm text-[#9CA3AF] mb-2">Duration: {durationDays} days</p>
              <p className="text-lg font-bold text-[#8B5CF6]">Rs. {rentalCharges.toLocaleString()}</p>
              <button
                onClick={() => setStep('confirm')}
                className="mt-4 w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg font-medium text-white"
              >
                Next: Confirm →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('products')} className="p-2 hover:bg-white/10 rounded-lg text-white">
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
          <p className="text-sm text-[#9CA3AF] mb-2">Items</p>
          {selectedItems.map((i) => (
            <div key={i.product.id} className="flex justify-between">
              <span className="text-white">{i.product.name} × {i.quantity}</span>
              <span className="text-[#8B5CF6]">Rs. {(i.product.rentPricePerDay * durationDays * i.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm text-[#9CA3AF] mb-2">Advance (Rs.)</label>
          <input
            type="number"
            value={advancePaid}
            onChange={(e) => setAdvancePaid(e.target.value)}
            placeholder="0"
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg px-4 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-[#9CA3AF] mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={2}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-2 text-white"
          />
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Total</span>
            <span className="font-bold text-[#8B5CF6]">Rs. {rentalCharges.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom fixed-bottom-above-nav z-40">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 rounded-lg font-medium text-white flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Create Booking'}
        </button>
      </div>
    </div>
  );
}
