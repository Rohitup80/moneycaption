/**
 * Auto-generated Supabase Database types.
 * Matches the schema defined in Section 3 of the build spec.
 *
 * NOTE: If you modify the Supabase schema, regenerate these types using:
 *   npx supabase gen types typescript --project-id hmysjhbfzhldqmbbaauk > lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EngagementSource =
  | 'self_reported'
  | 'manual_calculated'
  | 'auto_fetched_public'
  | 'auto_fetched_youtube'
  | 'screenshot_verified'
  | 'api_verified';

export type EngagementCalculatedBy = 'creator' | 'admin';

export type VerificationTier =
  | 'self_reported'
  | 'auto_fetched_public'
  | 'auto_fetched_youtube'
  | 'screenshot_verified'
  | 'api_verified';

export type CityTier = 'tier_1' | 'tier_2' | 'tier_3';

export type Platform = 'instagram' | 'youtube' | 'facebook';

export type ReviewStatus = 'pending' | 'reviewed';

export interface CreatorProfile {
  id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;

  // Platform handles
  instagram_handle: string | null;
  youtube_handle: string | null;
  facebook_handle: string | null;

  // Follower counts
  followers_instagram: number | null;
  followers_youtube: number | null;
  followers_facebook: number | null;

  // Niche & location
  niche: string;
  city_tier: CityTier | null;

  // Engagement data
  engagement_rate: number | null;
  engagement_source: EngagementSource;
  engagement_calculated_by: EngagementCalculatedBy;

  // Verification
  verification_tier: VerificationTier;
  verification_date: string | null;
  screenshot_url: string | null;

  // Data source tracking
  data_source_provider: string | null;

  // Meta
  created_at: string;
  updated_at: string;
}

export interface RateCard {
  id: string;
  creator_id: string | null;
  platform: Platform | null;
  deliverable_type: string;
  calculated_rate_min: number | null;
  calculated_rate_max: number | null;
  calculated_rate_median: number | null;
  pdf_url: string | null;
  created_at: string;
}

export interface AdminReviewQueue {
  id: string;
  creator_id: string | null;
  status: ReviewStatus;
  reviewed_engagement_rate: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      creator_profiles: {
        Row: CreatorProfile;
        Insert: Omit<CreatorProfile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CreatorProfile, 'id'>>;
        Relationships: [];
      };
      rate_cards: {
        Row: RateCard;
        Insert: Omit<RateCard, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<RateCard, 'id'>>;
        Relationships: [
          {
            foreignKeyName: 'rate_cards_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'creator_profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      admin_review_queue: {
        Row: AdminReviewQueue;
        Insert: Omit<AdminReviewQueue, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<AdminReviewQueue, 'id'>>;
        Relationships: [
          {
            foreignKeyName: 'admin_review_queue_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'creator_profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
