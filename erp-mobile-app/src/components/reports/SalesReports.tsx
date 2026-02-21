import { useState } from 'react';
import { ArrowLeft, ShoppingCart, Search } from 'lucide-react';
import { DateRangeSelector } from './DateRangeSelector';
import { ReportActions } from './ReportActions';
import { generateReportPDF, downloadPDF, printPDF, sharePDF, type ReportData } from '../../utils/pdfGenerator';

interface SalesReportsProps {
  onBack: () => void;
  userName: string;
}

interface SaleRecord {
  id: string;
  date: string;
  invoiceNo: string;
  customer: string;
  product: string;
  quantity: number;
  amount: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  saleType: 'Regular' | 'Studio';
}

export function SalesReports({ onBack, userName }: SalesReportsProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<SaleRecord | null>(null);

  const salesData: SaleRecord[] = [
    { id: 's1', date: '2026-01-20', invoiceNo: 'INV-2026-0120', customer: 'Sara Ahmed', product: 'Lawn Suit', quantity: 5, amount: 75000, paymentStatus: 'paid', saleType: 'Regular' },
    { id: 's2', date: '2026-01-19', invoiceNo: 'INV-2026-0119', customer: 'Ali Traders', product: 'Cotton Fabric', quantity: 50, amount: 125000, paymentStatus: 'partial', saleType: 'Regular' },
    { id: 's3', date: '2026-01-18', invoiceNo: 'INV-2026-0118', customer: 'Ayesha Khan', product: 'Bridal Dress', quantity: 1, amount: 85000, paymentStatus: 'pending', saleType: 'Studio' },
    { id: 's4', date: '2026-01-17', invoiceNo: 'INV-2026-0117', customer: 'Metro Fashion', product: 'Silk Dupatta', quantity: 20, amount: 60000, paymentStatus: 'paid', saleType: 'Regular' },
    { id: 's5', date: '2026-01-16', invoiceNo: 'INV-2026-0116', customer: 'Zara Collections', product: 'Printed Lawn', quantity: 30, amount: 90000, paymentStatus: 'paid', saleType: 'Regular' },
  ];

  const filteredSales = salesData.filter(
    (sale) =>
      sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.product.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totals = {
    totalSales: filteredSales.reduce((sum, s) => sum + s.amount, 0),
    totalPaid: filteredSales.filter((s) => s.paymentStatus === 'paid').reduce((sum, s) => sum + s.amount, 0),
    totalPending: filteredSales.filter((s) => s.paymentStatus === 'pending').reduce((sum, s) => sum + s.amount, 0),
  };

  const generateSalesReportData = (): ReportData => ({
    companyName: 'Main Din Collection',
    reportTitle: 'Sales Report',
    dateRange: `${dateFrom} to ${dateTo}`,
    summary: [
      { label: 'Total Sales', value: `Rs. ${totals.totalSales.toLocaleString()}` },
      { label: 'Paid', value: `Rs. ${totals.totalPaid.toLocaleString()}` },
      { label: 'Pending', value: `Rs. ${totals.totalPending.toLocaleString()}` },
      { label: 'Total Records', value: filteredSales.length.toString() },
    ],
    records: {
      columns: ['Invoice', 'Customer', 'Product', 'Qty', 'Amount', 'Status'],
      rows: filteredSales.map((sale) => [
        sale.invoiceNo,
        sale.customer,
        sale.product,
        sale.quantity.toString(),
        `Rs. ${sale.amount.toLocaleString()}`,
        sale.paymentStatus.toUpperCase(),
      ]),
    },
    generatedBy: userName,
    generatedAt: new Date().toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  });

  const handleExportPDF = async () => {
    try {
      const blob = await generateReportPDF(generateSalesReportData());
      downloadPDF(blob, `Sales_Report_${dateFrom}_to_${dateTo}.pdf`);
    } catch {
      alert('Failed to export PDF.');
    }
  };

  const handlePrint = async () => {
    try {
      const blob = await generateReportPDF(generateSalesReportData());
      printPDF(blob);
    } catch {
      alert('Failed to print.');
    }
  };

  const handleShare = async () => {
    try {
      const blob = await generateReportPDF(generateSalesReportData());
      await sharePDF(blob, `Sales_Report_${dateFrom}_to_${dateTo}.pdf`, 'Sales Report');
    } catch {
      alert('Failed to share.');
    }
  };

  if (selectedRecord) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-white">Sale Details</h1>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-[#9CA3AF]">Invoice Number</p>
                <p className="text-lg font-bold text-white">{selectedRecord.invoiceNo}</p>
              </div>
              <span
                className={`px-3 py-1 text-xs rounded-full font-medium ${
                  selectedRecord.paymentStatus === 'paid'
                    ? 'bg-[#10B981]/10 text-[#10B981]'
                    : selectedRecord.paymentStatus === 'partial'
                    ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'bg-[#EF4444]/10 text-[#EF4444]'
                }`}
              >
                {selectedRecord.paymentStatus.toUpperCase()}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-[#9CA3AF]">Date</span>
                <span className="text-sm text-white">{selectedRecord.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#9CA3AF]">Customer</span>
                <span className="text-sm text-white">{selectedRecord.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#9CA3AF]">Product</span>
                <span className="text-sm text-white">{selectedRecord.product}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-[#374151]">
                <span className="text-sm font-medium text-white">Total Amount</span>
                <span className="text-lg font-bold text-[#10B981]">Rs. {selectedRecord.amount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-[#3B82F6]" />
              <h1 className="text-lg font-semibold text-white">Sales Reports</h1>
            </div>
          </div>
          <ReportActions onExportPDF={handleExportPDF} onPrint={handlePrint} onShare={handleShare} />
        </div>
      </div>

      <div className="p-4">
        <DateRangeSelector dateFrom={dateFrom} dateTo={dateTo} onDateChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
      </div>

      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search by customer, invoice, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl p-3">
            <p className="text-xs text-[#3B82F6] mb-1">Total Sales</p>
            <p className="text-sm font-bold text-[#3B82F6]">Rs. {totals.totalSales.toLocaleString()}</p>
          </div>
          <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-3">
            <p className="text-xs text-[#10B981] mb-1">Paid</p>
            <p className="text-sm font-bold text-[#10B981]">Rs. {totals.totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3">
            <p className="text-xs text-[#EF4444] mb-1">Pending</p>
            <p className="text-sm font-bold text-[#EF4444]">Rs. {totals.totalPending.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3">
        <h3 className="text-sm font-medium text-[#9CA3AF]">SALES RECORDS ({filteredSales.length})</h3>
        {filteredSales.map((sale) => (
          <button
            key={sale.id}
            onClick={() => setSelectedRecord(sale)}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all text-left"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-white">{sale.invoiceNo}</p>
                <p className="text-xs text-[#9CA3AF]">{sale.customer}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[#10B981]">Rs. {sale.amount.toLocaleString()}</p>
                <p className="text-xs text-[#6B7280]">{sale.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs rounded-md font-medium">{sale.product}</span>
              <span
                className={`px-2 py-1 text-xs rounded-md font-medium ${
                  sale.paymentStatus === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' : sale.paymentStatus === 'partial' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                }`}
              >
                {sale.paymentStatus}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
