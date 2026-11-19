-- Migration 0004: Updated-At, Actor Stamp, Role-Lock, Column Guards, and Audit Log Triggers

-- 1. Standard updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 2. Stamp created_by / updated_by automatically from auth.uid()
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

-- 3. Auto-create locked profile on auth.users sign-up
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
  -- Public sign-up may choose TECHNICAL, VIEWER, TOOLING, or CNC; ADMIN must be granted by ADMIN
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

-- 4. Role Lock Enforcement Trigger on profiles
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

CREATE TRIGGER trg_profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_fields();

-- 5. Column-restricting trigger for TOOLING role
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

CREATE TRIGGER trg_tooling_restrict_columns
  BEFORE UPDATE ON public.tooling
  FOR EACH ROW EXECUTE FUNCTION public.restrict_tooling_role_updates();

-- 6. Column-restricting trigger for CNC role
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

CREATE TRIGGER trg_cnc_restrict_columns
  BEFORE UPDATE ON public.cnc
  FOR EACH ROW EXECUTE FUNCTION public.restrict_cnc_role_updates();

-- 7. Immutable Database-Level Audit Log Trigger
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
  v_key text;
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

-- Attach updated_at, actor stamp, and audit triggers to tables
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
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();', t, t);
  END LOOP;

  EXECUTE 'CREATE TRIGGER trg_attachments_audit AFTER INSERT OR UPDATE OR DELETE ON public.attachments FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();';

  FOREACH t IN ARRAY ARRAY[
    'samples', 'quotations', 'approvals', 'apqp', 'apqp_tooling_commitments',
    'trf_logs', 'tooling', 'cnc', 'md_monthly', 'official_business'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_actor BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_actor_audit_fields();', t, t);
  END LOOP;
END;
$$;

-- 8. Ensure every new APQP row initializes all 5 tooling commitment sub-items
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

CREATE TRIGGER trg_apqp_init_tooling_commitments
  AFTER INSERT ON public.apqp
  FOR EACH ROW EXECUTE FUNCTION public.init_apqp_tooling_commitments();
