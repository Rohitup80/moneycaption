-- Migration 007: Add city column to creator_profiles and rate_calculations
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE creator_profiles 
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE rate_calculations 
  ADD COLUMN IF NOT EXISTS city TEXT;
