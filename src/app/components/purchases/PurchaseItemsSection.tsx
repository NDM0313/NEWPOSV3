import React from 'react';
import { Search, Plus, Trash2, Package, ChevronsUpDown, Edit, Sparkles } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { toast } from 'sonner';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "../ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../ui/popover";
import { useNavigation } from '../../context/NavigationContext';

interface Product {
    id: number;
    name: string;
    sku: string;
    price: number;
    hasVariations: boolean;
    needsPacking: boolean;
    stock?: number;
    lastPurchasePrice?: number;
    unitId?: string | null;
    unitAllowDecimal?: boolean;
    variations?: Array<{ id?: string; size?: string; color?: string; attributes?: Record<string, unknown>; sku?: string; price?: number; stock?: number }>;
}

interface PurchaseItem {
    id: number;
    productId: number | string;
    name: string;
    sku: string;
    price: number;
    qty: number;
    size?: string;
    color?: string;
    variationId?: string;
    thaans?: number;
    meters?: number;
    packingDetails?: any;
    stock?: number;
    showVariations?: boolean;
    selectedVariationId?: string;
    unitAllowDecimal?: boolean; // From product's unit
}

interface PurchaseItemsSectionProps {
    items: PurchaseItem[];
    setItems: React.Dispatch<React.SetStateAction<PurchaseItem[]>>;
    productSearchOpen: boolean;
    setProductSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
    productSearchTerm: string;
    setProductSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    pendingProduct: Product | null;
    setPendingProduct: React.Dispatch<React.SetStateAction<Product | null>>;
    pendingQty: number;
    setPendingQty: React.Dispatch<React.SetStateAction<number>>;
    pendingPrice: number;
    setPendingPrice: React.Dispatch<React.SetStateAction<number>>;
    pendingSize: string;
    setPendingSize: React.Dispatch<React.SetStateAction<string>>;
    pendingColor: string;
    setPendingColor: React.Dispatch<React.SetStateAction<string>>;
    pendingThaans: number;
    setPendingThaans: React.Dispatch<React.SetStateAction<number>>;
    pendingMeters: number;
    setPendingMeters: React.Dispatch<React.SetStateAction<number>>;
    filteredProducts: Product[];
    handleSelectProduct: (product: Product) => void;
    // Variation handling
    productVariations?: Record<string | number, Array<{ id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }>>;
    handleInlineVariationSelect?: (itemId: number, variation: { id?: string; size?: string; color?: string; sku?: string; price?: number; stock?: number; attributes?: Record<string, unknown> }) => void;
    handleAddItem: () => void;
    handleOpenPackingModal: (itemId: number) => void;
    setPackingModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setActiveProductName: React.Dispatch<React.SetStateAction<string>>;
    setActivePackingData: React.Dispatch<React.SetStateAction<any>>;
    setActivePackingItemId: React.Dispatch<React.SetStateAction<number | null>>;
    searchInputRef: React.RefObject<HTMLInputElement>;
    qtyInputRef: React.RefObject<HTMLInputElement>;
    priceInputRef: React.RefObject<HTMLInputElement>;
    addBtnRef: React.RefObject<HTMLButtonElement>;
    /** When false, Packing column and modal trigger are hidden (global Enable Packing = OFF). */
    enablePacking?: boolean;
    /** Edit mode: variation is read-only (locked); no BLUE/WHITE choice – delete row + re-add to change. */
    isEditMode?: boolean;
    // Update item function
    updateItem: (id: number, field: 'qty' | 'price', value: number) => void;
    // Keyboard navigation
    itemQtyRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
    itemPriceRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
    handleQtyKeyDown: (e: React.KeyboardEvent, itemId: number) => void;
    handlePriceKeyDown: (e: React.KeyboardEvent, itemId: number) => void;
}

