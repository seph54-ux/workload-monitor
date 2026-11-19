-- Migration 0003: Security Definer Role Helpers, RLS Policies, Grants, and Storage Policies

CREATE OR REPLACE FUNCTION public.is_auth_required()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT require_auth FROM public.workspace_settings WHERE id = true), true);
$$;

-- Helper functions (NOTE: current_app_role avoids PostgreSQL's reserved CURRENT_ROLE keyword)
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

-- Enable RLS on every table
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

-- WORKSPACE SETTINGS
CREATE POLICY workspace_settings_select ON public.workspace_settings
  FOR SELECT USING (true);
CREATE POLICY workspace_settings_update_admin ON public.workspace_settings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TECHNICIANS
CREATE POLICY technicians_select_active ON public.technicians
  FOR SELECT USING (public.is_active_user());
CREATE POLICY technicians_admin_all ON public.technicians
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PROFILES
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_admin_insert_delete ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ROLE CHANGE REQUESTS
CREATE POLICY role_requests_select_own_or_admin ON public.role_change_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY role_requests_insert_own ON public.role_change_requests
  FOR INSERT WITH CHECK (
    public.is_active_user()
    AND user_id = auth.uid()
    AND status = 'pending'
    AND existing_role = public.current_app_role()
    AND requested_role <> public.current_app_role()
  );
CREATE POLICY role_requests_admin_update ON public.role_change_requests
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- GENERAL TECHNICAL STAGE TABLES (samples, quotations, approvals, apqp, apqp_tooling_commitments, trf_logs, md_monthly, official_business)
CREATE POLICY samples_select ON public.samples
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY samples_insert ON public.samples
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY samples_update ON public.samples
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY samples_delete_admin ON public.samples
  FOR DELETE USING (public.is_admin());

CREATE POLICY quotations_select ON public.quotations
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY quotations_insert ON public.quotations
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY quotations_update ON public.quotations
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY quotations_delete_admin ON public.quotations
  FOR DELETE USING (public.is_admin());

CREATE POLICY approvals_select ON public.approvals
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY approvals_insert ON public.approvals
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY approvals_update ON public.approvals
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY approvals_delete_admin ON public.approvals
  FOR DELETE USING (public.is_admin());

CREATE POLICY apqp_select ON public.apqp
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY apqp_insert ON public.apqp
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY apqp_update ON public.apqp
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY apqp_delete_admin ON public.apqp
  FOR DELETE USING (public.is_admin());

CREATE POLICY apqp_tc_select ON public.apqp_tooling_commitments
  FOR SELECT USING (public.is_active_user());
CREATE POLICY apqp_tc_write ON public.apqp_tooling_commitments
  FOR ALL USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));

CREATE POLICY trf_logs_select ON public.trf_logs
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY trf_logs_insert ON public.trf_logs
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY trf_logs_update ON public.trf_logs
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY trf_logs_delete_admin ON public.trf_logs
  FOR DELETE USING (public.is_admin());

CREATE POLICY md_monthly_select ON public.md_monthly
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY md_monthly_insert ON public.md_monthly
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY md_monthly_update ON public.md_monthly
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY md_monthly_delete_admin ON public.md_monthly
  FOR DELETE USING (public.is_admin());

CREATE POLICY ob_select ON public.official_business
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY ob_insert ON public.official_business
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY ob_update ON public.official_business
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY ob_delete_admin ON public.official_business
  FOR DELETE USING (public.is_admin());

-- TOOLING (TOOLING role can update completion/forwarding fields via trigger guard)
CREATE POLICY tooling_select ON public.tooling
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY tooling_insert ON public.tooling
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY tooling_update ON public.tooling
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING'));
CREATE POLICY tooling_delete_admin ON public.tooling
  FOR DELETE USING (public.is_admin());

-- CNC (CNC role can update completion fields via trigger guard)
CREATE POLICY cnc_select ON public.cnc
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY cnc_insert ON public.cnc
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL'));
CREATE POLICY cnc_update ON public.cnc
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'CNC'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'CNC'));
CREATE POLICY cnc_delete_admin ON public.cnc
  FOR DELETE USING (public.is_admin());

-- AUDIT LOGS (ADMIN read-only; no client writes)
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- ATTACHMENTS
CREATE POLICY attachments_select ON public.attachments
  FOR SELECT USING (public.is_active_user() AND (deleted_at IS NULL OR public.is_admin()));
CREATE POLICY attachments_insert ON public.attachments
  FOR INSERT WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC'));
CREATE POLICY attachments_update ON public.attachments
  FOR UPDATE USING (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC'))
  WITH CHECK (public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC'));
CREATE POLICY attachments_delete_admin ON public.attachments
  FOR DELETE USING (public.is_admin());

-- PRIVATE STORAGE BUCKET (Phase 2)
INSERT INTO storage.buckets (id, name, public)
VALUES ('engineering-docs', 'engineering-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_eng_docs_select ON storage.objects
  FOR SELECT USING (bucket_id = 'engineering-docs' AND public.is_active_user());
CREATE POLICY storage_eng_docs_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  );
CREATE POLICY storage_eng_docs_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  )
  WITH CHECK (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  );
CREATE POLICY storage_eng_docs_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'engineering-docs'
    AND public.current_app_role() IN ('ADMIN', 'TECHNICAL', 'TOOLING', 'CNC')
  );

-- EXPLICIT POSTGREST GRANTS
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
