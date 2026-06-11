import { Calendar } from 'lucide-react';

export interface DateInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Minimum date (YYYY-MM-DD) for native picker */
  min?: string;
  /** Maximum date (YYYY-MM-DD) for native picker */
  max?: string;
  /** When true, uses datetime-local (no modal). */
  showTime?: boolean;
  /** @deprecated Native picker only; label shown on field, not in modal */
  pickerLabel?: string;
  /** Focus ring color token — rental flows use purple */
  accent?: 'default' | 'rental';
}

const accentFocusClass: Record<NonNullable<DateInputFieldProps['accent']>, string> = {
  default: 'focus-within:border-[#3B82F6]',
  rental: 'focus-within:border-[#8B5CF6]',
};

/**
 * Standard date field: native OS/date picker inside dark ERP styling (no wheel modal).
 */
export function DateInputField({
  label,
  value,
  onChange,
  required = false,
  min,
  max,
  showTime = false,
  accent = 'default',
}: DateInputFieldProps) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
        {label}
        {required ? <span className="text-[#EF4444] ml-0.5">*</span> : null}
      </label>
      <div
        className={`flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 h-11 transition-colors ${accentFocusClass[accent]}`}
      >
        <Calendar className="w-5 h-5 text-[#6B7280] shrink-0" aria-hidden />
        <input
          type={showTime ? 'datetime-local' : 'date'}
          value={value}
          min={min}
          max={max}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 w-full bg-transparent text-white text-sm outline-none [color-scheme:dark]"
        />
      </div>
    </div>
  );
}
