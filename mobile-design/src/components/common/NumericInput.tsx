import { useRef, useEffect } from 'react';

interface NumericInputProps {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  onEnterPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

/**
 * GLOBAL NUMERIC INPUT COMPONENT
 * 
 * Features:
 * - Always opens NUMERIC KEYPAD (inputMode="decimal")
 * - Enter/Next button auto-focuses next field
 * - Consistent behavior across all modules
 * - Mobile-optimized with large touch targets
 * 
 * Usage:
 * <NumericInput 
 *   value={quantity} 
 *   onChange={setQuantity}
 *   onEnterPress={() => nextFieldRef.current?.focus()}
 * />
 */
export function NumericInput({
  label,
  value,
  onChange,
  onEnterPress,
  placeholder = '0',
  disabled = false,
  className = '',
  autoFocus = false,
  min,
  max,
  step = 1,
  required = false,
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onEnterPress) {
        onEnterPress();
      }
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs text-[#9CA3AF] mb-2">
          {label} {required && <span className="text-[#EF4444]">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal" // ✅ NUMERIC KEYPAD with ENTER button
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          // Allow only numbers and decimal point
          if (val === '' || /^\d*\.?\d*$/.test(val)) {
            onChange(val);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className="w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] text-base focus:outline-none focus:border-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
