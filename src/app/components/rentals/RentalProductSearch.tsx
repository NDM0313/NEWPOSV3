import React, { useState } from 'react';
import { 
  Search, 
  CalendarOff,
  Box,
} from 'lucide-react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";
import { ProductImage } from "../products/ProductImage";

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

export function matchesRentalProductSearch(product: SearchProduct, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return (
    product.name.toLowerCase().includes(q) ||
    product.sku.toLowerCase().includes(q)
  );
}

interface RentalProductSearchProps {
  onSelect: (product: SearchProduct) => void;
  products: SearchProduct[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

export const RentalProductSearch = ({
  onSelect,
  products,
  searchTerm,
  onSearchTermChange,
}: RentalProductSearchProps) => {
  const [open, setOpen] = useState(false);

  const filteredProducts = products.filter((p) => matchesRentalProductSearch(p, searchTerm));

  const handleSelect = (product: SearchProduct) => {
    if (product.status === 'unavailable') return;
    onSelect(product);
    setOpen(false);
    onSearchTermChange(product.name);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input 
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search Bridal Dress (Name/SKU)..." 
            className="bg-card border-border pl-9 text-foreground focus:border-pink-500 h-9 w-full"
            onClick={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 bg-card border-border shadow-xl w-[400px]" 
        align="start"
        sideOffset={5}
      >
        <Command shouldFilter={false} className="bg-card text-foreground border-none rounded-lg overflow-hidden">
          <CommandInput 
            placeholder="Type to search..." 
            className="h-0 border-0 p-0 opacity-0 focus:ring-0"
            value={searchTerm}
            onValueChange={onSearchTermChange}
          /> 
          <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              No product found.
            </CommandEmpty>
            
            <CommandGroup heading="Search Results">
              {filteredProducts.map((product) => {
                const isUnavailable = product.status === 'unavailable';
                
                return (
                  <CommandItem
                    key={product.id}
                    value={`${product.name} ${product.sku}`}
                    onSelect={() => handleSelect(product)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors mb-1",
                      isUnavailable 
                        ? "opacity-50 cursor-not-allowed hover:bg-transparent" 
                        : "hover:bg-muted data-[selected=true]:bg-muted"
                    )}
                    disabled={isUnavailable}
                  >
                    {/* Image */}
                    <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 border border-border flex items-center justify-center">
                      {product.image ? (
                        <ProductImage src={product.image} alt="" className={cn("h-full w-full object-cover", isUnavailable && "grayscale")} />
                      ) : (
                        <Box className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         <h4 className={cn("text-sm font-medium text-foreground truncate", isUnavailable && "line-through text-muted-foreground")}>
                           {product.name}
                         </h4>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                    </div>

                    {/* Badges / Status */}
                    <div className="shrink-0">
                      {product.status === 'available' && (
                        <Badge className="bg-green-900/20 text-[var(--erp-money-positive)] border-green-900/50 hover:bg-green-900/30">
                          Rent: ${product.rentPrice?.toLocaleString() ?? "0"}
                        </Badge>
                      )}

                      {product.status === 'retail_only' && (
                        <div className="flex flex-col items-end gap-1">
                          <Badge className="bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/30">
                            Retail Stock
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">Click to set rent</span>
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
