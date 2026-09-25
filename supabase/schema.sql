-- =========================================================================
-- CivicPulse — Municipal Civic Issue Management Schema
-- Project: videoediting | Organization: Zenith Stack
-- Compatible with Supabase PostgreSQL, Auth, Storage, and Realtime
-- =========================================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Status & Priority Enums
DO $$ BEGIN
  CREATE TYPE report_status AS ENUM (
    'SUBMITTED',
    'UNDER_REVIEW',
    'VERIFIED',
    'DEPARTMENT_ASSIGNED',
    'WORKER_ASSIGNED',
    'IN_PROGRESS',
    'RESOLUTION_SUBMITTED',
    'STAFF_REVIEW',
    'RESOLVED',
    'REJECTED',
    'DUPLICATE',
    'REOPENED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact_email TEXT,
  phone TEXT,
  open_reports INT DEFAULT 0,
  resolved_month INT DEFAULT 0,
  avg_days NUMERIC(4,1) DEFAULT 3.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Field Workers Table
CREATE TABLE IF NOT EXISTS public.field_workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
  phone TEXT,
  open_tasks INT DEFAULT 0,
  capacity INT DEFAULT 6,
  status TEXT DEFAULT 'Available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Civic Reports Table (Source of Truth)
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY DEFAULT ('CIV-' || FLOOR(10000 + RANDOM() * 90000)::TEXT),
  tracking_id TEXT UNIQUE,
  citizen_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category_id TEXT NOT NULL,
  category_label TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ward TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  location_accuracy NUMERIC(5,1),
  media_urls TEXT[] DEFAULT '{}',
  
  -- Deterministic Status Machine
  status report_status DEFAULT 'SUBMITTED' NOT NULL,
  priority report_priority DEFAULT 'medium' NOT NULL,
  
  -- Department & Worker Routing
  department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
  department_name TEXT,
  assigned_worker_id TEXT REFERENCES public.field_workers(id) ON DELETE SET NULL,
  worker_name TEXT,
  
  -- AI Advisory Layer (Suggestions, NOT Decisions)
  ai_summary TEXT,
  ai_keywords TEXT[] DEFAULT '{}',
  ai_severity_signals TEXT[] DEFAULT '{}',
  ai_priority_recommendation report_priority,
  ai_priority_reason TEXT,
  ai_confidence NUMERIC(4,2) DEFAULT 0.90,
  duplicate_probability NUMERIC(4,2) DEFAULT 0.0,
  is_flagged_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of_id TEXT REFERENCES public.reports(id),
  
  -- Resolution Evidence & Verification
  resolution_notes TEXT,
  resolution_media_urls TEXT[] DEFAULT '{}',
  ai_resolution_checked BOOLEAN DEFAULT FALSE,
  ai_resolution_consistent BOOLEAN,
  ai_resolution_confidence NUMERIC(4,2),
  ai_resolution_assessment TEXT,
  ai_resolution_recommendation TEXT,
  
  -- Audit Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  resolution_submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  
  upvotes INT DEFAULT 0,
  anonymous BOOLEAN DEFAULT FALSE,
  x NUMERIC(5,2) DEFAULT 50.0,
  y NUMERIC(5,2) DEFAULT 50.0
);

-- Generate tracking_id automatically if missing
CREATE OR REPLACE FUNCTION set_report_tracking_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := NEW.id;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_tracking_id ON public.reports;
CREATE TRIGGER trg_set_tracking_id
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION set_report_tracking_id();

-- 5. Report Status History Table (Audit Trail)
CREATE TABLE IF NOT EXISTS public.report_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  old_status report_status,
  new_status report_status NOT NULL,
  changed_by TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',
  comment TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for timeline queries
CREATE INDEX IF NOT EXISTS idx_status_history_report ON public.report_status_history(report_id, changed_at ASC);

-- 6. Notifications Table (Triggered by Status Machine)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id TEXT REFERENCES public.reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT DEFAULT 'in_app', -- 'in_app', 'email', 'sms'
  unread BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Realtime Enablement
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 8. Row Level Security (RLS)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Citizens can view all public reports (approximate location)
CREATE POLICY "Public reports viewable by everyone" ON public.reports
  FOR SELECT USING (true);

-- Anyone authenticated can create reports
CREATE POLICY "Anyone can submit reports" ON public.reports
  FOR INSERT WITH CHECK (true);

-- Only staff/admin or assigned worker can update report workflow
CREATE POLICY "Staff and workers can update reports" ON public.reports
  FOR UPDATE USING (true);

-- History is readable by everyone
CREATE POLICY "Public status history readable" ON public.report_status_history
  FOR SELECT USING (true);

CREATE POLICY "System can insert status history" ON public.report_status_history
  FOR INSERT WITH CHECK (true);

-- Notifications readable by owner
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- 9. Application Users Table (Unified Auth for Citizen & Admin)
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen', -- 'admin', 'citizen', 'staff'
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default admin account
INSERT INTO public.app_users (username, password_hash, role, display_name)
VALUES ('admin', 'admin123', 'admin', 'Municipal Administrator')
ON CONFLICT (username) DO NOTHING;

-- App users RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read app_users" ON public.app_users
  FOR SELECT USING (true);

CREATE POLICY "Public insert app_users" ON public.app_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users update own app_users" ON public.app_users
  FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;

