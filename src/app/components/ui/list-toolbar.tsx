import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Filter, Download, Upload, X, Columns3, FileText, 
  FileSpreadsheet, Printer, Check, ChevronUp, ChevronDown 
} from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';
import { CustomSelect } from './custom-select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { cn } from './utils';

// ============================================
// 🎯 TYPE DEFINITIONS
// ============================================

export interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export interface RowsSelectorConfig {
  value: number;
  onChange: (value: number) => void;
  totalItems: number;
  options?: number[]; // Default: [25, 50, 100, 500, 1000]
}

export interface ColumnConfig {
  key: string;
  label: string;
}

export interface ColumnsManagerConfig {
  columns: ColumnConfig[];
  visibleColumns: Record<string, boolean>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onMoveUp?: (key: string) => void;
  onMoveDown?: (key: string) => void;
}

export interface FilterConfig {
  isOpen: boolean;
  onToggle: () => void;
  activeCount: number;
  renderPanel: () => React.ReactNode;
}

export interface ImportConfig {
  onImport: () => void;
  supportedFormats?: string[]; // Default: ['Excel', 'CSV']
}

export interface ExportConfig {
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

export interface ListToolbarProps {
  // Required
  search: SearchConfig;
  rowsSelector: RowsSelectorConfig;
  
  // Optional (page-specific)
  columnsManager?: ColumnsManagerConfig;
  filter?: FilterConfig;
  importConfig?: ImportConfig;
  exportConfig?: ExportConfig;
  
  // Additional Actions (optional)
  primaryAction?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    className?: string;
  };
}

// ============================================
// 🎨 GLOBAL LIST TOOLBAR COMPONENT
// ============================================

export const ListToolbar: React.FC<ListToolbarProps> = ({
  search,
  rowsSelector,
  columnsManager,
  filter,
  importConfig,
  exportConfig,
  primaryAction,
}) => {
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const filterOnToggleRef = useRef(filter?.onToggle);
  filterOnToggleRef.current = filter?.onToggle;

  // Close filter when clicking outside (allows Import/Export buttons to receive clicks)
  // Use ref for onToggle so effect deps don't change every parent render (avoids max update depth)
  useEffect(() => {
    if (!filter?.isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        filterOnToggleRef.current?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filter?.isOpen]);

  // Close columns dropdown when clicking outside
  useEffect(() => {
    if (!columnVisibilityOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnVisibilityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [columnVisibilityOpen]);

  // Default rows options
  const rowsOptions = rowsSelector.options || [25, 50, 100, 500, 1000];

  return (
    <div className="shrink-0 px-6 py-3 bg-[#0B0F19] border-b border-gray-800 relative z-10">
      <div className="flex items-center gap-3">
        {/* ============================================ */}
        {/* LEFT SECTION - SEARCH (Full Width) */}
        {/* ============================================ */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            className="pl-10 bg-gray-900 border-gray-700 text-white h-10"
          />
          {search.value && (
            <button
              onClick={() => search.onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* ============================================ */}
        {/* MIDDLE SECTION - VIEW CONTROLS */}
        {/* ============================================ */}
        
        {/* Rows Per Page Selector */}
        <CustomSelect
          value={rowsSelector.value}
          onChange={rowsSelector.onChange}
          options={[
            ...rowsOptions.map(val => ({ value: val, label: String(val) })),
            { value: rowsSelector.totalItems, label: `All (${rowsSelector.totalItems})` },
          ]}
        />

        {/* Column Manager (Optional) */}
        {columnsManager && (
          <div ref={columnsRef} className="relative">
            <Button
              variant="outline"
              onClick={() => setColumnVisibilityOpen(!columnVisibilityOpen)}
              className="h-10 gap-2 bg-gray-900 border-gray-700"
            >
              <Columns3 size={16} />
              Columns
            </Button>

            {columnVisibilityOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 pointer-events-none" 
                  aria-hidden
                />
                
                <div className="absolute right-0 top-12 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Show Columns</h3>
                    <button
                      onClick={columnsManager.onShowAll}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Show All
                    </button>
                  </div>

                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {columnsManager.columns.map((column, index) => (
                      <div 
                        key={column.key} 
                        className="flex items-center gap-2 hover:bg-gray-800/50 p-2 rounded transition-colors group"
                      >
                        {/* Checkbox with Label */}
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={columnsManager.visibleColumns[column.key]}
                            onChange={() => columnsManager.onToggle(column.key)}
                            className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                          />
                          <span className="text-sm text-gray-300">{column.label}</span>
                        </label>

                        {/* Reorder Arrows (only show if onMoveUp/onMoveDown provided) */}
                        {columnsManager.onMoveUp && columnsManager.onMoveDown && (
                          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                columnsManager.onMoveUp?.(column.key);
                              }}
                              disabled={index === 0}
                              className="text-gray-500 hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                              title="Move Up"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                columnsManager.onMoveDown?.(column.key);
                              }}
                              disabled={index === columnsManager.columns.length - 1}
                              className="text-gray-500 hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                              title="Move Down"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* RIGHT SECTION - ACTION BUTTONS (FIXED ORDER) */}
        {/* ============================================ */}

        {/* 1. Filter Button */}
        {filter && (
          <div ref={filterRef} className="relative">
            <Button
              variant="outline"
              onClick={filter.onToggle}
              className={cn(
                "h-10 gap-2 bg-gray-900 border-gray-700",
                filter.activeCount > 0 && "border-blue-500 text-blue-400"
              )}
            >
              <Filter size={16} />
              Filter
              {filter.activeCount > 0 && (
                <Badge className="ml-1 bg-blue-600 text-white text-xs px-1.5 py-0 h-5 flex items-center justify-center min-w-[20px]">
                  {filter.activeCount}
                </Badge>
              )}
            </Button>

            {filter.isOpen && (
              <>
                {/* Backdrop: pointer-events-none so Import/Export buttons remain clickable */}
                <div 
                  className="fixed inset-0 z-40 pointer-events-none" 
                  aria-hidden
                />
                {filter.renderPanel()}
              </>
            )}
          </div>
        )}

        {/* 2. Import Button */}
        {importConfig && (
          <Button 
            type="button"
            variant="outline" 
            className="h-10 gap-2 bg-gray-900 border-gray-700 relative z-10"
            onClick={(e) => {
              e.stopPropagation();
              importConfig.onImport();
            }}
          >
            <Upload size={16} />
            Import
          </Button>
        )}

        {/* 3. Export Dropdown */}
        {exportConfig && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 bg-gray-900 border-gray-700">
                <Download size={16} />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white">
              <DropdownMenuItem 
                className="hover:bg-gray-800 cursor-pointer"
                onClick={exportConfig.onExportExcel}
              >
                <FileSpreadsheet size={14} className="mr-2 text-green-400" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="hover:bg-gray-800 cursor-pointer"
                onClick={exportConfig.onExportCSV}
              >
                <FileText size={14} className="mr-2 text-blue-400" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="hover:bg-gray-800 cursor-pointer"
                onClick={exportConfig.onExportPDF}
              >
                <FileText size={14} className="mr-2 text-red-400" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Primary Action (Optional - e.g., "Add Product") */}
        {primaryAction && (
          <Button 
            onClick={primaryAction.onClick}
            className={cn("h-10 gap-2", primaryAction.className || "bg-blue-600 hover:bg-blue-500 text-white")}
          >
            {primaryAction.icon}
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};