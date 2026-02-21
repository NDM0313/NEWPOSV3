import { forwardRef, useCallback } from 'react';
import { getInputConfig, getEnterKeyHint } from '../../config/inputConfig';

export type TextInputType = 'text' | 'tel' | 'email' | 'password';

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'prefix'> {
  value: string;
  onChange: (value: string) => void;
  onEnterPress?: () => void;
  /** When true, Enter triggers form submit instead of focusNext */
  submitOnEnter?: boolean;
  label?: string;
  error?: string;
  type?: TextInputType;
  multiline?: boolean;
  rows?: number;
  /** Optional regex to restrict input (e.g. CNIC: /^[\d-]*$/) */
  allowedPattern?: RegExp;
  /** Left icon (e.g. Search) - adds pl-11 */
  prefix?: React.ReactNode;
}

const BASE_INPUT_CLASS =
  'w-full px-4 bg-[#1F2937] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] text-base focus:outline-none focus:border-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * TextInput – Opens appropriate keyboard
 * - text: alphabet keyboard
 * - tel: numeric keypad (phone)
 * - email: email keyboard
 * - password: password keyboard
 */
export const TextInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextInputProps>(function TextInput(
  {
    value,
    onChange,
    onEnterPress,
    submitOnEnter,
    label,
    error,
    type = 'text',
    multiline = false,
    rows = 3,
    placeholder = '',
    disabled = false,
    className = '',
    required = false,
    allowedPattern,
    prefix,
    ...rest
  },
  ref
) {
  const config = getInputConfig();
  const enterKeyHint = getEnterKeyHint(config.enterKeyBehavior, submitOnEnter);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      if (!allowedPattern) {
        onChange(val);
        return;
      }
      if (allowedPattern.test(val) || val === '') {
        onChange(val);
      }
    },
    [onChange, allowedPattern]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        if (onEnterPress) onEnterPress();
      }
    },
    [onEnterPress, multiline]
  );

  const inputMode = type === 'tel' ? 'tel' : type === 'email' ? 'email' : 'text';

  const inputClasses = `${BASE_INPUT_CLASS} ${prefix ? 'pl-11' : ''} ${multiline ? 'py-3' : 'h-12'} ${error ? 'border-[#EF4444]' : ''}`;

  return (
    <div className={`${className} ${prefix ? 'relative' : ''}`}>
      {prefix && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-[#6B7280]">
          {prefix}
        </div>
      )}
      {label && (
        <label className="block text-xs font-medium text-[#9CA3AF] mb-2">
          {label} {required && <span className="text-[#EF4444]">*</span>}
        </label>
      )}
      {multiline ? (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={inputClasses}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          type={type}
          inputMode={type === 'password' ? undefined : inputMode}
          enterKeyHint={enterKeyHint}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
          {...rest}
        />
      )}
      {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
    </div>
  );
});
