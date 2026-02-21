import { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Loader2, MoreVertical, FileText, Printer, Share2, Download, X } from 'lucide-react';
import type { User } from '../../types';
import * as reportsApi from '../../api/reports';
import { DateRangeSelector } from './DateRangeSelector';

interface DayBookReportProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

const formatDate = (d: Date) => d.toISOString().split('T')[0];

export function DayBookReport({ onBack, user: _user, companyId, branchId }: DayBookReportProps) {
  const today = formatDate(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [entries, setEntries] = useState<reportsApi.DayBookEntry[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    if (!companyId || !dateFrom || !dateTo) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    reportsApi.getDayBookEntries(companyId, branchId, dateFrom, dateTo).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setEntries(error ? [] : data);
    });
    return () => { cancelled = true; };
  }, [companyId, branchId, dateFrom, dateTo]);

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleExportPDF = () => {
    setShowActions(false);
    window.print?.();
  };
  const handlePrint = () => {
    setShowActions(false);
    window.print?.();
  };
  const handleShare = () => {
    setShowActions(false);
    if (navigator.share) {
      navigator.share({
        title: `Roznamcha (Day Book) ${dateFrom} to ${dateTo}`,
        text: `Day Book Report: ${entries.length} entries, Dr: Rs. ${totalDebit.toLocaleString()}, Cr: Rs. ${totalCredit.toLocaleString()}`,
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Roznamcha (Day Book)</h1>
            <p className="text-xs text-[#9CA3AF]">{dateFrom} to {dateTo}</p>
          </div>
          <button
            onClick={() => setShowActions(true)}
            className="p-2 hover:bg-[#374151] rounded-lg text-white"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <DateRangeSelector
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-4">
              <div className="min-w-[720px] px-4">
                <div className="bg-[#1F2937] border border-[#374151] rounded-t-xl overflow-hidden">
                  <div className="grid grid-cols-[60px_72px_1fr_100px_80px_80px] gap-2 px-3 py-2.5 bg-[#374151]/50 text-[#9CA3AF] text-xs font-medium">
                    <span>Time</span>
                    <span>Voucher #</span>
                    <span>Account / Description</span>
                    <span className="text-right">Debit (₨)</span>
                    <span className="text-right">Credit (₨)</span>
                    <span>Type</span>
                  </div>
                  {entries.map((e, i) => (
                    <div
                      key={e.id}
                      className={`grid grid-cols-[60px_72px_1fr_100px_80px_80px] gap-2 px-3 py-2.5 border-t border-[#374151] text-sm ${
                        i % 2 === 0 ? 'bg-[#111827]' : 'bg-[#1F2937]/80'
                      }`}
                    >
                      <span className="text-white text-xs">{e.time}</span>
                      <span className="text-white font-mono text-xs truncate" title={e.voucher}>{e.voucher}</span>
                      <div className="min-w-0">
                        <p className="text-white text-xs truncate" title={e.account}>{e.account}</p>
                        {e.description && (
                          <p className="text-[#6B7280] text-[10px] truncate" title={e.description}>{e.description}</p>
                        )}
                      </div>
                      <span className="text-[#10B981] text-xs text-right font-mono">
                        {e.debit > 0 ? e.debit.toLocaleString() : '—'}
                      </span>
                      <span className="text-[#EF4444] text-xs text-right font-mono">
                        {e.credit > 0 ? e.credit.toLocaleString() : '—'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded truncate ${
                        e.type === 'Sale' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' :
                        e.type === 'Purchase' ? 'bg-[#10B981]/20 text-[#10B981]' :
                        e.type === 'Payment' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' :
                        e.type === 'Expense' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                        e.type === 'Rental' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                        'bg-[#6B7280]/20 text-[#9CA3AF]'
                      }`}>{e.type}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[60px_72px_1fr_100px_80px_80px] gap-2 px-3 py-3 bg-[#1F2937] border border-t-0 border-[#374151] rounded-b-xl font-bold text-white">
                  <span className="col-span-3">Totals</span>
                  <span className="text-[#10B981] text-right">₨ {totalDebit.toLocaleString()}</span>
                  <span className="text-[#EF4444] text-right">₨ {totalCredit.toLocaleString()}</span>
                  <span />
                </div>
              </div>
            </div>

            {isBalanced ? (
              <div className="p-3 bg-[#065F46]/30 border border-[#10B981]/30 rounded-xl">
                <p className="text-[#10B981] text-center text-sm font-medium">✓ Debit = Credit – Balanced Day Book</p>
              </div>
            ) : (
              <div className="p-3 bg-[#991B1B]/30 border border-[#EF4444]/30 rounded-xl">
                <p className="text-[#EF4444] text-center text-sm font-medium">
                  ⚠ Unbalanced! Difference: ₨ {Math.abs(totalDebit - totalCredit).toLocaleString()}
                </p>
              </div>
            )}
          </>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No transactions in this period</p>
          </div>
        )}
      </div>

      {showActions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center">
          <div className="bg-[#1F2937] rounded-t-3xl sm:rounded-2xl w-full max-w-md pb-6">
            <div className="flex justify-center pt-2 pb-4 sm:hidden">
              <div className="w-12 h-1 bg-[#374151] rounded-full" />
            </div>
            <div className="px-6 pb-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Report Actions</h2>
              <button onClick={() => setShowActions(false)} className="p-2 hover:bg-[#374151] rounded-lg">
                <X className="w-5 h-5 text-[#9CA3AF]" />
              </button>
            </div>
            <div className="px-6 pt-4 space-y-2">
              <button
                onClick={handleExportPDF}
                className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl hover:border-[#3B82F6] hover:bg-[#374151] flex items-center gap-4 px-4"
              >
                <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Export PDF</p>
                  <p className="text-xs text-[#9CA3AF]">Download report as PDF</p>
                </div>
                <Download className="w-4 h-4 text-[#9CA3AF]" />
              </button>
              <button
                onClick={handlePrint}
                className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl hover:border-[#10B981] hover:bg-[#374151] flex items-center gap-4 px-4"
              >
                <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                  <Printer className="w-5 h-5 text-[#10B981]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Print</p>
                  <p className="text-xs text-[#9CA3AF]">Print report</p>
                </div>
              </button>
              <button
                onClick={handleShare}
                className="w-full h-14 bg-[#111827] border border-[#374151] rounded-xl hover:border-[#F59E0B] hover:bg-[#374151] flex items-center gap-4 px-4"
              >
                <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Share</p>
                  <p className="text-xs text-[#9CA3AF]">Share via WhatsApp, Email</p>
                </div>
              </button>
            </div>
            <div className="px-6 pt-4">
              <button
                onClick={() => setShowActions(false)}
                className="w-full h-12 border border-[#374151] rounded-xl font-medium hover:bg-[#374151] text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
