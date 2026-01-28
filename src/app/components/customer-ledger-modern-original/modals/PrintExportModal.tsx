import { useState, useRef } from 'react';
import { X, Printer, FileDown, Monitor, FileText, Calendar } from 'lucide-react';
import type { Transaction } from '@/app/types';

interface PrintExportModalProps {
  transactions: Transaction[];
  visibleColumns: Record<string, boolean>;
  onClose: () => void;
}

export function PrintExportModal({ transactions, visibleColumns, onClose }: PrintExportModalProps) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [format, setFormat] = useState<'print' | 'pdf' | 'excel'>('print');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        @media print {
          @page {
            size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 15mm;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: ${orientation === 'landscape' ? '9pt' : '10pt'};
            color: #000;
          }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .print-header h1 {
            margin: 0;
            font-size: 20pt;
            color: #1e40af;
          }
          .print-header p {
            margin: 5px 0;
            font-size: 10pt;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 8px;
            text-align: left;
            font-size: ${orientation === 'landscape' ? '8pt' : '9pt'};
            font-weight: bold;
          }
          td {
            border: 1px solid #e2e8f0;
            padding: 6px 8px;
            font-size: ${orientation === 'landscape' ? '8pt' : '9pt'};
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .text-right {
            text-align: right;
          }
          .summary-section {
            margin-top: 20px;
            padding: 15px;
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
          }
          .summary-item {
            text-align: center;
          }
          .summary-label {
            font-size: 9pt;
            color: #666;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 14pt;
            font-weight: bold;
            color: #1e40af;
          }
          .footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #cbd5e1;
            font-size: 8pt;
            text-align: center;
            color: #666;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 7pt;
          }
          .badge-sale { background-color: #dbeafe; color: #1e40af; }
          .badge-payment { background-color: #d1fae5; color: #065f46; }
          .badge-discount { background-color: #e9d5ff; color: #6b21a8; }
        }
      </style>
    `;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Customer Ledger - All Transactions</title>
        ${styles}
      </head>
      <body>
        ${includeHeader ? `
          <div class="print-header">
            <h1>Customer Ledger Report</h1>
            <p><strong>All Transactions</strong></p>
            <p>Generated on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p>Total Transactions: ${transactions.length}</p>
          </div>
        ` : ''}
        
        <table>
          <thead>
            <tr>
              ${visibleColumns.date ? '<th>Date</th>' : ''}
              ${visibleColumns.reference ? '<th>Reference</th>' : ''}
              ${visibleColumns.type ? '<th>Type</th>' : ''}
              ${visibleColumns.description ? '<th>Description</th>' : ''}
              ${visibleColumns.paymentAccount ? '<th>Payment Method</th>' : ''}
              ${visibleColumns.notes ? '<th>Notes</th>' : ''}
              ${visibleColumns.debit ? '<th class="text-right">Debit</th>' : ''}
              ${visibleColumns.credit ? '<th class="text-right">Credit</th>' : ''}
              ${visibleColumns.balance ? '<th class="text-right">Balance</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => `
              <tr>
                ${visibleColumns.date ? `<td>${new Date(t.date).toLocaleDateString('en-GB')}</td>` : ''}
                ${visibleColumns.reference ? `<td>${t.referenceNo}</td>` : ''}
                ${visibleColumns.type ? `<td><span class="badge badge-${t.documentType.toLowerCase()}">${t.documentType}</span></td>` : ''}
                ${visibleColumns.description ? `<td>${t.description}</td>` : ''}
                ${visibleColumns.paymentAccount ? `<td>${t.paymentAccount}</td>` : ''}
                ${visibleColumns.notes ? `<td>${t.notes || '-'}</td>` : ''}
                ${visibleColumns.debit ? `<td class="text-right">${t.debit > 0 ? t.debit.toLocaleString('en-PK') : '-'}</td>` : ''}
                ${visibleColumns.credit ? `<td class="text-right">${t.credit > 0 ? t.credit.toLocaleString('en-PK') : '-'}</td>` : ''}
                ${visibleColumns.balance ? `<td class="text-right">${t.runningBalance.toLocaleString('en-PK')}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${includeSummary ? `
          <div class="summary-section">
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Debit</div>
                <div class="summary-value">Rs ${totalDebit.toLocaleString('en-PK')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Credit</div>
                <div class="summary-value">Rs ${totalCredit.toLocaleString('en-PK')}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Net Balance</div>
                <div class="summary-value">Rs ${(totalDebit - totalCredit).toLocaleString('en-PK')}</div>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated report. No signature required.</p>
          <p>Printed from Customer Ledger System • ${new Date().toLocaleString('en-GB')}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();

    if (format === 'print') {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else if (format === 'pdf') {
      // For PDF, the print dialog will have "Save as PDF" option
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleExcelExport = () => {
    // Create CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Header
    const headers = [];
    if (visibleColumns.date) headers.push('Date');
    if (visibleColumns.reference) headers.push('Reference');
    if (visibleColumns.type) headers.push('Type');
    if (visibleColumns.description) headers.push('Description');
    if (visibleColumns.paymentAccount) headers.push('Payment Method');
    if (visibleColumns.notes) headers.push('Notes');
    if (visibleColumns.debit) headers.push('Debit');
    if (visibleColumns.credit) headers.push('Credit');
    if (visibleColumns.balance) headers.push('Balance');
    
    csvContent += headers.join(',') + '\n';
    
    // Data rows
    transactions.forEach(t => {
      const row = [];
      if (visibleColumns.date) row.push(new Date(t.date).toLocaleDateString('en-GB'));
      if (visibleColumns.reference) row.push(t.referenceNo);
      if (visibleColumns.type) row.push(t.documentType);
      if (visibleColumns.description) row.push(`"${t.description}"`);
      if (visibleColumns.paymentAccount) row.push(t.paymentAccount);
      if (visibleColumns.notes) row.push(`"${t.notes || '-'}"`);
      if (visibleColumns.debit) row.push(t.debit);
      if (visibleColumns.credit) row.push(t.credit);
      if (visibleColumns.balance) row.push(t.runningBalance);
      
      csvContent += row.join(',') + '\n';
    });
    
    // Summary
    if (includeSummary) {
      csvContent += '\n';
      csvContent += `Total Debit,${totalDebit}\n`;
      csvContent += `Total Credit,${totalCredit}\n`;
      csvContent += `Net Balance,${totalDebit - totalCredit}\n`;
    }
    
    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (format === 'excel') {
      handleExcelExport();
    } else {
      handlePrint();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="border-b border-slate-200 px-8 py-6 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <Printer className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl text-slate-900">Print & Export Options</h2>
                <p className="text-sm text-slate-600 mt-1">Configure your print and export settings</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Options */}
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm text-slate-900 mb-3">Export Format</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setFormat('print')}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      format === 'print'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Printer className={`w-5 h-5 ${format === 'print' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <div className={`text-sm ${format === 'print' ? 'text-purple-900' : 'text-slate-700'}`}>Print</div>
                      <div className="text-xs text-slate-500">Direct print to printer</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFormat('pdf')}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      format === 'pdf'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileText className={`w-5 h-5 ${format === 'pdf' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <div className={`text-sm ${format === 'pdf' ? 'text-purple-900' : 'text-slate-700'}`}>Save as PDF</div>
                      <div className="text-xs text-slate-500">Export to PDF file</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFormat('excel')}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      format === 'excel'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileDown className={`w-5 h-5 ${format === 'excel' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <div className={`text-sm ${format === 'excel' ? 'text-purple-900' : 'text-slate-700'}`}>Export to Excel</div>
                      <div className="text-xs text-slate-500">Download as CSV file</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Orientation Selection (Only for Print/PDF) */}
              {format !== 'excel' && (
                <div>
                  <label className="block text-sm text-slate-900 mb-3">Page Orientation</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setOrientation('portrait')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        orientation === 'portrait'
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-12 h-16 mx-auto mb-2 rounded border-2 ${
                        orientation === 'portrait' ? 'border-purple-600' : 'border-slate-300'
                      }`}></div>
                      <div className={`text-sm ${orientation === 'portrait' ? 'text-purple-900' : 'text-slate-700'}`}>Portrait</div>
                    </button>

                    <button
                      onClick={() => setOrientation('landscape')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        orientation === 'landscape'
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-16 h-12 mx-auto mb-2 rounded border-2 ${
                        orientation === 'landscape' ? 'border-purple-600' : 'border-slate-300'
                      }`}></div>
                      <div className={`text-sm ${orientation === 'landscape' ? 'text-purple-900' : 'text-slate-700'}`}>Landscape</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Include Options */}
              <div>
                <label className="block text-sm text-slate-900 mb-3">Include in Report</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeHeader}
                      onChange={(e) => setIncludeHeader(e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <div>
                      <div className="text-sm text-slate-900">Report Header</div>
                      <div className="text-xs text-slate-500">Company name, date, title</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSummary}
                      onChange={(e) => setIncludeSummary(e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <div>
                      <div className="text-sm text-slate-900">Summary Section</div>
                      <div className="text-xs text-slate-500">Totals and balances</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column - Preview */}
            <div>
              <label className="block text-sm text-slate-900 mb-3">Preview</label>
              <div className="border-2 border-slate-200 rounded-xl p-6 bg-slate-50 min-h-[500px]">
                <div className={`bg-white shadow-lg mx-auto ${
                  orientation === 'landscape' ? 'w-full aspect-[1.414/1]' : 'w-3/4 aspect-[1/1.414]'
                } p-4 overflow-hidden`}>
                  <div className="text-center mb-4">
                    <div className="text-xs text-blue-700 mb-1">Customer Ledger Report</div>
                    <div className="text-[10px] text-slate-500">All Transactions</div>
                  </div>
                  <div className="border border-slate-200">
                    <table className="w-full text-[8px]">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-200 px-1 py-0.5 text-left">Date</th>
                          <th className="border border-slate-200 px-1 py-0.5 text-left">Ref</th>
                          <th className="border border-slate-200 px-1 py-0.5 text-right">Debit</th>
                          <th className="border border-slate-200 px-1 py-0.5 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.slice(0, 8).map((t, i) => (
                          <tr key={i}>
                            <td className="border border-slate-200 px-1 py-0.5">{new Date(t.date).toLocaleDateString('en-GB').substring(0, 5)}</td>
                            <td className="border border-slate-200 px-1 py-0.5">{t.referenceNo.substring(0, 8)}</td>
                            <td className="border border-slate-200 px-1 py-0.5 text-right">{t.debit > 0 ? t.debit.toLocaleString().substring(0, 6) : '-'}</td>
                            <td className="border border-slate-200 px-1 py-0.5 text-right">{t.credit > 0 ? t.credit.toLocaleString().substring(0, 6) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {includeSummary && (
                    <div className="mt-2 p-2 bg-slate-100 text-[8px] text-center">
                      <div>Summary: Debit: {totalDebit.toLocaleString()} | Credit: {totalCredit.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 px-8 py-5 bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {transactions.length} transactions • 
            {format === 'excel' ? ' CSV Format' : ` ${orientation === 'landscape' ? 'Landscape' : 'Portrait'} ${format === 'pdf' ? 'PDF' : 'Print'}`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md flex items-center gap-2"
            >
              {format === 'excel' ? <FileDown className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
              {format === 'excel' ? 'Download CSV' : format === 'pdf' ? 'Save as PDF' : 'Print Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
