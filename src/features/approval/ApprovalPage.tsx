import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '../../lib/table';
import { ArrowRightCircle, Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { DeadlineBadge } from '../../components/DeadlineBadge';
import { ExcelModal } from '../../components/ExcelModal';
import { FormField, inputClass } from '../../components/FormFields';
import { PromoteDialog } from '../../components/PromoteDialog';
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
import { canCreateStageRecord, canEditStageRecord, canPromoteStage, canSoftDeleteStageRecord } from '../../lib/roles';
import { approvalSchema } from '../../lib/schemas';
import type { ApprovalRow } from '../../types/database.types';

type ApprovalFormValues = {
  po_mode: 'With P.O.' | 'Without P.O.';
  rsqdf: string;
  po_number: string | null;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  po_received_date: string | null;
  date_commitment: string | null;
  date_sent_to_customer: string | null;
  date_received_signed_approval: string | null;
  remarks: string | null;
};

const EXCEL_COLUMNS = [
  { key: 'po_mode', label: 'With/Without P.O.' },
  { key: 'rsqdf', label: 'RSQDF', required: true },
  { key: 'po_number', label: 'P.O. Number' },
  { key: 'customer', label: 'Customer', required: true },
  { key: 'model_name', label: 'Model Name', required: true },
  { key: 'technician_in_charge', label: 'Technical In Charge' },
  { key: 'po_received_date', label: 'P.O. Received/Request Date' },
  { key: 'date_commitment', label: 'Commitment Date' },
  { key: 'date_sent_to_customer', label: 'Date Sent to Customer' },
  { key: 'date_received_signed_approval', label: 'Date Received Signed Approval' },
  { key: 'remarks', label: 'Remarks' },
];

export function ApprovalPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();
  const { data: rows = [], isLoading, error, refetch } = useStageRows<ApprovalRow>('approvals');

  const createRow = useCreateStageRow<ApprovalRow>('approvals');
  const updateRow = useUpdateStageRow<ApprovalRow>('approvals');
  const deleteRow = useSoftDeleteStageRow('approvals');
  const batchImport = useBatchImportStageRows('approvals');

  const [editing, setEditing] = useState<ApprovalRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [promoteRow, setPromoteRow] = useState<ApprovalRow | null>(null);
  const [excelRows, setExcelRows] = useState<ApprovalRow[] | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);

  const form = useForm<ApprovalFormValues>({
    resolver: zodResolver(approvalSchema) as never,
    defaultValues: {
      po_mode: 'With P.O.',
      rsqdf: '',
      po_number: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      po_received_date: getTodayManilaISO(),
      date_commitment: '',
      date_sent_to_customer: '',
      date_received_signed_approval: '',
      remarks: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      po_mode: 'With P.O.',
      rsqdf: '',
      po_number: '',
      customer: '',
      model_name: '',
      technician_in_charge: '',
      po_received_date: getTodayManilaISO(),
      date_commitment: '',
      date_sent_to_customer: '',
      date_received_signed_approval: '',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: ApprovalRow) => {
    setEditing(row);
    form.reset({
      po_mode: row.po_mode,
      rsqdf: row.rsqdf,
      po_number: row.po_number ?? '',
      customer: row.customer,
      model_name: row.model_name,
      technician_in_charge: row.technician_in_charge ?? '',
      po_received_date: row.po_received_date ?? '',
      date_commitment: row.date_commitment ?? '',
      date_sent_to_customer: row.date_sent_to_customer ?? '',
      date_received_signed_approval: row.date_received_signed_approval ?? '',
      remarks: row.remarks ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await updateRow.mutateAsync({ id: editing.id, payload: values });
        pushToast(`Updated approval ${values.rsqdf}`);
      } else {
        await createRow.mutateAsync(values);
        pushToast(`Added approval ${values.rsqdf}`);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message || 'Save failed', 'error');
    }
  });

  const canCreate = canCreateStageRecord(role, 'approvals');
  const canEdit = canEditStageRecord(role, 'approvals');
  const canDelete = canSoftDeleteStageRecord(role);
  const canPromote = canPromoteStage(role);

  const columns = useMemo<ColumnDef<ApprovalRow, unknown>[]>(
    () => [
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
        accessorKey: 'po_mode',
        header: 'P.O. Status',
        cell: ({ row }) => (
          <div className="text-xs whitespace-nowrap">
            <span className="font-medium text-slate-800">{row.original.po_mode}</span>
            {row.original.po_number && (
              <span className="font-mono text-slate-500"> · {row.original.po_number}</span>
            )}
          </div>
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
        accessorKey: 'technician_in_charge',
        header: 'Tech',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-slate-800 whitespace-nowrap">
            {row.original.technician_in_charge
              ? techMap.get(row.original.technician_in_charge) ?? '—'
              : 'Unassigned'}
          </span>
        ),
      },
      {
        accessorKey: 'po_received_date',
        header: 'P.O. Recv.',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.po_received_date)}
          </span>
        ),
      },
      {
        accessorKey: 'date_commitment',
        header: 'Due',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_commitment)}
          </span>
        ),
      },
      {
        accessorKey: 'date_sent_to_customer',
        header: 'Sent',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_sent_to_customer)}
          </span>
        ),
      },
      {
        accessorKey: 'date_received_signed_approval',
        header: 'Signed',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_received_signed_approval)}
          </span>
        ),
      },
      {
        id: 'deadline',
        header: 'State',
        cell: ({ row }) => (
          <DeadlineBadge
            commitmentDate={row.original.date_commitment}
            finishedDate={row.original.date_received_signed_approval}
          />
        ),
      },
      {
        accessorKey: 'remarks',
        header: 'Remarks',
        cell: ({ row }) => (
          <span className="block max-w-[130px] truncate text-xs text-slate-600" title={row.original.remarks ?? ''}>
            {row.original.remarks || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            {canPromote && (
              <button
                type="button"
                onClick={() => setPromoteRow(row.original)}
                aria-label={`Move ${row.original.rsqdf} to APQP`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                <span>To APQP</span>
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => openEdit(row.original)}
                aria-label={`Edit ${row.original.rsqdf}`}
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
                aria-label={`Delete ${row.original.rsqdf}`}
                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [techMap, canPromote, canEdit, canDelete, deleteRow, pushToast]
  );

  return (
    <>
      <DataTable
        title="Approval"
        subtitle="Customer approval document tracking (With P.O. or Without P.O.) prior to APQP First Run"
        data={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        technicians={technicians}
        getTechnicianId={(r) => r.technician_in_charge}
        getDeadlineStatusForRow={(r) =>
          getDeadlineStatus(r.date_commitment, r.date_received_signed_approval)
        }
        statusFilterOptions={[
          { label: 'With P.O.', value: 'With P.O.' },
          { label: 'Without P.O.', value: 'Without P.O.' },
        ]}
        getStatusValue={(r) => r.po_mode}
        canCreate={canCreate}
        createLabel="New Approval"
        onCreate={openCreate}
        onOpenExcel={(filtered) => setExcelRows(filtered)}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Approval · ${editing.rsqdf}` : 'New Approval Record'}
      >
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="a-mode" label="With / Without P.O.">
              <select id="a-mode" {...form.register('po_mode')} className={inputClass}>
                <option value="With P.O.">With P.O.</option>
                <option value="Without P.O.">Without P.O.</option>
              </select>
            </FormField>
            <FormField id="a-po" label="P.O. Number">
              <input id="a-po" {...form.register('po_number')} className={inputClass} placeholder="PO-88512" />
            </FormField>
            <FormField id="a-rsqdf" label="RSQDF" required error={form.formState.errors.rsqdf?.message}>
              <input id="a-rsqdf" {...form.register('rsqdf')} className={inputClass} />
            </FormField>
            <FormField id="a-tech" label="Technical In Charge">
              <select id="a-tech" {...form.register('technician_in_charge')} className={inputClass}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="a-cust" label="Customer" required error={form.formState.errors.customer?.message}>
              <input id="a-cust" {...form.register('customer')} className={inputClass} />
            </FormField>
            <FormField id="a-model" label="Model Name" required error={form.formState.errors.model_name?.message}>
              <input id="a-model" {...form.register('model_name')} className={inputClass} />
            </FormField>
            <FormField id="a-rec" label="P.O. Received / Request Date">
              <input id="a-rec" type="date" {...form.register('po_received_date')} className={inputClass} />
            </FormField>
            <FormField id="a-due" label="Commitment Date">
              <input id="a-due" type="date" {...form.register('date_commitment')} className={inputClass} />
            </FormField>
            <FormField id="a-sent" label="Date Sent to Customer">
              <input id="a-sent" type="date" {...form.register('date_sent_to_customer')} className={inputClass} />
            </FormField>
            <FormField id="a-signed" label="Date Received Signed Approval">
              <input id="a-signed" type="date" {...form.register('date_received_signed_approval')} className={inputClass} />
            </FormField>
          </div>
          <FormField id="a-rem" label="Remarks">
            <textarea id="a-rem" rows={2} {...form.register('remarks')} className={inputClass} />
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
              {editing ? 'Save Changes' : 'Create Approval'}
            </button>
          </div>
        </form>
      </Modal>

      {promoteRow && (
        <PromoteDialog
          open={Boolean(promoteRow)}
          onClose={() => setPromoteRow(null)}
          fromStage="approvals"
          recordId={promoteRow.id}
          rsqdf={promoteRow.rsqdf}
          customer={promoteRow.customer}
          modelName={promoteRow.model_name}
          defaultPo={promoteRow.po_number}
          availableTargets={[{ value: 'apqp', label: 'APQP (First Run) Stage' }]}
        />
      )}

      {excelRows && (
        <ExcelModal
          open={Boolean(excelRows)}
          onClose={() => setExcelRows(null)}
          title="Approval"
          filenamePrefix="approvals"
          columns={EXCEL_COLUMNS}
          filteredRows={excelRows as unknown as Record<string, unknown>[]}
          schema={approvalSchema}
          technicians={technicians}
          canImport={canCreate}
          onBatchImport={(valid) => batchImport.mutateAsync(valid)}
        />
      )}
    </>
  );
}
