import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client for browser/client-side usage.
 * Uses the public anon key — all access is governed by RLS policies.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
