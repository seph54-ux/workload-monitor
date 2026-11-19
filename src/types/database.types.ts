export type AppRole = 'ADMIN' | 'TECHNICAL' | 'VIEWER' | 'TOOLING' | 'CNC';
export type AccountStatus = 'active' | 'inactive';
export type RoleRequestStatus = 'pending' | 'approved' | 'rejected';

export type SampleRecordType = 'Sample' | 'P.O.';
export type QuotationRecordType = 'Sample' | 'Quotation';
export type ApprovalPoMode = 'With P.O.' | 'Without P.O.';

export const APQP_STATUSES = [
  'Waiting for Meeting',
  'Meeting Done',
  'Item Code Requested',
  'Item Code Received',
  'FRRD Released',
  'Forwarded to PPQC',
  'First Run Done',
  'FRRD Returned',
  'Forwarded to MD',
  'Forwarded to DDCC',
  'Completed',
] as const;

export type ApqpStatus = (typeof APQP_STATUSES)[number];

export type ToolingSourceType = 'First Run' | 'TRF';
export const TOOLING_CATEGORIES = [
  'Die Cut',
  'Rubber',
  'Silkscreen',
  'Pattern',
  'Jig',
] as const;
export type ToolingCategory = (typeof TOOLING_CATEGORIES)[number];
export type ToolingExecutionMode = 'Job Out' | 'In House';
export const TRF_STATUSES = ['Filed', 'In Tooling', 'In MD', 'Completed'] as const;
export type TrfStatus = (typeof TRF_STATUSES)[number];

