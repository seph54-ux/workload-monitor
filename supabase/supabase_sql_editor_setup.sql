-- =============================================================================
-- TechFlow WMS (Technical / Engineering Department Workload Monitoring System)
-- COMPLETE SUPABASE SQL EDITOR SETUP SCRIPT
-- =============================================================================
-- Safe to paste and run directly in Supabase Dashboard -> SQL Editor.
-- Matches all table names, column names, enums, views, RPCs, storage buckets,
-- and TypeScript types in the application 1-for-1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS & DOMAIN ENUMS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('ADMIN', 'TECHNICAL', 'VIEWER', 'TOOLING', 'CNC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.account_status AS ENUM ('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.role_request_status AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.sample_record_type AS ENUM ('Sample', 'P.O.'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quotation_record_type AS ENUM ('Sample', 'Quotation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.approval_po_mode AS ENUM ('With P.O.', 'Without P.O.'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.apqp_status AS ENUM (
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
    'Completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.tooling_source_type AS ENUM ('First Run', 'TRF'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tooling_category AS ENUM ('Die Cut', 'Rubber', 'Silkscreen', 'Pattern', 'Jig'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tooling_execution_mode AS ENUM ('Job Out', 'In House'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.trf_status AS ENUM ('Filed', 'In Tooling', 'In MD', 'Completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. CORE & WORKSPACE TABLES
-- -----------------------------------------------------------------------------
-- Controls Phase 1 open workspace (require_auth = false) vs Phase 2 strict per-user Auth (require_auth = true)
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  require_auth boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.workspace_settings (id, require_auth)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

-- 12 seeded Technical In Charge engineers (editable by ADMIN)
CREATE TABLE IF NOT EXISTS public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User profiles (authoritative source for user role & status in Phase 2 Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  role public.app_role NOT NULL DEFAULT 'VIEWER',
  role_locked boolean NOT NULL DEFAULT true,
  status public.account_status NOT NULL DEFAULT 'active',
  linked_technician_id uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_linked_tech ON public.profiles (linked_technician_id);

-- Role Change Requests (max 1 pending request per user; approved/rejected by ADMIN)
CREATE TABLE IF NOT EXISTS public.role_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  existing_role public.app_role NOT NULL,
  requested_role public.app_role NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 5),
  status public.role_request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_change_requests_one_pending
  ON public.role_change_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_role_change_requests_status
  ON public.role_change_requests (status, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. OPERATIONAL STAGE TABLES
-- -----------------------------------------------------------------------------
-- 3.1 SAMPLES
CREATE TABLE IF NOT EXISTS public.samples (
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
CREATE INDEX IF NOT EXISTS idx_samples_rsqdf ON public.samples (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_samples_tech_open_due ON public.samples (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND date_finished IS NULL;

-- 3.2 QUOTATIONS
CREATE TABLE IF NOT EXISTS public.quotations (
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
CREATE INDEX IF NOT EXISTS idx_quotations_rsqdf ON public.quotations (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_tech_open_due ON public.quotations (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND date_finished IS NULL;

-- 3.3 APPROVALS
CREATE TABLE IF NOT EXISTS public.approvals (
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
CREATE INDEX IF NOT EXISTS idx_approvals_rsqdf ON public.approvals (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approvals_tech_open_due ON public.approvals (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND date_received_signed_approval IS NULL;

-- 3.4 APQP (First Run)
CREATE TABLE IF NOT EXISTS public.apqp (
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
CREATE INDEX IF NOT EXISTS idx_apqp_rsqdf ON public.apqp (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apqp_status ON public.apqp (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apqp_tech_open_due ON public.apqp (technician_in_charge, date_commitment)
  WHERE deleted_at IS NULL AND completed_date IS NULL;

-- 3.4b APQP Tooling Commitments (5 sub-items per APQP record)
CREATE TABLE IF NOT EXISTS public.apqp_tooling_commitments (
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

-- 3.5 TRF LOGS (Technical Request Forms)
CREATE TABLE IF NOT EXISTS public.trf_logs (
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
CREATE INDEX IF NOT EXISTS idx_trf_logs_rsqdf ON public.trf_logs (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trf_logs_status ON public.trf_logs (status) WHERE deleted_at IS NULL;

-- 3.6 TOOLING
CREATE TABLE IF NOT EXISTS public.tooling (
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
CREATE INDEX IF NOT EXISTS idx_tooling_rsqdf ON public.tooling (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tooling_open_due ON public.tooling (technician_in_charge, commitment_date)
  WHERE deleted_at IS NULL AND date_forwarded_to_ppqc IS NULL;

-- 3.7 CNC
CREATE TABLE IF NOT EXISTS public.cnc (
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
CREATE INDEX IF NOT EXISTS idx_cnc_rsqdf ON public.cnc (rsqdf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cnc_open_due ON public.cnc (technician_in_charge, delivery_schedule)
  WHERE deleted_at IS NULL AND date_finished IS NULL;

-- 3.8 MD MONTHLY (Manufacturing Drawing counters + overrides)
CREATE TABLE IF NOT EXISTS public.md_monthly (
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

-- 3.9 OFFICIAL BUSINESS (O.B.)
CREATE TABLE IF NOT EXISTS public.official_business (
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
CREATE INDEX IF NOT EXISTS idx_ob_date ON public.official_business (ob_date) WHERE deleted_at IS NULL;

-- 3.10 AUDIT LOGS (trigger-managed only; client writes revoked)
CREATE TABLE IF NOT EXISTS public.audit_logs (
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);

-- 3.11 ATTACHMENTS (Storage metadata)
CREATE TABLE IF NOT EXISTS public.attachments (
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
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON public.attachments (entity_table, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_rsqdf ON public.attachments (rsqdf) WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 4. SECURITY DEFINER ROLE HELPERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_auth_required()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT require_auth FROM public.workspace_settings WHERE id = true), true);
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN (
      SELECT role FROM public.profiles WHERE id = auth.uid() AND status = 'active'
    )
    WHEN NOT public.is_auth_required() THEN 'ADMIN'::public.app_role
    ELSE NULL::public.app_role
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'ADMIN' AND status = 'active'
    )
    WHEN NOT public.is_auth_required() THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND status = 'active'
    )
    WHEN NOT public.is_auth_required() THEN true
    ELSE false
  END;
$$;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY POLICIES & STORAGE BUCKET
-- -----------------------------------------------------------------------------
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apqp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apqp_tooling_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trf_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tooling ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_business ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Workspace Settings
DROP POLICY IF EXISTS workspace_settings_select ON public.workspace_settings;
CREATE POLICY workspace_settings_select ON public.workspace_settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS workspace_settings_update_admin ON public.workspace_settings;
CREATE POLICY workspace_settings_update_admin ON public.workspace_settings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Technicians
DROP POLICY IF EXISTS technicians_select_active ON public.technicians;
CREATE POLICY technicians_select_active ON public.technicians
  FOR SELECT USING (public.is_active_user());
DROP POLICY IF EXISTS technicians_admin_all ON public.technicians;
CREATE POLICY technicians_admin_all ON public.technicians
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Profiles
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS profiles_admin_insert_delete ON public.profiles;
CREATE POLICY profiles_admin_insert_delete ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Role Change Requests
DROP POLICY IF EXISTS role_requests_select_own_or_admin ON public.role_change_requests;
CREATE POLICY role_requests_select_own_or_admin ON public.role_change_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS role_requests_insert_own ON public.role_change_requests;
CREATE POLICY role_requests_insert_own ON public.role_change_requests
  FOR INSERT WITH CHECK (
    public.is_active_user()
    AND user_id = auth.uid()
    AND status = 'pending'
    AND existing_role = public.current_app_role()
    AND requested_role <> public.current_app_role()
  );
DROP POLICY IF EXISTS role_requests_admin_update ON public.role_change_requests;
CREATE POLICY role_requests_admin_update ON public.role_change_requests
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Samples
DROP POLICY IF EXISTS samples_select ON public.samples;
CREATE POLICY samples_select ON public.samples
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS samples_insert ON public.samples;
CREATE POLICY samples_insert ON public.samples
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS samples_update ON public.samples;
CREATE POLICY samples_update ON public.samples
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS samples_delete_admin ON public.samples;
CREATE POLICY samples_delete_admin ON public.samples
  FOR DELETE USING (public.is_admin());

-- Quotations
DROP POLICY IF EXISTS quotations_select ON public.quotations;
CREATE POLICY quotations_select ON public.quotations
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS quotations_insert ON public.quotations;
CREATE POLICY quotations_insert ON public.quotations
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS quotations_update ON public.quotations;
CREATE POLICY quotations_update ON public.quotations
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS quotations_delete_admin ON public.quotations;
CREATE POLICY quotations_delete_admin ON public.quotations
  FOR DELETE USING (public.is_admin());

-- Approvals
DROP POLICY IF EXISTS approvals_select ON public.approvals;
CREATE POLICY approvals_select ON public.approvals
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS approvals_insert ON public.approvals;
CREATE POLICY approvals_insert ON public.approvals
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS approvals_update ON public.approvals;
CREATE POLICY approvals_update ON public.approvals
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS approvals_delete_admin ON public.approvals;
CREATE POLICY approvals_delete_admin ON public.approvals
  FOR DELETE USING (public.is_admin());

-- APQP
DROP POLICY IF EXISTS apqp_select ON public.apqp;
CREATE POLICY apqp_select ON public.apqp
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS apqp_insert ON public.apqp;
CREATE POLICY apqp_insert ON public.apqp
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS apqp_update ON public.apqp;
CREATE POLICY apqp_update ON public.apqp
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS apqp_delete_admin ON public.apqp;
CREATE POLICY apqp_delete_admin ON public.apqp
  FOR DELETE USING (public.is_admin());

-- APQP Tooling Commitments
DROP POLICY IF EXISTS apqp_tc_select ON public.apqp_tooling_commitments;
CREATE POLICY apqp_tc_select ON public.apqp_tooling_commitments
  FOR SELECT USING (public.is_active_user());
DROP POLICY IF EXISTS apqp_tc_write ON public.apqp_tooling_commitments;
CREATE POLICY apqp_tc_write ON public.apqp_tooling_commitments
  FOR ALL USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));

-- TRF Logs
DROP POLICY IF EXISTS trf_logs_select ON public.trf_logs;
CREATE POLICY trf_logs_select ON public.trf_logs
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS trf_logs_insert ON public.trf_logs;
CREATE POLICY trf_logs_insert ON public.trf_logs
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS trf_logs_update ON public.trf_logs;
CREATE POLICY trf_logs_update ON public.trf_logs
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS trf_logs_delete_admin ON public.trf_logs;
CREATE POLICY trf_logs_delete_admin ON public.trf_logs
  FOR DELETE USING (public.is_admin());

-- MD Monthly
DROP POLICY IF EXISTS md_monthly_select ON public.md_monthly;
CREATE POLICY md_monthly_select ON public.md_monthly
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS md_monthly_insert ON public.md_monthly;
CREATE POLICY md_monthly_insert ON public.md_monthly
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS md_monthly_update ON public.md_monthly;
CREATE POLICY md_monthly_update ON public.md_monthly
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS md_monthly_delete_admin ON public.md_monthly;
CREATE POLICY md_monthly_delete_admin ON public.md_monthly
  FOR DELETE USING (public.is_admin());

-- Official Business
DROP POLICY IF EXISTS ob_select ON public.official_business;
CREATE POLICY ob_select ON public.official_business
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS ob_insert ON public.official_business;
CREATE POLICY ob_insert ON public.official_business
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS ob_update ON public.official_business;
CREATE POLICY ob_update ON public.official_business
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS ob_delete_admin ON public.official_business;
CREATE POLICY ob_delete_admin ON public.official_business
  FOR DELETE USING (public.is_admin());

-- Tooling
DROP POLICY IF EXISTS tooling_select ON public.tooling;
CREATE POLICY tooling_select ON public.tooling
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS tooling_insert ON public.tooling;
CREATE POLICY tooling_insert ON public.tooling
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS tooling_update ON public.tooling;
CREATE POLICY tooling_update ON public.tooling
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING'));
DROP POLICY IF EXISTS tooling_delete_admin ON public.tooling;
CREATE POLICY tooling_delete_admin ON public.tooling
  FOR DELETE USING (public.is_admin());

-- CNC
DROP POLICY IF EXISTS cnc_select ON public.cnc;
CREATE POLICY cnc_select ON public.cnc
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS cnc_insert ON public.cnc;
CREATE POLICY cnc_insert ON public.cnc
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
DROP POLICY IF EXISTS cnc_update ON public.cnc;
CREATE POLICY cnc_update ON public.cnc
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'CNC'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'CNC'));
DROP POLICY IF EXISTS cnc_delete_admin ON public.cnc;
CREATE POLICY cnc_delete_admin ON public.cnc
  FOR DELETE USING (public.is_admin());

-- Audit Logs (ADMIN read-only)
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- Attachments
DROP POLICY IF EXISTS attachments_select ON public.attachments;
CREATE POLICY attachments_select ON public.attachments
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
DROP POLICY IF EXISTS attachments_insert ON public.attachments;
CREATE POLICY attachments_insert ON public.attachments
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC'));
DROP POLICY IF EXISTS attachments_update ON public.attachments;
CREATE POLICY attachments_update ON public.attachments
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC'));
DROP POLICY IF EXISTS attachments_delete_admin ON public.attachments;
CREATE POLICY attachments_delete_admin ON public.attachments
  FOR DELETE USING (public.is_admin());

-- Private Storage Bucket ('engineering-docs') & Storage Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('engineering-docs', 'engineering-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_eng_docs_select ON storage.objects;
CREATE POLICY storage_eng_docs_select ON storage.objects
  FOR SELECT USING (bucket_id = 'engineering-docs' AND public.is_active_user());
DROP POLICY IF EXISTS storage_eng_docs_insert ON storage.objects;
CREATE POLICY storage_eng_docs_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  );
DROP POLICY IF EXISTS storage_eng_docs_update ON storage.objects;
CREATE POLICY storage_eng_docs_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  )
  WITH CHECK (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  );
DROP POLICY IF EXISTS storage_eng_docs_delete ON storage.objects;
CREATE POLICY storage_eng_docs_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  );

-- Explicit PostgREST Table Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.technicians,
  public.profiles,
  public.role_change_requests,
  public.samples,
  public.quotations,
  public.approvals,
  public.apqp,
  public.apqp_tooling_commitments,
  public.trf_logs,
  public.tooling,
  public.cnc,
  public.md_monthly,
  public.official_business,
  public.attachments
TO anon, authenticated;

GRANT SELECT, UPDATE ON public.workspace_settings TO anon, authenticated;
GRANT SELECT ON public.audit_logs TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. TRIGGER FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_actor_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.updated_by := COALESCE(auth.uid(), OLD.updated_by);
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-create locked profile on auth.users sign-up (Phase 2)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role text;
  v_role public.app_role := 'VIEWER';
  v_full_name text;
BEGIN
  v_requested_role := upper(coalesce(NEW.raw_user_meta_data->>'requested_role', 'VIEWER'));
  IF v_requested_role IN ('TECHNICAL', 'VIEWER', 'TOOLING', 'CNC') THEN
    v_role := v_requested_role::public.app_role;
  END IF;

  v_full_name := coalesce(
    nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, full_name, role, role_locked, status)
  VALUES (NEW.id, NEW.email, v_full_name, v_role, true, 'active')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role Lock Enforcement Trigger on profiles
CREATE OR REPLACE FUNCTION public.protect_profile_role_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.role_locked IS DISTINCT FROM OLD.role_locked
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.linked_technician_id IS DISTINCT FROM OLD.linked_technician_id THEN
      RAISE EXCEPTION 'Permission denied: only ADMIN can modify role, role_locked, status, or linked_technician_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_role ON public.profiles;
CREATE TRIGGER trg_profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_fields();

-- Column-restricting trigger for TOOLING role
CREATE OR REPLACE FUNCTION public.restrict_tooling_role_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_app_role() = 'TOOLING' THEN
    IF NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.apqp_id IS DISTINCT FROM OLD.apqp_id
       OR NEW.trf_id IS DISTINCT FROM OLD.trf_id
       OR NEW.trf_reference IS DISTINCT FROM OLD.trf_reference
       OR NEW.date_received IS DISTINCT FROM OLD.date_received
       OR NEW.rsqdf IS DISTINCT FROM OLD.rsqdf
       OR NEW.customer IS DISTINCT FROM OLD.customer
       OR NEW.model_name IS DISTINCT FROM OLD.model_name
       OR NEW.technician_in_charge IS DISTINCT FROM OLD.technician_in_charge
       OR NEW.tooling_type IS DISTINCT FROM OLD.tooling_type
       OR NEW.commitment_date IS DISTINCT FROM OLD.commitment_date
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'TOOLING role may only update execution_mode, date_forwarded_to_ppqc, and remarks';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tooling_restrict_columns ON public.tooling;
CREATE TRIGGER trg_tooling_restrict_columns
  BEFORE UPDATE ON public.tooling
  FOR EACH ROW EXECUTE FUNCTION public.restrict_tooling_role_updates();

-- Column-restricting trigger for CNC role
CREATE OR REPLACE FUNCTION public.restrict_cnc_role_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_app_role() = 'CNC' THEN
    IF NEW.apqp_id IS DISTINCT FROM OLD.apqp_id
       OR NEW.date_received IS DISTINCT FROM OLD.date_received
       OR NEW.rsqdf_jo IS DISTINCT FROM OLD.rsqdf_jo
       OR NEW.rsqdf IS DISTINCT FROM OLD.rsqdf
       OR NEW.customer IS DISTINCT FROM OLD.customer
       OR NEW.model_name IS DISTINCT FROM OLD.model_name
       OR NEW.technician_in_charge IS DISTINCT FROM OLD.technician_in_charge
       OR NEW.qty_commitment IS DISTINCT FROM OLD.qty_commitment
       OR NEW.delivery_schedule IS DISTINCT FROM OLD.delivery_schedule
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'CNC role may only update date_finished and remarks';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cnc_restrict_columns ON public.cnc;
CREATE TRIGGER trg_cnc_restrict_columns
  BEFORE UPDATE ON public.cnc
  FOR EACH ROW EXECUTE FUNCTION public.restrict_cnc_role_updates();

-- Immutable Audit Log Trigger
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_record_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_changed text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(array_agg(k), ARRAY[]::text[])
    INTO v_changed
    FROM (
      SELECT key AS k
      FROM jsonb_each(v_new)
      WHERE v_new -> key IS DISTINCT FROM v_old -> key
        AND key NOT IN ('updated_at', 'updated_by')
    ) diff;
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, actor_id, actor_role, old_data, new_data, changed_fields
  )
  VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    auth.uid(),
    public.current_app_role(),
    v_old,
    v_new,
    v_changed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach updated_at, actor stamp, and audit triggers idempotently
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'technicians', 'profiles', 'role_change_requests',
    'samples', 'quotations', 'approvals', 'apqp', 'apqp_tooling_commitments',
    'trf_logs', 'tooling', 'cnc', 'md_monthly', 'official_business'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();', t, t);
  END LOOP;

  DROP TRIGGER IF EXISTS trg_attachments_audit ON public.attachments;
  CREATE TRIGGER trg_attachments_audit AFTER INSERT OR UPDATE OR DELETE ON public.attachments FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

  FOREACH t IN ARRAY ARRAY[
    'samples', 'quotations', 'approvals', 'apqp', 'apqp_tooling_commitments',
    'trf_logs', 'tooling', 'cnc', 'md_monthly', 'official_business'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_actor ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_actor BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_actor_audit_fields();', t, t);
  END LOOP;
END;
$$;

-- Initialize all 5 APQP tooling commitment sub-items on every new APQP row
CREATE OR REPLACE FUNCTION public.init_apqp_tooling_commitments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.apqp_tooling_commitments (apqp_id, tooling_type, needed)
  SELECT NEW.id, unnest(enum_range(NULL::public.tooling_category)), false
  ON CONFLICT (apqp_id, tooling_type) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apqp_init_tooling_commitments ON public.apqp;
CREATE TRIGGER trg_apqp_init_tooling_commitments
  AFTER INSERT ON public.apqp
  FOR EACH ROW EXECUTE FUNCTION public.init_apqp_tooling_commitments();

-- -----------------------------------------------------------------------------
-- 7. MD MONTHLY SUMMARY VIEW & TRANSACTIONAL RPCS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.md_monthly_summary
WITH (security_invoker = true) AS
WITH apqp_counts AS (
  SELECT
    to_char(COALESCE(first_run_done_date, updated_at::date), 'YYYY-MM') AS month_key,
    count(*) FILTER (WHERE status = 'First Run Done') AS retrieval_cnt,
    0::bigint AS final_md_cnt,
    0::bigint AS ddcc_cnt
  FROM public.apqp
  WHERE deleted_at IS NULL AND status = 'First Run Done'
  GROUP BY 1

  UNION ALL

  SELECT
    to_char(COALESCE(forwarded_to_md_date, frrd_returned_date, updated_at::date), 'YYYY-MM') AS month_key,
    0::bigint AS retrieval_cnt,
    count(*) FILTER (WHERE status IN ('FRRD Returned', 'Forwarded to MD')) AS final_md_cnt,
    0::bigint AS ddcc_cnt
  FROM public.apqp
  WHERE deleted_at IS NULL AND status IN ('FRRD Returned', 'Forwarded to MD')
  GROUP BY 1

  UNION ALL

  SELECT
    to_char(COALESCE(forwarded_to_ddcc_date, updated_at::date), 'YYYY-MM') AS month_key,
    0::bigint AS retrieval_cnt,
    0::bigint AS final_md_cnt,
    count(*) FILTER (WHERE status = 'Forwarded to DDCC') AS ddcc_cnt
  FROM public.apqp
  WHERE deleted_at IS NULL AND status = 'Forwarded to DDCC'
  GROUP BY 1
),
merged_auto AS (
  SELECT
    month_key,
    sum(retrieval_cnt)::integer AS auto_for_retrieval,
    sum(final_md_cnt)::integer AS auto_for_final_md,
    sum(ddcc_cnt)::integer AS auto_forwarded_to_ddcc
  FROM apqp_counts
  GROUP BY month_key
),
all_months AS (
  SELECT month_key FROM merged_auto
  UNION
  SELECT month_key FROM public.md_monthly WHERE deleted_at IS NULL
)
SELECT
  m.id,
  am.month_key,
  COALESCE(ma.auto_for_retrieval, 0) AS auto_for_retrieval,
  COALESCE(ma.auto_for_final_md, 0) AS auto_for_final_md,
  COALESCE(ma.auto_forwarded_to_ddcc, 0) AS auto_forwarded_to_ddcc,
  m.for_retrieval_override,
  m.for_final_md_override,
  m.forwarded_to_ddcc_override,
  COALESCE(m.for_retrieval_override, ma.auto_for_retrieval, 0) AS for_retrieval,
  COALESCE(m.for_final_md_override, ma.auto_for_final_md, 0) AS for_final_md,
  COALESCE(m.forwarded_to_ddcc_override, ma.auto_forwarded_to_ddcc, 0) AS forwarded_to_ddcc,
  (
    COALESCE(m.for_retrieval_override, ma.auto_for_retrieval, 0)
    + COALESCE(m.for_final_md_override, ma.auto_for_final_md, 0)
    + COALESCE(m.forwarded_to_ddcc_override, ma.auto_forwarded_to_ddcc, 0)
  ) AS total,
  COALESCE(m.with_special_case, 0) AS with_special_case,
  m.remarks,
  m.updated_at
FROM all_months am
LEFT JOIN merged_auto ma ON ma.month_key = am.month_key
LEFT JOIN public.md_monthly m ON m.month_key = am.month_key AND m.deleted_at IS NULL
ORDER BY am.month_key DESC;

CREATE OR REPLACE FUNCTION public.get_md_monthly_summary(p_month_key text DEFAULT NULL)
RETURNS SETOF public.md_monthly_summary
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT * FROM public.md_monthly_summary
  WHERE p_month_key IS NULL OR month_key = p_month_key;
$$;

CREATE OR REPLACE FUNCTION public.promote_stage(
  p_from_stage text,
  p_record_id uuid,
  p_to_stage text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role := public.current_app_role();
  v_new_id uuid;
  v_created_ids uuid[] := ARRAY[]::uuid[];
  v_rsqdf text;
  v_customer text;
  v_model_name text;
  v_tech uuid;
  v_po text;
  v_signed_date date;
  v_tc RECORD;
BEGIN
  IF v_role NOT IN ('ADMIN', 'TECHNICAL') THEN
    RAISE EXCEPTION 'Permission denied: only ADMIN or TECHNICAL may promote stages';
  END IF;

  IF p_from_stage = 'quotations' THEN
    SELECT rsqdf, customer, model_name, technician_in_charge, reference_number
    INTO v_rsqdf, v_customer, v_model_name, v_tech, v_po
    FROM public.quotations WHERE id = p_record_id AND deleted_at IS NULL;
  ELSIF p_from_stage = 'samples' THEN
    SELECT rsqdf, customer, model_name, technician_in_charge, reference_number
    INTO v_rsqdf, v_customer, v_model_name, v_tech, v_po
    FROM public.samples WHERE id = p_record_id AND deleted_at IS NULL;
  ELSIF p_from_stage = 'approvals' THEN
    SELECT rsqdf, customer, model_name, technician_in_charge, po_number, date_received_signed_approval
    INTO v_rsqdf, v_customer, v_model_name, v_tech, v_po, v_signed_date
    FROM public.approvals WHERE id = p_record_id AND deleted_at IS NULL;
  ELSIF p_from_stage = 'apqp' THEN
    SELECT rsqdf, customer, model_name, technician_in_charge, po_reference
    INTO v_rsqdf, v_customer, v_model_name, v_tech, v_po
    FROM public.apqp WHERE id = p_record_id AND deleted_at IS NULL;
  ELSE
    RAISE EXCEPTION 'Unsupported source stage: %', p_from_stage;
  END IF;

  IF v_rsqdf IS NULL THEN
    RAISE EXCEPTION 'Source record % in % not found', p_record_id, p_from_stage;
  END IF;

  IF p_to_stage = 'samples' THEN
    INSERT INTO public.samples (
      rsqdf, customer, model_name, record_type, reference_number,
      technician_in_charge, date_requested, date_commitment, remarks
    ) VALUES (
      v_rsqdf, v_customer, v_model_name,
      COALESCE(NULLIF(trim(p_payload->>'record_type'), '')::public.sample_record_type, 'Sample'),
      COALESCE(NULLIF(trim(p_payload->>'reference_number'), ''), v_po),
      COALESCE(NULLIF(trim(p_payload->>'technician_in_charge'), '')::uuid, v_tech),
      COALESCE(NULLIF(trim(p_payload->>'date_requested'), '')::date, current_date),
      NULLIF(trim(p_payload->>'date_commitment'), '')::date,
      NULLIF(trim(p_payload->>'remarks'), '')
    ) RETURNING id INTO v_new_id;
    v_created_ids := array_append(v_created_ids, v_new_id);

  ELSIF p_to_stage = 'approvals' THEN
    INSERT INTO public.approvals (
      po_mode, rsqdf, po_number, customer, model_name,
      technician_in_charge, po_received_date, date_commitment, remarks
    ) VALUES (
      COALESCE(NULLIF(trim(p_payload->>'po_mode'), '')::public.approval_po_mode, 'With P.O.'),
      v_rsqdf,
      COALESCE(NULLIF(trim(p_payload->>'po_number'), ''), v_po),
      v_customer, v_model_name,
      COALESCE(NULLIF(trim(p_payload->>'technician_in_charge'), '')::uuid, v_tech),
      COALESCE(NULLIF(trim(p_payload->>'po_received_date'), '')::date, current_date),
      NULLIF(trim(p_payload->>'date_commitment'), '')::date,
      NULLIF(trim(p_payload->>'remarks'), '')
    ) RETURNING id INTO v_new_id;
    v_created_ids := array_append(v_created_ids, v_new_id);

  ELSIF p_to_stage = 'apqp' THEN
    INSERT INTO public.apqp (
      approval_id, date_received_signed_approval, po_reference,
      rsqdf, customer, model_name, technician_in_charge, date_commitment, remarks
    ) VALUES (
      CASE WHEN p_from_stage = 'approvals' THEN p_record_id ELSE NULL END,
      COALESCE(NULLIF(trim(p_payload->>'date_received_signed_approval'), '')::date, v_signed_date),
      COALESCE(NULLIF(trim(p_payload->>'po_reference'), ''), v_po),
      v_rsqdf, v_customer, v_model_name,
      COALESCE(NULLIF(trim(p_payload->>'technician_in_charge'), '')::uuid, v_tech),
      NULLIF(trim(p_payload->>'date_commitment'), '')::date,
      NULLIF(trim(p_payload->>'remarks'), '')
    ) RETURNING id INTO v_new_id;
    INSERT INTO public.apqp_tooling_commitments (apqp_id, tooling_type, needed)
    SELECT v_new_id, unnest(enum_range(NULL::public.tooling_category)), false
    ON CONFLICT (apqp_id, tooling_type) DO NOTHING;
    v_created_ids := array_append(v_created_ids, v_new_id);

  ELSIF p_to_stage = 'tooling_and_cnc' AND p_from_stage = 'apqp' THEN
    FOR v_tc IN
      SELECT tooling_type, commitment_date, remarks
      FROM public.apqp_tooling_commitments
      WHERE apqp_id = p_record_id AND needed = true
    LOOP
      INSERT INTO public.tooling (
        source_type, apqp_id, date_received, rsqdf, customer, model_name,
        technician_in_charge, tooling_type, execution_mode, commitment_date, remarks
      ) VALUES (
        'First Run', p_record_id, current_date, v_rsqdf, v_customer, v_model_name,
        v_tech, v_tc.tooling_type,
        COALESCE(NULLIF(trim(p_payload->>'execution_mode'), '')::public.tooling_execution_mode, 'In House'),
        v_tc.commitment_date,
        v_tc.remarks
      ) RETURNING id INTO v_new_id;
      v_created_ids := array_append(v_created_ids, v_new_id);
    END LOOP;

    IF COALESCE((p_payload->>'include_cnc')::boolean, false) THEN
      INSERT INTO public.cnc (
        apqp_id, date_received, rsqdf_jo, rsqdf, customer, model_name,
        technician_in_charge, qty_commitment, delivery_schedule, remarks
      ) VALUES (
        p_record_id, current_date,
        COALESCE(NULLIF(trim(p_payload->>'rsqdf_jo'), ''), v_rsqdf),
        v_rsqdf, v_customer, v_model_name, v_tech,
        NULLIF(trim(p_payload->>'qty_commitment'), '')::integer,
        NULLIF(trim(p_payload->>'delivery_schedule'), '')::date,
        NULLIF(trim(p_payload->>'cnc_remarks'), '')
      ) RETURNING id INTO v_new_id;
      v_created_ids := array_append(v_created_ids, v_new_id);
    END IF;

    IF COALESCE(array_length(v_created_ids, 1), 0) = 0 THEN
      RAISE EXCEPTION 'Select at least one needed Tooling Commitment on this APQP record or enable CNC before promoting.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid stage promotion from % to %', p_from_stage, p_to_stage;
  END IF;

  RETURN jsonb_build_object('created_ids', v_created_ids, 'count', COALESCE(array_length(v_created_ids, 1), 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_trf_with_links(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role := public.current_app_role();
  v_trf_id uuid;
  v_tooling_id uuid;
  v_requires_tooling boolean := COALESCE((p_payload->>'requires_tooling')::boolean, false);
BEGIN
  IF v_role NOT IN ('ADMIN', 'TECHNICAL') THEN
    RAISE EXCEPTION 'Permission denied: only ADMIN or TECHNICAL can file TRF logs';
  END IF;

  INSERT INTO public.trf_logs (
    trf_number, rsqdf, customer, model_name, technician_in_charge,
    date_filed, reason_for_revision, requires_tooling, tooling_type,
    requires_md_revision, status, date_completed, remarks
  ) VALUES (
    p_payload->>'trf_number',
    p_payload->>'rsqdf',
    p_payload->>'customer',
    p_payload->>'model_name',
    NULLIF(trim(p_payload->>'technician_in_charge'), '')::uuid,
    COALESCE(NULLIF(trim(p_payload->>'date_filed'), '')::date, current_date),
    p_payload->>'reason_for_revision',
    v_requires_tooling,
    NULLIF(trim(p_payload->>'tooling_type'), '')::public.tooling_category,
    COALESCE((p_payload->>'requires_md_revision')::boolean, true),
    COALESCE(NULLIF(trim(p_payload->>'status'), '')::public.trf_status, 'Filed'),
    NULLIF(trim(p_payload->>'date_completed'), '')::date,
    NULLIF(trim(p_payload->>'remarks'), '')
  ) RETURNING id INTO v_trf_id;

  IF v_requires_tooling AND NULLIF(trim(p_payload->>'tooling_type'), '') IS NOT NULL THEN
    INSERT INTO public.tooling (
      source_type, trf_id, trf_reference, date_received,
      rsqdf, customer, model_name, technician_in_charge,
      tooling_type, execution_mode, commitment_date, remarks
    ) VALUES (
      'TRF', v_trf_id, p_payload->>'trf_number',
      COALESCE(NULLIF(trim(p_payload->>'date_filed'), '')::date, current_date),
      p_payload->>'rsqdf', p_payload->>'customer', p_payload->>'model_name',
      NULLIF(trim(p_payload->>'technician_in_charge'), '')::uuid,
      NULLIF(trim(p_payload->>'tooling_type'), '')::public.tooling_category,
      COALESCE(NULLIF(trim(p_payload->>'execution_mode'), '')::public.tooling_execution_mode, 'In House'),
      NULLIF(trim(p_payload->>'tooling_commitment_date'), '')::date,
      p_payload->>'reason_for_revision'
    ) RETURNING id INTO v_tooling_id;
  END IF;

  RETURN jsonb_build_object('trf_id', v_trf_id, 'tooling_id', v_tooling_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_role_change(
  p_request_id uuid,
  p_review_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only ADMIN can approve role changes';
  END IF;

  SELECT * INTO v_req
  FROM public.role_change_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending role change request % not found', p_request_id;
  END IF;

  UPDATE public.profiles
  SET role = v_req.requested_role
  WHERE id = v_req.user_id;

  UPDATE public.role_change_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_role_change(
  p_request_id uuid,
  p_review_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only ADMIN can reject role changes';
  END IF;

  UPDATE public.role_change_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending role change request % not found', p_request_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id uuid,
  p_new_role public.app_role,
  p_linked_technician_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only ADMIN can assign roles';
  END IF;

  UPDATE public.profiles
  SET role = p_new_role,
      linked_technician_id = p_linked_technician_id
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_record(
  p_table_name text,
  p_record_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_app_role() NOT IN ('ADMIN', 'TECHNICAL') THEN
    RAISE EXCEPTION 'Permission denied: only ADMIN or TECHNICAL may delete records';
  END IF;

  IF p_table_name NOT IN (
    'samples', 'quotations', 'approvals', 'apqp',
    'trf_logs', 'tooling', 'cnc', 'md_monthly', 'official_business'
  ) THEN
    RAISE EXCEPTION 'Invalid table for soft delete: %', p_table_name;
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET deleted_at = now(), updated_by = $1 WHERE id = $2 AND deleted_at IS NULL',
    p_table_name
  ) USING auth.uid(), p_record_id;
END;
$$;

GRANT SELECT ON public.md_monthly_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_md_monthly_summary(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_stage(text, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trf_with_links(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_role_change(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_role_change(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, uuid) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. SUPABASE REALTIME PUBLICATION
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'technicians',
    'samples',
    'quotations',
    'approvals',
    'apqp',
    'apqp_tooling_commitments',
    'trf_logs',
    'tooling',
    'cnc',
    'md_monthly',
    'official_business',
    'attachments',
    'role_change_requests'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. SEED DATA (12 Technical In Charge Engineers + Initial Sample Workload)
-- -----------------------------------------------------------------------------
INSERT INTO public.technicians (id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Clark'),
  ('10000000-0000-0000-0000-000000000002', 'TJ'),
  ('10000000-0000-0000-0000-000000000003', 'Titus'),
  ('10000000-0000-0000-0000-000000000004', 'Jai'),
  ('10000000-0000-0000-0000-000000000005', 'Shai'),
  ('10000000-0000-0000-0000-000000000006', 'Mei'),
  ('10000000-0000-0000-0000-000000000007', 'Daisy'),
  ('10000000-0000-0000-0000-000000000008', 'Lenard'),
  ('10000000-0000-0000-0000-000000000009', 'Aldrian'),
  ('10000000-0000-0000-0000-000000000010', 'Jhun'),
  ('10000000-0000-0000-0000-000000000011', 'Facs'),
  ('10000000-0000-0000-0000-000000000012', 'Mhel')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.quotations (id, rsqdf, customer, model_name, record_type, reference_number, technician_in_charge, date_requested, date_commitment, date_finished, remarks) VALUES
  ('20000000-0000-0000-0000-000000000001', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', 'Quotation', 'QT-26-0412', '10000000-0000-0000-0000-000000000001', '2026-11-04', '2026-11-10', '2026-11-09', 'BOM & die-cut nesting costed'),
  ('20000000-0000-0000-0000-000000000002', 'RSQDF-26-108', 'Epson Precision', 'EPS-L3210 Ink Pad Gasket', 'Sample', 'SMP-26-089', '10000000-0000-0000-0000-000000000002', '2026-11-10', '2026-11-15', NULL, 'Awaiting adhesive spec from supplier'),
  ('20000000-0000-0000-0000-000000000003', 'RSQDF-26-112', 'Brother Industries', 'BRT-HL2350 Foam Seal', 'Quotation', 'QT-26-0445', '10000000-0000-0000-0000-000000000005', '2026-11-14', '2026-11-20', NULL, 'In progress — material yield check'),
  ('20000000-0000-0000-0000-000000000004', 'RSQDF-26-115', 'Murata Manufacturing', 'MRT-HV Shield Spacer', 'Quotation', NULL, '10000000-0000-0000-0000-000000000008', '2026-11-16', '2026-11-24', NULL, 'Initial drawing review started')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.samples (id, rsqdf, customer, model_name, record_type, reference_number, technician_in_charge, date_requested, date_commitment, date_finished, remarks) VALUES
  ('30000000-0000-0000-0000-000000000001', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', 'Sample', 'SMP-26-072', '10000000-0000-0000-0000-000000000001', '2026-11-10', '2026-11-14', '2026-11-13', '10 pcs submitted to QA'),
  ('30000000-0000-0000-0000-000000000002', 'RSQDF-26-104', 'Canon Business Machines', 'CN-MF455 Thermal Pad', 'P.O.', 'PO-992104', '10000000-0000-0000-0000-000000000003', '2026-11-08', '2026-11-14', NULL, 'Delayed by silicone sheet arrival'),
  ('30000000-0000-0000-0000-000000000003', 'RSQDF-26-110', 'Yazaki-Torres', 'YZK-EV Harness Boot', 'Sample', 'SMP-26-094', '10000000-0000-0000-0000-000000000006', '2026-11-15', '2026-11-20', NULL, 'Prototype molding scheduled')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.approvals (id, po_mode, rsqdf, po_number, customer, model_name, technician_in_charge, po_received_date, date_commitment, date_sent_to_customer, date_received_signed_approval, remarks) VALUES
  ('40000000-0000-0000-0000-000000000001', 'With P.O.', 'RSQDF-26-101', 'PO-88412', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001', '2026-11-14', '2026-11-18', '2026-11-15', '2026-11-17', 'Customer QA signed rev A'),
  ('40000000-0000-0000-0000-000000000002', 'With P.O.', 'RSQDF-26-105', 'PO-88490', 'Fujitsu Ten', 'FJT-Display Bezel Tape', '10000000-0000-0000-0000-000000000004', '2026-11-07', '2026-11-13', '2026-11-09', NULL, 'Follow up sales for customer sign-off'),
  ('40000000-0000-0000-0000-000000000003', 'Without P.O.', 'RSQDF-26-109', NULL, 'Shimano Laguna', 'SHM-Cassette Spacer', '10000000-0000-0000-0000-000000000007', '2026-11-14', '2026-11-19', '2026-11-16', NULL, 'Early approval requested before P.O.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.apqp (
  id, approval_id, date_received_signed_approval, po_reference, rsqdf, customer, model_name,
  technician_in_charge, status, meeting_date, item_code_requested_date, item_code_received_date,
  item_code, frrd_released_date, forwarded_to_ppqc_date, first_run_done_date,
  frrd_returned_date, forwarded_to_md_date, forwarded_to_ddcc_date, date_commitment, remarks
) VALUES
  (
    '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2026-11-17', 'PO-88412',
    'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001',
    'FRRD Released', '2026-11-17', '2026-11-17', '2026-11-18', 'IC-48021', '2026-11-18',
    NULL, NULL, NULL, NULL, NULL, '2026-11-22', 'Ready to forward to PPQC'
  ),
  (
    '50000000-0000-0000-0000-000000000002', NULL, '2026-11-01', 'PO-87901',
    'RSQDF-26-092', 'Toshiba Storage', 'TSH-HDD Damper Film', '10000000-0000-0000-0000-000000000009',
    'First Run Done', '2026-11-02', '2026-11-03', '2026-11-04', 'IC-33910', '2026-11-05',
    '2026-11-06', '2026-11-12', NULL, NULL, NULL, '2026-11-16', 'FRRD awaiting retrieval from prod'
  ),
  (
    '50000000-0000-0000-0000-000000000003', NULL, '2026-10-25', 'PO-87550',
    'RSQDF-26-085', 'Denso Philippines', 'DNS-ECU Vent Membrane', '10000000-0000-0000-0000-000000000010',
    'Forwarded to MD', '2026-10-26', '2026-10-27', '2026-10-28', 'IC-21044', '2026-10-29',
    '2026-10-30', '2026-11-05', '2026-11-08', '2026-11-10', NULL, '2026-11-20', 'MD revising tolerance callout'
  ),
  (
    '50000000-0000-0000-0000-000000000004', NULL, '2026-10-20', 'PO-87300',
    'RSQDF-26-079', 'Panasonic Manufacturing', 'PNS-AC Control Overlay', '10000000-0000-0000-0000-000000000011',
    'Forwarded to DDCC', '2026-10-21', '2026-10-22', '2026-10-23', 'IC-19881', '2026-10-24',
    '2026-10-25', '2026-11-01', '2026-11-04', '2026-11-06', '2026-11-14', '2026-11-21', 'DDCC final stamp pending'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.apqp_tooling_commitments (apqp_id, tooling_type, needed, commitment_date, remarks) VALUES
  ('50000000-0000-0000-0000-000000000001', 'Die Cut', true, '2026-11-20', '2-cavity steel rule die'),
  ('50000000-0000-0000-0000-000000000001', 'Rubber', false, NULL, NULL),
  ('50000000-0000-0000-0000-000000000001', 'Silkscreen', false, NULL, NULL),
  ('50000000-0000-0000-0000-000000000001', 'Pattern', true, '2026-11-19', 'Inspection overlay'),
  ('50000000-0000-0000-0000-000000000001', 'Jig', true, '2026-11-21', 'Pin alignment jig')
ON CONFLICT (apqp_id, tooling_type) DO UPDATE
SET needed = EXCLUDED.needed,
    commitment_date = EXCLUDED.commitment_date,
    remarks = EXCLUDED.remarks;

INSERT INTO public.trf_logs (id, trf_number, rsqdf, customer, model_name, technician_in_charge, date_filed, reason_for_revision, requires_tooling, tooling_type, requires_md_revision, status, remarks) VALUES
  ('60000000-0000-0000-0000-000000000001', 'TRF-2026-031', 'RSQDF-26-085', 'Denso Philippines', 'DNS-ECU Vent Membrane', '10000000-0000-0000-0000-000000000010', '2026-11-09', 'Adjust outer flange ID +0.15mm per first-run fit check', true, 'Die Cut', true, 'In Tooling', 'Die rework + MD rev B'),
  ('60000000-0000-0000-0000-000000000002', 'TRF-2026-032', 'RSQDF-26-079', 'Panasonic Manufacturing', 'PNS-AC Control Overlay', '10000000-0000-0000-0000-000000000011', '2026-11-11', 'Update silkscreen Pantone callout on MD', false, NULL, true, 'In MD', 'Forwarded to MD for official change')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tooling (id, source_type, apqp_id, trf_id, trf_reference, date_received, rsqdf, customer, model_name, technician_in_charge, tooling_type, execution_mode, commitment_date, date_forwarded_to_ppqc, remarks) VALUES
  ('70000000-0000-0000-0000-000000000001', 'First Run', '50000000-0000-0000-0000-000000000001', NULL, NULL, '2026-11-18', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001', 'Die Cut', 'Job Out', '2026-11-20', NULL, 'PO sent to die maker'),
  ('70000000-0000-0000-0000-000000000002', 'TRF', NULL, '60000000-0000-0000-0000-000000000001', 'TRF-2026-031', '2026-11-09', 'RSQDF-26-085', 'Denso Philippines', 'DNS-ECU Vent Membrane', '10000000-0000-0000-0000-000000000010', 'Die Cut', 'In House', '2026-11-14', NULL, 'Overdue internal blade modification'),
  ('70000000-0000-0000-0000-000000000003', 'First Run', '50000000-0000-0000-0000-000000000004', NULL, NULL, '2026-10-24', 'RSQDF-26-079', 'Panasonic Manufacturing', 'PNS-AC Control Overlay', '10000000-0000-0000-0000-000000000011', 'Silkscreen', 'In House', '2026-10-28', '2026-10-27', 'Mesh 200 screen delivered to PPQC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cnc (id, apqp_id, date_received, rsqdf_jo, rsqdf, customer, model_name, technician_in_charge, qty_commitment, delivery_schedule, date_finished, remarks) VALUES
  ('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-11-18', 'RSQDF-26-101 / JO-411', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001', 2, '2026-11-20', NULL, 'Delrin alignment block milling'),
  ('80000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '2026-11-04', 'RSQDF-26-092 / JO-398', 'RSQDF-26-092', 'Toshiba Storage', 'TSH-HDD Damper Film', '10000000-0000-0000-0000-000000000009', 1, '2026-11-08', '2026-11-07', 'Aluminum fixture base finished')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.md_monthly (month_key, for_retrieval_override, for_final_md_override, forwarded_to_ddcc_override, with_special_case, remarks) VALUES
  ('2026-11', NULL, NULL, NULL, 1, 'Auto-computed from APQP; 1 special case tolerances on DNS-ECU')
ON CONFLICT (month_key) DO NOTHING;

INSERT INTO public.official_business (id, customer, ob_date, ob_time, technician_in_charge, sales_in_charge, purpose, remarks) VALUES
  ('90000000-0000-0000-0000-000000000001', 'Nidec Philippines', '2026-11-19', '09:30:00', '10000000-0000-0000-0000-000000000001', 'Ms. Carla Reyes', 'First run line trial & dimensional audit', 'Bring calipers & sample jig'),
  ('90000000-0000-0000-0000-000000000002', 'Canon Business Machines', '2026-11-21', '14:00:00', '10000000-0000-0000-0000-000000000003', 'Mr. Paolo Cruz', 'Thermal pad material qualification meeting', 'Design development'),
  ('90000000-0000-0000-0000-000000000003', 'Epson Precision', '2026-11-24', '10:00:00', '10000000-0000-0000-0000-000000000012', 'Ms. Ana Lim', 'Quotation technical clarification', 'Confirm adhesive peel spec')
ON CONFLICT (id) DO NOTHING;
