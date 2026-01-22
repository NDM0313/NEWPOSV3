import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Plus, X, User } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';
import { Input } from './input';

export interface CustomerSearchOption {
  id: string;
  name: string;
  dueBalance?: number;
  [key: string]: any;
}

interface CustomerSearchV2Props {
  value: string;
  onValueChange: (value: string) => void;
  options: CustomerSearchOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  icon?: React.ReactNode;
  badgeColor?: 'red' | 'orange';
  // Add New functionality
  enableAddNew?: boolean;
  addNewLabel?: string;
  onAddNew?: (searchText?: string) => void;
  // For custom rendering
  renderOption?: (option: CustomerSearchOption) => React.ReactNode;
}

export const CustomerSearchV2: React.FC<CustomerSearchV2Props> = ({
  value,
  onValueChange,
  options,
  placeholder = 'Select customer...',
  emptyText = 'No results found.',
  className,
  icon,
  enableAddNew = false,
  addNewLabel = 'Add New',
  onAddNew,
  renderOption,
  badgeColor = 'orange',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  // Filter options based on search
  const filteredOptions = searchTerm
    ? options.filter((opt) =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const showAddNew = enableAddNew && searchTerm && filteredOptions.length === 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex].id);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredOptions, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (optionId: string) => {
    onValueChange(optionId);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleAddNew = () => {
    const currentSearch = searchTerm;
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.blur();
    onAddNew?.(currentSearch);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setHighlightedIndex(-1);
    if (!isOpen) setIsOpen(true);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('');
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Input Field */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
          {icon || <User size={14} className="text-gray-400" />}
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedOption?.name || ''}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={cn(
            'w-full pl-9 pr-20 bg-gray-950 border-gray-700 text-white h-10',
            isOpen && 'border-blue-500 ring-1 ring-blue-500/20'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronsUpDown
            size={14}
            className={cn(
              'text-gray-400 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
        {selectedOption && !isOpen && selectedOption.dueBalance && selectedOption.dueBalance > 0 && (
          <div
            className={cn(
              'absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium px-1.5 py-0.5 rounded',
              badgeColor === 'red'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-orange-500/20 text-orange-400'
            )}
          >
            Due: ${selectedOption.dueBalance.toLocaleString()}
          </div>
        )}
      </div>

      {/* Dropdown - Fixed Position, High Z-Index */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-[90] bg-gray-950 border border-gray-800 rounded-lg shadow-2xl overflow-hidden"
          style={{
            maxHeight: '280px',
          }}
        >
          {/* Search Results List */}
          <div
            ref={listRef}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: '240px' }}
            onWheel={(e) => {
              // Allow native scroll
              e.stopPropagation();
            }}
          >
            {filteredOptions.length === 0 && !showAddNew && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                {emptyText}
              </div>
            )}

            {filteredOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option.id)}
                className={cn(
                  'w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-gray-800 transition-colors',
                  value === option.id && 'bg-blue-500/10 border-l-2 border-blue-500',
                  highlightedIndex === index && 'bg-gray-800'
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === option.id ? 'opacity-100 text-blue-400' : 'opacity-0'
                    )}
                  />
                  <span className="truncate text-sm text-white">
                    {renderOption ? renderOption(option) : option.name}
                  </span>
                </div>
                {option.dueBalance && option.dueBalance > 0 && (
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded shrink-0',
                      badgeColor === 'red'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-orange-500/20 text-orange-400'
                    )}
                  >
                    ${option.dueBalance.toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Add New Button - Separate, Always Visible When Enabled */}
          {enableAddNew && (
            <div className="border-t border-gray-800 p-2 bg-gray-900/50">
              <button
                type="button"
                onClick={handleAddNew}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20"
              >
                <Plus size={16} />
                <span>{addNewLabel}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
