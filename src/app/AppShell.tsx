import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Cog,
  FileCheck2,
  FileSpreadsheet,
  GitPullRequest,
  Hammer,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Search,
  Shield,
  Wrench,
  X,
} from 'lucide-react';
import {
  useOverdueCountsByStage,
  useRealtimeSync,
  useResetDemoWorkspace,
  useSwitchLocalRole,
  useTechnicians,
  useWorkspaceContext,
} from '../data/hooks';
import { useToast } from '../components/ui/Toast';
import { APP_ROLES, canAccessAdmin } from '../lib/roles';
import type { AppRole } from '../types/database.types';

export function AppShell() {
  useRealtimeSync();
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const { data: technicians = [] } = useTechnicians();
  const overdue = useOverdueCountsByStage();
  const switchRole = useSwitchLocalRole();
  const resetDemo = useResetDemoWorkspace();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [rsqdfJump, setRsqdfJump] = useState('');

  const role: AppRole = ctx?.role ?? 'ADMIN';

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, badge: 0 },
    { to: '/samples', label: 'Samples', icon: ClipboardList, badge: overdue.samples },
    { to: '/quotation', label: 'Quotation', icon: FileSpreadsheet, badge: overdue.quotations },
    { to: '/approval', label: 'Approval', icon: CheckSquare, badge: overdue.approvals },
    { to: '/apqp', label: 'APQP', icon: GitPullRequest, badge: overdue.apqp },
    { to: '/tooling', label: 'Tooling', icon: Hammer, badge: overdue.tooling },
    { to: '/cnc', label: 'CNC', icon: Cog, badge: overdue.cnc },
    { to: '/md', label: 'MD', icon: FileCheck2, badge: 0 },
    { to: '/trf', label: 'TRF Log', icon: Wrench, badge: overdue.trf_logs },
    { to: '/ob', label: 'O.B.', icon: CalendarDays, badge: 0 },
    { to: '/completed', label: 'Completed', icon: CheckCircle2, badge: 0 },
  ];

  const handleRsqdfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = rsqdfJump.trim();
    if (!cleaned) return;
    navigate(`/item/${encodeURIComponent(cleaned)}`);
    setRsqdfJump('');
  };

  const currentTitle =
    navItems.find((item) => item.to === location.pathname)?.label ??
    (location.pathname.startsWith('/item/')
      ? 'RSQDF Item Timeline'
      : location.pathname.startsWith('/admin')
      ? 'Admin Console'
      : 'Workload Monitoring');

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-4 py-4 border-b border-slate-200">
        <NavLink
          to="/"
          onClick={() => setMobileNavOpen(false)}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
        >
          TechFlow WMS
        </NavLink>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge > 0 && (
                <span
                  aria-label={`${item.badge} overdue`}
                  className="text-[11px] font-mono font-semibold text-red-700 tabular-nums shrink-0"
                >
                  {item.badge} overdue
                </span>
              )}
            </NavLink>
          );
        })}

        {canAccessAdmin(role) && (
          <div className="pt-2 mt-2 border-t border-slate-200">
            <NavLink
              to="/admin"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Admin Console</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* Role Preview Switcher (Local Preview Mode while Sign-Up/Login is deferred) */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span>Workspace Role</span>
          {ctx?.mode === 'local' && (
            <button
              type="button"
              onClick={async () => {
                await resetDemo.mutateAsync();
                pushToast('Reset sample engineering records');
              }}
              title="Reset sample data"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
        <select
          aria-label="Active Workspace Role"
          value={role}
          disabled={ctx?.mode === 'supabase'}
          onChange={(e) => {
            const nextRole = e.target.value as AppRole;
            void switchRole.mutateAsync({ role: nextRole });
            pushToast(`Switched preview role to ${nextRole}`);
          }}
          className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-800"
        >
          {APP_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {role === 'TECHNICAL' && (
          <select
            aria-label="Linked Technician Profile"
            value={ctx?.linkedTechnicianId ?? ''}
            onChange={(e) => {
              void switchRole.mutateAsync({
                role: 'TECHNICAL',
                linkedTechnicianId: e.target.value || null,
              });
            }}
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
          >
            <option value="">Select My Tech Name</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="w-64 max-w-[80vw] h-full z-50">{sidebarContent}</div>
          <div
            className="flex-1 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 clean zones */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-6 px-5 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md border border-slate-200"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <span className="text-sm font-semibold text-slate-900 truncate">
              Technical Department / {currentTitle}
            </span>
          </div>

          <form onSubmit={handleRsqdfSubmit} className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Jump to RSQDF timeline"
                value={rsqdfJump}
                onChange={(e) => setRsqdfJump(e.target.value)}
                placeholder="Lookup RSQDF..."
                className="w-44 pl-8 pr-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              Timeline
            </button>
          </form>

          <div className="text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
            {ctx?.fullName ?? 'Engineering Lead'}
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
