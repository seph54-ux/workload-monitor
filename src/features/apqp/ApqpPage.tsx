import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { apqpSchema } from '../../lib/schemas';
import {
  APQP_STATUSES,
  TOOLING_CATEGORIES,
  type ApqpRow,
  type ApqpStatus,
  type ToolingCategory,
} from '../../types/database.types';

interface CommitmentFormItem {
  tooling_type: ToolingCategory;
  needed: boolean;
  commitment_date: string | null;
  remarks: string | null;
}

interface ApqpFormValues {
  rsqdf: string;
  customer: string;
  model_name: string;
  po_reference: string | null;
  date_received_signed_approval: string | null;
  technician_in_charge: string | null;
  status: ApqpStatus;
  meeting_date: string | null;
  item_code_requested_date: string | null;
  item_code_received_date: string | null;
  item_code: string | null;
  frrd_released_date: string | null;
  forwarded_to_ppqc_date: string | null;
  first_run_done_date: string | null;
  frrd_returned_date: string | null;
  forwarded_to_md_date: string | null;
  forwarded_to_ddcc_date: string | null;
  completed_date: string | null;
  date_commitment: string | null;
  remarks: string | null;
  tooling_commitments: CommitmentFormItem[];
}

const DEFAULT_COMMITMENTS: CommitmentFormItem[] = TOOLING_CATEGORIES.map((cat) => ({
  tooling_type: cat,
  needed: false,
  commitment_date: '',
  remarks: '',
}));

const EXCEL_COLUMNS = [
  { key: 'rsqdf', label: 'RSQDF', required: true },
  { key: 'po_reference', label: 'P.O. Reference' },
  { key: 'customer', label: 'Customer', required: true },
  { key: 'model_name', label: 'Model Name', required: true },
  { key: 'technician_in_charge', label: 'Tech In Charge' },
  { key: 'status', label: 'Status' },
  { key: 'date_received_signed_approval', label: 'Signed Approval Date' },
  { key: 'item_code', label: 'Item Code' },
  { key: 'date_commitment', label: 'Commitment Date' },
  { key: 'remarks', label: 'Remarks' },
];

