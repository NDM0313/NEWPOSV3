import { X, Package, BarChart3, ShoppingBag, Shirt, Camera, Receipt, DollarSign, FileText, Settings, CreditCard, Users, LayoutGrid, TrendingUp } from 'lucide-react';
import { Screen } from '../App';

interface ModuleGridProps {
  onClose: () => void;
  onModuleSelect: (module: Screen) => void;
  userRole: 'admin' | 'manager' | 'staff' | 'viewer';
}

interface Module {
  id: Screen;
  name: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
  requiresPermission?: boolean;
}

export function ModuleGrid({ onClose, onModuleSelect, userRole }: ModuleGridProps) {
  const modules: Module[] = [
    {
      id: 'products',
      name: 'Products',
      icon: <Package className="w-6 h-6" />,
      color: '#3B82F6',
      enabled: true,
    },
    {
      id: 'inventory',
      name: 'Inventory',
      icon: <BarChart3 className="w-6 h-6" />,
      color: '#10B981',
      enabled: true,
    },
    {
      id: 'purchase',
      name: 'Purchases',
      icon: <ShoppingBag className="w-6 h-6" />,
      color: '#10B981',
      enabled: true,
    },
    {
      id: 'rental',
      name: 'Rentals',
      icon: <Shirt className="w-6 h-6" />,
      color: '#8B5CF6',
      enabled: true,
    },
    {
      id: 'studio',
      name: 'Studio',
      icon: <Camera className="w-6 h-6" />,
      color: '#EC4899',
      enabled: true,
    },
    {
      id: 'expense',
      name: 'Expenses',
      icon: <Receipt className="w-6 h-6" />,
      color: '#F97316',
      enabled: true,
    },
    {
      id: 'accounts',
      name: 'Accounts',
      icon: <DollarSign className="w-6 h-6" />,
      color: '#F59E0B',
      enabled: userRole === 'admin' || userRole === 'manager',
    },
    {
      id: 'pos',
      name: 'POS',
      icon: <CreditCard className="w-6 h-6" />,
      color: '#10B981',
      enabled: true,
    },
    {
      id: 'contacts',
      name: 'Contacts',
      icon: <Users className="w-6 h-6" />,
      color: '#6366F1',
      enabled: true,
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: <TrendingUp className="w-6 h-6" />,
      color: '#8B5CF6',
      enabled: true,
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: <Settings className="w-6 h-6" />,
      color: '#6B7280',
      enabled: true,
    },
    {
      id: 'home',
      name: 'Dashboard',
      icon: <LayoutGrid className="w-6 h-6" />,
      color: '#3B82F6',
      enabled: true,
    },
  ];

  const enabledModules = modules.filter(m => m.enabled);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 bg-[#1F2937] rounded-t-3xl z-50 animate-slide-up max-h-[80vh] overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-[#374151] rounded-full"></div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#374151]">
          <div>
            <h2 className="text-lg font-semibold">All Modules</h2>
            <p className="text-sm text-[#9CA3AF]">{enabledModules.length} available</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Module Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="grid grid-cols-3 gap-4">
            {enabledModules.map((module) => (
              <button
                key={module.id + module.name}
                onClick={() => {
                  onModuleSelect(module.id);
                  onClose();
                }}
                className="flex flex-col items-center gap-3 p-4 bg-[#111827] border border-[#374151] rounded-2xl hover:border-[#3B82F6] active:scale-95 transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${module.color}20`, color: module.color }}
                >
                  {module.icon}
                </div>
                <span className="text-xs font-medium text-center leading-tight">
                  {module.name}
                </span>
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-[#111827] border border-[#374151] rounded-xl">
            <p className="text-xs text-[#9CA3AF] text-center">
              Modules shown based on your role permissions
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
