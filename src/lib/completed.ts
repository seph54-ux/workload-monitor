import {
  APQP_STATUSES,
  TRF_STATUSES,
  type ApqpRow,
  type ApqpStatus,
  type AppRole,
  type ApprovalRow,
  type CncRow,
  type QuotationRow,
  type SampleRow,
  type ToolingExecutionMode,
  type ToolingRow,
  type TrfLogRow,
  type TrfStatus,
} from '../types/database.types';

export type CompletedCategory =
  | 'samples'
  | 'quotations'
  | 'approvals'
  | 'apqp'
  | 'tooling'
  | 'cnc'
  | 'trf_logs';

export interface CompletedCategoryMeta {
  key: CompletedCategory;
  label: string;
  route: string;
  description: string;
}

export const COMPLETED_CATEGORIES: CompletedCategoryMeta[] = [
  {
    key: 'samples',
    label: 'Samples',
    route: '/samples',
    description: 'Finished sample & sample-stage P.O. requests',
  },
  {
    key: 'quotations',
    label: 'Quotation',
    route: '/quotation',
    description: 'Finished costing & quotation requests',
  },
  {
    key: 'approvals',
    label: 'Approval',
    route: '/approval',
    description: 'Signed customer approvals received',
  },
  {
    key: 'apqp',
    label: 'APQP',
    route: '/apqp',
    description: 'Completed First Run / APQP items',
  },
  {
    key: 'tooling',
    label: 'Tooling',
    route: '/tooling',
    description: 'Tooling forwarded to PPQC',
  },
  {
    key: 'cnc',
    label: 'CNC',
    route: '/cnc',
    description: 'Finished CNC machining jobs',
  },
  {
    key: 'trf_logs',
    label: 'TRF Log',
    route: '/trf',
    description: 'Completed internal revision requests',
  },
];

export const COMPLETED_CATEGORY_MAP: Record<CompletedCategory, CompletedCategoryMeta> =
  Object.fromEntries(COMPLETED_CATEGORIES.map((c) => [c.key, c])) as Record<
    CompletedCategory,
    CompletedCategoryMeta
  >;

export type AnyCompletedRawRow =
  | SampleRow
  | QuotationRow
  | ApprovalRow
  | ApqpRow
  | ToolingRow
  | CncRow
  | TrfLogRow;

export interface CompletedItem {
  uid: string;
  id: string;
  category: CompletedCategory;
  categoryLabel: string;
  stageRoute: string;
  rsqdf: string;
  customer: string;
  modelName: string;
  referenceSummary: string;
  statusText: string;
  completedDate: string | null;
  commitmentDate: string | null;
  technicianId: string | null;
  remarks: string | null;
  updatedAt: string;
  raw: AnyCompletedRawRow;
}

export interface CompletedSources {
  samples: SampleRow[];
  quotations: QuotationRow[];
  approvals: ApprovalRow[];
  apqp: ApqpRow[];
  tooling: ToolingRow[];
  cnc: CncRow[];
  trf_logs: TrfLogRow[];
}

export function isRowCompleted(
  category: CompletedCategory,
  row: AnyCompletedRawRow
): boolean {
  if (row.deleted_at) return false;
  switch (category) {
    case 'samples':
      return Boolean((row as SampleRow).date_finished);
    case 'quotations':
      return Boolean((row as QuotationRow).date_finished);
    case 'approvals':
      return Boolean((row as ApprovalRow).date_received_signed_approval);
    case 'apqp': {
      const r = row as ApqpRow;
      return Boolean(r.completed_date) || r.status === 'Completed';
    }
    case 'tooling':
      return Boolean((row as ToolingRow).date_forwarded_to_ppqc);
    case 'cnc':
      return Boolean((row as CncRow).date_finished);
    case 'trf_logs': {
      const r = row as TrfLogRow;
      return Boolean(r.date_completed) || r.status === 'Completed';
    }
  }
}

