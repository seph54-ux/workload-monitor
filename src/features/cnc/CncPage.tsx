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
import { cncSchema } from '../../lib/schemas';
import type { CncRow } from '../../types/database.types';

interface CncFormValues {
  date_received: string | null;
  rsqdf_jo: string;
  rsqdf: string;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  qty_commitment: number | null;
  delivery_schedule: string | null;
  date_finished: string | null;
  remarks: string | null;
}

const EXCEL_COLUMNS = [
  { key: 'date_received', label: 'Date Received' },
  { key: 'rsqdf_jo', label: 'RSQDF / J.O.', required: true },
  { key: 'rsqdf', label: 'RSQDF', required: true },
  { key: 'customer', label: 'Customer', required: true },
  { key: 'model_name', label: 'Model Name', required: true },
  { key: 'qty_commitment', label: 'Qty Commitment' },
  { key: 'delivery_schedule', label: 'Delivery Schedule' },
  { key: 'date_finished', label: 'Date Finished' },
  { key: 'remarks', label: 'Remarks' },
];

export function CncPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();
  const { data: rows = [], isLoading, error, refetch } = useStageRows<CncRow>('cnc');

  const createRow = useCreateStageRow<CncRow>('cnc');
  const updateRow = useUpdateStageRow<CncRow>('cnc');
  const deleteRow = useSoftDeleteStageRow('cnc');
  const batchImport = useBatchImportStageRows('cnc');

  const [editing, setEditing] = useState<CncRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [excelRows, setExcelRows] = useState<CncRow[] | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);
  const isCncRestricted = role === 'CNC';

  const form = useForm<CncFormValues>({
    resolver: zodResolver(cncSchema) as never,
    defaultValues: {
      date_received: getTodayManilaISO(),
      rsqdf_jo: '',
      rsqdf: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      qty_commitment: 1,
      delivery_schedule: '',
      date_finished: '',
      remarks: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      date_received: getTodayManilaISO(),
      rsqdf_jo: '',
      rsqdf: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      qty_commitment: 1,
      delivery_schedule: '',
      date_finished: '',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: CncRow) => {
    setEditing(row);
    form.reset({
      date_received: row.date_received ?? '',
      rsqdf_jo: row.rsqdf_jo,
      rsqdf: row.rsqdf,
      customer: row.customer,
      model_name: row.model_name,
      technician_in_charge: row.technician_in_charge ?? '',
      qty_commitment: row.qty_commitment ?? null,
      delivery_schedule: row.delivery_schedule ?? '',
      date_finished: row.date_finished ?? '',
      remarks: row.remarks ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        const payload: Record<string, unknown> = isCncRestricted
          ? { date_finished: values.date_finished, remarks: values.remarks }
          : (values as unknown as Record<string, unknown>);
        await updateRow.mutateAsync({ id: editing.id, payload });
        pushToast(`Updated CNC job ${values.rsqdf_jo}`);
      } else {
        await createRow.mutateAsync(values as unknown as Record<string, unknown>);
        pushToast(`Added CNC job ${values.rsqdf_jo}`);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message || 'Save failed', 'error');
    }
  });

  const handleMarkDone = async (row: CncRow) => {
    try {
      await updateRow.mutateAsync({
        id: row.id,
        payload: { date_finished: getTodayManilaISO() },
      });
      pushToast(`Marked ${row.rsqdf_jo} done`);
    } catch (err) {
      pushToast((err as Error).message, 'error');
    }
  };

  const canCreate = canCreateStageRecord(role, 'cnc');
  const canEdit = canEditStageRecord(role, 'cnc');
  const canDelete = canSoftDeleteStageRecord(role);

  const columns = useMemo<ColumnDef<CncRow, unknown>[]>(
    () => [
      {
        accessorKey: 'rsqdf_jo',
        header: 'RSQDF / J.O.',
        cell: ({ row }) => (
          <Link
            to={`/item/${encodeURIComponent(row.original.rsqdf)}`}
            className="font-mono text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
          >
            {row.original.rsqdf_jo}
          </Link>
        ),
      },
      { accessorKey: 'customer', header: 'Customer' },
      { accessorKey: 'model_name', header: 'Model Name' },
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
        accessorKey: 'qty_commitment',
        header: 'Qty',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.qty_commitment ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'date_received',
        header: 'Date Received',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_received)}
          </span>
        ),
      },
      {
        accessorKey: 'delivery_schedule',
        header: 'Delivery Schedule',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.delivery_schedule)}
          </span>
        ),
      },
      {
        accessorKey: 'date_finished',
        header: 'Date Finished',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_finished)}
          </span>
        ),
      },
      {
        id: 'deadline',
        header: 'State',
        cell: ({ row }) => (
          <DeadlineBadge
            commitmentDate={row.original.delivery_schedule}
            finishedDate={row.original.date_finished}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            {canEdit && !row.original.date_finished && (
              <button
                type="button"
                onClick={() => void handleMarkDone(row.original)}
                aria-label={`Mark CNC ${row.original.rsqdf_jo} done`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark Done</span>
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => openEdit(row.original)}
                aria-label={`Edit CNC ${row.original.rsqdf_jo}`}
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
                    pushToast(`Archived ${row.original.rsqdf_jo}`);
                  } catch (err) {
                    pushToast((err as Error).message, 'error');
                  }
                }}
                aria-label={`Delete CNC ${row.original.rsqdf_jo}`}
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
        title="CNC Machining Queue"
        subtitle="Machining fixtures, jigs, and precision blocks assigned from Technical"
        data={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        technicians={technicians}
        getTechnicianId={(r) => r.technician_in_charge}
        getDeadlineStatusForRow={(r) =>
          getDeadlineStatus(r.delivery_schedule, r.date_finished)
        }
        canCreate={canCreate}
        createLabel="New CNC Job"
        onCreate={openCreate}
        onOpenExcel={(filtered) => setExcelRows(filtered)}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit CNC Job · ${editing.rsqdf_jo}` : 'New CNC Job'}
        subtitle={
          isCncRestricted
            ? 'CNC role can update Date Finished and Remarks.'
            : undefined
        }
      >
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="c-jo" label="RSQDF / J.O." required error={form.formState.errors.rsqdf_jo?.message}>
              <input id="c-jo" disabled={isCncRestricted} {...form.register('rsqdf_jo')} className={inputClass} placeholder="RSQDF-26-120 / JO-420" />
            </FormField>
            <FormField id="c-rsqdf" label="RSQDF" required error={form.formState.errors.rsqdf?.message}>
              <input id="c-rsqdf" disabled={isCncRestricted} {...form.register('rsqdf')} className={inputClass} placeholder="RSQDF-26-120" />
            </FormField>
            <FormField id="c-cust" label="Customer" required error={form.formState.errors.customer?.message}>
              <input id="c-cust" disabled={isCncRestricted} {...form.register('customer')} className={inputClass} />
            </FormField>
            <FormField id="c-model" label="Model Name" required error={form.formState.errors.model_name?.message}>
              <input id="c-model" disabled={isCncRestricted} {...form.register('model_name')} className={inputClass} />
            </FormField>
            <FormField id="c-tech" label="Requested By (Tech)">
              <select id="c-tech" disabled={isCncRestricted} {...form.register('technician_in_charge')} className={inputClass}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="c-qty" label="Qty Commitment">
              <input id="c-qty" type="number" disabled={isCncRestricted} {...form.register('qty_commitment')} className={inputClass} />
            </FormField>
            <FormField id="c-rec" label="Date Received">
              <input id="c-rec" type="date" disabled={isCncRestricted} {...form.register('date_received')} className={inputClass} />
            </FormField>
            <FormField id="c-deliv" label="Delivery Schedule">
              <input id="c-deliv" type="date" disabled={isCncRestricted} {...form.register('delivery_schedule')} className={inputClass} />
            </FormField>
            <FormField id="c-fin" label="Date Finished">
              <input id="c-fin" type="date" {...form.register('date_finished')} className={inputClass} />
            </FormField>
          </div>
          <FormField id="c-rem" label="Remarks">
            <textarea id="c-rem" rows={2} {...form.register('remarks')} className={inputClass} />
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
              {editing ? 'Save Changes' : 'Create CNC Job'}
            </button>
          </div>
        </form>
      </Modal>

      {excelRows && (
        <ExcelModal
          open={Boolean(excelRows)}
          onClose={() => setExcelRows(null)}
          title="CNC"
          filenamePrefix="cnc"
          columns={EXCEL_COLUMNS}
          filteredRows={excelRows as unknown as Record<string, unknown>[]}
          schema={cncSchema}
          technicians={technicians}
          canImport={canCreate}
          onBatchImport={(valid) => batchImport.mutateAsync(valid)}
        />
      )}
    </>
  );
}
