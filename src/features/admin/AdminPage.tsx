import React, { useMemo, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { FormField, inputClass } from '../../components/FormFields';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useAuditLogs,
  useProfiles,
  useTechnicians,
  useUpsertTechnician,
  useWorkspaceContext,
} from '../../data/hooks';
import { formatManilaDateTime } from '../../lib/dates';
import type { TechnicianRow } from '../../types/database.types';

export function AdminPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const isAdmin = ctx?.role === 'ADMIN';

  const { data: technicians = [] } = useTechnicians();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: profiles = [] } = useProfiles();
  const upsertTech = useUpsertTechnician();

  const [activeTab, setActiveTab] = useState<'technicians' | 'audit' | 'users'>('technicians');
  const [techModalOpen, setTechModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<TechnicianRow | null>(null);
  const [techName, setTechName] = useState('');
  const [techActive, setTechActive] = useState(true);

  const [auditTableFilter, setAuditTableFilter] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditTableFilter !== 'ALL' && log.table_name !== auditTableFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const hay = `${log.table_name} ${log.action} ${log.actor_role ?? ''} ${JSON.stringify(log.new_data ?? {})}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, auditTableFilter, auditSearch]);

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-2">
        <ShieldCheck className="w-7 h-7 text-slate-400 mx-auto" />
        <h1 className="text-base font-semibold text-slate-900">Admin Access Required</h1>
        <p className="text-xs text-slate-500">
          Switch the workspace preview role to ADMIN in the sidebar to manage Technicians and view the Audit Trail.
        </p>
      </div>
    );
  }

  const openTechModal = (tech?: TechnicianRow) => {
    setEditingTech(tech ?? null);
    setTechName(tech?.name ?? '');
    setTechActive(tech?.is_active ?? true);
    setTechModalOpen(true);
  };

  const handleSaveTech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techName.trim()) return;
    try {
      await upsertTech.mutateAsync({
        id: editingTech?.id,
        name: techName.trim(),
        is_active: techActive,
      });
      pushToast(`Saved technician ${techName.trim()}`);
      setTechModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Admin Console
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage Technical Department engineers, inspect immutable audit logs, and review user directory readiness
          </p>
        </div>

        <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md self-start">
          {(
            [
              ['technicians', 'Technicians'],
              ['audit', 'Audit Trail'],
              ['users', 'Users & Auth Phase'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'technicians' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <div className="text-xs font-semibold text-slate-700">
              Technical In Charge Roster ({technicians.length})
            </div>
            <button
              type="button"
              onClick={() => openTechModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Technician</span>
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {technicians.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{t.name}</span>
                  <span
                    className={`text-xs font-medium ${
                      t.is_active ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openTechModal(t)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-lg">
            <input
              type="search"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search RSQDF, role, changed fields..."
              className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md"
            />
            <select
              aria-label="Filter audit logs by table"
              value={auditTableFilter}
              onChange={(e) => setAuditTableFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
            >
              <option value="ALL">All Tables</option>
              {[
                'quotations',
                'samples',
                'approvals',
                'apqp',
                'tooling',
                'cnc',
                'trf_logs',
                'md_monthly',
                'official_business',
                'technicians',
              ].map((tbl) => (
                <option key={tbl} value={tbl}>
                  {tbl}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-3.5 py-2.5 font-semibold">Timestamp (Manila)</th>
                    <th className="px-3.5 py-2.5 font-semibold">Table</th>
                    <th className="px-3.5 py-2.5 font-semibold">Action</th>
                    <th className="px-3.5 py-2.5 font-semibold">Actor Role</th>
                    <th className="px-3.5 py-2.5 font-semibold">Changed / Snapshot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2 font-mono whitespace-nowrap">
                        {formatManilaDateTime(log.created_at)}
                      </td>
                      <td className="px-3.5 py-2 font-mono text-slate-800">{log.table_name}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-900">{log.action}</td>
                      <td className="px-3.5 py-2 text-slate-700">{log.actor_role ?? 'SYSTEM'}</td>
                      <td className="px-3.5 py-2 font-mono text-[11px] text-slate-600 max-w-md truncate">
                        {log.changed_fields.length > 0
                          ? `Changed: ${log.changed_fields.join(', ')}`
                          : JSON.stringify(log.new_data ?? log.old_data ?? {}).slice(0, 120)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed">
            Sign-up, Login, and self-service Role Change Request UI flows are scheduled for Phase 2 once the main operational system is confirmed. All PostgreSQL tables (`profiles`, `role_change_requests`), role-locking triggers, and `approve_role_change` RPCs are already provisioned in the database migrations.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{p.full_name}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{p.email}</td>
                    <td className="px-3 py-2 font-semibold text-blue-700">{p.role}</td>
                    <td className="px-3 py-2 text-emerald-700">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={techModalOpen}
        onClose={() => setTechModalOpen(false)}
        title={editingTech ? `Edit Technician · ${editingTech.name}` : 'Add Technician'}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveTech} className="space-y-3.5">
          <FormField id="tech-name" label="Technician Name" required>
            <input
              id="tech-name"
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              className={inputClass}
              required
            />
          </FormField>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
            <input
              type="checkbox"
              checked={techActive}
              onChange={(e) => setTechActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Active in Technical In Charge dropdowns</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setTechModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsertTech.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              Save Technician
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
