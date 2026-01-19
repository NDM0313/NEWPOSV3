import React, { useState } from 'react';
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
  
  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue: number | string) => {
    onChange(typeof optionValue === 'string' ? parseInt(optionValue) : optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 h-10 text-white text-sm font-semibold hover:bg-gray-850 transition-colors"
      >
        {selectedOption?.label}
        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Options Menu */}
          <div className="absolute right-0 top-11 min-w-[100px] bg-[#1e293b] border border-gray-700 rounded-lg shadow-2xl py-1 z-50">
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
        </>
      )}
    </div>
  );
};
