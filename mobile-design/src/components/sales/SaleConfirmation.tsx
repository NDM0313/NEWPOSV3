import { CheckCircle2, Printer, Share2, FileText, Plus, Home, Receipt, FileText as InvoiceIcon, X } from 'lucide-react';
import { SaleData } from './SalesModule';
import { useState } from 'react';

interface SaleConfirmationProps {
  saleData: SaleData;
  onNewSale: () => void;
  onBackToHome: () => void;
}

export function SaleConfirmation({ saleData, onNewSale, onBackToHome }: SaleConfirmationProps) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<'terminal' | 'normal' | null>(null);
  const invoiceNumber = 'INV-0046';
  const currentDate = new Date().toLocaleDateString('en-PK', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
  const currentTime = new Date().toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  const handleTerminalPrint = () => {
    setPrintType('terminal');
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
      setPrintType(null);
    }, 100);
  };

  const handleNormalPrint = () => {
    setPrintType('normal');
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
      setPrintType(null);
    }, 100);
  };

  const handleShare = async () => {
    const invoiceText = `
🧾 *INVOICE ${invoiceNumber}*
━━━━━━━━━━━━━━━━━━━━
📅 Date: ${currentDate}
👤 Customer: ${saleData.customer?.name || 'N/A'}

💰 *AMOUNT DETAILS*
━━━━━━━━━━━━━━━━━━━━
Total: Rs. ${saleData.total.toLocaleString()}
Paid: Rs. ${saleData.total.toLocaleString()}
Status: ✅ PAID

📦 *ITEMS*
━━━━━━━━━━━━━━━━━━━━
${saleData.products.map((p, i) => 
  `${i + 1}. ${p.name}${p.variation ? ` - ${p.variation}` : ''}\n   Qty: ${p.quantity} × Rs. ${p.price.toLocaleString()} = Rs. ${(p.quantity * p.price).toLocaleString()}`
).join('\n')}

━━━━━━━━━━━━━━━━━━━━
Thank you for your business!
Main Din Collection
    `.trim();

    // Try Web Share API first (works on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoiceNumber}`,
          text: invoiceText,
        });
      } catch (err) {
        // User cancelled or error occurred
        if ((err as Error).name !== 'AbortError') {
          copyToClipboard(invoiceText);
        }
      }
    } else {
      // Fallback: Copy to clipboard
      copyToClipboard(invoiceText);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Invoice details copied to clipboard! You can now paste in WhatsApp or any app.');
    }).catch(() => {
      // Final fallback: show text in alert
      alert('Share this invoice:\n\n' + text);
    });
  };

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col">
      {/* Terminal Print Preview (80mm thermal printer) */}
      {printType === 'terminal' && (
        <div className="print-only fixed inset-0 bg-white z-50" style={{ width: '80mm', margin: '0 auto' }}>
          <div className="p-4 text-sm" style={{ fontFamily: 'monospace' }}>
            {/* Header */}
            <div className="text-center mb-4">
              <div className="text-lg font-bold">MAIN DIN COLLECTION</div>
              <div className="text-xs mt-1">================================</div>
            </div>

            {/* Invoice Info */}
            <div className="mb-3 text-xs">
              <div className="flex justify-between mb-1">
                <span>Invoice #:</span>
                <span className="font-bold">{invoiceNumber}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Date:</span>
                <span>{currentDate} {currentTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{saleData.customer?.name || 'Walk-in'}</span>
              </div>
            </div>

            <div className="border-t-2 border-dashed border-gray-400 my-2"></div>

            {/* Items */}
            <div className="mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left py-1">Item</th>
                    <th className="text-center py-1">Qty</th>
                    <th className="text-right py-1">Price</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {saleData.products.map((product, index) => (
                    <>
                      <tr key={index}>
                        <td className="py-1" colSpan={4}>
                          <div className="font-semibold">{product.name}</div>
                          {product.variation && (
                            <div className="text-gray-600 text-xs">- {product.variation}</div>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td></td>
                        <td className="text-center">{product.quantity}</td>
                        <td className="text-right">{product.price}</td>
                        <td className="text-right font-semibold">{(product.quantity * product.price).toLocaleString()}</td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t-2 border-dashed border-gray-400 my-2"></div>

            {/* Totals */}
            <div className="mb-3 text-xs">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-base">TOTAL:</span>
                <span className="font-bold text-base">Rs. {saleData.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span className="font-semibold">Paid:</span>
                <span className="font-semibold">Rs. {saleData.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-bold">Status:</span>
                <span className="font-bold text-green-700">PAID ✓</span>
              </div>
            </div>

            <div className="border-t-2 border-dashed border-gray-400 my-2"></div>

            {/* Footer */}
            <div className="text-center text-xs">
              <div className="mb-2">Thank you for your business!</div>
              <div className="text-xs text-gray-600">Computer Generated Receipt</div>
            </div>
          </div>
        </div>
      )}

      {/* Normal Print Preview (A4) */}
      {printType === 'normal' && (
        <div className="print-only fixed inset-0 bg-white p-8 z-50">
          <div className="max-w-2xl mx-auto">
            {/* Invoice Header */}
            <div className="text-center mb-8 border-b-2 border-gray-800 pb-6">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">MAIN DIN COLLECTION</h1>
              <p className="text-gray-600">Sales Invoice</p>
            </div>

            {/* Invoice Info */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <p className="text-sm text-gray-600">Invoice Number</p>
                <p className="text-lg font-bold text-gray-800">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Date</p>
                <p className="text-lg font-bold text-gray-800">{currentDate}</p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-8 p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600 mb-1">Bill To</p>
              <p className="text-lg font-semibold text-gray-800">{saleData.customer?.name || 'Walk-in Customer'}</p>
            </div>

            {/* Items Table */}
            <table className="w-full mb-8">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-3 text-gray-800">#</th>
                  <th className="text-left py-3 text-gray-800">Item Description</th>
                  <th className="text-right py-3 text-gray-800">Qty</th>
                  <th className="text-right py-3 text-gray-800">Price</th>
                  <th className="text-right py-3 text-gray-800">Amount</th>
                </tr>
              </thead>
              <tbody>
                {saleData.products.map((product, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-3 text-gray-700">{index + 1}</td>
                    <td className="py-3 text-gray-700">
                      {product.name}
                      {product.variation && <span className="text-sm text-gray-500"> - {product.variation}</span>}
                    </td>
                    <td className="text-right py-3 text-gray-700">{product.quantity}</td>
                    <td className="text-right py-3 text-gray-700">Rs. {product.price.toLocaleString()}</td>
                    <td className="text-right py-3 text-gray-700">Rs. {(product.quantity * product.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2 border-t-2 border-gray-800">
                  <span className="font-bold text-gray-800">TOTAL</span>
                  <span className="font-bold text-gray-800">Rs. {saleData.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-green-600">
                  <span className="font-semibold">Paid</span>
                  <span className="font-semibold">Rs. {saleData.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 bg-green-50 px-2 rounded">
                  <span className="font-bold text-green-700">Status</span>
                  <span className="font-bold text-green-700">PAID ✓</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-6 border-t border-gray-300">
              <p className="text-gray-600">Thank you for your business!</p>
              <p className="text-sm text-gray-500 mt-2">This is a computer-generated invoice.</p>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 w-full max-w-md mx-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#F9FAFB]">Select Print Type</h3>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-[#9CA3AF] hover:text-[#F9FAFB] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-[#9CA3AF] mb-6">
              Choose how you want to print this invoice:
            </p>
            <div className="space-y-3">
              <button
                onClick={handleTerminalPrint}
                className="w-full h-16 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] hover:from-[#2563EB] hover:to-[#1D4ED8] rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-3 text-white shadow-lg"
              >
                <Receipt className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-bold">Terminal Print</div>
                  <div className="text-xs opacity-90">Thermal receipt (80mm)</div>
                </div>
              </button>
              <button
                onClick={handleNormalPrint}
                className="w-full h-16 bg-[#374151] hover:bg-[#4B5563] border border-[#4B5563] rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-3 text-white"
              >
                <Printer className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-bold">Normal Print</div>
                  <div className="text-xs opacity-90">A4 invoice format</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Animation Area */}
      <div className="flex-1 flex items-center justify-center p-6 print-hide">
        <div className="text-center max-w-sm w-full">
          {/* Success Icon */}
          <div className="relative mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-[#10B981] to-[#059669] rounded-full flex items-center justify-center animate-scale-in">
              <CheckCircle2 className="w-14 h-14 text-white" strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 w-24 h-24 mx-auto bg-[#10B981]/20 rounded-full animate-ping"></div>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-bold text-[#F9FAFB] mb-2">
            Sale Posted Successfully!
          </h1>
          <p className="text-[#9CA3AF] mb-8">
            Payment has been recorded and accounting entries created
          </p>

          {/* Invoice Details */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 mb-6 text-left">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#374151]">
              <div className="w-12 h-12 bg-[#3B82F6]/10 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <div>
                <p className="text-xs text-[#9CA3AF]">Invoice Number</p>
                <p className="text-lg font-bold text-[#F9FAFB]">INV-0046</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Customer</span>
                <span className="text-[#F9FAFB] font-medium">{saleData.customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Amount</span>
                <span className="text-[#F9FAFB] font-semibold">
                  Rs. {saleData.total.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Paid</span>
                <span className="text-[#10B981] font-semibold">
                  Rs. {saleData.total.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9CA3AF]">Status</span>
                <span className="px-3 py-1 bg-[#10B981]/10 text-[#10B981] rounded-full text-xs font-semibold">
                  PAID ✓
                </span>
              </div>
            </div>
          </div>

          {/* Accounting Entries */}
          <div className="bg-gradient-to-br from-[#1F2937] to-[#111827] border border-[#374151] rounded-2xl p-6 mb-6">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              Posted to Accounting
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#10B981]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Cash Account debited</span>
              </div>
              <div className="flex items-center gap-2 text-[#10B981]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sales Revenue credited</span>
              </div>
              <div className="flex items-center gap-2 text-[#10B981]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Customer ledger updated</span>
              </div>
              <div className="flex items-center gap-2 text-[#10B981]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Inventory adjusted</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrint}
                className="h-12 bg-[#1F2937] border border-[#374151] hover:border-[#3B82F6] rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                onClick={handleShare}
                className="h-12 bg-[#1F2937] border border-[#374151] hover:border-[#3B82F6] rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>

            <button
              onClick={onNewSale}
              className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>New Sale</span>
            </button>

            <button
              onClick={onBackToHome}
              className="w-full h-12 border border-[#374151] hover:bg-[#374151] rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}