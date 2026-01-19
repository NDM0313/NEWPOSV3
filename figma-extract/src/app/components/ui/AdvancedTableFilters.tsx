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
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-900 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-blue-400" />
            <span className="font-medium text-white">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                {activeFiltersCount} active
              </span>
            )}
          </div>
          {isFiltersOpen ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </button>

        {isFiltersOpen && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-800 bg-gray-950/30">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filters.map((filter) => (
                <div key={filter.key} className="space-y-2">
                  <label className="text-sm font-medium text-gray-400">
                    {filter.label}
                  </label>
                  
                  {filter.type === 'select' && (
                    <Select
                      value={filterValues[filter.key] || 'all'}
                      onValueChange={(value) => handleFilterChange(filter.key, value)}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-800 text-white">
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
                        className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-950"
                      />
                      <span className="text-sm text-gray-300">Enable</span>
                    </label>
                  )}
                </div>
              ))}
            </div>

            {activeFiltersCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
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
          <span className="text-sm text-gray-400">Show</span>
          <Select value={entriesCount.toString()} onValueChange={handleEntriesChange}>
            <SelectTrigger className="w-20 bg-gray-900 border-gray-800 text-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              {showEntriesOptions.map((count) => (
                <SelectItem key={count} value={count.toString()}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-400">entries</span>
        </div>

        {/* Right Side - Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport?.('csv')}
            className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800 h-9"
          >
            <Download size={14} className="mr-2" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport?.('excel')}
            className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800 h-9"
          >
            <FileSpreadsheet size={14} className="mr-2" />
            Export Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800 h-9"
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
                className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800 h-9"
              >
                <Eye size={14} className="mr-2" />
                Columns Visibility
              </Button>
            </PopoverTrigger>
            <PopoverContent className="bg-gray-900 border-gray-800 text-white w-64" align="end">
              <div className="space-y-1">
                <div className="px-3 py-2 border-b border-gray-800">
                  <h4 className="font-medium text-sm">Toggle Columns</h4>
                  <p className="text-xs text-gray-500 mt-1">Show or hide table columns</p>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {visibleColumns.map((column) => (
                    <label
                      key={column.key}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={column.visible}
                        onChange={() => handleColumnToggle(column.key)}
                        className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                      />
                      <span className="text-sm text-gray-300">{column.label}</span>
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
            className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800 h-9"
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
              className="pl-9 bg-gray-900 border-gray-800 text-white h-9 w-64"
            />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};