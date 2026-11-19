import * as XLSX from 'xlsx';
import type { z } from 'zod';

export interface ExcelColumnSpec {
  key: string;
  label: string;
  required?: boolean;
}

export interface DryRunRowResult<T> {
  rowIndex: number;
  raw: Record<string, unknown>;
  parsed: T | null;
  errors: string[];
}

export interface DryRunSummary<T> {
  totalRows: number;
  validRows: DryRunRowResult<T>[];
  invalidRows: DryRunRowResult<T>[];
}

export function exportRowsToXlsx(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  columns: ExcelColumnSpec[]
): void {
  const formatted = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      out[col.label] = row[col.key] ?? '';
    }
    return out;
  });

  const worksheet = XLSX.utils.json_to_sheet(formatted);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export async function parseXlsxFile(file: File): Promise<{
  headers: string[];
  rows: Record<string, unknown>[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return { headers: [], rows: [] };
  }
  const sheet = workbook.Sheets[firstSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  const headerSet = new Set<string>();
  for (const r of rawRows) {
    for (const k of Object.keys(r)) headerSet.add(k);
  }
  return {
    headers: Array.from(headerSet),
    rows: rawRows,
  };
}

export function autoSuggestColumnMapping(
  headers: string[],
  targetColumns: ExcelColumnSpec[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const target of targetColumns) {
    const normKey = normalize(target.key);
    const normLabel = normalize(target.label);
    const match = headers.find((h) => {
      const nh = normalize(h);
      return nh === normKey || nh === normLabel || nh.includes(normLabel) || normLabel.includes(nh);
    });
    if (match) {
      mapping[target.key] = match;
    }
  }
  return mapping;
}

export function buildDryRunPreview<T>(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, string>,
  schema: z.ZodType<T>,
  technicianNameToId: Map<string, string>
): DryRunSummary<T> {
  const validRows: DryRunRowResult<T>[] = [];
  const invalidRows: DryRunRowResult<T>[] = [];

  rawRows.forEach((raw, idx) => {
    const mappedObj: Record<string, unknown> = {};
    for (const [targetKey, sourceHeader] of Object.entries(mapping)) {
      if (!sourceHeader) continue;
      let val: unknown = raw[sourceHeader];
      if (typeof val === 'string') val = val.trim();

      if (targetKey === 'technician_in_charge' && typeof val === 'string' && val.length > 0) {
        const matchedTechId = technicianNameToId.get(val.toLowerCase());
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        val = matchedTechId ?? (isUuid ? val : null);
      }

      if (targetKey === 'requires_tooling' || targetKey === 'requires_md_revision') {
        const s = String(val).toLowerCase();
        val = s === 'true' || s === 'yes' || s === '1';
      }

      mappedObj[targetKey] = val;
    }

    const res = schema.safeParse(mappedObj);
    if (res.success) {
      validRows.push({ rowIndex: idx + 1, raw, parsed: res.data, errors: [] });
    } else {
      invalidRows.push({
        rowIndex: idx + 1,
        raw,
        parsed: null,
        errors: res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
  });

  return {
    totalRows: rawRows.length,
    validRows,
    invalidRows,
  };
}

export function chunkArray<T>(items: T[], chunkSize: number = 50): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
