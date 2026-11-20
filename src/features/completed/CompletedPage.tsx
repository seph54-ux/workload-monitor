import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Pencil,
  RotateCcw,
  Search,
  Table2,
  Wrench,
} from 'lucide-react';
import { FormField, inputClass } from '../../components/FormFields';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useCreateTrfWithLinks,
  useStageRows,
  useTechnicians,
  useUpdateCompletedItemStatus,
  useWorkspaceContext,
} from '../../data/hooks';
import {
  APQP_REOPEN_STATUSES,
  COMPLETED_CATEGORIES,
  TRF_REOPEN_STATUSES,
  buildCompletedStatusPatch,
  collectCompletedItems,
  countCompletedByCategory,
  type CompletedCategory,
  type CompletedItem,
} from '../../lib/completed';
import { formatManilaDate, getTodayManilaISO } from '../../lib/dates';
import { exportRowsToXlsx } from '../../lib/excel';
import { canCreateStageRecord, canEditStageRecord } from '../../lib/roles';
import {
  TOOLING_CATEGORIES,
  type ApqpRow,
  type ApqpStatus,
  type ApprovalRow,
  type CncRow,
  type QuotationRow,
  type SampleRow,
  type ToolingCategory,
  type ToolingExecutionMode,
  type ToolingRow,
  type TrfLogRow,
  type TrfStatus,
} from '../../types/database.types';

