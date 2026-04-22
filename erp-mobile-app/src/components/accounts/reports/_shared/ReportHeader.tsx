import type { ReactNode } from 'react';
import { ArrowLeft, Share2, RefreshCw } from 'lucide-react';

export interface ReportHeaderStat {
  label: string;
  value: string;
  color?: string;
}

export interface ReportHeaderProps {
  onBack: () => void;
  title: string;
  subtitle?: string;
  stats?: ReportHeaderStat[];
  onShare?: () => void;
  onRefresh?: () => void;
  sharing?: boolean;
  refreshing?: boolean;
  /** Optional extra controls rendered at the right of the top bar. */
  rightExtras?: ReactNode;
  /** Optional content rendered below the stats row (filters, search, etc.). */
  children?: ReactNode;
  gradient?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
}

const GRADIENTS: Record<NonNullable<ReportHeaderProps['gradient']>, string> = {
  indigo: 'from-[#6366F1] to-[#4F46E5]',
  emerald: 'from-[#10B981] to-[#059669]',
  rose: 'from-[#F43F5E] to-[#E11D48]',
  amber: 'from-[#F59E0B] to-[#D97706]',
  slate: 'from-[#475569] to-[#1E293B]',
};

/**
 * Sticky report header used by every accounts report so they share a single
 * visual language: gradient strip, back button, title/subtitle, optional
 * share & refresh actions, and a responsive stats row.
 */
export function ReportHeader(props: ReportHeaderProps) {
  const gradient = GRADIENTS[props.gradient ?? 'indigo'];
  return (
    <div className={`bg-gradient-to-br ${gradient} p-4 sticky top-0 z-10`}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={props.onBack}
          className="p-2 hover:bg-white/10 rounded-lg text-white"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white truncate">{props.title}</h1>
          {props.subtitle && <p className="text-xs text-white/80 truncate">{props.subtitle}</p>}
        </div>
        {props.rightExtras}
        {props.onRefresh && (
          <button
            onClick={props.onRefresh}
            className="p-2 hover:bg-white/10 rounded-lg text-white disabled:opacity-60"
            aria-label="Refresh"
            disabled={props.refreshing}
          >
            <RefreshCw className={`w-5 h-5 ${props.refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
        {props.onShare && (
          <button
            onClick={props.onShare}
            className="p-2 hover:bg-white/10 rounded-lg text-white disabled:opacity-60"
            aria-label="Share PDF"
            disabled={props.sharing}
          >
            <Share2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {props.stats && props.stats.length > 0 && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(props.stats.length, 4)}, minmax(0, 1fr))` }}
        >
          {props.stats.map((s) => (
            <div key={s.label} className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
              <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
                {s.label}
              </p>
              <p className={`text-sm font-bold ${s.color ?? 'text-white'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {props.children && <div className="mt-3">{props.children}</div>}
    </div>
  );
}
