-- MoneyCaption — Schema Update for Auto-Fetch Feature
-- Run this in Supabase SQL Editor AFTER 001_initial_schema.sql
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Update verification_tier constraint to include new auto-fetch tiers
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

-- 2. Update engagement_source constraint to include new auto-fetch sources
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

-- 3. Add data_source_provider column for tracking/debugging
ALTER TABLE creator_profiles 
  ADD COLUMN IF NOT EXISTS data_source_provider TEXT;
-- Values: 'scrapecreators', 'ensembledata', 'youtube_api_v3', 'manual'

-- 4. Add following_count and post_count columns for auto-fetched data
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS following_instagram INTEGER,
  ADD COLUMN IF NOT EXISTS following_youtube INTEGER,
  ADD COLUMN IF NOT EXISTS following_facebook INTEGER,
  ADD COLUMN IF NOT EXISTS posts_instagram INTEGER,
  ADD COLUMN IF NOT EXISTS posts_youtube INTEGER,
  ADD COLUMN IF NOT EXISTS posts_facebook INTEGER;
