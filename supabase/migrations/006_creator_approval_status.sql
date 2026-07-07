-- Migration 006: Creator Profile Approval Status & Administrative RLS Overrides
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Add approval_status column to creator_profiles
ALTER TABLE creator_profiles 
  ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending';

-- 2. Update existing profiles to 'approved' so they don't get locked out
UPDATE creator_profiles SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 3. Override RLS Policies for creator_profiles to allow Administrative dashboard operations
DROP POLICY IF EXISTS "Anyone can view creator_profiles" ON creator_profiles;
DROP POLICY IF EXISTS "Anyone can update creator_profiles" ON creator_profiles;
DROP POLICY IF EXISTS "Anyone can delete creator_profiles" ON creator_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON creator_profiles;
DROP POLICY IF EXISTS "Anonymous can view profiles they just created" ON creator_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON creator_profiles;
DROP POLICY IF EXISTS "Anonymous can update profiles without user_id" ON creator_profiles;

CREATE POLICY "Anyone can view creator_profiles"
  ON creator_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update creator_profiles"
  ON creator_profiles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete creator_profiles"
  ON creator_profiles FOR DELETE
  TO anon, authenticated
  USING (true);

-- 4. Override RLS Policies for rate_calculations to ensure reliability of history card linking
DROP POLICY IF EXISTS "Users can view own calculations" ON rate_calculations;
DROP POLICY IF EXISTS "Users can insert own calculations" ON rate_calculations;
DROP POLICY IF EXISTS "Anyone can select rate_calculations" ON rate_calculations;
DROP POLICY IF EXISTS "Anyone can insert rate_calculations" ON rate_calculations;
DROP POLICY IF EXISTS "Anyone can update rate_calculations" ON rate_calculations;
DROP POLICY IF EXISTS "Anyone can delete rate_calculations" ON rate_calculations;

CREATE POLICY "Anyone can select rate_calculations" 
  ON rate_calculations FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Anyone can insert rate_calculations" 
  ON rate_calculations FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Anyone can update rate_calculations" 
  ON rate_calculations FOR UPDATE 
  TO anon, authenticated 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete rate_calculations" 
  ON rate_calculations FOR DELETE 
  TO anon, authenticated 
  USING (true);

-- 5. Override RLS Policies for rate_cards to ensure creators and admins can view, update and delete deliverables
DROP POLICY IF EXISTS "Anyone can view rate_cards" ON rate_cards;
DROP POLICY IF EXISTS "Anyone can insert rate_cards" ON rate_cards;
DROP POLICY IF EXISTS "Anyone can update rate_cards" ON rate_cards;
DROP POLICY IF EXISTS "Anyone can delete rate_cards" ON rate_cards;

CREATE POLICY "Anyone can view rate_cards"
  ON rate_cards FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert rate_cards"
  ON rate_cards FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update rate_cards"
  ON rate_cards FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete rate_cards"
  ON rate_cards FOR DELETE
  TO anon, authenticated
  USING (true);
