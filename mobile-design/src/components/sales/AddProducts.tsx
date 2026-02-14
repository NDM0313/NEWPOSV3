import { useState, useRef, KeyboardEvent } from 'react';
import { ArrowLeft, Search, Edit2, Trash2, Plus, Minus, Package, Lock, X, Zap } from 'lucide-react';
import { Customer, Product } from './SalesModule';
import { NumericInput } from '../common/NumericInput';
import { TextInput } from '../common/TextInput';

interface AddProductsProps {
  onBack: () => void;
  customer: Customer;
  initialProducts: Product[];
  onProductsUpdate: (products: Product[]) => void;
  onNext: () => void;
}

interface AvailableProduct {
  id: string;
  name: string;
  basePrice: number;
  wholesalePrice: number;
  variations: string[];
  unit?: string;
  supportsPacking?: boolean;
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

const availableProducts: AvailableProduct[] = [
  {
    id: 'p1',
    name: 'Bridal Dress - Red',
    basePrice: 15000,
    wholesalePrice: 12000,
    variations: ['Small', 'Medium', 'Large'],
    unit: 'Piece',
    supportsPacking: true, // Packing enabled
  },
  {
    id: 'p2',
    name: 'Silk Dupatta',
    basePrice: 5000,
    wholesalePrice: 4000,
    variations: [],
    unit: 'Piece',
    supportsPacking: true, // Packing enabled
  },
  {
    id: 'p3',
    name: 'Fabric - Silk',
    basePrice: 1200,
    wholesalePrice: 1000,
    variations: [],
    unit: 'Meter',
    supportsPacking: true, // Packing enabled
  },
  {
    id: 'p4',
    name: 'Lace Border',
    basePrice: 800,
    wholesalePrice: 650,
    variations: [],
    unit: 'Yard',
    supportsPacking: true, // Packing enabled
  },
  {
    id: 'p5',
    name: 'Wedding Gown - White',
    basePrice: 25000,
    wholesalePrice: 20000,
    variations: ['Small', 'Medium', 'Large', 'XL'],
    unit: 'Piece',
    supportsPacking: true, // Packing enabled
  },
];

export function AddProducts({ onBack, customer, initialProducts, onProductsUpdate, onNext }: AddProductsProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AvailableProduct | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const subtotal = products.reduce((sum, p) => sum + p.total, 0);

  const handleAddProduct = (product: AvailableProduct) => {
    setSelectedProduct(product);
    setEditingIndex(null);
    setShowProductDialog(true);
  };

  const handleEditProduct = (index: number) => {
    const product = products[index];
    const availableProduct = availableProducts.find(p => p.id === product.id);
    if (availableProduct) {
      setSelectedProduct(availableProduct);
      setEditingIndex(index);
      setShowProductDialog(true);
    }
  };

  const handleRemoveProduct = (index: number) => {
    const newProducts = products.filter((_, i) => i !== index);
    setProducts(newProducts);
    onProductsUpdate(newProducts);
  };

  const handleSaveProduct = (product: Product) => {
    let newProducts: Product[];
    if (editingIndex !== null) {
      newProducts = products.map((p, i) => i === editingIndex ? product : p);
    } else {
      newProducts = [...products, product];
    }
    setProducts(newProducts);
    onProductsUpdate(newProducts);
    setShowProductDialog(false);
    setSelectedProduct(null);
    setEditingIndex(null);
  };

  const filteredProducts = availableProducts.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Add Items</h1>
          </div>
          <button
            onClick={onNext}
            disabled={products.length === 0}
            className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors active:scale-95"
          >
            Next
          </button>
        </div>

        <div className="bg-[#111827] rounded-lg p-3 mb-3">
          <p className="text-xs text-[#9CA3AF] mb-1">Customer</p>
          <p className="font-medium text-[#F9FAFB]">{customer.name}</p>
          <p className="text-sm text-[#9CA3AF]">Items: {products.length}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all"
          />
        </div>
      </div>

      {/* Cart Items */}
      {products.length > 0 && (
        <div className="p-4">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">
            CART ({products.length} items)
          </h2>
          <div className="space-y-2">
            {products.map((product, index) => (
              <div
                key={index}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-[#F9FAFB] mb-1">{product.name}</h3>
                    {product.variation && (
                      <p className="text-xs text-[#9CA3AF]">Size: {product.variation}</p>
                    )}
                    {product.packingData && (
                      <p className="text-xs text-[#3B82F6] mt-1">
                        📦 {product.packingData.boxes.length} boxes • {product.packingData.pieceCount || (product.packingData.boxes.reduce((sum, box) => sum + box.pieces.length, 0) + product.packingData.loosePieces.length)} pieces
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
                    Qty: {product.quantity} × Rs. {product.price.toLocaleString()}
                  </div>
                  <div className="font-semibold text-[#10B981]">
                    Rs. {product.total.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Products */}
      {searchQuery && (
        <div className="p-4">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">AVAILABLE PRODUCTS</h2>
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => handleAddProduct(product)}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#3B82F6] active:scale-95 transition-all text-left"
              >
                <div className="w-full h-20 bg-[#111827] rounded-lg mb-2 flex items-center justify-center">
                  <Package className="w-8 h-8 text-[#6B7280]" />
                </div>
                <h3 className="font-medium text-sm mb-1 text-[#F9FAFB] line-clamp-1">{product.name}</h3>
                <p className="text-xs text-[#9CA3AF] mb-2">
                  {product.unit || 'Piece'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#3B82F6]">
                    Rs. {product.basePrice.toLocaleString()}
                  </span>
                  <Plus className="w-4 h-4 text-[#10B981]" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {products.length === 0 && !searchQuery && (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF] mb-2">No items in cart</p>
          <p className="text-sm text-[#6B7280]">Search and add products to continue</p>
        </div>
      )}

      {/* Bottom Summary */}
      {products.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#9CA3AF]">Subtotal</span>
            <span className="text-xl font-bold text-[#F9FAFB]">
              Rs. {subtotal.toLocaleString()}
            </span>
          </div>
          <button
            onClick={onNext}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium transition-colors active:scale-[0.98]"
          >
            Continue to Summary →
          </button>
        </div>
      )}

      {/* Product Dialog */}
      {showProductDialog && selectedProduct && (
        <ProductDialog
          product={selectedProduct}
          existingProduct={editingIndex !== null ? products[editingIndex] : null}
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

// Product Dialog Component
interface ProductDialogProps {
  product: AvailableProduct;
  existingProduct: Product | null;
  onClose: () => void;
  onSave: (product: Product) => void;
}

function ProductDialog({ product, existingProduct, onClose, onSave }: ProductDialogProps) {
  const hasVariations = product.variations.length > 1;
  const [variation, setVariation] = useState(existingProduct?.variation || product.variations[0]);
  const [quantity, setQuantity] = useState(existingProduct?.quantity || 1);
  const [price, setPrice] = useState(existingProduct?.price || product.basePrice);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [packingData, setPackingData] = useState<PackingData | null>(existingProduct?.packingData || null);
  const [quantityLocked, setQuantityLocked] = useState(!!existingProduct?.packingData);

  // Refs for auto-focus on Enter
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const allowDecimal = product.unit === 'Meter' || product.unit === 'Yard' || product.unit === 'M' || product.unit === 'Y';
  const step = allowDecimal ? 0.25 : 1;
  const minQty = allowDecimal ? 0.25 : 1;

  const total = price * quantity;

  const handleQuantityChange = (value: string) => {
    if (quantityLocked) return;
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= minQty) {
      setQuantity(parsed);
    } else if (value === '') {
      setQuantity(minQty);
    }
  };

  const handleQuantityKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      priceInputRef.current?.focus();
    }
  };

  const handlePriceKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (quantity >= minQty && price > 0) {
        handleSave();
      }
    }
  };

  const incrementQuantity = () => {
    if (quantityLocked) return;
    setQuantity(quantity + step);
  };

  const decrementQuantity = () => {
    if (quantityLocked) return;
    setQuantity(Math.max(minQty, quantity - step));
  };

  const handlePackingSave = (packing: PackingData) => {
    setPackingData(packing);
    setQuantity(packing.totalQuantity);
    setQuantityLocked(true);
    setShowPackingModal(false);
  };

  const handleSave = () => {
    if (quantity < minQty || price <= 0) return;

    onSave({
      id: product.id,
      name: product.name,
      price,
      quantity,
      variation: hasVariations ? variation : undefined,
      total,
      packingData
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center">
        <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pb-6">
          <div className="flex justify-center pt-2 pb-4 sm:hidden">
            <div className="w-12 h-1 bg-[#374151] rounded-full"></div>
          </div>

          <div className="px-6 pb-4 border-b border-[#374151]">
            <h2 className="text-lg font-semibold text-white">{product.name}</h2>
            {product.unit && (
              <p className="text-sm text-[#9CA3AF]">Unit: {product.unit}</p>
            )}
          </div>

          <div className="px-6 pt-6 space-y-6">
            {/* Variation - CONDITIONAL */}
            {hasVariations && (
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
                  Variation
                </label>
                <div className="flex gap-2 flex-wrap">
                  {product.variations.map((v) => (
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

            {/* Add Packing - CONDITIONAL */}
            {product.supportsPacking && (
              <div className="bg-[#111827] border border-[#3B82F6]/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package size={18} className="text-[#3B82F6]" />
                    <span className="text-sm font-medium text-white">Packing Entry</span>
                  </div>
                  <button
                    onClick={() => setShowPackingModal(true)}
                    className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    {packingData ? 'Edit Packing' : 'Add Packing'}
                  </button>
                </div>
                {packingData && (
                  <div className="text-xs text-[#9CA3AF] mt-2">
                    {packingData.boxes.length} Box • {packingData.pieceCount || (packingData.boxes.reduce((sum, box) => sum + box.pieces.length, 0) + packingData.loosePieces.length)} Pieces • {packingData.totalQuantity.toFixed(2)} {product.unit}
                  </div>
                )}
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-3">
                Quantity {allowDecimal && <span className="text-xs">(Decimals allowed)</span>}
                {quantityLocked && <span className="text-xs text-[#3B82F6] ml-2">🔒 Locked by Packing</span>}
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={decrementQuantity}
                  disabled={quantityLocked}
                  className={`w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
                    quantityLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#374151]'
                  }`}
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    disabled={quantityLocked}
                    onKeyPress={handleQuantityKeyPress}
                    ref={quantityInputRef}
                    className={`w-full h-12 bg-[#111827] border border-[#374151] rounded-lg text-center text-lg font-semibold focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 ${
                      quantityLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  {quantityLocked && (
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3B82F6]" />
                  )}
                </div>
                <button
                  onClick={incrementQuantity}
                  disabled={quantityLocked}
                  className={`w-12 h-12 bg-[#111827] border border-[#374151] rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
                    quantityLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#374151]'
                  }`}
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
                  onKeyPress={handlePriceKeyPress}
                  ref={priceInputRef}
                  className="w-full h-14 bg-[#111827] border-2 border-[#374151] rounded-lg pl-14 pr-4 text-lg font-semibold text-white focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </div>
              <p className="text-xs text-[#6B7280] mt-2">
                Base: Rs. {product.basePrice.toLocaleString()} | Wholesale: Rs. {product.wholesalePrice.toLocaleString()}
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
                  disabled={quantity < minQty || price <= 0}
                  className="flex-1 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors active:scale-[0.98] text-white"
                >
                  {existingProduct ? 'Update' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Packing Modal */}
      {showPackingModal && (
        <PackingModal
          onClose={() => setShowPackingModal(false)}
          onSave={handlePackingSave}
          existingPacking={packingData}
          unit={product.unit || 'Unit'}
          productName={product.name}
        />
      )}
    </>
  );
}

// Packing Modal - WEB STYLE
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
        // Only include pieces with quantity > 0
        return pieceSum + (piece.quantity > 0 ? piece.quantity : 0);
      }, 0);
    }, 0);
    const looseTotal = loosePieces.reduce((sum, piece) => {
      // Only include pieces with quantity > 0
      return sum + (piece.quantity > 0 ? piece.quantity : 0);
    }, 0);
    return boxTotal + looseTotal;
  };

  // Count only pieces with quantity > 0
  const totalBoxes = boxes.length;
  const totalPieces = boxes.reduce((sum, box) => {
    return sum + box.pieces.filter(p => p.quantity > 0).length;
  }, 0) + loosePieces.filter(p => p.quantity > 0).length;
  const totalQuantity = calculateTotal();

  const addBox = () => {
    const newBox = { id: Date.now().toString(), pieces: [] };
    setBoxes([...boxes, newBox]);
    setExpandedBoxId(newBox.id); // Auto-expand new box
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex flex-col">
      {/* Header - Fixed */}
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

      {/* Mode Toggle - Mobile Optimized */}
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
            {/* Boxes Section */}
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

              {/* Collapsible Boxes - Mobile Friendly */}
              <div className="space-y-2">
                {boxes.map((box, boxIndex) => {
                  const boxTotal = box.pieces.reduce((sum, p) => sum + p.quantity, 0);
                  const isExpanded = expandedBoxId === box.id;

                  return (
                    <div key={box.id} className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
                      {/* Box Header - Always Visible */}
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

                      {/* Box Content - Collapsible */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-[#374151]">
                          {/* 2x2 Grid Layout for Mobile */}
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

            {/* Loose Pieces Section */}
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

              {/* 2x2 Grid Layout for Loose Pieces */}
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
          /* Quick Mode - Enhanced with Pieces + Quantity */
          <div className="p-4 space-y-4">
            {/* Total Pieces Input */}
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
              <p className="text-xs text-[#6B7280] mt-3">
                How many pieces are you entering?
              </p>
            </div>

            {/* Total Quantity Input */}
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
              <p className="text-xs text-[#6B7280] mt-3">
                What is the total {unit.toLowerCase()} quantity?
              </p>
            </div>

            {/* Help Text */}
            <div className="bg-[#111827] border border-[#374151]/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Zap size={16} className="text-[#3B82F6] mt-0.5 flex-shrink-0" />
                <div className="text-xs text-[#9CA3AF] leading-relaxed">
                  <span className="font-medium text-white">Quick Entry: </span>
                  Enter total pieces count and total quantity. No need for box-level or piece-level breakdown.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Summary & Actions - Fixed Bottom */}
      <div className="bg-[#1F2937] border-t border-[#374151] px-4 py-4 flex-shrink-0">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Boxes - Only show in Detailed mode */}
          {mode === 'detailed' && (
            <div className="bg-[#111827] rounded-lg p-3 text-center">
              <div className="text-xs text-[#9CA3AF] mb-1">Boxes</div>
              <div className="text-xl font-bold text-[#3B82F6]">
                {totalBoxes}
              </div>
            </div>
          )}
          
          {/* Pieces */}
          <div className={`bg-[#111827] rounded-lg p-3 text-center ${mode === 'lumpsum' ? 'col-span-1' : ''}`}>
            <div className="text-xs text-[#9CA3AF] mb-1">Pieces</div>
            <div className="text-xl font-bold text-[#8B5CF6]">
              {mode === 'detailed' ? totalPieces : lumpSumPieces}
            </div>
          </div>
          
          {/* Quantity */}
          <div className={`bg-[#111827] rounded-lg p-3 text-center ${mode === 'lumpsum' ? 'col-span-2' : ''}`}>
            <div className="text-xs text-[#9CA3AF] mb-1">{unit}</div>
            <div className="text-xl font-bold text-[#10B981]">
              {mode === 'detailed' ? totalQuantity.toFixed(2) : lumpSumQty.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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