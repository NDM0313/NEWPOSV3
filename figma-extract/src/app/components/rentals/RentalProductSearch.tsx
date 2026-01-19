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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search Bridal Dress (Name/SKU)..." 
            className="bg-gray-900 border-gray-700 pl-9 text-white focus:border-pink-500 h-9 w-full"
            onClick={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 bg-gray-900 border-gray-700 shadow-xl w-[400px]" 
        align="start"
        sideOffset={5}
      >
        <Command className="bg-gray-900 text-white border-none rounded-lg overflow-hidden">
          <CommandInput 
            placeholder="Type to search..." 
            className="h-0 border-0 p-0 opacity-0 focus:ring-0" // Hidden input to trap focus but use external trigger
            value={inputValue}
            onValueChange={setInputValue}
          /> 
          <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
            <CommandEmpty className="py-4 text-center text-sm text-gray-500">
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
                      isUnavailable 
                        ? "opacity-50 cursor-not-allowed hover:bg-transparent" 
                        : "hover:bg-gray-800 data-[selected=true]:bg-gray-800"
                    )}
                    disabled={isUnavailable}
                  >
                    {/* Image */}
                    <div className="h-10 w-10 rounded bg-gray-800 overflow-hidden shrink-0 border border-gray-700">
                      <img src={product.image} alt="" className={cn("h-full w-full object-cover", isUnavailable && "grayscale")} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         <h4 className={cn("text-sm font-medium text-white truncate", isUnavailable && "line-through text-gray-400")}>
                           {product.name}
                         </h4>
                      </div>
                      <p className="text-xs text-gray-500 font-mono">{product.sku}</p>
                    </div>

                    {/* Badges / Status */}
                    <div className="shrink-0">
                      {product.status === 'available' && (
                        <Badge className="bg-green-900/20 text-green-400 border-green-900/50 hover:bg-green-900/30">
                          Rent: ${product.rentPrice?.toLocaleString() ?? "0"}
                        </Badge>
                      )}

                      {product.status === 'retail_only' && (
                        <div className="flex flex-col items-end gap-1">
                          <Badge className="bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/30">
                            Retail Stock
                          </Badge>
                          <span className="text-[10px] text-gray-500">Click to set rent</span>
                        </div>
                      )}

                      {product.status === 'unavailable' && (
                        <Badge variant="outline" className="bg-red-900/10 text-red-500 border-red-900/30 hover:bg-red-900/20 flex items-center gap-1">
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
