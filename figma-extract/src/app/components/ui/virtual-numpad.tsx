import React, { useEffect, useState } from 'react';
import { Delete, Check, X } from 'lucide-react';
import { cn } from './utils';

interface VirtualNumpadProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  initialValue?: string;
  label: string;
}

export const VirtualNumpad = ({
  isOpen,
  onClose,
  onSubmit,
  initialValue = "",
  label
}: VirtualNumpadProps) => {
  const [value, setValue] = useState(initialValue);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Small delay to allow for mounting before sliding in
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, initialValue]);

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setValue(prev => prev.slice(0, -1));
    } else if (key === 'decimal') {
      if (!value.includes('.')) {
        setValue(prev => (prev === '' ? '0.' : prev + '.'));
      }
    } else {
      // Prevent multiple leading zeros
      if (value === '0' && key === '0') return;
      if (value === '0' && key !== '0' && key !== 'decimal') {
          setValue(key);
          return;
      }
      setValue(prev => prev + key);
    }
  };

  const handleSubmit = () => {
    onSubmit(value);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Numpad Sheet */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[70] bg-[#1F2937] border-t border-gray-700 shadow-2xl rounded-t-2xl transition-transform duration-300 ease-out transform",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 bg-[#111827] rounded-t-2xl flex flex-col items-center justify-center relative">
           <button 
             onClick={onClose}
             className="absolute right-4 top-4 text-gray-500 hover:text-white"
           >
             <X size={20} />
           </button>
           <span className="text-gray-400 text-sm uppercase tracking-wider font-semibold mb-1">{label}</span>
           <div className="text-4xl font-bold text-blue-400 font-mono tracking-tight drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
             {value ? Number(value).toLocaleString() : '0'}
             {value.endsWith('.') ? '.' : ''}
           </div>
        </div>

        {/* Grid */}
        <div className="p-4 grid grid-cols-4 gap-3 max-w-md mx-auto">
           {['1', '2', '3'].map(num => (
              <NumpadButton key={num} onClick={() => handleKeyPress(num)}>{num}</NumpadButton>
           ))}
           <div className="row-span-2">
              <button 
                onClick={() => handleKeyPress('backspace')}
                className="w-full h-full bg-red-900/20 active:bg-red-900/40 text-red-500 border border-red-900/30 rounded-xl flex items-center justify-center transition-all"
              >
                 <Delete size={28} />
              </button>
           </div>

           {['4', '5', '6'].map(num => (
              <NumpadButton key={num} onClick={() => handleKeyPress(num)}>{num}</NumpadButton>
           ))}

           {['7', '8', '9'].map(num => (
              <NumpadButton key={num} onClick={() => handleKeyPress(num)}>{num}</NumpadButton>
           ))}
           <div className="row-span-2">
              <button 
                onClick={handleSubmit}
                className="w-full h-full bg-blue-600 active:bg-blue-700 text-white rounded-xl flex flex-col items-center justify-center transition-all shadow-lg shadow-blue-600/20"
              >
                 <Check size={32} />
                 <span className="text-xs font-bold mt-1">DONE</span>
              </button>
           </div>

           <NumpadButton onClick={() => handleKeyPress('decimal')}>.</NumpadButton>
           <NumpadButton onClick={() => handleKeyPress('0')}>0</NumpadButton>
           <NumpadButton onClick={() => handleKeyPress('00')}>00</NumpadButton>
        </div>
      </div>
    </>
  );
};

const NumpadButton = ({ children, onClick }: { children: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="h-16 w-full bg-[#374151] active:bg-[#4B5563] text-white text-2xl font-semibold rounded-xl transition-colors shadow-lg shadow-black/20 border border-gray-600/30"
  >
    {children}
  </button>
);
