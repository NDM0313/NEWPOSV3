import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal, 
  Search, 
  Filter,
  ArrowUpDown,
  Download,
  Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface SmartTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  searchPlaceholder?: string;
  onAdd?: () => void;
  onBulkAction?: (selectedIds: string[]) => void;
  renderMobileCard?: (item: T, isSelected: boolean, toggleSelection: () => void) => React.ReactNode;
  keyField: keyof T;
}

export function SmartTable<T extends { [key: string]: any }>({ 
  data, 
  columns, 
  title, 
  searchPlaceholder,
  onAdd, 
  onBulkAction,
  renderMobileCard,
  keyField
}: SmartTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => String(item[keyField])));
    }
  };

  return (
    <div className="space-y-4">
      {/* Container for Desktop: Combines Header + Table + Pagination */}
      <div 
        className="border rounded-xl overflow-hidden shadow-sm"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        {/* Header Actions - Modern Toolbar Style */}
        <div 
          className="p-4 border-b flex flex-col sm:flex-row gap-3 items-center justify-between"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            borderBottomOpacity: 0.5,
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
          <div className="relative w-full sm:max-w-md">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2" 
              size={16}
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <input 
              type="text" 
              placeholder={searchPlaceholder || "Search..."} 
              className="w-full h-10 border rounded-lg pl-10 pr-4 text-sm outline-none transition-all"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-text-secondary)'
              }}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              className="flex items-center gap-2 h-10 px-4 border rounded-lg transition-all text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              <Filter size={16} />
              <span>Filter</span>
            </button>
            
            <button 
              className="flex items-center gap-2 h-10 px-4 border rounded-lg transition-all text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              <Download size={16} />
              <span>Export</span>
            </button>
            
            {onAdd && (
              <button 
                onClick={onAdd}
                className="flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-medium transition-all shadow-lg whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-blue-glow)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                }}
              >
                <Plus size={18} />
                <span>Add New</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div 
          className="hidden md:block overflow-x-auto"
          style={{ backgroundColor: 'var(--color-bg-primary)' }}
        >
          <table className="w-full text-left border-collapse">
            <thead>
              <tr 
                className="border-b text-xs uppercase tracking-wider font-semibold"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderBottomColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                <th className="p-4 w-12 pl-6">
                  <input 
                    type="checkbox" 
                    className="rounded"
                    style={{
                      borderColor: 'var(--color-border-secondary)',
                      backgroundColor: 'var(--color-bg-card)',
                      accentColor: 'var(--color-primary)'
                    }}
                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                {columns.map((col) => (
                  <th 
                    key={String(col.key)} 
                    className="p-4 font-semibold select-none cursor-pointer transition-colors group"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-tertiary)';
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--color-border-primary)' }}>
              {filteredData.map((item) => {
                const isSelected = selectedIds.includes(String(item[keyField]));
                return (
                <tr 
                  key={String(item[keyField])} 
                  data-state={isSelected ? 'selected' : undefined}
                  className={clsx(
                    // Hover: CSS-only, activates on mouse pointer (NOT click)
                    "hover:bg-[var(--color-hover-bg)]",
                    // Selected: Separate from hover, activated by checkbox click
                    isSelected && "bg-[var(--color-selected-bg)] border-l-2 border-l-[var(--color-selected-border)]",
                    // Ensure hover and selected are distinct
                    isSelected && "hover:bg-[var(--color-selected-bg)]",
                    "transition-colors group cursor-pointer"
                  )}
                  onClick={(e) => {
                    // Only toggle on row click if checkbox wasn't clicked
                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                      toggleSelection(String(item[keyField]));
                    }
                  }}
                >
                  <td className="p-4 pl-6" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded border-[var(--color-border-primary)] bg-[var(--color-bg-panel)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                      checked={isSelected}
                      onChange={() => toggleSelection(String(item[keyField]))}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="p-4 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {col.render ? col.render(item) : String(item[col.key])}
                    </td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (Inside container, but separated) */}
        <div className="md:hidden p-4 space-y-4">
          {filteredData.map((item) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={String(item[keyField])}
            >
              {renderMobileCard ? renderMobileCard(
                item, 
                selectedIds.includes(String(item[keyField])),
                () => toggleSelection(String(item[keyField]))
              ) : (
                // Fallback simple card
                <div 
                  className="border p-4 rounded-xl flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                  <div>
                    <h3 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {String(item[columns[0].key])}
                    </h3>
                    <p 
                      className="text-sm"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {String(item[columns[1].key])}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Pagination */}
        <div 
          className="flex items-center justify-between p-4 border-t"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
          <span 
            className="text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Showing {filteredData.length} entries
          </span>
          <div className="flex gap-2">
            <button 
              className="p-2 border rounded-lg disabled:opacity-50 transition-colors"
              style={{
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-text-secondary)'
              }}
              disabled={currentPage === 1}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              className="p-2 border rounded-lg transition-colors"
              style={{
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)',
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
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
