-- =========================================================================
-- CivicPulse — Migration 001: Resolution Verification Tables
-- =========================================================================

-- 1. Verification Outcome Enum
DO $$ BEGIN
  CREATE TYPE verification_outcome AS ENUM (
    'PENDING',
    'PROCESSING',
    'VERIFIED',
    'NEEDS_REVIEW',
    'INSUFFICIENT_EVIDENCE',
    'FAILED',
    'UNAVAILABLE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Resolution Verifications Table
CREATE TABLE IF NOT EXISTS public.resolution_verifications (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  resolution_submission_id TEXT,
  original_image_reference TEXT NOT NULL,
  resolution_image_reference TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  verification_status verification_outcome DEFAULT 'PENDING',
  
  -- Computer Vision Scores
  scene_consistency_score NUMERIC(5,4),
  siamese_similarity_score NUMERIC(5,4),
  bidirectional_score NUMERIC(5,4),
  segmentation_score NUMERIC(5,4),
  quality_score NUMERIC(5,4),
  final_verification_score NUMERIC(5,4),
  
  -- Explanations & Evidence Details
  evidence_explanation TEXT,
  flags TEXT[] DEFAULT '{}',
  segmentation_ran BOOLEAN DEFAULT FALSE,
  is_suspected_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_hash_distance INT,
  model_version TEXT DEFAULT 'mobilenet_v3_small_imagenet1k_v1',
  processing_duration_ms NUMERIC(10,2),
  
  -- Admin Override Workflow
  admin_decision TEXT, -- 'approved', 'rejected', 'manual_review'
  admin_decision_by TEXT,
  admin_decision_at TIMESTAMPTZ,
  admin_decision_note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy lookups by report_id
CREATE INDEX IF NOT EXISTS idx_resolution_verifications_report ON public.resolution_verifications(report_id, created_at DESC);

-- 3. Verification Background Job Queue Table (Optional Supabase mirror)
CREATE TABLE IF NOT EXISTS public.verification_jobs (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  verification_id TEXT REFERENCES public.resolution_verifications(id) ON DELETE SET NULL,
  job_status TEXT DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_verification_jobs_status ON public.verification_jobs(job_status, created_at ASC);

-- 4. Enable Realtime & RLS
ALTER TABLE public.resolution_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read resolution verifications" ON public.resolution_verifications FOR SELECT USING (true);
CREATE POLICY "System update resolution verifications" ON public.resolution_verifications FOR ALL USING (true);

ALTER TABLE public.verification_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read verification jobs" ON public.verification_jobs FOR SELECT USING (true);
CREATE POLICY "System update verification jobs" ON public.verification_jobs FOR ALL USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.resolution_verifications;

