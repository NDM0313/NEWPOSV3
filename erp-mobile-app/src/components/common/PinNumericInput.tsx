import type { InputHTMLAttributes } from 'react';

export interface PinNumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'inputMode'> {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

/**
 * PIN / OTP field: opens numeric pad on Android/iOS (type=tel + inputMode=numeric).
 * type=password + inputMode=numeric is ignored by most mobile browsers → full QWERTY.
 */
export function PinNumericInput({
  value,
  onChange,
  maxLength = 6,
  className = '',
  autoComplete = 'one-time-code',
  enterKeyHint = 'next',
  ...rest
}: PinNumericInputProps) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={maxLength}
      autoComplete={autoComplete}
      enterKeyHint={enterKeyHint}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      data-input-numeric="true"
      data-skip-keyboard-patch="true"
      className={`pin-numeric-input ${className}`.trim()}
    />
  );
}
