import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildPageNumbers } from '../utils/tablePagination';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startDisplay: number;
  endDisplay: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  helperNote?: string;
  compact?: boolean;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  startDisplay,
  endDisplay,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'data',
  helperNote,
  compact = false,
  className = '',
}) => {
  if (totalItems === 0) {
    return null;
  }

  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  const selectId = React.useId();

  return (
    <div
      className={`border-t border-stone-200 bg-stone-50/70 ${
        compact ? 'px-4 py-3' : 'px-4 sm:px-5 py-3.5'
      } flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${className}`}
    >
      {/* Left: Range summary + rows per page */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
        <div className="tabular-nums">
          Menampilkan{' '}
          <strong className="font-semibold text-stone-900">
            {startDisplay}–{endDisplay}
          </strong>{' '}
          dari{' '}
          <strong className="font-semibold text-stone-900">{totalItems}</strong>{' '}
          {itemLabel}
        </div>

        <div className="inline-flex items-center gap-2">
          <label
            htmlFor={selectId}
            className="text-sm text-stone-600 whitespace-nowrap"
          >
            Per halaman:
          </label>
          <select
            id={selectId}
            aria-label={`Jumlah ${itemLabel} per halaman`}
            value={pageSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value) || pageSizeOptions[0];
              onPageSizeChange(nextSize);
            }}
            className="h-9 px-2.5 text-sm font-mono tabular-nums text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D] cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {helperNote && (
          <span className="text-xs text-stone-500">{helperNote}</span>
        )}
      </div>

      {/* Right: Previous / Page Numbers / Next */}
      <nav
        aria-label={`Navigasi halaman ${itemLabel}`}
        className="flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Halaman sebelumnya"
          className="inline-flex items-center gap-1 h-9 px-3 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-100 disabled:opacity-45 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <div className="inline-flex items-center gap-1">
          {pageNumbers.map((token, idx) =>
            token === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                aria-hidden="true"
                className="px-2 text-sm text-stone-400 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => onPageChange(token)}
                aria-label={`Halaman ${token}`}
                aria-current={token === currentPage ? 'page' : undefined}
                className={`min-w-[36px] h-9 px-2.5 text-sm font-mono tabular-nums rounded-md border transition-colors cursor-pointer ${
                  token === currentPage
                    ? 'bg-[#0F5C4D] text-white border-[#0F5C4D] font-semibold'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                {token}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          aria-label="Halaman berikutnya"
          className="inline-flex items-center gap-1 h-9 px-3 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-100 disabled:opacity-45 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </nav>
    </div>
  );
};
