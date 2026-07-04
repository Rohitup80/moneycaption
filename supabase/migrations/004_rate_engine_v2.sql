-- Migration 004: Rate Engine v2 + combined schema updates
-- Safe to run — uses IF NOT EXISTS and IF EXISTS throughout

-- A. Add new columns to creator_profiles
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS avg_views_instagram  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_views_youtube    NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_views_facebook   NUMERIC,
  ADD COLUMN IF NOT EXISTS data_source_provider TEXT,
  ADD COLUMN IF NOT EXISTS following_instagram  INTEGER,
  ADD COLUMN IF NOT EXISTS following_youtube    INTEGER,
  ADD COLUMN IF NOT EXISTS following_facebook   INTEGER,
  ADD COLUMN IF NOT EXISTS posts_instagram      INTEGER,
  ADD COLUMN IF NOT EXISTS posts_youtube        INTEGER,
  ADD COLUMN IF NOT EXISTS posts_facebook       INTEGER;

-- B. Add new columns to rate_cards
ALTER TABLE rate_cards
  ADD COLUMN IF NOT EXISTS selected_price  NUMERIC,
  ADD COLUMN IF NOT EXISTS selected_tier   TEXT;

-- C. Update verification_tier constraint to include auto-fetch tiers
ALTER TABLE creator_profiles
  DROP CONSTRAINT IF EXISTS creator_profiles_verification_tier_check;

ALTER TABLE creator_profiles
  ADD CONSTRAINT creator_profiles_verification_tier_check
  CHECK (verification_tier IN (
    'self_reported',
    'auto_fetched_public',
    'auto_fetched_youtube',
    'screenshot_verified',
    'api_verified'
  ));

-- D. Update engagement_source constraint
ALTER TABLE creator_profiles
  DROP CONSTRAINT IF EXISTS creator_profiles_engagement_source_check;

ALTER TABLE creator_profiles
  ADD CONSTRAINT creator_profiles_engagement_source_check
  CHECK (engagement_source IN (
    'self_reported',
    'manual_calculated',
    'auto_fetched_public',
    'auto_fetched_youtube',
    'screenshot_verified',
    'api_verified'
  ));
