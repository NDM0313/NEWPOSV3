import React, { useEffect, useState, useCallback } from 'react';
import { X, Download, FileText, ArrowUpRight, ArrowDownRight, Loader2, ExternalLink, Filter, Package, Printer } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { productService } from '@/app/services/productService';
import { branchService, Branch } from '@/app/services/branchService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { formatStockReference } from '@/app/utils/formatters';
import { ViewSaleDetailsDrawer } from '../sales/ViewSaleDetailsDrawer';
import { ViewPurchaseDetailsDrawer } from '../purchases/ViewPurchaseDetailsDrawer';
import { StockLedgerClassicPrintView } from './StockLedgerClassicPrintView';
import { supabase } from '@/lib/supabase';

interface StockMovement {
  id: string;
  movement_type?: string; // May be named 'type' in some schemas
  type?: string; // Alternative column name
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference_type?: string;
  reference_id?: string;
  variation_id?: string; // For variable products
  notes?: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  variation?: {
    id: string;
    name: string;
    sku: string;
  };
}

interface FullStockLedgerViewProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  productSku?: string;
  variationId?: string; // Optional: for variable products
  variationName?: string; // Optional: variation name to display
  currentStock?: number; // Current stock from dashboard/product (for balance verification)
}

export const FullStockLedgerView: React.FC<FullStockLedgerViewProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  productSku,
  variationId,
  variationName,
  currentStock,
}) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { getSaleById } = useSales();
  const { getPurchaseById } = usePurchases();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningBalance, setRunningBalance] = useState<Map<string, number>>(new Map());
  
  // State for filters
  const [selectedVariationId, setSelectedVariationId] = useState<string | undefined>(variationId);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(contextBranchId || undefined);
  const [variations, setVariations] = useState<Array<{id: string; name: string; sku?: string}>>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // State for sale/purchase detail drawers
  const [viewSaleOpen, setViewSaleOpen] = useState(false);
  const [viewPurchaseOpen, setViewPurchaseOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showClassicPrintView, setShowClassicPrintView] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');

  // Company name for print view header
  useEffect(() => {
    if (!companyId) {
      setCompanyName('');
      return;
    }
    supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data }) => setCompanyName(data?.name || ''));
  }, [companyId]);

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
      console.error('[FULL LEDGER] Error loading variations:', error);
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
      console.error('[FULL LEDGER] Error loading branches:', error);
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (isOpen && productId && companyId) {
      loadVariations();
      loadBranches();
      loadStockMovements();
    }
  }, [isOpen, productId, companyId]); // Initial load

  useEffect(() => {
    if (isOpen && productId && companyId) {
      loadStockMovements();
    }
  }, [selectedVariationId, selectedBranchId]); // Reload when filters change

  const loadStockMovements = async () => {
    if (!productId || !companyId) {
      console.log('[FULL LEDGER] Missing required params:', { productId, companyId });
      return;
    }

      console.log('[FULL LEDGER] Loading stock movements:', {
      productId,
      companyId,
      productName,
      productSku,
      variationId,
      variationName,
      timestamp: new Date().toISOString()
    });

    try {
      setLoading(true);
      // Pass branchId only if explicitly selected (not 'all' or undefined)
      const branchIdToFilter = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : undefined;
      const data = await productService.getStockMovements(productId, companyId, selectedVariationId, branchIdToFilter);
      
      console.log('[FULL LEDGER] Received data:', {
        dataCount: data?.length || 0,
        sampleData: data?.[0] || null,
        allData: data,
        dataStructure: data?.[0] ? Object.keys(data[0]) : []
      });
      
      // Verify data structure and log any issues
      if (data && data.length > 0) {
        const firstRow = data[0];
        
        // Count movements by type
        const movementTypeCounts: Record<string, number> = {};
        data.forEach(m => {
          const type = (m.movement_type || m.type || 'unknown').toLowerCase();
          movementTypeCounts[type] = (movementTypeCounts[type] || 0) + 1;
        });
        
        const adjustmentCount = data.filter(m => {
          const type = (m.movement_type || m.type || '').toLowerCase();
          return type === 'adjustment';
        }).length;
        
        // Calculate total quantity from adjustments
        const adjustmentQuantity = data
          .filter(m => {
            const type = (m.movement_type || m.type || '').toLowerCase();
            return type === 'adjustment';
          })
          .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
        
        console.log('[FULL LEDGER] Data analysis:', {
          totalMovements: data.length,
          movementTypeCounts,
          adjustmentCount,
          adjustmentQuantity,
          firstRow: {
            id: firstRow.id,
            movement_type: firstRow.movement_type || firstRow.type,
            quantity: firstRow.quantity,
            created_at: firstRow.created_at
          },
          allKeys: Object.keys(firstRow)
        });
      }
      
      // Use data as-is (variation filtering is handled in query if variationId provided)
      // Don't do additional filtering here as it may exclude valid data
      let filteredData = data || [];
      
      // Only filter by variation_id if explicitly provided AND data has variation_id field
      if (variationId && filteredData.length > 0) {
        const beforeFilter = filteredData.length;
        filteredData = filteredData.filter(m => {
          // If movement has variation_id, it must match
          // If movement doesn't have variation_id field, include it (for backward compatibility)
          return !('variation_id' in m) || !m.variation_id || m.variation_id === variationId;
        });
        if (beforeFilter !== filteredData.length) {
          console.log('[FULL LEDGER] Additional variation_id filter applied:', {
            variationId,
            beforeFilter,
            afterFilter: filteredData.length
          });
        }
      }
      // If variationId is NOT provided, show ALL movements (don't filter)
      
      // Detailed breakdown of all movement types
      const finalMovementTypeBreakdown: Record<string, number> = {};
      filteredData.forEach((m: any) => {
        const type = ((m.movement_type || m.type || 'unknown') as string).toLowerCase();
        finalMovementTypeBreakdown[type] = (finalMovementTypeBreakdown[type] || 0) + 1;
      });

      console.log('[FULL LEDGER] Final movements count:', {
        originalCount: data?.length || 0,
        filteredCount: filteredData.length,
        variationId: variationId || 'none (showing all)',
        movementTypeBreakdown: finalMovementTypeBreakdown,
        adjustmentCount: finalMovementTypeBreakdown['adjustment'] || 0,
        adjustmentMovements: filteredData.filter((m: any) => {
          const type = ((m.movement_type || m.type || '') as string).toLowerCase();
          return type === 'adjustment';
        }).map((m: any) => ({
          id: m.id,
          quantity: m.quantity,
          created_at: m.created_at,
          notes: m.notes
        }))
      });
      
      setMovements(filteredData);

      // Calculate running balance - START FROM 0 (like normal ledger)
      // Ledger format: Opening Balance (0) + All Movements = Current Balance
      const balanceMap = new Map<string, number>();
      
      // Sort by date ascending for balance calculation (oldest first)
      const sortedMovements = [...filteredData].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Start from 0 (opening balance) - standard ledger format
      let runningBalance = 0;
      const movementBreakdown: Array<{type: string, quantity: number, runningBalance: number, date: string}> = [];
      
      sortedMovements.forEach((movement) => {
        const qty = Number(movement.quantity || 0);
        const movementType = (movement.movement_type || movement.type || 'unknown').toLowerCase();
        
        // Apply movement to running balance
        runningBalance += qty;
        balanceMap.set(movement.id, runningBalance);
        
        // Track breakdown for debugging
        movementBreakdown.push({
          type: movementType,
          quantity: qty,
          runningBalance: runningBalance,
          date: movement.created_at
        });
      });

      // Final calculated balance (should match currentStock if all movements are included)
      const calculatedBalance = runningBalance;

      // Log balance verification with detailed breakdown
      if (currentStock !== undefined) {
        const balanceMatch = Math.abs(calculatedBalance - currentStock) < 0.01; // Allow small floating point differences
        
        // Count adjustments in calculation
        const adjustmentsInCalculation = sortedMovements.filter(m => {
          const type = (m.movement_type || m.type || '').toLowerCase();
          return type === 'adjustment';
        });
        
        // Calculate totals by type
        const totalsByType: Record<string, number> = {};
        sortedMovements.forEach(m => {
          const type = ((m.movement_type || m.type || 'unknown') as string).toLowerCase();
          totalsByType[type] = (totalsByType[type] || 0) + Number(m.quantity || 0);
        });
        
        console.log('[FULL LEDGER] Balance verification (Ledger Style - Starting from 0):', {
          openingBalance: 0,
          calculatedBalance: calculatedBalance.toFixed(2),
          dashboardStock: currentStock.toFixed(2),
          difference: (calculatedBalance - currentStock).toFixed(2),
          match: balanceMatch ? '✅ MATCH' : '❌ MISMATCH',
          totalMovements: sortedMovements.length,
          adjustmentsInCalculation: adjustmentsInCalculation.length,
          adjustmentQuantities: adjustmentsInCalculation.map(a => ({
            id: a.id,
            quantity: a.quantity,
            type: a.movement_type || a.type,
            created_at: a.created_at,
            notes: a.notes
          })),
          totalsByType,
          movementBreakdown: movementBreakdown // All movements for debugging
        });
        
        if (!balanceMatch) {
          const missingAmount = currentStock - calculatedBalance;
          console.warn('[FULL LEDGER] Balance mismatch detected!', {
            openingBalance: 0,
            calculatedBalance,
            dashboardStock: currentStock,
            difference: missingAmount,
            missingAmount: missingAmount > 0 ? `+${missingAmount.toFixed(2)}` : missingAmount.toFixed(2),
            possibleCauses: [
              `Adjustment movements missing (expected ${missingAmount > 0 ? '+' : ''}${missingAmount.toFixed(2)} units)`,
              'Opening stock not accounted for',
              'Recent movements not yet synced',
              'Manual stock updates without movement records'
            ],
            suggestion: missingAmount > 0 
              ? `Create an adjustment of +${missingAmount.toFixed(2)} to match dashboard stock`
              : `Check for missing adjustment of ${missingAmount.toFixed(2)}`
          });
        }
      }

      setRunningBalance(balanceMap);
    } catch (error: any) {
      console.error('[Full Ledger] Error loading stock movements:', error);
      toast.error('Failed to load stock ledger: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals - Include ALL movement types (purchase, sale, adjustment, etc.)
  // PART 1 FIX: Proper categorization of movements
  const totals = React.useMemo(() => {
    let totalPurchased = 0; // PURCHASE movements (IN)
    let totalSold = 0; // SALE movements (OUT)
    let totalReturned = 0; // RETURN movements (IN)
    let totalAdjustmentPositive = 0; // ADJUSTMENT positive (IN)
    let totalAdjustmentNegative = 0; // ADJUSTMENT negative (OUT)
    let currentBalance = 0; // Start from 0 (opening balance)

    movements.forEach((movement) => {
      const qty = Number(movement.quantity || 0);
      const movementType = ((movement.movement_type || movement.type || '') as string).toLowerCase();
      
      // PART 1: Proper categorization
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
      
      // Calculate running balance (0 + all movements)
      currentBalance += qty;
    });

    // Calculate totals
    const totalIn = totalPurchased + totalReturned + totalAdjustmentPositive;
    const totalOut = totalSold + totalAdjustmentNegative;
    const totalAdjustments = totalAdjustmentPositive - totalAdjustmentNegative; // Net adjustment

    // Log totals calculation for debugging
    console.log('[FULL LEDGER] Totals calculation:', {
      totalPurchased,
      totalSold,
      totalReturned,
      totalAdjustmentPositive,
      totalAdjustmentNegative,
      totalAdjustments,
      totalIn,
      totalOut,
      currentBalance,
      totalMovements: movements.length,
      movementsByType: movements.reduce((acc: Record<string, number>, m) => {
        const type = ((m.movement_type || m.type || 'unknown') as string).toLowerCase();
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    });

    return { 
      totalPurchased, 
      totalSold, 
      totalReturned, 
      totalAdjustmentPositive, 
      totalAdjustmentNegative,
      totalAdjustments,
      totalIn, 
      totalOut, 
      currentBalance 
    };
  }, [movements]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMovementType = (movement: StockMovement): string => {
    // Handle both 'movement_type' and 'type' column names
    return movement.movement_type || movement.type || 'unknown';
  };

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      purchase: 'Purchase',
      sale: 'Sale',
      return: 'Return',
      adjustment: 'Adjustment',
      transfer: 'Transfer',
      'sell_return': 'Sell Return',
      'purchase_return': 'Purchase Return',
      'rental_out': 'Rental Out',
      'rental_return': 'Rental Return',
    };
    return labels[type.toLowerCase()] || type;
  };

  const getMovementTypeColor = (type: string, quantity: number) => {
    const typeLower = type.toLowerCase();
    const isIn = quantity > 0;
    
    // Adjustment: Blue/Yellow based on IN/OUT
    if (typeLower === 'adjustment') {
      return isIn 
        ? 'text-blue-400 bg-blue-900/20 border-blue-900/50' 
        : 'text-yellow-400 bg-yellow-900/20 border-yellow-900/50';
    }
    
    // Purchase/Return (usually IN)
    if (typeLower === 'purchase' || typeLower === 'return' || typeLower === 'sell_return' || typeLower === 'rental_return') {
      return isIn ? 'text-green-400 bg-green-900/20 border-green-900/50' : 'text-red-400 bg-red-900/20 border-red-900/50';
    }
    
    // Sale/Purchase Return (usually OUT)
    if (typeLower === 'sale' || typeLower === 'purchase_return' || typeLower === 'rental_out') {
      return 'text-red-400 bg-red-900/20 border-red-900/50';
    }
    
    // Transfer (neutral)
    if (typeLower === 'transfer') {
      return 'text-purple-400 bg-purple-900/20 border-purple-900/50';
    }
    
    return 'text-gray-400 bg-gray-900/20 border-gray-800';
  };
  
  // Handle reference click to open sale/purchase detail
  const handleReferenceClick = async (movement: StockMovement) => {
    const refType = movement.reference_type?.toLowerCase();
    const refId = movement.reference_id;
    
    if (!refId) {
      toast.info('No reference available for this movement');
      return;
    }
    
    try {
      if (refType === 'sale') {
        // Try to get sale from context
        const sale = getSaleById(refId);
        if (sale) {
          setSelectedSaleId(sale.id);
          setViewSaleOpen(true);
        } else {
          toast.info('Opening sale record...');
          // Could fetch from service if needed
        }
      } else if (refType === 'purchase') {
        // Try to get purchase from context
        const purchase = getPurchaseById(refId);
        if (purchase) {
          setSelectedPurchase(purchase);
          setViewPurchaseOpen(true);
        } else {
          toast.info('Opening purchase record...');
          // Could fetch from service if needed
        }
      } else {
        toast.info(`Reference type: ${refType || 'N/A'}`);
      }
    } catch (error) {
      console.error('[FULL LEDGER] Error opening reference:', error);
      toast.error('Failed to open reference');
    }
  };

  // Prevent body scroll - MUST be before early return to follow Rules of Hooks
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const branchLabel =
    !selectedBranchId || selectedBranchId === 'all'
      ? 'All Branches'
      : branches.find((b) => b.id === selectedBranchId)?.name || 'All Branches';

  return (
    <>
      {showClassicPrintView && (
        <StockLedgerClassicPrintView
          companyName={companyName || undefined}
          productName={productName}
          productSku={productSku}
          branchLabel={branchLabel}
          movements={movements}
          runningBalance={runningBalance}
          totals={{
            totalPurchased: totals.totalPurchased,
            totalSold: totals.totalSold,
            totalAdjustments: totals.totalAdjustments,
            currentBalance: totals.currentBalance,
          }}
          getMovementTypeLabel={getMovementTypeLabel}
          getSaleById={getSaleById}
          getPurchaseById={getPurchaseById}
          onClose={() => setShowClassicPrintView(false)}
        />
      )}
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0B0F17] rounded-xl border border-gray-800 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText size={20} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Full Stock Ledger View</h2>
              <p className="text-xs text-gray-400">
                {productName} {productSku && `(${productSku})`}
                {variationName && ` • ${variationName}`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X size={20} />
          </Button>
        </div>

        {/* PART 2: Branch & Variation Filters */}
        {(variations.length > 0 || branches.length > 1) && (
          <div className="px-6 py-4 border-b border-gray-800 bg-[#111827]/50 flex gap-4 shrink-0">
            {variations.length > 0 && (
              <div className="flex-1">
                <Label className="text-xs text-gray-400 mb-1.5 block">Variation</Label>
                <Select
                  value={selectedVariationId || 'all'}
                  onValueChange={(value) => setSelectedVariationId(value === 'all' ? undefined : value)}
                >
                  <SelectTrigger className="h-9 bg-gray-900 border-gray-700 text-white text-sm">
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
              <div className="flex-1">
                <Label className="text-xs text-gray-400 mb-1.5 block">Branch / Location</Label>
                <Select
                  value={selectedBranchId || 'all'}
                  onValueChange={(value) => setSelectedBranchId(value === 'all' ? undefined : value)}
                >
                  <SelectTrigger className="h-9 bg-gray-900 border-gray-700 text-white text-sm">
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

        {/* PART 3: Top Summary Cards - Updated with proper breakdown */}
        <div className="p-6 grid grid-cols-4 gap-4 border-b border-gray-800 bg-[#1F2937]/30">
          <div className="bg-gray-900 border border-green-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight size={16} className="text-green-400" />
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Purchased</span>
            </div>
            <span className="text-2xl font-bold text-green-400">{totals.totalPurchased.toFixed(2)}</span>
          </div>
          <div className="bg-gray-900 border border-red-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight size={16} className="text-red-400" />
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Sold</span>
            </div>
            <span className="text-2xl font-bold text-red-400">{totals.totalSold.toFixed(2)}</span>
          </div>
          <div className="bg-gray-900 border border-yellow-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package size={16} className="text-yellow-400" />
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Adjustments</span>
            </div>
            <span className={cn(
              "text-2xl font-bold",
              totals.totalAdjustments >= 0 ? "text-yellow-400" : "text-orange-400"
            )}>
              {totals.totalAdjustments >= 0 ? '+' : ''}{totals.totalAdjustments.toFixed(2)}
            </span>
            <div className="text-xs text-gray-500 mt-1">
              +{totals.totalAdjustmentPositive.toFixed(2)} / -{totals.totalAdjustmentNegative.toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-900 border border-blue-800 p-4 rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-900/10 z-0"></div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <FileText size={16} className="text-blue-400" />
              <span className="text-xs text-blue-300 uppercase font-bold tracking-wider">Current Stock</span>
            </div>
            <span className="text-2xl font-bold text-blue-400 relative z-10">
              {totals.currentBalance.toFixed(2)}
              {currentStock !== undefined && Math.abs(totals.currentBalance - currentStock) > 0.01 && (
                <span className="text-xs text-yellow-400 ml-2 block mt-1">
                  (Expected: {currentStock.toFixed(2)})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 bg-[#0B0F17] overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>No stock movements found</p>
                <p className="text-xs mt-2 text-gray-500">
                  No movements in selected filters. Try changing branch or variation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#0B0F17] z-10">
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date & Time</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Quantity Change</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">New Quantity</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Unit Cost</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Total Cost</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Reference No</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Customer/Supplier</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sort movements by date DESC for display (newest first), but balance already calculated ASC */}
                    {[...movements].sort((a, b) => 
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    ).map((movement, index) => {
                      const qty = Number(movement.quantity || 0);
                      const isIn = qty > 0;
                      const balance = runningBalance.get(movement.id) || 0;
                      const movementType = getMovementType(movement);
                      const sale = movement.reference_type && movement.reference_id && movement.reference_type.toLowerCase().includes('sale') ? getSaleById(movement.reference_id) : null;
                      const purchase = movement.reference_type && movement.reference_id && movement.reference_type.toLowerCase().includes('purchase') ? getPurchaseById(movement.reference_id) : null;
                      const referenceNo = formatStockReference({
                        referenceType: movement.reference_type,
                        referenceId: movement.reference_id,
                        movementId: movement.id,
                        saleInvoiceNo: sale?.invoiceNo,
                        purchaseInvoiceNo: purchase?.purchaseNo,
                        notes: movement.notes,
                      });
                      let customerSupplierName = '-';
                      if (sale) customerSupplierName = sale.customerName || sale.customer_name || '-';
                      else if (purchase) customerSupplierName = purchase.supplierName || purchase.supplier_name || '-';

                      return (
                        <tr
                          key={movement.id}
                          className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-gray-300 whitespace-nowrap">{formatDate(movement.created_at)}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs uppercase',
                                getMovementTypeColor(movementType, qty)
                              )}
                            >
                              {getMovementTypeLabel(movementType)}
                            </Badge>
                          </td>
                          <td className={cn('py-3 px-4 text-right font-mono font-semibold whitespace-nowrap', isIn ? 'text-green-400' : 'text-red-400')}>
                            {isIn ? '+' : ''}{qty.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-blue-400 whitespace-nowrap">
                            {balance.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-300 whitespace-nowrap">
                            {movement.unit_cost ? `$${Number(movement.unit_cost).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-300 whitespace-nowrap">
                            {movement.total_cost ? `$${Number(movement.total_cost).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {movement.reference_type && movement.reference_id ? (
                              <button
                                onClick={() => handleReferenceClick(movement)}
                                className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors whitespace-nowrap"
                                title={`Click to view ${movement.reference_type} details`}
                              >
                                {referenceNo}
                                <ExternalLink size={12} />
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">{referenceNo}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-300 text-xs max-w-[140px] truncate" title={customerSupplierName}>
                            {customerSupplierName}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs min-w-[120px] max-w-[280px] break-words" title={movement.notes || ''}>
                            {movement.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-gray-950 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-gray-500">
            Total {movements.length} {movements.length === 1 ? 'movement' : 'movements'}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={printOrientation}
              onChange={(e) => setPrintOrientation(e.target.value as 'portrait' | 'landscape')}
              className="h-8 px-2 rounded bg-gray-800 border border-gray-700 text-gray-300 text-xs"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800" onClick={() => setShowClassicPrintView(true)}>
              <Printer size={14} className="mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800" onClick={() => setShowClassicPrintView(true)}>
              <Download size={14} className="mr-2" />
              Save as PDF
            </Button>
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>

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
          purchase={selectedPurchase}
        />
      )}
      </div>
    </>
  );
};
