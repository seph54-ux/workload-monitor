import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Pencil, Trash2, Upload } from 'lucide-react';
import { DeadlineBadge } from '../../components/DeadlineBadge';
import { FormField, inputClass } from '../../components/FormFields';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  useDeleteAttachment,
  useRsqdfTimeline,
  useTechnicians,
  useUpdateAttachment,
  useUploadAttachment,
  useWorkspaceContext,
} from '../../data/hooks';
import { getAttachmentSignedUrl } from '../../data/repository';
import { formatManilaDate, formatManilaDateTime } from '../../lib/dates';
import type { AttachmentRow } from '../../types/database.types';

export function TimelinePage() {
  const { rsqdf = '' } = useParams();
  const decodedRsqdf = decodeURIComponent(rsqdf);
  const { pushToast } = useToast();
  const { data: ctx } = useWorkspaceContext();
  const { data: technicians = [] } = useTechnicians();
  const { data: bundle, isLoading, error, refetch } = useRsqdfTimeline(decodedRsqdf);

  const uploadAttachment = useUploadAttachment(decodedRsqdf);
  const updateAttachment = useUpdateAttachment(decodedRsqdf);
  const deleteAttachment = useDeleteAttachment(decodedRsqdf);

  const [editingAttachment, setEditingAttachment] = useState<AttachmentRow | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [removingAttachment, setRemovingAttachment] = useState<AttachmentRow | null>(null);

  const techMap = useMemo(() => new Map(technicians.map((t) => [t.id, t.name])), [technicians]);
  const canManageAttachments = ctx?.role !== 'VIEWER';

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !bundle) return;
    try {
      const entity =
        bundle.apqp[0]
          ? { table: 'apqp', id: bundle.apqp[0].id }
          : bundle.approvals[0]
          ? { table: 'approvals', id: bundle.approvals[0].id }
          : bundle.samples[0]
          ? { table: 'samples', id: bundle.samples[0].id }
          : bundle.quotations[0]
          ? { table: 'quotations', id: bundle.quotations[0].id }
          : bundle.tooling[0]
          ? { table: 'tooling', id: bundle.tooling[0].id }
          : bundle.cnc[0]
          ? { table: 'cnc', id: bundle.cnc[0].id }
          : bundle.trfLogs[0]
          ? { table: 'trf_logs', id: bundle.trfLogs[0].id }
          : { table: 'rsqdf', id: crypto.randomUUID() };

      await uploadAttachment.mutateAsync({
        rsqdf: decodedRsqdf,
        entityTable: entity.table,
        entityId: entity.id,
        file,
      });
      pushToast(`Attached ${file.name} to ${decodedRsqdf}`);
      await refetch();
    } catch (err) {
      pushToast((err as Error).message || 'Upload failed', 'error');
    }
  };

  const openEditAttachment = (att: AttachmentRow) => {
    setEditingAttachment(att);
    setEditFileName(att.file_name);
    setReplacementFile(null);
  };

  const handleSaveAttachmentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttachment) return;
    const trimmed = editFileName.trim();
    if (!trimmed) {
      pushToast('Document name is required', 'error');
      return;
    }
    try {
      await updateAttachment.mutateAsync({
        attachment: editingAttachment,
        fileName: trimmed,
        replacementFile,
      });
      pushToast(`Updated ${trimmed}`);
      setEditingAttachment(null);
      setReplacementFile(null);
      await refetch();
    } catch (err) {
      pushToast((err as Error).message || 'Failed to update document', 'error');
    }
  };

  const handleConfirmRemoveAttachment = async () => {
    if (!removingAttachment) return;
    try {
      await deleteAttachment.mutateAsync(removingAttachment);
      pushToast(`Removed ${removingAttachment.file_name}`);
      setRemovingAttachment(null);
      await refetch();
    } catch (err) {
      pushToast((err as Error).message || 'Failed to remove document', 'error');
    }
  };

  const handleOpenAttachment = async (att: AttachmentRow) => {
    try {
      const url = await getAttachmentSignedUrl(att);
      if (!url) {
        pushToast('Preview unavailable for this attachment', 'error');
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = att.file_name;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (err) {
      pushToast((err as Error).message, 'error');
    }
  };

  const primaryInfo =
    bundle?.apqp[0] ??
    bundle?.approvals[0] ??
    bundle?.samples[0] ??
    bundle?.quotations[0] ??
    bundle?.tooling[0] ??
    bundle?.cnc[0] ??
    bundle?.trfLogs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 font-mono">
            {decodedRsqdf}
          </h1>
          {primaryInfo && (
            <p className="text-sm text-slate-600 mt-0.5">
              {primaryInfo.customer} · {primaryInfo.model_name}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 bg-white border border-slate-200 rounded-lg text-sm text-slate-500">
          Loading cross-stage timeline...
        </div>
      ) : error ? (
        <div className="p-6 bg-white border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load timeline: {(error as Error).message}
        </div>
      ) : !bundle ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* Stage 1: Quotation */}
            <TimelineSection
              title="1. Quotation"
              emptyText="No Quotation records linked to this RSQDF."
              count={bundle.quotations.length}
            >
              {bundle.quotations.map((q) => (
                <div key={q.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {q.record_type} {q.reference_number ? `· ${q.reference_number}` : ''}
                    </span>
                    <DeadlineBadge commitmentDate={q.date_commitment} finishedDate={q.date_finished} />
                  </div>
                  <div className="text-slate-600">
                    Tech: {q.technician_in_charge ? techMap.get(q.technician_in_charge) : 'Unassigned'} · Requested {formatManilaDate(q.date_requested)} · Commitment {formatManilaDate(q.date_commitment)} · Finished {formatManilaDate(q.date_finished)}
                  </div>
                  {q.remarks && <div className="text-slate-500">Remarks: {q.remarks}</div>}
                </div>
              ))}
            </TimelineSection>

            {/* Stage 2: Samples */}
            <TimelineSection
              title="2. Samples"
              emptyText="No Sample records linked to this RSQDF."
              count={bundle.samples.length}
            >
              {bundle.samples.map((s) => (
                <div key={s.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {s.record_type} {s.reference_number ? `· ${s.reference_number}` : ''}
                    </span>
                    <DeadlineBadge commitmentDate={s.date_commitment} finishedDate={s.date_finished} />
                  </div>
                  <div className="text-slate-600">
                    Tech: {s.technician_in_charge ? techMap.get(s.technician_in_charge) : 'Unassigned'} · Requested {formatManilaDate(s.date_requested)} · Commitment {formatManilaDate(s.date_commitment)} · Finished {formatManilaDate(s.date_finished)}
                  </div>
                  {s.remarks && <div className="text-slate-500">Remarks: {s.remarks}</div>}
                </div>
              ))}
            </TimelineSection>

            {/* Stage 3: Approval */}
            <TimelineSection
              title="3. Approval"
              emptyText="No Approval records linked to this RSQDF."
              count={bundle.approvals.length}
            >
              {bundle.approvals.map((a) => (
                <div key={a.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {a.po_mode} {a.po_number ? `· ${a.po_number}` : ''}
                    </span>
                    <DeadlineBadge
                      commitmentDate={a.date_commitment}
                      finishedDate={a.date_received_signed_approval}
                    />
                  </div>
                  <div className="text-slate-600">
                    P.O. Received {formatManilaDate(a.po_received_date)} · Sent {formatManilaDate(a.date_sent_to_customer)} · Signed Approval {formatManilaDate(a.date_received_signed_approval)}
                  </div>
                  {a.remarks && <div className="text-slate-500">Remarks: {a.remarks}</div>}
                </div>
              ))}
            </TimelineSection>

            {/* Stage 4: APQP */}
            <TimelineSection
              title="4. APQP (First Run)"
              emptyText="No APQP records linked to this RSQDF."
              count={bundle.apqp.length}
            >
              {bundle.apqp.map((ap) => (
                <div key={ap.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      Status: {ap.status} {ap.item_code ? `· Item Code ${ap.item_code}` : ''}
                    </span>
                    <DeadlineBadge commitmentDate={ap.date_commitment} finishedDate={ap.completed_date} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] text-slate-600 font-mono">
                    <div>Meeting: {formatManilaDate(ap.meeting_date)}</div>
                    <div>IC Req: {formatManilaDate(ap.item_code_requested_date)}</div>
                    <div>IC Recv: {formatManilaDate(ap.item_code_received_date)}</div>
                    <div>FRRD Rel: {formatManilaDate(ap.frrd_released_date)}</div>
                    <div>To PPQC: {formatManilaDate(ap.forwarded_to_ppqc_date)}</div>
                    <div>1st Run: {formatManilaDate(ap.first_run_done_date)}</div>
                    <div>Returned: {formatManilaDate(ap.frrd_returned_date)}</div>
                    <div>To MD: {formatManilaDate(ap.forwarded_to_md_date)}</div>
                    <div>To DDCC: {formatManilaDate(ap.forwarded_to_ddcc_date)}</div>
                  </div>
                  {(ap.tooling_commitments ?? []).some((c) => c.needed) && (
                    <div className="text-slate-700 pt-1 border-t border-slate-200">
                      Tooling Needed:{' '}
                      {(ap.tooling_commitments ?? [])
                        .filter((c) => c.needed)
                        .map((c) => `${c.tooling_type} (${formatManilaDate(c.commitment_date)})`)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </TimelineSection>

            {/* Stage 5: Tooling & CNC */}
            <TimelineSection
              title="5. Tooling & CNC"
              emptyText="No Tooling or CNC jobs linked to this RSQDF."
              count={bundle.tooling.length + bundle.cnc.length}
            >
              {bundle.tooling.map((t) => (
                <div key={t.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      Tooling · {t.tooling_type} ({t.source_type} / {t.execution_mode})
                    </span>
                    <DeadlineBadge commitmentDate={t.commitment_date} finishedDate={t.date_forwarded_to_ppqc} />
                  </div>
                  <div className="text-slate-600">
                    Received {formatManilaDate(t.date_received)} · Commitment {formatManilaDate(t.commitment_date)} · Forwarded to PPQC {formatManilaDate(t.date_forwarded_to_ppqc)}
                  </div>
                </div>
              ))}
              {bundle.cnc.map((c) => (
                <div key={c.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      CNC · {c.rsqdf_jo} (Qty {c.qty_commitment ?? '—'})
                    </span>
                    <DeadlineBadge commitmentDate={c.delivery_schedule} finishedDate={c.date_finished} />
                  </div>
                  <div className="text-slate-600">
                    Delivery {formatManilaDate(c.delivery_schedule)} · Finished {formatManilaDate(c.date_finished)}
                  </div>
                </div>
              ))}
            </TimelineSection>

            {/* Stage 6: TRF Revisions */}
            <TimelineSection
              title="6. TRF Revisions"
              emptyText="No TRF revision requests filed for this RSQDF."
              count={bundle.trfLogs.length}
            >
              {bundle.trfLogs.map((trf) => (
                <div key={trf.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-900">
                      {trf.trf_number} · {trf.status}
                    </span>
                    <span className="font-mono text-slate-500">
                      Filed {formatManilaDate(trf.date_filed)}
                    </span>
                  </div>
                  <div className="text-slate-700">{trf.reason_for_revision}</div>
                </div>
              ))}
            </TimelineSection>
          </div>

          {/* Right Column: Phase 2 Attachments */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Drawings & Documents
                </h2>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {bundle.attachments.length}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Upload PDFs or images (Quotations, Signed Approvals, FRRD drawings).
              </p>

              {canManageAttachments && (
                <label className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-md bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-medium text-slate-700">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadAttachment.isPending ? 'Uploading...' : 'Attach PDF / Image'}</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    disabled={uploadAttachment.isPending}
                    onChange={handleUpload}
                    className="sr-only"
                  />
                </label>
              )}

              {bundle.attachments.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  No attachments uploaded yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {bundle.attachments.map((att) => (
                    <li key={att.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate" title={att.file_name}>
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{att.file_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {Math.max(1, Math.round(att.file_size / 1024))} KB · {formatManilaDateTime(att.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleOpenAttachment(att)}
                          aria-label={`Download ${att.file_name}`}
                          title="Download"
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canManageAttachments && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditAttachment(att)}
                              aria-label={`Edit ${att.file_name}`}
                              title="Edit document"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemovingAttachment(att)}
                              aria-label={`Remove ${att.file_name}`}
                              title="Remove document"
                              className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(editingAttachment)}
        onClose={() => {
          setEditingAttachment(null);
          setReplacementFile(null);
        }}
        title="Edit Document"
        subtitle={editingAttachment ? `RSQDF ${decodedRsqdf} · ${editingAttachment.file_name}` : undefined}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveAttachmentEdit} className="space-y-4">
          <FormField id="att-edit-name" label="Document Name" required>
            <input
              id="att-edit-name"
              type="text"
              value={editFileName}
              onChange={(e) => setEditFileName(e.target.value)}
              placeholder="Enter document file name"
              className={inputClass}
              required
            />
          </FormField>

          <div className="space-y-1.5">
            <label htmlFor="att-replace-file" className="block text-xs font-semibold text-slate-700">
              Replace File (Optional)
            </label>
            <input
              id="att-replace-file"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setReplacementFile(picked);
                if (picked && editingAttachment && editFileName.trim() === editingAttachment.file_name) {
                  setEditFileName(picked.name);
                }
              }}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-200 file:text-xs file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
            />
            <p className="text-[11px] text-slate-500">
              {replacementFile
                ? `Selected replacement: ${replacementFile.name} (${Math.max(1, Math.round(replacementFile.size / 1024))} KB)`
                : 'Leave empty to rename the existing document without re-uploading.'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setEditingAttachment(null);
                setReplacementFile(null);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateAttachment.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50"
            >
              {updateAttachment.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(removingAttachment)}
        onClose={() => setRemovingAttachment(null)}
        title="Remove Document"
        subtitle={decodedRsqdf}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to remove{' '}
            <span className="font-semibold text-slate-900">
              {removingAttachment?.file_name}
            </span>{' '}
            from this RSQDF item?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setRemovingAttachment(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteAttachment.isPending}
              onClick={() => void handleConfirmRemoveAttachment()}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 disabled:opacity-50"
            >
              {deleteAttachment.isPending ? 'Removing...' : 'Remove Document'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TimelineSection({
  title,
  count,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="text-xs font-mono text-slate-500 tabular-nums">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-xs text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}
