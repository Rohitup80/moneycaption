-- MoneyCaption Phase 1 — Database Schema
-- Run this in Supabase SQL Editor (supabase.com → project → SQL Editor)
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Creator Profiles
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,

  -- Platform handles
  instagram_handle TEXT,
  youtube_handle TEXT,
  facebook_handle TEXT,

  -- Follower counts (per platform)
  followers_instagram INTEGER,
  followers_youtube INTEGER,
  followers_facebook INTEGER,

  -- Niche & location
  niche TEXT NOT NULL,
  city_tier TEXT CHECK (city_tier IN ('tier_1','tier_2','tier_3')),

  -- Engagement data
  engagement_rate NUMERIC,
  engagement_source TEXT CHECK (engagement_source IN ('self_reported','manual_calculated','screenshot_verified','api_verified')) DEFAULT 'self_reported',
  engagement_calculated_by TEXT CHECK (engagement_calculated_by IN ('creator','admin')) DEFAULT 'creator',

  -- Verification
  verification_tier TEXT CHECK (verification_tier IN ('self_reported','screenshot_verified','api_verified')) DEFAULT 'self_reported',
  verification_date TIMESTAMP,
  screenshot_url TEXT,

  -- Meta
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);


-- 2. Rate Cards
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creator_profiles(id),

  platform TEXT CHECK (platform IN ('instagram','youtube','facebook')),
  deliverable_type TEXT NOT NULL,

  calculated_rate_min NUMERIC,
  calculated_rate_max NUMERIC,
  calculated_rate_median NUMERIC,

  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT now()
);


-- 3. Admin Review Queue
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creator_profiles(id),
  status TEXT CHECK (status IN ('pending','reviewed')) DEFAULT 'pending',
  reviewed_engagement_rate NUMERIC,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);


-- ═════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_review_queue ENABLE ROW LEVEL SECURITY;


-- creator_profiles: creators can read/update their own row
-- Anonymous inserts are allowed (calculator works without login)

CREATE POLICY "Anyone can insert creator_profiles"
  ON creator_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own profile"
  ON creator_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anonymous can view profiles they just created"
  ON creator_profiles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can update own profile"
  ON creator_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anonymous can update profiles without user_id"
  ON creator_profiles FOR UPDATE
  TO anon
  USING (user_id IS NULL);


-- rate_cards: creators can read their own rate cards

CREATE POLICY "Anyone can insert rate_cards"
  ON rate_cards FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view rate_cards"
  ON rate_cards FOR SELECT
  TO anon, authenticated
  USING (true);


-- admin_review_queue: anyone can insert (from calculator form)
-- Only service role (admin) should update — no public update policy

CREATE POLICY "Anyone can insert to review queue"
  ON admin_review_queue FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view review queue"
  ON admin_review_queue FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update review queue"
  ON admin_review_queue FOR UPDATE
  TO anon, authenticated
  USING (true);


-- ═════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET (for screenshots)
-- ═════════════════════════════════════════════════════════════════════════

-- Run this separately if your Supabase project supports storage:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);
