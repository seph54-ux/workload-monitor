import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  TOOLING_CATEGORIES,
  type ApqpRow,
  type ApqpToolingCommitmentRow,
  type AppRole,
  type ApprovalRow,
  type AttachmentRow,
  type AuditLogRow,
  type CncRow,
  type MdMonthlyRow,
  type MdMonthlySummary,
  type OfficialBusinessRow,
  type ProfileRow,
  type QuotationRow,
  type SampleRow,
  type StageTableName,
  type TechnicianRow,
  type ToolingCategory,
  type ToolingExecutionMode,
  type ToolingRow,
  type TrfLogRow,
} from '../types/database.types';
import { computeMdMonthlySummary } from '../lib/roles';
import {
  appendAudit,
  getApqpCommitmentsFor,
  getTodayISO,
  loadLocalDb,
  newUuid,
  resetLocalDb,
  saveLocalDb,
  subscribeLocalPreview,
} from './localPreviewStore';

export interface WorkspaceContext {
  mode: 'supabase' | 'local';
  role: AppRole;
  linkedTechnicianId: string | null;
  fullName: string;
}

function sanitizePgPayload<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      out[key] = trimmed.length === 0 ? null : trimmed;
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function getWorkspaceContext(): WorkspaceContext {
  if (isSupabaseConfigured) {
    return {
      mode: 'supabase',
      role: 'ADMIN',
      linkedTechnicianId: null,
      fullName: 'Engineering Session',
    };
  }
  const db = loadLocalDb();
  const tech = db.technicians.find((t) => t.id === db.activeTechnicianId);
  return {
    mode: 'local',
    role: db.activeRole,
    linkedTechnicianId: db.activeTechnicianId,
    fullName: tech ? `${tech.name} (${db.activeRole})` : `Workspace (${db.activeRole})`,
  };
}

export function setLocalRolePreview(role: AppRole, linkedTechnicianId?: string | null): void {
  const db = loadLocalDb();
  db.activeRole = role;
  if (linkedTechnicianId !== undefined) {
    db.activeTechnicianId = linkedTechnicianId;
  }
  saveLocalDb(db);
}

export function resetDemoWorkspace(): void {
  resetLocalDb();
}

export function subscribeRealtimeTables(onUpdate: () => void): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return subscribeLocalPreview(onUpdate);
  }

  const channel = supabase
    .channel('wms-live-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      onUpdate();
    })
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}

export async function listTechnicians(): Promise<TechnicianRow[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TechnicianRow[];
  }
  const db = loadLocalDb();
  return [...db.technicians].sort((a, b) => a.name.localeCompare(b.name));
}

export async function upsertTechnician(input: {
  id?: string;
  name: string;
  is_active: boolean;
}): Promise<TechnicianRow> {
  if (isSupabaseConfigured && supabase) {
    const payload: Partial<TechnicianRow> = input.id
      ? { id: input.id, name: input.name, is_active: input.is_active }
      : { name: input.name, is_active: input.is_active };
    const { data, error } = await supabase
      .from('technicians')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as TechnicianRow;
  }

  const db = loadLocalDb();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = db.technicians.findIndex((t) => t.id === input.id);
    if (idx === -1) throw new Error('Technician not found');
    const oldRow = { ...db.technicians[idx] };
    const updated: TechnicianRow = { ...oldRow, name: input.name, is_active: input.is_active, updated_at: now };
    db.technicians[idx] = updated;
    appendAudit(db, 'technicians', updated.id, 'UPDATE', oldRow as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
    saveLocalDb(db);
    return updated;
  }
  const created: TechnicianRow = {
    id: newUuid(),
    name: input.name,
    is_active: input.is_active,
    created_at: now,
    updated_at: now,
  };
  db.technicians.push(created);
  appendAudit(db, 'technicians', created.id, 'INSERT', null, created as unknown as Record<string, unknown>);
  saveLocalDb(db);
  return created;
}

