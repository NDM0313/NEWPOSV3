import { useState } from 'react';
import { MoreVertical, FileText, Printer, Share2, Download, X } from 'lucide-react';

interface ReportActionsProps {
  onExportPDF: () => void;
  onPrint: () => void;
  onShare: () => void;
}

export function ReportActions({ onExportPDF, onPrint, onShare }: ReportActionsProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setShowMenu(false);
  };

  return (
    <>
      {/* Action Button */}
      <button
        onClick={() => setShowMenu(true)}
        className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
      >
        <MoreVertical className="w-5 h-5 text-white" />
      </button>

      {/* Action Menu Modal */}
      {showMenu && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center">
          <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md pb-6">
            {/* Drag Handle (Mobile) */}
            <div className="flex justify-center pt-2 pb-4 sm:hidden">
              <div className="w-12 h-1 bg-[#374151] rounded-full"></div>
            </div>

            {/* Header */}
            <div className="px-6 pb-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Report Actions</h2>
              <button
                onClick={() => setShowMenu(false)}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
              >
                <X className="w-5 h-5 text-[#9CA3AF]" />
              </button>
            </div>

            {/* Action Options */}
            <div className="px-6 pt-4 space-y-2">
              {/* Export PDF */}
              <button
                onClick={() => handleAction(onExportPDF)}
                className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl hover:border-[#3B82F6] hover:bg-[#374151] transition-all active:scale-[0.98] flex items-center gap-4 px-4"
              >
                <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Export PDF</p>
                  <p className="text-xs text-[#9CA3AF]">Download report as PDF file</p>
                </div>
                <Download className="w-4 h-4 text-[#9CA3AF]" />
              </button>

              {/* Print */}
              <button
                onClick={() => handleAction(onPrint)}
                className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl hover:border-[#10B981] hover:bg-[#374151] transition-all active:scale-[0.98] flex items-center gap-4 px-4"
              >
                <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                  <Printer className="w-5 h-5 text-[#10B981]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Print</p>
                  <p className="text-xs text-[#9CA3AF]">Print report via mobile printer</p>
                </div>
              </button>

              {/* Share */}
              <button
                onClick={() => handleAction(onShare)}
                className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl hover:border-[#F59E0B] hover:bg-[#374151] transition-all active:scale-[0.98] flex items-center gap-4 px-4"
              >
                <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Share</p>
                  <p className="text-xs text-[#9CA3AF]">Share via WhatsApp, Email, etc.</p>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="px-6 pt-4">
              <button
                onClick={() => setShowMenu(false)}
                className="w-full h-12 border border-[#374151] rounded-xl font-medium hover:bg-[#374151] transition-colors text-white active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
