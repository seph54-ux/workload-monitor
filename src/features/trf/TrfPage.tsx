import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '../../lib/table';
import { Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { ExcelModal } from '../../components/ExcelModal';
import { FormField, inputClass } from '../../components/FormFields';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useBatchImportStageRows,
  useCreateTrfWithLinks,
  useSoftDeleteStageRow,
  useStageRows,
  useTechnicians,
  useUpdateStageRow,
  useWorkspaceContext,
} from '../../data/hooks';
import { formatManilaDate, getTodayManilaISO } from '../../lib/dates';
import { canCreateStageRecord, canEditStageRecord, canSoftDeleteStageRecord } from '../../lib/roles';
import { trfSchema } from '../../lib/schemas';
import {
  TOOLING_CATEGORIES,
  TRF_STATUSES,
  type ToolingCategory,
  type TrfLogRow,
  type TrfStatus,
} from '../../types/database.types';

interface TrfFormValues {
  trf_number: string;
  rsqdf: string;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  date_filed: string;
  reason_for_revision: string;
  requires_tooling: boolean;
  tooling_type: ToolingCategory | null;
  tooling_commitment_date: string | null;
  execution_mode: 'Job Out' | 'In House';
  requires_md_revision: boolean;
  status: TrfStatus;
  date_completed: string | null;
  remarks: string | null;
}

const EXCEL_COLUMNS = [
  { key: 'trf_number', label: 'TRF #', required: true },
  { key: 'rsqdf', label: 'RSQDF', required: true },
  { key: 'customer', label: 'Customer', required: true },
  { key: 'model_name', label: 'Model Name', required: true },
  { key: 'date_filed', label: 'Date Filed', required: true },
  { key: 'reason_for_revision', label: 'Reason for Revision', required: true },
  { key: 'status', label: 'Status' },
  { key: 'date_completed', label: 'Date Completed' },
  { key: 'remarks', label: 'Remarks' },
];

