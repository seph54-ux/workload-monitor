import React, { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { FormField, inputClass } from '../../components/FormFields';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useMdMonthlySummary,
  useUpsertMdMonthly,
  useWorkspaceContext,
} from '../../data/hooks';
import { getCurrentManilaMonthKey } from '../../lib/dates';
import { canCreateStageRecord } from '../../lib/roles';
import type { MdMonthlySummary } from '../../types/database.types';

export function MdPage() {
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const role = ctx?.role ?? 'ADMIN';
  const canEdit = canCreateStageRecord(role, 'md_monthly');

  const { data: rows = [], isLoading, error, refetch } = useMdMonthlySummary();
  const upsertMd = useUpsertMdMonthly();

  const [modalOpen, setModalOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(getCurrentManilaMonthKey());
  const [retrievalOv, setRetrievalOv] = useState('');
  const [finalMdOv, setFinalMdOv] = useState('');
  const [ddccOv, setDdccOv] = useState('');
  const [specialCase, setSpecialCase] = useState('0');
  const [remarks, setRemarks] = useState('');

  const openEdit = (row?: MdMonthlySummary) => {
    setMonthKey(row?.month_key ?? getCurrentManilaMonthKey());
    setRetrievalOv(
      row?.for_retrieval_override !== null && row?.for_retrieval_override !== undefined
        ? String(row.for_retrieval_override)
        : ''
    );
    setFinalMdOv(
      row?.for_final_md_override !== null && row?.for_final_md_override !== undefined
        ? String(row.for_final_md_override)
        : ''
    );
    setDdccOv(
      row?.forwarded_to_ddcc_override !== null && row?.forwarded_to_ddcc_override !== undefined
        ? String(row.forwarded_to_ddcc_override)
        : ''
    );
    setSpecialCase(String(row?.with_special_case ?? 0));
    setRemarks(row?.remarks ?? '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertMd.mutateAsync({
        month_key: monthKey,
        for_retrieval_override: retrievalOv.trim() === '' ? null : Number(retrievalOv),
        for_final_md_override: finalMdOv.trim() === '' ? null : Number(finalMdOv),
        forwarded_to_ddcc_override: ddccOv.trim() === '' ? null : Number(ddccOv),
        with_special_case: Number(specialCase || 0),
        remarks: remarks.trim() || null,
      });
      pushToast(`Saved MD counters for ${monthKey}`);
      setModalOpen(false);
    } catch (err) {
      pushToast((err as Error).message, 'error');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            MD (Manufacturing Drawing) Monthly Summary
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Auto-computed from APQP status dates (First Run Done → Retrieval · FRRD Returned/Forwarded to MD → Final MD · Forwarded to DDCC) with per-field overrides
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => openEdit()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Set Month Override</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-700">
            Failed to load MD counters.{' '}
            <button type="button" onClick={() => void refetch()} className="underline">
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No APQP records in MD/DDCC stages yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">For Retrieval</th>
                  <th className="px-4 py-3 text-right">For Final MD</th>
                  <th className="px-4 py-3 text-right">Forwarded to DDCC</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">With Special Case</th>
                  <th className="px-4 py-3">Remarks</th>
                  {canEdit && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => (
                  <tr key={r.month_key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {r.month_key}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{r.for_retrieval}</span>
                      <span className="block text-[11px] text-slate-400">
                        auto {r.auto_for_retrieval}
                        {r.for_retrieval_override !== null ? ' · overridden' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{r.for_final_md}</span>
                      <span className="block text-[11px] text-slate-400">
                        auto {r.auto_for_final_md}
                        {r.for_final_md_override !== null ? ' · overridden' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{r.forwarded_to_ddcc}</span>
                      <span className="block text-[11px] text-slate-400">
                        auto {r.auto_forwarded_to_ddcc}
                        {r.forwarded_to_ddcc_override !== null ? ' · overridden' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-blue-700 tabular-nums">
                      {r.total}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                      {r.with_special_case}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                      {r.remarks || '—'}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          aria-label={`Edit MD month ${r.month_key}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Override</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`MD Monthly Override · ${monthKey}`}
        subtitle="Leave any override field blank to use the live APQP auto-count"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <FormField id="md-month" label="Month Key (YYYY-MM)" required>
            <input
              id="md-month"
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className={inputClass}
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="md-ret" label="For Retrieval Override">
              <input
                id="md-ret"
                type="number"
                min={0}
                value={retrievalOv}
                onChange={(e) => setRetrievalOv(e.target.value)}
                placeholder="Auto"
                className={inputClass}
              />
            </FormField>
            <FormField id="md-fin" label="For Final MD Override">
              <input
                id="md-fin"
                type="number"
                min={0}
                value={finalMdOv}
                onChange={(e) => setFinalMdOv(e.target.value)}
                placeholder="Auto"
                className={inputClass}
              />
            </FormField>
            <FormField id="md-ddcc" label="Forwarded to DDCC Override">
              <input
                id="md-ddcc"
                type="number"
                min={0}
                value={ddccOv}
                onChange={(e) => setDdccOv(e.target.value)}
                placeholder="Auto"
                className={inputClass}
              />
            </FormField>
            <FormField id="md-sc" label="With Special Case">
              <input
                id="md-sc"
                type="number"
                min={0}
                value={specialCase}
                onChange={(e) => setSpecialCase(e.target.value)}
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField id="md-rem" label="Remarks">
            <textarea
              id="md-rem"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={inputClass}
            />
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
              disabled={upsertMd.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              Save MD Counter
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
