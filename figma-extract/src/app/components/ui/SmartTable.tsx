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
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {/* Header Actions - Modern Toolbar Style */}
        <div className="p-4 border-b border-gray-800/50 flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#111827]">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder={searchPlaceholder || "Search..."} 
              className="w-full h-10 bg-[#0B1019] border border-gray-800 rounded-lg pl-10 pr-4 text-sm text-gray-300 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex items-center gap-2 h-10 px-4 bg-[#0B1019] border border-gray-800 rounded-lg text-gray-300 hover:text-white hover:border-gray-700 transition-all text-sm font-medium">
              <Filter size={16} />
              <span>Filter</span>
            </button>
            
            <button className="flex items-center gap-2 h-10 px-4 bg-[#0B1019] border border-gray-800 rounded-lg text-gray-300 hover:text-white hover:border-gray-700 transition-all text-sm font-medium">
              <Download size={16} />
              <span>Export</span>
            </button>
            
            {onAdd && (
              <button 
                onClick={onAdd}
                className="flex items-center gap-2 h-10 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20 whitespace-nowrap"
              >
                <Plus size={18} />
                <span>Add New</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto bg-[#111827]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 w-12 pl-6">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-700 bg-gray-900/50 text-blue-500 focus:ring-blue-500/20"
                    checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                {columns.map((col) => (
                  <th key={String(col.key)} className="p-4 font-semibold select-none cursor-pointer hover:text-white transition-colors group">
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredData.map((item) => (
                <tr 
                  key={String(item[keyField])} 
                  className={clsx(
                    "hover:bg-gray-800/30 transition-colors group",
                    selectedIds.includes(String(item[keyField])) && "bg-blue-900/5"
                  )}
                >
                  <td className="p-4 pl-6">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-700 bg-gray-900/50 text-blue-500 focus:ring-blue-500/20"
                      checked={selectedIds.includes(String(item[keyField]))}
                      onChange={() => toggleSelection(String(item[keyField]))}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="p-4 text-sm text-gray-300">
                      {col.render ? col.render(item) : String(item[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
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
                <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{String(item[columns[0].key])}</h3>
                    <p className="text-sm text-gray-500">{String(item[columns[1].key])}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800 bg-[#111827]">
          <span className="text-sm text-gray-500">
            Showing {filteredData.length} entries
          </span>
          <div className="flex gap-2">
            <button 
              className="p-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-50"
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
