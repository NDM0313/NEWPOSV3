import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './utils';

interface Option {
  value: number | string;
  label: string;
}

interface CustomSelectProps {
  value: number | string;
  onChange: (value: number) => void;
  options: Option[];
}

export const CustomSelect = ({ value, onChange, options }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue: number | string) => {
    onChange(typeof optionValue === 'string' ? parseInt(optionValue) : optionValue);
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 120,
        width: Math.max(rect.width, 100),
      });
    }
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 h-10 text-white text-sm font-semibold hover:bg-gray-850 transition-colors"
      >
        {selectedOption?.label}
        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Panel - Portal to body to avoid overflow clipping */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div
            className="fixed min-w-[100px] bg-[#1e293b] border border-gray-700 rounded-lg shadow-2xl py-1 z-[9999]"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors",
                  value === option.value
                    ? "bg-gray-700/50 text-white font-semibold"
                    : "text-gray-300 hover:bg-gray-700/30"
                )}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check size={14} className="text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
