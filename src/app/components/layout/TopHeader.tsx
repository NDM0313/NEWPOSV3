import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, 
  Menu, 
  MapPin, 
  Plus,
  ChevronDown,
  User,
  Settings,
  Lock,
  LogOut,
  FileText,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useSales } from '../../context/SalesContext';
import { usePurchases } from '../../context/PurchaseContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { branchService, Branch } from '../../services/branchService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { DatePicker } from "../ui/DatePicker";
import { cn } from "../ui/utils";
import { toast } from 'sonner';
import { UserProfilePage } from '../users/UserProfilePage';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { productService } from '../../services/productService';
import { shipmentAccountingService } from '../../services/shipmentAccountingService';
import { useCheckPermission } from '../../hooks/useCheckPermission';

export const TopHeader = () => {
  const { toggleSidebar, openDrawer, setCurrentView, setMobileNavOpen } = useNavigation();
  const { signOut, user, companyId, branchId } = useSupabase();
  const { hasPermission } = useCheckPermission();
  const { formatCurrency } = useFormatCurrency();
  const globalFilter = useGlobalFilter();
  const { dateRangeType, setDateRangeType, setCustomDateRange, getDateRangeLabel, setBranchId: setGlobalBranchId, customStartDate, customEndDate, startDateObj, endDateObj } = globalFilter;

  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name?: string; sku?: string; current_stock?: number }[]>([]);
  const [courierBalances, setCourierBalances] = useState<{ courier_name: string; balance: number }[]>([]);

  // Load branches (cached) for header dropdown; global rule: hide when single branch
  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadingBranches(true);
      const branchesData = await branchService.getBranchesCached(companyId);
      setBranches(branchesData);
    } catch (error) {
      console.error('[TOP HEADER] Error loading branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoadingBranches(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Step 7 — Notifications: low stock + courier balance
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const [lowStock, couriers] = await Promise.all([
          productService.getLowStockProducts(companyId).catch(() => []),
          shipmentAccountingService.getCourierBalances(companyId).catch(() => []),
        ]);
        if (cancelled) return;
        setLowStockProducts(Array.isArray(lowStock) ? lowStock : []);
        setCourierBalances((couriers ?? []).filter((c: { balance: number }) => c.balance > 0).map((c: any) => ({ courier_name: c.courier_name, balance: c.balance })));
      } catch {
        if (!cancelled) setLowStockProducts([]);
        if (!cancelled) setCourierBalances([]);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // If business has only one branch, auto-select it (persist in global filter + Supabase)
  useEffect(() => {
    if (branches.length === 1 && (!branchId || branchId === 'all')) {
      setGlobalBranchId(branches[0].id);
    }
  }, [branches, branchId, setGlobalBranchId]);

  // Get current branch name (All Branches = real option for admin)
  const currentBranch = useMemo(() => {
    if (!branchId) return 'Select Branch';
    if (branchId === 'all') return 'All Branches';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Select Branch';
  }, [branchId, branches]);

  // Calculate notification count from real data (Step 7: low stock, courier balance, payment due)
  const notificationCount = useMemo(() => {
    let count = 0;
    if (lowStockProducts.length > 0) count += Math.min(lowStockProducts.length, 5);
    if (courierBalances.length > 0) count += courierBalances.length;
    const unpaidSales = sales.sales.filter(s => s.type === 'invoice' && s.due > 0).length;
    if (unpaidSales > 0) count += unpaidSales;
    const unpaidPurchases = purchases.purchases.filter(p => p.due > 0).length;
    if (unpaidPurchases > 0) count += unpaidPurchases;
    const pendingExpenses = expenses.expenses.filter(e => e.status === 'pending').length;
    if (pendingExpenses > 0) count += pendingExpenses;
    return count;
  }, [sales.sales, purchases.purchases, expenses.expenses, lowStockProducts.length, courierBalances.length]);

  // Handle branch change — update global filter (persists + syncs to Supabase)
  const handleBranchChange = (newBranchId: string) => {
    setGlobalBranchId(newBranchId);
    toast.success('Branch switched successfully');
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      // Redirect will happen automatically via ProtectedRoute
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleViewProfile = () => {
    setShowProfile(true);
  };

  const handleSettings = () => {
    if (!hasPermission('settings.view')) {
      toast.error('You do not have access to Settings.');
      return;
    }
    setCurrentView('settings');
  };

  const handleChangePassword = () => {
    setShowChangePassword(true);
  };

  const handleNotifications = () => {
    setShowNotifications(!showNotifications);
    // Show notifications dropdown
  };

  // Get notifications list (Step 7: low stock, courier balance, payment due)
  const notifications = useMemo(() => {
    const notifs: Array<{ id: string; type: string; message: string; time: string }> = [];
    lowStockProducts.slice(0, 3).forEach((p: any) => {
      notifs.push({
        id: `lowstock-${p.id}`,
        type: 'low_stock',
        message: `Low stock: ${p.name || p.sku || 'Product'} - ${Number(p.current_stock) ?? 0} left`,
        time: '',
      });
    });
    courierBalances.slice(0, 3).forEach((c, i) => {
      notifs.push({
        id: `courier-${i}`,
        type: 'courier_balance',
        message: `Courier due: ${c.courier_name} - ${formatCurrency(c.balance)}`,
        time: '',
      });
    });
    sales.sales
      .filter(s => s.type === 'invoice' && s.due > 0)
      .slice(0, 3)
      .forEach(sale => {
        notifs.push({
          id: `sale-${sale.id}`,
          type: 'receivable',
          message: `Payment due: ${sale.invoiceNo} - ${formatCurrency(sale.due)}`,
          time: sale.date || new Date().toISOString().split('T')[0],
        });
      });
    purchases.purchases
      .filter(p => p.due > 0)
      .slice(0, 2)
      .forEach(purchase => {
        notifs.push({
          id: `purchase-${purchase.id}`,
          type: 'payable',
          message: `Unpaid purchase: ${purchase.purchaseNo} - ${formatCurrency(purchase.due)}`,
          time: purchase.date || new Date().toISOString().split('T')[0],
        });
      });
    expenses.expenses
      .filter(e => e.status === 'pending')
      .slice(0, 2)
      .forEach(expense => {
        notifs.push({
          id: `expense-${expense.id}`,
          type: 'expense',
          message: `Pending expense: ${expense.expenseNo} - ${formatCurrency(expense.amount)}`,
          time: expense.date || new Date().toISOString().split('T')[0],
        });
      });
    return notifs.slice(0, 10);
  }, [sales.sales, purchases.purchases, expenses.expenses, lowStockProducts, courierBalances, formatCurrency]);

  // Get user display info
  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
  const userEmail = user?.email || 'admin@dinbridal.com';
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  return (
    <header className="h-14 md:h-16 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 shadow-sm">
      {/* LEFT SECTION: Mobile Menu + Branch Selector */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle - opens full nav drawer */}
        <button 
          onClick={() => setMobileNavOpen?.(true)}
          className="lg:hidden p-2.5 rounded-xl text-muted-foreground hover:text-header-foreground hover:bg-accent transition-all duration-200 touch-manipulation"
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
        
        {/* Branch / Location Selector — global rule: only show when multiple branches */}
        {!loadingBranches && branches.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="hidden lg:flex items-center gap-2 px-4 py-2 h-10 bg-accent hover:bg-muted border border-border text-foreground rounded-lg transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"></div>
                <MapPin size={16} className="text-blue-500" />
                <span className="font-medium">{currentBranch}</span>
                <ChevronDown size={16} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              className="w-72 bg-card border-border shadow-2xl rounded-lg p-2"
            >
              <div className="px-3 py-2 mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Location</p>
              </div>
              <>
                <DropdownMenuItem
                  onClick={() => handleBranchChange('all')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                    branchId === 'all' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1">
                    <div className="font-medium">All Branches</div>
                    <div className="text-xs text-muted-foreground">View data from all locations</div>
                  </div>
                  {branchId === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>}
                </DropdownMenuItem>
                {branches.length > 0 && (
                  <div className="border-t border-border my-2" />
                )}
                {branches.map((b) => (
                  <DropdownMenuItem
                    key={b.id}
                    onClick={() => handleBranchChange(b.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                      branchId === b.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      b.is_active ? "bg-emerald-500" : "bg-gray-600"
                    )}></div>
                    <div className="flex-1">
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.address || b.city || 'No address'}</div>
                    </div>
                    {branchId === b.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {loadingBranches && (
          <div className="hidden lg:flex items-center gap-2 px-4 py-2 h-10">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* CENTER SECTION: Empty (for balanced layout) */}
      <div className="flex-1"></div>

      {/* RIGHT SECTION: Actions Zone */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Create New Dropdown - compact on mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              className="flex items-center gap-2 px-4 py-2 h-9 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition-all border-0"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline">Create New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</p>
            </div>
            <DropdownMenuItem 
              onClick={() => openDrawer('addSale')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <FileText size={16} className="text-emerald-500" />
              <span>New Invoice</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => openDrawer('addPurchase')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <ShoppingCart size={16} className="text-orange-500" />
              <span>New Purchase</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border my-2" />
            <DropdownMenuItem 
              onClick={() => openDrawer('addProduct')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Package size={16} className="text-blue-500" />
              <span>Add Product</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => openDrawer('addContact')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Users size={16} className="text-purple-500" />
              <span>Add Contact</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date Range Selector - hidden on small mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost"
              className="hidden sm:flex items-center gap-2 px-3 py-2 h-9 bg-accent hover:bg-muted border border-border text-foreground rounded-lg transition-all"
            >
              <Calendar size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium hidden md:inline">{getDateRangeLabel()}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end"
            className="w-48 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            <DropdownMenuItem
              onClick={() => setDateRangeType('fromStart')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'fromStart' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              From start
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('today')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'today' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Today
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('last7days')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'last7days' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Last 7 Days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('last15days')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'last15days' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Last 15 Days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('last30days')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'last30days' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Last 30 Days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('last90days')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'last90days' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Last 90 Days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('thisWeek')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'thisWeek' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              This Week
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('thisMonth')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'thisMonth' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              This Month
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('thisYear')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'thisYear' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              This Year
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border my-2" />
            <DropdownMenuItem
              onClick={() => {
                setShowCustomDatePicker(true);
                setDateRangeType('customRange');
              }}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'customRange' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Custom Range
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications - compact on mobile */}
        <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
          <DropdownMenuTrigger asChild>
            <button 
              className="relative p-2 md:p-2.5 rounded-xl transition-all bg-accent hover:bg-muted border border-border text-muted-foreground hover:text-foreground touch-manipulation"
              title="Notifications"
            >
              <Bell size={20} />
              {notificationCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground border-2 border-header-background text-xs font-bold shadow-sm"
                >
                  {notificationCount}
                </Badge>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-80 bg-card border-border shadow-2xl rounded-lg p-2 max-h-[400px] overflow-y-auto"
          >
            <div className="px-3 py-2 mb-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notifications</p>
            </div>
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent transition-all"
                  onClick={() => {
                    if (notif.type === 'receivable') {
                      setCurrentView('sales');
                    } else if (notif.type === 'payable') {
                      setCurrentView('purchases');
                    } else if (notif.type === 'expense') {
                      setCurrentView('expenses');
                    }
                    setShowNotifications(false);
                  }}
                >
                  <div className="flex items-start justify-between w-full">
                    <p className="text-sm font-medium text-foreground">{notif.message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{notif.time}</p>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 md:px-3 py-2 h-9 md:h-10 bg-accent hover:bg-muted border border-border rounded-xl transition-all touch-manipulation"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                {userInitial}
              </div>
              <div className="hidden xl:flex flex-col items-start">
                <span className="text-sm font-semibold text-foreground leading-tight">{userDisplayName}</span>
                <span className="text-xs text-muted-foreground leading-tight">Super Admin</span>
              </div>
              <ChevronDown size={16} className="text-muted-foreground hidden xl:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-64 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            {/* User Info Header */}
            <div className="px-3 py-3 mb-2 bg-accent rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold shadow-sm">
                  {userInitial}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{userDisplayName}</div>
                  <div className="text-xs text-muted-foreground">{userEmail}</div>
                </div>
              </div>
            </div>

            <DropdownMenuItem 
              onClick={handleViewProfile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <User size={16} className="text-blue-500" />
              <span>View Profile</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={handleSettings}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Settings size={16} className="text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={handleChangePassword}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Lock size={16} className="text-orange-500" />
              <span>Change Password</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-border my-2" />
            
            <DropdownMenuItem 
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer transition-all"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User Profile Modal - rendered at root via Portal for correct stacking/positioning */}
      {showProfile && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-xl p-6">
            <UserProfilePage onClose={() => setShowProfile(false)} />
          </div>
        </div>,
        document.body
      )}

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Custom Date Range Picker — global filter */}
      {showCustomDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="absolute top-[1px] left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Select Custom Date Range</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-2 block">Start Date</Label>
                <DatePicker
                  value={startDateObj ? startDateObj.toISOString().split('T')[0] : ''}
                  onChange={(v) => {
                    const start = v ? new Date(v) : startDateObj;
                    if (!start) return;
                    setCustomDateRange(start, endDateObj || start);
                  }}
                  placeholder="Start date"
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">End Date</Label>
                <DatePicker
                  value={endDateObj ? endDateObj.toISOString().split('T')[0] : ''}
                  onChange={(v) => {
                    const end = v ? new Date(v) : endDateObj;
                    if (!end) return;
                    setCustomDateRange(startDateObj || end, end);
                  }}
                  minDate={startDateObj || undefined}
                  placeholder="End date"
                  className="w-full"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    if (startDateObj && endDateObj) {
                      setShowCustomDatePicker(false);
                      toast.success('Date range updated');
                    } else {
                      toast.error('Please select both start and end dates');
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowCustomDatePicker(false)}
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};