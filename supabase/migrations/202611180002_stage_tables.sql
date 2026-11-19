-- Migration 0002: Stage Tables, TRF Logs, MD Monthly, O.B., Audit Logs, Attachments

-- 1. SAMPLES
CREATE TABLE public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsqdf text NOT NULL,
  customer text NOT NULL,
  model_name text NOT NULL,
  record_type public.sample_record_type NOT NULL DEFAULT 'Sample',
  reference_number text,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  date_requested date,
  date_commitment date,
  date_finished date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_samples_rsqdf ON public.samples (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX idx_samples_tech_open_due ON public.samples (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND date_finished IS NULL;

-- 2. QUOTATION
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsqdf text NOT NULL,
  customer text NOT NULL,
  model_name text NOT NULL,
  record_type public.quotation_record_type NOT NULL DEFAULT 'Quotation',
  reference_number text,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  date_requested date,
  date_commitment date,
  date_finished date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_quotations_rsqdf ON public.quotations (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_tech_open_due ON public.quotations (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND date_finished IS NULL;

-- 3. APPROVAL
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_mode public.approval_po_mode NOT NULL DEFAULT 'With P.O.',
  rsqdf text NOT NULL,
  po_number text,
  customer text NOT NULL,
  model_name text NOT NULL,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  po_received_date date,
  date_commitment date,
  date_sent_to_customer date,
  date_received_signed_approval date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_approvals_rsqdf ON public.approvals (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX idx_approvals_tech_open_due ON public.approvals (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND date_received_signed_approval IS NULL;

-- 4. APQP (First Run)
CREATE TABLE public.apqp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES public.approvals(id) ON DELETE SET NULL,
  date_received_signed_approval date,
  po_reference text,
  rsqdf text NOT NULL,
  customer text NOT NULL,
  model_name text NOT NULL,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  status public.apqp_status NOT NULL DEFAULT 'Waiting for Meeting',
  meeting_date date,
  item_code_requested_date date,
  item_code_received_date date,
  item_code text,
  frrd_released_date date,
  forwarded_to_ppqc_date date,
  first_run_done_date date,
  frrd_returned_date date,
  forwarded_to_md_date date,
  forwarded_to_ddcc_date date,
  completed_date date,
  date_commitment date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_apqp_rsqdf ON public.apqp (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX idx_apqp_status ON public.apqp (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_apqp_tech_open_due ON public.apqp (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND completed_date IS NULL;

-- 4b. APQP Tooling Commitments (5 sub-items per APQP record)
CREATE TABLE public.apqp_tooling_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apqp_id uuid NOT NULL REFERENCES public.apqp(id) ON DELETE CASCADE,
  tooling_type public.tooling_category NOT NULL,
  needed boolean NOT NULL DEFAULT false,
  commitment_date date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (apqp_id, tooling_type)
);

-- 5. TRF LOGS (Technical Request Forms for internal revisions)
CREATE TABLE public.trf_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trf_number text NOT NULL UNIQUE,
  rsqdf text NOT NULL,
  customer text NOT NULL,
  model_name text NOT NULL,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  date_filed date NOT NULL DEFAULT current_date,
  reason_for_revision text NOT NULL,
  requires_tooling boolean NOT NULL DEFAULT false,
  tooling_type public.tooling_category,
  requires_md_revision boolean NOT NULL DEFAULT true,
  status public.trf_status NOT NULL DEFAULT 'Filed',
  date_completed date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_trf_logs_rsqdf ON public.trf_logs (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX idx_trf_logs_status ON public.trf_logs (status) WHERE deleted_at IS NULL;

-- 6. TOOLING
CREATE TABLE public.tooling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type public.tooling_source_type NOT NULL DEFAULT 'First Run',
  apqp_id uuid REFERENCES public.apqp(id) ON DELETE SET NULL,
  trf_id uuid REFERENCES public.trf_logs(id) ON DELETE SET NULL,
  trf_reference text,
  date_received date,
  rsqdf text NOT NULL,
  customer text NOT NULL,
  model_name text NOT NULL,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  tooling_type public.tooling_category NOT NULL,
  execution_mode public.tooling_execution_mode NOT NULL DEFAULT 'In House',
  commitment_date date,
  date_forwarded_to_ppqc date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_tooling_rsqdf ON public.tooling (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX idx_tooling_open_due ON public.tooling (technician_in_charge, commitment_date)
  WHERE deleted_at IS NULL AND date_forwarded_to_ppqc IS NULL;

-- 7. CNC
CREATE TABLE public.cnc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apqp_id uuid REFERENCES public.apqp(id) ON DELETE SET NULL,
  date_received date,
  rsqdf_jo text NOT NULL,
  rsqdf text NOT NULL,
  customer text NOT NULL,
  model_name text NOT NULL,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  qty_commitment integer,
  delivery_schedule date,
  date_finished date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_cnc_rsqdf ON public.cnc (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX idx_cnc_open_due ON public.cnc (technician_in_charge, delivery_schedule)
  WHERE deleted_at IS NULL AND date_finished IS NULL;

-- 8. MD MONTHLY (Manufacturing Drawing counters + overrides)
CREATE TABLE public.md_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key text NOT NULL UNIQUE CHECK (month_key ~ '^\d{4}-\d{2}$'),
  for_retrieval_override integer,
  for_final_md_override integer,
  forwarded_to_ddcc_override integer,
  with_special_case integer NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

-- 9. OFFICIAL BUSINESS (O.B.)
CREATE TABLE public.official_business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer text NOT NULL,
  ob_date date NOT NULL,
  ob_time time,
  technician_in_charge uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  sales_in_charge text,
  purpose text NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX idx_ob_date ON public.official_business (ob_date) WHERE deleted_at IS NULL;

-- 10. AUDIT LOGS (trigger-managed only)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  actor_role public.app_role,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);

-- 11. ATTACHMENTS (Phase 2 Storage metadata)
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  rsqdf text,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_attachments_entity ON public.attachments (entity_table, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_rsqdf ON public.attachments (rsqdf) WHERE deleted_at IS NULL;
