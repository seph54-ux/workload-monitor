import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '../../lib/table';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { DeadlineBadge } from '../../components/DeadlineBadge';
import { ExcelModal } from '../../components/ExcelModal';
import { FormField, inputClass } from '../../components/FormFields';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useBatchImportStageRows,
  useCreateStageRow,
  useSoftDeleteStageRow,
  useStageRows,
  useTechnicians,
  useUpdateStageRow,
  useWorkspaceContext,
} from '../../data/hooks';
import { formatManilaDate, getDeadlineStatus, getTodayManilaISO } from '../../lib/dates';
import { canCreateStageRecord, canEditStageRecord, canSoftDeleteStageRecord } from '../../lib/roles';
import { toolingSchema } from '../../lib/schemas';
import { TOOLING_CATEGORIES, type ToolingCategory, type ToolingRow } from '../../types/database.types';

interface ToolingFormValues {
  source_type: 'First Run' | 'TRF';
  trf_reference: string | null;
  date_received: string | null;
  rsqdf: string;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  tooling_type: ToolingCategory;
  execution_mode: 'Job Out' | 'In House';
  commitment_date: string | null;
  date_forwarded_to_ppqc: string | null;
  remarks: string | null;
}

const EXCEL_COLUMNS = [
  { key: 'source_type', label: 'First Run / TRF' },
  { key: 'trf_reference', label: 'TRF #' },
  { key: 'date_received', label: 'Date Received' },
  { key: 'rsqdf', label: 'RSQDF', required: true },
  { key: 'customer', label: 'Customer', required: true },
  { key: 'model_name', label: 'Model Name', required: true },
  { key: 'tooling_type', label: 'Type of Tooling' },
  { key: 'execution_mode', label: 'Job Out / In House' },
  { key: 'commitment_date', label: 'Commitment' },
  { key: 'date_forwarded_to_ppqc', label: 'Date Forwarded to PPQC' },
  { key: 'remarks', label: 'Remarks' },
];