export const PurchaseItemsSection: React.FC<PurchaseItemsSectionProps> = ({
    items,
    setItems,
    productSearchOpen,
    setProductSearchOpen,
    productSearchTerm,
    setProductSearchTerm,
    pendingProduct,
    setPendingProduct,
    pendingQty,
    setPendingQty,
    pendingPrice,
    setPendingPrice,
    pendingSize,
    setPendingSize,
    pendingColor,
    setPendingColor,
    pendingThaans,
    setPendingThaans,
    pendingMeters,
    setPendingMeters,
    filteredProducts,
    handleSelectProduct,
    productVariations = {},
    handleInlineVariationSelect,
    handleAddItem,
    handleOpenPackingModal,
    setPackingModalOpen,
    setActiveProductName,
    setActivePackingData,
    setActivePackingItemId,
    searchInputRef,
    qtyInputRef,
    priceInputRef,
    addBtnRef,
    enablePacking = false,
    isEditMode = false,
    updateItem,
    // Keyboard navigation
    itemQtyRefs,
    itemPriceRefs,
    handleQtyKeyDown,
    handlePriceKeyDown,
}) => {
    const { openDrawer, activeDrawer } = useNavigation();

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full">
            {/* Header - Compact */}
            <div className="px-4 py-2 bg-gray-950/50 border-b border-gray-800 flex items-center justify-between shrink-0">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Items Entry</h3>
            </div>

            {/* Search Bar - Compact */}
            <div className="p-3 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-2">
                    {/* Search Input - Compact */}
                    <div className="flex-1 relative">
                        <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                            <PopoverTrigger asChild>
                                <button className="group w-full h-10 px-4 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-950/90 border border-gray-700/50 rounded-lg text-left flex items-center gap-2.5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden">
                                    {/* Animated gradient overlay on hover */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    
                                    <Search size={16} className="text-gray-400 group-hover:text-blue-400 shrink-0 transition-colors relative z-10" />
                                    <div className="flex-1 relative z-10">
                                        <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                                            Search by name, SKU, or numeric code (e.g., 001, 22)...
                                        </span>
                                    </div>
                                    <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-800/50 border border-gray-700 rounded relative z-10">
                                        <span>⌘</span>
                                        <span>K</span>
                                    </kbd>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[600px] p-0 bg-gray-950 border-gray-800 text-white shadow-2xl shadow-black/50" align="start">
                                <Command className="bg-gray-950 text-white" shouldFilter={false}>
                                    <CommandInput 
                                        ref={searchInputRef}
                                        placeholder="Search by name, SKU, or numeric code..." 
                                        value={productSearchTerm || ''}
                                        onValueChange={(value) => {
                                            setProductSearchTerm(value || '');
                                        }}
                                        className="h-12 text-base border-b border-gray-800" 
                                    />
                                    <CommandList className="max-h-[400px]">
                                        {filteredProducts.length === 0 ? (
                                            <div className="p-4">
                                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                                    <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                                                        <Package size={32} className="text-gray-600" />
                                                    </div>
                                                    <p className="text-gray-400 text-sm mb-1">No products found</p>
                                                    <p className="text-gray-600 text-xs mb-6">
                                                        {productSearchTerm ? `No results for "${productSearchTerm}"` : 'Start typing to search'}
                                                    </p>
                                                    {/* Always show Add button when search term exists (numeric or alphabetic) */}
                                                    {/* Show button if: filteredProducts is empty AND search term exists (any value including "00", "0001", etc.) */}
                                                    {(() => {
                                                        const searchTermStr = String(productSearchTerm || '').trim();
                                                        const hasSearchTerm = searchTermStr.length > 0;
                                                        const noResults = filteredProducts.length === 0;
                                                        const shouldShow = noResults && hasSearchTerm;
                                                        
                                                        // Debug log
                                                        if (hasSearchTerm) {
                                                            console.log(`[ADD BUTTON CHECK] Search: "${searchTermStr}", filteredProducts: ${filteredProducts.length}, hasSearchTerm: ${hasSearchTerm}, shouldShow: ${shouldShow}`);
                                                        }
                                                        
                                                        return shouldShow ? (
                                                        <button
                                                            onClick={() => {
                                                                setProductSearchOpen(false);
                                                                openDrawer('addProduct', 'addPurchase');
                                                            }}
                                                            className="group relative flex items-center gap-3 px-5 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 rounded-lg transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105"
                                                        >
                                                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                                                <Plus size={16} className="shrink-0" />
                                                            </div>
                                                            <span>Create New Product</span>
                                                            <Sparkles size={14} className="opacity-70" />
                                                        </button>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                        ) : (
                                            <CommandGroup>
                                                {filteredProducts.map((p) => (
                                                    <CommandItem
                                                        key={p.id}
                                                        value={`${p.name} ${p.sku}`}
                                                        onSelect={() => handleSelectProduct(p)}
                                                        className="text-white hover:bg-gray-800/80 cursor-pointer px-4 py-3 data-[selected=true]:bg-gray-800"
                                                    >
                                                        <div className="flex justify-between items-center w-full gap-4">
                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                                                                    <Package size={18} className="text-blue-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-white truncate">{p.name}</div>
                                                                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                                                        <span className="font-mono">{p.sku}</span>
                                                                        {p.stock !== undefined && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span className={p.stock > 0 ? 'text-green-500' : 'text-red-500'}>
                                                                                    Stock: {p.stock}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                        {p.lastPurchasePrice !== undefined && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span className="text-amber-500">
                                                                                    Last: ${p.lastPurchasePrice}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="text-lg font-bold text-blue-400">${p.price}</div>
                                                                {p.lastPurchasePrice && (
                                                                    <div className="text-xs text-gray-600">
                                                                        Margin: ${p.price - p.lastPurchasePrice}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                </div>
                
                {/* Quick Info Helper Text */}
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span>Use search to add items</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span>Create products on the fly</span>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Table Headers - FIXED SPACING (Packing column when enablePacking) */}
                <div className={enablePacking
                    ? "grid grid-cols-[32px_1fr_auto_auto_80px_100px_80px_50px] gap-2 px-2 py-2.5 bg-gray-950/30 border-b border-gray-800/50 shrink-0"
                    : "grid grid-cols-[32px_1fr_auto_80px_100px_80px_50px] gap-2 px-2 py-2.5 bg-gray-950/30 border-b border-gray-800/50 shrink-0"
                }>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">#</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-[100px]">Variation</div>
                    {enablePacking && <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-[120px]">Packing</div>}
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Qty</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Price</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Action</div>
                </div>

                {/* Items List - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                    {items.length > 0 ? (
                        <div className="divide-y divide-gray-800/50">
                            {items.map((item, index) => {
                                    // In edit mode, if item has variation but missing size/color/sku, use selected variation from productVariations for display (same as add-mode row)
                                    const variations = productVariations?.[item.productId] ?? productVariations?.[String(item.productId)] ?? productVariations?.[Number(item.productId)] ?? [];
                                    const selectedVariationForDisplay = item.selectedVariationId ? variations.find((v: { id?: string }) => v.id === item.selectedVariationId) : null;
                                    // When a variation is selected, show variation SKU (not base product SKU)
                                    const displaySku = selectedVariationForDisplay
                                        ? (selectedVariationForDisplay.sku || `${item.sku}-${selectedVariationForDisplay.size || ''}-${selectedVariationForDisplay.color || ''}`.replace(/\s+/g, '-').toUpperCase())
                                        : item.sku;
                                    const displaySize = item.size ?? selectedVariationForDisplay?.size ?? '';
                                    const displayColor = item.color ?? selectedVariationForDisplay?.color ?? '';
                                    const displayStock = item.stock ?? selectedVariationForDisplay?.stock ?? 0;
                                    const displayPrice = (item as PurchaseItem & { lastPurchasePrice?: number }).lastPurchasePrice ?? item.price;

                                    return (
                                <div key={item.id}>
                                    {/* Main Item Row - FIXED SPACING (Packing cell when enablePacking) */}
                                    <div className={enablePacking
                                        ? "group grid grid-cols-[32px_1fr_auto_auto_80px_100px_80px_50px] gap-2 px-2 py-1.5 hover:bg-gray-900/30 transition-colors items-center"
                                        : "group grid grid-cols-[32px_1fr_auto_80px_100px_80px_50px] gap-2 px-2 py-1.5 hover:bg-gray-900/30 transition-colors items-center"
                                    }>
                                        {/* # (Fixed 32px) */}
                                        <div className="w-[32px]">
                                            <span className="text-xs text-gray-500 font-medium">
                                                {index + 1}
                                            </span>
                                        </div>

                                        {/* Product Name & SKU (Max Space) - use display values so edit mode shows full line like add mode */}
                                        <div className="min-w-0">
                                            <div className="flex items-start">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-white leading-tight mb-0.5 truncate">{item.name}</div>
                                                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                                                        <span className="font-mono">{displaySku}</span>
                                                        {(displaySize || displayColor) ? (
                                                            <>
                                                                <span>·</span>
                                                                <span className="text-blue-400">
                                                                    {displaySize && displayColor ? `${displaySize} / ${displayColor}` : displaySize || displayColor}
                                                                </span>
                                                            </>
                                                        ) : null}
                                                        <span>·</span>
                                                        <span className={displayStock > 0 ? 'text-green-500' : 'text-red-500'}>
                                                            {displayStock}
                                                        </span>
                                                        {displayPrice != null && displayPrice > 0 && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="text-amber-500">
                                                                    ${Number(displayPrice).toLocaleString()}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Variation (Fixed Width) - use display size/color so edit mode shows e.g. WHITE */}
                                        <div className="w-[100px]">
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                {displaySize && <span>{displaySize}</span>}
                                                {displaySize && displayColor && <span>·</span>}
                                                {displayColor && <span>{displayColor}</span>}
                                                {!displaySize && !displayColor && <span className="text-gray-700">-</span>}
                                            </div>
                                        </div>

                                    {/* Packing (Fixed Width) - only when enablePacking */}
                                    {enablePacking && (
                                    <div className="w-[120px]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {(item.thaans || item.meters || item.packingDetails) ? (
                                                <button
                                                    onClick={() => handleOpenPackingModal(item.id)}
                                                    className="text-xs text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-1"
                                                >
                                                    {item.packingDetails ? (
                                                        <span className="text-[11px]">
                                                            {(() => {
                                                                const pd = item.packingDetails;
                                                                const totalBoxes = pd.total_boxes ?? 0;
                                                                const totalPieces = pd.total_pieces ?? 0;
                                                                const packingParts: string[] = [];
                                                                if (Number(totalBoxes) > 0) packingParts.push(`${totalBoxes} Box${Number(totalBoxes) !== 1 ? 'es' : ''}`);
                                                                if (Number(totalPieces) > 0) packingParts.push(`${totalPieces} Piece${Number(totalPieces) !== 1 ? 's' : ''}`);
                                                                return packingParts.length ? packingParts.join(', ') : '—';
                                                            })()}
                                                        </span>
                                                    ) : (
                                                        <span>{item.thaans || 0} Boxes · {item.meters || 0} Meters</span>
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleOpenPackingModal(item.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                                >
                                                    <Package size={12} />
                                                    <span>+ Add Packing</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    )}

                                    {/* Qty (Fixed 80px) – decimal only when unit allows (e.g. kg, m); otherwise whole numbers only */}
                                    <div className="w-[80px]">
                                        <Input 
                                            ref={(el) => (itemQtyRefs.current[item.id] = el)}
                                            type="number"
                                            step={item.unitAllowDecimal === true ? "0.01" : "1"}
                                            min={0}
                                            className="h-7 w-full text-center bg-transparent border-transparent hover:border-gray-700 focus:bg-gray-950 focus:border-blue-500 p-0.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={item.unitAllowDecimal === true ? item.qty : Math.round(item.qty)}
                                            onChange={(e) => {
                                                const raw = parseFloat(e.target.value);
                                                const value = raw < 0 || Number.isNaN(raw) ? 0 : raw;
                                                // Unit does not allow decimal → only whole numbers
                                                if (item.unitAllowDecimal !== true) {
                                                    if (value % 1 !== 0) {
                                                        toast.error('This product unit does not allow decimal quantities. Enter a whole number.');
                                                        return;
                                                    }
                                                    updateItem(item.id, 'qty', Math.round(value));
                                                    return;
                                                }
                                                updateItem(item.id, 'qty', value);
                                            }}
                                            onKeyDown={(e) => handleQtyKeyDown(e, item.id)}
                                            disabled={(enablePacking && !!item.packingDetails) || (item.showVariations && !item.selectedVariationId)}
                                            placeholder={item.showVariations && !item.selectedVariationId ? "—" : ""}
                                        />
                                    </div>

                                    {/* Price (Fixed 100px - RIGHT ALIGNED) */}
                                    <div className="w-[100px]">
                                        <Input 
                                            ref={(el) => (itemPriceRefs.current[item.id] = el)}
                                            type="number"
                                            className="h-7 w-full text-right bg-transparent border-transparent hover:border-gray-700 focus:bg-gray-950 focus:border-blue-500 px-2 py-0.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={item.price}
                                            onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handlePriceKeyDown(e, item.id)}
                                            disabled={item.showVariations && !item.selectedVariationId}
                                            placeholder={item.showVariations && !item.selectedVariationId ? "—" : ""}
                                        />
                                    </div>

                                    {/* Total (Fixed 80px - RIGHT ALIGNED) */}
                                    <div className="w-[80px]">
                                        <div className="text-right text-sm font-bold text-white">
                                            ${(item.price * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    {/* Action (Fixed 50px) */}
                                    <div className="w-[50px] flex items-center justify-center">
                                        <button
                                            onClick={() => setItems(items.filter(i => i.id !== item.id))}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded text-red-500"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Inline Variation: Edit mode = read-only (locked). Create mode = selector buttons. */}
                                {item.showVariations && (() => {
                                    const variations = productVariations[item.productId] || 
                                                     productVariations[String(item.productId)] || 
                                                     productVariations[Number(item.productId)] || [];
                                    const selectedVariation = item.selectedVariationId ? variations.find(v => v.id === item.selectedVariationId) : null;
                                    const getDisplayText = (v: typeof variations[0]) => {
                                        const size = (v.size || '').toString().trim();
                                        const color = (v.color || '').toString().trim();
                                        if (size && color) return `${size} / ${color}`;
                                        if (size) return size;
                                        if (color) return color;
                                        if (v.attributes && typeof v.attributes === 'object') {
                                            const firstVal = Object.values(v.attributes).find((val): val is string => typeof val === 'string' && String(val).trim().length > 0);
                                            if (firstVal) return String(firstVal).trim();
                                        }
                                        return 'Default';
                                    };

                                    // Edit mode + persisted item: no extra row – variation is already shown in main row (SKU · color · size · stock/price)
                                    if (isEditMode && item.selectedVariationId && selectedVariation) {
                                        return null;
                                    }

                                    if (variations.length === 0) return null;
                                    if (!handleInlineVariationSelect) return null;

                                    // Create mode: show BLUE / WHITE (or other) selector buttons
                                    return (
                                        <div className="bg-blue-500/5 border-t border-blue-500/20 px-4 py-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-xs text-blue-400 font-medium shrink-0">{item.selectedVariationId ? 'Variation:' : 'Select Variation:'}</span>
                                                <div className="flex flex-wrap gap-2 flex-1">
                                                    {variations.map((variation, vIndex) => {
                                                        const variationSku = variation.sku || (variation.size && variation.color ? `${item.sku}-${variation.size}-${variation.color}` : variation.size ? `${item.sku}-${variation.size}` : variation.color ? `${item.sku}-${variation.color}` : item.sku).replace(/\s+/g, '-').toUpperCase();
                                                        const isSelected = item.selectedVariationId === variation.id;
                                                        return (
                                                            <button
                                                                key={variation.id || vIndex}
                                                                onClick={() => handleInlineVariationSelect(item.id, variation)}
                                                                className={cn(
                                                                    "px-3 py-1.5 text-xs rounded border transition-all",
                                                                    isSelected ? "bg-blue-600 text-white border-blue-500 font-semibold" : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600"
                                                                )}
                                                                title={variationSku}
                                                            >
                                                                {getDisplayText(variation)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            {item.selectedVariationId && (() => {
                                                const v = variations.find(x => x.id === item.selectedVariationId);
                                                const variationSku = v?.sku || (v ? `${item.sku}-${v.size || ''}-${v.color || ''}`.replace(/\s+/g, '-').toUpperCase() : item.sku);
                                                return <div className="mt-2 text-[10px] text-gray-400 font-mono">SKU: {variationSku}</div>;
                                            })()}
                                            {!item.selectedVariationId && <div className="mt-2 text-[10px] text-amber-400">Select a variation above</div>}
                                        </div>
                                    );
                                })()}
                            </div>
                            );
                            })}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-gray-500">
                            <Package size={56} className="mx-auto mb-4 opacity-20" />
                            <p className="text-sm">No items added yet. Search and add products above.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};