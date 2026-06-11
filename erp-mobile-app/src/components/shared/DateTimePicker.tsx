import { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import {
  inputHasTime,
  localNowDateString,
  localNowDateTimeString,
  toDateInputValue,
  toDateTimeInputValue,
  toLocalDateString,
} from '../../utils/localDate';

export interface DateInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Minimum date (YYYY-MM-DD or datetime-local) for native picker */
  min?: string;
  /** Maximum date (YYYY-MM-DD or datetime-local) for native picker */
  max?: string;
  /** When true, always uses datetime-local (legacy). Prefer enableTimeOption. */
  showTime?: boolean;
  /** When true, shows toggle to optionally capture time. Default true. */
  enableTimeOption?: boolean;
  /** @deprecated Native picker only; label shown on field, not in modal */
  pickerLabel?: string;
  /** Focus ring color token — rental flows use purple */
  accent?: 'default' | 'rental';
  /** Helper text below field */
  helperText?: string;
  /** Compact layout without outer label block (embed in parent card) */
  compact?: boolean;
}

const accentFocusClass: Record<NonNullable<DateInputFieldProps['accent']>, string> = {
  default: 'focus-within:border-[#3B82F6]',
  rental: 'focus-within:border-[#8B5CF6]',
};

function boundsForMode(timeEnabled: boolean, min?: string, max?: string): { min?: string; max?: string } {
  if (!min && !max) return {};
  if (timeEnabled) {
    return {
      min: min ? (inputHasTime(min) ? min : `${toLocalDateString(min)}T00:00`) : undefined,
      max: max ? (inputHasTime(max) ? max : `${toLocalDateString(max)}T23:59`) : undefined,
    };
  }
  return {
    min: min ? toLocalDateString(min) : undefined,
    max: max ? toLocalDateString(max) : undefined,
  };
}

/**
 * Standard date field: native OS picker inside dark ERP styling with optional time toggle.
 */
export function DateInputField({
  label,
  value,
  onChange,
  required = false,
  min,
  max,
  showTime = false,
  enableTimeOption = true,
  accent = 'default',
  helperText,
  compact = false,
}: DateInputFieldProps) {
  const forceTime = showTime || !enableTimeOption;
  const [timeEnabled, setTimeEnabled] = useState(() => forceTime || inputHasTime(value));

  useEffect(() => {
    if (forceTime) {
      setTimeEnabled(true);
      return;
    }
    if (inputHasTime(value)) setTimeEnabled(true);
  }, [value, forceTime]);

  const useDateTime = forceTime || (enableTimeOption && timeEnabled);
  const displayValue = useDateTime
    ? toDateTimeInputValue(value || localNowDateTimeString())
    : toDateInputValue(value || localNowDateString());
  const { min: inputMin, max: inputMax } = boundsForMode(useDateTime, min, max);

  const handleInputChange = (next: string) => {
    if (useDateTime) {
      onChange(next);
      return;
    }
    onChange(toLocalDateString(next));
  };

  const toggleTime = () => {
    if (forceTime || !enableTimeOption) return;
    const next = !timeEnabled;
    setTimeEnabled(next);
    if (next) {
      onChange(toDateTimeInputValue(value || localNowDateTimeString()));
    } else {
      onChange(toDateInputValue(value || localNowDateString()));
    }
  };

  const field = (
    <>
      <div
        className={`flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 ${compact ? 'py-2.5' : 'h-11'} transition-colors ${accentFocusClass[accent]}`}
      >
        <Calendar className="w-5 h-5 text-[#6B7280] shrink-0" aria-hidden />
        <input
          type={useDateTime ? 'datetime-local' : 'date'}
          value={displayValue}
          min={inputMin}
          max={inputMax}
          required={required}
          onChange={(e) => handleInputChange(e.target.value)}
          className="flex-1 min-w-0 w-full bg-transparent text-white text-sm outline-none [color-scheme:dark]"
        />
        {enableTimeOption && !forceTime ? (
          <button
            type="button"
            onClick={toggleTime}
            aria-pressed={timeEnabled}
            aria-label="Time set karein"
            title="Time set karein"
            className={`p-1.5 rounded-md shrink-0 transition-colors ${
              timeEnabled
                ? 'bg-[#3B82F6]/20 text-[#93C5FD] border border-[#3B82F6]/40'
                : 'text-[#6B7280] hover:text-[#9CA3AF] hover:bg-[#374151]/50'
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>
        ) : null}
      </div>
      {enableTimeOption && !forceTime ? (
        <p className="text-[10px] text-[#6B7280] mt-1">
          {timeEnabled ? 'Date aur time dono set ho sakte hain.' : 'Clock icon se time add karein.'}
        </p>
      ) : null}
      {helperText ? <p className="text-xs text-[#6B7280] mt-2">{helperText}</p> : null}
    </>
  );

  if (compact) {
    return <div className="min-w-0">{field}</div>;
  }

  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
        {label}
        {required ? <span className="text-[#EF4444] ml-0.5">*</span> : null}
      </label>
      {field}
    </div>
  );
}
