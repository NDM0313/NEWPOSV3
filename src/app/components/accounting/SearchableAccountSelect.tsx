'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command';
import { cn } from '@/app/components/ui/utils';

export type SearchableAccountOption = {
  id: string;
  name: string;
  code?: string | null;
};

export interface SearchableAccountSelectProps {
  accounts: SearchableAccountOption[];
  value: string;
  onChange: (accountId: string) => void;
  formatOptionLabel: (account: SearchableAccountOption) => string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
}

export function SearchableAccountSelect({
  accounts,
  value,
  onChange,
  formatOptionLabel,
  placeholder = 'Select account',
  disabled = false,
  className,
  emptyLabel = 'No account found.',
  searchPlaceholder = 'Search account...',
}: SearchableAccountSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(() => accounts.find((a) => a.id === value) ?? null, [accounts, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      const label = formatOptionLabel(a).toLowerCase();
      const code = String(a.code ?? '').toLowerCase();
      const name = String(a.name ?? '').toLowerCase();
      return label.includes(q) || code.includes(q) || name.includes(q) || a.id.toLowerCase().includes(q);
    });
  }, [accounts, search, formatOptionLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full h-auto min-h-[2.75rem] justify-between font-normal bg-card border-2 border-border rounded-lg px-4 py-2.5 text-foreground hover:bg-card hover:text-foreground',
            className,
          )}
        >
          {selected ? (
            <span className="truncate text-left">{formatOptionLabel(selected)}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 bg-card border-border text-foreground"
        align="start"
      >
        <Command shouldFilter={false} className="bg-card text-foreground">
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9 border-none focus:ring-0 text-foreground"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {filtered.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.code ?? ''} ${a.name} ${a.id}`}
                  onSelect={() => {
                    onChange(a.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="text-foreground hover:bg-muted cursor-pointer"
                >
                  <Check
                    className={cn('mr-2 h-4 w-4 shrink-0', value === a.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{formatOptionLabel(a)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
