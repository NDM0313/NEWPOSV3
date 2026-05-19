import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  /** Secondary line (e.g. balance, code) */
  subtitle?: string;
}

export interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Shown when value is empty */
  emptyLabel?: string;
  className?: string;
  /** z-index for sheet overlay (default 80) */
  zIndexClass?: string;
}

/**
 * Theme-native picker: no `<select>` — avoids Samsung/WebView native styling.
 */
export function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  required = false,
  disabled = false,
  emptyLabel,
  className = '',
  zIndexClass = 'z-[80]',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const displayPrimary = selected?.label ?? (value ? value : emptyLabel ?? placeholder);
  const displaySecondary = selected?.subtitle;

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[#9CA3AF] mb-2">
          {label} {required && <span className="text-[#EF4444]">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => !disabled && options.length > 0 && setOpen(true)}
        className="w-full min-h-[3rem] px-4 py-2.5 rounded-xl bg-[#111827] border border-[#374151] text-left flex items-center justify-between gap-3 disabled:opacity-50 disabled:pointer-events-none active:bg-[#1F2937] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/40"
      >
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug truncate ${selected || value ? 'text-white' : 'text-[#6B7280]'}`}>
            {displayPrimary}
          </p>
          {displaySecondary ? (
            <p className="text-xs text-[#9CA3AF] mt-0.5 leading-snug truncate">{displaySecondary}</p>
          ) : null}
        </div>
        <ChevronDown className="w-5 h-5 text-[#9CA3AF] shrink-0" />
      </button>

      {open && (
        <div
          className={`fixed inset-0 ${zIndexClass} flex flex-col justify-end bg-black/60`}
          role="presentation"
          onClick={close}
        >
          <div
            className="bg-[#111827] rounded-t-2xl border-t border-[#374151] max-h-[min(70vh,28rem)] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151] shrink-0">
              <span className="text-sm font-semibold text-white">{label || 'Select'}</span>
              <button
                type="button"
                onClick={close}
                className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-2 pb-4 pt-1">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value === '' ? '__empty' : opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      close();
                    }}
                    className={`w-full text-left rounded-xl px-3 py-2.5 mb-1.5 border transition-colors ${
                      isSelected
                        ? 'border-[#3B82F6] bg-[#1E3A5F]/40 ring-1 ring-[#3B82F6]/50'
                        : 'border-[#374151] bg-[#1F2937] hover:border-[#4B5563]'
                    }`}
                  >
                    <p className="text-sm font-medium text-white leading-snug">{opt.label}</p>
                    {opt.subtitle ? (
                      <p className="text-xs text-[#9CA3AF] mt-0.5 leading-snug">{opt.subtitle}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
