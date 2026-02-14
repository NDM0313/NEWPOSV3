import { useState } from 'react';
import { ArrowLeft, ShoppingBag, Search } from 'lucide-react';
import { User } from '../../App';
import { DateRangeSelector } from './DateRangeSelector';
import { ReportActions } from './ReportActions';
import { generateReportPDF, downloadPDF, printPDF, sharePDF, ReportData } from '../../utils/pdfGenerator';

interface PurchaseReportsProps {
  onBack: () => void;
  user: User;
}

interface PurchaseRecord {
  id: string;
  date: string;
  billNo: string;
  supplier: string;
  item: string;
  quantity: number;
  amount: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
}

export function PurchaseReports({ onBack, user }: PurchaseReportsProps) {
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-20');
  const [searchQuery, setSearchQuery] = useState('');

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const purchases: PurchaseRecord[] = [
    { id: 'p1', date: '2026-01-19', billNo: 'PUR-001', supplier: 'Ali Fabrics Ltd', item: 'Cotton Fabric', quantity: 100, amount: 250000, paymentStatus: 'paid' },
    { id: 'p2', date: '2026-01-17', billNo: 'PUR-002', supplier: 'Metro Textiles', item: 'Lawn Material', quantity: 200, amount: 450000, paymentStatus: 'partial' },
    { id: 'p3', date: '2026-01-15', billNo: 'PUR-003', supplier: 'Silk House', item: 'Silk Dupatta', quantity: 50, amount: 180000, paymentStatus: 'pending' },
  ];

  const filtered = purchases.filter(p => 
    p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.billNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totals = {
    total: filtered.reduce((sum, p) => sum + p.amount, 0),
    paid: filtered.filter(p => p.paymentStatus === 'paid').reduce((sum, p) => sum + p.amount, 0),
    pending: filtered.filter(p => p.paymentStatus === 'pending').reduce((sum, p) => sum + p.amount, 0),
  };

  // PDF Generation Functions
  const generatePurchaseReportData = (): ReportData => {
    return {
      companyName: 'Main Din Collection',
      reportTitle: 'Purchase Report',
      dateRange: `${dateFrom} to ${dateTo}`,
      summary: [
        { label: 'Total Purchases', value: `Rs. ${totals.total.toLocaleString()}` },
        { label: 'Paid', value: `Rs. ${totals.paid.toLocaleString()}` },
        { label: 'Pending', value: `Rs. ${totals.pending.toLocaleString()}` },
        { label: 'Total Records', value: filtered.length.toString() },
      ],
      records: {
        columns: ['Bill No', 'Supplier', 'Item', 'Qty', 'Amount', 'Status'],
        rows: filtered.map(p => [
          p.billNo,
          p.supplier,
          p.item,
          p.quantity.toString(),
          `Rs. ${p.amount.toLocaleString()}`,
          p.paymentStatus.toUpperCase()
        ])
      },
      generatedBy: user.name,
      generatedAt: new Date().toLocaleString('en-US', { 
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const handleExportPDF = async () => {
    try {
      const reportData = generatePurchaseReportData();
      const pdfBlob = await generateReportPDF(reportData);
      const filename = `Purchase_Report_${dateFrom}_to_${dateTo}.pdf`;
      downloadPDF(pdfBlob, filename);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handlePrint = async () => {
    try {
      const reportData = generatePurchaseReportData();
      const pdfBlob = await generateReportPDF(reportData);
      printPDF(pdfBlob);
    } catch (error) {
      console.error('Print Error:', error);
      alert('Failed to print. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      const reportData = generatePurchaseReportData();
      const pdfBlob = await generateReportPDF(reportData);
      const filename = `Purchase_Report_${dateFrom}_to_${dateTo}.pdf`;
      const shared = await sharePDF(pdfBlob, filename, 'Purchase Report');
      
      if (!shared) {
        alert('Share feature not supported. PDF downloaded instead.');
      }
    } catch (error) {
      console.error('Share Error:', error);
      alert('Failed to share. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-[#10B981]" />
              <h1 className="text-lg font-semibold">Purchase Reports</h1>
            </div>
          </div>

          {/* Report Actions */}
          <ReportActions 
            onExportPDF={handleExportPDF}
            onPrint={handlePrint}
            onShare={handleShare}
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <DateRangeSelector
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
          <input 
            type="text" 
            placeholder="Search supplier or bill..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full h-12 pl-10 pr-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" 
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-3">
            <p className="text-xs text-[#10B981] mb-1">Total</p>
            <p className="text-sm font-bold text-[#10B981]">Rs. {totals.total.toLocaleString()}</p>
          </div>
          <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl p-3">
            <p className="text-xs text-[#3B82F6] mb-1">Paid</p>
            <p className="text-sm font-bold text-[#3B82F6]">Rs. {totals.paid.toLocaleString()}</p>
          </div>
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3">
            <p className="text-xs text-[#EF4444] mb-1">Pending</p>
            <p className="text-sm font-bold text-[#EF4444]">Rs. {totals.pending.toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[#9CA3AF]">PURCHASE RECORDS ({filtered.length})</h3>
          {filtered.map((purchase) => (
            <div key={purchase.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-white">{purchase.billNo}</p>
                  <p className="text-xs text-[#9CA3AF]">{purchase.supplier}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#10B981]">Rs. {purchase.amount.toLocaleString()}</p>
                  <p className="text-xs text-[#6B7280]">{purchase.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs rounded-md font-medium">{purchase.item}</span>
                <span className={`px-2 py-1 ${purchase.paymentStatus === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'} text-xs rounded-md font-medium`}>{purchase.paymentStatus}</span>
                <span className="px-2 py-1 bg-[#6B7280]/10 text-[#9CA3AF] text-xs rounded-md font-medium">Qty: {purchase.quantity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
