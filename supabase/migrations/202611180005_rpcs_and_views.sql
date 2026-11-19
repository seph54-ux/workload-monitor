-- Migration 0005: MD Summary View, Transactional RPC Functions, and Realtime Publication

-- 1. MD Monthly Summary View (auto-computed from APQP status dates + manual overrides)
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

-- 2. Transactional Stage Promotion RPC
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

  -- Load source stage fields
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

  -- Promote to target stage
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
    -- Initialize all 5 tooling commitment sub-items
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

-- 3. Create TRF Log + optional linked Tooling job in one transaction
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

-- 4. Admin Role Change Request RPCs
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

-- 5. Soft Delete RPC (never hard delete from client)
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

-- 6. Enable Supabase Realtime on operational tables (idempotent)
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

-- 7. Grants for View & RPC Functions
GRANT SELECT ON public.md_monthly_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_md_monthly_summary(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_stage(text, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trf_with_links(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_role_change(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_role_change(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, uuid) TO anon, authenticated;
