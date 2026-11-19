import type {
  ApqpRow,
  AppRole,
  MdMonthlyRow,
  MdMonthlySummary,
  StageTableName,
} from '../types/database.types';

export const APP_ROLES: AppRole[] = ['ADMIN', 'TECHNICAL', 'VIEWER', 'TOOLING', 'CNC'];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Admin',
  TECHNICAL: 'Technical',
  VIEWER: 'Viewer',
  TOOLING: 'Tooling',
  CNC: 'CNC',
};

export function canCreateStageRecord(role: AppRole, table: StageTableName): boolean {
  if (role === 'ADMIN' || role === 'TECHNICAL') return true;
  void table;
  return false;
}

export function canEditStageRecord(role: AppRole, table: StageTableName): boolean {
  if (role === 'ADMIN' || role === 'TECHNICAL') return true;
  if (role === 'TOOLING' && table === 'tooling') return true;
  if (role === 'CNC' && table === 'cnc') return true;
  return false;
}

export function canSoftDeleteStageRecord(role: AppRole): boolean {
  return role === 'ADMIN' || role === 'TECHNICAL';
}

export function canPromoteStage(role: AppRole): boolean {
  return role === 'ADMIN' || role === 'TECHNICAL';
}

export function canAccessAdmin(role: AppRole): boolean {
  return role === 'ADMIN';
}

export function getDefaultRouteForRole(role: AppRole): string {
  if (role === 'TOOLING') return '/tooling';
  if (role === 'CNC') return '/cnc';
  return '/';
}

export function computeMdMonthlySummary(
  apqpRows: ApqpRow[],
  overrideRows: MdMonthlyRow[]
): MdMonthlySummary[] {
  const buckets = new Map<
    string,
    { retrieval: number; finalMd: number; ddcc: number }
  >();

  const ensureBucket = (monthKey: string) => {
    let b = buckets.get(monthKey);
    if (!b) {
      b = { retrieval: 0, finalMd: 0, ddcc: 0 };
      buckets.set(monthKey, b);
    }
    return b;
  };

  for (const row of apqpRows) {
    if (row.deleted_at) continue;
    if (row.status === 'First Run Done') {
      const d = row.first_run_done_date ?? row.updated_at.slice(0, 10);
      ensureBucket(d.slice(0, 7)).retrieval += 1;
    } else if (row.status === 'FRRD Returned' || row.status === 'Forwarded to MD') {
      const d = row.forwarded_to_md_date ?? row.frrd_returned_date ?? row.updated_at.slice(0, 10);
      ensureBucket(d.slice(0, 7)).finalMd += 1;
    } else if (row.status === 'Forwarded to DDCC') {
      const d = row.forwarded_to_ddcc_date ?? row.updated_at.slice(0, 10);
      ensureBucket(d.slice(0, 7)).ddcc += 1;
    }
  }

  const overrideMap = new Map<string, MdMonthlyRow>();
  for (const ov of overrideRows) {
    if (ov.deleted_at) continue;
    overrideMap.set(ov.month_key, ov);
    ensureBucket(ov.month_key);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, counts]) => {
      const ov = overrideMap.get(monthKey);
      const forRetrieval = ov?.for_retrieval_override ?? counts.retrieval;
      const forFinalMd = ov?.for_final_md_override ?? counts.finalMd;
      const forwardedToDdcc = ov?.forwarded_to_ddcc_override ?? counts.ddcc;
      return {
        id: ov?.id ?? null,
        month_key: monthKey,
        auto_for_retrieval: counts.retrieval,
        auto_for_final_md: counts.finalMd,
        auto_forwarded_to_ddcc: counts.ddcc,
        for_retrieval_override: ov?.for_retrieval_override ?? null,
        for_final_md_override: ov?.for_final_md_override ?? null,
        forwarded_to_ddcc_override: ov?.forwarded_to_ddcc_override ?? null,
        for_retrieval: forRetrieval,
        for_final_md: forFinalMd,
        forwarded_to_ddcc: forwardedToDdcc,
        total: forRetrieval + forFinalMd + forwardedToDdcc,
        with_special_case: ov?.with_special_case ?? 0,
        remarks: ov?.remarks ?? null,
        updated_at: ov?.updated_at ?? null,
      };
    });
}
