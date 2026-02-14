import { useState } from 'react';
import { ArrowLeft, FileText, TrendingUp, ShoppingCart, ShoppingBag, Package, Shirt, Camera, DollarSign, Download, Filter, Calendar, ChevronRight, X, Users, BookOpen } from 'lucide-react';
import { User } from '../../App';
import { SalesReports } from './SalesReports';
import { PurchaseReports } from './PurchaseReports';
import { InventoryReports } from './InventoryReports';
import { RentalReports } from './RentalReports';
import { StudioReports } from './StudioReports';
import { ExpenseReports } from './ExpenseReports';
import { WorkerReports } from './WorkerReports';
import { AccountReports } from './AccountReports';

interface ReportsModuleProps {
  onBack: () => void;
  user: User;
}

type ReportCategory = 'sales' | 'purchase' | 'inventory' | 'rental' | 'studio' | 'expense' | 'worker' | 'account';

export function ReportsModule({ onBack, user }: ReportsModuleProps) {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);

  const reportCategories = [
    {
      id: 'sales' as ReportCategory,
      title: 'Sales Reports',
      icon: <ShoppingCart className="w-6 h-6" />,
      color: '#3B82F6',
      bgColor: 'bg-[#3B82F6]/10',
      count: 4,
    },
    {
      id: 'purchase' as ReportCategory,
      title: 'Purchase Reports',
      icon: <ShoppingBag className="w-6 h-6" />,
      color: '#10B981',
      bgColor: 'bg-[#10B981]/10',
      count: 4,
    },
    {
      id: 'inventory' as ReportCategory,
      title: 'Inventory Reports',
      icon: <Package className="w-6 h-6" />,
      color: '#F59E0B',
      bgColor: 'bg-[#F59E0B]/10',
      count: 4,
    },
    {
      id: 'rental' as ReportCategory,
      title: 'Rental Reports',
      icon: <Shirt className="w-6 h-6" />,
      color: '#8B5CF6',
      bgColor: 'bg-[#8B5CF6]/10',
      count: 4,
    },
    {
      id: 'studio' as ReportCategory,
      title: 'Studio Reports',
      icon: <Camera className="w-6 h-6" />,
      color: '#EC4899',
      bgColor: 'bg-[#EC4899]/10',
      count: 4,
    },
    {
      id: 'expense' as ReportCategory,
      title: 'Expense Reports',
      icon: <DollarSign className="w-6 h-6" />,
      color: '#EF4444',
      bgColor: 'bg-[#EF4444]/10',
      count: 4,
    },
    {
      id: 'worker' as ReportCategory,
      title: 'Worker Ledger',
      icon: <Users className="w-6 h-6" />,
      color: '#6366F1',
      bgColor: 'bg-[#6366F1]/10',
      count: 1,
    },
    {
      id: 'account' as ReportCategory,
      title: 'Account Reports',
      icon: <BookOpen className="w-6 h-6" />,
      color: '#FF9900',
      bgColor: 'bg-[#FF9900]/10',
      count: 1,
    },
  ];

  // Render specific report category
  if (selectedCategory === 'sales') {
    return <SalesReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  if (selectedCategory === 'purchase') {
    return <PurchaseReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  if (selectedCategory === 'inventory') {
    return <InventoryReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  if (selectedCategory === 'rental') {
    return <RentalReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  if (selectedCategory === 'studio') {
    return <StudioReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  if (selectedCategory === 'expense') {
    return <ExpenseReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  if (selectedCategory === 'worker') {
    return <WorkerReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  if (selectedCategory === 'account') {
    return <AccountReports onBack={() => setSelectedCategory(null)} user={user} />;
  }

  // Main Categories View
  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#8B5CF6]" />
            <h1 className="text-lg font-semibold">Reports</h1>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-[#8B5CF6]/20 to-[#7C3AED]/10 border border-[#8B5CF6]/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[#8B5CF6]/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Business Insights</h3>
              <p className="text-xs text-[#9CA3AF]">
                Access detailed reports across all modules. Filter by date range, status, and more.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div className="p-4 space-y-3">
        <h2 className="text-sm font-medium text-[#9CA3AF] mb-2">SELECT CATEGORY</h2>
        {reportCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${category.bgColor} rounded-xl flex items-center justify-center`} style={{ color: category.color }}>
                  {category.icon}
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">{category.title}</p>
                  <p className="text-xs text-[#9CA3AF]">{category.count} report{category.count > 1 ? 's' : ''} available</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </div>
          </button>
        ))}
      </div>

      {/* Quick Summary Stats */}
      <div className="p-4">
        <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">QUICK OVERVIEW (This Month)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Total Sales</p>
            <p className="text-lg font-bold text-[#10B981]">Rs. 1.2M</p>
            <p className="text-xs text-[#10B981] mt-1">↗ +15%</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Total Expenses</p>
            <p className="text-lg font-bold text-[#EF4444]">Rs. 450K</p>
            <p className="text-xs text-[#EF4444] mt-1">↗ +8%</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Stock Value</p>
            <p className="text-lg font-bold text-[#F59E0B]">Rs. 850K</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Stable</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Active Rentals</p>
            <p className="text-lg font-bold text-[#8B5CF6]">24</p>
            <p className="text-xs text-[#10B981] mt-1">↗ +3</p>
          </div>
        </div>
      </div>
    </div>
  );
}