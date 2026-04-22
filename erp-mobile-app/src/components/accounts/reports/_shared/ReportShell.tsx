import type { ReactNode } from 'react';
import { Loader2, FileSearch } from 'lucide-react';

export interface ReportShellProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  children?: ReactNode;
}

/** Standard content wrapper with loading / error / empty states. */
export function ReportShell({ loading, error, empty, emptyLabel, children }: ReportShellProps) {
  return (
    <div className="min-h-[calc(100vh-200px)] p-4 space-y-4">
      {error && !loading && (
        <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">
          {error}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-16 text-[#9CA3AF]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {!loading && !error && empty && (
        <div className="py-16 text-center">
          <FileSearch className="w-10 h-10 text-[#6B7280] mx-auto mb-3" />
          <p className="text-sm text-[#9CA3AF]">{emptyLabel ?? 'No records found.'}</p>
        </div>
      )}
      {!loading && !error && !empty && children}
    </div>
  );
}

export function ReportCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1F2937] border border-[#374151] rounded-xl ${className ?? ''}`}>{children}</div>
  );
}

export function ReportSectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <div className="min-w-0">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide truncate">{title}</h3>
        {subtitle && <p className="text-[11px] text-[#6B7280]">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 text-xs text-[#6B7280]">{right}</div>}
    </div>
  );
}
