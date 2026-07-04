-- Migration 005: Screenshot Verification & Storage Policies
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Add screenshot status, quick review request flags, and profile pic to creator_profiles
ALTER TABLE creator_profiles 
  ADD COLUMN IF NOT EXISTS screenshot_status TEXT CHECK (screenshot_status IN ('none', 'pending', 'approved', 'rejected')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS quick_review_requested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

-- 2. Add extra metadata and handle columns to rate_calculations
ALTER TABLE rate_calculations
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS youtube_handle TEXT,
  ADD COLUMN IF NOT EXISTS facebook_handle TEXT,
  ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
  ADD COLUMN IF NOT EXISTS following_instagram INTEGER,
  ADD COLUMN IF NOT EXISTS following_youtube INTEGER,
  ADD COLUMN IF NOT EXISTS following_facebook INTEGER,
  ADD COLUMN IF NOT EXISTS posts_instagram INTEGER,
  ADD COLUMN IF NOT EXISTS posts_youtube INTEGER,
  ADD COLUMN IF NOT EXISTS posts_facebook INTEGER;

-- 2. Enable storage policies for the 'screenshots' bucket
-- Allows public uploads and reads for creators using the verification tool

DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update" ON storage.objects;

CREATE POLICY "Allow public upload" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'screenshots');

CREATE POLICY "Allow public update" ON storage.objects
  FOR UPDATE TO public USING (bucket_id = 'screenshots');
