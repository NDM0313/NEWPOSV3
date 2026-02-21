import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  FileText,
  DollarSign,
  Package,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Camera,
  Users,
  BookOpen,
  Loader2,
  BookMarked,
} from 'lucide-react';
import type { User } from '../../types';
import * as reportsApi from '../../api/reports';
import { SalesReports } from './SalesReports';
import { PurchaseReports } from './PurchaseReports';
import { InventoryReports } from './InventoryReports';
import { RentalReports } from './RentalReports';
import { ExpenseReports } from './ExpenseReports';
import { StudioReports } from './StudioReports';
import { WorkerReports } from './WorkerReports';
import { AccountReports } from './AccountReports';
import { DayBookReport } from './DayBookReport';

interface ReportsModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

type ReportCategory =
  | 'daybook'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'rental'
  | 'studio'
  | 'expense'
  | 'worker'
  | 'account';

export function ReportsModule({ onBack, user, companyId, branchId }: ReportsModuleProps) {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [salesSummary, setSalesSummary] = useState<reportsApi.SalesSummary | null>(null);
  const [receivables, setReceivables] = useState<number>(0);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    Promise.all([
      reportsApi.getSalesSummary(companyId, branchId, 30),
      reportsApi.getReceivables(companyId, branchId),
    ]).then(([salesRes, recRes]) => {
      if (c) return;
      setLoading(false);
      if (salesRes.data) setSalesSummary(salesRes.data);
      if (recRes.data != null) setReceivables(recRes.data);
    });
    return () => {
      c = true;
    };
  }, [companyId, branchId]);

  if (selectedCategory === 'daybook') {
    return <DayBookReport onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} branchId={branchId} />;
  }
  if (selectedCategory === 'sales') {
    return <SalesReports onBack={() => setSelectedCategory(null)} userName={user.name} />;
  }
  if (selectedCategory === 'purchase') {
    return <PurchaseReports onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} branchId={branchId} />;
  }
  if (selectedCategory === 'inventory') {
    return <InventoryReports onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} />;
  }
  if (selectedCategory === 'rental') {
    return <RentalReports onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} branchId={branchId} />;
  }
  if (selectedCategory === 'expense') {
    return <ExpenseReports onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} branchId={branchId} />;
  }
  if (selectedCategory === 'studio') {
    return <StudioReports onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} branchId={branchId} />;
  }
  if (selectedCategory === 'worker') {
    return <WorkerReports onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} />;
  }
  if (selectedCategory === 'account') {
    return <AccountReports onBack={() => setSelectedCategory(null)} user={user} companyId={companyId} branchId={branchId} />;
  }

  const reportCategories = [
    { id: 'daybook' as ReportCategory, title: 'Roznamcha (Day Book)', icon: <BookMarked className="w-6 h-6" />, color: '#0EA5E9', bgColor: 'bg-[#0EA5E9]/10' },
    { id: 'sales' as ReportCategory, title: 'Sales Reports', icon: <ShoppingCart className="w-6 h-6" />, color: '#3B82F6', bgColor: 'bg-[#3B82F6]/10' },
    { id: 'purchase' as ReportCategory, title: 'Purchase Reports', icon: <ShoppingBag className="w-6 h-6" />, color: '#10B981', bgColor: 'bg-[#10B981]/10' },
    { id: 'inventory' as ReportCategory, title: 'Inventory Reports', icon: <Package className="w-6 h-6" />, color: '#F59E0B', bgColor: 'bg-[#F59E0B]/10' },
    { id: 'rental' as ReportCategory, title: 'Rental Reports', icon: <Shirt className="w-6 h-6" />, color: '#8B5CF6', bgColor: 'bg-[#8B5CF6]/10' },
    { id: 'studio' as ReportCategory, title: 'Studio Reports', icon: <Camera className="w-6 h-6" />, color: '#EC4899', bgColor: 'bg-[#EC4899]/10' },
    { id: 'expense' as ReportCategory, title: 'Expense Reports', icon: <DollarSign className="w-6 h-6" />, color: '#EF4444', bgColor: 'bg-[#EF4444]/10' },
    { id: 'worker' as ReportCategory, title: 'Worker Ledger', icon: <Users className="w-6 h-6" />, color: '#6366F1', bgColor: 'bg-[#6366F1]/10' },
    { id: 'account' as ReportCategory, title: 'Account Reports', icon: <BookOpen className="w-6 h-6" />, color: '#FF9900', bgColor: 'bg-[#FF9900]/10' },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#8B5CF6] rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Reports</h1>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-[#3B82F6]" />
                  <span className="text-sm text-[#9CA3AF]">Sales (30 days)</span>
                </div>
                <p className="text-xl font-bold text-white">Rs. {(salesSummary?.totalSales ?? 0).toLocaleString()}</p>
                <p className="text-xs text-[#6B7280]">{salesSummary?.count ?? 0} invoices</p>
              </div>
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-[#F59E0B]" />
                  <span className="text-sm text-[#9CA3AF]">Receivables</span>
                </div>
                <p className="text-xl font-bold text-[#F59E0B]">Rs. {receivables.toLocaleString()}</p>
                <p className="text-xs text-[#6B7280]">Due from customers</p>
              </div>
            </div>

            <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">REPORT CATEGORIES</h2>
            <div className="grid grid-cols-2 gap-3">
              {reportCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`${cat.bgColor} border border-[#374151] rounded-xl p-4 flex items-center gap-3 hover:border-[#3B82F6]/50 transition-all text-left`}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                    <span style={{ color: cat.color }}>{cat.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{cat.title}</h3>
                    <p className="text-xs text-[#9CA3AF]">View {cat.id} reports</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
