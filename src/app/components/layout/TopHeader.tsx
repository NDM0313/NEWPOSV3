import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useDateRange } from '../../context/DateRangeContext';
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
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../ui/utils";
import { toast } from 'sonner';
import { UserProfilePage } from '../users/UserProfilePage';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';

export const TopHeader = () => {
  const { toggleSidebar, openDrawer, setCurrentView } = useNavigation();
  const { signOut, user, companyId, branchId, defaultBranchId, setBranchId } = useSupabase();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const { dateRange, setDateRangeType, setCustomDateRange } = useDateRange();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Load branches from Supabase
  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoadingBranches(true);
      const branchesData = await branchService.getAllBranches(companyId);
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

  // Get current branch name
  const currentBranch = useMemo(() => {
    if (!branchId) return 'Select Branch';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Select Branch';
  }, [branchId, branches]);

  // Calculate notification count from real data
  const notificationCount = useMemo(() => {
    let count = 0;
    
    // Low stock items (if we had products context, we'd check here)
    // For now, we'll use sales/purchases/expenses notifications
    
    // Unpaid sales (receivables)
    const unpaidSales = sales.sales.filter(s => s.type === 'invoice' && s.due > 0).length;
    if (unpaidSales > 0) count += unpaidSales;
    
    // Unpaid purchases (payables)
    const unpaidPurchases = purchases.purchases.filter(p => p.due > 0).length;
    if (unpaidPurchases > 0) count += unpaidPurchases;
    
    // Pending expenses
    const pendingExpenses = expenses.expenses.filter(e => e.status === 'pending').length;
    if (pendingExpenses > 0) count += pendingExpenses;
    
    return count;
  }, [sales.sales, purchases.purchases, expenses.expenses]);

  // Handle branch change
  const handleBranchChange = (branchId: string) => {
    setBranchId(branchId);
    toast.success('Branch switched successfully');
    // Reload data for new branch
    window.location.reload();
  };

  const getDateRangeLabel = () => {
    if (dateRange.type === 'today') {
      return 'Today';
    } else if (dateRange.type === 'last7days') {
      return 'Last 7 Days';
    } else if (dateRange.type === 'last15days') {
      return 'Last 15 Days';
    } else if (dateRange.type === 'last30days') {
      return 'Last 30 Days';
    } else if (dateRange.type === 'week') {
      return 'This Week';
    } else if (dateRange.type === 'month') {
      return 'This Month';
    } else if (dateRange.type === 'custom') {
      if (dateRange.startDate && dateRange.endDate) {
        const start = dateRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const end = dateRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${start} - ${end}`;
      }
      return 'Custom Range';
    }
    return 'Today';
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
    setCurrentView('settings');
  };

  const handleChangePassword = () => {
    setShowChangePassword(true);
  };

  const handleNotifications = () => {
    setShowNotifications(!showNotifications);
    // Show notifications dropdown
  };

  // Get notifications list
  const notifications = useMemo(() => {
    const notifs: Array<{ id: string; type: string; message: string; time: string }> = [];
    
    // Unpaid sales
    sales.sales
      .filter(s => s.type === 'invoice' && s.due > 0)
      .slice(0, 5)
      .forEach(sale => {
        notifs.push({
          id: `sale-${sale.id}`,
          type: 'receivable',
          message: `Unpaid invoice: ${sale.invoiceNo} - Rs ${sale.due.toLocaleString()}`,
          time: sale.date || new Date().toISOString().split('T')[0],
        });
      });
    
    // Unpaid purchases
    purchases.purchases
      .filter(p => p.due > 0)
      .slice(0, 5)
      .forEach(purchase => {
        notifs.push({
          id: `purchase-${purchase.id}`,
          type: 'payable',
          message: `Unpaid purchase: ${purchase.purchaseNo} - Rs ${purchase.due.toLocaleString()}`,
          time: purchase.date || new Date().toISOString().split('T')[0],
        });
      });
    
    // Pending expenses
    expenses.expenses
      .filter(e => e.status === 'pending')
      .slice(0, 5)
      .forEach(expense => {
        notifs.push({
          id: `expense-${expense.id}`,
          type: 'expense',
          message: `Pending expense: ${expense.expenseNo} - Rs ${expense.amount.toLocaleString()}`,
          time: expense.date || new Date().toISOString().split('T')[0],
        });
      });
    
    return notifs.slice(0, 10); // Limit to 10 notifications
  }, [sales.sales, purchases.purchases, expenses.expenses]);

  // Get user display info
  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
  const userEmail = user?.email || 'admin@dinbridal.com';
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">
      {/* LEFT SECTION: Mobile Menu + Branch Selector */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-header-foreground hover:bg-accent transition-all duration-200"
        >
          <Menu size={22} />
        </button>
        
        {/* Branch / Location Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="hidden lg:flex items-center gap-2 px-4 py-2 h-10 bg-accent hover:bg-muted border border-border text-foreground rounded-lg transition-all"
              disabled={loadingBranches}
            >
              {loadingBranches ? (
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"></div>
                  <MapPin size={16} className="text-blue-500" />
                  <span className="font-medium">{currentBranch}</span>
                  <ChevronDown size={16} className="text-muted-foreground" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-72 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Location</p>
            </div>
            {loadingBranches ? (
              <div className="px-3 py-4 text-center text-muted-foreground">
                <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading branches...</p>
              </div>
            ) : branches.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted-foreground">
                <p className="text-xs">No branches found</p>
              </div>
            ) : (
              branches.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  onClick={() => handleBranchChange(b.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                    branchId === b.id 
                      ? "bg-primary/10 text-primary" 
                      : "text-foreground hover:bg-accent"
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
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* CENTER SECTION: Empty (for balanced layout) */}
      <div className="flex-1"></div>

      {/* RIGHT SECTION: Actions Zone */}
      <div className="flex items-center gap-3">
        {/* Create New Dropdown - FIRST */}
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

        {/* Date Range Selector - SECOND */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost"
              className="flex items-center gap-2 px-3 py-2 h-9 bg-accent hover:bg-muted border border-border text-foreground rounded-lg transition-all"
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
              onClick={() => setDateRangeType('today')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange.type === 'today' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              Today
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('last7days')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange.type === 'last7days' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              Last 7 Days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('last15days')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange.type === 'last15days' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              Last 15 Days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('last30days')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange.type === 'last30days' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              Last 30 Days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('week')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange.type === 'week' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              This Week
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('month')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange.type === 'month' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              This Month
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border my-2" />
            <DropdownMenuItem
              onClick={() => {
                setShowCustomDatePicker(true);
                setDateRangeType('custom');
              }}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange.type === 'custom' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              Custom Range
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
          <DropdownMenuTrigger asChild>
            <button 
              className="relative p-2.5 rounded-lg transition-all bg-accent hover:bg-muted border border-border text-muted-foreground hover:text-foreground"
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
              className="flex items-center gap-2 px-3 py-2 h-10 bg-accent hover:bg-muted border border-border rounded-lg transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
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

      {/* User Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <UserProfilePage onClose={() => setShowProfile(false)} />
          </div>
        </div>
      )}

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Custom Date Range Picker */}
      {showCustomDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Select Custom Date Range</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-2 block">Start Date</Label>
                <Input
                  type="date"
                  value={dateRange.startDate ? dateRange.startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const start = new Date(e.target.value);
                    if (dateRange.endDate) {
                      setCustomDateRange(start, dateRange.endDate);
                    } else {
                      setCustomDateRange(start, start);
                    }
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">End Date</Label>
                <Input
                  type="date"
                  value={dateRange.endDate ? dateRange.endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const end = new Date(e.target.value);
                    if (dateRange.startDate) {
                      setCustomDateRange(dateRange.startDate, end);
                    } else {
                      setCustomDateRange(end, end);
                    }
                  }}
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    if (dateRange.startDate && dateRange.endDate) {
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