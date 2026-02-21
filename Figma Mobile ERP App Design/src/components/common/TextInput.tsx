import { useRef, useEffect } from 'react';

interface TextInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onEnterPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'tel' | 'email';
}

/**
 * GLOBAL TEXT INPUT COMPONENT
 * 
 * Features:
 * - Always opens ALPHABET KEYBOARD (inputMode="text")
 * - For phone: inputMode="tel"
 * - For email: inputMode="email"
 * - Enter button behavior customizable
 * - Consistent styling across all modules
 * 
 * Usage:
 * <TextInput 
 *   value={customerName} 
 *   onChange={setCustomerName}
 *   placeholder="Enter customer name"
 * />
 */
export function TextInput({
  label,
  value,
  onChange,
  onEnterPress,
  placeholder = '',
  disabled = false,
  className = '',
  autoFocus = false,
  required = false,
  multiline = false,
  rows = 3,
  type = 'text',
}: TextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [autoFocus, multiline]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      if (onEnterPress) {
        onEnterPress();
      }
    }
  };

  const getInputMode = () => {
    if (type === 'tel') return 'tel';
    if (type === 'email') return 'email';
    return 'text';
  };

  const baseInputClasses = "w-full px-4 bg-[#1F2937] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] text-base focus:outline-none focus:border-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs text-[#9CA3AF] mb-2">
          {label} {required && <span className="text-[#EF4444]">*</span>}
        </label>
      )}
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`${baseInputClasses} py-3`}
        />
      ) : (
        <input
          ref={inputRef}
          type={type}
          inputMode={getInputMode()} // ✅ ALPHABET KEYBOARD
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`${baseInputClasses} h-12`}
        />
      )}
    </div>
  );
}
