import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from './utils';
import { motion, AnimatePresence } from 'motion/react';

export interface Variation {
  size?: string;
  color?: string;
  id?: string;
  label?: string; // Combined label like "M / Blue"
}

interface InlineVariationSelectorProps {
  productName: string;
  variations: Variation[];
  onSelect: (variation: Variation) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export const InlineVariationSelector: React.FC<InlineVariationSelectorProps> = ({
  productName,
  variations,
  onSelect,
  onCancel,
  autoFocus = true,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && itemRefs.current[0]) {
      itemRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIndex((prev) => {
            // Move to previous variation (with wrap around)
            return prev > 0 ? prev - 1 : variations.length - 1;
          });
          break;
        case 'ArrowRight':
          e.preventDefault();
          setSelectedIndex((prev) => {
            // Move to next variation (with wrap around)
            return (prev + 1) % variations.length;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => {
            // Move down one row in the 2-column grid (i.e., +2 positions)
            const nextIndex = prev + 2;
            return nextIndex < variations.length ? nextIndex : prev;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => {
            // Move up one row in the 2-column grid (i.e., -2 positions)
            const prevIndex = prev - 2;
            return prevIndex >= 0 ? prevIndex : prev;
          });
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(variations[selectedIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          onCancel?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, variations, onSelect, onCancel]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [selectedIndex]);

  const getVariationLabel = (variation: Variation): string => {
    if (variation.label) return variation.label;
    const parts = [];
    if (variation.size) parts.push(variation.size);
    if (variation.color) parts.push(variation.color);
    return parts.join(' / ') || 'Default';
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-gray-700 bg-gray-950/95 backdrop-blur-sm"
    >
      <div className="p-3">
        <div className="text-xs font-medium text-blue-400 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          Select Variation for "{productName}"
        </div>
        <div className="text-[10px] text-gray-500 mb-3">
          Use ↑↓←→ arrows and Enter, or click
        </div>
        
        <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
          {variations.map((variation, index) => (
            <button
              key={index}
              ref={(el) => (itemRefs.current[index] = el)}
              onClick={() => onSelect(variation)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'relative px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                'border text-sm font-medium',
                selectedIndex === index
                  ? 'bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-900/50 scale-105'
                  : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-blue-500/50 hover:bg-gray-800'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{getVariationLabel(variation)}</span>
                {selectedIndex === index && (
                  <Check size={14} className="shrink-0 animate-in zoom-in duration-200" />
                )}
              </div>
              {variation.size && variation.color && (
                <div className="flex gap-2 mt-1 text-[11px] text-gray-500">
                  <span>{variation.size}</span>
                  <span>·</span>
                  <span>{variation.color}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};