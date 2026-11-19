import React, { useMemo, useState } from 'react';
import type { z } from 'zod';
import { AlertCircle, CheckCircle2, Download, Upload } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import {
  autoSuggestColumnMapping,
  buildDryRunPreview,
  chunkArray,
  exportRowsToXlsx,
  parseXlsxFile,
  type DryRunSummary,
  type ExcelColumnSpec,
} from '../lib/excel';
import type { TechnicianRow } from '../types/database.types';

interface ExcelModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  filenamePrefix: string;
  columns: ExcelColumnSpec[];
  filteredRows: Record<string, unknown>[];
  schema: z.ZodType<T>;
  technicians: TechnicianRow[];
  canImport: boolean;
  onBatchImport: (validRows: Record<string, unknown>[]) => Promise<number>;
}

export function ExcelModal<T>({
  open,
  onClose,
  title,
  filenamePrefix,
  columns,
  filteredRows,
  schema,
  technicians,
  canImport,
  onBatchImport,
}: ExcelModalProps<T>) {
  const { pushToast } = useToast();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dryRun, setDryRun] = useState<DryRunSummary<T> | null>(null);
  const [importing, setImporting] = useState(false);

  const techNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of technicians) {
      map.set(t.name.toLowerCase(), t.id);
    }
    return map;
  }, [technicians]);

  const techIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of technicians) {
      map.set(t.id, t.name);
    }
    return map;
  }, [technicians]);

  const handleExport = () => {
    const exportReady = filteredRows.map((r) => ({
      ...r,
      technician_in_charge:
        typeof r.technician_in_charge === 'string'
          ? techIdToName.get(r.technician_in_charge) ?? r.technician_in_charge
          : '',
    }));
    exportRowsToXlsx(
      `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      title,
      exportReady,
      columns
    );
    pushToast(`Exported ${exportReady.length} rows to Excel`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseXlsxFile(file);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMapping(autoSuggestColumnMapping(parsed.headers, columns));
      setDryRun(null);
    } catch (err) {
      pushToast((err as Error).message || 'Failed to read Excel file', 'error');
    }
  };

  const handleRunDryRun = () => {
    const result = buildDryRunPreview(rawRows, mapping, schema, techNameToId);
    setDryRun(result);
  };

  const handleConfirmImport = async () => {
    if (!dryRun || dryRun.validRows.length === 0) return;
    setImporting(true);
    try {
      const validObjects = dryRun.validRows.map(
        (r) => r.parsed as unknown as Record<string, unknown>
      );
      const chunks = chunkArray(validObjects, 50);
      let insertedTotal = 0;
      for (const chunk of chunks) {
        insertedTotal += await onBatchImport(chunk);
      }
      pushToast(`Imported ${insertedTotal} records into ${title}`);
      setHeaders([]);
      setRawRows([]);
      setDryRun(null);
      onClose();
    } catch (err) {
      pushToast((err as Error).message || 'Batch import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${title} — Excel Export & Import`}
      subtitle="Export current filtered view or import .xlsx spreadsheets with validation preview"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Export Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Export Current Table</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Downloads {filteredRows.length} filtered {filteredRows.length === 1 ? 'row' : 'rows'} as an .xlsx workbook.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .xlsx</span>
          </button>
        </div>

        {/* Import Block */}
        {canImport ? (
          <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Import from .xlsx</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a workbook, map columns, run a validation dry-run, then commit valid rows in batches.
              </p>
            </div>

            <label className="flex items-center justify-center gap-2 px-4 py-4 border border-dashed border-slate-300 rounded-md bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer text-xs font-medium text-slate-700">
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Choose .xlsx or .csv file to import</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            {headers.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-700">
                  Column Mapping ({rawRows.length} rows detected)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor={`map-${col.key}`} className="text-slate-700 font-medium truncate">
                        {col.label}
                        {col.required ? ' *' : ''}
                      </label>
                      <select
                        id={`map-${col.key}`}
                        value={mapping[col.key] ?? ''}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [col.key]: e.target.value }))
                        }
                        className="w-44 px-2 py-1 border border-slate-200 rounded bg-white text-slate-800"
                      >
                        <option value="">-- Skip --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRunDryRun}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200"
                  >
                    Run Dry-Run Validation
                  </button>
                </div>
              </div>
            )}

            {dryRun && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    {dryRun.validRows.length} valid rows ready
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-red-700 font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    {dryRun.invalidRows.length} rows with errors
                  </span>
                </div>

                {dryRun.invalidRows.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border border-red-200 bg-red-50/60 rounded p-2.5 space-y-1 text-xs text-red-800">
                    {dryRun.invalidRows.slice(0, 10).map((errRow) => (
                      <div key={errRow.rowIndex}>
                        Row {errRow.rowIndex}: {errRow.errors.join('; ')}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={dryRun.validRows.length === 0 || importing}
                    onClick={handleConfirmImport}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-40"
                  >
                    {importing
                      ? 'Importing...'
                      : `Commit ${dryRun.validRows.length} Valid Rows`}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Excel import is restricted to Technical and Admin roles.
          </p>
        )}
      </div>
    </Modal>
  );
}
