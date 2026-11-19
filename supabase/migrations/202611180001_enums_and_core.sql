-- Migration 0001: Enums, Technicians, Profiles, and Role Change Requests
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Domain Enums
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'TECHNICAL', 'VIEWER', 'TOOLING', 'CNC');
CREATE TYPE public.account_status AS ENUM ('active', 'inactive');
CREATE TYPE public.role_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE public.sample_record_type AS ENUM ('Sample', 'P.O.');
CREATE TYPE public.quotation_record_type AS ENUM ('Sample', 'Quotation');
CREATE TYPE public.approval_po_mode AS ENUM ('With P.O.', 'Without P.O.');

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

CREATE TYPE public.tooling_source_type AS ENUM ('First Run', 'TRF');
CREATE TYPE public.tooling_category AS ENUM ('Die Cut', 'Rubber', 'Silkscreen', 'Pattern', 'Jig');
CREATE TYPE public.tooling_execution_mode AS ENUM ('Job Out', 'In House');
CREATE TYPE public.trf_status AS ENUM ('Filed', 'In Tooling', 'In MD', 'Completed');

-- 2. Technicians (12 seeded engineers, editable by ADMIN)
CREATE TABLE public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Profiles (authoritative source for user role and status)
CREATE TABLE public.profiles (
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

CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_linked_tech ON public.profiles (linked_technician_id);

-- 4. Role Change Requests (maximum 1 pending request per user)
CREATE TABLE public.role_change_requests (
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

CREATE UNIQUE INDEX uq_role_change_requests_one_pending
  ON public.role_change_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX idx_role_change_requests_status ON public.role_change_requests (status, created_at DESC);

-- 5. Workspace Settings (controls Phase 1 open workspace vs Phase 2 strict per-user Auth)
CREATE TABLE public.workspace_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  require_auth boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.workspace_settings (id, require_auth)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;