export function ApqpPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();
  const { data: rows = [], isLoading, error, refetch } = useStageRows<ApqpRow>('apqp');

  const createRow = useCreateStageRow<ApqpRow>('apqp');
  const updateRow = useUpdateStageRow<ApqpRow>('apqp');
  const deleteRow = useSoftDeleteStageRow('apqp');
  const batchImport = useBatchImportStageRows('apqp');

  const [editing, setEditing] = useState<ApqpRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [promoteRow, setPromoteRow] = useState<ApqpRow | null>(null);
  const [excelRows, setExcelRows] = useState<ApqpRow[] | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);

  const form = useForm<ApqpFormValues>({
    resolver: zodResolver(apqpSchema) as never,
    defaultValues: {
      rsqdf: '',
      customer: '',
      model_name: '',
      po_reference: '',
      date_received_signed_approval: getTodayManilaISO(),
      technician_in_charge: '',
      status: 'Waiting for Meeting',
      meeting_date: '',
      item_code_requested_date: '',
      item_code_received_date: '',
      item_code: '',
      frrd_released_date: '',
      forwarded_to_ppqc_date: '',
      first_run_done_date: '',
      frrd_returned_date: '',
      forwarded_to_md_date: '',
      forwarded_to_ddcc_date: '',
      completed_date: '',
      date_commitment: '',
      remarks: '',
      tooling_commitments: DEFAULT_COMMITMENTS,
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'tooling_commitments',
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      rsqdf: '',
      customer: '',
      model_name: '',
      po_reference: '',
      date_received_signed_approval: getTodayManilaISO(),
      technician_in_charge: '',
      status: 'Waiting for Meeting',
      meeting_date: '',
      item_code_requested_date: '',
      item_code_received_date: '',
      item_code: '',
      frrd_released_date: '',
      forwarded_to_ppqc_date: '',
      first_run_done_date: '',
      frrd_returned_date: '',
      forwarded_to_md_date: '',
      forwarded_to_ddcc_date: '',
      completed_date: '',
      date_commitment: '',
      remarks: '',
      tooling_commitments: DEFAULT_COMMITMENTS,
    });
    setModalOpen(true);
  };

  const openEdit = (row: ApqpRow) => {
    setEditing(row);
    const commitments = TOOLING_CATEGORIES.map((cat) => {
      const existing = row.tooling_commitments?.find((c) => c.tooling_type === cat);
      return {
        tooling_type: cat,
        needed: existing?.needed ?? false,
        commitment_date: existing?.commitment_date ?? '',
        remarks: existing?.remarks ?? '',
      };
    });
    form.reset({
      rsqdf: row.rsqdf,
      customer: row.customer,
      model_name: row.model_name,
      po_reference: row.po_reference ?? '',
      date_received_signed_approval: row.date_received_signed_approval ?? '',
      technician_in_charge: row.technician_in_charge ?? '',
      status: row.status,
      meeting_date: row.meeting_date ?? '',
      item_code_requested_date: row.item_code_requested_date ?? '',
      item_code_received_date: row.item_code_received_date ?? '',
      item_code: row.item_code ?? '',
      frrd_released_date: row.frrd_released_date ?? '',
      forwarded_to_ppqc_date: row.forwarded_to_ppqc_date ?? '',
      first_run_done_date: row.first_run_done_date ?? '',
      frrd_returned_date: row.frrd_returned_date ?? '',
      forwarded_to_md_date: row.forwarded_to_md_date ?? '',
      forwarded_to_ddcc_date: row.forwarded_to_ddcc_date ?? '',
      completed_date: row.completed_date ?? '',
      date_commitment: row.date_commitment ?? '',
      remarks: row.remarks ?? '',
      tooling_commitments: commitments,
    });
    setModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await updateRow.mutateAsync({ id: editing.id, payload: values as unknown as Record<string, unknown> });
        pushToast(`Updated APQP ${values.rsqdf}`);
      } else {
        await createRow.mutateAsync(values as unknown as Record<string, unknown>);
        pushToast(`Created APQP ${values.rsqdf}`);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message || 'Save failed', 'error');
    }
  });

  const canCreate = canCreateStageRecord(role, 'apqp');
  const canEdit = canEditStageRecord(role, 'apqp');
  const canDelete = canSoftDeleteStageRecord(role);
  const canPromote = canPromoteStage(role);

  const columns = useMemo<ColumnDef<ApqpRow, unknown>[]>(
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
        accessorKey: 'po_reference',
        header: 'P.O. Ref',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-600 whitespace-nowrap">
            {row.original.po_reference || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="max-w-[130px] truncate text-xs font-medium text-slate-800" title={row.original.customer}>
            {row.original.customer}
          </div>
        ),
      },
      {
        accessorKey: 'model_name',
        header: 'Model Name',
        cell: ({ row }) => (
          <div className="max-w-[145px] truncate text-xs text-slate-700" title={row.original.model_name}>
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
        accessorKey: 'status',
        header: 'APQP Status',
        cell: ({ row }) => (
          <div className="text-xs whitespace-nowrap">
            <span className="font-semibold text-slate-900">{row.original.status}</span>
            {row.original.item_code && (
              <span className="font-mono text-slate-500"> · {row.original.item_code}</span>
            )}
          </div>
        ),
      },
      {
        id: 'tooling_needed',
        header: 'Tooling',
        cell: ({ row }) => {
          const needed = (row.original.tooling_commitments ?? []).filter((c) => c.needed);
          if (needed.length === 0) return <span className="text-xs text-slate-400">None</span>;
          const text = needed.map((n) => n.tooling_type).join(' · ');
          return (
            <span className="block max-w-[120px] truncate text-xs text-slate-700" title={text}>
              {text}
            </span>
          );
        },
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
        accessorKey: 'date_commitment',
        header: 'Target Due',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.date_commitment)}
          </span>
        ),
      },
      {
        id: 'deadline',
        header: 'State',
        cell: ({ row }) => (
          <DeadlineBadge
            commitmentDate={row.original.date_commitment}
            finishedDate={row.original.completed_date}
          />
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
                aria-label={`Generate Tooling and CNC for ${row.original.rsqdf}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                <span>Tooling/CNC</span>
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
        title="APQP (First Run)"
        subtitle="First-run coordination from Manager/Leader meeting through Item Code, FRRD, PPQC, MD, and DDCC"
        data={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        technicians={technicians}
        getTechnicianId={(r) => r.technician_in_charge}
        getDeadlineStatusForRow={(r) => getDeadlineStatus(r.date_commitment, r.completed_date)}
        statusFilterOptions={APQP_STATUSES.map((s) => ({ label: s, value: s }))}
        getStatusValue={(r) => r.status}
        canCreate={canCreate}
        createLabel="New APQP"
        onCreate={openCreate}
        onOpenExcel={(filtered) => setExcelRows(filtered)}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit APQP · ${editing.rsqdf}` : 'New APQP (First Run) Record'}
        maxWidthClass="max-w-4xl"
      >
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField id="ap-rsqdf" label="RSQDF" required error={form.formState.errors.rsqdf?.message}>
              <input id="ap-rsqdf" {...form.register('rsqdf')} className={inputClass} />
            </FormField>
            <FormField id="ap-po" label="P.O. Reference">
              <input id="ap-po" {...form.register('po_reference')} className={inputClass} />
            </FormField>
            <FormField id="ap-tech" label="Technical In Charge">
              <select id="ap-tech" {...form.register('technician_in_charge')} className={inputClass}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="ap-cust" label="Customer" required error={form.formState.errors.customer?.message}>
              <input id="ap-cust" {...form.register('customer')} className={inputClass} />
            </FormField>
            <FormField id="ap-model" label="Model Name" required error={form.formState.errors.model_name?.message}>
              <input id="ap-model" {...form.register('model_name')} className={inputClass} />
            </FormField>
            <FormField id="ap-status" label="APQP Status">
              <select id="ap-status" {...form.register('status')} className={inputClass}>
                {APQP_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="ap-signed" label="Signed Approval Date">
              <input id="ap-signed" type="date" {...form.register('date_received_signed_approval')} className={inputClass} />
            </FormField>
            <FormField id="ap-due" label="Overall Target Commitment">
              <input id="ap-due" type="date" {...form.register('date_commitment')} className={inputClass} />
            </FormField>
            <FormField id="ap-ic" label="Item Code">
              <input id="ap-ic" {...form.register('item_code')} className={inputClass} placeholder="IC-48021" />
            </FormField>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-xs font-semibold text-slate-800 mb-2.5">Milestone Dates</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <FormField id="d-mtg" label="Meeting">
                <input id="d-mtg" type="date" {...form.register('meeting_date')} className={inputClass} />
              </FormField>
              <FormField id="d-icreq" label="IC Requested">
                <input id="d-icreq" type="date" {...form.register('item_code_requested_date')} className={inputClass} />
              </FormField>
              <FormField id="d-icrec" label="IC Received">
                <input id="d-icrec" type="date" {...form.register('item_code_received_date')} className={inputClass} />
              </FormField>
              <FormField id="d-frrd" label="FRRD Released">
                <input id="d-frrd" type="date" {...form.register('frrd_released_date')} className={inputClass} />
              </FormField>
              <FormField id="d-ppqc" label="To PPQC">
                <input id="d-ppqc" type="date" {...form.register('forwarded_to_ppqc_date')} className={inputClass} />
              </FormField>
              <FormField id="d-frdone" label="First Run Done">
                <input id="d-frdone" type="date" {...form.register('first_run_done_date')} className={inputClass} />
              </FormField>
              <FormField id="d-ret" label="FRRD Returned">
                <input id="d-ret" type="date" {...form.register('frrd_returned_date')} className={inputClass} />
              </FormField>
              <FormField id="d-md" label="To MD">
                <input id="d-md" type="date" {...form.register('forwarded_to_md_date')} className={inputClass} />
              </FormField>
              <FormField id="d-ddcc" label="To DDCC">
                <input id="d-ddcc" type="date" {...form.register('forwarded_to_ddcc_date')} className={inputClass} />
              </FormField>
              <FormField id="d-comp" label="Completed">
                <input id="d-comp" type="date" {...form.register('completed_date')} className={inputClass} />
              </FormField>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-xs font-semibold text-slate-800 mb-2">
              Tooling Commitments (5 Sub-Items)
            </h3>
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Tooling Type</th>
                    <th className="px-3 py-2 font-semibold">Needed</th>
                    <th className="px-3 py-2 font-semibold">Commitment Date</th>
                    <th className="px-3 py-2 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {fields.map((field, idx) => (
                    <tr key={field.id} className="bg-white">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {field.tooling_type}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`${field.tooling_type} needed`}
                          {...form.register(`tooling_commitments.${idx}.needed`)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          aria-label={`${field.tooling_type} commitment date`}
                          {...form.register(`tooling_commitments.${idx}.commitment_date`)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          aria-label={`${field.tooling_type} remarks`}
                          {...form.register(`tooling_commitments.${idx}.remarks`)}
                          placeholder="Spec / cavity / notes"
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <FormField id="ap-rem" label="Remarks">
            <textarea id="ap-rem" rows={2} {...form.register('remarks')} className={inputClass} />
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
              {editing ? 'Save Changes' : 'Create APQP'}
            </button>
          </div>
        </form>
      </Modal>

      {promoteRow && (
        <PromoteDialog
          open={Boolean(promoteRow)}
          onClose={() => setPromoteRow(null)}
          fromStage="apqp"
          recordId={promoteRow.id}
          rsqdf={promoteRow.rsqdf}
          customer={promoteRow.customer}
          modelName={promoteRow.model_name}
          defaultPo={promoteRow.po_reference}
          availableTargets={[
            {
              value: 'tooling_and_cnc',
              label: 'Create Tooling Rows (from Needed Commitments) + Optional CNC',
            },
          ]}
        />
      )}

      {excelRows && (
        <ExcelModal
          open={Boolean(excelRows)}
          onClose={() => setExcelRows(null)}
          title="APQP"
          filenamePrefix="apqp"
          columns={EXCEL_COLUMNS}
          filteredRows={excelRows as unknown as Record<string, unknown>[]}
          schema={apqpSchema}
          technicians={technicians}
          canImport={canCreate}
          onBatchImport={(valid) => batchImport.mutateAsync(valid)}
        />
      )}
    </>
  );
}
