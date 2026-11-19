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
import { quotationSchema } from '../../lib/schemas';
import type { QuotationRow } from '../../types/database.types';

type QuotationFormValues = {
  rsqdf: string;
  customer: string;
  model_name: string;
  record_type: 'Sample' | 'Quotation';
  reference_number: string | null;
  technician_in_charge: string | null;
  date_requested: string | null;
  date_commitment: string | null;
  date_finished: string | null;
  remarks: string | null;
};

const EXCEL_COLUMNS = [
  { key: 'rsqdf', label: 'RSQDF', required: true },
  { key: 'customer', label: 'Customer', required: true },
  { key: 'model_name', label: 'Model Name', required: true },
  { key: 'record_type', label: 'Sample/Quotation Type' },
  { key: 'reference_number', label: 'Ref #' },
  { key: 'technician_in_charge', label: 'Technical In Charge' },
  { key: 'date_requested', label: 'Date Requested' },
  { key: 'date_commitment', label: 'Date Commitment' },
  { key: 'date_finished', label: 'Date Finished' },
  { key: 'remarks', label: 'Remarks' },
];

export function QuotationPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();
  const { data: rows = [], isLoading, error, refetch } = useStageRows<QuotationRow>('quotations');

  const createRow = useCreateStageRow<QuotationRow>('quotations');
  const updateRow = useUpdateStageRow<QuotationRow>('quotations');
  const deleteRow = useSoftDeleteStageRow('quotations');
  const batchImport = useBatchImportStageRows('quotations');

  const [editing, setEditing] = useState<QuotationRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [promoteRow, setPromoteRow] = useState<QuotationRow | null>(null);
  const [excelRows, setExcelRows] = useState<QuotationRow[] | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema) as never,
    defaultValues: {
      rsqdf: '',
      customer: '',
      model_name: '',
      record_type: 'Quotation',
      reference_number: '',
      technician_in_charge: '',
      date_requested: getTodayManilaISO(),
      date_commitment: '',
      date_finished: '',
      remarks: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      rsqdf: '',
      customer: '',
      model_name: '',
      record_type: 'Quotation',
      reference_number: '',
      technician_in_charge: '',
      date_requested: getTodayManilaISO(),
      date_commitment: '',
      date_finished: '',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: QuotationRow) => {
    setEditing(row);
    form.reset({
      rsqdf: row.rsqdf,
      customer: row.customer,
      model_name: row.model_name,
      record_type: row.record_type,
      reference_number: row.reference_number ?? '',
      technician_in_charge: row.technician_in_charge ?? '',
      date_requested: row.date_requested ?? '',
      date_commitment: row.date_commitment ?? '',
      date_finished: row.date_finished ?? '',
      remarks: row.remarks ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await updateRow.mutateAsync({ id: editing.id, payload: values });
        pushToast(`Updated quotation ${values.rsqdf}`);
      } else {
        await createRow.mutateAsync(values);
        pushToast(`Added quotation ${values.rsqdf}`);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message || 'Save failed', 'error');
    }
  });

  const canCreate = canCreateStageRecord(role, 'quotations');
  const canEdit = canEditStageRecord(role, 'quotations');
  const canDelete = canSoftDeleteStageRecord(role);
  const canPromote = canPromoteStage(role);

  const columns = useMemo<ColumnDef<QuotationRow, unknown>[]>(
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
      { accessorKey: 'customer', header: 'Customer' },
      { accessorKey: 'model_name', header: 'Model Name' },
      {
        accessorKey: 'record_type',
        header: 'Sample / Quotation',
        cell: ({ row }) => (
          <div className="text-xs">
            <span className="font-medium text-slate-800">{row.original.record_type}</span>
            {row.original.reference_number && (
              <span className="text-slate-500 font-mono"> · {row.original.reference_number}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'technician_in_charge',
        header: 'Tech In Charge',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-slate-800 whitespace-nowrap">
            {row.original.technician_in_charge
              ? techMap.get(row.original.technician_in_charge) ?? '—'
              : 'Unassigned'}
          </span>
        ),
      },
      {
        accessorKey: 'date_requested',
        header: 'Date Requested',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_requested)}
          </span>
        ),
      },
      {
        accessorKey: 'date_commitment',
        header: 'Date Commitment',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_commitment)}
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
            commitmentDate={row.original.date_commitment}
            finishedDate={row.original.date_finished}
          />
        ),
      },
      {
        accessorKey: 'remarks',
        header: 'Remarks',
        cell: ({ row }) => (
          <span className="text-xs text-slate-600 line-clamp-2 max-w-[200px]">
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
                aria-label={`Move ${row.original.rsqdf} to next stage`}
                title="Move to next stage"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                <span>Promote</span>
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
        title="Quotation"
        subtitle="Costing and initial technical quotation requests before sample or P.O. confirmation"
        data={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        technicians={technicians}
        getTechnicianId={(r) => r.technician_in_charge}
        getDeadlineStatusForRow={(r) => getDeadlineStatus(r.date_commitment, r.date_finished)}
        statusFilterOptions={[
          { label: 'Quotation', value: 'Quotation' },
          { label: 'Sample', value: 'Sample' },
        ]}
        getStatusValue={(r) => r.record_type}
        canCreate={canCreate}
        createLabel="New Quotation"
        onCreate={openCreate}
        onOpenExcel={(filtered) => setExcelRows(filtered)}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Quotation · ${editing.rsqdf}` : 'New Quotation Request'}
      >
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="q-rsqdf" label="RSQDF" required error={form.formState.errors.rsqdf?.message}>
              <input id="q-rsqdf" {...form.register('rsqdf')} className={inputClass} placeholder="RSQDF-26-120" />
            </FormField>
            <FormField id="q-tech" label="Technical In Charge">
              <select id="q-tech" {...form.register('technician_in_charge')} className={inputClass}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="q-cust" label="Customer" required error={form.formState.errors.customer?.message}>
              <input id="q-cust" {...form.register('customer')} className={inputClass} />
            </FormField>
            <FormField id="q-model" label="Model Name" required error={form.formState.errors.model_name?.message}>
              <input id="q-model" {...form.register('model_name')} className={inputClass} />
            </FormField>
            <FormField id="q-type" label="Sample / Quotation Type">
              <select id="q-type" {...form.register('record_type')} className={inputClass}>
                <option value="Quotation">Quotation</option>
                <option value="Sample">Sample</option>
              </select>
            </FormField>
            <FormField id="q-ref" label="Reference # (Optional)">
              <input id="q-ref" {...form.register('reference_number')} className={inputClass} placeholder="QT-26-0450" />
            </FormField>
            <FormField id="q-req" label="Date Requested">
              <input id="q-req" type="date" {...form.register('date_requested')} className={inputClass} />
            </FormField>
            <FormField id="q-due" label="Date Commitment">
              <input id="q-due" type="date" {...form.register('date_commitment')} className={inputClass} />
            </FormField>
            <FormField id="q-fin" label="Date Finished">
              <input id="q-fin" type="date" {...form.register('date_finished')} className={inputClass} />
            </FormField>
          </div>
          <FormField id="q-rem" label="Remarks">
            <textarea id="q-rem" rows={2} {...form.register('remarks')} className={inputClass} />
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
              {editing ? 'Save Changes' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {promoteRow && (
        <PromoteDialog
          open={Boolean(promoteRow)}
          onClose={() => setPromoteRow(null)}
          fromStage="quotations"
          recordId={promoteRow.id}
          rsqdf={promoteRow.rsqdf}
          customer={promoteRow.customer}
          modelName={promoteRow.model_name}
          defaultPo={promoteRow.reference_number}
          availableTargets={[
            { value: 'samples', label: 'Samples Stage' },
            { value: 'approvals', label: 'Approval Stage (Direct P.O.)' },
          ]}
        />
      )}

      {excelRows && (
        <ExcelModal
          open={Boolean(excelRows)}
          onClose={() => setExcelRows(null)}
          title="Quotation"
          filenamePrefix="quotations"
          columns={EXCEL_COLUMNS}
          filteredRows={excelRows as unknown as Record<string, unknown>[]}
          schema={quotationSchema}
          technicians={technicians}
          canImport={canCreate}
          onBatchImport={(valid) => batchImport.mutateAsync(valid)}
        />
      )}
    </>
  );
}
