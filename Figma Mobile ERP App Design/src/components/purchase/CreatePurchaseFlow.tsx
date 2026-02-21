import { useState } from 'react';
import { ArrowLeft, Search, Plus, Minus, Trash2, Package, ChevronRight, Lock, X, Edit2 } from 'lucide-react';

interface CreatePurchaseFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  costPrice: number;
  wholesalePrice: number;
  stock: number;
  variations?: string[];
}

interface PurchaseItem {
  id: string;
  product: Product;
  quantity: number;
  rate: number;
  total: number;
  variation?: string;
  packingData?: PackingData;
}

type Step = 'supplier' | 'products' | 'summary' | 'payment' | 'confirmation';

export function CreatePurchaseFlow({ onBack, onComplete }: CreatePurchaseFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('supplier');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'credit'>('cash');
  const [notes, setNotes] = useState('');
  
  // Product dialog state
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Mock suppliers
  const suppliers: Supplier[] = [
    { id: '1', name: 'ABC Textiles', phone: '+92 300 1111111', balance: 50000 },
    { id: '2', name: 'XYZ Suppliers', phone: '+92 321 2222222', balance: 0 },
    { id: '3', name: 'Premium Fabrics Ltd', phone: '+92 333 3333333', balance: 35000 },
    { id: '4', name: 'Quality Materials Co', phone: '+92 345 4444444', balance: 12000 },
  ];

  // Mock products with variations
  const products: Product[] = [
    { id: '1', name: 'Cotton Fabric', sku: 'FAB-001', unit: 'Meter', costPrice: 500, wholesalePrice: 450, stock: 100, variations: ['White', 'Black', 'Blue'] },
    { id: '2', name: 'Silk Fabric', sku: 'FAB-002', unit: 'Meter', costPrice: 1200, wholesalePrice: 1100, stock: 50, variations: ['Red', 'Golden', 'Silver'] },
    { id: '3', name: 'Thread', sku: 'THR-001', unit: 'Roll', costPrice: 50, wholesalePrice: 45, stock: 200 },
    { id: '4', name: 'Buttons', sku: 'BTN-001', unit: 'Pack', costPrice: 25, wholesalePrice: 20, stock: 500, variations: ['Pearl', 'Plastic', 'Metal'] },
    { id: '5', name: 'Zippers', sku: 'ZIP-001', unit: 'Piece', costPrice: 80, wholesalePrice: 70, stock: 150, variations: ['Small', 'Medium', 'Large'] },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;
  const dueAmount = total - paymentAmount;

  const handleAddProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditingIndex(null);
    setShowProductDialog(true);
  };

  const handleEditProduct = (index: number) => {
    const item = items[index];
    const product = products.find(p => p.id === item.product.id);
    if (product) {
      setSelectedProduct(product);
      setEditingIndex(index);
      setShowProductDialog(true);
    }
  };

  const handleRemoveProduct = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveProduct = (item: PurchaseItem) => {
    if (editingIndex !== null) {
      setItems(items.map((p, i) => i === editingIndex ? item : p));
    } else {
      setItems([...items, item]);
    }
    setShowProductDialog(false);
    setSelectedProduct(null);
    setEditingIndex(null);
  };

  // STEP 1: Supplier Selection
  if (currentStep === 'supplier') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">New Purchase</h1>
              <p className="text-xs text-[#9CA3AF]">Step 1: Select Supplier</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                placeholder="Search suppliers..."
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#10B981]"
              />
            </div>
          </div>

          <div className="space-y-3">
            {suppliers.map((supplier) => (
              <button
                key={supplier.id}
                onClick={() => {
                  setSelectedSupplier(supplier);
                  setCurrentStep('products');
                }}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{supplier.name}</h3>
                    <p className="text-sm text-[#9CA3AF]">{supplier.phone}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                </div>
                {supplier.balance > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#374151] flex items-center justify-between text-sm">
                    <span className="text-[#9CA3AF]">Balance Payable</span>
                    <span className="font-semibold text-[#EF4444]">Rs. {supplier.balance.toLocaleString()}</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <button className="w-full mt-4 h-12 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium flex items-center justify-center gap-2">
            <Plus size={20} />
            Add New Supplier
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: Add Products
  if (currentStep === 'products') {
    return (
      <div className="min-h-screen pb-32 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('supplier')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base">Add Products</h1>
              <p className="text-xs text-[#9CA3AF]">{selectedSupplier?.name}</p>
            </div>
          </div>
        </div>

        {/* Cart */}
        {items.length > 0 && (
          <div className="p-4 bg-[#1F2937] border-b border-[#374151]">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">CART ({items.length} items)</h3>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.id} className="bg-[#111827] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-[#F9FAFB]">{item.product.name}</p>
                      {item.variation && (
                        <p className="text-xs text-[#9CA3AF]">Variation: {item.variation}</p>
                      )}
                      {item.packingData && (
                        <p className="text-xs text-[#3B82F6] mt-1">
                          📦 {item.packingData.boxes.length} boxes • {item.packingData.pieceCount || (item.packingData.boxes.reduce((sum, box) => sum + box.pieces.filter(p => p.quantity > 0).length, 0) + item.packingData.loosePieces.filter(p => p.quantity > 0).length)} pieces • {item.packingData.totalQuantity} {item.product.unit}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditProduct(index)}
                        className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-[#3B82F6]" />
                      </button>
                      <button
                        onClick={() => handleRemoveProduct(index)}
                        className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-[#EF4444]" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-[#9CA3AF]">
                      Qty: {item.quantity} × Rs. {item.rate.toLocaleString()}
                    </div>
                    <div className="font-semibold text-[#10B981]">
                      Rs. {item.total.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products List */}
        <div className="p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#10B981]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => handleAddProduct(product)}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#10B981] active:scale-95 transition-all text-left"
              >
                <div className="w-full h-20 bg-[#111827] rounded-lg mb-2 flex items-center justify-center">
                  <Package className="w-8 h-8 text-[#6B7280]" />
                </div>
                <h4 className="font-medium text-sm mb-1 text-[#F9FAFB] line-clamp-1">{product.name}</h4>
                <p className="text-xs text-[#9CA3AF] mb-2">{product.unit}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#10B981]">
                    Rs. {product.costPrice.toLocaleString()}
                  </span>
                  <Plus className="w-4 h-4 text-[#10B981]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        {items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#9CA3AF]">Subtotal</span>
              <span className="text-xl font-bold text-[#F9FAFB]">
                Rs. {subtotal.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setCurrentStep('summary')}
              className="w-full h-12 bg-[#10B981] hover:bg-[#059669] rounded-lg font-medium transition-colors active:scale-[0.98]"
            >
              Continue to Summary →
            </button>
          </div>
        )}

        {/* Product Dialog */}
        {showProductDialog && selectedProduct && (
          <ProductDialog
            product={selectedProduct}
            existingItem={editingIndex !== null ? items[editingIndex] : null}
            onClose={() => {
              setShowProductDialog(false);
              setSelectedProduct(null);
              setEditingIndex(null);
            }}
            onSave={handleSaveProduct}
          />
        )}
      </div>
    );
  }

  // STEP 3: Summary
  if (currentStep === 'summary') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('products')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">Purchase Summary</h1>
              <p className="text-xs text-[#9CA3AF]">Step 3: Review Order</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Supplier */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Supplier</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedSupplier?.name}</p>
                <p className="text-sm text-[#6B7280]">{selectedSupplier?.phone}</p>
              </div>
              <button onClick={() => setCurrentStep('supplier')} className="text-sm text-[#3B82F6]">
                Change
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#9CA3AF]">Items ({items.length})</h3>
              <button onClick={() => setCurrentStep('products')} className="text-sm text-[#3B82F6]">
                Edit
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-2 border-b border-[#374151] last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-xs text-[#6B7280]">{item.quantity} × Rs. {item.rate.toLocaleString()}</p>
                  </div>
                  <span className="font-semibold">Rs. {item.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calculations */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Subtotal</span>
              <span className="font-semibold">Rs. {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9CA3AF]">Discount</span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder="0"
                className="w-32 h-9 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-right"
              />
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
              <span>Total</span>
              <span className="text-[#10B981]">Rs. {total.toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#10B981]"
            />
          </div>

          <button
            onClick={() => setCurrentStep('payment')}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold"
          >
            Proceed to Payment
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: Payment
  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setCurrentStep('summary')} className="p-2 hover:bg-[#374151] rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">Payment</h1>
              <p className="text-xs text-[#9CA3AF]">Step 4: Record Payment</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Total Amount */}
          <div className="bg-gradient-to-br from-[#10B981]/10 to-[#3B82F6]/10 border border-[#10B981]/30 rounded-xl p-6 text-center">
            <p className="text-sm text-[#9CA3AF] mb-2">Total Purchase Amount</p>
            <p className="text-3xl font-bold text-[#10B981]">Rs. {total.toLocaleString()}</p>
          </div>

          {/* Payment Method */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-3 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: '💵' },
                { id: 'bank', label: 'Bank', icon: '🏦' },
                { id: 'credit', label: 'Credit', icon: '📝' },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as typeof paymentMethod)}
                  className={`p-3 rounded-lg border transition-all ${
                    paymentMethod === method.id
                      ? 'bg-[#10B981]/10 border-[#10B981] text-white'
                      : 'bg-[#111827] border-[#374151] text-[#9CA3AF]'
                  }`}
                >
                  <div className="text-2xl mb-1">{method.icon}</div>
                  <div className="text-xs font-medium">{method.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Amount */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <label className="text-sm font-medium text-[#9CA3AF] mb-3 block">Payment Amount</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              placeholder="0"
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-lg font-semibold text-center focus:outline-none focus:border-[#10B981]"
            />
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[25, 50, 75, 100].map((percent) => (
                <button
                  key={percent}
                  onClick={() => setPaymentAmount((total * percent) / 100)}
                  className="h-9 bg-[#111827] border border-[#374151] rounded-lg text-xs font-medium hover:border-[#10B981]"
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          {/* Due Amount */}
          {dueAmount > 0 && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#F59E0B]">Amount Due</span>
                <span className="text-xl font-bold text-[#F59E0B]">Rs. {dueAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setCurrentStep('confirmation')}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold"
          >
            Confirm Purchase
          </button>
        </div>
      </div>
    );
  }

  // STEP 5: Confirmation
  return (
    <div className="min-h-screen pb-24 bg-[#111827] flex items-center justify-center">
      <div className="p-8 text-center">
        <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="text-5xl">✓</div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Purchase Confirmed!</h2>
        <p className="text-[#9CA3AF] mb-6">Order placed with {selectedSupplier?.name}</p>
        
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-6 text-left">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Items</span>
              <span className="font-medium">{items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Total Amount</span>
              <span className="font-semibold">Rs. {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Paid</span>
              <span className="font-semibold text-[#10B981]">Rs. {paymentAmount.toLocaleString()}</span>
            </div>
            {dueAmount > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-[#374151]">
                <span className="text-[#F59E0B]">Due</span>
                <span className="font-semibold text-[#F59E0B]">Rs. {dueAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// Product Dialog Component - EXACTLY like Sales
interface ProductDialogProps {
  product: Product;
  existingItem: PurchaseItem | null;
  onClose: () => void;
  onSave: (item: PurchaseItem) => void;
}

interface Piece {
  id: string;
  quantity: number;
}

interface Box {
  id: string;
  pieces: Piece[];
}

interface PackingData {
  boxes: Box[];
  loosePieces: Piece[];
  totalQuantity: number;
  pieceCount?: number; // For lumpsum mode - actual piece count
}

function ProductDialog({ product, existingItem, onClose, onSave }: ProductDialogProps) {
  const hasVariations = (product.variations?.length || 0) > 0;
  const [variation, setVariation] = useState(existingItem?.variation || product.variations?.[0] || '');
  const [quantity, setQuantity] = useState(existingItem?.quantity || 1);
  const [price, setPrice] = useState(existingItem?.rate || product.costPrice);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [packingData, setPackingData] = useState<PackingData | null>(existingItem?.packingData || null);

  const allowDecimal = product.unit === 'Meter' || product.unit === 'Yard';
  const step = allowDecimal ? 0.25 : 1;
  const minQty = allowDecimal ? 0.25 : 1;

  // Update quantity when packing changes
  const effectiveQuantity = packingData ? packingData.totalQuantity : quantity;
  const total = price * effectiveQuantity;

  const incrementQuantity = () => {
    if (!packingData) {
      setQuantity(quantity + step);
    }
  };

  const decrementQuantity = () => {
    if (!packingData) {
      setQuantity(Math.max(minQty, quantity - step));
    }
  };

  const handlePackingSave = (packing: PackingData) => {
    setPackingData(packing);
    setQuantity(packing.totalQuantity);
    setShowPackingModal(false);
  };

  const handleSave = () => {
    if (effectiveQuantity < minQty || price <= 0) return;

    onSave({
      id: existingItem?.id || Date.now().toString(),
      product,
      quantity: effectiveQuantity,
      rate: price,
      total,
      variation: hasVariations ? variation : undefined,
      packingData
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6">
        <div className="flex justify-center pt-2 pb-4 sm:hidden">
          <div className="w-12 h-1 bg-[#374151] rounded-full"></div>
        </div>

        <div className="px-6 pb-4 border-b border-[#374151]">
          <h2 className="text-lg font-semibold text-white">{product.name}</h2>
          <p className="text-sm text-[#9CA3AF]">Unit: {product.unit}</p>
        </div>

        <div className="px-6 pt-6 space-y-6">
          {/* Variation */}
          {hasVariations && (
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
                Variation
              </label>
              <div className="flex gap-2 flex-wrap">
                {product.variations?.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariation(v)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      variation === v
                        ? 'bg-[#3B82F6] text-white'
                        : 'bg-[#111827] text-[#9CA3AF] border border-[#374151] hover:border-[#3B82F6]/50'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Packing Entry */}
          <div className="bg-[#111827] border border-[#3B82F6]/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-[#3B82F6]" />
                <div>
                  <span className="text-sm font-medium text-white">Packing Entry</span>
                  {packingData && (
                    <p className="text-xs text-[#10B981] mt-0.5">
                      {packingData.boxes.length} boxes • {packingData.pieceCount || (packingData.boxes.reduce((sum, box) => sum + box.pieces.length, 0) + packingData.loosePieces.length)} pieces • {packingData.totalQuantity} {product.unit}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowPackingModal(true)}
                className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs rounded-lg font-medium transition-colors"
              >
                {packingData ? 'Edit' : 'Add Packing'}
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
              Quantity {allowDecimal && <span className="text-xs">(Decimals allowed)</span>}
              {packingData && (
                <span className="ml-2 text-xs text-[#10B981]">
                  <Lock size={12} className="inline" /> From Packing
                </span>
              )}
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={decrementQuantity}
                disabled={!!packingData}
                className="w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center transition-colors active:scale-95 hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={effectiveQuantity}
                  onChange={(e) => {
                    if (!packingData) {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= minQty) setQuantity(val);
                    }
                  }}
                  disabled={!!packingData}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {packingData && (
                  <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                )}
              </div>
              <button
                onClick={incrementQuantity}
                disabled={!!packingData}
                className="w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center transition-colors active:scale-95 hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
              Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">Rs.</span>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setPrice(parseFloat(val) || 0);
                  }
                }}
                placeholder="0"
                className="w-full h-14 bg-[#111827] border-2 border-[#374151] rounded-lg pl-14 pr-4 text-lg font-semibold text-white focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
            <p className="text-xs text-[#6B7280] mt-2">
              Base: Rs. {product.costPrice.toLocaleString()} | Wholesale: Rs. {product.wholesalePrice.toLocaleString()}
            </p>
          </div>

          {/* Total */}
          <div className="pt-4 border-t border-[#374151]">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[#9CA3AF]">Item Total</span>
              <span className="text-2xl font-bold text-[#10B981]">
                Rs. {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] transition-colors text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={effectiveQuantity < minQty || price <= 0}
                className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors active:scale-[0.98] text-white"
              >
                {existingItem ? 'Update' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Packing Modal */}
        {showPackingModal && (
          <PackingModal
            onClose={() => setShowPackingModal(false)}
            onSave={handlePackingSave}
            existingPacking={packingData}
            unit={product.unit}
            productName={product.name}
          />
        )}
      </div>
    </div>
  );
}

// Packing Modal Component
interface PackingModalProps {
  onClose: () => void;
  onSave: (packing: PackingData) => void;
  existingPacking: PackingData | null;
  unit: string;
  productName: string;
}

function PackingModal({ onClose, onSave, existingPacking, unit, productName }: PackingModalProps) {
  // Detect if existing packing was created in Quick mode
  const isQuickMode = existingPacking?.pieceCount && existingPacking.boxes.length === 0 && existingPacking.loosePieces.length === 1;
  
  const [mode, setMode] = useState<'detailed' | 'lumpsum'>(isQuickMode ? 'lumpsum' : 'detailed');
  const [boxes, setBoxes] = useState<Box[]>(existingPacking?.boxes || []);
  const [loosePieces, setLoosePieces] = useState<Piece[]>(existingPacking?.loosePieces || []);
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);

  // Lump sum state - Initialize from existing data if it was Quick mode
  const [lumpSumQty, setLumpSumQty] = useState<number>(
    isQuickMode ? (existingPacking?.loosePieces[0]?.quantity || 0) : 0
  );
  const [lumpSumPieces, setLumpSumPieces] = useState<number>(
    isQuickMode ? (existingPacking?.pieceCount || 1) : 1
  );

  const calculateTotal = () => {
    const boxTotal = boxes.reduce((sum, box) => {
      return sum + box.pieces.reduce((pieceSum, piece) => {
        return pieceSum + (piece.quantity > 0 ? piece.quantity : 0);
      }, 0);
    }, 0);
    const looseTotal = loosePieces.reduce((sum, piece) => {
      return sum + (piece.quantity > 0 ? piece.quantity : 0);
    }, 0);
    return boxTotal + looseTotal;
  };

  const totalBoxes = boxes.length;
  const totalPieces = boxes.reduce((sum, box) => {
    return sum + box.pieces.filter(p => p.quantity > 0).length;
  }, 0) + loosePieces.filter(p => p.quantity > 0).length;
  const totalQuantity = calculateTotal();

  const addBox = () => {
    const newBox = { id: Date.now().toString(), pieces: [] };
    setBoxes([...boxes, newBox]);
    setExpandedBoxId(newBox.id);
  };

  const removeBox = (boxId: string) => {
    setBoxes(boxes.filter(b => b.id !== boxId));
    if (expandedBoxId === boxId) {
      setExpandedBoxId(null);
    }
  };

  const toggleBox = (boxId: string) => {
    setExpandedBoxId(expandedBoxId === boxId ? null : boxId);
  };

  const addPieceToBox = (boxId: string) => {
    setBoxes(boxes.map(box => {
      if (box.id === boxId) {
        return {
          ...box,
          pieces: [...box.pieces, { id: Date.now().toString(), quantity: 0 }]
        };
      }
      return box;
    }));
  };

  const removePieceFromBox = (boxId: string, pieceId: string) => {
    setBoxes(boxes.map(box => {
      if (box.id === boxId) {
        return {
          ...box,
          pieces: box.pieces.filter(p => p.id !== pieceId)
        };
      }
      return box;
    }));
  };

  const updatePieceQuantity = (boxId: string, pieceId: string, quantity: number) => {
    setBoxes(boxes.map(box => {
      if (box.id === boxId) {
        return {
          ...box,
          pieces: box.pieces.map(p => p.id === pieceId ? { ...p, quantity } : p)
        };
      }
      return box;
    }));
  };

  const addLoosePiece = () => {
    setLoosePieces([...loosePieces, { id: Date.now().toString(), quantity: 0 }]);
  };

  const removeLoosePiece = (pieceId: string) => {
    setLoosePieces(loosePieces.filter(p => p.id !== pieceId));
  };

  const updateLoosePieceQuantity = (pieceId: string, quantity: number) => {
    setLoosePieces(loosePieces.map(p => p.id === pieceId ? { ...p, quantity } : p));
  };

  const handleSave = () => {
    if (mode === 'lumpsum') {
      // Quick mode: Create loose pieces only, no boxes
      const loosePiece: Piece = {
        id: Date.now().toString(),
        quantity: lumpSumQty
      };
      onSave({
        boxes: [],
        loosePieces: [loosePiece],
        totalQuantity: lumpSumQty,
        pieceCount: lumpSumPieces
      });
    } else {
      onSave({
        boxes,
        loosePieces,
        totalQuantity
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[80] flex flex-col">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Package size={18} className="text-[#3B82F6]" />
              Packing Entry
            </h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {productName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#9CA3AF]" />
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 py-3 bg-[#1F2937] border-b border-[#374151] flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('detailed')}
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
              mode === 'detailed'
                ? 'bg-[#3B82F6] text-white'
                : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
            }`}
          >
            📦 Detailed
          </button>
          <button
            onClick={() => setMode('lumpsum')}
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
              mode === 'lumpsum'
                ? 'bg-[#3B82F6] text-white'
                : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
            }`}
          >
            ⚡ Quick
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-[#111827]">
        {mode === 'detailed' ? (
          <div className="p-4 space-y-4 pb-48">
            {/* Boxes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Boxes</h4>
                <button
                  onClick={addBox}
                  className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  Add Box
                </button>
              </div>

              {boxes.length === 0 && (
                <div className="text-center py-8 text-sm text-[#6B7280]">
                  No boxes added yet
                </div>
              )}

              <div className="space-y-2">
                {boxes.map((box, boxIndex) => {
                  const boxTotal = box.pieces.reduce((sum, p) => sum + p.quantity, 0);
                  const isExpanded = expandedBoxId === box.id;

                  return (
                    <div key={box.id} className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleBox(box.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-[#374151]/30 transition-colors"
                      >
                        <div className="text-left">
                          <div className="text-white font-medium">Box #{boxIndex + 1}</div>
                          <div className="text-xs text-[#9CA3AF] mt-0.5">
                            {box.pieces.length} Pieces • {boxTotal.toFixed(2)} {unit}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBox(box.id);
                            }}
                            className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
                          >
                            <Trash2 size={16} className="text-[#EF4444]" />
                          </button>
                          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-[#374151]">
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            {box.pieces.map((piece, pieceIndex) => (
                              <div key={piece.id} className="relative">
                                <div className="text-xs text-[#9CA3AF] mb-2">Piece {pieceIndex + 1}</div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min="0"
                                    value={piece.quantity || ''}
                                    onChange={(e) => updatePieceQuantity(box.id, piece.id, parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg px-2 pr-8 text-white font-semibold text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                                  />
                                  <button
                                    onClick={() => removePieceFromBox(box.id, piece.id)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center hover:bg-[#374151] rounded transition-colors"
                                  >
                                    <X size={14} className="text-[#EF4444]" />
                                  </button>
                                </div>
                                <div className="text-xs text-[#6B7280] mt-1 truncate">{unit}</div>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => addPieceToBox(box.id)}
                            className="w-full h-10 border-2 border-dashed border-[#374151] rounded-lg text-sm text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors flex items-center justify-center gap-1.5 mt-3"
                          >
                            <Plus size={16} />
                            Add Piece
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Loose Pieces */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Loose Pieces</h4>
                <button
                  onClick={addLoosePiece}
                  className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              {loosePieces.length === 0 && (
                <p className="text-xs text-[#6B7280] italic text-center py-3 bg-[#1F2937] rounded-lg border border-[#374151]">
                  Optional: Add pieces without box
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                {loosePieces.map((piece, index) => (
                  <div key={piece.id} className="relative">
                    <div className="text-xs text-[#9CA3AF] mb-2">Piece {index + 1}</div>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={piece.quantity || ''}
                        onChange={(e) => updateLoosePieceQuantity(piece.id, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full h-11 bg-[#111827] border border-[#8B5CF6]/50 rounded-lg px-2 pr-8 text-white font-semibold text-sm focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
                      />
                      <button
                        onClick={() => removeLoosePiece(piece.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center hover:bg-[#374151] rounded transition-colors"
                      >
                        <X size={14} className="text-[#EF4444]" />
                      </button>
                    </div>
                    <div className="text-xs text-[#6B7280] mt-1 truncate">{unit}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-3">
                Total Pieces
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={lumpSumPieces || ''}
                onChange={(e) => setLumpSumPieces(parseInt(e.target.value) || 1)}
                placeholder="1"
                className="w-full h-14 bg-[#111827] border-2 border-[#374151] rounded-lg px-4 text-white text-lg font-semibold focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-3">
                Total Quantity ({unit})
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={lumpSumQty || ''}
                onChange={(e) => setLumpSumQty(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full h-14 bg-[#111827] border-2 border-[#374151] rounded-lg px-4 text-white text-lg font-semibold focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary & Actions */}
      <div className="bg-[#1F2937] border-t border-[#374151] px-4 py-4 flex-shrink-0">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {mode === 'detailed' && (
            <div className="bg-[#111827] rounded-lg p-3 text-center">
              <div className="text-xs text-[#9CA3AF] mb-1">Boxes</div>
              <div className="text-xl font-bold text-[#3B82F6]">{totalBoxes}</div>
            </div>
          )}
          
          <div className={`bg-[#111827] rounded-lg p-3 text-center ${mode === 'lumpsum' ? 'col-span-1' : ''}`}>
            <div className="text-xs text-[#9CA3AF] mb-1">Pieces</div>
            <div className="text-xl font-bold text-[#8B5CF6]">
              {mode === 'detailed' ? totalPieces : lumpSumPieces}
            </div>
          </div>
          
          <div className={`bg-[#111827] rounded-lg p-3 text-center ${mode === 'lumpsum' ? 'col-span-2' : ''}`}>
            <div className="text-xs text-[#9CA3AF] mb-1">{unit}</div>
            <div className="text-xl font-bold text-[#10B981]">
              {mode === 'detailed' ? totalQuantity.toFixed(2) : lumpSumQty.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] transition-colors text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={(mode === 'detailed' && totalQuantity <= 0) || (mode === 'lumpsum' && (lumpSumQty <= 0 || lumpSumPieces < 1))}
            className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors text-white"
          >
            Save Packing
          </button>
        </div>
      </div>
    </div>
  );
}