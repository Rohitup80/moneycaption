-- MoneyCaption — Rate Card Calculation History Table
-- Run this in Supabase SQL Editor (supabase.com → project → SQL Editor)
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL,
  niche TEXT NOT NULL,
  city_tier TEXT NOT NULL,
  verification_tier TEXT NOT NULL,
  platforms TEXT[] NOT NULL,
  followers_instagram INTEGER,
  followers_youtube INTEGER,
  followers_facebook INTEGER,
  engagement_rate NUMERIC,
  results_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE rate_calculations ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Users can view own calculations"
  ON rate_calculations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert policy
CREATE POLICY "Users can insert own calculations"
  ON rate_calculations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