export function ToolingPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();
  const { data: rows = [], isLoading, error, refetch } = useStageRows<ToolingRow>('tooling');

  const createRow = useCreateStageRow<ToolingRow>('tooling');
  const updateRow = useUpdateStageRow<ToolingRow>('tooling');
  const deleteRow = useSoftDeleteStageRow('tooling');
  const batchImport = useBatchImportStageRows('tooling');

  const [editing, setEditing] = useState<ToolingRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [excelRows, setExcelRows] = useState<ToolingRow[] | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);
  const isToolingRestricted = role === 'TOOLING';

  const form = useForm<ToolingFormValues>({
    resolver: zodResolver(toolingSchema) as never,
    defaultValues: {
      source_type: 'First Run',
      trf_reference: '',
      date_received: getTodayManilaISO(),
      rsqdf: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      tooling_type: 'Die Cut',
      execution_mode: 'In House',
      commitment_date: '',
      date_forwarded_to_ppqc: '',
      remarks: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      source_type: 'First Run',
      trf_reference: '',
      date_received: getTodayManilaISO(),
      rsqdf: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      tooling_type: 'Die Cut',
      execution_mode: 'In House',
      commitment_date: '',
      date_forwarded_to_ppqc: '',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: ToolingRow) => {
    setEditing(row);
    form.reset({
      source_type: row.source_type,
      trf_reference: row.trf_reference ?? '',
      date_received: row.date_received ?? '',
      rsqdf: row.rsqdf,
      customer: row.customer,
      model_name: row.model_name,
      technician_in_charge: row.technician_in_charge ?? '',
      tooling_type: row.tooling_type,
      execution_mode: row.execution_mode,
      commitment_date: row.commitment_date ?? '',
      date_forwarded_to_ppqc: row.date_forwarded_to_ppqc ?? '',
      remarks: row.remarks ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        const payload: Record<string, unknown> = isToolingRestricted
          ? {
              execution_mode: values.execution_mode,
              date_forwarded_to_ppqc: values.date_forwarded_to_ppqc,
              remarks: values.remarks,
            }
          : (values as unknown as Record<string, unknown>);
        await updateRow.mutateAsync({ id: editing.id, payload });
        pushToast(`Updated tooling ${values.rsqdf}`);
      } else {
        await createRow.mutateAsync(values as unknown as Record<string, unknown>);
        pushToast(`Added tooling ${values.rsqdf}`);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message || 'Save failed', 'error');
    }
  });

  const handleMarkForwarded = async (row: ToolingRow) => {
    try {
      await updateRow.mutateAsync({
        id: row.id,
        payload: { date_forwarded_to_ppqc: getTodayManilaISO() },
      });
      pushToast(`Marked ${row.rsqdf} (${row.tooling_type}) forwarded to PPQC`);
    } catch (err) {
      pushToast((err as Error).message, 'error');
    }
  };

  const canCreate = canCreateStageRecord(role, 'tooling');
  const canEdit = canEditStageRecord(role, 'tooling');
  const canDelete = canSoftDeleteStageRecord(role);

  const columns = useMemo<ColumnDef<ToolingRow, unknown>[]>(
    () => [
      {
        accessorKey: 'source_type',
        header: 'Source',
        cell: ({ row }) => (
          <div className="text-xs whitespace-nowrap">
            <span className="font-semibold text-slate-800">{row.original.source_type}</span>
            {row.original.trf_reference && (
              <span className="font-mono text-slate-500"> · {row.original.trf_reference}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'rsqdf',
        header: 'RSQDF',
        cell: ({ row }) => (
          <Link
            to={`/item/${encodeURIComponent(row.original.rsqdf)}`}
            className="font-mono text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
          >
            {row.original.rsqdf}
          </Link>
        ),
      },
      {
        accessorKey: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="max-w-[125px] truncate text-xs font-medium text-slate-800" title={row.original.customer}>
            {row.original.customer}
          </div>
        ),
      },
      {
        accessorKey: 'model_name',
        header: 'Model Name',
        cell: ({ row }) => (
          <div className="max-w-[140px] truncate text-xs text-slate-700" title={row.original.model_name}>
            {row.original.model_name}
          </div>
        ),
      },
      {
        accessorKey: 'tooling_type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-slate-900 whitespace-nowrap">
            {row.original.tooling_type}
          </span>
        ),
      },
      {
        accessorKey: 'execution_mode',
        header: 'Mode',
        cell: ({ row }) => (
          <span className="text-xs text-slate-600 whitespace-nowrap">
            {row.original.execution_mode}
          </span>
        ),
      },
      {
        accessorKey: 'technician_in_charge',
        header: 'Tech',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 whitespace-nowrap">
            {row.original.technician_in_charge
              ? techMap.get(row.original.technician_in_charge) ?? '—'
              : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'date_received',
        header: 'Received',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_received)}
          </span>
        ),
      },
      {
        accessorKey: 'commitment_date',
        header: 'Due',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.commitment_date)}
          </span>
        ),
      },
      {
        accessorKey: 'date_forwarded_to_ppqc',
        header: 'To PPQC',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_forwarded_to_ppqc)}
          </span>
        ),
      },
      {
        id: 'deadline',
        header: 'State',
        cell: ({ row }) => (
          <DeadlineBadge
            commitmentDate={row.original.commitment_date}
            finishedDate={row.original.date_forwarded_to_ppqc}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            {canEdit && !row.original.date_forwarded_to_ppqc && (
              <button
                type="button"
                onClick={() => void handleMarkForwarded(row.original)}
                aria-label={`Mark ${row.original.rsqdf} ${row.original.tooling_type} forwarded to PPQC`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded"
              >
                <Check className="w-3.5 h-3.5" />
                <span>To PPQC</span>
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => openEdit(row.original)}
                aria-label={`Edit tooling ${row.original.rsqdf}`}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteRow.mutateAsync(row.original.id);
                    pushToast(`Archived ${row.original.rsqdf}`);
                  } catch (err) {
                    pushToast((err as Error).message, 'error');
                  }
                }}
                aria-label={`Delete tooling ${row.original.rsqdf}`}
                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [techMap, canEdit, canDelete, deleteRow, pushToast]
  );

  return (
    <>
      <DataTable
        title="Tooling Queue"
        subtitle="First Run tooling from APQP and internal revision tooling from TRF, forwarded to PPQC upon completion"
        data={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        technicians={technicians}
        getTechnicianId={(r) => r.technician_in_charge}
        getDeadlineStatusForRow={(r) =>
          getDeadlineStatus(r.commitment_date, r.date_forwarded_to_ppqc)
        }
        statusFilterOptions={TOOLING_CATEGORIES.map((c) => ({ label: c, value: c }))}
        getStatusValue={(r) => r.tooling_type}
        canCreate={canCreate}
        createLabel="New Tooling Job"
        onCreate={openCreate}
        onOpenExcel={(filtered) => setExcelRows(filtered)}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Tooling · ${editing.rsqdf}` : 'New Tooling Job'}
        subtitle={
          isToolingRestricted
            ? 'TOOLING role can update Execution Mode, Date Forwarded to PPQC, and Remarks.'
            : undefined
        }
      >
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="tl-src" label="First Run / TRF">
              <select id="tl-src" disabled={isToolingRestricted} {...form.register('source_type')} className={inputClass}>
                <option value="First Run">First Run</option>
                <option value="TRF">TRF</option>
              </select>
            </FormField>
            <FormField id="tl-trf" label="TRF Reference #">
              <input id="tl-trf" disabled={isToolingRestricted} {...form.register('trf_reference')} className={inputClass} placeholder="TRF-2026-035" />
            </FormField>
            <FormField id="tl-rsqdf" label="RSQDF" required error={form.formState.errors.rsqdf?.message}>
              <input id="tl-rsqdf" disabled={isToolingRestricted} {...form.register('rsqdf')} className={inputClass} />
            </FormField>
            <FormField id="tl-type" label="Type of Tooling">
              <select id="tl-type" disabled={isToolingRestricted} {...form.register('tooling_type')} className={inputClass}>
                {TOOLING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="tl-cust" label="Customer" required error={form.formState.errors.customer?.message}>
              <input id="tl-cust" disabled={isToolingRestricted} {...form.register('customer')} className={inputClass} />
            </FormField>
            <FormField id="tl-model" label="Model Name" required error={form.formState.errors.model_name?.message}>
              <input id="tl-model" disabled={isToolingRestricted} {...form.register('model_name')} className={inputClass} />
            </FormField>
            <FormField id="tl-mode" label="Job Out / In House">
              <select id="tl-mode" {...form.register('execution_mode')} className={inputClass}>
                <option value="In House">In House</option>
                <option value="Job Out">Job Out</option>
              </select>
            </FormField>
            <FormField id="tl-tech" label="Assigned Tech">
              <select id="tl-tech" disabled={isToolingRestricted} {...form.register('technician_in_charge')} className={inputClass}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="tl-rec" label="Date Received">
              <input id="tl-rec" type="date" disabled={isToolingRestricted} {...form.register('date_received')} className={inputClass} />
            </FormField>
            <FormField id="tl-due" label="Commitment Date">
              <input id="tl-due" type="date" disabled={isToolingRestricted} {...form.register('commitment_date')} className={inputClass} />
            </FormField>
            <FormField id="tl-ppqc" label="Date Forwarded to PPQC">
              <input id="tl-ppqc" type="date" {...form.register('date_forwarded_to_ppqc')} className={inputClass} />
            </FormField>
          </div>
          <FormField id="tl-rem" label="Remarks">
            <textarea id="tl-rem" rows={2} {...form.register('remarks')} className={inputClass} />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRow.isPending || updateRow.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              {editing ? 'Save Changes' : 'Create Tooling'}
            </button>
          </div>
        </form>
      </Modal>

      {excelRows && (
        <ExcelModal
          open={Boolean(excelRows)}
          onClose={() => setExcelRows(null)}
          title="Tooling"
          filenamePrefix="tooling"
          columns={EXCEL_COLUMNS}
          filteredRows={excelRows as unknown as Record<string, unknown>[]}
          schema={toolingSchema}
          technicians={technicians}
          canImport={canCreate}
          onBatchImport={(valid) => batchImport.mutateAsync(valid)}
        />
      )}
    </>
  );
}
