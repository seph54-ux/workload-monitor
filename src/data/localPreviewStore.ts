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
  type OfficialBusinessRow,
  type ProfileRow,
  type QuotationRow,
  type SampleRow,
  type StageTableName,
  type TechnicianRow,
  type ToolingRow,
  type TrfLogRow,
} from '../types/database.types';
import { getTodayManilaISO } from '../lib/dates';

export interface LocalPreviewDatabase {
  activeRole: AppRole;
  activeTechnicianId: string | null;
  technicians: TechnicianRow[];
  profiles: ProfileRow[];
  samples: SampleRow[];
  quotations: QuotationRow[];
  approvals: ApprovalRow[];
  apqp: ApqpRow[];
  apqp_tooling_commitments: ApqpToolingCommitmentRow[];
  trf_logs: TrfLogRow[];
  tooling: ToolingRow[];
  cnc: CncRow[];
  md_monthly: MdMonthlyRow[];
  official_business: OfficialBusinessRow[];
  audit_logs: AuditLogRow[];
  attachments: AttachmentRow[];
}

const STORAGE_KEY = 'techflow_wms_local_db_v1';
const CHANNEL_NAME = 'techflow_wms_realtime';

const TECH_IDS = {
  Clark: '10000000-0000-0000-0000-000000000001',
  TJ: '10000000-0000-0000-0000-000000000002',
  Titus: '10000000-0000-0000-0000-000000000003',
  Jai: '10000000-0000-0000-0000-000000000004',
  Shai: '10000000-0000-0000-0000-000000000005',
  Mei: '10000000-0000-0000-0000-000000000006',
  Daisy: '10000000-0000-0000-0000-000000000007',
  Lenard: '10000000-0000-0000-0000-000000000008',
  Aldrian: '10000000-0000-0000-0000-000000000009',
  Jhun: '10000000-0000-0000-0000-000000000010',
  Facs: '10000000-0000-0000-0000-000000000011',
  Mhel: '10000000-0000-0000-0000-000000000012',
} as const;

