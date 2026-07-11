-- Migration 008: Add stats columns and flags to creator_profiles
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE creator_profiles 
  ADD COLUMN IF NOT EXISTS downloads_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updates_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deletes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quick_review_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS profile_verification_requested BOOLEAN DEFAULT FALSE;
