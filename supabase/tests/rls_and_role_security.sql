-- SQL Security & RLS Verification Script
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_role_security.sql
-- Executes inside a rolled-back transaction so test fixtures leave no trace.

BEGIN;

-- Create temporary test users in auth.users (triggers handle_new_user)
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'tech@test.local', '{"requested_role":"TECHNICAL","full_name":"Test Tech"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'viewer@test.local', '{"requested_role":"VIEWER","full_name":"Test Viewer"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'tooling@test.local', '{"requested_role":"TOOLING","full_name":"Test Tooling"}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'cnc@test.local', '{"requested_role":"CNC","full_name":"Test CNC"}');

-- Test 1: TECHNICAL user CANNOT change their own role
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', true);

DO $$
BEGIN
  UPDATE public.profiles SET role = 'ADMIN' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  RAISE EXCEPTION 'TEST FAILED: TECHNICAL user was allowed to elevate own role!';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%only ADMIN%' THEN
      RAISE;
    END IF;
END;
$$;

-- Test 2: VIEWER user CANNOT write to stage tables
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', true);

DO $$
BEGIN
  INSERT INTO public.quotations (rsqdf, customer, model_name) VALUES ('RSQDF-TEST', 'Cust', 'Model');
  RAISE EXCEPTION 'TEST FAILED: VIEWER user was allowed to insert into quotations!';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END;
$$;

-- Test 3: TOOLING user CANNOT insert/update quotations
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', true);

DO $$
BEGIN
  INSERT INTO public.quotations (rsqdf, customer, model_name) VALUES ('RSQDF-TEST', 'Cust', 'Model');
  RAISE EXCEPTION 'TEST FAILED: TOOLING user was allowed to touch quotations!';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END;
$$;

-- Test 4: TOOLING user CANNOT modify non-status columns on tooling
DO $$
BEGIN
  UPDATE public.tooling
  SET customer = 'Hacked Customer'
  WHERE id = '70000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST FAILED: TOOLING user modified restricted tooling column!';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%TOOLING role may only update%' THEN
      RAISE;
    END IF;
END;
$$;

-- Test 5: TOOLING user CAN update date_forwarded_to_ppqc & execution_mode
UPDATE public.tooling
SET date_forwarded_to_ppqc = '2026-11-19', execution_mode = 'In House'
WHERE id = '70000000-0000-0000-0000-000000000001';

-- Test 6: CNC user CANNOT modify non-status columns on cnc
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', true);

DO $$
BEGIN
  UPDATE public.cnc
  SET qty_commitment = 999
  WHERE id = '80000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST FAILED: CNC user modified restricted cnc column!';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CNC role may only update%' THEN
      RAISE;
    END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
