import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Delete, CornerDownLeft } from 'lucide-react';

/**
 * Custom Numpad Input - calculator layout + Enter for packing flow.
 * System keyboard hidden (readOnly); pointer-down for snappy mobile taps.
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

/** Calculator order: 7–9 on top, 1–3 near bottom */
const getKeys = (allowDecimal: boolean) => [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
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
  const localValueRef = useRef('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Ignore synthetic click that follows pointerdown on the same key */
  const suppressClickRef = useRef(false);

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
    localValueRef.current = v;
    setLocalValue(v);
  }, [value]);

  useEffect(() => {
    if (!showNumpad) return;
    const handlePointerOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        !target.closest('[data-numpad]')
      ) {
        setShowNumpad(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerOutside);
    return () => document.removeEventListener('pointerdown', handlePointerOutside);
  }, [showNumpad]);

  const flushAndNotify = useCallback((num: number) => {
    onChangeRef.current(num);
  }, []);

  const handleKey = useCallback(
    (key: string) => {
      if (disabled) return;
      let next = localValueRef.current;
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
      localValueRef.current = next;
      setLocalValue(next);
      onChangeRef.current(num);
    },
    [allowDecimal, disabled, max, min],
  );

  const handleEnter = useCallback(() => {
    const num = parseFloat(localValueRef.current) || 0;
    flushAndNotify(num);
    if (onEnter) onEnter();
    setShowNumpad(false);
  }, [flushAndNotify, onEnter]);

  const armClickSuppress = () => {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 350);
  };

  const onKeyPointerDown = (e: { button: number; preventDefault: () => void }, key: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    armClickSuppress();
    handleKey(key);
  };

  const onKeyClick = (e: { preventDefault: () => void }, key: string) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      return;
    }
    handleKey(key);
  };

  const onEnterPointerDown = (e: { button: number; preventDefault: () => void }) => {
    if (e.button !== 0) return;
    e.preventDefault();
    armClickSuppress();
    handleEnter();
  };

  const onEnterClick = (e: { preventDefault: () => void }) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      return;
    }
    handleEnter();
  };

  const displayVal = localValue === '' ? '' : localValue;
  const keyBtnClass =
    'h-14 rounded-xl font-semibold text-lg flex items-center justify-center select-none touch-manipulation transition-transform active:scale-[0.97]';

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
              {getKeys(allowDecimal).map((row, ri) =>
                row.map((key, ki) =>
                  key ? (
                    <button
                      key={`${ri}-${key}`}
                      type="button"
                      onPointerDown={(e) =>
                        onKeyPointerDown(e, key === 'back' ? 'back' : key)
                      }
                      onClick={(e) => onKeyClick(e, key === 'back' ? 'back' : key)}
                      className={`${keyBtnClass} ${
                        key === 'back'
                          ? 'bg-[#374151] text-[#EF4444] active:bg-[#4B5563]'
                          : 'bg-[#111827] text-[#F9FAFB] border border-[#374151] active:bg-[#374151]'
                      }`}
                    >
                      {key === 'back' ? <Delete className="w-5 h-5 pointer-events-none" /> : key}
                    </button>
                  ) : (
                    <div key={`${ri}-empty-${ki}`} />
                  ),
                ),
              )}
            </div>
            <button
              type="button"
              onPointerDown={onEnterPointerDown}
              onClick={onEnterClick}
              className={`w-full max-w-sm mx-auto mt-3 h-14 bg-[#3B82F6] active:bg-[#2563EB] text-white font-semibold rounded-xl flex items-center justify-center gap-2 select-none touch-manipulation transition-transform active:scale-[0.97]`}
            >
              <CornerDownLeft className="w-5 h-5 pointer-events-none" />
              Enter
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

export const NumpadInput = memo(NumpadInputInner);
