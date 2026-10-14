import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  /** When true, append an All option (value -1). */
  showAllOption?: boolean;
}

export const Pagination = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100, 200],
  showAllOption = false,
}: PaginationProps) => {
  const isAll = pageSize < 0;
  const safeTotalPages = isAll ? 1 : Math.max(1, totalPages || 1);
  const displayPage = isAll ? 1 : currentPage;
  const startItem = totalItems === 0 ? 0 : isAll ? 1 : (currentPage - 1) * pageSize + 1;
  const endItem = isAll ? totalItems : Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (safeTotalPages <= maxVisible) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', safeTotalPages);
      } else if (currentPage >= safeTotalPages - 2) {
        pages.push(1, '...', safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', safeTotalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-muted/40 border-t border-border">
      {/* Left: Items count + rows-per-page */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <div>
          Showing <span className="text-foreground font-semibold">{startItem}</span> to{' '}
          <span className="text-foreground font-semibold">{endItem}</span> of{' '}
          <span className="text-foreground font-semibold">{totalItems}</span>
          {totalItems > 0 ? (
            <>
              {' '}
              · Page <span className="text-foreground font-semibold">{displayPage}</span> of{' '}
              <span className="text-foreground font-semibold">{safeTotalPages}</span>
            </>
          ) : null}
        </div>
        <label className="flex items-center gap-2">
          <span className="whitespace-nowrap">Rows</span>
          <select
            value={isAll ? -1 : pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-popover px-2 text-foreground text-sm"
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
            {showAllOption ? (
              <option value={-1}>All</option>
            ) : null}
          </select>
        </label>
      </div>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={displayPage <= 1 || totalItems === 0 || isAll}
          className="h-8 w-8 p-0 bg-popover border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronsLeft size={16} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={displayPage <= 1 || totalItems === 0 || isAll}
          className="h-8 w-8 p-0 bg-popover border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </Button>

        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
            );
          }

          return (
            <Button
              key={`page-${page}`}
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page as number)}
              disabled={totalItems === 0 || isAll}
              className={cn(
                "h-8 min-w-[32px] px-2 bg-popover border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                displayPage === page && "bg-blue-600 border-blue-600 text-white hover:bg-blue-500"
              )}
            >
              {page}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={displayPage >= safeTotalPages || totalItems === 0 || isAll}
          className="h-8 w-8 p-0 bg-popover border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={displayPage >= safeTotalPages || totalItems === 0 || isAll}
          className="h-8 w-8 p-0 bg-popover border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronsRight size={16} />
        </Button>
      </div>
    </div>
  );
};
