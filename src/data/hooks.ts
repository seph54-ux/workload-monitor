import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  batchInsertStageRows,
  createStageRow,
  createTrfWithLinks,
  deleteRsqdfAttachment,
  getRsqdfTimeline,
  getWorkspaceContext,
  listAuditLogs,
  listMdMonthlySummary,
  listProfiles,
  listStageRows,
  listTechnicians,
  promoteStageRecord,
  resetDemoWorkspace,
  setLocalRolePreview,
  softDeleteStageRow,
  subscribeRealtimeTables,
  updateRsqdfAttachment,
  updateStageRow,
  uploadRsqdfAttachment,
  upsertMdMonthlyOverride,
  upsertTechnician,
} from './repository';
import { getDeadlineStatus, isTrfOverdue } from '../lib/dates';
import type {
  ApqpRow,
  AppRole,
  ApprovalRow,
  CncRow,
  OfficialBusinessRow,
  QuotationRow,
  SampleRow,
  StageTableName,
  ToolingRow,
  TrfLogRow,
} from '../types/database.types';

export const QUERY_KEYS = {
  technicians: ['technicians'] as const,
  stage: (table: StageTableName) => ['stage', table] as const,
  mdSummary: ['md_monthly_summary'] as const,
  auditLogs: ['audit_logs'] as const,
  profiles: ['profiles'] as const,
  timeline: (rsqdf: string) => ['timeline', rsqdf] as const,
  workspace: ['workspace_context'] as const,
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeRealtimeTables(() => {
      void queryClient.invalidateQueries();
    });
  }, [queryClient]);
}

export function useWorkspaceContext() {
  return useQuery({
    queryKey: QUERY_KEYS.workspace,
    queryFn: () => getWorkspaceContext(),
  });
}

export function useSwitchLocalRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { role: AppRole; linkedTechnicianId?: string | null }) => {
      setLocalRolePreview(params.role, params.linkedTechnicianId);
    },
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}

export function useResetDemoWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      resetDemoWorkspace();
    },
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}

export function useTechnicians() {
  return useQuery({
    queryKey: QUERY_KEYS.technicians,
    queryFn: listTechnicians,
  });
}

export function useUpsertTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertTechnician,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.technicians });
    },
  });
}

export function useStageRows<T>(table: StageTableName) {
  return useQuery({
    queryKey: QUERY_KEYS.stage(table),
    queryFn: () => listStageRows<T>(table),
  });
}

export function useCreateStageRow<T extends { id: string }>(table: StageTableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => createStageRow<T>(table, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.stage(table) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.mdSummary });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useUpdateStageRow<T extends { id: string }>(table: StageTableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateStageRow<T>(table, id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.stage(table) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.mdSummary });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useUpdateCompletedItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      table,
      id,
      payload,
    }: {
      table: StageTableName;
      id: string;
      rsqdf: string;
      payload: Record<string, unknown>;
    }) => updateStageRow(table, id, payload),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.stage(variables.table) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.mdSummary });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
      if (variables.rsqdf) {
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.timeline(variables.rsqdf) });
      }
    },
  });
}

export function useSoftDeleteStageRow(table: StageTableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteStageRow(table, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.stage(table) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.mdSummary });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useBatchImportStageRows(table: StageTableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => batchInsertStageRows(table, rows),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.stage(table) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function usePromoteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: promoteStageRecord,
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}

export function useCreateTrfWithLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTrfWithLinks,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.stage('trf_logs') });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.stage('tooling') });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useMdMonthlySummary() {
  return useQuery({
    queryKey: QUERY_KEYS.mdSummary,
    queryFn: listMdMonthlySummary,
  });
}

export function useUpsertMdMonthly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertMdMonthlyOverride,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.mdSummary });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: QUERY_KEYS.auditLogs,
    queryFn: listAuditLogs,
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: QUERY_KEYS.profiles,
    queryFn: listProfiles,
  });
}

export function useRsqdfTimeline(rsqdf: string) {
  return useQuery({
    queryKey: QUERY_KEYS.timeline(rsqdf),
    queryFn: () => getRsqdfTimeline(rsqdf),
    enabled: Boolean(rsqdf),
  });
}

export function useUploadAttachment(rsqdf: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadRsqdfAttachment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.timeline(rsqdf) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useUpdateAttachment(rsqdf: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateRsqdfAttachment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.timeline(rsqdf) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useDeleteAttachment(rsqdf: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRsqdfAttachment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.timeline(rsqdf) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}

export function useOverdueCountsByStage() {
  const samples = useStageRows<SampleRow>('samples');
  const quotations = useStageRows<QuotationRow>('quotations');
  const approvals = useStageRows<ApprovalRow>('approvals');
  const apqp = useStageRows<ApqpRow>('apqp');
  const tooling = useStageRows<ToolingRow>('tooling');
  const cnc = useStageRows<CncRow>('cnc');
  const trf = useStageRows<TrfLogRow>('trf_logs');
  const ob = useStageRows<OfficialBusinessRow>('official_business');

  return {
    samples: (samples.data ?? []).filter((r) => getDeadlineStatus(r.date_commitment, r.date_finished) === 'overdue').length,
    quotations: (quotations.data ?? []).filter((r) => getDeadlineStatus(r.date_commitment, r.date_finished) === 'overdue').length,
    approvals: (approvals.data ?? []).filter((r) => getDeadlineStatus(r.date_commitment, r.date_received_signed_approval) === 'overdue').length,
    apqp: (apqp.data ?? []).filter((r) => getDeadlineStatus(r.date_commitment, r.completed_date) === 'overdue').length,
    tooling: (tooling.data ?? []).filter((r) => getDeadlineStatus(r.commitment_date, r.date_forwarded_to_ppqc) === 'overdue').length,
    cnc: (cnc.data ?? []).filter((r) => getDeadlineStatus(r.delivery_schedule, r.date_finished) === 'overdue').length,
    trf_logs: (trf.data ?? []).filter((r) => isTrfOverdue(r.date_filed, r.status, r.date_completed)).length,
    ob: (ob.data ?? []).length,
  };
}