const CATEGORY_BADGE_CLASS: Record<CompletedCategory, string> = {
  samples: 'bg-sky-50 text-sky-800 border-sky-200',
  quotations: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  approvals: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  apqp: 'bg-violet-50 text-violet-800 border-violet-200',
  tooling: 'bg-amber-50 text-amber-800 border-amber-200',
  cnc: 'bg-slate-100 text-slate-800 border-slate-300',
  trf_logs: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function CompletedPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const { data: technicians = [] } = useTechnicians();

  const samplesQuery = useStageRows<SampleRow>('samples');
  const quotationsQuery = useStageRows<QuotationRow>('quotations');
  const approvalsQuery = useStageRows<ApprovalRow>('approvals');
  const apqpQuery = useStageRows<ApqpRow>('apqp');
  const toolingQuery = useStageRows<ToolingRow>('tooling');
  const cncQuery = useStageRows<CncRow>('cnc');
  const trfQuery = useStageRows<TrfLogRow>('trf_logs');

  const updateCompleted = useUpdateCompletedItemStatus();
  const createTrf = useCreateTrfWithLinks();

  const [selectedCategory, setSelectedCategory] = useState<'ALL' | CompletedCategory>('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [techFilter, setTechFilter] = useState('ALL');

  // Edit Status / Reopen Modal state
  const [editingItem, setEditingItem] = useState<CompletedItem | null>(null);
  const [actionMode, setActionMode] = useState<'keep_completed' | 'reopen'>('reopen');
  const [editCompletedDate, setEditCompletedDate] = useState('');
  const [editCommitmentDate, setEditCommitmentDate] = useState('');
  const [editTechId, setEditTechId] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editApqpStatus, setEditApqpStatus] = useState<ApqpStatus>('Forwarded to MD');
  const [editTrfStatus, setEditTrfStatus] = useState<TrfStatus>('In MD');
  const [editExecutionMode, setEditExecutionMode] = useState<ToolingExecutionMode>('In House');

  // File TRF Revision Modal state
  const [trfTarget, setTrfTarget] = useState<CompletedItem | null>(null);
  const [trfNumber, setTrfNumber] = useState('');
  const [trfReason, setTrfReason] = useState('');
  const [trfRequiresMd, setTrfRequiresMd] = useState(true);
  const [trfRequiresTooling, setTrfRequiresTooling] = useState(false);
  const [trfToolingType, setTrfToolingType] = useState<ToolingCategory>('Die Cut');
  const [trfToolingMode, setTrfToolingMode] = useState<ToolingExecutionMode>('In House');
  const [trfToolingCommitment, setTrfToolingCommitment] = useState('');

  const techMap = useMemo(
    () => new Map(technicians.map((t) => [t.id, t.name])),
    [technicians]
  );

  const isLoading =
    samplesQuery.isLoading ||
    quotationsQuery.isLoading ||
    approvalsQuery.isLoading ||
    apqpQuery.isLoading ||
    toolingQuery.isLoading ||
    cncQuery.isLoading ||
    trfQuery.isLoading;

  const allCompleted = useMemo(
    () =>
      collectCompletedItems({
        samples: samplesQuery.data ?? [],
        quotations: quotationsQuery.data ?? [],
        approvals: approvalsQuery.data ?? [],
        apqp: apqpQuery.data ?? [],
        tooling: toolingQuery.data ?? [],
        cnc: cncQuery.data ?? [],
        trf_logs: trfQuery.data ?? [],
      }),
    [
      samplesQuery.data,
      quotationsQuery.data,
      approvalsQuery.data,
      apqpQuery.data,
      toolingQuery.data,
      cncQuery.data,
      trfQuery.data,
    ]
  );

  const categoryCounts = useMemo(
    () => countCompletedByCategory(allCompleted),
    [allCompleted]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allCompleted.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (techFilter !== 'ALL' && item.technicianId !== techFilter) return false;
      if (q) {
        const techName = item.technicianId ? techMap.get(item.technicianId) ?? '' : '';
        const haystack = [
          item.categoryLabel,
          item.rsqdf,
          item.customer,
          item.modelName,
          item.referenceSummary,
          item.statusText,
          item.remarks ?? '',
          techName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allCompleted, selectedCategory, techFilter, searchQuery, techMap]);

  const groupedSections = useMemo(() => {
    const categoriesToRender =
      selectedCategory === 'ALL'
        ? COMPLETED_CATEGORIES
        : COMPLETED_CATEGORIES.filter((c) => c.key === selectedCategory);
    return categoriesToRender
      .map((meta) => ({
        meta,
        items: filteredItems.filter((item) => item.category === meta.key),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredItems, selectedCategory]);

  const canFileTrf = canCreateStageRecord(role, 'trf_logs');

  const openEditStatusModal = (item: CompletedItem) => {
    setEditingItem(item);
    setActionMode('reopen');
    setEditCompletedDate(item.completedDate ?? getTodayManilaISO());
    setEditCommitmentDate(item.commitmentDate ?? '');
    setEditTechId(item.technicianId ?? '');
    setEditRemarks(item.remarks ?? '');
    if (item.category === 'apqp') {
      setEditApqpStatus('Forwarded to MD');
    }
    if (item.category === 'trf_logs') {
      setEditTrfStatus('In MD');
    }
    if (item.category === 'tooling') {
      setEditExecutionMode((item.raw as ToolingRow).execution_mode);
    }
  };

  const openFileTrfModal = (item: CompletedItem) => {
    setTrfTarget(item);
    setTrfNumber(`TRF-${new Date().getFullYear()}-`);
    setTrfReason('');
    setTrfRequiresMd(true);
    setTrfRequiresTooling(item.category === 'tooling');
    setTrfToolingType(
      item.category === 'tooling'
        ? (item.raw as ToolingRow).tooling_type
        : 'Die Cut'
    );
    setTrfToolingMode('In House');
    setTrfToolingCommitment('');
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const patch = buildCompletedStatusPatch(
        editingItem,
        {
          actionMode,
          completedDate: editCompletedDate,
          commitmentDate: editCommitmentDate,
          technicianId: editTechId || null,
          remarks: editRemarks,
          apqpStatus:
            editingItem.category === 'apqp'
              ? actionMode === 'reopen'
                ? editApqpStatus
                : 'Completed'
              : undefined,
          trfStatus:
            editingItem.category === 'trf_logs'
              ? actionMode === 'reopen'
                ? editTrfStatus
                : 'Completed'
              : undefined,
          toolingExecutionMode:
            editingItem.category === 'tooling' ? editExecutionMode : undefined,
        },
        role,
        getTodayManilaISO()
      );

      await updateCompleted.mutateAsync({
        table: editingItem.category,
        id: editingItem.id,
        rsqdf: editingItem.rsqdf,
        payload: patch,
      });

      pushToast(
        actionMode === 'reopen'
          ? `Reopened ${editingItem.rsqdf} (${editingItem.categoryLabel}) for revision`
          : `Updated completed ${editingItem.categoryLabel} record (${editingItem.rsqdf})`
      );
      setEditingItem(null);
    } catch (err) {
      pushToast((err as Error).message || 'Failed to update status', 'error');
    }
  };

  const handleSubmitTrf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trfTarget) return;
    if (!trfNumber.trim() || !trfReason.trim()) {
      pushToast('TRF # and Reason for Revision are required', 'error');
      return;
    }
    try {
      const res = await createTrf.mutateAsync({
        trf_number: trfNumber.trim(),
        rsqdf: trfTarget.rsqdf,
        customer: trfTarget.customer,
        model_name: trfTarget.modelName,
        technician_in_charge: trfTarget.technicianId || null,
        date_filed: getTodayManilaISO(),
        reason_for_revision: trfReason.trim(),
        requires_tooling: trfRequiresTooling,
        tooling_type: trfRequiresTooling ? trfToolingType : null,
        tooling_commitment_date: trfRequiresTooling ? trfToolingCommitment || null : null,
        execution_mode: trfToolingMode,
        requires_md_revision: trfRequiresMd,
        status: trfRequiresTooling ? 'In Tooling' : trfRequiresMd ? 'In MD' : 'Filed',
        date_completed: null,
        remarks: `Filed from Completed (${trfTarget.categoryLabel})`,
      });
      pushToast(
        res.toolingId
          ? `Filed ${trfNumber.trim()} and created linked Tooling rework job`
          : `Filed ${trfNumber.trim()} for ${trfTarget.rsqdf}`
      );
      setTrfTarget(null);
    } catch (err) {
      pushToast((err as Error).message || 'Failed to file TRF', 'error');
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredItems.map((item) => ({
      category: item.categoryLabel,
      rsqdf: item.rsqdf,
      customer: item.customer,
      model_name: item.modelName,
      details: item.referenceSummary,
      technician: item.technicianId ? techMap.get(item.technicianId) ?? '' : '',
      completed_date: item.completedDate ?? '',
      status: item.statusText,
      remarks: item.remarks ?? '',
    }));
    exportRowsToXlsx('completed-items.xlsx', 'Completed Items', exportData, [
      { key: 'category', label: 'Category' },
      { key: 'rsqdf', label: 'RSQDF' },
      { key: 'customer', label: 'Customer' },
      { key: 'model_name', label: 'Model Name' },
      { key: 'details', label: 'Details / Ref #' },
      { key: 'technician', label: 'Tech In Charge' },
      { key: 'completed_date', label: 'Completed Date' },
      { key: 'status', label: 'Status' },
      { key: 'remarks', label: 'Remarks' },
    ]);
    pushToast(`Exported ${exportData.length} completed records`);
  };

  const isRoleRestrictedCategory =
    editingItem !== null &&
    ((role === 'TOOLING' && editingItem.category === 'tooling') ||
      (role === 'CNC' && editingItem.category === 'cnc'));

  const renderRowsTable = (items: CompletedItem[], showCategoryColumn: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {showCategoryColumn && <th className="py-2.5 px-2.5 whitespace-nowrap">Category</th>}
            <th className="py-2.5 px-2.5 whitespace-nowrap">RSQDF</th>
            <th className="py-2.5 px-2.5 whitespace-nowrap">Customer / Model</th>
            <th className="py-2.5 px-2.5 whitespace-nowrap">Details</th>
            <th className="py-2.5 px-2.5 whitespace-nowrap">Tech</th>
            <th className="py-2.5 px-2.5 whitespace-nowrap">Completed</th>
            <th className="py-2.5 px-2.5 whitespace-nowrap">Status</th>
            <th className="py-2.5 px-2.5 whitespace-nowrap">Remarks</th>
            <th className="py-2.5 px-2.5 whitespace-nowrap text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {items.map((item) => {
            const canEdit = canEditStageRecord(role, item.category);
            return (
              <tr key={item.uid} className="hover:bg-slate-50/70 transition-colors">
                {showCategoryColumn && (
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 text-[11px] font-medium border rounded ${CATEGORY_BADGE_CLASS[item.category]}`}
                    >
                      {item.categoryLabel}
                    </span>
                  </td>
                )}
                <td className="py-2 px-2.5 whitespace-nowrap">
                  <Link
                    to={`/item/${encodeURIComponent(item.rsqdf)}`}
                    className="font-mono font-semibold text-blue-700 hover:underline"
                  >
                    {item.rsqdf}
                  </Link>
                </td>
                <td className="py-2 px-2.5 max-w-[165px]">
                  <div className="font-medium text-slate-900 truncate" title={item.customer}>
                    {item.customer}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate" title={item.modelName}>
                    {item.modelName}
                  </div>
                </td>
                <td className="py-2 px-2.5 max-w-[155px]">
                  <div className="text-slate-700 truncate" title={item.referenceSummary}>
                    {item.referenceSummary}
                  </div>
                </td>
                <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">
                  {item.technicianId ? techMap.get(item.technicianId) ?? '—' : '—'}
                </td>
                <td className="py-2 px-2.5 font-mono text-slate-700 whitespace-nowrap">
                  {formatManilaDate(item.completedDate)}
                </td>
                <td className="py-2 px-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.statusText}</span>
                  </span>
                </td>
                <td className="py-2 px-2.5 max-w-[155px]">
                  <div className="text-slate-600 truncate" title={item.remarks ?? ''}>
                    {item.remarks || '—'}
                  </div>
                </td>
                <td className="py-2 px-2.5 whitespace-nowrap text-right">
                  <div className="inline-flex items-center gap-1">
                    <Link
                      to={`/item/${encodeURIComponent(item.rsqdf)}`}
                      aria-label={`Check timeline for ${item.rsqdf} (${item.categoryLabel})`}
                      title="Check RSQDF Timeline & Drawings"
                      className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-900"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditStatusModal(item)}
                        aria-label={`Edit status for ${item.rsqdf} (${item.categoryLabel})`}
                        title="Edit status or reopen for revision"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50/70 border border-blue-200 rounded hover:bg-blue-100/70"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canFileTrf && item.category !== 'trf_logs' && (
                      <button
                        type="button"
                        onClick={() => openFileTrfModal(item)}
                        aria-label={`File TRF revision for ${item.rsqdf} (${item.categoryLabel})`}
                        title="File TRF Revision"
                        className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded border border-slate-200 hover:border-amber-200"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Completed / Done Items
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Categorized archive of finished RSQDF records across all stages — inspect timelines, edit status, reopen for revision, or file a TRF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>By Category</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>All Table</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredItems.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Category Filter Strip */}
      <div
        className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-200 rounded-lg"
        role="tablist"
        aria-label="Completed categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'ALL'}
          onClick={() => setSelectedCategory('ALL')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>All Completed</span>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              selectedCategory === 'ALL' ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {categoryCounts.ALL}
          </span>
        </button>

        {COMPLETED_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedCategory(cat.key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                active
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  active ? 'text-blue-100' : 'text-slate-500'
                }`}
              >
                {categoryCounts[cat.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Technician Filters */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Search completed items"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search RSQDF, customer, model, ref #, remarks..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>

        <select
          aria-label="Filter completed items by technician"
          value={techFilter}
          onChange={(e) => setTechFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
        >
          <option value="ALL">All Technicians</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {(searchQuery.trim() || techFilter !== 'ALL' || selectedCategory !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setTechFilter('ALL');
              setSelectedCategory('ALL');
            }}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="p-6 bg-white border border-slate-200 rounded-lg text-sm text-slate-500">
          Loading completed records across stages...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-10 bg-white border border-slate-200 rounded-lg text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-800">
            No completed items match the current filters
          </div>
          <p className="text-xs text-slate-500">
            Finished items from Samples, Quotation, Approval, APQP, Tooling, CNC, and TRF Log appear here automatically.
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-4">
          {groupedSections.map(({ meta, items }) => (
            <div
              key={meta.key}
              className="bg-white border border-slate-200 rounded-lg overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold border rounded ${CATEGORY_BADGE_CLASS[meta.key]}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-slate-500">{meta.description}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono font-semibold text-slate-700 tabular-nums">
                    {items.length} done
                  </span>
                  <Link
                    to={meta.route}
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Open {meta.label} Tab
                  </Link>
                </div>
              </div>
              {renderRowsTable(items, false)}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {renderRowsTable(filteredItems, true)}
        </div>
      )}

      {/* Edit Status / Reopen Modal */}
      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={
          editingItem
            ? `Edit Status · ${editingItem.rsqdf}`
            : 'Edit Completed Item'
        }
        subtitle={
          editingItem
            ? `${editingItem.categoryLabel} · ${editingItem.customer} · ${editingItem.modelName}`
            : undefined
        }
        maxWidthClass="max-w-lg"
      >
        {editingItem && (
          <form onSubmit={handleSaveStatus} className="space-y-4">
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  {editingItem.referenceSummary}
                </span>
                <span className="font-mono text-slate-500">
                  Completed: {formatManilaDate(editingItem.completedDate)}
                </span>
              </div>
              <div className="text-slate-500">
                Use <strong>Reopen / For Revision</strong> to clear completion and move this item back to its active stage queue.
              </div>
            </div>

            <FormField id="completed-action-mode" label="Status Action" required>
              <select
                id="completed-action-mode"
                value={actionMode}
                onChange={(e) =>
                  setActionMode(e.target.value as 'keep_completed' | 'reopen')
                }
                className={inputClass}
              >
                <option value="reopen">
                  Reopen / For Revision (Move Back to Active)
                </option>
                <option value="keep_completed">
                  Keep Completed (Edit Details / Date / Remarks)
                </option>
              </select>
            </FormField>

            {editingItem.category === 'apqp' && actionMode === 'reopen' && (
              <FormField id="completed-apqp-status" label="Return APQP Stage Status To" required>
                <select
                  id="completed-apqp-status"
                  value={editApqpStatus}
                  onChange={(e) => setEditApqpStatus(e.target.value as ApqpStatus)}
                  className={inputClass}
                >
                  {APQP_REOPEN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {editingItem.category === 'trf_logs' && actionMode === 'reopen' && (
              <FormField id="completed-trf-status" label="Return TRF Status To" required>
                <select
                  id="completed-trf-status"
                  value={editTrfStatus}
                  onChange={(e) => setEditTrfStatus(e.target.value as TrfStatus)}
                  className={inputClass}
                >
                  {TRF_REOPEN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {editingItem.category === 'tooling' && (
              <FormField id="completed-tooling-mode" label="Tooling Execution Mode">
                <select
                  id="completed-tooling-mode"
                  value={editExecutionMode}
                  onChange={(e) =>
                    setEditExecutionMode(e.target.value as ToolingExecutionMode)
                  }
                  className={inputClass}
                >
                  <option value="In House">In House</option>
                  <option value="Job Out">Job Out</option>
                </select>
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {actionMode === 'keep_completed' ? (
                <FormField id="completed-date-input" label="Completion Date">
                  <input
                    id="completed-date-input"
                    type="date"
                    value={editCompletedDate}
                    onChange={(e) => setEditCompletedDate(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
              ) : (
                <div className="p-2.5 rounded-md border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Completion date will be cleared so this item returns to active monitoring.</span>
                </div>
              )}

              {!isRoleRestrictedCategory && editingItem.category !== 'trf_logs' && (
                <FormField id="completed-commitment-date" label="Target / Commitment Date">
                  <input
                    id="completed-commitment-date"
                    type="date"
                    value={editCommitmentDate}
                    onChange={(e) => setEditCommitmentDate(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
              )}
            </div>

            {!isRoleRestrictedCategory && (
              <FormField id="completed-tech" label="Technician In Charge">
                <select
                  id="completed-tech"
                  value={editTechId}
                  onChange={(e) => setEditTechId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField id="completed-remarks" label="Remarks / Revision Notes">
              <textarea
                id="completed-remarks"
                rows={3}
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Reason for revision, customer feedback, or verification notes..."
                className={inputClass}
              />
            </FormField>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              {canFileTrf && editingItem.category !== 'trf_logs' ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = editingItem;
                    setEditingItem(null);
                    openFileTrfModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>File TRF Instead</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateCompleted.isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50"
                >
                  {updateCompleted.isPending ? 'Saving...' : 'Save Status'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* File TRF Revision Modal */}
      <Modal
        open={Boolean(trfTarget)}
        onClose={() => setTrfTarget(null)}
        title={trfTarget ? `File TRF Revision · ${trfTarget.rsqdf}` : 'File TRF Revision'}
        subtitle={
          trfTarget
            ? `${trfTarget.customer} · ${trfTarget.modelName}`
            : undefined
        }
        maxWidthClass="max-w-lg"
      >
        {trfTarget && (
          <form onSubmit={handleSubmitTrf} className="space-y-4">
            <FormField id="completed-trf-num" label="TRF #" required>
              <input
                id="completed-trf-num"
                type="text"
                value={trfNumber}
                onChange={(e) => setTrfNumber(e.target.value)}
                placeholder="TRF-2026-015"
                className={inputClass}
                required
              />
            </FormField>

            <FormField id="completed-trf-reason" label="Reason for Revision" required>
              <textarea
                id="completed-trf-reason"
                rows={3}
                value={trfReason}
                onChange={(e) => setTrfReason(e.target.value)}
                placeholder="Describe drawing or tooling revision needed..."
                className={inputClass}
                required
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trfRequiresMd}
                  onChange={(e) => setTrfRequiresMd(e.target.checked)}
                />
                <span>Requires MD Drawing Revision</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trfRequiresTooling}
                  onChange={(e) => setTrfRequiresTooling(e.target.checked)}
                />
                <span>Requires Tooling Rework</span>
              </label>
            </div>

            {trfRequiresTooling && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField id="completed-trf-tooltype" label="Tooling Type">
                  <select
                    id="completed-trf-tooltype"
                    value={trfToolingType}
                    onChange={(e) =>
                      setTrfToolingType(e.target.value as ToolingCategory)
                    }
                    className={inputClass}
                  >
                    {TOOLING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="completed-trf-toolmode" label="Execution">
                  <select
                    id="completed-trf-toolmode"
                    value={trfToolingMode}
                    onChange={(e) =>
                      setTrfToolingMode(e.target.value as ToolingExecutionMode)
                    }
                    className={inputClass}
                  >
                    <option value="In House">In House</option>
                    <option value="Job Out">Job Out</option>
                  </select>
                </FormField>
                <FormField id="completed-trf-tooldate" label="Commitment">
                  <input
                    id="completed-trf-tooldate"
                    type="date"
                    value={trfToolingCommitment}
                    onChange={(e) => setTrfToolingCommitment(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setTrfTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTrf.isPending}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50"
              >
                {createTrf.isPending ? 'Filing...' : 'File TRF Revision'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
