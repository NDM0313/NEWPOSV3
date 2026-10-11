import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function SettingsRow({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  onClick,
  right,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  right?: React.ReactNode;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between hover:border-[#3B82F6] transition-colors text-left ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-white">{title}</p>
          {subtitle && <p className="text-sm text-[#9CA3AF] truncate">{subtitle}</p>}
        </div>
      </div>
      {right ?? (onClick ? <ChevronRight className="w-5 h-5 text-[#6B7280] shrink-0" /> : null)}
    </Comp>
  );
}

export function SettingsCollapsible({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#374151] rounded-xl overflow-hidden bg-[#1F2937]/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#1F2937] transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white text-sm">{title}</p>
          {subtitle && <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#374151] text-[#9CA3AF]">{badge}</span>
          ) : null}
          {open ? (
            <ChevronDown className="w-5 h-5 text-[#6B7280]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[#6B7280]" />
          )}
        </div>
      </button>
      {open ? <div className="px-4 pb-4 space-y-2 border-t border-[#374151]">{children}</div> : null}
    </div>
  );
}