export function TrfPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();
  const { data: rows = [], isLoading, error, refetch } = useStageRows<TrfLogRow>('trf_logs');

  const createTrf = useCreateTrfWithLinks();
  const updateRow = useUpdateStageRow<TrfLogRow>('trf_logs');
  const deleteRow = useSoftDeleteStageRow('trf_logs');
  const batchImport = useBatchImportStageRows('trf_logs');

  const [editing, setEditing] = useState<TrfLogRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [excelRows, setExcelRows] = useState<TrfLogRow[] | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);

  const form = useForm<TrfFormValues>({
    resolver: zodResolver(trfSchema) as never,
    defaultValues: {
      trf_number: '',
      rsqdf: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      date_filed: getTodayManilaISO(),
      reason_for_revision: '',
      requires_tooling: false,
      tooling_type: 'Die Cut',
      tooling_commitment_date: '',
      execution_mode: 'In House',
      requires_md_revision: true,
      status: 'Filed',
      date_completed: '',
      remarks: '',
    },
  });

  const requiresTooling = form.watch('requires_tooling');

  const openCreate = () => {
    setEditing(null);
    form.reset({
      trf_number: `TRF-${new Date().getFullYear()}-`,
      rsqdf: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      date_filed: getTodayManilaISO(),
      reason_for_revision: '',
      requires_tooling: false,
      tooling_type: 'Die Cut',
      tooling_commitment_date: '',
      execution_mode: 'In House',
      requires_md_revision: true,
      status: 'Filed',
      date_completed: '',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: TrfLogRow) => {
    setEditing(row);
    form.reset({
      trf_number: row.trf_number,
      rsqdf: row.rsqdf,
      customer: row.customer,
      model_name: row.model_name,
      technician_in_charge: row.technician_in_charge ?? '',
      date_filed: row.date_filed,
      reason_for_revision: row.reason_for_revision,
      requires_tooling: row.requires_tooling,
      tooling_type: row.tooling_type ?? 'Die Cut',
      tooling_commitment_date: '',
      execution_mode: 'In House',
      requires_md_revision: row.requires_md_revision,
      status: row.status,
      date_completed: row.date_completed ?? '',
      remarks: row.remarks ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        const { tooling_commitment_date: _tcd, execution_mode: _em, ...rest } = values;
        await updateRow.mutateAsync({ id: editing.id, payload: rest });
        pushToast(`Updated TRF ${values.trf_number}`);
      } else {
        const res = await createTrf.mutateAsync(values as unknown as Record<string, unknown>);
        pushToast(
          res.toolingId
            ? `Filed ${values.trf_number} and created linked Tooling job`
            : `Filed ${values.trf_number}`
        );
      }
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message || 'Failed to save TRF', 'error');
    }
  });

  const canCreate = canCreateStageRecord(role, 'trf_logs');
  const canEdit = canEditStageRecord(role, 'trf_logs');
  const canDelete = canSoftDeleteStageRecord(role);

  const columns = useMemo<ColumnDef<TrfLogRow, unknown>[]>(
    () => [
      {
        accessorKey: 'trf_number',
        header: 'TRF #',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
            {row.original.trf_number}
          </span>
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
      { accessorKey: 'customer', header: 'Customer' },
      { accessorKey: 'model_name', header: 'Model Name' },
      {
        accessorKey: 'date_filed',
        header: 'Date Filed',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_filed)}
          </span>
        ),
      },
      {
        accessorKey: 'reason_for_revision',
        header: 'Reason for Revision',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 max-w-xs line-clamp-2">
            {row.original.reason_for_revision}
          </span>
        ),
      },
      {
        id: 'links',
        header: 'Linked Routing',
        cell: ({ row }) => (
          <span className="text-xs text-slate-600 whitespace-nowrap">
            {[
              row.original.requires_tooling
                ? `Tooling (${row.original.tooling_type ?? 'Req'})`
                : null,
              row.original.requires_md_revision ? 'MD Revision' : null,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'technician_in_charge',
        header: 'Tech',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-slate-800 whitespace-nowrap">
            {row.original.technician_in_charge
              ? techMap.get(row.original.technician_in_charge) ?? '—'
              : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              row.original.status === 'Completed'
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            {canEdit && (
              <button
                type="button"
                onClick={() => openEdit(row.original)}
                aria-label={`Edit TRF ${row.original.trf_number}`}
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
                    pushToast(`Archived ${row.original.trf_number}`);
                  } catch (err) {
                    pushToast((err as Error).message, 'error');
                  }
                }}
                aria-label={`Delete TRF ${row.original.trf_number}`}
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
        title="TRF Log (Technical Request Form)"
        subtitle="Internal revision requests filed before MD updates drawings or Tooling reworks dies/jigs"
        data={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        technicians={technicians}
        getTechnicianId={(r) => r.technician_in_charge}
        statusFilterOptions={TRF_STATUSES.map((s) => ({ label: s, value: s }))}
        getStatusValue={(r) => r.status}
        canCreate={canCreate}
        createLabel="File TRF"
        onCreate={openCreate}
        onOpenExcel={(filtered) => setExcelRows(filtered)}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit TRF · ${editing.trf_number}` : 'File Technical Request Form (TRF)'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="trf-num" label="TRF Number" required error={form.formState.errors.trf_number?.message}>
              <input id="trf-num" {...form.register('trf_number')} className={inputClass} placeholder="TRF-2026-033" />
            </FormField>
            <FormField id="trf-rsqdf" label="RSQDF" required error={form.formState.errors.rsqdf?.message}>
              <input id="trf-rsqdf" {...form.register('rsqdf')} className={inputClass} />
            </FormField>
            <FormField id="trf-cust" label="Customer" required error={form.formState.errors.customer?.message}>
              <input id="trf-cust" {...form.register('customer')} className={inputClass} />
            </FormField>
            <FormField id="trf-model" label="Model Name" required error={form.formState.errors.model_name?.message}>
              <input id="trf-model" {...form.register('model_name')} className={inputClass} />
            </FormField>
            <FormField id="trf-tech" label="Technical In Charge">
              <select id="trf-tech" {...form.register('technician_in_charge')} className={inputClass}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="trf-filed" label="Date Filed" required error={form.formState.errors.date_filed?.message}>
              <input id="trf-filed" type="date" {...form.register('date_filed')} className={inputClass} />
            </FormField>
            <FormField id="trf-status" label="Status">
              <select id="trf-status" {...form.register('status')} className={inputClass}>
                {TRF_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="trf-comp" label="Date Completed">
              <input id="trf-comp" type="date" {...form.register('date_completed')} className={inputClass} />
            </FormField>
          </div>

          <FormField id="trf-reason" label="Reason for Revision" required error={form.formState.errors.reason_for_revision?.message}>
            <textarea id="trf-reason" rows={2} {...form.register('reason_for_revision')} className={inputClass} />
          </FormField>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
            <div className="flex flex-wrap gap-6 text-xs font-medium text-slate-800">
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('requires_md_revision')} className="rounded border-slate-300" />
                <span>Requires MD Drawing Revision</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...form.register('requires_tooling')} className="rounded border-slate-300" />
                <span>Requires Tooling Job (auto-creates Tooling row on filing)</span>
              </label>
            </div>

            {requiresTooling && !editing && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <FormField id="trf-ttype" label="Tooling Type">
                  <select id="trf-ttype" {...form.register('tooling_type')} className={inputClass}>
                    {TOOLING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="trf-emode" label="Execution Mode">
                  <select id="trf-emode" {...form.register('execution_mode')} className={inputClass}>
                    <option value="In House">In House</option>
                    <option value="Job Out">Job Out</option>
                  </select>
                </FormField>
                <FormField id="trf-tdue" label="Tooling Commitment">
                  <input id="trf-tdue" type="date" {...form.register('tooling_commitment_date')} className={inputClass} />
                </FormField>
              </div>
            )}
          </div>

          <FormField id="trf-rem" label="Remarks">
            <textarea id="trf-rem" rows={2} {...form.register('remarks')} className={inputClass} />
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
              disabled={createTrf.isPending || updateRow.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              {editing ? 'Save Changes' : 'Submit TRF'}
            </button>
          </div>
        </form>
      </Modal>

      {excelRows && (
        <ExcelModal
          open={Boolean(excelRows)}
          onClose={() => setExcelRows(null)}
          title="TRF Log"
          filenamePrefix="trf-logs"
          columns={EXCEL_COLUMNS}
          filteredRows={excelRows as unknown as Record<string, unknown>[]}
          schema={trfSchema}
          technicians={technicians}
          canImport={canCreate}
          onBatchImport={(valid) => batchImport.mutateAsync(valid)}
        />
      )}
    </>
  );
}
