import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { usePromoteStage } from '../data/hooks';
import { getTodayManilaISO } from '../lib/dates';

interface PromoteDialogProps {
  open: boolean;
  onClose: () => void;
  fromStage: 'quotations' | 'samples' | 'approvals' | 'apqp';
  recordId: string;
  rsqdf: string;
  customer: string;
  modelName: string;
  defaultPo?: string | null;
  availableTargets: Array<{
    value: 'samples' | 'approvals' | 'apqp' | 'tooling_and_cnc';
    label: string;
  }>;
}

export function PromoteDialog({
  open,
  onClose,
  fromStage,
  recordId,
  rsqdf,
  customer,
  modelName,
  defaultPo,
  availableTargets,
}: PromoteDialogProps) {
  const { pushToast } = useToast();
  const promote = usePromoteStage();

  const [target, setTarget] = useState(availableTargets[0]?.value ?? 'samples');
  const [dateCommitment, setDateCommitment] = useState('');
  const [poNumber, setPoNumber] = useState(defaultPo ?? '');
  const [poMode, setPoMode] = useState<'With P.O.' | 'Without P.O.'>('With P.O.');
  const [executionMode, setExecutionMode] = useState<'In House' | 'Job Out'>('In House');
  const [includeCnc, setIncludeCnc] = useState(false);
  const [rsqdfJo, setRsqdfJo] = useState(rsqdf);
  const [qtyCommitment, setQtyCommitment] = useState('1');
  const [deliverySchedule, setDeliverySchedule] = useState('');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await promote.mutateAsync({
        fromStage,
        recordId,
        toStage: target,
        payload: {
          date_commitment: dateCommitment || null,
          po_number: poNumber || null,
          po_reference: poNumber || null,
          po_mode: poMode,
          execution_mode: executionMode,
          include_cnc: includeCnc,
          rsqdf_jo: rsqdfJo,
          qty_commitment: qtyCommitment ? Number(qtyCommitment) : null,
          delivery_schedule: deliverySchedule || null,
          date_received_signed_approval: getTodayManilaISO(),
          remarks: remarks || null,
        },
      });
      pushToast(`Promoted ${rsqdf} (${res.count} record${res.count === 1 ? '' : 's'} created)`);
      onClose();
    } catch (err) {
      pushToast((err as Error).message || 'Stage promotion failed', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move ${rsqdf} to Next Stage`}
      subtitle={`${customer} · ${modelName}`}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="promote-target" className="block text-xs font-semibold text-slate-700 mb-1">
            Destination Stage
          </label>
          <select
            id="promote-target"
            value={target}
            onChange={(e) => setTarget(e.target.value as typeof target)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white text-slate-900"
          >
            {availableTargets.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {target === 'approvals' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="promote-pomode" className="block text-xs font-semibold text-slate-700 mb-1">
                P.O. Mode
              </label>
              <select
                id="promote-pomode"
                value={poMode}
                onChange={(e) => setPoMode(e.target.value as typeof poMode)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="With P.O.">With P.O.</option>
                <option value="Without P.O.">Without P.O.</option>
              </select>
            </div>
            <div>
              <label htmlFor="promote-ponum" className="block text-xs font-semibold text-slate-700 mb-1">
                P.O. Number
              </label>
              <input
                id="promote-ponum"
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. PO-88510"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
        )}

        {target === 'tooling_and_cnc' ? (
          <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div>
              <label htmlFor="promote-exec" className="block text-xs font-semibold text-slate-700 mb-1">
                Tooling Execution Mode
              </label>
              <select
                id="promote-exec"
                value={executionMode}
                onChange={(e) => setExecutionMode(e.target.value as typeof executionMode)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="In House">In House</option>
                <option value="Job Out">Job Out</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-800 pt-1">
              <input
                type="checkbox"
                checked={includeCnc}
                onChange={(e) => setIncludeCnc(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Also create a CNC machining job</span>
            </label>

            {includeCnc && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label htmlFor="cnc-jo" className="block text-xs text-slate-600 mb-1">
                    RSQDF / J.O.
                  </label>
                  <input
                    id="cnc-jo"
                    type="text"
                    value={rsqdfJo}
                    onChange={(e) => setRsqdfJo(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cnc-qty" className="block text-xs text-slate-600 mb-1">
                    Qty Commitment
                  </label>
                  <input
                    id="cnc-qty"
                    type="number"
                    min={1}
                    value={qtyCommitment}
                    onChange={(e) => setQtyCommitment(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cnc-deliv" className="block text-xs text-slate-600 mb-1">
                    Delivery Schedule
                  </label>
                  <input
                    id="cnc-deliv"
                    type="date"
                    value={deliverySchedule}
                    onChange={(e) => setDeliverySchedule(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="promote-due" className="block text-xs font-semibold text-slate-700 mb-1">
              Commitment Date (Optional)
            </label>
            <input
              id="promote-due"
              type="date"
              value={dateCommitment}
              onChange={(e) => setDateCommitment(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
        )}

        <div>
          <label htmlFor="promote-remarks" className="block text-xs font-semibold text-slate-700 mb-1">
            Handoff Remarks
          </label>
          <textarea
            id="promote-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Shared RSQDF, customer, model, and technician will carry over automatically."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={promote.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50"
          >
            <span>{promote.isPending ? 'Promoting...' : 'Confirm Promotion'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
