import { useState } from 'react';
import { ArrowLeft, Users, Calendar, Filter, ChevronRight, X, Search, FileText, Printer, Share2, Download } from 'lucide-react';
import { User } from '../../App';
import { DateInputField } from '../shared/DateTimePicker';

interface WorkerReportsProps {
  onBack: () => void;
  user: User;
}

interface Worker {
  id: string;
  name: string;
  type: 'Tailor' | 'Helper' | 'Cutting Master' | 'Stitching Master';
  phoneNumber: string;
}

interface WorkerLedgerEntry {
  id: string;
  date: string;
  orderId: string;
  customer: string;
  stage: string;
  quantity: number;
  rate: number;
  amount: number;
  type: 'debit' | 'credit';
  paymentStatus: 'paid' | 'pending';
  description: string;
}

export function WorkerReports({ onBack, user }: WorkerReportsProps) {
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showWorkerList, setShowWorkerList] = useState(false);
  const [showReportView, setShowReportView] = useState(false);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock workers data
  const workers: Worker[] = [
    { id: 'w1', name: 'Ahmed Ali', type: 'Tailor', phoneNumber: '0300-1234567' },
    { id: 'w2', name: 'Hassan Khan', type: 'Cutting Master', phoneNumber: '0301-2345678' },
    { id: 'w3', name: 'Bilal Ahmed', type: 'Stitching Master', phoneNumber: '0302-3456789' },
    { id: 'w4', name: 'Usman Tariq', type: 'Helper', phoneNumber: '0303-4567890' },
    { id: 'w5', name: 'Faisal Mahmood', type: 'Tailor', phoneNumber: '0304-5678901' },
  ];

  // Mock ledger data
  const ledgerEntries: WorkerLedgerEntry[] = [
    {
      id: 'l1',
      date: '2026-01-18',
      orderId: 'SO-2026-1245',
      customer: 'Sara Textiles',
      stage: 'Cutting',
      quantity: 50,
      rate: 25,
      amount: 1250,
      type: 'debit',
      paymentStatus: 'pending',
      description: 'Suit cutting - 50 pieces @ Rs. 25/piece',
    },
    {
      id: 'l2',
      date: '2026-01-17',
      orderId: 'SO-2026-1230',
      customer: 'Din Fashion',
      stage: 'Stitching',
      quantity: 30,
      rate: 150,
      amount: 4500,
      type: 'debit',
      paymentStatus: 'pending',
      description: 'Shirt stitching - 30 pieces @ Rs. 150/piece',
    },
    {
      id: 'l3',
      date: '2026-01-15',
      orderId: 'PAY-001',
      customer: 'Cash Payment',
      stage: 'Payment',
      quantity: 1,
      rate: 3000,
      amount: 3000,
      type: 'credit',
      paymentStatus: 'paid',
      description: 'Partial payment received',
    },
    {
      id: 'l4',
      date: '2026-01-12',
      orderId: 'SO-2026-1200',
      customer: 'Ali Collections',
      stage: 'Finishing',
      quantity: 20,
      rate: 50,
      amount: 1000,
      type: 'debit',
      paymentStatus: 'pending',
      description: 'Finishing work - 20 pieces @ Rs. 50/piece',
    },
    {
      id: 'l5',
      date: '2026-01-10',
      orderId: 'SO-2026-1180',
      customer: 'Metro Garments',
      stage: 'Cutting',
      quantity: 100,
      rate: 20,
      amount: 2000,
      type: 'debit',
      paymentStatus: 'pending',
      description: 'Trouser cutting - 100 pieces @ Rs. 20/piece',
    },
  ];

  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.phoneNumber.includes(searchQuery)
  );

  const calculateTotals = () => {
    const totalDebit = ledgerEntries
      .filter(e => e.type === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalCredit = ledgerEntries
      .filter(e => e.type === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const balance = totalDebit - totalCredit;
    
    return { totalDebit, totalCredit, balance };
  };

  const totals = calculateTotals();

  const handleGenerateReport = () => {
    console.log('Generating worker ledger:', {
      worker: selectedWorker,
      dateFrom,
      dateTo,
      generatedBy: user.name,
    });
    setShowReportView(true);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleShareReport = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Worker Ledger - ${selectedWorker?.name}`,
          text: `Worker Ledger Report for ${selectedWorker?.name} (${dateFrom} to ${dateTo})`,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      alert('Share feature not supported on this device');
    }
  };

  const handleExportPDF = () => {
    alert('PDF Export feature - Would generate and download PDF');
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Detailed Report View
  if (showReportView && selectedWorker) {
    return (
      <div className="min-h-screen bg-[#111827] pb-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setShowReportView(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Worker Ledger Report</h1>
              <p className="text-xs text-white/80">{selectedWorker.name}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePrintReport}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={handleShareReport}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 size={16} />
              Share
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Report Header Card */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="text-center mb-4 pb-4 border-b border-[#374151]">
              <h2 className="text-lg font-bold text-white mb-1">Main Din Collection</h2>
              <p className="text-xs text-[#9CA3AF]">Worker Ledger Statement</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Worker Name:</span>
                <span className="text-white font-medium">{selectedWorker.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Worker Type:</span>
                <span className="text-white font-medium">{selectedWorker.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Phone:</span>
                <span className="text-white font-medium">{selectedWorker.phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Period:</span>
                <span className="text-white font-medium">{formatDate(dateFrom)} - {formatDate(dateTo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Generated Date:</span>
                <span className="text-white font-medium">{formatDate(new Date().toISOString().split('T')[0])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Generated By:</span>
                <span className="text-white font-medium">{user.name}</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3">
              <p className="text-xs text-[#EF4444] mb-1">Total Debit</p>
              <p className="text-sm font-bold text-[#EF4444]">Rs. {totals.totalDebit.toLocaleString()}</p>
            </div>
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-3">
              <p className="text-xs text-[#10B981] mb-1">Total Credit</p>
              <p className="text-sm font-bold text-[#10B981]">Rs. {totals.totalCredit.toLocaleString()}</p>
            </div>
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-3">
              <p className="text-xs text-[#F59E0B] mb-1">Net Payable</p>
              <p className="text-sm font-bold text-[#F59E0B]">Rs. {totals.balance.toLocaleString()}</p>
            </div>
          </div>

          {/* Ledger Entries Table */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#374151]">
              <h3 className="text-sm font-semibold text-white">Transaction Details</h3>
            </div>

            <div className="divide-y divide-[#374151]">
              {ledgerEntries.map((entry, index) => (
                <div key={entry.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-[#9CA3AF]">#{index + 1}</span>
                        <span className="text-xs font-medium text-white">{entry.orderId}</span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] mb-1">{entry.customer}</p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#3B82F6]/10 text-[#3B82F6] text-xs rounded-md font-medium">
                          {entry.stage}
                        </span>
                        <span className={`px-2 py-0.5 ${entry.paymentStatus === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'} text-xs rounded-md font-medium`}>
                          {entry.paymentStatus}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-[#9CA3AF] mb-1">{formatDate(entry.date)}</p>
                      <p className={`text-base font-bold ${entry.type === 'debit' ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                        {entry.type === 'debit' ? '+' : '-'} Rs. {entry.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-[#111827] rounded-lg p-2 mt-2">
                    <p className="text-xs text-[#9CA3AF]">{entry.description}</p>
                    {entry.quantity > 1 && (
                      <p className="text-xs text-[#6B7280] mt-1">
                        Qty: {entry.quantity} × Rs. {entry.rate} = Rs. {entry.amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Footer */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Total Entries:</span>
                <span className="text-white font-medium">{ledgerEntries.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Total Work Done (Debit):</span>
                <span className="text-[#EF4444] font-bold">Rs. {totals.totalDebit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Total Paid (Credit):</span>
                <span className="text-[#10B981] font-bold">Rs. {totals.totalCredit.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="pt-3 border-t border-[#374151]">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-white">Net Amount Payable:</span>
                <span className="text-xl font-bold text-[#F59E0B]">Rs. {totals.balance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-[#1F2937]/50 border border-[#374151]/50 rounded-xl p-3">
            <p className="text-xs text-[#6B7280] text-center">
              This is a computer-generated report. For any queries, please contact Main Din Collection.
            </p>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4">
          <div className="flex gap-3">
            <button 
              onClick={handleExportPDF}
              className="flex-1 py-3 bg-[#6366F1] hover:bg-[#5558E3] text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors active:scale-95"
            >
              <Download size={18} />
              Download PDF
            </button>
            <button 
              onClick={() => setShowReportView(false)}
              className="px-6 py-3 bg-[#374151] hover:bg-[#4B5563] text-white rounded-lg font-medium transition-colors active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Worker Selection Modal
  if (showWorkerList) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWorkerList(false)}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Select Worker</h1>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>

        {/* Worker List */}
        <div className="p-4 space-y-3">
          {filteredWorkers.map((worker) => (
            <button
              key={worker.id}
              onClick={() => {
                setSelectedWorker(worker);
                setShowWorkerList(false);
              }}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all active:scale-[0.98] text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#6366F1]/10 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-[#6366F1]">
                      {worker.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-white">{worker.name}</p>
                    <p className="text-xs text-[#9CA3AF]">{worker.type}</p>
                    <p className="text-xs text-[#6B7280]">{worker.phoneNumber}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Main Worker Ledger View
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
            <Users className="w-6 h-6 text-[#6366F1]" />
            <h1 className="text-lg font-semibold">Worker Ledger</h1>
          </div>
        </div>
      </div>

      {/* Worker Selection */}
      <div className="p-4">
        <button
          onClick={() => setShowWorkerList(true)}
          className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#6366F1]/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-[#6366F1]" />
              </div>
              <div className="text-left">
                {selectedWorker ? (
                  <>
                    <p className="font-medium text-white">{selectedWorker.name}</p>
                    <p className="text-xs text-[#9CA3AF]">{selectedWorker.type}</p>
                  </>
                ) : (
                  <p className="text-sm text-[#9CA3AF]">Tap to select worker</p>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
          </div>
        </button>
      </div>

      {selectedWorker && (
        <>
          {/* Date Range Filter */}
          <div className="px-4 pb-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Date Range</h3>
              <div className="space-y-3">
                <DateInputField
                  label="From"
                  value={dateFrom}
                  onChange={setDateFrom}
                  pickerLabel="SELECT FROM DATE"
                />
                <DateInputField
                  label="To"
                  value={dateTo}
                  onChange={setDateTo}
                  pickerLabel="SELECT TO DATE"
                />
              </div>
            </div>
          </div>

          {/* Quick Date Filters */}
          <div className="px-4 pb-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Filters</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    setDateFrom(today.toISOString().split('T')[0]);
                    setDateTo(today.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg text-xs text-white transition-colors active:scale-95"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today.setDate(today.getDate() - 7));
                    setDateFrom(weekAgo.toISOString().split('T')[0]);
                    setDateTo(new Date().toISOString().split('T')[0]);
                  }}
                  className="px-3 py-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg text-xs text-white transition-colors active:scale-95"
                >
                  This Week
                </button>
                <button
                  onClick={() => {
                    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                    setDateFrom(firstDay.toISOString().split('T')[0]);
                    setDateTo(new Date().toISOString().split('T')[0]);
                  }}
                  className="px-3 py-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg text-xs text-white transition-colors active:scale-95"
                >
                  This Month
                </button>
              </div>
            </div>
          </div>

          {/* Report Info & Generate Button */}
          <div className="px-4 pb-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#6366F1]/10 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#6366F1]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Worker Ledger Report</p>
                  <p className="text-xs text-[#9CA3AF]">Ready to generate</p>
                </div>
              </div>
              
              <div className="space-y-2 pt-3 border-t border-[#374151] mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-[#9CA3AF]">Worker</span>
                  <span className="text-white">{selectedWorker?.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#9CA3AF]">Period</span>
                  <span className="text-white">{dateFrom} to {dateTo}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#9CA3AF]">Generated by</span>
                  <span className="text-white">{user.name}</span>
                </div>
              </div>

              {/* Generate Report Button */}
              <button
                onClick={handleGenerateReport}
                className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] shadow-lg active:scale-95 transition-transform"
              >
                <FileText size={18} />
                Generate Report
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3">
                <p className="text-xs text-[#EF4444] mb-1">Total Debit</p>
                <p className="text-sm font-bold text-[#EF4444]">Rs. {totals.totalDebit.toLocaleString()}</p>
              </div>
              <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-3">
                <p className="text-xs text-[#10B981] mb-1">Total Credit</p>
                <p className="text-sm font-bold text-[#10B981]">Rs. {totals.totalCredit.toLocaleString()}</p>
              </div>
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-3">
                <p className="text-xs text-[#F59E0B] mb-1">Balance</p>
                <p className="text-sm font-bold text-[#F59E0B]">Rs. {totals.balance.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Ledger Entries */}
          <div className="px-4 space-y-3">
            <h3 className="text-sm font-medium text-[#9CA3AF]">LEDGER ENTRIES</h3>
            {ledgerEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-white">{entry.orderId}</p>
                    <p className="text-xs text-[#9CA3AF]">{entry.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${entry.type === 'debit' ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                      {entry.type === 'debit' ? '+' : '-'} Rs. {entry.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-[#6B7280]">{entry.date}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs rounded-md font-medium">
                    {entry.stage}
                  </span>
                  <span className={`px-2 py-1 ${entry.paymentStatus === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'} text-xs rounded-md font-medium`}>
                    {entry.paymentStatus}
                  </span>
                </div>

                <p className="text-xs text-[#9CA3AF]">{entry.description}</p>
              </div>
            ))}
          </div>

          {/* Total Payable Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9CA3AF]">Total Payable</p>
                <p className="text-xl font-bold text-[#F59E0B]">Rs. {totals.balance.toLocaleString()}</p>
              </div>
              <button className="px-6 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-medium transition-colors active:scale-95">
                Make Payment
              </button>
            </div>
          </div>
        </>
      )}

      {!selectedWorker && (
        <div className="p-4">
          <div className="bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-xl p-6 text-center">
            <Users className="w-12 h-12 text-[#6366F1] mx-auto mb-3" />
            <p className="text-sm text-[#9CA3AF]">
              Select a worker to view their ledger and payable amount
            </p>
          </div>
        </div>
      )}
    </div>
  );
}