export async function listStageRows<T>(table: StageTableName, pageSize = 500): Promise<T[]> {
  if (isSupabaseConfigured && supabase) {
    const orderCol = table === 'md_monthly' ? 'month_key' : table === 'official_business' ? 'ob_date' : 'created_at';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .is('deleted_at', null)
      .order(orderCol, { ascending: false })
      .range(0, pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    if (table === 'apqp') {
      const apqpRows = rows as unknown as ApqpRow[];
      const ids = apqpRows.map((r) => r.id);
      if (ids.length > 0) {
        const { data: commitments, error: tcError } = await supabase
          .from('apqp_tooling_commitments')
          .select('*')
          .in('apqp_id', ids);
        if (tcError) throw tcError;
        const byApqp = new Map<string, ApqpToolingCommitmentRow[]>();
        for (const c of (commitments ?? []) as ApqpToolingCommitmentRow[]) {
          const list = byApqp.get(c.apqp_id) ?? [];
          list.push(c);
          byApqp.set(c.apqp_id, list);
        }
        for (const row of apqpRows) {
          row.tooling_commitments = byApqp.get(row.id) ?? [];
        }
      }
    }
    return rows;
  }

  const db = loadLocalDb();
  const raw = (db[table] as Array<{ deleted_at: string | null }>).filter((r) => !r.deleted_at);
  if (table === 'apqp') {
    return (raw as unknown as ApqpRow[]).map((row) => ({
      ...row,
      tooling_commitments: getApqpCommitmentsFor(db, row.id),
    })) as unknown as T[];
  }
  return raw as unknown as T[];
}

export async function createStageRow<T extends { id: string }>(
  table: StageTableName,
  payload: Record<string, unknown>
): Promise<T> {
  if (isSupabaseConfigured && supabase) {
    const { tooling_commitments, ...rest } = sanitizePgPayload(payload);
    const { data, error } = await (supabase.from(table) as unknown as {
      insert: (v: Record<string, unknown>) => {
        select: () => { single: () => Promise<{ data: T | null; error: Error | null }> };
      };
    })
      .insert(rest as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    const created = data as T;
    if (table === 'apqp' && Array.isArray(tooling_commitments)) {
      const rows = tooling_commitments.map((tc: Record<string, unknown>) => ({
        apqp_id: created.id,
        tooling_type: tc.tooling_type as ToolingCategory,
        needed: Boolean(tc.needed),
        commitment_date: (typeof tc.commitment_date === 'string' && tc.commitment_date.trim() ? tc.commitment_date.trim() : null),
        remarks: (typeof tc.remarks === 'string' && tc.remarks.trim() ? tc.remarks.trim() : null),
      }));
      const { error: tcError } = await supabase
        .from('apqp_tooling_commitments')
        .upsert(rows, { onConflict: 'apqp_id,tooling_type' });
      if (tcError) throw tcError;
    }
    return created;
  }

  const db = loadLocalDb();
  if (db.activeRole === 'VIEWER' || db.activeRole === 'TOOLING' || db.activeRole === 'CNC') {
    throw new Error(`Permission denied: ${db.activeRole} cannot create records in ${table}`);
  }
  const now = new Date().toISOString();
  const id = newUuid();
  const { tooling_commitments, ...rest } = payload;
  const created = {
    id,
    ...rest,
    created_at: now,
    updated_at: now,
    created_by: `preview-${db.activeRole.toLowerCase()}`,
    updated_by: `preview-${db.activeRole.toLowerCase()}`,
    deleted_at: null,
  };
  (db[table] as unknown[]).unshift(created);

  if (table === 'apqp') {
    const items = Array.isArray(tooling_commitments)
      ? tooling_commitments
      : TOOLING_CATEGORIES.map((cat) => ({
          tooling_type: cat,
          needed: false,
          commitment_date: null,
          remarks: null,
        }));
    for (const tc of items as Array<Record<string, unknown>>) {
      db.apqp_tooling_commitments.push({
        id: newUuid(),
        apqp_id: id,
        tooling_type: tc.tooling_type as ToolingCategory,
        needed: Boolean(tc.needed),
        commitment_date: (tc.commitment_date as string | null) ?? null,
        remarks: (tc.remarks as string | null) ?? null,
        created_at: now,
        updated_at: now,
        created_by: `preview-${db.activeRole.toLowerCase()}`,
        updated_by: `preview-${db.activeRole.toLowerCase()}`,
      });
    }
  }

  appendAudit(db, table, id, 'INSERT', null, created as Record<string, unknown>);
  saveLocalDb(db);
  return created as unknown as T;
}

export async function updateStageRow<T extends { id: string }>(
  table: StageTableName,
  id: string,
  payload: Record<string, unknown>
): Promise<T> {
  if (isSupabaseConfigured && supabase) {
    const { tooling_commitments, ...rest } = sanitizePgPayload(payload);
    const { data, error } = await (supabase.from(table) as unknown as {
      update: (v: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          select: () => { single: () => Promise<{ data: T | null; error: Error | null }> };
        };
      };
    })
      .update(rest as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (table === 'apqp' && Array.isArray(tooling_commitments)) {
      const rows = tooling_commitments.map((tc: Record<string, unknown>) => ({
        apqp_id: id,
        tooling_type: tc.tooling_type as ToolingCategory,
        needed: Boolean(tc.needed),
        commitment_date: (typeof tc.commitment_date === 'string' && tc.commitment_date.trim() ? tc.commitment_date.trim() : null),
        remarks: (typeof tc.remarks === 'string' && tc.remarks.trim() ? tc.remarks.trim() : null),
      }));
      const { error: tcError } = await supabase
        .from('apqp_tooling_commitments')
        .upsert(rows, { onConflict: 'apqp_id,tooling_type' });
      if (tcError) throw tcError;
    }
    return data as T;
  }

  const db = loadLocalDb();
  const role = db.activeRole;
  if (role === 'VIEWER') {
    throw new Error('Permission denied: VIEWER is read-only');
  }
  if (role === 'TOOLING' && table !== 'tooling') {
    throw new Error('Permission denied: TOOLING role can only update Tooling records');
  }
  if (role === 'CNC' && table !== 'cnc') {
    throw new Error('Permission denied: CNC role can only update CNC records');
  }

  const list = db[table] as unknown as Array<Record<string, unknown>>;
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Record ${id} not found in ${table}`);

  const oldRow = { ...list[idx] };
  const { tooling_commitments, ...rest } = payload;

  if (role === 'TOOLING' && table === 'tooling') {
    const allowedKeys = new Set(['execution_mode', 'date_forwarded_to_ppqc', 'remarks']);
    for (const [k, v] of Object.entries(rest)) {
      if (!allowedKeys.has(k) && v !== oldRow[k]) {
        throw new Error('TOOLING role may only update execution_mode, date_forwarded_to_ppqc, and remarks');
      }
    }
  }
  if (role === 'CNC' && table === 'cnc') {
    const allowedKeys = new Set(['date_finished', 'remarks']);
    for (const [k, v] of Object.entries(rest)) {
      if (!allowedKeys.has(k) && v !== oldRow[k]) {
        throw new Error('CNC role may only update date_finished and remarks');
      }
    }
  }

  const updated = {
    ...oldRow,
    ...rest,
    updated_at: new Date().toISOString(),
    updated_by: `preview-${role.toLowerCase()}`,
  };
  list[idx] = updated;

  if (table === 'apqp' && Array.isArray(tooling_commitments)) {
    const now = new Date().toISOString();
    db.apqp_tooling_commitments = db.apqp_tooling_commitments.filter((c) => c.apqp_id !== id);
    for (const tc of tooling_commitments as Array<Record<string, unknown>>) {
      db.apqp_tooling_commitments.push({
        id: newUuid(),
        apqp_id: id,
        tooling_type: tc.tooling_type as ToolingCategory,
        needed: Boolean(tc.needed),
        commitment_date: (tc.commitment_date as string | null) ?? null,
        remarks: (tc.remarks as string | null) ?? null,
        created_at: now,
        updated_at: now,
        created_by: null,
        updated_by: null,
      });
    }
  }

  appendAudit(db, table, id, 'UPDATE', oldRow, updated);
  saveLocalDb(db);
  return updated as unknown as T;
}

export async function softDeleteStageRow(table: StageTableName, id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('soft_delete_record', {
      p_table_name: table,
      p_record_id: id,
    });
    if (error) throw error;
    return;
  }

  const db = loadLocalDb();
  if (db.activeRole !== 'ADMIN' && db.activeRole !== 'TECHNICAL') {
    throw new Error('Permission denied: only ADMIN or TECHNICAL may delete records');
  }
  const list = db[table] as unknown as Array<Record<string, unknown>>;
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const oldRow = { ...list[idx] };
  const now = new Date().toISOString();
  list[idx] = { ...oldRow, deleted_at: now, updated_at: now };
  appendAudit(db, table, id, 'UPDATE', oldRow, list[idx]);
  saveLocalDb(db);
}

export async function batchInsertStageRows(
  table: StageTableName,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (isSupabaseConfigured && supabase) {
    const cleanRows = rows.map((r) => {
      const { tooling_commitments: _tc, ...rest } = sanitizePgPayload(r);
      return rest;
    });
    const { error } = await (supabase.from(table) as unknown as {
      insert: (v: Record<string, unknown>[]) => Promise<{ error: Error | null }>;
    }).insert(cleanRows);
    if (error) throw error;
    return cleanRows.length;
  }

  const db = loadLocalDb();
  if (db.activeRole !== 'ADMIN' && db.activeRole !== 'TECHNICAL') {
    throw new Error('Permission denied: only ADMIN or TECHNICAL may import rows');
  }
  const now = new Date().toISOString();
  for (const row of rows) {
    const id = newUuid();
    const created = {
      id,
      ...row,
      created_at: now,
      updated_at: now,
      created_by: `preview-${db.activeRole.toLowerCase()}`,
      updated_by: `preview-${db.activeRole.toLowerCase()}`,
      deleted_at: null,
    };
    (db[table] as unknown[]).unshift(created);
    appendAudit(db, table, id, 'INSERT', null, created as Record<string, unknown>);
  }
  saveLocalDb(db);
  return rows.length;
}

export async function promoteStageRecord(params: {
  fromStage: 'quotations' | 'samples' | 'approvals' | 'apqp';
  recordId: string;
  toStage: 'samples' | 'approvals' | 'apqp' | 'tooling_and_cnc';
  payload?: Record<string, unknown>;
}): Promise<{ createdIds: string[]; count: number }> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('promote_stage', {
      p_from_stage: params.fromStage,
      p_record_id: params.recordId,
      p_to_stage: params.toStage,
      p_payload: sanitizePgPayload(params.payload ?? {}),
    });
    if (error) throw error;
    const res = data as { created_ids?: string[]; count?: number };
    return { createdIds: res.created_ids ?? [], count: res.count ?? 0 };
  }

  const db = loadLocalDb();
  if (db.activeRole !== 'ADMIN' && db.activeRole !== 'TECHNICAL') {
    throw new Error('Permission denied: only ADMIN or TECHNICAL may promote stages');
  }

  const payload = params.payload ?? {};
  const today = getTodayISO();
  const now = new Date().toISOString();
  const createdIds: string[] = [];

  let source: {
    rsqdf: string;
    customer: string;
    model_name: string;
    technician_in_charge: string | null;
    po?: string | null;
    signedDate?: string | null;
  } | null = null;

  if (params.fromStage === 'quotations') {
    const r = db.quotations.find((x) => x.id === params.recordId && !x.deleted_at);
    if (r) source = { rsqdf: r.rsqdf, customer: r.customer, model_name: r.model_name, technician_in_charge: r.technician_in_charge, po: r.reference_number };
  } else if (params.fromStage === 'samples') {
    const r = db.samples.find((x) => x.id === params.recordId && !x.deleted_at);
    if (r) source = { rsqdf: r.rsqdf, customer: r.customer, model_name: r.model_name, technician_in_charge: r.technician_in_charge, po: r.reference_number };
  } else if (params.fromStage === 'approvals') {
    const r = db.approvals.find((x) => x.id === params.recordId && !x.deleted_at);
    if (r) source = { rsqdf: r.rsqdf, customer: r.customer, model_name: r.model_name, technician_in_charge: r.technician_in_charge, po: r.po_number, signedDate: r.date_received_signed_approval };
  } else if (params.fromStage === 'apqp') {
    const r = db.apqp.find((x) => x.id === params.recordId && !x.deleted_at);
    if (r) source = { rsqdf: r.rsqdf, customer: r.customer, model_name: r.model_name, technician_in_charge: r.technician_in_charge, po: r.po_reference };
  }

  if (!source) throw new Error('Source record not found');

  if (params.toStage === 'samples') {
    const id = newUuid();
    const row: SampleRow = {
      id,
      rsqdf: source.rsqdf,
      customer: source.customer,
      model_name: source.model_name,
      record_type: (payload.record_type as SampleRow['record_type']) ?? 'Sample',
      reference_number: (payload.reference_number as string | null) ?? source.po ?? null,
      technician_in_charge: (payload.technician_in_charge as string | null) ?? source.technician_in_charge,
      date_requested: (payload.date_requested as string | null) ?? today,
      date_commitment: (payload.date_commitment as string | null) ?? null,
      date_finished: null,
      remarks: (payload.remarks as string | null) ?? null,
      created_at: now,
      updated_at: now,
      created_by: `preview-${db.activeRole.toLowerCase()}`,
      updated_by: `preview-${db.activeRole.toLowerCase()}`,
      deleted_at: null,
    };
    db.samples.unshift(row);
    appendAudit(db, 'samples', id, 'INSERT', null, row as unknown as Record<string, unknown>);
    createdIds.push(id);
  } else if (params.toStage === 'approvals') {
    const id = newUuid();
    const row: ApprovalRow = {
      id,
      po_mode: (payload.po_mode as ApprovalRow['po_mode']) ?? 'With P.O.',
      rsqdf: source.rsqdf,
      po_number: (payload.po_number as string | null) ?? source.po ?? null,
      customer: source.customer,
      model_name: source.model_name,
      technician_in_charge: (payload.technician_in_charge as string | null) ?? source.technician_in_charge,
      po_received_date: (payload.po_received_date as string | null) ?? today,
      date_commitment: (payload.date_commitment as string | null) ?? null,
      date_sent_to_customer: null,
      date_received_signed_approval: null,
      remarks: (payload.remarks as string | null) ?? null,
      created_at: now,
      updated_at: now,
      created_by: `preview-${db.activeRole.toLowerCase()}`,
      updated_by: `preview-${db.activeRole.toLowerCase()}`,
      deleted_at: null,
    };
    db.approvals.unshift(row);
    appendAudit(db, 'approvals', id, 'INSERT', null, row as unknown as Record<string, unknown>);
    createdIds.push(id);
  } else if (params.toStage === 'apqp') {
    const id = newUuid();
    const row: ApqpRow = {
      id,
      approval_id: params.fromStage === 'approvals' ? params.recordId : null,
      date_received_signed_approval: (payload.date_received_signed_approval as string | null) ?? source.signedDate ?? today,
      po_reference: (payload.po_reference as string | null) ?? source.po ?? null,
      rsqdf: source.rsqdf,
      customer: source.customer,
      model_name: source.model_name,
      technician_in_charge: (payload.technician_in_charge as string | null) ?? source.technician_in_charge,
      status: 'Waiting for Meeting',
      meeting_date: null,
      item_code_requested_date: null,
      item_code_received_date: null,
      item_code: null,
      frrd_released_date: null,
      forwarded_to_ppqc_date: null,
      first_run_done_date: null,
      frrd_returned_date: null,
      forwarded_to_md_date: null,
      forwarded_to_ddcc_date: null,
      completed_date: null,
      date_commitment: (payload.date_commitment as string | null) ?? null,
      remarks: (payload.remarks as string | null) ?? null,
      created_at: now,
      updated_at: now,
      created_by: `preview-${db.activeRole.toLowerCase()}`,
      updated_by: `preview-${db.activeRole.toLowerCase()}`,
      deleted_at: null,
    };
    db.apqp.unshift(row);
    for (const cat of TOOLING_CATEGORIES) {
      db.apqp_tooling_commitments.push({
        id: newUuid(),
        apqp_id: id,
        tooling_type: cat,
        needed: false,
        commitment_date: null,
        remarks: null,
        created_at: now,
        updated_at: now,
        created_by: null,
        updated_by: null,
      });
    }
    appendAudit(db, 'apqp', id, 'INSERT', null, row as unknown as Record<string, unknown>);
    createdIds.push(id);
  } else if (params.toStage === 'tooling_and_cnc' && params.fromStage === 'apqp') {
    const neededCommitments = getApqpCommitmentsFor(db, params.recordId).filter((c) => c.needed);
    for (const tc of neededCommitments) {
      const tid = newUuid();
      const tRow: ToolingRow = {
        id: tid,
        source_type: 'First Run',
        apqp_id: params.recordId,
        trf_id: null,
        trf_reference: null,
        date_received: today,
        rsqdf: source.rsqdf,
        customer: source.customer,
        model_name: source.model_name,
        technician_in_charge: source.technician_in_charge,
        tooling_type: tc.tooling_type,
        execution_mode: (payload.execution_mode as ToolingExecutionMode) ?? 'In House',
        commitment_date: tc.commitment_date,
        date_forwarded_to_ppqc: null,
        remarks: tc.remarks,
        created_at: now,
        updated_at: now,
        created_by: `preview-${db.activeRole.toLowerCase()}`,
        updated_by: `preview-${db.activeRole.toLowerCase()}`,
        deleted_at: null,
      };
      db.tooling.unshift(tRow);
      appendAudit(db, 'tooling', tid, 'INSERT', null, tRow as unknown as Record<string, unknown>);
      createdIds.push(tid);
    }

    if (payload.include_cnc) {
      const cid = newUuid();
      const cRow: CncRow = {
        id: cid,
        apqp_id: params.recordId,
        date_received: today,
        rsqdf_jo: (payload.rsqdf_jo as string) || source.rsqdf,
        rsqdf: source.rsqdf,
        customer: source.customer,
        model_name: source.model_name,
        technician_in_charge: source.technician_in_charge,
        qty_commitment: payload.qty_commitment ? Number(payload.qty_commitment) : null,
        delivery_schedule: (payload.delivery_schedule as string | null) ?? null,
        date_finished: null,
        remarks: (payload.cnc_remarks as string | null) ?? null,
        created_at: now,
        updated_at: now,
        created_by: `preview-${db.activeRole.toLowerCase()}`,
        updated_by: `preview-${db.activeRole.toLowerCase()}`,
        deleted_at: null,
      };
      db.cnc.unshift(cRow);
      appendAudit(db, 'cnc', cid, 'INSERT', null, cRow as unknown as Record<string, unknown>);
      createdIds.push(cid);
    }

    if (createdIds.length === 0) {
      throw new Error('Select at least one needed Tooling Commitment on this APQP record or enable CNC before promoting.');
    }
  }

  saveLocalDb(db);
  return { createdIds, count: createdIds.length };
}

export async function createTrfWithLinks(payload: Record<string, unknown>): Promise<{
  trfId: string;
  toolingId: string | null;
}> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('create_trf_with_links', {
      p_payload: sanitizePgPayload(payload),
    });
    if (error) throw error;
    const res = data as { trf_id: string; tooling_id: string | null };
    return { trfId: res.trf_id, toolingId: res.tooling_id };
  }

  const db = loadLocalDb();
  if (db.activeRole !== 'ADMIN' && db.activeRole !== 'TECHNICAL') {
    throw new Error('Permission denied: only ADMIN or TECHNICAL can file TRF logs');
  }
  const now = new Date().toISOString();
  const trfId = newUuid();
  const trfRow: TrfLogRow = {
    id: trfId,
    trf_number: String(payload.trf_number),
    rsqdf: String(payload.rsqdf),
    customer: String(payload.customer),
    model_name: String(payload.model_name),
    technician_in_charge: (payload.technician_in_charge as string | null) ?? null,
    date_filed: String(payload.date_filed || getTodayISO()),
    reason_for_revision: String(payload.reason_for_revision),
    requires_tooling: Boolean(payload.requires_tooling),
    tooling_type: (payload.tooling_type as ToolingCategory | null) ?? null,
    requires_md_revision: Boolean(payload.requires_md_revision ?? true),
    status: (payload.status as TrfLogRow['status']) ?? 'Filed',
    date_completed: (payload.date_completed as string | null) ?? null,
    remarks: (payload.remarks as string | null) ?? null,
    created_at: now,
    updated_at: now,
    created_by: `preview-${db.activeRole.toLowerCase()}`,
    updated_by: `preview-${db.activeRole.toLowerCase()}`,
    deleted_at: null,
  };
  db.trf_logs.unshift(trfRow);
  appendAudit(db, 'trf_logs', trfId, 'INSERT', null, trfRow as unknown as Record<string, unknown>);

  let toolingId: string | null = null;
  if (trfRow.requires_tooling && trfRow.tooling_type) {
    toolingId = newUuid();
    const tRow: ToolingRow = {
      id: toolingId,
      source_type: 'TRF',
      apqp_id: null,
      trf_id: trfId,
      trf_reference: trfRow.trf_number,
      date_received: trfRow.date_filed,
      rsqdf: trfRow.rsqdf,
      customer: trfRow.customer,
      model_name: trfRow.model_name,
      technician_in_charge: trfRow.technician_in_charge,
      tooling_type: trfRow.tooling_type,
      execution_mode: (payload.execution_mode as ToolingExecutionMode) ?? 'In House',
      commitment_date: (payload.tooling_commitment_date as string | null) ?? null,
      date_forwarded_to_ppqc: null,
      remarks: trfRow.reason_for_revision,
      created_at: now,
      updated_at: now,
      created_by: `preview-${db.activeRole.toLowerCase()}`,
      updated_by: `preview-${db.activeRole.toLowerCase()}`,
      deleted_at: null,
    };
    db.tooling.unshift(tRow);
    appendAudit(db, 'tooling', toolingId, 'INSERT', null, tRow as unknown as Record<string, unknown>);
  }

  saveLocalDb(db);
  return { trfId, toolingId };
}

export async function listMdMonthlySummary(): Promise<MdMonthlySummary[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('get_md_monthly_summary', {
      p_month_key: null,
    });
    if (error) throw error;
    return (data ?? []) as MdMonthlySummary[];
  }
  const db = loadLocalDb();
  return computeMdMonthlySummary(db.apqp, db.md_monthly);
}

export async function upsertMdMonthlyOverride(input: {
  month_key: string;
  for_retrieval_override: number | null;
  for_final_md_override: number | null;
  forwarded_to_ddcc_override: number | null;
  with_special_case: number;
  remarks: string | null;
}): Promise<MdMonthlyRow> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('md_monthly')
      .upsert(input, { onConflict: 'month_key' })
      .select()
      .single();
    if (error) throw error;
    return data as MdMonthlyRow;
  }

  const db = loadLocalDb();
  if (db.activeRole !== 'ADMIN' && db.activeRole !== 'TECHNICAL') {
    throw new Error('Permission denied: only ADMIN or TECHNICAL may update MD counters');
  }
  const now = new Date().toISOString();
  const idx = db.md_monthly.findIndex((m) => m.month_key === input.month_key && !m.deleted_at);
  if (idx >= 0) {
    const oldRow = { ...db.md_monthly[idx] };
    const updated: MdMonthlyRow = { ...oldRow, ...input, updated_at: now };
    db.md_monthly[idx] = updated;
    appendAudit(db, 'md_monthly', updated.id, 'UPDATE', oldRow as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
    saveLocalDb(db);
    return updated;
  }
  const created: MdMonthlyRow = {
    id: newUuid(),
    ...input,
    created_at: now,
    updated_at: now,
    created_by: `preview-${db.activeRole.toLowerCase()}`,
    updated_by: `preview-${db.activeRole.toLowerCase()}`,
    deleted_at: null,
  };
  db.md_monthly.unshift(created);
  appendAudit(db, 'md_monthly', created.id, 'INSERT', null, created as unknown as Record<string, unknown>);
  saveLocalDb(db);
  return created;
}

export async function listAuditLogs(): Promise<AuditLogRow[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 199);
    if (error) throw error;
    return (data ?? []) as AuditLogRow[];
  }
  const db = loadLocalDb();
  return db.audit_logs;
}

export async function listProfiles(): Promise<ProfileRow[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ProfileRow[];
  }
  return loadLocalDb().profiles;
}

export async function listAttachmentsByRsqdf(rsqdf: string): Promise<AttachmentRow[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('rsqdf', rsqdf)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AttachmentRow[];
  }
  return loadLocalDb().attachments.filter((a) => !a.deleted_at && a.rsqdf === rsqdf);
}

export async function uploadRsqdfAttachment(params: {
  rsqdf: string;
  entityTable: string;
  entityId: string;
  file: File;
}): Promise<AttachmentRow> {
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${params.rsqdf}/${Date.now()}-${safeName}`;

  if (isSupabaseConfigured && supabase) {
    const { error: uploadError } = await supabase.storage
      .from('engineering-docs')
      .upload(storagePath, params.file, { upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('attachments')
      .insert({
        entity_table: params.entityTable,
        entity_id: params.entityId,
        rsqdf: params.rsqdf,
        file_name: params.file.name,
        storage_path: storagePath,
        mime_type: params.file.type || 'application/octet-stream',
        file_size: params.file.size,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AttachmentRow;
  }

  const db = loadLocalDb();
  if (db.activeRole === 'VIEWER') {
    throw new Error('Permission denied: VIEWER cannot upload attachments');
  }
  const previewDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(params.file);
  });

  const row: AttachmentRow = {
    id: newUuid(),
    entity_table: params.entityTable,
    entity_id: params.entityId,
    rsqdf: params.rsqdf,
    file_name: params.file.name,
    storage_path: storagePath,
    mime_type: params.file.type || 'application/octet-stream',
    file_size: params.file.size,
    uploaded_by: `preview-${db.activeRole.toLowerCase()}`,
    created_at: new Date().toISOString(),
    deleted_at: null,
    preview_data_url: previewDataUrl.slice(0, 400_000),
  };
  db.attachments.unshift(row);
  appendAudit(db, 'attachments', row.id, 'INSERT', null, {
    id: row.id,
    rsqdf: row.rsqdf,
    file_name: row.file_name,
    file_size: row.file_size,
  });
  saveLocalDb(db);
  return row;
}

export async function updateRsqdfAttachment(params: {
  attachment: AttachmentRow;
  fileName: string;
  replacementFile?: File | null;
}): Promise<AttachmentRow> {
  const cleanName = params.fileName.trim();
  if (!cleanName) {
    throw new Error('Document name is required');
  }

  const rsqdf = params.attachment.rsqdf ?? 'RSQDF';
  const file = params.replacementFile ?? null;

  if (isSupabaseConfigured && supabase) {
    let patch: Partial<AttachmentRow> = { file_name: cleanName };
    let oldStoragePathToDelete: string | null = null;
    let newlyUploadedPath: string | null = null;

    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const newPath = `${rsqdf}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('engineering-docs')
        .upload(newPath, file, { upsert: false });
      if (uploadError) throw uploadError;

      newlyUploadedPath = newPath;
      oldStoragePathToDelete = params.attachment.storage_path;
      patch = {
        file_name: cleanName,
        storage_path: newPath,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
      };
    }

    const { data, error } = await supabase
      .from('attachments')
      .update(patch)
      .eq('id', params.attachment.id)
      .select()
      .maybeSingle();
    if (error || !data) {
      if (newlyUploadedPath) {
        await supabase.storage.from('engineering-docs').remove([newlyUploadedPath]);
      }
      if (error) throw error;
      throw new Error(
        'Could not update attachment. Apply the latest attachments RLS SQL policies in Supabase.'
      );
    }

    if (oldStoragePathToDelete) {
      await supabase.storage
        .from('engineering-docs')
        .remove([oldStoragePathToDelete]);
    }
    return data as AttachmentRow;
  }

  const db = loadLocalDb();
  if (db.activeRole === 'VIEWER') {
    throw new Error('Permission denied: VIEWER cannot edit attachments');
  }
  const idx = db.attachments.findIndex(
    (a) => a.id === params.attachment.id && !a.deleted_at
  );
  if (idx === -1) {
    throw new Error('Attachment not found');
  }

  const oldRow = { ...db.attachments[idx] };
  let updated: AttachmentRow = {
    ...oldRow,
    file_name: cleanName,
  };

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const newPath = `${rsqdf}/${Date.now()}-${safeName}`;
    const previewDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    updated = {
      ...updated,
      storage_path: newPath,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      preview_data_url: previewDataUrl.slice(0, 400_000),
    };
  }

  db.attachments[idx] = updated;
  appendAudit(
    db,
    'attachments',
    updated.id,
    'UPDATE',
    { id: oldRow.id, rsqdf: oldRow.rsqdf, file_name: oldRow.file_name, file_size: oldRow.file_size },
    { id: updated.id, rsqdf: updated.rsqdf, file_name: updated.file_name, file_size: updated.file_size }
  );
  saveLocalDb(db);
  return updated;
}

export async function deleteRsqdfAttachment(attachment: AttachmentRow): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error, count } = await supabase
      .from('attachments')
      .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', attachment.id)
      .is('deleted_at', null);
    if (error) throw error;
    if (count === 0) {
      throw new Error(
        'Could not remove attachment. Apply the latest attachments RLS SQL policies in Supabase.'
      );
    }

    await supabase.storage
      .from('engineering-docs')
      .remove([attachment.storage_path]);
    return;
  }

  const db = loadLocalDb();
  if (db.activeRole === 'VIEWER') {
    throw new Error('Permission denied: VIEWER cannot remove attachments');
  }
  const idx = db.attachments.findIndex((a) => a.id === attachment.id && !a.deleted_at);
  if (idx === -1) return;

  const oldRow = { ...db.attachments[idx] };
  const now = new Date().toISOString();
  db.attachments[idx] = { ...oldRow, deleted_at: now };
  appendAudit(
    db,
    'attachments',
    attachment.id,
    'UPDATE',
    { id: oldRow.id, rsqdf: oldRow.rsqdf, file_name: oldRow.file_name, deleted_at: null },
    { id: oldRow.id, rsqdf: oldRow.rsqdf, file_name: oldRow.file_name, deleted_at: now }
  );
  saveLocalDb(db);
}

export async function getAttachmentSignedUrl(attachment: AttachmentRow): Promise<string | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.storage
      .from('engineering-docs')
      .createSignedUrl(attachment.storage_path, 300);
    if (error) throw error;
    return data?.signedUrl ?? null;
  }
  return attachment.preview_data_url || null;
}

export interface ItemTimelineBundle {
  rsqdf: string;
  quotations: QuotationRow[];
  samples: SampleRow[];
  approvals: ApprovalRow[];
  apqp: ApqpRow[];
  tooling: ToolingRow[];
  cnc: CncRow[];
  trfLogs: TrfLogRow[];
  attachments: AttachmentRow[];
}

export async function getRsqdfTimeline(rsqdf: string): Promise<ItemTimelineBundle> {
  const [quotations, samples, approvals, apqp, tooling, cnc, trfLogs, attachments] =
    await Promise.all([
      listStageRows<QuotationRow>('quotations'),
      listStageRows<SampleRow>('samples'),
      listStageRows<ApprovalRow>('approvals'),
      listStageRows<ApqpRow>('apqp'),
      listStageRows<ToolingRow>('tooling'),
      listStageRows<CncRow>('cnc'),
      listStageRows<TrfLogRow>('trf_logs'),
      listAttachmentsByRsqdf(rsqdf),
    ]);

  const match = (r: { rsqdf: string }) => r.rsqdf.toLowerCase() === rsqdf.toLowerCase();
  return {
    rsqdf,
    quotations: quotations.filter(match),
    samples: samples.filter(match),
    approvals: approvals.filter(match),
    apqp: apqp.filter(match),
    tooling: tooling.filter(match),
    cnc: cnc.filter(match),
    trfLogs: trfLogs.filter(match),
    attachments,
  };
}
