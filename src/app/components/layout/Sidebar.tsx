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
  FlaskConical
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useModules } from '../../context/ModuleContext';
import { useSettings } from '../../context/SettingsContext';
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
  const { currentView, setCurrentView, isSidebarOpen, toggleSidebar } = useNavigation();
  const { modules: moduleContextModules } = useModules();
  const { modules: settingsModules } = useSettings();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Warehouse },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
    { id: 'rentals', label: 'Rentals', icon: Shirt, isHidden: !settingsModules.rentalModuleEnabled },
    { id: 'pos', label: 'POS System', icon: Store, isHidden: !settingsModules.posModuleEnabled },
    { 
      id: 'studio-group', 
      label: 'Studio Production', 
      icon: Factory,
      isHidden: !settingsModules.studioModuleEnabled,
      children: [
        { id: 'studio-dashboard-new', label: 'Dashboard' },
        { id: 'studio', label: 'Studio Sales' },
        { id: 'studio-workflow', label: 'Workers' },
      ]
    },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'accounting', label: 'Accounting', icon: Calculator, isHidden: !settingsModules.accountingModuleEnabled },
    { id: 'reports', label: 'Reports', icon: PieChart },
    { id: 'settings', label: 'Settings', icon: Settings },
    { 
      id: 'test-pages-group', 
      label: 'Test Pages', 
      icon: FlaskConical,
      children: [
        { id: 'customer-ledger-test', label: 'Customer Ledger Test' },
        { id: 'test-ledger', label: 'Test Ledger (API Tests)' },
        { id: 'customer-ledger-interactive-test', label: 'Interactive Test (Manual)' },
        { id: 'contact-search-test', label: 'Contact Test' },
        { id: 'sale-header-test', label: 'Header Test' },
        { id: 'transaction-header-test', label: 'Transaction Header' },
        { id: 'user-management-test', label: 'User Management Test' },
        { id: 'branch-management-test', label: 'Branch Management Test' },
        { id: 'accounting-chart-test', label: 'Chart of Accounts Test' },
      ]
    },
  ];

  const visibleNavItems = navItems.filter(item => !item.isHidden);

  const handleItemClick = (item: NavItem) => {
    if (item.children) {
      if (!isSidebarOpen) toggleSidebar();
      toggleExpand(item.id);
    } else {
      setCurrentView(item.id as any);
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
          const isActive = currentView === item.id || item.children?.some(c => c.id === currentView);
          
          return (
            <div key={item.id}>
              <button
                onClick={() => handleItemClick(item)}
                className={clsx(
                  "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative",
                  isActive && !item.children
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} strokeWidth={1.5} className={clsx("shrink-0", isActive && "text-white")} />
                  
                  {isSidebarOpen ? (
                    <motion.span 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="font-medium whitespace-nowrap text-sm"
                    >
                      {item.label}
                    </motion.span>
                  ) : (
                    <div className="absolute left-14 bg-gray-900 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-gray-700 whitespace-nowrap z-50 shadow-xl">
                      {item.label}
                    </div>
                  )}
                </div>
                
                {item.children && isSidebarOpen && (
                  <ChevronDown 
                    size={16} 
                    className={clsx("transition-transform duration-200", isExpanded && "rotate-180")} 
                  />
                )}
              </button>

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
                          onClick={() => setCurrentView(child.id as any)}
                          className={clsx(
                            "w-full text-left py-2 px-3 text-sm rounded-lg transition-colors",
                            currentView === child.id 
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