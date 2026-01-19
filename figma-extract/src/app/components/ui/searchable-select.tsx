import React, { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';

export interface SearchableSelectOption {
  id: string;
  name: string;
  [key: string]: any;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  icon?: React.ReactNode;
  // Add New functionality
  enableAddNew?: boolean;
  addNewLabel?: string; // e.g., "Add New Supplier"
  onAddNew?: () => void;
  // For custom rendering
  renderOption?: (option: SearchableSelectOption) => React.ReactNode;
  // For filtering search
  filterFn?: (option: SearchableSelectOption, search: string) => boolean;
  // Badge color for due balance (customer=red, supplier=orange)
  badgeColor?: 'red' | 'orange';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder = 'Select item...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  className,
  icon,
  enableAddNew = false,
  addNewLabel = 'Add New',
  onAddNew,
  renderOption,
  filterFn,
  badgeColor = 'orange',
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedOption = options.find((opt) => opt.id === value);

  // Filter options based on search
  const filteredOptions = searchTerm
    ? options.filter((opt) =>
        filterFn
          ? filterFn(opt, searchTerm)
          : opt.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const showAddNew = enableAddNew && searchTerm && filteredOptions.length === 0;

  const handleAddNew = () => {
    setOpen(false);
    setSearchTerm('');
    onAddNew?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between bg-gray-950 border-gray-700 text-white hover:bg-gray-900 h-10',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            {icon}
            <span className="truncate text-sm font-medium">
              {selectedOption ? selectedOption.name : placeholder}
            </span>
            {selectedOption && selectedOption.dueBalance > 0 && (
              <span
                className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded ml-1 shrink-0',
                  badgeColor === 'red'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-orange-500/20 text-orange-400'
                )}
              >
                Due: ${selectedOption.dueBalance.toLocaleString()}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-gray-950 border-gray-800 text-white">
        <Command className="bg-gray-950 text-white">
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {!showAddNew && filteredOptions.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            
            {showAddNew && (
              <div className="p-2">
                <button
                  onClick={handleAddNew}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20"
                >
                  <Plus size={16} className="shrink-0" />
                  <span>{addNewLabel}</span>
                </button>
              </div>
            )}

            {filteredOptions.length > 0 && (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => {
                      onValueChange(option.id);
                      setOpen(false);
                      setSearchTerm('');
                    }}
                    className="text-white hover:bg-gray-800 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {renderOption ? renderOption(option) : option.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};