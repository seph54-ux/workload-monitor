import React, { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '../lib/table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { DeadlineStatus } from '../lib/dates';
import { getRowHighlightClass } from './DeadlineBadge';
import type { TechnicianRow } from '../types/database.types';

export interface DataTableFilterOption {
  label: string;
  value: string;
}

interface DataTableProps<T extends { id: string }> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: ColumnDef<T, unknown>[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  technicians?: TechnicianRow[];
  getTechnicianId?: (row: T) => string | null;
  getDeadlineStatusForRow?: (row: T) => DeadlineStatus;
  statusFilterOptions?: DataTableFilterOption[];
  getStatusValue?: (row: T) => string;
  canCreate?: boolean;
  createLabel?: string;
  onCreate?: () => void;
  onOpenExcel?: (filteredRows: T[]) => void;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbarExtra?: React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  title,
  subtitle,
  data,
  columns,
  isLoading,
  error,
  onRetry,
  technicians = [],
  getTechnicianId,
  getDeadlineStatusForRow,
  statusFilterOptions,
  getStatusValue,
  canCreate = false,
  createLabel = 'Add Record',
  onCreate,
  onOpenExcel,
  searchPlaceholder = 'Search RSQDF, customer, model...',
  emptyTitle = 'No records yet',
  emptyDescription = 'Add a new request or import an existing Excel sheet to begin tracking.',
  toolbarExtra,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [techFilter, setTechFilter] = useState<string>('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (techFilter !== 'ALL' && getTechnicianId) {
        if (getTechnicianId(row) !== techFilter) return false;
      }
      if (deadlineFilter !== 'ALL' && getDeadlineStatusForRow) {
        if (getDeadlineStatusForRow(row) !== deadlineFilter) return false;
      }
      if (statusFilter !== 'ALL' && getStatusValue) {
        if (getStatusValue(row) !== statusFilter) return false;
      }
      return true;
    });
  }, [data, techFilter, deadlineFilter, statusFilter, getTechnicianId, getDeadlineStatusForRow, getStatusValue]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 15 },
    },
  });

  const visibleFilteredRows = table.getFilteredRowModel().rows.map((r) => r.original);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {toolbarExtra}
          {onOpenExcel && (
            <button
              type="button"
              onClick={() => onOpenExcel(visibleFilteredRows)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Excel Import / Export</span>
            </button>
          )}
          {canCreate && onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{createLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>

        {getTechnicianId && technicians.length > 0 && (
          <select
            aria-label="Filter by Technician"
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {getDeadlineStatusForRow && (
          <select
            aria-label="Filter by Deadline State"
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="due_soon">Due Within 2 Days</option>
            <option value="open">On Track</option>
            <option value="done">Done</option>
          </select>
        )}

        {statusFilterOptions && getStatusValue && (
          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Statuses</option>
            {statusFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        <div className="text-xs text-slate-500 font-mono tabular-nums ml-auto px-1">
          {visibleFilteredRows.length} {visibleFilteredRows.length === 1 ? 'row' : 'rows'}
        </div>
      </div>

      {/* Table Surface */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2.5" aria-busy="true" aria-label="Loading records">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-10 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-medium text-red-700">
              Failed to load records: {error.message}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        ) : visibleFilteredRows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Download className="w-7 h-7 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900">{emptyTitle}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{emptyDescription}</p>
            {canCreate && onCreate && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onCreate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{createLabel}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                      {hg.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        const sorted = header.column.getIsSorted();
                        const isActions = header.column.id === 'actions';
                        return (
                          <th
                            key={header.id}
                            className={`px-2.5 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap select-none ${
                              isActions
                                ? 'sticky right-0 z-10 bg-slate-50 border-l border-slate-200'
                                : ''
                            }`}
                          >
                            {header.isPlaceholder ? null : canSort ? (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                {sorted === 'asc' ? (
                                  <ArrowUp className="w-3 h-3 text-blue-700" />
                                ) : sorted === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-blue-700" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            ) : (
                              flexRender(header.column.columnDef.header, header.getContext())
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-[13px]">
                  {table.getRowModel().rows.map((row) => {
                    const dlStatus = getDeadlineStatusForRow
                      ? getDeadlineStatusForRow(row.original)
                      : 'none';
                    const rowBg = getRowHighlightClass(dlStatus);
                    const stickyBg =
                      dlStatus === 'overdue'
                        ? 'bg-red-50'
                        : dlStatus === 'due_soon'
                        ? 'bg-amber-50'
                        : dlStatus === 'done'
                        ? 'bg-emerald-50'
                        : 'bg-white';
                    return (
                      <tr key={row.id} className={`${rowBg} transition-colors`}>
                        {row.getVisibleCells().map((cell) => {
                          const isActions = cell.column.id === 'actions';
                          return (
                            <td
                              key={cell.id}
                              className={`px-2.5 py-2 text-slate-700 align-middle ${
                                isActions
                                  ? `sticky right-0 z-10 ${stickyBg} border-l border-slate-200/80`
                                  : ''
                              }`}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
              <div className="font-mono tabular-nums">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {Math.max(1, table.getPageCount())}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Previous page"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Next page"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
