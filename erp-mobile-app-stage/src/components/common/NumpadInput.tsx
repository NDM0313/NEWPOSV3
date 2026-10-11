import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Delete, CornerDownLeft } from 'lucide-react';

const DEBOUNCE_MS = 80;

/**
 * Custom Numpad Input - Sirf numpad + Enter button
 * System keyboard hide karta hai (readOnly) aur apna clean numpad dikhata hai
 * No password/card/location icons - sirf numpad
 */
interface NumpadInputProps {
  value: number | string;
  onChange: (value: number) => void;
  onEnter?: () => void;
  /** Auto-open numpad on mount (e.g. after Add Piece from previous) */
  autoOpen?: boolean;
  placeholder?: string;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  className?: string;
  disabled?: boolean;
}

const getKeys = (allowDecimal: boolean) => [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  allowDecimal ? ['.', '0', 'back'] : ['0', 'back', ''],
];

function NumpadInputInner({
  value,
  onChange,
  onEnter,
  autoOpen = false,
  placeholder = '0',
  allowDecimal = true,
  min,
  max,
  className = '',
  disabled = false,
}: NumpadInputProps) {
  const [showNumpad, setShowNumpad] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (autoOpen) setShowNumpad(true);
  }, [autoOpen]);

  useEffect(() => {
    if (showNumpad && inputRef.current) {
      inputRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [showNumpad]);

  useEffect(() => {
    const v = value === '' || value === null || value === undefined ? '' : String(value);
    setLocalValue(v);
  }, [value]);

  useEffect(() => {
    if (!showNumpad) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        !target.closest('[data-numpad]')
      ) {
        setShowNumpad(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNumpad]);

  const flushAndNotify = useCallback((num: number) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onChangeRef.current(num);
  }, []);

  const handleKey = (key: string) => {
    if (disabled) return;
    let next = localValue;
    if (key === 'back') {
      next = next.slice(0, -1);
    } else if (key === '.') {
      if (!allowDecimal) return;
      if (next.includes('.')) return;
      next = next || '0';
      next += '.';
    } else {
      if (key === '0' && next === '0') return;
      if (key !== '0' && next === '0') next = '';
      next += key;
    }
    const num = parseFloat(next) || 0;
    if (min != null && num < min) return;
    if (max != null && num > max) return;
    setLocalValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onChangeRef.current(num);
    }, DEBOUNCE_MS);
  };

  const handleEnter = () => {
    const num = parseFloat(localValue) || 0;
    flushAndNotify(num);
    if (onEnter) {
      onEnter();
      setShowNumpad(false);
    } else {
      setShowNumpad(false);
    }
  };

  const displayVal = localValue === '' ? '' : localValue;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="none"
        readOnly
        data-skip-keyboard-patch="true"
        value={displayVal || ''}
        placeholder={placeholder}
        disabled={disabled}
        onClick={() => !disabled && setShowNumpad(true)}
        className={`w-full h-10 bg-[#1F2937] border border-[#374151] rounded-lg px-2 pr-8 text-sm text-[#F9FAFB] focus:outline-none focus:border-[#3B82F6] cursor-pointer ${showNumpad ? 'border-[#3B82F6]' : ''} ${className}`}
        style={{ caretColor: 'transparent' }}
        autoComplete="off"
      />

      {showNumpad &&
        createPortal(
          <div
            data-numpad
            className="fixed inset-x-0 bottom-0 z-[9999] bg-[#1F2937] border-t border-[#374151] p-4 pb-[env(safe-area-inset-bottom,0)] safe-area-bottom"
          >
          <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
            {getKeys(allowDecimal).map((row) =>
              row.map((key) =>
                key ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      key === 'back' ? handleKey('back') : handleKey(key)
                    }
                    className={`h-14 rounded-xl font-semibold text-lg flex items-center justify-center transition-colors ${
                      key === 'back'
                        ? 'bg-[#374151] text-[#EF4444] hover:bg-[#4B5563]'
                        : 'bg-[#111827] text-[#F9FAFB] hover:bg-[#374151] border border-[#374151]'
                    }`}
                  >
                    {key === 'back' ? (
                      <Delete className="w-5 h-5" />
                    ) : (
                      key
                    )}
                  </button>
                ) : (
                  <div key="empty" />
                )
              )
            )}
          </div>
          <button
            type="button"
            onClick={handleEnter}
            className="w-full max-w-sm mx-auto mt-3 h-14 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            <CornerDownLeft className="w-5 h-5" />
            Enter
          </button>
        </div>,
          document.body
        )}
    </div>
  );
}

export const NumpadInput = memo(NumpadInputInner);
