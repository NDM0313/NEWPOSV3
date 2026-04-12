import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Store,
  ShoppingBag,
  Archive,
  Receipt,
  Calculator,
  PieChart,
  Contact,
  ChevronDown,
  UserCog,
  Shirt,
  Box,
  AlertCircle,
  Scissors,
  Warehouse,
  Sparkles,
  Factory,
  FlaskConical,
  Plus,
  Shield,
  Scale,
  BookOpen,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useModules } from '../../context/ModuleContext';
import { useSettings } from '../../context/SettingsContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useCheckPermission } from '../../hooks/useCheckPermission';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

type NavItem = {
  id: string;
  label: string;
  icon: any;
  children?: { id: string; label: string }[];
  isHidden?: boolean;
};

export const Sidebar = () => {
  const { currentView, setCurrentView, isSidebarOpen, toggleSidebar, openDrawer, setPartyLedgerParams } = useNavigation();
  const { modules: moduleContextModules } = useModules();
  const { modules: settingsModules, featureFlags, isPermissionLoaded } = useSettings();
  const { hasPermission } = useCheckPermission();
  const { userRole } = useSupabase();
  const developerIntegrityLabAllowed = canAccessDeveloperIntegrityLab(userRole);
  const studioProductionV2 = featureFlags?.studio_production_v2 === true;
  const studioProductionV3 = featureFlags?.studio_production_v3 === true;
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contacts', icon: Users, isHidden: !hasPermission('contacts.view') },
    { id: 'products', label: 'Products', icon: Package, isHidden: !hasPermission('products.view') },
    { id: 'inventory', label: 'Inventory', icon: Warehouse, isHidden: !hasPermission('inventory.view') },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag, isHidden: !hasPermission('purchases.view') },
    { id: 'sales', label: 'Sales', icon: ShoppingCart, isHidden: !hasPermission('sales.view') },
    { id: 'rentals', label: 'Rentals', icon: Shirt, isHidden: !settingsModules.rentalModuleEnabled || !hasPermission('rentals.view') },
    { id: 'pos', label: 'POS System', icon: Store, isHidden: !settingsModules.posModuleEnabled || !hasPermission('pos.view') },
    { 
      id: 'studio-group', 
      label: 'Studio Production', 
      icon: Factory,
      isHidden: (!settingsModules.studioModuleEnabled && !studioProductionV2 && !studioProductionV3) || !hasPermission('studio.view'),
      children: [
        { id: 'studio-dashboard-new', label: 'Dashboard' },
        { id: 'studio', label: 'Studio Sales' },
        { id: 'studio-pipeline', label: 'Production Pipeline' },
        { id: 'studio-workflow', label: 'Workers' },
      ]
    },
    {
      id: 'manufacturing-group',
      label: 'Manufacturing',
      icon: Box,
      isHidden: !settingsModules.studioModuleEnabled || !hasPermission('studio.view'),
      children: [
        { id: 'manufacturing-bom', label: 'Bill of Materials' },
        { id: 'manufacturing-orders', label: 'Production Orders' },
        { id: 'manufacturing-workflow', label: 'Production Workflow' },
      ]
    },
    { id: 'expenses', label: 'Expenses', icon: Receipt, isHidden: !hasPermission('expenses.view') },
    { id: 'accounting', label: 'Accounting', icon: Calculator, isHidden: !settingsModules.accountingModuleEnabled || !hasPermission('accounting.view') },
    { id: 'party-ledger', label: 'Party Ledger', icon: BookOpen, isHidden: !settingsModules.accountingModuleEnabled || !hasPermission('accounting.view') },
    {
      id: 'ar-ap-reconciliation-center',
      label: 'AR/AP Reconciliation',
      icon: Scale,
      isHidden: !settingsModules.accountingModuleEnabled || !hasPermission('accounting.view'),
    },
    { id: 'reports', label: 'Reports', icon: PieChart, isHidden: !hasPermission('reports.view') },
    { id: 'settings', label: 'Settings', icon: Settings, isHidden: !hasPermission('settings.view') },
    { 
      id: 'test-pages-group', 
      label: 'Developer Tools', 
      icon: FlaskConical,
      isHidden: !hasPermission('settings.view'), // Admin only – Permission Inspector, test pages
      children: [
        { id: 'permission-inspector', label: 'Permission Inspector' },
        { id: 'test-account-entry', label: 'Account Entry' },
        { id: 'accounting-edit-trace', label: 'Accounting Edit Trace (Unified)' },
        { id: 'ar-ap-truth-lab', label: 'AR / AP Truth Lab (canonical)' },
        { id: 'expense-edit-trace', label: 'Expense Edit Trace' },
        { id: 'customer-ledger-test', label: 'Legacy: Customer Ledger Test' },
        { id: 'ledger-debug-test', label: 'Ledger Debug (RPC vs API)' },
        { id: 'test-ledger', label: 'Test Ledger (API Tests)' },
        { id: 'customer-ledger-interactive-test', label: 'Interactive Test (Manual)' },
        { id: 'contact-search-test', label: 'Contact Test' },
        { id: 'sale-header-test', label: 'Header Test' },
        { id: 'purchase-header-test', label: 'Purchase Header Test' },
        { id: 'transaction-header-test', label: 'Transaction Header' },
        { id: 'user-management-test', label: 'User Management Test' },
        { id: 'branch-management-test', label: 'Branch Management Test' },
        { id: 'accounting-chart-test', label: 'Chart of Accounts Test' },
        { id: 'inventory-design-test', label: 'Inventory Design Test' },
        { id: 'rls-validation', label: 'RLS Validation' },
        { id: 'accounting-integrity-lab', label: 'Accounting Integrity Lab' },
        ...(developerIntegrityLabAllowed
          ? ([{ id: 'developer-integrity-lab', label: 'Developer Integrity Lab' }] as { id: string; label: string }[])
          : []),
        { id: 'day4-certification', label: 'Day 4 Certification' },
        { id: 'erp-integration-test', label: 'ERP Integration Test' },
        { id: 'cutover-prep', label: 'Cutover Prep' },
        { id: 'responsive-test', label: 'Responsive Test' },
      ]
    },
  ];

  const visibleNavItems = navItems.filter(item => (isPermissionLoaded ? !item.isHidden : item.id === 'dashboard'));

  const handleItemClick = (item: NavItem) => {
    if (item.children) {
      if (!isSidebarOpen) toggleSidebar();
      toggleExpand(item.id);
    } else {
      if (item.id === 'party-ledger') {
        setPartyLedgerParams?.(null);
      }
      setCurrentView(item.id as any);
      if (typeof window !== 'undefined') {
        if (item.id === 'permission-inspector') {
          window.history.pushState({}, '', '/admin/permission-inspector');
        } else if (
          pathname === '/admin/permission-inspector' ||
          pathname === '/admin/developer-integrity-lab' ||
          pathname === '/admin/accounting-test-bench' ||
          pathname === '/test/accounting-edit-trace' ||
          pathname === '/test/ar-ap-truth-lab' ||
          pathname === '/test/expense-edit-trace' ||
          pathname === '/test/accounting-accounts-hierarchy'
        ) {
          window.history.pushState({}, '', '/');
        }
      }
    }
  };

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isSidebarOpen ? 260 : 80 }}
      className="hidden md:flex flex-col h-screen bg-gray-900 border-r border-gray-800 text-white transition-all duration-300 relative z-20 shrink-0"
    >
      <div className="p-4 flex items-center justify-between h-16 border-b border-gray-800">
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 text-white shadow-lg shadow-blue-900/20">
            <span className="font-bold text-lg">E</span>
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="font-bold text-lg tracking-tight"
            >
              ERP Master
            </motion.span>
          )}
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors absolute -right-3 top-6 bg-gray-900 border border-gray-700 shadow-sm"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isExpanded = expandedItems.includes(item.id);
          const isActive =
            currentView === item.id ||
            item.children?.some((c) => c.id === currentView) ||
            (item.id === 'test-pages-group' &&
              (pathname === '/admin/permission-inspector' ||
                pathname === '/admin/developer-integrity-lab' ||
                pathname === '/admin/accounting-test-bench' ||
                pathname === '/test/accounting-edit-trace' ||
                pathname === '/test/ar-ap-truth-lab' ||
                pathname === '/test/expense-edit-trace' ||
                pathname === '/test/accounting-accounts-hierarchy'));
          
          return (
            <div key={item.id}>
              <div className="flex items-center gap-1 w-full group/item">
                <button
                  onClick={() => handleItemClick(item)}
                  className={clsx(
                    "flex-1 flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative min-w-0",
                    isActive && !item.children
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={20} strokeWidth={1.5} className={clsx("shrink-0", isActive && "text-white")} />
                    
                    {isSidebarOpen ? (
                      <motion.span 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="font-medium whitespace-nowrap text-sm truncate flex items-center gap-1.5"
                      >
                        {item.label}
                        {item.id === 'studio-group' && studioProductionV3 && (
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">V3</span>
                        )}
                        {item.id === 'studio-group' && studioProductionV2 && !studioProductionV3 && (
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">V2</span>
                        )}
                      </motion.span>
                    ) : (
                      <div className="absolute left-14 bg-gray-900 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-gray-700 whitespace-nowrap z-50 shadow-xl flex items-center gap-1.5">
                        {item.label}
                        {item.id === 'studio-group' && studioProductionV3 && <span className="text-emerald-400 text-xs font-semibold">V3</span>}
                        {item.id === 'studio-group' && studioProductionV2 && !studioProductionV3 && <span className="text-amber-400 text-xs font-semibold">V2</span>}
                      </div>
                    )}
                  </div>
                  
                  {item.children && isSidebarOpen && (
                    <ChevronDown 
                      size={16} 
                      className={clsx("shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} 
                    />
                  )}
                </button>
                {/* Quick Add / Import for Contacts */}
                {item.id === 'contacts' && isSidebarOpen && (
                  <div className="flex gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDrawer('addContact'); }}
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
                      title="Add Contact"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Submenu */}
              <AnimatePresence>
                {item.children && isExpanded && isSidebarOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-11 py-1 space-y-1">
                      {item.children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => {
                            setCurrentView(child.id as any);
                            if (typeof window !== 'undefined') {
                              const p = window.location.pathname;
                              if (child.id === 'permission-inspector') {
                                window.history.pushState({}, '', '/admin/permission-inspector');
                              } else if (child.id === 'developer-integrity-lab') {
                                window.history.pushState({}, '', '/admin/developer-integrity-lab');
                              } else if (child.id === 'accounting-edit-trace') {
                                window.history.pushState({}, '', '/test/accounting-edit-trace');
                              } else if (child.id === 'ar-ap-truth-lab') {
                                window.history.pushState({}, '', '/test/ar-ap-truth-lab');
                              } else if (child.id === 'expense-edit-trace') {
                                window.history.pushState({}, '', '/test/expense-edit-trace');
                              } else if (
                                p === '/admin/permission-inspector' ||
                                p === '/admin/developer-integrity-lab' ||
                                p === '/admin/accounting-test-bench' ||
                                p === '/test/accounting-edit-trace' ||
                                p === '/test/ar-ap-truth-lab' ||
                                p === '/test/expense-edit-trace' ||
                                p === '/test/accounting-accounts-hierarchy'
                              ) {
                                window.history.pushState({}, '', '/');
                              }
                            }
                          }}
                          className={clsx(
                            "w-full text-left py-2 px-3 text-sm rounded-lg transition-colors",
                            currentView === child.id ||
                              (child.id === 'accounting-edit-trace' && pathname === '/test/accounting-edit-trace') ||
                              (child.id === 'ar-ap-truth-lab' && pathname === '/test/ar-ap-truth-lab') ||
                              (child.id === 'expense-edit-trace' && pathname === '/test/expense-edit-trace')
                              ? "text-blue-400 bg-blue-500/10 font-medium" 
                              : "text-gray-500 hover:text-white hover:bg-gray-800/50"
                          )}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </motion.aside>
  );
};