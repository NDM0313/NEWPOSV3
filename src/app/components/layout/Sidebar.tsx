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
  Factory
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useModules } from '../../context/ModuleContext';
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
  const { modules } = useModules();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { 
      id: 'users-group', 
      label: 'User Management', 
      icon: UserCog,
      children: [
        { id: 'users', label: 'All Users' },
        { id: 'roles', label: 'Roles & Permissions' }
      ]
    },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
    { 
      id: 'custom-studio-group', 
      label: 'Custom Studio', 
      icon: Scissors,
      children: [
        { id: 'custom-pipeline', label: 'Pipeline Board' },
        { id: 'custom-new-order', label: 'New Custom Order' },
        { id: 'custom-vendors', label: 'Vendor List' }
      ]
    },
    { id: 'rentals', label: 'Rentals', icon: Shirt, isHidden: !modules.rentals?.isEnabled },
    { id: 'pos', label: 'POS System', icon: Store },
    { id: 'stock', label: 'Stock', icon: Archive },
    { id: 'inventory', label: 'Inventory', icon: Warehouse },
    { id: 'customize', label: 'Customize Studio', icon: Sparkles },
    { id: 'studio', label: 'Studio Production', icon: Factory },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'accounting', label: 'Accounting', icon: Calculator, isHidden: !modules.accounting?.isEnabled },
    { id: 'reports', label: 'Reports', icon: PieChart },
    { id: 'settings', label: 'Settings', icon: Settings },
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
      className="hidden md:flex flex-col h-screen transition-all duration-300 relative z-20 shrink-0"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderRightColor: 'var(--color-border-primary)',
        borderRightWidth: '1px',
        color: 'var(--color-text-primary)'
      }}
    >
      <div className="p-4 flex items-center justify-between h-16" style={{ borderBottomColor: 'var(--color-border-primary)', borderBottomWidth: '1px' }}>
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
            }}
          >
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
          className="p-1.5 rounded-lg transition-colors absolute -right-3 top-6 shadow-sm"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            borderColor: 'var(--color-border-secondary)',
            borderWidth: '1px',
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-panel)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
        {visibleNavItems.map((item) => {
          const isExpanded = expandedItems.includes(item.id);
          const isActive = currentView === item.id || item.children?.some(c => c.id === currentView);
          
          return (
            <div key={item.id}>
              <button
                onClick={() => handleItemClick(item)}
                className={clsx(
                  "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative"
                )}
                style={{
                  backgroundColor: isActive && !item.children 
                    ? 'var(--color-primary)' 
                    : 'transparent',
                  color: isActive && !item.children
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                  boxShadow: isActive && !item.children 
                    ? '0 10px 15px -3px rgba(59, 130, 246, 0.2)' 
                    : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive || item.children) {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive || item.children) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <item.icon 
                    size={20} 
                    strokeWidth={1.5} 
                    className="shrink-0"
                    style={{ 
                      color: isActive && !item.children 
                        ? 'var(--color-text-primary)' 
                        : 'var(--color-text-secondary)' 
                    }}
                  />
                  
                  {isSidebarOpen ? (
                    <motion.span 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="font-medium whitespace-nowrap text-sm"
                    >
                      {item.label}
                    </motion.span>
                  ) : (
                    <div 
                      className="absolute left-14 text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border whitespace-nowrap z-50 shadow-xl"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        borderColor: 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                      }}
                    >
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
                          className="w-full text-left py-2 px-3 text-sm rounded-lg transition-colors"
                          style={
                            currentView === child.id 
                              ? {
                                  color: 'var(--color-primary)',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  fontWeight: '500',
                                  borderRadius: 'var(--radius-lg)'
                                }
                              : {
                                  color: 'var(--color-text-tertiary)'
                                }
                          }
                          onMouseEnter={(e) => {
                            if (currentView !== child.id) {
                              e.currentTarget.style.color = 'var(--color-text-primary)';
                              e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentView !== child.id) {
                              e.currentTarget.style.color = 'var(--color-text-tertiary)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
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

      <div 
        className="p-4 border-t"
        style={{ borderTopColor: 'var(--color-border-primary)' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full shrink-0 border-2 shadow-lg"
            style={{
              background: 'linear-gradient(to top right, var(--color-primary), rgba(99, 102, 241, 1))',
              borderRadius: '50%',
              borderColor: 'var(--color-border-primary)',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}
          />
          {isSidebarOpen && (
            <div className="overflow-hidden">
              <p 
                className="text-sm font-bold truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Admin User
              </p>
              <p 
                className="text-xs truncate"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                admin@erp.com
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};