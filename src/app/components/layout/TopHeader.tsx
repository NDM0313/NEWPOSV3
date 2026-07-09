import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
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
  Loader2,
  Scissors,
  RefreshCw
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useSettings } from '../../context/SettingsContext';
import { useSupabase } from '../../context/SupabaseContext';
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
import { Label } from "../ui/label";
import { DatePicker } from "../ui/DatePicker";
import { cn } from "../ui/utils";
import { formatLocalDateYYYYMMDD, parseLocalDateInput } from '@/app/utils/localDate';
import { toast } from 'sonner';
import { UserProfilePage } from '../users/UserProfilePage';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';
import { useCheckPermission } from '../../hooks/useCheckPermission';
import { NotificationsDropdown } from './NotificationsDropdown';
import { dispatchGlobalRefresh } from '@/app/lib/dataInvalidationBus';

export const TopHeader = () => {
  const { toggleSidebar, openDrawer, setCurrentView, setMobileNavOpen } = useNavigation();
  const { businessSettings } = useSettings();
  const { signOut, user, companyId, branchId, erpFullName, userRole } = useSupabase();
  const { hasPermission } = useCheckPermission();
  const globalFilter = useGlobalFilter();
  const { dateRangeType, setDateRangeType, setCustomDateRange, getDateRangeLabel, setBranchId: setGlobalBranchId, customStartDate, customEndDate, startDateObj, endDateObj } = globalFilter;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

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

  // If business has only one branch, always auto-select it (persist in global filter + Supabase)
  useEffect(() => {
    if (branches.length === 1) {
      setGlobalBranchId(branches[0].id);
    }
  }, [branches, setGlobalBranchId]);

  // Get current branch name (All Branches = real option for admin)
  const currentBranch = useMemo(() => {
    if (!branchId) return 'Select Branch';
    if (branchId === 'all') return 'All Branches';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Select Branch';
  }, [branchId, branches]);

  // Handle branch change — update global filter (persists + syncs to Supabase)
  const handleBranchChange = (newBranchId: string) => {
    if (newBranchId === branchId) return;
    setGlobalBranchId(newBranchId);
    toast.success('Branch switched successfully');
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      window.location.assign('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);

  const handleGlobalRefresh = useCallback(() => {
    if (!companyId || globalRefreshing) return;
    setGlobalRefreshing(true);
    dispatchGlobalRefresh({
      companyId,
      branchId: branchId ?? null,
      reason: 'user-refresh',
    });
    toast.success('Refreshing data from server…');
    window.setTimeout(() => setGlobalRefreshing(false), 1200);
  }, [companyId, branchId, globalRefreshing]);

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

  // Get user display info from ERP profile (falls back to auth metadata)
  const userDisplayName =
    erpFullName ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Admin';
  const userEmail = user?.email || 'admin@dinbridal.com';
  const userInitial = userDisplayName.charAt(0).toUpperCase();
  const userRoleLabel = userRole
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1).replace(/_/g, ' ')
    : 'User';

  return (
    <header className="h-14 md:h-16 bg-sidebar/95 backdrop-blur-md border-b border-sidebar-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 shadow-sm text-sidebar-foreground">
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
              className="flex items-center gap-2 px-4 py-2 h-9 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-foreground font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition-all border-0"
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
            {businessSettings.enableBespokeOrders && (
              <DropdownMenuItem
                onClick={() => openDrawer('addSale', undefined, { bespokeOrder: true })}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
              >
                <Scissors size={16} className="text-violet-500" />
                <div className="flex flex-col">
                  <span>Custom / Bespoke Order</span>
                  <span className="text-xs text-muted-foreground">Fabric, measurements, delivery date</span>
                </div>
              </DropdownMenuItem>
            )}
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
              onClick={() => setDateRangeType('lastWeek')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'lastWeek' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Last Week
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
            <DropdownMenuItem
              onClick={() => setDateRangeType('currentFinancialYear')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'currentFinancialYear' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Current Financial Year
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRangeType('lastFinancialYear')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRangeType === 'lastFinancialYear' ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
              )}
            >
              Last Financial Year
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

        <NotificationsDropdown />

        <Button
          type="button"
          variant="ghost"
          title="Refresh data from server"
          aria-label="Refresh data from server"
          disabled={!companyId || globalRefreshing}
          onClick={handleGlobalRefresh}
          className="h-9 w-9 p-0 bg-accent hover:bg-muted border border-border text-foreground rounded-lg"
        >
          <RefreshCw className={cn('h-4 w-4', globalRefreshing && 'animate-spin')} />
        </Button>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 md:px-3 py-2 h-9 md:h-10 bg-accent hover:bg-muted border border-border rounded-xl transition-all touch-manipulation"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-foreground font-bold text-sm shadow-sm shrink-0">
                {userInitial}
              </div>
              <div className="hidden xl:flex flex-col items-start">
                <span className="text-sm font-semibold text-foreground leading-tight">{userDisplayName}</span>
                <span className="text-xs text-muted-foreground leading-tight">{userRoleLabel}</span>
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
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-foreground font-bold shadow-sm">
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
              onSelect={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--erp-overlay)] backdrop-blur-sm p-4">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-popover border border-border rounded-xl p-6">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--erp-overlay)] backdrop-blur-sm"
          onClick={() => setShowCustomDatePicker(false)}
          role="presentation"
        >
          <div
            className="absolute top-[1px] left-1/2 -translate-x-1/2 bg-popover border border-border rounded-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">Select Custom Date Range</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground mb-2 block">Start Date</Label>
                <DatePicker
                  value={startDateObj ? formatLocalDateYYYYMMDD(startDateObj) : ''}
                  onChange={(v) => {
                    const start = v ? parseLocalDateInput(v) : startDateObj;
                    if (!start) return;
                    setCustomDateRange(start, endDateObj || start);
                  }}
                  placeholder="Start date"
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">End Date</Label>
                <DatePicker
                  value={endDateObj ? formatLocalDateYYYYMMDD(endDateObj) : ''}
                  onChange={(v) => {
                    const end = v ? parseLocalDateInput(v) : endDateObj;
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
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-foreground"
                >
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowCustomDatePicker(false)}
                  className="text-muted-foreground hover:text-foreground"
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