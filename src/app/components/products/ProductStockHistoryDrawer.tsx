import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Package, RefreshCw, ShoppingCart, Truck, Loader2, Filter } from 'lucide-react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { cn } from "../ui/utils";
import { FullStockLedgerView } from './FullStockLedgerView';
import { ViewSaleDetailsDrawer } from '../sales/ViewSaleDetailsDrawer';
import { ViewPurchaseDetailsDrawer } from '../purchases/ViewPurchaseDetailsDrawer';
import { productService } from '@/app/services/productService';
import { branchService, Branch } from '@/app/services/branchService';
import { formatStockReference } from '@/app/utils/formatters';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { toast } from 'sonner';

interface StockMovement {
  id: string;
  movement_type?: string;
  type?: string;
  quantity: number;
  reference_type?: string;
  reference_id?: string;
  variation_id?: string;
  branch_id?: string;
  notes?: string;
  created_at: string;
  branch?: {
    id: string;
    name: string;
  };
}

interface ProductStockHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId?: string;
  productSku?: string;
  totalSold: number; // Legacy prop - will be recalculated from movements
  totalPurchased: number; // Legacy prop - will be recalculated from movements
  currentStock: number;
}

export const ProductStockHistoryDrawer = ({
  isOpen,
  onClose,
  productName,
  productId,
  productSku,
  totalSold: legacyTotalSold,
  totalPurchased: legacyTotalPurchased,
  currentStock
}: ProductStockHistoryDrawerProps) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { getSaleById } = useSales();
  const { getPurchaseById } = usePurchases();
  const [showFullLedger, setShowFullLedger] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter state
  const [selectedVariationId, setSelectedVariationId] = useState<string | undefined>(undefined);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(contextBranchId || undefined);
  const [variations, setVariations] = useState<Array<{id: string; name: string; sku?: string}>>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [variationColumnExists, setVariationColumnExists] = useState<boolean | null>(null); // null = unknown, true = exists, false = doesn't exist
  
  // State for sale/purchase detail drawers
  const [viewSaleOpen, setViewSaleOpen] = useState(false);
  const [viewPurchaseOpen, setViewPurchaseOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

  // Load variations for the product
  const loadVariations = useCallback(async () => {
    if (!productId || !companyId) return;
    
    try {
      setLoadingVariations(true);
      const product = await productService.getProduct(productId);
      if (product.variations && Array.isArray(product.variations)) {
        setVariations(product.variations.map((v: any) => ({
          id: v.id,
          name: v.name || v.sku || `Variation ${v.id.substring(0, 8)}`,
          sku: v.sku
        })));
      } else {
        setVariations([]);
      }
    } catch (error) {
      console.error('[STOCK DRAWER] Error loading variations:', error);
      setVariations([]);
    } finally {
      setLoadingVariations(false);
    }
  }, [productId, companyId]);

  // Load branches - ISSUE 2 FIX: Remove duplicates by ID
  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoadingBranches(true);
      const branchesData = await branchService.getAllBranches(companyId);
      // Remove duplicates by ID (some branches may have same name)
      const uniqueBranches = branchesData.filter((branch, index, self) =>
        index === self.findIndex(b => b.id === branch.id)
      );
      setBranches(uniqueBranches);
    } catch (error) {
      console.error('[STOCK DRAWER] Error loading branches:', error);
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, [companyId]);

  // PART 4: Calculate totals - Aligned with Full Stock Ledger View logic
  const calculateTotals = useCallback((movementsData: StockMovement[]) => {
    let totalSold = 0; // Sum of SALE movements (OUT)
    let totalPurchased = 0; // Sum of PURCHASE movements (IN)
    let totalReturned = 0; // Sum of RETURN movements (IN)
    let totalAdjustmentPositive = 0; // ADJUSTMENT positive (IN)
    let totalAdjustmentNegative = 0; // ADJUSTMENT negative (OUT)
    let currentBalance = 0; // Running balance from all movements

    movementsData.forEach((movement) => {
      const qty = Number(movement.quantity || 0);
      const movementType = ((movement.movement_type || movement.type || '') as string).toLowerCase();
      
      // PART 1: Proper categorization (same as ledger)
      if (movementType === 'purchase') {
        totalPurchased += qty; // Purchase is usually positive (IN)
      } else if (movementType === 'sale') {
        totalSold += Math.abs(qty); // Sale is usually negative, convert to positive (OUT)
      } else if (movementType === 'return' || movementType === 'sell_return' || movementType === 'rental_return') {
        totalReturned += qty; // Returns are usually positive (IN)
      } else if (movementType === 'adjustment') {
        if (qty > 0) {
          totalAdjustmentPositive += qty; // Positive adjustment (IN)
        } else if (qty < 0) {
          totalAdjustmentNegative += Math.abs(qty); // Negative adjustment (OUT)
        }
      }
      
      // Calculate running balance (0 + all movements, including adjustments)
      currentBalance += qty;
    });

    const totalAdjustments = totalAdjustmentPositive - totalAdjustmentNegative; // Net adjustment

    return { 
      totalSold, 
      totalPurchased, 
      totalReturned,
      totalAdjustmentPositive,
      totalAdjustmentNegative,
      totalAdjustments, 
      currentBalance 
    };
  }, []);

  // Load stock movements - SAME LOGIC AS FULL LEDGER
  const loadStockMovements = useCallback(async () => {
    if (!productId || !companyId) {
      console.log('[STOCK DRAWER] Missing required params:', { productId, companyId });
      return;
    }

    try {
      setLoading(true);
      // Use same service method as FullStockLedgerView with branch_id support
      // Pass branchId only if explicitly selected (not 'all' or undefined)
      const branchIdToFilter = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : undefined;
      const data = await productService.getStockMovements(productId, companyId, selectedVariationId, branchIdToFilter);
      
      // No client-side filtering needed - service handles it
      const movementsData = data || [];
      setMovements(movementsData);
      
      // Log for debugging and consistency check
      const calculatedTotals = calculateTotals(movementsData);
      const balanceMatch = Math.abs(calculatedTotals.currentBalance - currentStock) < 0.01;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[STOCK DRAWER] Movements loaded:', {
          totalMovements: movementsData.length,
          totalSold: calculatedTotals.totalSold,
          totalPurchased: calculatedTotals.totalPurchased,
          totalAdjustments: calculatedTotals.totalAdjustments,
          currentBalance: calculatedTotals.currentBalance,
          dashboardStock: currentStock,
          match: balanceMatch ? '✅ MATCH' : '❌ MISMATCH',
          adjustmentCount: movementsData.filter(m => {
            const type = ((m.movement_type || m.type || '') as string).toLowerCase();
            return type === 'adjustment';
          }).length,
          movementsByType: movementsData.reduce((acc: Record<string, number>, m) => {
            const type = ((m.movement_type || m.type || 'unknown') as string).toLowerCase();
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {}),
          filters: {
            variationId: selectedVariationId || 'all',
            branchId: branchIdToFilter || 'all'
          }
        });
      }
      
      // Warn if mismatch (dev only)
      if (!balanceMatch) {
        const difference = currentStock - calculatedTotals.currentBalance;
        console.warn('[STOCK DRAWER] Balance mismatch detected!', {
          calculatedBalance: calculatedTotals.currentBalance,
          dashboardStock: currentStock,
          difference: difference > 0 ? `+${difference.toFixed(2)}` : difference.toFixed(2),
          totalAdjustments: calculatedTotals.totalAdjustments,
          possibleCauses: [
            'Opening stock not accounted for',
            'Recent movements not yet synced',
            'Manual stock updates without movement records',
            'Adjustment movements missing or not loaded'
          ]
        });
      }
    } catch (error: any) {
      console.error('[STOCK DRAWER] Error loading stock movements:', error);
      
      // Check if error is about variation_id column not existing
      const errorMessage = error.message || '';
      if (errorMessage.includes('variation_id') && errorMessage.includes('does not exist')) {
        setVariationColumnExists(false);
        // Clear variation filter if column doesn't exist
        if (selectedVariationId) {
          setSelectedVariationId(undefined);
        }
      }
      
      toast.error('Failed to load stock movements: ' + (error.message || 'Unknown error'));
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [productId, companyId, selectedVariationId, selectedBranchId, currentStock, calculateTotals]);

  // Calculate totals from movements (replaces legacy props)
  const totals = useMemo(() => {
    return calculateTotals(movements);
  }, [movements, calculateTotals]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      // Prevent scroll on drawer container's parent
      document.documentElement.style.overflow = 'hidden';
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Load data when drawer opens
  useEffect(() => {
    if (isOpen && productId && companyId) {
      loadVariations();
      loadBranches();
      loadStockMovements();
    }
  }, [isOpen, productId, companyId]); // Initial load

  // Reload when filters change
  useEffect(() => {
    if (isOpen && productId && companyId) {
      loadStockMovements();
    }
  }, [selectedVariationId, selectedBranchId, loadStockMovements]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return { date: "Today", time: `${diffMins} mins ago` };
      }
      return { date: "Today", time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    } else if (diffDays === 1) {
      return { date: "Yesterday", time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    } else if (diffDays < 7) {
      return { date: `${diffDays} days ago`, time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return { date: `${weeks} week${weeks > 1 ? 's' : ''} ago`, time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    } else {
      return { 
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
    }
  };

  // Get movement type label
  const getMovementType = (movement: StockMovement) => {
    return (movement.movement_type || movement.type || 'unknown').toLowerCase();
  };

  // Get movement reference (short format – never show UUID in UI)
  const getMovementReference = (movement: StockMovement) => {
    const sale = movement.reference_type && movement.reference_id && String(movement.reference_type).toLowerCase().includes('sale') ? getSaleById(movement.reference_id) : null;
    const purchase = movement.reference_type && movement.reference_id && String(movement.reference_type).toLowerCase().includes('purchase') ? getPurchaseById(movement.reference_id) : null;
    return formatStockReference({
      referenceType: movement.reference_type,
      referenceId: movement.reference_id,
      movementId: movement.id,
      saleInvoiceNo: sale?.invoiceNo,
      purchaseInvoiceNo: purchase?.purchaseNo,
      notes: movement.notes,
    });
  };

  // Handle reference click to open sale/purchase detail or show adjustment info
  const handleReferenceClick = async (movement: StockMovement) => {
    const refType = movement.reference_type?.toLowerCase();
    const refId = movement.reference_id;

    if (!refId) {
      // Movements like adjustment often have no reference_id – show friendly message
      if (refType?.includes('adjustment') || refType?.includes('audit')) {
        toast.info(movement.notes ? `Adjustment: ${movement.notes}` : 'Stock adjustment – no linked document.');
      } else {
        toast.info('This movement has no linked document to open.');
      }
      return;
    }

    try {
      if (refType === 'sale' || refType?.includes('sale') || refType?.includes('invoice')) {
        const sale = getSaleById(refId);
        if (sale) {
          setSelectedSaleId(sale.id);
          setViewSaleOpen(true);
        } else {
          toast.info('Opening sale record...');
        }
      } else if (refType === 'purchase' || refType?.includes('purchase') || refType?.includes('order')) {
        const purchase = getPurchaseById(refId);
        if (purchase) {
          setSelectedPurchase(purchase);
          setViewPurchaseOpen(true);
        } else {
          toast.info('Opening purchase record...');
        }
      } else if (refType === 'adjustment' || refType?.includes('adjustment') || refType?.includes('audit')) {
        toast.info(movement.notes ? `Adjustment: ${movement.notes}` : 'Adjustment – no additional details.');
      } else {
        toast.info(`Reference type: ${refType || 'N/A'}`);
      }
    } catch (error) {
      console.error('[STOCK DRAWER] Error opening reference:', error);
      toast.error('Failed to open reference');
    }
  };

  if (!isOpen) return null;

  // Sort movements by date (newest first for display)
  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [movements]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="w-full max-w-md bg-[#0B0F17] h-screen max-h-screen shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ height: '100vh', maxHeight: '100vh' }}
      >
        
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Stock Movement</h2>
            <p className="text-sm text-blue-400 font-medium">{productName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Filters - Fixed (if product has variations or multiple branches) */}
        {(variations.length > 0 || branches.length > 1) && (
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-[#111827]/50 space-y-3">
            {/* Only show variation filter if variations exist AND column exists in database */}
            {variations.length > 0 && variationColumnExists !== false && (
              <div>
                <Label className="text-xs text-gray-400 mb-1.5 block">Variation</Label>
                <Select
                  value={selectedVariationId || 'all'}
                  onValueChange={(value) => setSelectedVariationId(value === 'all' ? undefined : value)}
                >
                  <SelectTrigger className="h-8 bg-gray-900 border-gray-700 text-white text-xs">
                    <SelectValue placeholder="All Variations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Variations</SelectItem>
                    {variations.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.sku ? `(${v.sku})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {branches.length > 1 && (
              <div>
                <Label className="text-xs text-gray-400 mb-1.5 block">Branch / Location</Label>
                <Select
                  value={selectedBranchId || 'all'}
                  onValueChange={(value) => setSelectedBranchId(value === 'all' ? undefined : value)}
                >
                  <SelectTrigger className="h-8 bg-gray-900 border-gray-700 text-white text-xs">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* PART 4: Summary Cards - Fixed (4 cards: Sold, Purchased, Adjustments, Current) - Aligned with ledger */}
        <div className="flex-shrink-0 p-6 grid grid-cols-4 gap-3 border-b border-gray-800 bg-[#1F2937]/30">
           <div className="bg-gray-900 border border-red-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Sold</span>
              <span className="text-xl font-bold text-red-400 mt-1">{totals.totalSold.toFixed(2)}</span>
              <ArrowUpRight size={12} className="text-red-400 mt-1" />
           </div>
           <div className="bg-gray-900 border border-green-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Purchased</span>
              <span className="text-xl font-bold text-green-400 mt-1">{totals.totalPurchased.toFixed(2)}</span>
              <ArrowDownRight size={12} className="text-green-400 mt-1" />
           </div>
           <div className="bg-gray-900 border border-yellow-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Adjustments</span>
              <span className={cn(
                "text-xl font-bold mt-1",
                totals.totalAdjustments >= 0 ? "text-yellow-400" : "text-orange-400"
              )}>
                {totals.totalAdjustments >= 0 ? '+' : ''}{totals.totalAdjustments.toFixed(2)}
              </span>
              <div className="text-[9px] text-gray-500 mt-1">
                +{totals.totalAdjustmentPositive.toFixed(2)} / -{totals.totalAdjustmentNegative.toFixed(2)}
              </div>
           </div>
           <div className="bg-gray-900 border border-blue-800 p-3 rounded-lg flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-900/10 z-0"></div>
              <span className="text-[10px] text-blue-300 uppercase font-bold tracking-wider relative z-10">Current</span>
              <span className="text-xl font-bold text-blue-400 mt-1 relative z-10">{totals.currentBalance.toFixed(2)}</span>
              <Package size={12} className="text-blue-500 mt-1 relative z-10" />
           </div>
        </div>

        {/* Timeline List - Scrollable Body (flex-1 with min-h-0 for proper scrolling) */}
        <div className="flex-1 min-h-0 overflow-hidden bg-[#0B0F17]" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          <ScrollArea className="h-full p-6" style={{ height: '100%' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : sortedMovements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">No stock movements found</p>
              <p className="text-xs text-gray-500 mt-1">Stock movements will appear here</p>
            </div>
          ) : (
            <div className="relative border-l border-gray-800 ml-3 space-y-8">
              {sortedMovements.map((move) => {
                const qty = Number(move.quantity || 0);
                const isPositive = qty > 0;
                const movementType = getMovementType(move);
                const typeLower = movementType.toLowerCase();
                const reference = getMovementReference(move);
                const { date, time } = formatDate(move.created_at);
                
                let icon = <ShoppingCart size={14} />;
                let badgeColor = "text-red-400 bg-red-900/20 border-red-900/50";

                if (typeLower === 'purchase') {
                  icon = <Truck size={14} />;
                  badgeColor = "text-green-400 bg-green-900/20 border-green-900/50";
                } else if (typeLower === 'return' || typeLower === 'sell_return' || typeLower === 'rental_return') {
                  icon = <RefreshCw size={14} />;
                  badgeColor = "text-orange-400 bg-orange-900/20 border-orange-900/50";
                } else if (typeLower === 'adjustment') {
                  icon = <Package size={14} />;
                  badgeColor = isPositive 
                    ? "text-blue-400 bg-blue-900/20 border-blue-900/50" 
                    : "text-yellow-400 bg-yellow-900/20 border-yellow-900/50";
                } else if (typeLower === 'transfer') {
                  icon = <Truck size={14} />;
                  badgeColor = "text-purple-400 bg-purple-900/20 border-purple-900/50";
                } else if (typeLower === 'sale_cancelled' || typeLower === 'purchase_cancelled') {
                  icon = <RefreshCw size={14} />;
                  badgeColor = "text-amber-400 bg-amber-900/20 border-amber-900/50";
                }

                // Format movement type label
                const typeLabel = typeLower === 'sell_return' ? 'Return' 
                  : typeLower === 'purchase_return' ? 'Purchase Return'
                  : typeLower === 'rental_out' ? 'Rental Out'
                  : typeLower === 'rental_return' ? 'Rental Return'
                  : typeLower === 'sale_cancelled' ? 'SALE CANCELLED'
                  : typeLower === 'purchase_cancelled' ? 'PURCHASE CANCELLED'
                  : typeLower.charAt(0).toUpperCase() + typeLower.slice(1);

                return (
                  <div key={move.id} className="relative pl-8 group">
                     {/* Timeline Dot */}
                     <div className={cn(
                       "absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0B0F17]",
                       isPositive ? "bg-green-500" : "bg-red-500"
                     )}></div>

                     <div className="flex justify-between items-start">
                        <div className="flex-1">
                           <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 uppercase", badgeColor)}>
                                 {typeLabel}
                              </Badge>
                              <button
                                onClick={() => handleReferenceClick(move)}
                                className={cn(
                                  "text-sm font-bold hover:underline transition-colors",
                                  (typeLower === 'sale' || typeLower === 'purchase' || typeLower === 'adjustment')
                                    ? "text-white hover:text-blue-400 cursor-pointer"
                                    : "text-white cursor-default"
                                )}
                                title={
                                  typeLower === 'sale' ? 'Click to view sale details' :
                                  typeLower === 'purchase' ? 'Click to view purchase details' :
                                  typeLower === 'adjustment' ? 'Click to view adjustment details' :
                                  undefined
                                }
                              >
                                {reference}
                              </button>
                           </div>
                           <p className="text-xs text-gray-500">{date} • {time}</p>
                           {move.notes && (
                             <p className="text-xs text-gray-600 mt-1 italic">{move.notes}</p>
                           )}
                        </div>
                        <div className={cn(
                          "font-mono font-bold text-sm ml-4",
                          isPositive ? "text-green-400" : "text-red-400"
                        )}>
                           {isPositive ? "+" : ""}{qty} Units
                        </div>
                     </div>
                  </div>
                );
              })}
            </div>
          )}
          </ScrollArea>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 p-5 border-t border-gray-800 bg-gray-950">
          <div className="text-xs text-gray-500 mb-3 text-center">
            {sortedMovements.length} {sortedMovements.length === 1 ? 'movement' : 'movements'}
            {process.env.NODE_ENV === 'development' && totals.currentBalance !== currentStock && (
              <span className="ml-2 text-yellow-500">
                (Balance: {totals.currentBalance} vs Dashboard: {currentStock})
              </span>
            )}
          </div>
           <Button 
             variant="outline" 
             className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
             onClick={() => {
               if (productId) {
                 setShowFullLedger(true);
               } else {
                 toast.error('Product ID is required to view full ledger');
               }
             }}
           >
             View Full Ledger
           </Button>
        </div>

      </div>

      {/* Full Stock Ledger View Modal */}
      {productId && (
        <FullStockLedgerView
          isOpen={showFullLedger}
          onClose={() => setShowFullLedger(false)}
          productId={productId || ''}
          productName={productName}
          productSku={productSku}
          variationId={selectedVariationId}
          variationName={variations.find(v => v.id === selectedVariationId)?.name}
          currentStock={currentStock}
        />
      )}

      {/* Sale Details Drawer */}
      {selectedSaleId && (
        <ViewSaleDetailsDrawer
          isOpen={viewSaleOpen}
          onClose={() => {
            setViewSaleOpen(false);
            setSelectedSaleId(null);
          }}
          saleId={selectedSaleId}
          onEdit={() => {
            setViewSaleOpen(false);
            toast.info('Edit sale functionality');
          }}
          onDelete={() => {
            setViewSaleOpen(false);
            toast.info('Delete sale functionality');
          }}
          onAddPayment={() => {
            setViewSaleOpen(false);
            toast.info('Add payment functionality');
          }}
        />
      )}

      {/* Purchase Details Drawer */}
      {selectedPurchase && (
        <ViewPurchaseDetailsDrawer
          isOpen={viewPurchaseOpen}
          onClose={() => {
            setViewPurchaseOpen(false);
            setSelectedPurchase(null);
          }}
          purchaseId={selectedPurchase.id}
          onEdit={() => {
            setViewPurchaseOpen(false);
            toast.info('Edit purchase functionality');
          }}
          onDelete={() => {
            setViewPurchaseOpen(false);
            toast.info('Delete purchase functionality');
          }}
        />
      )}
    </div>
  );
};
