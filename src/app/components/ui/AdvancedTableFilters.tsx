import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, Printer, Eye, FileText, Filter, X } from 'lucide-react';
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "./utils";
import { CalendarDateRangePicker } from "./CalendarDateRangePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

interface FilterConfig {
  label: string;
  key: string;
  type: 'select' | 'daterange' | 'checkbox';
  options?: { value: string; label: string }[];
}

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface AdvancedTableFiltersProps {
  filters: FilterConfig[];
  columns: ColumnConfig[];
  onFilterChange?: (filters: any) => void;
  onColumnVisibilityChange?: (columns: ColumnConfig[]) => void;
  onExport?: (type: 'csv' | 'excel' | 'pdf') => void;
  onPrint?: () => void;
  showEntriesOptions?: number[];
  defaultEntries?: number;
  onEntriesChange?: (count: number) => void;
}

export const AdvancedTableFilters: React.FC<AdvancedTableFiltersProps> = ({
  filters,
  columns,
  onFilterChange,
  onColumnVisibilityChange,
  onExport,
  onPrint,
  showEntriesOptions = [10, 25, 50, 100],
  defaultEntries = 50,
  onEntriesChange,
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [visibleColumns, setVisibleColumns] = useState<ColumnConfig[]>(columns);
  const [entriesCount, setEntriesCount] = useState(defaultEntries);
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleClearFilters = () => {
    setFilterValues({});
    onFilterChange?.({});
  };

  const handleColumnToggle = (key: string) => {
    const updated = visibleColumns.map(col => 
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    setVisibleColumns(updated);
    onColumnVisibilityChange?.(updated);
  };

  const handleEntriesChange = (value: string) => {
    const count = parseInt(value);
    setEntriesCount(count);
    onEntriesChange?.(count);
  };

  const activeFiltersCount = Object.values(filterValues).filter(v => v && v !== 'all').length;

  return (
    <div className="space-y-4">
      {/* Collapsible Filters Panel */}
      <div 
        className="border rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="w-full px-6 py-4 flex items-center justify-between transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div className="flex items-center gap-3">
            <Filter size={18} style={{ color: 'var(--color-primary)' }} />
            <span 
              className="font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Filters
            </span>
            {activeFiltersCount > 0 && (
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  color: 'var(--color-primary)',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                {activeFiltersCount} active
              </span>
            )}
          </div>
          {isFiltersOpen ? (
            <ChevronUp size={18} style={{ color: 'var(--color-text-secondary)' }} />
          ) : (
            <ChevronDown size={18} style={{ color: 'var(--color-text-secondary)' }} />
          )}
        </button>

        {isFiltersOpen && (
          <div 
            className="px-6 pb-6 pt-2 border-t"
            style={{
              borderColor: 'var(--color-border-primary)',
              backgroundColor: 'rgba(3, 7, 18, 0.3)'
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filters.map((filter) => (
                <div key={filter.key} className="space-y-2">
                  <label 
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {filter.label}
                  </label>
                  
                  {filter.type === 'select' && (
                    <Select
                      value={filterValues[filter.key] || 'all'}
                      onValueChange={(value) => handleFilterChange(filter.key, value)}
                    >
                      <SelectTrigger
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <SelectItem value="all">All</SelectItem>
                        {filter.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {filter.type === 'daterange' && (
                    <CalendarDateRangePicker
                      value={{
                        from: filterValues[`${filter.key}_from`],
                        to: filterValues[`${filter.key}_to`]
                      }}
                      onChange={(range) => {
                        handleFilterChange(`${filter.key}_from`, range.from);
                        handleFilterChange(`${filter.key}_to`, range.to);
                      }}
                      placeholder="Select date range"
                    />
                  )}

                  {filter.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterValues[filter.key] || false}
                        onChange={(e) => handleFilterChange(filter.key, e.target.checked)}
                        className="w-4 h-4 rounded"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-primary)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      />
                      <span 
                        className="text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Enable
                      </span>
                    </label>
                  )}
                </div>
              ))}
            </div>

            {activeFiltersCount > 0 && (
              <div 
                className="mt-4 pt-4 border-t flex justify-end"
                style={{ borderColor: 'var(--color-border-primary)' }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  style={{
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={14} className="mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table Controls Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Side - Show Entries */}
        <div className="flex items-center gap-2">
          <span 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Show
          </span>
          <Select value={entriesCount.toString()} onValueChange={handleEntriesChange}>
            <SelectTrigger 
              className="w-20 h-9"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              {showEntriesOptions.map((count) => (
                <SelectItem key={count} value={count.toString()}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            entries
          </span>
        </div>

        {/* Right Side - Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport?.('csv')}
            className="h-9"
            style={{
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Download size={14} className="mr-2" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport?.('excel')}
            className="h-9"
            style={{
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FileSpreadsheet size={14} className="mr-2" />
            Export Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="h-9"
            style={{
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Printer size={14} className="mr-2" />
            Print
          </Button>

          {/* Column Visibility Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                style={{
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Eye size={14} className="mr-2" />
                Columns Visibility
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-64" 
              align="end"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <div className="space-y-1">
                <div 
                  className="px-3 py-2 border-b"
                  style={{ borderColor: 'var(--color-border-primary)' }}
                >
                  <h4 
                    className="font-medium text-sm"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Toggle Columns
                  </h4>
                  <p 
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Show or hide table columns
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {visibleColumns.map((column) => (
                    <label
                      key={column.key}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={column.visible}
                        onChange={() => handleColumnToggle(column.key)}
                        className="w-4 h-4 rounded"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-primary)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      />
                      <span 
                        className="text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {column.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport?.('pdf')}
            className="h-9"
            style={{
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FileText size={14} className="mr-2" />
            Export PDF
          </Button>

          {/* Search Box */}
          <div className="relative">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-64"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
            <Filter 
              className="absolute left-3 top-1/2 -translate-y-1/2" 
              size={14}
              style={{ color: 'var(--color-text-tertiary)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};