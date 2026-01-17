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
          "fixed bottom-0 left-0 right-0 z-[70] border-t shadow-2xl rounded-t-2xl transition-transform duration-300 ease-out transform",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Header */}
        <div 
          className="p-4 border-b rounded-t-2xl flex flex-col items-center justify-center relative"
          style={{
            borderBottomColor: 'var(--color-border-secondary)',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-2xl)'
          }}
        >
           <button 
             onClick={onClose}
             className="absolute right-4 top-4"
             style={{ color: 'var(--color-text-tertiary)' }}
             onMouseEnter={(e) => {
               e.currentTarget.style.color = 'var(--color-text-primary)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.color = 'var(--color-text-tertiary)';
             }}
           >
             <X size={20} />
           </button>
           <span 
             className="text-sm uppercase tracking-wider font-semibold mb-1"
             style={{ color: 'var(--color-text-secondary)' }}
           >
             {label}
           </span>
           <div 
             className="text-4xl font-bold font-mono tracking-tight"
             style={{ 
               color: 'var(--color-primary)',
               textShadow: '0 0 10px rgba(59,130,246,0.5)'
             }}
           >
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
                className="w-full h-full rounded-xl flex items-center justify-center transition-all border"
                style={{
                  backgroundColor: 'rgba(153, 27, 27, 0.2)',
                  color: 'var(--color-error)',
                  borderColor: 'rgba(153, 27, 27, 0.3)',
                  borderRadius: 'var(--radius-xl)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(153, 27, 27, 0.4)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(153, 27, 27, 0.2)';
                }}
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
                className="w-full h-full rounded-xl flex flex-col items-center justify-center transition-all"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  e.currentTarget.style.opacity = '1';
                }}
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
    className="h-16 w-full text-2xl font-semibold rounded-xl transition-colors border"
    style={{
      backgroundColor: 'rgba(55, 65, 81, 1)',
      color: 'var(--color-text-primary)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
      borderColor: 'rgba(75, 85, 99, 0.3)'
    }}
    onMouseDown={(e) => {
      e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 1)';
    }}
    onMouseUp={(e) => {
      e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 1)';
    }}
  >
    {children}
  </button>
);
