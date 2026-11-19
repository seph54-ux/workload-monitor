import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '../../lib/table';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
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
import { formatManilaDate, formatObTime, getTodayManilaISO } from '../../lib/dates';
import { canCreateStageRecord, canEditStageRecord, canSoftDeleteStageRecord } from '../../lib/roles';
import { obSchema } from '../../lib/schemas';
import type { OfficialBusinessRow } from '../../types/database.types';

interface ObFormValues {
  customer: string;
  ob_date: string;
  ob_time: string | null;
  technician_in_charge: string | null;
  sales_in_charge: string | null;
  purpose: string;
  remarks: string | null;
}

const EXCEL_COLUMNS = [
  { key: 'customer', label: 'Customer', required: true },
  { key: 'ob_date', label: 'Date', required: true },
  { key: 'ob_time', label: 'Time' },
  { key: 'technician_in_charge', label: 'Tech In Charge' },
  { key: 'sales_in_charge', label: 'Sales In Charge' },
  { key: 'purpose', label: 'Purpose / Design Development', required: true },
  { key: 'remarks', label: 'Remarks' },
];

export function ObPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();
  const { data: rows = [], isLoading, error, refetch } =
    useStageRows<OfficialBusinessRow>('official_business');

  const createRow = useCreateStageRow<OfficialBusinessRow>('official_business');
  const updateRow = useUpdateStageRow<OfficialBusinessRow>('official_business');
  const deleteRow = useSoftDeleteStageRow('official_business');
  const batchImport = useBatchImportStageRows('official_business');

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() =>
    parseISO(`${getTodayManilaISO().slice(0, 7)}-01`)
  );
  const [editing, setEditing] = useState<OfficialBusinessRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [excelRows, setExcelRows] = useState<OfficialBusinessRow[] | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);

  const form = useForm<ObFormValues>({
    resolver: zodResolver(obSchema) as never,
    defaultValues: {
      customer: '',
      ob_date: getTodayManilaISO(),
      ob_time: '09:00',
      technician_in_charge: '',
      sales_in_charge: '',
      purpose: '',
      remarks: '',
    },
  });

  const openCreate = (presetDate?: string) => {
    setEditing(null);
    form.reset({
      customer: '',
      ob_date: presetDate ?? getTodayManilaISO(),
      ob_time: '09:00',
      technician_in_charge: '',
      sales_in_charge: '',
      purpose: '',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: OfficialBusinessRow) => {
    setEditing(row);
    form.reset({
      customer: row.customer,
      ob_date: row.ob_date,
      ob_time: row.ob_time ? row.ob_time.slice(0, 5) : '',
      technician_in_charge: row.technician_in_charge ?? '',
      sales_in_charge: row.sales_in_charge ?? '',
      purpose: row.purpose,
      remarks: row.remarks ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await updateRow.mutateAsync({
          id: editing.id,
          payload: values as unknown as Record<string, unknown>,
        });
        pushToast(`Updated O.B. for ${values.customer}`);
      } else {
        await createRow.mutateAsync(values as unknown as Record<string, unknown>);
        pushToast(`Logged O.B. for ${values.customer}`);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message || 'Save failed', 'error');
    }
  });

  const canCreate = canCreateStageRecord(role, 'official_business');
  const canEdit = canEditStageRecord(role, 'official_business');
  const canDelete = canSoftDeleteStageRecord(role);

  const columns = useMemo<ColumnDef<OfficialBusinessRow, unknown>[]>(
    () => [
      { accessorKey: 'customer', header: 'Customer' },
      {
        accessorKey: 'ob_date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatManilaDate(row.original.ob_date)}
          </span>
        ),
      },
      {
        accessorKey: 'ob_time',
        header: 'Time',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {formatObTime(row.original.ob_time)}
          </span>
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
        accessorKey: 'sales_in_charge',
        header: 'Sales In Charge',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 whitespace-nowrap">
            {row.original.sales_in_charge || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'purpose',
        header: 'Purpose / Design Development',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 max-w-xs line-clamp-2">
            {row.original.purpose}
          </span>
        ),
      },
      {
        accessorKey: 'remarks',
        header: 'Remarks',
        cell: ({ row }) => (
          <span className="text-xs text-slate-500 max-w-xs line-clamp-2">
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
            {canEdit && (
              <button
                type="button"
                onClick={() => openEdit(row.original)}
                aria-label={`Edit O.B. ${row.original.customer}`}
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
                    pushToast(`Removed O.B. for ${row.original.customer}`);
                  } catch (err) {
                    pushToast((err as Error).message, 'error');
                  }
                }}
                aria-label={`Delete O.B. ${row.original.customer}`}
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

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, OfficialBusinessRow[]>();
    for (const r of rows) {
      const list = map.get(r.ob_date) ?? [];
      list.push(r);
      map.set(r.ob_date, list);
    }
    return map;
  }, [rows]);

  const viewSwitcher = (
    <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md">
      <button
        type="button"
        onClick={() => setViewMode('table')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded ${
          viewMode === 'table'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Table2 className="w-3.5 h-3.5" />
        <span>Table</span>
      </button>
      <button
        type="button"
        onClick={() => setViewMode('calendar')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded ${
          viewMode === 'calendar'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <CalendarDays className="w-3.5 h-3.5" />
        <span>Calendar</span>
      </button>
    </div>
  );

  return (
    <>
      {viewMode === 'table' ? (
        <DataTable
          title="O.B. (Official Business)"
          subtitle="Customer site visits, line trials, and engineering field trips"
          data={rows}
          columns={columns}
          isLoading={isLoading}
          error={error as Error | null}
          onRetry={() => void refetch()}
          technicians={technicians}
          getTechnicianId={(r) => r.technician_in_charge}
          canCreate={canCreate}
          createLabel="Log O.B."
          onCreate={() => openCreate()}
          onOpenExcel={(filtered) => setExcelRows(filtered)}
          searchPlaceholder="Search customer, sales, purpose..."
          toolbarExtra={viewSwitcher}
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                O.B. Calendar
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Monthly schedule of customer visits and official business trips
              </p>
            </div>
            <div className="flex items-center gap-2">
              {viewSwitcher}
              {canCreate && (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log O.B.</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/70">
              <h2 className="text-sm font-semibold text-slate-900">
                {format(calendarMonth, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                  aria-label="Previous month"
                  className="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(parseISO(`${getTodayManilaISO().slice(0, 7)}-01`))
                  }
                  className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded hover:bg-slate-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                  aria-label="Next month"
                  className="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
              {calendarDays.map((day) => {
                const dateIso = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateIso) ?? [];
                const inMonth = isSameMonth(day, calendarMonth);
                return (
                  <div
                    key={dateIso}
                    className={`min-h-[104px] p-2 flex flex-col gap-1 ${
                      inMonth ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          inMonth ? 'text-slate-800 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => openCreate(dateIso)}
                          aria-label={`Add O.B. on ${dateIso}`}
                          className="text-[11px] text-slate-400 hover:text-blue-700 px-1"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => (canEdit ? openEdit(ev) : undefined)}
                          className="w-full text-left px-1.5 py-1 rounded bg-blue-50 border border-blue-200/80 hover:bg-blue-100/80 transition-colors"
                        >
                          <div className="text-[11px] font-semibold text-blue-950 truncate">
                            {ev.ob_time ? `${formatObTime(ev.ob_time)} · ` : ''}
                            {ev.customer}
                          </div>
                          <div className="text-[10px] text-blue-800 truncate">
                            {ev.technician_in_charge
                              ? techMap.get(ev.technician_in_charge) ?? 'Tech'
                              : 'Unassigned'}{' '}
                            · {ev.purpose}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit O.B. · ${editing.customer}` : 'Log Official Business (O.B.)'}
      >
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="ob-cust" label="Customer" required error={form.formState.errors.customer?.message}>
              <input id="ob-cust" {...form.register('customer')} className={inputClass} />
            </FormField>
            <FormField id="ob-tech" label="Tech In Charge">
              <select id="ob-tech" {...form.register('technician_in_charge')} className={inputClass}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="ob-date" label="Date" required error={form.formState.errors.ob_date?.message}>
              <input id="ob-date" type="date" {...form.register('ob_date')} className={inputClass} />
            </FormField>
            <FormField id="ob-time" label="Time">
              <input id="ob-time" type="time" {...form.register('ob_time')} className={inputClass} />
            </FormField>
            <FormField id="ob-sales" label="Sales In Charge">
              <input id="ob-sales" {...form.register('sales_in_charge')} className={inputClass} placeholder="e.g. Ms. Carla Reyes" />
            </FormField>
          </div>
          <FormField id="ob-purpose" label="Purpose / Design Development" required error={form.formState.errors.purpose?.message}>
            <textarea id="ob-purpose" rows={2} {...form.register('purpose')} className={inputClass} />
          </FormField>
          <FormField id="ob-rem" label="Remarks">
            <textarea id="ob-rem" rows={2} {...form.register('remarks')} className={inputClass} />
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
              {editing ? 'Save Changes' : 'Log O.B.'}
            </button>
          </div>
        </form>
      </Modal>

      {excelRows && (
        <ExcelModal
          open={Boolean(excelRows)}
          onClose={() => setExcelRows(null)}
          title="Official Business"
          filenamePrefix="official-business"
          columns={EXCEL_COLUMNS}
          filteredRows={excelRows as unknown as Record<string, unknown>[]}
          schema={obSchema}
          technicians={technicians}
          canImport={canCreate}
          onBatchImport={(valid) => batchImport.mutateAsync(valid)}
        />
      )}
    </>
  );
}