export function collectCompletedItems(sources: CompletedSources): CompletedItem[] {
  const items: CompletedItem[] = [];

  for (const r of sources.samples) {
    if (!isRowCompleted('samples', r)) continue;
    items.push({
      uid: `samples:${r.id}`,
      id: r.id,
      category: 'samples',
      categoryLabel: 'Samples',
      stageRoute: '/samples',
      rsqdf: r.rsqdf,
      customer: r.customer,
      modelName: r.model_name,
      referenceSummary: r.reference_number ? `${r.record_type} · ${r.reference_number}` : r.record_type,
      statusText: 'Finished',
      completedDate: r.date_finished,
      commitmentDate: r.date_commitment,
      technicianId: r.technician_in_charge,
      remarks: r.remarks,
      updatedAt: r.updated_at,
      raw: r,
    });
  }

  for (const r of sources.quotations) {
    if (!isRowCompleted('quotations', r)) continue;
    items.push({
      uid: `quotations:${r.id}`,
      id: r.id,
      category: 'quotations',
      categoryLabel: 'Quotation',
      stageRoute: '/quotation',
      rsqdf: r.rsqdf,
      customer: r.customer,
      modelName: r.model_name,
      referenceSummary: r.reference_number ? `${r.record_type} · ${r.reference_number}` : r.record_type,
      statusText: 'Finished',
      completedDate: r.date_finished,
      commitmentDate: r.date_commitment,
      technicianId: r.technician_in_charge,
      remarks: r.remarks,
      updatedAt: r.updated_at,
      raw: r,
    });
  }

  for (const r of sources.approvals) {
    if (!isRowCompleted('approvals', r)) continue;
    items.push({
      uid: `approvals:${r.id}`,
      id: r.id,
      category: 'approvals',
      categoryLabel: 'Approval',
      stageRoute: '/approval',
      rsqdf: r.rsqdf,
      customer: r.customer,
      modelName: r.model_name,
      referenceSummary: r.po_number ? `${r.po_mode} · ${r.po_number}` : r.po_mode,
      statusText: 'Signed Approval',
      completedDate: r.date_received_signed_approval,
      commitmentDate: r.date_commitment,
      technicianId: r.technician_in_charge,
      remarks: r.remarks,
      updatedAt: r.updated_at,
      raw: r,
    });
  }

  for (const r of sources.apqp) {
    if (!isRowCompleted('apqp', r)) continue;
    items.push({
      uid: `apqp:${r.id}`,
      id: r.id,
      category: 'apqp',
      categoryLabel: 'APQP',
      stageRoute: '/apqp',
      rsqdf: r.rsqdf,
      customer: r.customer,
      modelName: r.model_name,
      referenceSummary: r.item_code
        ? `Item Code ${r.item_code}`
        : r.po_reference
        ? `P.O. ${r.po_reference}`
        : 'First Run',
      statusText: r.status,
      completedDate: r.completed_date ?? r.forwarded_to_ddcc_date ?? r.updated_at.slice(0, 10),
      commitmentDate: r.date_commitment,
      technicianId: r.technician_in_charge,
      remarks: r.remarks,
      updatedAt: r.updated_at,
      raw: r,
    });
  }

  for (const r of sources.tooling) {
    if (!isRowCompleted('tooling', r)) continue;
    items.push({
      uid: `tooling:${r.id}`,
      id: r.id,
      category: 'tooling',
      categoryLabel: 'Tooling',
      stageRoute: '/tooling',
      rsqdf: r.rsqdf,
      customer: r.customer,
      modelName: r.model_name,
      referenceSummary: `${r.tooling_type} · ${r.source_type} (${r.execution_mode})`,
      statusText: 'Forwarded to PPQC',
      completedDate: r.date_forwarded_to_ppqc,
      commitmentDate: r.commitment_date,
      technicianId: r.technician_in_charge,
      remarks: r.remarks,
      updatedAt: r.updated_at,
      raw: r,
    });
  }

  for (const r of sources.cnc) {
    if (!isRowCompleted('cnc', r)) continue;
    items.push({
      uid: `cnc:${r.id}`,
      id: r.id,
      category: 'cnc',
      categoryLabel: 'CNC',
      stageRoute: '/cnc',
      rsqdf: r.rsqdf,
      customer: r.customer,
      modelName: r.model_name,
      referenceSummary:
        r.qty_commitment !== null ? `${r.rsqdf_jo} (Qty ${r.qty_commitment})` : r.rsqdf_jo,
      statusText: 'Finished',
      completedDate: r.date_finished,
      commitmentDate: r.delivery_schedule,
      technicianId: r.technician_in_charge,
      remarks: r.remarks,
      updatedAt: r.updated_at,
      raw: r,
    });
  }

  for (const r of sources.trf_logs) {
    if (!isRowCompleted('trf_logs', r)) continue;
    items.push({
      uid: `trf_logs:${r.id}`,
      id: r.id,
      category: 'trf_logs',
      categoryLabel: 'TRF Log',
      stageRoute: '/trf',
      rsqdf: r.rsqdf,
      customer: r.customer,
      modelName: r.model_name,
      referenceSummary: r.trf_number,
      statusText: r.status,
      completedDate: r.date_completed ?? r.updated_at.slice(0, 10),
      commitmentDate: r.date_filed,
      technicianId: r.technician_in_charge,
      remarks: r.remarks ?? r.reason_for_revision,
      updatedAt: r.updated_at,
      raw: r,
    });
  }

  return items.sort((a, b) => {
    const da = a.completedDate ?? a.updatedAt.slice(0, 10);
    const db = b.completedDate ?? b.updatedAt.slice(0, 10);
    if (da !== db) return db.localeCompare(da);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function countCompletedByCategory(
  items: CompletedItem[]
): Record<'ALL' | CompletedCategory, number> {
  const counts: Record<'ALL' | CompletedCategory, number> = {
    ALL: items.length,
    samples: 0,
    quotations: 0,
    approvals: 0,
    apqp: 0,
    tooling: 0,
    cnc: 0,
    trf_logs: 0,
  };
  for (const item of items) {
    counts[item.category] += 1;
  }
  return counts;
}

export interface CompletedStatusEditInput {
  actionMode: 'keep_completed' | 'reopen';
  completedDate: string | null;
  commitmentDate: string | null;
  technicianId: string | null;
  remarks: string | null;
  apqpStatus?: ApqpStatus;
  trfStatus?: TrfStatus;
  toolingExecutionMode?: ToolingExecutionMode;
}

export function buildCompletedStatusPatch(
  item: CompletedItem,
  input: CompletedStatusEditInput,
  role: AppRole,
  todayISO: string
): Record<string, unknown> {
  const cleanDate = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const cleanText = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const reopening = input.actionMode === 'reopen';
  const effectiveCompletedDate = reopening
    ? null
    : cleanDate(input.completedDate) ?? item.completedDate ?? todayISO;

  if (item.category === 'tooling' && role === 'TOOLING') {
    const raw = item.raw as ToolingRow;
    return {
      execution_mode: input.toolingExecutionMode ?? raw.execution_mode,
      date_forwarded_to_ppqc: effectiveCompletedDate,
      remarks: cleanText(input.remarks),
    };
  }

  if (item.category === 'cnc' && role === 'CNC') {
    return {
      date_finished: effectiveCompletedDate,
      remarks: cleanText(input.remarks),
    };
  }

  switch (item.category) {
    case 'samples':
    case 'quotations':
      return {
        technician_in_charge: input.technicianId || null,
        date_commitment: cleanDate(input.commitmentDate),
        date_finished: effectiveCompletedDate,
        remarks: cleanText(input.remarks),
      };
    case 'approvals':
      return {
        technician_in_charge: input.technicianId || null,
        date_commitment: cleanDate(input.commitmentDate),
        date_received_signed_approval: effectiveCompletedDate,
        remarks: cleanText(input.remarks),
      };
    case 'apqp': {
      const nextStatus: ApqpStatus = reopening
        ? input.apqpStatus && input.apqpStatus !== 'Completed'
          ? input.apqpStatus
          : 'Forwarded to MD'
        : input.apqpStatus ?? 'Completed';
      return {
        technician_in_charge: input.technicianId || null,
        date_commitment: cleanDate(input.commitmentDate),
        status: nextStatus,
        completed_date: nextStatus === 'Completed' ? effectiveCompletedDate : null,
        remarks: cleanText(input.remarks),
      };
    }
    case 'tooling':
      return {
        technician_in_charge: input.technicianId || null,
        commitment_date: cleanDate(input.commitmentDate),
        execution_mode: input.toolingExecutionMode ?? (item.raw as ToolingRow).execution_mode,
        date_forwarded_to_ppqc: effectiveCompletedDate,
        remarks: cleanText(input.remarks),
      };
    case 'cnc':
      return {
        technician_in_charge: input.technicianId || null,
        delivery_schedule: cleanDate(input.commitmentDate),
        date_finished: effectiveCompletedDate,
        remarks: cleanText(input.remarks),
      };
    case 'trf_logs': {
      const nextStatus: TrfStatus = reopening
        ? input.trfStatus && input.trfStatus !== 'Completed'
          ? input.trfStatus
          : 'In MD'
        : input.trfStatus ?? 'Completed';
      return {
        technician_in_charge: input.technicianId || null,
        status: nextStatus,
        date_completed: nextStatus === 'Completed' ? effectiveCompletedDate : null,
        remarks: cleanText(input.remarks),
      };
    }
  }
}

export const APQP_REOPEN_STATUSES = APQP_STATUSES.filter((s) => s !== 'Completed');
export const TRF_REOPEN_STATUSES = TRF_STATUSES.filter((s) => s !== 'Completed');