function createSeedDatabase(): LocalPreviewDatabase {
  const now = '2026-11-18T08:00:00.000Z';
  const common = {
    created_at: now,
    updated_at: now,
    created_by: 'admin-local-1',
    updated_by: 'admin-local-1',
    deleted_at: null,
  };

  const technicians: TechnicianRow[] = Object.entries(TECH_IDS).map(([name, id]) => ({
    id,
    name,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  return {
    activeRole: 'ADMIN',
    activeTechnicianId: TECH_IDS.Clark,
    technicians,
    profiles: [
      {
        id: 'admin-local-1',
        email: 'engineering.lead@company.local',
        full_name: 'Clark (Engineering Lead)',
        avatar_url: null,
        role: 'ADMIN',
        role_locked: true,
        status: 'active',
        linked_technician_id: TECH_IDS.Clark,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'tech-local-2',
        email: 'tj.tech@company.local',
        full_name: 'TJ (Technical)',
        avatar_url: null,
        role: 'TECHNICAL',
        role_locked: true,
        status: 'active',
        linked_technician_id: TECH_IDS.TJ,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'tooling-local-3',
        email: 'tooling.dept@company.local',
        full_name: 'Tooling Operations',
        avatar_url: null,
        role: 'TOOLING',
        role_locked: true,
        status: 'active',
        linked_technician_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'cnc-local-4',
        email: 'cnc.shop@company.local',
        full_name: 'CNC Machining',
        avatar_url: null,
        role: 'CNC',
        role_locked: true,
        status: 'active',
        linked_technician_id: null,
        created_at: now,
        updated_at: now,
      },
    ],
    quotations: [
      {
        ...common,
        id: '20000000-0000-0000-0000-000000000001',
        rsqdf: 'RSQDF-26-101',
        customer: 'Nidec Philippines',
        model_name: 'NDP-48V Stator Insulator',
        record_type: 'Quotation',
        reference_number: 'QT-26-0412',
        technician_in_charge: TECH_IDS.Clark,
        date_requested: '2026-11-04',
        date_commitment: '2026-11-10',
        date_finished: '2026-11-09',
        remarks: 'BOM & die-cut nesting costed',
      },
      {
        ...common,
        id: '20000000-0000-0000-0000-000000000002',
        rsqdf: 'RSQDF-26-108',
        customer: 'Epson Precision',
        model_name: 'EPS-L3210 Ink Pad Gasket',
        record_type: 'Sample',
        reference_number: 'SMP-26-089',
        technician_in_charge: TECH_IDS.TJ,
        date_requested: '2026-11-10',
        date_commitment: '2026-11-15',
        date_finished: null,
        remarks: 'Awaiting adhesive spec from supplier',
      },
      {
        ...common,
        id: '20000000-0000-0000-0000-000000000003',
        rsqdf: 'RSQDF-26-112',
        customer: 'Brother Industries',
        model_name: 'BRT-HL2350 Foam Seal',
        record_type: 'Quotation',
        reference_number: 'QT-26-0445',
        technician_in_charge: TECH_IDS.Shai,
        date_requested: '2026-11-14',
        date_commitment: '2026-11-20',
        date_finished: null,
        remarks: 'In progress — material yield check',
      },
      {
        ...common,
        id: '20000000-0000-0000-0000-000000000004',
        rsqdf: 'RSQDF-26-115',
        customer: 'Murata Manufacturing',
        model_name: 'MRT-HV Shield Spacer',
        record_type: 'Quotation',
        reference_number: null,
        technician_in_charge: TECH_IDS.Lenard,
        date_requested: '2026-11-16',
        date_commitment: '2026-11-24',
        date_finished: null,
        remarks: 'Initial drawing review started',
      },
    ],
    samples: [
      {
        ...common,
        id: '30000000-0000-0000-0000-000000000001',
        rsqdf: 'RSQDF-26-101',
        customer: 'Nidec Philippines',
        model_name: 'NDP-48V Stator Insulator',
        record_type: 'Sample',
        reference_number: 'SMP-26-072',
        technician_in_charge: TECH_IDS.Clark,
        date_requested: '2026-11-10',
        date_commitment: '2026-11-14',
        date_finished: '2026-11-13',
        remarks: '10 pcs submitted to QA',
      },
      {
        ...common,
        id: '30000000-0000-0000-0000-000000000002',
        rsqdf: 'RSQDF-26-104',
        customer: 'Canon Business Machines',
        model_name: 'CN-MF455 Thermal Pad',
        record_type: 'P.O.',
        reference_number: 'PO-992104',
        technician_in_charge: TECH_IDS.Titus,
        date_requested: '2026-11-08',
        date_commitment: '2026-11-14',
        date_finished: null,
        remarks: 'Delayed by silicone sheet arrival',
      },
      {
        ...common,
        id: '30000000-0000-0000-0000-000000000003',
        rsqdf: 'RSQDF-26-110',
        customer: 'Yazaki-Torres',
        model_name: 'YZK-EV Harness Boot',
        record_type: 'Sample',
        reference_number: 'SMP-26-094',
        technician_in_charge: TECH_IDS.Mei,
        date_requested: '2026-11-15',
        date_commitment: '2026-11-20',
        date_finished: null,
        remarks: 'Prototype molding scheduled',
      },
    ],
    approvals: [
      {
        ...common,
        id: '40000000-0000-0000-0000-000000000001',
        po_mode: 'With P.O.',
        rsqdf: 'RSQDF-26-101',
        po_number: 'PO-88412',
        customer: 'Nidec Philippines',
        model_name: 'NDP-48V Stator Insulator',
        technician_in_charge: TECH_IDS.Clark,
        po_received_date: '2026-11-14',
        date_commitment: '2026-11-18',
        date_sent_to_customer: '2026-11-15',
        date_received_signed_approval: '2026-11-17',
        remarks: 'Customer QA signed rev A',
      },
      {
        ...common,
        id: '40000000-0000-0000-0000-000000000002',
        po_mode: 'With P.O.',
        rsqdf: 'RSQDF-26-105',
        po_number: 'PO-88490',
        customer: 'Fujitsu Ten',
        model_name: 'FJT-Display Bezel Tape',
        technician_in_charge: TECH_IDS.Jai,
        po_received_date: '2026-11-07',
        date_commitment: '2026-11-13',
        date_sent_to_customer: '2026-11-09',
        date_received_signed_approval: null,
        remarks: 'Follow up sales for customer sign-off',
      },
      {
        ...common,
        id: '40000000-0000-0000-0000-000000000003',
        po_mode: 'Without P.O.',
        rsqdf: 'RSQDF-26-109',
        po_number: null,
        customer: 'Shimano Laguna',
        model_name: 'SHM-Cassette Spacer',
        technician_in_charge: TECH_IDS.Daisy,
        po_received_date: '2026-11-14',
        date_commitment: '2026-11-19',
        date_sent_to_customer: '2026-11-16',
        date_received_signed_approval: null,
        remarks: 'Early approval requested before P.O.',
      },
    ],
    apqp: [
      {
        ...common,
        id: '50000000-0000-0000-0000-000000000001',
        approval_id: '40000000-0000-0000-0000-000000000001',
        date_received_signed_approval: '2026-11-17',
        po_reference: 'PO-88412',
        rsqdf: 'RSQDF-26-101',
        customer: 'Nidec Philippines',
        model_name: 'NDP-48V Stator Insulator',
        technician_in_charge: TECH_IDS.Clark,
        status: 'FRRD Released',
        meeting_date: '2026-11-17',
        item_code_requested_date: '2026-11-17',
        item_code_received_date: '2026-11-18',
        item_code: 'IC-48021',
        frrd_released_date: '2026-11-18',
        forwarded_to_ppqc_date: null,
        first_run_done_date: null,
        frrd_returned_date: null,
        forwarded_to_md_date: null,
        forwarded_to_ddcc_date: null,
        completed_date: null,
        date_commitment: '2026-11-22',
        remarks: 'Ready to forward to PPQC',
      },
      {
        ...common,
        id: '50000000-0000-0000-0000-000000000002',
        approval_id: null,
        date_received_signed_approval: '2026-11-01',
        po_reference: 'PO-87901',
        rsqdf: 'RSQDF-26-092',
        customer: 'Toshiba Storage',
        model_name: 'TSH-HDD Damper Film',
        technician_in_charge: TECH_IDS.Aldrian,
        status: 'First Run Done',
        meeting_date: '2026-11-02',
        item_code_requested_date: '2026-11-03',
        item_code_received_date: '2026-11-04',
        item_code: 'IC-33910',
        frrd_released_date: '2026-11-05',
        forwarded_to_ppqc_date: '2026-11-06',
        first_run_done_date: '2026-11-12',
        frrd_returned_date: null,
        forwarded_to_md_date: null,
        forwarded_to_ddcc_date: null,
        completed_date: null,
        date_commitment: '2026-11-16',
        remarks: 'FRRD awaiting retrieval from prod',
      },
      {
        ...common,
        id: '50000000-0000-0000-0000-000000000003',
        approval_id: null,
        date_received_signed_approval: '2026-10-25',
        po_reference: 'PO-87550',
        rsqdf: 'RSQDF-26-085',
        customer: 'Denso Philippines',
        model_name: 'DNS-ECU Vent Membrane',
        technician_in_charge: TECH_IDS.Jhun,
        status: 'Forwarded to MD',
        meeting_date: '2026-10-26',
        item_code_requested_date: '2026-10-27',
        item_code_received_date: '2026-10-28',
        item_code: 'IC-21044',
        frrd_released_date: '2026-10-29',
        forwarded_to_ppqc_date: '2026-10-30',
        first_run_done_date: '2026-11-05',
        frrd_returned_date: '2026-11-08',
        forwarded_to_md_date: '2026-11-10',
        forwarded_to_ddcc_date: null,
        completed_date: null,
        date_commitment: '2026-11-20',
        remarks: 'MD revising tolerance callout',
      },
      {
        ...common,
        id: '50000000-0000-0000-0000-000000000004',
        approval_id: null,
        date_received_signed_approval: '2026-10-20',
        po_reference: 'PO-87300',
        rsqdf: 'RSQDF-26-079',
        customer: 'Panasonic Manufacturing',
        model_name: 'PNS-AC Control Overlay',
        technician_in_charge: TECH_IDS.Facs,
        status: 'Forwarded to DDCC',
        meeting_date: '2026-10-21',
        item_code_requested_date: '2026-10-22',
        item_code_received_date: '2026-10-23',
        item_code: 'IC-19881',
        frrd_released_date: '2026-10-24',
        forwarded_to_ppqc_date: '2026-10-25',
        first_run_done_date: '2026-11-01',
        frrd_returned_date: '2026-11-04',
        forwarded_to_md_date: '2026-11-06',
        forwarded_to_ddcc_date: '2026-11-14',
        completed_date: null,
        date_commitment: '2026-11-21',
        remarks: 'DDCC final stamp pending',
      },
    ],
    apqp_tooling_commitments: [
      { id: 'tc-1', apqp_id: '50000000-0000-0000-0000-000000000001', tooling_type: 'Die Cut', needed: true, commitment_date: '2026-11-20', remarks: '2-cavity steel rule die', created_at: now, updated_at: now, created_by: null, updated_by: null },
      { id: 'tc-2', apqp_id: '50000000-0000-0000-0000-000000000001', tooling_type: 'Rubber', needed: false, commitment_date: null, remarks: null, created_at: now, updated_at: now, created_by: null, updated_by: null },
      { id: 'tc-3', apqp_id: '50000000-0000-0000-0000-000000000001', tooling_type: 'Silkscreen', needed: false, commitment_date: null, remarks: null, created_at: now, updated_at: now, created_by: null, updated_by: null },
      { id: 'tc-4', apqp_id: '50000000-0000-0000-0000-000000000001', tooling_type: 'Pattern', needed: true, commitment_date: '2026-11-19', remarks: 'Inspection overlay', created_at: now, updated_at: now, created_by: null, updated_by: null },
      { id: 'tc-5', apqp_id: '50000000-0000-0000-0000-000000000001', tooling_type: 'Jig', needed: true, commitment_date: '2026-11-21', remarks: 'Pin alignment jig', created_at: now, updated_at: now, created_by: null, updated_by: null },
    ],
    trf_logs: [
      {
        ...common,
        id: '60000000-0000-0000-0000-000000000001',
        trf_number: 'TRF-2026-031',
        rsqdf: 'RSQDF-26-085',
        customer: 'Denso Philippines',
        model_name: 'DNS-ECU Vent Membrane',
        technician_in_charge: TECH_IDS.Jhun,
        date_filed: '2026-11-09',
        reason_for_revision: 'Adjust outer flange ID +0.15mm per first-run fit check',
        requires_tooling: true,
        tooling_type: 'Die Cut',
        requires_md_revision: true,
        status: 'In Tooling',
        date_completed: null,
        remarks: 'Die rework + MD rev B',
      },
      {
        ...common,
        id: '60000000-0000-0000-0000-000000000002',
        trf_number: 'TRF-2026-032',
        rsqdf: 'RSQDF-26-079',
        customer: 'Panasonic Manufacturing',
        model_name: 'PNS-AC Control Overlay',
        technician_in_charge: TECH_IDS.Facs,
        date_filed: '2026-11-11',
        reason_for_revision: 'Update silkscreen Pantone callout on MD',
        requires_tooling: false,
        tooling_type: null,
        requires_md_revision: true,
        status: 'In MD',
        date_completed: null,
        remarks: 'Forwarded to MD for official change',
      },
    ],
    tooling: [
      {
        ...common,
        id: '70000000-0000-0000-0000-000000000001',
        source_type: 'First Run',
        apqp_id: '50000000-0000-0000-0000-000000000001',
        trf_id: null,
        trf_reference: null,
        date_received: '2026-11-18',
        rsqdf: 'RSQDF-26-101',
        customer: 'Nidec Philippines',
        model_name: 'NDP-48V Stator Insulator',
        technician_in_charge: TECH_IDS.Clark,
        tooling_type: 'Die Cut',
        execution_mode: 'Job Out',
        commitment_date: '2026-11-20',
        date_forwarded_to_ppqc: null,
        remarks: 'PO sent to die maker',
      },
      {
        ...common,
        id: '70000000-0000-0000-0000-000000000002',
        source_type: 'TRF',
        apqp_id: null,
        trf_id: '60000000-0000-0000-0000-000000000001',
        trf_reference: 'TRF-2026-031',
        date_received: '2026-11-09',
        rsqdf: 'RSQDF-26-085',
        customer: 'Denso Philippines',
        model_name: 'DNS-ECU Vent Membrane',
        technician_in_charge: TECH_IDS.Jhun,
        tooling_type: 'Die Cut',
        execution_mode: 'In House',
        commitment_date: '2026-11-14',
        date_forwarded_to_ppqc: null,
        remarks: 'Overdue internal blade modification',
      },
      {
        ...common,
        id: '70000000-0000-0000-0000-000000000003',
        source_type: 'First Run',
        apqp_id: '50000000-0000-0000-0000-000000000004',
        trf_id: null,
        trf_reference: null,
        date_received: '2026-10-24',
        rsqdf: 'RSQDF-26-079',
        customer: 'Panasonic Manufacturing',
        model_name: 'PNS-AC Control Overlay',
        technician_in_charge: TECH_IDS.Facs,
        tooling_type: 'Silkscreen',
        execution_mode: 'In House',
        commitment_date: '2026-10-28',
        date_forwarded_to_ppqc: '2026-10-27',
        remarks: 'Mesh 200 screen delivered to PPQC',
      },
    ],
    cnc: [
      {
        ...common,
        id: '80000000-0000-0000-0000-000000000001',
        apqp_id: '50000000-0000-0000-0000-000000000001',
        date_received: '2026-11-18',
        rsqdf_jo: 'RSQDF-26-101 / JO-411',
        rsqdf: 'RSQDF-26-101',
        customer: 'Nidec Philippines',
        model_name: 'NDP-48V Stator Insulator',
        technician_in_charge: TECH_IDS.Clark,
        qty_commitment: 2,
        delivery_schedule: '2026-11-20',
        date_finished: null,
        remarks: 'Delrin alignment block milling',
      },
      {
        ...common,
        id: '80000000-0000-0000-0000-000000000002',
        apqp_id: '50000000-0000-0000-0000-000000000002',
        date_received: '2026-11-04',
        rsqdf_jo: 'RSQDF-26-092 / JO-398',
        rsqdf: 'RSQDF-26-092',
        customer: 'Toshiba Storage',
        model_name: 'TSH-HDD Damper Film',
        technician_in_charge: TECH_IDS.Aldrian,
        qty_commitment: 1,
        delivery_schedule: '2026-11-08',
        date_finished: '2026-11-07',
        remarks: 'Aluminum fixture base finished',
      },
    ],
    md_monthly: [
      {
        ...common,
        id: 'md-2026-11',
        month_key: '2026-11',
        for_retrieval_override: null,
        for_final_md_override: null,
        forwarded_to_ddcc_override: null,
        with_special_case: 1,
        remarks: 'Auto-computed from APQP; 1 special case tolerance on DNS-ECU',
      },
    ],
    official_business: [
      {
        ...common,
        id: '90000000-0000-0000-0000-000000000001',
        customer: 'Nidec Philippines',
        ob_date: '2026-11-19',
        ob_time: '09:30:00',
        technician_in_charge: TECH_IDS.Clark,
        sales_in_charge: 'Ms. Carla Reyes',
        purpose: 'First run line trial & dimensional audit',
        remarks: 'Bring calipers & sample jig',
      },
      {
        ...common,
        id: '90000000-0000-0000-0000-000000000002',
        customer: 'Canon Business Machines',
        ob_date: '2026-11-21',
        ob_time: '14:00:00',
        technician_in_charge: TECH_IDS.Titus,
        sales_in_charge: 'Mr. Paolo Cruz',
        purpose: 'Thermal pad material qualification meeting',
        remarks: 'Design development',
      },
      {
        ...common,
        id: '90000000-0000-0000-0000-000000000003',
        customer: 'Epson Precision',
        ob_date: '2026-11-24',
        ob_time: '10:00:00',
        technician_in_charge: TECH_IDS.Mhel,
        sales_in_charge: 'Ms. Ana Lim',
        purpose: 'Quotation technical clarification',
        remarks: 'Confirm adhesive peel spec',
      },
    ],
    audit_logs: [
      {
        id: 'audit-seed-1',
        table_name: 'apqp',
        record_id: '50000000-0000-0000-0000-000000000001',
        action: 'UPDATE',
        actor_id: 'admin-local-1',
        actor_role: 'ADMIN',
        old_data: { status: 'Item Code Received' },
        new_data: { status: 'FRRD Released', item_code: 'IC-48021' },
        changed_fields: ['status', 'item_code', 'frrd_released_date'],
        created_at: now,
      },
    ],
    attachments: [],
  };
}

const listeners = new Set<() => void>();
let bc: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  bc = new BroadcastChannel(CHANNEL_NAME);
  bc.onmessage = () => {
    listeners.forEach((fn) => fn());
  };
}

export function subscribeLocalPreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChange() {
  listeners.forEach((fn) => fn());
  bc?.postMessage({ type: 'db_updated', at: Date.now() });
}

export function loadLocalDb(): LocalPreviewDatabase {
  if (typeof window === 'undefined') {
    return createSeedDatabase();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedDatabase();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as LocalPreviewDatabase;
  } catch {
    return createSeedDatabase();
  }
}

export function saveLocalDb(db: LocalPreviewDatabase): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
  notifyChange();
}

export function resetLocalDb(): LocalPreviewDatabase {
  const seed = createSeedDatabase();
  saveLocalDb(seed);
  return seed;
}

export function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function appendAudit(
  db: LocalPreviewDatabase,
  tableName: string,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
) {
  const changed: string[] = [];
  if (action === 'UPDATE' && oldData && newData) {
    for (const k of Object.keys(newData)) {
      if (k === 'updated_at' || k === 'updated_by') continue;
      if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
        changed.push(k);
      }
    }
  }
  db.audit_logs.unshift({
    id: newUuid(),
    table_name: tableName,
    record_id: recordId,
    action,
    actor_id: `preview-${db.activeRole.toLowerCase()}`,
    actor_role: db.activeRole,
    old_data: oldData,
    new_data: newData,
    changed_fields: changed,
    created_at: new Date().toISOString(),
  });
}

export function getApqpCommitmentsFor(
  db: LocalPreviewDatabase,
  apqpId: string
): ApqpToolingCommitmentRow[] {
  const existing = db.apqp_tooling_commitments.filter((c) => c.apqp_id === apqpId);
  const now = new Date().toISOString();
  return TOOLING_CATEGORIES.map((cat) => {
    const found = existing.find((e) => e.tooling_type === cat);
    if (found) return found;
    return {
      id: `${apqpId}-${cat}`,
      apqp_id: apqpId,
      tooling_type: cat,
      needed: false,
      commitment_date: null,
      remarks: null,
      created_at: now,
      updated_at: now,
      created_by: null,
      updated_by: null,
    };
  });
}

export function getTodayISO(): string {
  return getTodayManilaISO();
}

export type LocalStageCollectionKey = StageTableName;