export type TechnicianRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: AppRole;
  role_locked: boolean;
  status: AccountStatus;
  linked_technician_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RoleChangeRequestRow = {
  id: string;
  user_id: string;
  existing_role: AppRole;
  requested_role: AppRole;
  reason: string;
  status: RoleRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type CommonRecordFields = {
  id: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};

export type SampleRow = CommonRecordFields & {
  rsqdf: string;
  customer: string;
  model_name: string;
  record_type: SampleRecordType;
  reference_number: string | null;
  technician_in_charge: string | null;
  date_requested: string | null;
  date_commitment: string | null;
  date_finished: string | null;
};

export type QuotationRow = CommonRecordFields & {
  rsqdf: string;
  customer: string;
  model_name: string;
  record_type: QuotationRecordType;
  reference_number: string | null;
  technician_in_charge: string | null;
  date_requested: string | null;
  date_commitment: string | null;
  date_finished: string | null;
};

export type ApprovalRow = CommonRecordFields & {
  po_mode: ApprovalPoMode;
  rsqdf: string;
  po_number: string | null;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  po_received_date: string | null;
  date_commitment: string | null;
  date_sent_to_customer: string | null;
  date_received_signed_approval: string | null;
};

export type ApqpToolingCommitmentRow = {
  id: string;
  apqp_id: string;
  tooling_type: ToolingCategory;
  needed: boolean;
  commitment_date: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ApqpRow = CommonRecordFields & {
  approval_id: string | null;
  date_received_signed_approval: string | null;
  po_reference: string | null;
  rsqdf: string;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  status: ApqpStatus;
  meeting_date: string | null;
  item_code_requested_date: string | null;
  item_code_received_date: string | null;
  item_code: string | null;
  frrd_released_date: string | null;
  forwarded_to_ppqc_date: string | null;
  first_run_done_date: string | null;
  frrd_returned_date: string | null;
  forwarded_to_md_date: string | null;
  forwarded_to_ddcc_date: string | null;
  completed_date: string | null;
  date_commitment: string | null;
  tooling_commitments?: ApqpToolingCommitmentRow[];
};

export type TrfLogRow = CommonRecordFields & {
  trf_number: string;
  rsqdf: string;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  date_filed: string;
  reason_for_revision: string;
  requires_tooling: boolean;
  tooling_type: ToolingCategory | null;
  requires_md_revision: boolean;
  status: TrfStatus;
  date_completed: string | null;
};

export type ToolingRow = CommonRecordFields & {
  source_type: ToolingSourceType;
  apqp_id: string | null;
  trf_id: string | null;
  trf_reference: string | null;
  date_received: string | null;
  rsqdf: string;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  tooling_type: ToolingCategory;
  execution_mode: ToolingExecutionMode;
  commitment_date: string | null;
  date_forwarded_to_ppqc: string | null;
};

export type CncRow = CommonRecordFields & {
  apqp_id: string | null;
  date_received: string | null;
  rsqdf_jo: string;
  rsqdf: string;
  customer: string;
  model_name: string;
  technician_in_charge: string | null;
  qty_commitment: number | null;
  delivery_schedule: string | null;
  date_finished: string | null;
};

export type MdMonthlyRow = CommonRecordFields & {
  month_key: string;
  for_retrieval_override: number | null;
  for_final_md_override: number | null;
  forwarded_to_ddcc_override: number | null;
  with_special_case: number;
};

export type MdMonthlySummary = {
  id: string | null;
  month_key: string;
  auto_for_retrieval: number;
  auto_for_final_md: number;
  auto_forwarded_to_ddcc: number;
  for_retrieval_override: number | null;
  for_final_md_override: number | null;
  forwarded_to_ddcc_override: number | null;
  for_retrieval: number;
  for_final_md: number;
  forwarded_to_ddcc: number;
  total: number;
  with_special_case: number;
  remarks: string | null;
  updated_at: string | null;
};

export type OfficialBusinessRow = CommonRecordFields & {
  customer: string;
  ob_date: string;
  ob_time: string | null;
  technician_in_charge: string | null;
  sales_in_charge: string | null;
  purpose: string;
};

export type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  actor_id: string | null;
  actor_role: AppRole | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[];
  created_at: string;
};

export type AttachmentRow = {
  id: string;
  entity_table: string;
  entity_id: string;
  rsqdf: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
  preview_data_url?: string;
};

export type StageTableName =
  | 'samples'
  | 'quotations'
  | 'approvals'
  | 'apqp'
  | 'tooling'
  | 'cnc'
  | 'md_monthly'
  | 'trf_logs'
  | 'official_business';

export type Database = {
  public: {
    Tables: {
      technicians: { Row: TechnicianRow; Insert: Partial<TechnicianRow>; Update: Partial<TechnicianRow>; Relationships: [] };
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow>; Relationships: [] };
      role_change_requests: { Row: RoleChangeRequestRow; Insert: Partial<RoleChangeRequestRow>; Update: Partial<RoleChangeRequestRow>; Relationships: [] };
      samples: { Row: SampleRow; Insert: Partial<SampleRow>; Update: Partial<SampleRow>; Relationships: [] };
      quotations: { Row: QuotationRow; Insert: Partial<QuotationRow>; Update: Partial<QuotationRow>; Relationships: [] };
      approvals: { Row: ApprovalRow; Insert: Partial<ApprovalRow>; Update: Partial<ApprovalRow>; Relationships: [] };
      apqp: { Row: ApqpRow; Insert: Partial<ApqpRow>; Update: Partial<ApqpRow>; Relationships: [] };
      apqp_tooling_commitments: { Row: ApqpToolingCommitmentRow; Insert: Partial<ApqpToolingCommitmentRow>; Update: Partial<ApqpToolingCommitmentRow>; Relationships: [] };
      trf_logs: { Row: TrfLogRow; Insert: Partial<TrfLogRow>; Update: Partial<TrfLogRow>; Relationships: [] };
      tooling: { Row: ToolingRow; Insert: Partial<ToolingRow>; Update: Partial<ToolingRow>; Relationships: [] };
      cnc: { Row: CncRow; Insert: Partial<CncRow>; Update: Partial<CncRow>; Relationships: [] };
      md_monthly: { Row: MdMonthlyRow; Insert: Partial<MdMonthlyRow>; Update: Partial<MdMonthlyRow>; Relationships: [] };
      official_business: { Row: OfficialBusinessRow; Insert: Partial<OfficialBusinessRow>; Update: Partial<OfficialBusinessRow>; Relationships: [] };
      audit_logs: { Row: AuditLogRow; Insert: Partial<AuditLogRow>; Update: Partial<AuditLogRow>; Relationships: [] };
      attachments: { Row: AttachmentRow; Insert: Partial<AttachmentRow>; Update: Partial<AttachmentRow>; Relationships: [] };
    };
    Views: {
      md_monthly_summary: { Row: MdMonthlySummary; Relationships: [] };
    };
    Functions: {
      get_md_monthly_summary: {
        Args: { p_month_key: string | null };
        Returns: MdMonthlySummary[];
      };
      promote_stage: {
        Args: {
          p_from_stage: string;
          p_record_id: string;
          p_to_stage: string;
          p_payload?: Record<string, unknown>;
        };
        Returns: Record<string, unknown>;
      };
      create_trf_with_links: {
        Args: { p_payload: Record<string, unknown> };
        Returns: Record<string, unknown>;
      };
      soft_delete_record: {
        Args: { p_table_name: string; p_record_id: string };
        Returns: undefined;
      };
    };
  };
};
