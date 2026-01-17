import React from 'react';
import { Search, Plus, Trash2, Package, ChevronsUpDown, Edit } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
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

interface Product {
    id: number;
    name: string;
    sku: string;
    price: number;
    hasVariations: boolean;
    needsPacking: boolean;
    stock?: number;
}

interface PurchaseItem {
    id: number;
    productId: number;
    name: string;
    sku: string;
    price: number;
    qty: number;
    size?: string;
    color?: string;
    thaans?: number;
    meters?: number;
    packingDetails?: any;
    stock?: number;
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
}) => {
    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-3 bg-gray-950/50 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Items Entry</h3>
                <span className="text-xs text-gray-500">Enter to move</span>
            </div>

            {/* Search Bar */}
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                        <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                            <PopoverTrigger asChild>
                                <button className="w-full h-11 px-4 bg-gray-950/80 border border-gray-700 rounded-lg text-left flex items-center gap-3 hover:bg-gray-900 transition-colors">
                                    <Search size={18} className="text-gray-500 shrink-0" />
                                    <span className={`text-sm ${pendingProduct ? 'text-white' : 'text-gray-500'}`}>
                                        {pendingProduct ? pendingProduct.name : "Type product name or SKU..."}
                                    </span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[500px] p-0 bg-gray-950 border-gray-800 text-white" align="start">
                                <Command className="bg-gray-950 text-white">
                                    <CommandInput 
                                        ref={searchInputRef}
                                        placeholder="Search product..." 
                                        value={productSearchTerm}
                                        onValueChange={setProductSearchTerm}
                                        className="h-10" 
                                    />
                                    <CommandList>
                                        <CommandEmpty>No product found.</CommandEmpty>
                                        <CommandGroup>
                                            {filteredProducts.map((p) => (
                                                <CommandItem
                                                    key={p.id}
                                                    value={p.name}
                                                    onSelect={() => handleSelectProduct(p)}
                                                    className="text-white hover:bg-gray-800 cursor-pointer"
                                                >
                                                    <div className="flex justify-between items-center w-full">
                                                        <div>
                                                            <div className="font-medium">{p.name}</div>
                                                            <div className="text-xs text-gray-500">{p.sku}</div>
                                                        </div>
                                                        <div className="text-blue-400 font-medium">${p.price}</div>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button
                        ref={addBtnRef}
                        onClick={handleAddItem}
                        disabled={!pendingProduct}
                        className="h-11 px-8 bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add
                    </Button>
                </div>
            </div>

            {/* Table Section */}
            <div>
                {/* Table Headers */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-950/30 border-b border-gray-800/50">
                    <div className="col-span-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</div>
                    <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name & SKU</div>
                    <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Variation</div>
                    <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Packing</div>
                    <div className="col-span-1 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Qty</div>
                    <div className="col-span-1 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Unit Price</div>
                    <div className="col-span-1 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</div>
                    <div className="col-span-1 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Action</div>
                </div>

                {/* Entry Row - Shows when product selected */}
                {pendingProduct && (
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-900/20 border-b border-gray-800">
                        {/* # */}
                        <div className="col-span-1">
                            <span className="text-sm text-gray-600">--</span>
                        </div>

                        {/* Product Name */}
                        <div className="col-span-2">
                            <div className="text-sm font-medium text-white">{pendingProduct.name}</div>
                            <div className="text-xs text-gray-500">SKU: {pendingProduct.sku}</div>
                        </div>

                        {/* Variation */}
                        <div className="col-span-2 flex items-center">
                            {pendingProduct.hasVariations ? (
                                <Button
                                    onClick={() => {
                                        setActiveProductName(pendingProduct.name);
                                        setActivePackingData(undefined);
                                        setActivePackingItemId(null);
                                        setPackingModalOpen(true);
                                    }}
                                    size="sm"
                                    className="h-8 px-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-medium text-xs"
                                >
                                    <Edit size={14} className="mr-1" />
                                    Add Variation
                                </Button>
                            ) : (
                                <span className="text-gray-600 text-xs">-</span>
                            )}
                        </div>

                        {/* Packing with Qty & Price */}
                        <div className="col-span-3 flex items-center gap-2">
                            {pendingProduct.needsPacking && (
                                <Button
                                    onClick={() => {
                                        setActiveProductName(pendingProduct.name);
                                        setActivePackingData(undefined);
                                        setActivePackingItemId(null);
                                        setPackingModalOpen(true);
                                    }}
                                    size="sm"
                                    className="h-8 px-3 bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs"
                                >
                                    <Package size={14} className="mr-1" />
                                    Add Packing
                                </Button>
                            )}
                            {!pendingProduct.needsPacking && (
                                <span className="text-gray-600 text-xs">-</span>
                            )}
                        </div>

                        {/* Qty */}
                        <div className="col-span-1 flex items-center justify-center">
                            <Input
                                ref={qtyInputRef}
                                type="number"
                                min="1"
                                value={pendingQty > 0 ? pendingQty : ''}
                                onChange={(e) => setPendingQty(parseInt(e.target.value) || 1)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        priceInputRef.current?.focus();
                                    }
                                }}
                                className="w-16 h-8 bg-gray-950 border-gray-700 text-white text-center text-sm font-medium"
                            />
                        </div>

                        {/* Price */}
                        <div className="col-span-1 flex items-center justify-center">
                            <Input
                                ref={priceInputRef}
                                type="number"
                                min="0"
                                value={pendingPrice > 0 ? pendingPrice : ''}
                                onChange={(e) => setPendingPrice(parseFloat(e.target.value) || 0)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addBtnRef.current?.click();
                                    }
                                }}
                                className="w-20 h-8 bg-gray-950 border-gray-700 text-white text-center text-sm font-medium"
                            />
                        </div>

                        {/* Total */}
                        <div className="col-span-1 flex items-center justify-end">
                            <span className="text-base font-bold text-green-400">
                                ${(pendingPrice * pendingQty).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                            </span>
                        </div>

                        {/* Action */}
                        <div className="col-span-1 flex items-center justify-center">
                            <button
                                onClick={() => {
                                    setPendingProduct(null);
                                    setPendingQty(1);
                                    setPendingPrice(0);
                                }}
                                className="p-2 hover:bg-red-500/20 rounded text-red-500"
                                title="Clear"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Items List */}
                {items.length > 0 ? (
                    <div className="divide-y divide-gray-800/50">
                        {items.map((item, index) => (
                            <div key={item.id} className="group grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-900/30 transition-colors items-center">
                                {/* # */}
                                <div className="col-span-1">
                                    <span className="text-sm text-gray-400 font-medium">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                </div>

                                {/* Product Name & SKU */}
                                <div className="col-span-2">
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-white mb-1">{item.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>SKU: {item.sku}</span>
                                                <span>•</span>
                                                <span>Stock: {item.stock || 0}</span>
                                                <Badge className="h-5 px-2 py-0 bg-green-500 text-white text-[10px] font-medium rounded-full">
                                                    Available
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Variation Badges */}
                                <div className="col-span-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {item.size && (
                                            <div className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                                                Supplier: {item.size}
                                            </div>
                                        )}
                                        {item.color && (
                                            <div className="px-3 py-1 bg-yellow-500 text-gray-900 text-xs font-bold rounded-full">
                                                {item.color}
                                            </div>
                                        )}
                                        {!item.size && !item.color && (
                                            <span className="text-gray-600 text-xs">-</span>
                                        )}
                                    </div>
                                </div>

                                {/* Packing Badges */}
                                <div className="col-span-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(item.thaans || item.meters || item.packingDetails) ? (
                                            <div className="px-3 py-1 bg-orange-600 text-white text-xs font-medium rounded-full flex items-center gap-1.5">
                                                {item.packingDetails ? 'Detailed' : `${item.thaans || 0}T / ${item.meters || 0}M`}
                                                {item.packingDetails && (
                                                    <button
                                                        onClick={() => handleOpenPackingModal(item.id)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                                        title="View Packing Details"
                                                    >
                                                        <Package size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-600 text-xs">-</span>
                                        )}
                                    </div>
                                </div>

                                {/* Qty */}
                                <div className="col-span-1">
                                    <div className="text-center text-sm text-white font-medium">{item.qty}</div>
                                </div>

                                {/* Unit Price */}
                                <div className="col-span-1">
                                    <div className="text-center text-sm text-white font-medium">{item.price}</div>
                                </div>

                                {/* Total */}
                                <div className="col-span-1">
                                    <div className="text-right text-base font-bold text-white">
                                        ${(item.price * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>

                                {/* Action */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <button
                                        onClick={() => setItems(items.filter(i => i.id !== item.id))}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded text-red-500"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    !pendingProduct && (
                        <div className="py-20 text-center text-gray-500">
                            <Package size={56} className="mx-auto mb-4 opacity-20" />
                            <p className="text-sm">No items added yet. Search and add products above.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
