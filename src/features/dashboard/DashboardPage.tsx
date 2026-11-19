import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { DeadlineBadge } from '../../components/DeadlineBadge';
import {
  useStageRows,
  useTechnicians,
  useWorkspaceContext,
} from '../../data/hooks';
import { formatManilaDate, getDeadlineStatus, isDueWithinDays } from '../../lib/dates';
import type {
  ApqpRow,
  ApprovalRow,
  CncRow,
  OfficialBusinessRow,
  QuotationRow,
  SampleRow,
  ToolingRow,
  TrfLogRow,
} from '../../types/database.types';

interface OpenWorkloadItem {
  id: string;
  stage: string;
  route: string;
  rsqdf: string;
  customer: string;
  modelName: string;
  technicianId: string | null;
  commitmentDate: string | null;
  statusLabel: string;
}

export function DashboardPage() {
  const { data: ctx } = useWorkspaceContext();
  const { data: technicians = [] } = useTechnicians();
  const { data: quotations = [] } = useStageRows<QuotationRow>('quotations');
  const { data: samples = [] } = useStageRows<SampleRow>('samples');
  const { data: approvals = [] } = useStageRows<ApprovalRow>('approvals');
  const { data: apqp = [] } = useStageRows<ApqpRow>('apqp');
  const { data: tooling = [] } = useStageRows<ToolingRow>('tooling');
  const { data: cnc = [] } = useStageRows<CncRow>('cnc');
  const { data: trfLogs = [] } = useStageRows<TrfLogRow>('trf_logs');
  const { data: obRows = [] } = useStageRows<OfficialBusinessRow>('official_business');

  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);

  const techMap = useMemo(
    () => new Map(technicians.map((t) => [t.id, t.name])),
    [technicians]
  );

  const openItems = useMemo<OpenWorkloadItem[]>(() => {
    const items: OpenWorkloadItem[] = [];
    for (const r of quotations) {
      if (!r.date_finished) {
        items.push({
          id: r.id,
          stage: 'Quotation',
          route: '/quotation',
          rsqdf: r.rsqdf,
          customer: r.customer,
          modelName: r.model_name,
          technicianId: r.technician_in_charge,
          commitmentDate: r.date_commitment,
          statusLabel: r.record_type,
        });
      }
    }
    for (const r of samples) {
      if (!r.date_finished) {
        items.push({
          id: r.id,
          stage: 'Samples',
          route: '/samples',
          rsqdf: r.rsqdf,
          customer: r.customer,
          modelName: r.model_name,
          technicianId: r.technician_in_charge,
          commitmentDate: r.date_commitment,
          statusLabel: r.record_type,
        });
      }
    }
    for (const r of approvals) {
      if (!r.date_received_signed_approval) {
        items.push({
          id: r.id,
          stage: 'Approval',
          route: '/approval',
          rsqdf: r.rsqdf,
          customer: r.customer,
          modelName: r.model_name,
          technicianId: r.technician_in_charge,
          commitmentDate: r.date_commitment,
          statusLabel: r.po_mode,
        });
      }
    }
    for (const r of apqp) {
      if (!r.completed_date && r.status !== 'Completed') {
        items.push({
          id: r.id,
          stage: 'APQP',
          route: '/apqp',
          rsqdf: r.rsqdf,
          customer: r.customer,
          modelName: r.model_name,
          technicianId: r.technician_in_charge,
          commitmentDate: r.date_commitment,
          statusLabel: r.status,
        });
      }
    }
    for (const r of tooling) {
      if (!r.date_forwarded_to_ppqc) {
        items.push({
          id: r.id,
          stage: 'Tooling',
          route: '/tooling',
          rsqdf: r.rsqdf,
          customer: r.customer,
          modelName: r.model_name,
          technicianId: r.technician_in_charge,
          commitmentDate: r.commitment_date,
          statusLabel: r.tooling_type,
        });
      }
    }
    for (const r of cnc) {
      if (!r.date_finished) {
        items.push({
          id: r.id,
          stage: 'CNC',
          route: '/cnc',
          rsqdf: r.rsqdf,
          customer: r.customer,
          modelName: r.model_name,
          technicianId: r.technician_in_charge,
          commitmentDate: r.delivery_schedule,
          statusLabel: r.rsqdf_jo,
        });
      }
    }
    return items;
  }, [quotations, samples, approvals, apqp, tooling, cnc]);

  const overdueItems = useMemo(
    () => openItems.filter((i) => getDeadlineStatus(i.commitmentDate, null) === 'overdue'),
    [openItems]
  );

  const dueThisWeekItems = useMemo(
    () => openItems.filter((i) => isDueWithinDays(i.commitmentDate, null, 7)),
    [openItems]
  );

  const chartData = useMemo(() => {
    return technicians
      .filter((t) => t.is_active)
      .map((tech) => {
        const mine = openItems.filter((i) => i.technicianId === tech.id);
        return {
          techId: tech.id,
          name: tech.name,
          Quotation: mine.filter((m) => m.stage === 'Quotation').length,
          Samples: mine.filter((m) => m.stage === 'Samples').length,
          Approval: mine.filter((m) => m.stage === 'Approval').length,
          APQP: mine.filter((m) => m.stage === 'APQP').length,
          Tooling: mine.filter((m) => m.stage === 'Tooling').length,
          CNC: mine.filter((m) => m.stage === 'CNC').length,
          total: mine.length,
        };
      });
  }, [technicians, openItems]);

  const stageSummary = [
    { label: 'Samples', open: samples.filter((r) => !r.date_finished).length, total: samples.length, to: '/samples' },
    { label: 'Quotation', open: quotations.filter((r) => !r.date_finished).length, total: quotations.length, to: '/quotation' },
    { label: 'Approval', open: approvals.filter((r) => !r.date_received_signed_approval).length, total: approvals.length, to: '/approval' },
    { label: 'APQP', open: apqp.filter((r) => !r.completed_date).length, total: apqp.length, to: '/apqp' },
    { label: 'Tooling', open: tooling.filter((r) => !r.date_forwarded_to_ppqc).length, total: tooling.length, to: '/tooling' },
    { label: 'CNC', open: cnc.filter((r) => !r.date_finished).length, total: cnc.length, to: '/cnc' },
    { label: 'TRF Open', open: trfLogs.filter((r) => r.status !== 'Completed').length, total: trfLogs.length, to: '/trf' },
    { label: 'O.B. Logs', open: obRows.length, total: obRows.length, to: '/ob' },
  ];

  const myTechId = ctx?.role === 'TECHNICAL' ? ctx.linkedTechnicianId : null;
  const myWorkload = useMemo(
    () => (myTechId ? openItems.filter((i) => i.technicianId === myTechId) : []),
    [myTechId, openItems]
  );

  const selectedTechItems = useMemo(
    () => (selectedTechId ? openItems.filter((i) => i.technicianId === selectedTechId) : []),
    [selectedTechId, openItems]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Engineering Workload Overview
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live stage counts, technician capacity, overdue alerts, and 7-day commitments (Asia/Manila)
          </p>
        </div>
        <div className="text-xs font-mono text-slate-500 tabular-nums">
          {openItems.length} open items · {overdueItems.length} overdue
        </div>
      </div>

      {/* Role-Aware My Workload Banner for TECHNICAL */}
      {myTechId && (
        <section className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                My Workload · {techMap.get(myTechId) ?? 'Technician'}
              </h2>
            </div>
            <span className="text-xs font-mono text-blue-700 font-semibold tabular-nums">
              {myWorkload.length} open
            </span>
          </div>
          {myWorkload.length === 0 ? (
            <p className="text-xs text-slate-500">No open requests assigned to you right now.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {myWorkload.map((item) => (
                <Link
                  key={`${item.stage}-${item.id}`}
                  to={`/item/${encodeURIComponent(item.rsqdf)}`}
                  className="p-3 border border-slate-200 rounded-md hover:border-blue-400 transition-colors bg-slate-50/50"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-blue-700">{item.rsqdf}</span>
                    <span className="text-slate-500">{item.stage}</span>
                  </div>
                  <div className="text-xs font-medium text-slate-900 mt-1 truncate">
                    {item.customer} · {item.modelName}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                    <span className="font-mono">{formatManilaDate(item.commitmentDate)}</span>
                    <DeadlineBadge commitmentDate={item.commitmentDate} finishedDate={null} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Stage Counts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {stageSummary.map((st) => (
          <Link
            key={st.label}
            to={st.to}
            className="p-3.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
          >
            <div className="text-xs font-medium text-slate-500 truncate">{st.label}</div>
            <div className="text-2xl font-semibold text-slate-900 font-mono tabular-nums mt-1">
              {st.open}
            </div>
            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
              of {st.total} total
            </div>
          </Link>
        ))}
      </div>

      {/* Workload per Technician Chart + Drilldown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Open Workload per Technician
              </h2>
              <p className="text-xs text-slate-500">
                Click any technician button below the chart to inspect all their open items
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Quotation" stackId="a" fill="#1d4ed8" />
                <Bar dataKey="Samples" stackId="a" fill="#0284c7" />
                <Bar dataKey="Approval" stackId="a" fill="#d97706" />
                <Bar dataKey="APQP" stackId="a" fill="#0f766e" />
                <Bar dataKey="Tooling" stackId="a" fill="#475569" />
                <Bar dataKey="CNC" stackId="a" fill="#64748b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-200">
            {chartData.map((row) => (
              <button
                key={row.techId}
                type="button"
                onClick={() => setSelectedTechId(row.techId)}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:border-blue-600 hover:text-blue-700 transition-colors font-mono tabular-nums"
              >
                {row.name} ({row.total})
              </button>
            ))}
          </div>
        </div>

        {/* Overdue & Due This Week Lists */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                <AlertTriangle className="w-4 h-4" />
                <h2>Overdue Commitments</h2>
              </div>
              <span className="text-xs font-mono font-semibold text-red-700 tabular-nums">
                {overdueItems.length}
              </span>
            </div>
            {overdueItems.length === 0 ? (
              <p className="text-xs text-slate-500">Zero overdue items across all stages.</p>
            ) : (
              <ul className="divide-y divide-slate-200 max-h-[268px] overflow-y-auto pr-1">
                {overdueItems.map((item) => (
                  <li key={`${item.stage}-${item.id}`} className="py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/item/${encodeURIComponent(item.rsqdf)}`}
                        className="font-mono font-semibold text-blue-700 hover:underline"
                      >
                        {item.rsqdf}
                      </Link>
                      <span className="text-red-700 font-mono">
                        {formatManilaDate(item.commitmentDate)}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5 truncate">
                      {item.stage} · {item.customer} ·{' '}
                      {item.technicianId ? techMap.get(item.technicianId) : 'Unassigned'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                <Clock className="w-4 h-4" />
                <h2>Due This Week (7 Days)</h2>
              </div>
              <span className="text-xs font-mono font-semibold text-amber-700 tabular-nums">
                {dueThisWeekItems.length}
              </span>
            </div>
            {dueThisWeekItems.length === 0 ? (
              <p className="text-xs text-slate-500">No commitments due within the next 7 days.</p>
            ) : (
              <ul className="divide-y divide-slate-200 max-h-[268px] overflow-y-auto pr-1">
                {dueThisWeekItems.map((item) => (
                  <li key={`${item.stage}-${item.id}`} className="py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/item/${encodeURIComponent(item.rsqdf)}`}
                        className="font-mono font-semibold text-blue-700 hover:underline"
                      >
                        {item.rsqdf}
                      </Link>
                      <span className="text-amber-700 font-mono">
                        {formatManilaDate(item.commitmentDate)}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5 truncate">
                      {item.stage} · {item.customer} ·{' '}
                      {item.technicianId ? techMap.get(item.technicianId) : 'Unassigned'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Technician Drilldown Modal */}
      <Modal
        open={Boolean(selectedTechId)}
        onClose={() => setSelectedTechId(null)}
        title={`Open Workload · ${selectedTechId ? techMap.get(selectedTechId) : ''}`}
        subtitle={`${selectedTechItems.length} active assignments across stages`}
        maxWidthClass="max-w-3xl"
      >
        {selectedTechItems.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No open items assigned to this technician.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold">RSQDF</th>
                  <th className="px-3 py-2 font-semibold">Customer / Model</th>
                  <th className="px-3 py-2 font-semibold">Detail</th>
                  <th className="px-3 py-2 font-semibold">Due Date</th>
                  <th className="px-3 py-2 font-semibold">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedTechItems.map((item) => (
                  <tr key={`${item.stage}-${item.id}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{item.stage}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/item/${encodeURIComponent(item.rsqdf)}`}
                        onClick={() => setSelectedTechId(null)}
                        className="font-mono font-semibold text-blue-700 hover:underline"
                      >
                        {item.rsqdf}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {item.customer} · {item.modelName}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.statusLabel}</td>
                    <td className="px-3 py-2 font-mono">{formatManilaDate(item.commitmentDate)}</td>
                    <td className="px-3 py-2">
                      <DeadlineBadge commitmentDate={item.commitmentDate} finishedDate={null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
