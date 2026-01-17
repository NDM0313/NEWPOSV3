import React, { useState } from 'react';
import { 
  Search, 
  Tag, 
  CalendarOff,
  Box,
  BadgeAlert
} from 'lucide-react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";

export interface SearchProduct {
  id: string | number;
  name: string;
  sku: string;
  image: string;
  // UI Logic Status
  status: 'available' | 'retail_only' | 'unavailable';
  rentPrice: number | null;
  retailPrice: number;
  unavailableReason?: string;
  // Extra fields for context
  category?: string;
  brand?: string;
  securityDeposit?: number | null;
}

interface RentalProductSearchProps {
  onSelect: (product: SearchProduct) => void;
  products: SearchProduct[];
}

export const RentalProductSearch = ({ onSelect, products }: RentalProductSearchProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSelect = (product: SearchProduct) => {
    if (product.status === 'unavailable') return;
    onSelect(product);
    setOpen(false);
    setInputValue(product.name);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2" 
            size={14}
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search Bridal Dress (Name/SKU)..." 
            className="pl-9 focus:border-pink-500 h-9 w-full"
            onClick={() => setOpen(true)}
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-primary)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border-secondary)';
            }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 shadow-xl w-[400px]" 
        align="start"
        sideOffset={5}
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-secondary)'
        }}
      >
        <Command
          style={{
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)'
          }}
          className="border-none rounded-lg overflow-hidden"
        >
          <CommandInput 
            placeholder="Type to search..." 
            className="h-0 border-0 p-0 opacity-0 focus:ring-0"
            value={inputValue}
            onValueChange={setInputValue}
          /> 
          <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
            <CommandEmpty 
              className="py-4 text-center text-sm"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              No product found.
            </CommandEmpty>
            
            <CommandGroup heading="Search Results">
              {products.filter(p => p.name.toLowerCase().includes(inputValue.toLowerCase()) || p.sku.toLowerCase().includes(inputValue.toLowerCase())).map((product) => {
                const isUnavailable = product.status === 'unavailable';
                
                return (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => handleSelect(product)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors mb-1",
                      isUnavailable && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                      backgroundColor: isUnavailable 
                        ? 'transparent' 
                        : undefined
                    }}
                    onMouseEnter={(e) => {
                      if (!isUnavailable) {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isUnavailable) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    disabled={isUnavailable}
                  >
                    {/* Image */}
                    <div 
                      className="h-10 w-10 rounded overflow-hidden shrink-0 border"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <img src={product.image} alt="" className={cn("h-full w-full object-cover", isUnavailable && "grayscale")} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         <h4 
                           className={cn("text-sm font-medium truncate", isUnavailable && "line-through")}
                           style={{ 
                             color: isUnavailable 
                               ? 'var(--color-text-secondary)' 
                               : 'var(--color-text-primary)' 
                           }}
                         >
                           {product.name}
                         </h4>
                      </div>
                      <p 
                        className="text-xs font-mono"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {product.sku}
                      </p>
                    </div>

                    {/* Badges / Status */}
                    <div className="shrink-0">
                      {product.status === 'available' && (
                        <Badge
                          style={{
                            backgroundColor: 'rgba(5, 150, 105, 0.2)',
                            color: 'var(--color-success)',
                            borderColor: 'rgba(5, 150, 105, 0.5)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.2)';
                          }}
                        >
                          Rent: ${product.rentPrice?.toLocaleString() ?? "0"}
                        </Badge>
                      )}

                      {product.status === 'retail_only' && (
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            style={{
                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                              color: 'var(--color-primary)',
                              borderColor: 'rgba(59, 130, 246, 0.5)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                            }}
                          >
                            Retail Stock
                          </Badge>
                          <span 
                            className="text-[10px]"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Click to set rent
                          </span>
                        </div>
                      )}

                      {product.status === 'unavailable' && (
                        <Badge 
                          variant="outline"
                          className="flex items-center gap-1"
                          style={{
                            backgroundColor: 'rgba(127, 29, 29, 0.1)',
                            color: 'var(--color-error)',
                            borderColor: 'rgba(127, 29, 29, 0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.1)';
                          }}
                        >
                          <CalendarOff size={10} />
                          {product.unavailableReason || 'Unavailable'}
                        </Badge>
                      )}
                    </div>

                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
