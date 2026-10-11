import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface CustomSearchableOption {
  value: string;
  label: string;
  description?: string;
}

export interface CustomSearchableSheetProps {
  label?: string;
  sheetTitle?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Hint under the trigger (e.g. salary vs workers) */
  hint?: string;
  className?: string;
  zIndexClass?: string;
}

function matchesQuery(opt: CustomSearchableOption, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  const blob = `${opt.label} ${opt.description ?? ''}`.toLowerCase();
  return blob.includes(s);
}

/**
 * Searchable bottom-sheet picker — same visual language as CustomSelect / MobilePaymentSheet.
 */
export function CustomSearchableSheet({
  label,
  sheetTitle,
  value,
  onChange,
  options,
  placeholder = 'Search and select…',
  searchPlaceholder = 'Search…',
  required = false,
  disabled = false,
  hint,
  className = '',
  zIndexClass = 'z-[80]',
}: CustomSearchableSheetProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => options.filter((o) => matchesQuery(o, search)), [options, search]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

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
          {options.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No options</p>
          ) : (
            <>
              <p className={`text-sm font-medium leading-snug truncate ${selected ? 'text-white' : 'text-[#6B7280]'}`}>
                {selected ? selected.label : placeholder}
              </p>
              {selected?.description ? (
                <p className="text-xs text-[#9CA3AF] mt-0.5 leading-snug truncate">{selected.description}</p>
              ) : null}
            </>
          )}
        </div>
        <ChevronDown className="w-5 h-5 text-[#9CA3AF] shrink-0" />
      </button>
      {hint ? <p className="text-xs text-[#6B7280] mt-2 leading-relaxed">{hint}</p> : null}

      {open && options.length > 0 && (
        <div
          className={`fixed inset-0 ${zIndexClass} flex flex-col justify-end bg-black/60`}
          role="presentation"
          onClick={close}
        >
          <div
            className="bg-[#111827] rounded-t-2xl border-t border-[#374151] max-h-[min(78vh,32rem)] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151] shrink-0">
              <span className="text-sm font-semibold text-white">{sheetTitle ?? label ?? 'Select'}</span>
              <button
                type="button"
                onClick={close}
                className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pt-3 pb-2 shrink-0 border-b border-[#374151]/80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
                <input
                  type="search"
                  autoComplete="off"
                  autoCorrect="off"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#1F2937] border border-[#374151] text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain px-2 pb-4 pt-1 flex-1 min-h-0">
              {filtered.length === 0 ? (
                <p className="text-sm text-[#6B7280] text-center py-8">No matches</p>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
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
                      {opt.description ? (
                        <p className="text-xs text-[#9CA3AF] mt-0.5 leading-snug">{opt.description}</p>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
