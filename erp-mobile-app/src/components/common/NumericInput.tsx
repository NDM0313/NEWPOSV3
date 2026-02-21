import { forwardRef, useCallback } from 'react';
import { getInputConfig, getEnterKeyHint } from '../../config/inputConfig';
import { getNumericPattern } from '../../utils/numericValidation';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode' | 'min' | 'max' | 'prefix'> {
  value: string | number;
  onChange: (value: string) => void;
  onEnterPress?: () => void;
  /** When true, Enter triggers form submit instead of focusNext */
  submitOnEnter?: boolean;
  label?: string;
  error?: string;
  /** Left prefix (e.g. "Rs.") */
  prefix?: React.ReactNode;
  /** Numeric validation options */
  allowDecimal?: boolean;
  allowNegative?: boolean;
  min?: number;
  max?: number;
  maxDecimals?: number;
}

const BASE_CLASS =
  'w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] text-base focus:outline-none focus:border-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed';
const BASE_CLASS_WITH_PREFIX = BASE_CLASS.replace('px-4', 'pl-12 pr-4');

/**
 * NumericInput – Opens NUMERIC KEYPAD on mobile
 * - inputMode: decimal (with decimals) or numeric (integers only)
 * - Validation: numbers only, decimals/negative per options
 * - Enter key: focusNext or submit (from global config or prop)
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  {
    value,
    onChange,
    onEnterPress,
    submitOnEnter,
    label,
    error,
    allowDecimal = false,
    allowNegative = false,
    min,
    max,
    maxDecimals,
    placeholder = '0',
    disabled = false,
    className = '',
    required = false,
    prefix,
    ...rest
  },
  ref
) {
  const config = getInputConfig();
  const pattern = getNumericPattern({ allowDecimal, allowNegative });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '' || val === '-') {
        onChange(val);
        return;
      }
      if (!pattern.test(val)) return;
      if (maxDecimals != null && allowDecimal) {
        const parts = val.split('.');
        if (parts[1] && parts[1].length > maxDecimals) return;
      }
      onChange(val);
    },
    [onChange, pattern, allowDecimal, maxDecimals]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const shouldSubmit = submitOnEnter ?? config.enterKeyBehavior === 'submit';
        if (shouldSubmit && onEnterPress) {
          onEnterPress();
        } else if (!shouldSubmit && onEnterPress) {
          onEnterPress();
        }
      }
    },
    [onEnterPress, submitOnEnter, config.enterKeyBehavior]
  );

  const displayValue = typeof value === 'number' ? (value === 0 && value !== 0 ? '' : String(value)) : value;
  const inputMode = allowDecimal ? 'decimal' : 'numeric';
  const enterKeyHint = getEnterKeyHint(config.enterKeyBehavior, submitOnEnter);

  const inputClass = `${prefix ? BASE_CLASS_WITH_PREFIX : BASE_CLASS} ${error ? 'border-[#EF4444]' : ''}`;

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[#9CA3AF] mb-2">
          {label} {required && <span className="text-[#EF4444]">*</span>}
        </label>
      )}
      <div className={prefix ? 'relative' : ''}>
        {prefix && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-[#9CA3AF] text-base">
            {prefix}
          </div>
        )}
        <input
        ref={ref}
        type="text"
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={inputClass}
        {...rest}
      />
      </div>
      {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
    </div>
  );
});
