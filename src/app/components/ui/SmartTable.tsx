import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter,
  ArrowUpDown,
  Download,
  Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import {
  ErpTable,
  ErpTableBody,
  ErpTableHead,
  ErpTableHeaderCell,
  ErpTableRow,
  ErpTableScroll,
  ErpTableShell,
} from './erp-surfaces';

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
      <ErpTableShell>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-center justify-between bg-card">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder={searchPlaceholder || "Search..."} 
              className="w-full h-10 bg-popover border border-border rounded-lg pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring/50 focus:border-ring outline-none transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex items-center gap-2 h-10 px-4 bg-popover border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-border transition-all text-sm font-medium">
              <Filter size={16} />
              <span>Filter</span>
            </button>
            
            <button className="flex items-center gap-2 h-10 px-4 bg-popover border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-border transition-all text-sm font-medium">
              <Download size={16} />
              <span>Export</span>
            </button>
            
            {onAdd && (
              <button 
                onClick={onAdd}
                className="flex items-center gap-2 h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
              >
                <Plus size={18} />
                <span>Add New</span>
              </button>
            )}
          </div>
        </div>

        <ErpTableScroll className="hidden md:block">
          <ErpTable className="text-left border-collapse">
            <ErpTableHead>
              <tr>
                <ErpTableHeaderCell className="w-12 pl-6">
                  <input 
                    type="checkbox" 
                    className="rounded border-border bg-muted text-primary focus:ring-ring/20"
                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                    onChange={toggleAll}
                  />
                </ErpTableHeaderCell>
                {columns.map((col) => (
                  <ErpTableHeaderCell key={String(col.key)} className="select-none cursor-pointer hover:text-foreground transition-colors group">
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                  </ErpTableHeaderCell>
                ))}
              </tr>
            </ErpTableHead>
            <ErpTableBody>
              {filteredData.map((item) => (
                <ErpTableRow 
                  key={String(item[keyField])} 
                  className={clsx(
                    selectedIds.includes(String(item[keyField])) && "bg-primary/5"
                  )}
                >
                  <td className="p-4 pl-6">
                    <input 
                      type="checkbox" 
                      className="rounded border-border bg-muted text-primary focus:ring-ring/20"
                      checked={selectedIds.includes(String(item[keyField]))}
                      onChange={() => toggleSelection(String(item[keyField]))}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="p-4 text-sm text-muted-foreground">
                      {col.render ? col.render(item) : String(item[col.key])}
                    </td>
                  ))}
                </ErpTableRow>
              ))}
            </ErpTableBody>
          </ErpTable>
        </ErpTableScroll>

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
                <div className="bg-muted border border-border p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="text-foreground font-medium">{String(item[columns[0].key])}</h3>
                    <p className="text-sm text-muted-foreground">{String(item[columns[1].key])}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border bg-card">
          <span className="text-sm text-muted-foreground">
            Showing {filteredData.length} entries
          </span>
          <div className="flex gap-2">
            <button 
              className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </ErpTableShell>
    </div>
  );
}
