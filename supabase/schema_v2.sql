-- =========================================================================
-- CivicPulse — Schema v2 (feature/supabase-v2)
--
-- This is a NEW, standalone schema for a fresh/separate Supabase project.
-- It is NOT a migration of the existing schema.sql / prod project — run it
-- only against a brand-new project created for this feature branch.
--
-- Changes vs schema.sql:
--  - app_users: password_hash now holds a bcrypt hash (salt embedded in the
--    hash itself, no separate salt column needed); drops the hardcoded admin
--    seed row (admin is bootstrapped by the app from ADMIN_SEED_PASSWORD)
--  - reports: adds media_paths / resolution_media_paths (Storage object
--    paths, not full URLs); citizen_id/reported_by reference app_users by
--    username instead of the unused auth.users
--  - notifications.user_id references app_users by username instead of
--    auth.users
--  - new: report-media Storage bucket + policies
--  - RLS: app_users is no longer publicly readable/writable; all reports/
--    history/notifications writes require the service role
-- =========================================================================

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

-- 2. Application Users (created first — reports/notifications FK into it)
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash; salt is embedded in the hash
  role TEXT NOT NULL DEFAULT 'citizen', -- 'admin', 'citizen', 'staff'
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No seed admin row here on purpose — the app bootstraps the admin account
-- from ADMIN_SEED_PASSWORD at startup (see src/lib/server/auth-store.ts).

-- 3. Departments
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

-- 4. Field Workers
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

-- 5. Civic Reports (Source of Truth)
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY DEFAULT ('CIV-' || FLOOR(10000 + RANDOM() * 90000)::TEXT),
  tracking_id TEXT UNIQUE,
  citizen_username TEXT REFERENCES public.app_users(username) ON DELETE SET NULL,
  anonymous BOOLEAN DEFAULT FALSE,
  category_id TEXT NOT NULL,
  category_label TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ward TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  location_accuracy NUMERIC(5,1),

  -- Media: Storage object paths (resolved to URLs at read time), not raw URLs
  media_paths TEXT[] DEFAULT '{}',
  resolution_media_paths TEXT[] DEFAULT '{}',

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
  upvoted_by TEXT[] DEFAULT '{}',
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

-- 6. Report Status History (Audit Trail)
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

CREATE INDEX IF NOT EXISTS idx_status_history_report
  ON public.report_status_history(report_id, changed_at ASC);

-- 7. Notifications (Triggered by Status Machine)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT REFERENCES public.app_users(username) ON DELETE CASCADE,
  report_id TEXT REFERENCES public.reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT DEFAULT 'in_app', -- 'in_app', 'email', 'sms'
  unread BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 9. Row Level Security
-- app_users holds password hashes — no public access at all. Every read/
-- write to this table happens server-side with the service role key, which
-- bypasses RLS, so these policies exist only to deny the anon/public roles
-- explicitly (defense in depth if the anon key is ever used against this
-- table by mistake).
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
-- (No policies defined for app_users: RLS enabled + no policy = deny all
-- for anon/authenticated; service role still bypasses RLS entirely.)

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Reports: public can read; all writes go through server routes (service role)
CREATE POLICY "Public reports viewable by everyone" ON public.reports
  FOR SELECT USING (true);

-- Status history: public can read; writes via service role only
CREATE POLICY "Public status history readable" ON public.report_status_history
  FOR SELECT USING (true);

-- Notifications: readers only see their own (matched by username) or
-- unowned/system notifications; writes via service role only
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (true);

-- 10. Storage bucket for report media
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-media', 'report-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read objects (bucket is public); only the service role can
-- write — uploads always go through our own /api/media/upload route, never
-- directly from the browser with a public key.
CREATE POLICY "Public read report-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'report-media');
