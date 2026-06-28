/**
 * Rate Benchmark Configuration — Section 6 of the build spec.
 *
 * Stored as a config object (not hardcoded inline) so rates can be
 * updated every 6–9 months without touching core calculation logic.
 *
 * All monetary values are in INR (₹).
 */

// ──────────────────────────────────────────────
// Follower Tier Definitions
// ──────────────────────────────────────────────

export interface FollowerTier {
  name: string;
  minFollowers: number;
  maxFollowers: number | null; // null = unlimited (1M+)
  baseMin: number;
  baseMax: number | null; // null = "Custom quote"
  baseMedian: number;
}

export const followerTiers: FollowerTier[] = [
  {
    name: 'Nano',
    minFollowers: 1_000,
    maxFollowers: 10_000,
    baseMin: 1_500,
    baseMax: 10_000,
    baseMedian: 4_000,
  },
  {
    name: 'Micro',
    minFollowers: 10_000,
    maxFollowers: 50_000,
    baseMin: 5_000,
    baseMax: 35_000,
    baseMedian: 15_000,
  },
  {
    name: 'Mid',
    minFollowers: 50_000,
    maxFollowers: 100_000,
    baseMin: 15_000,
    baseMax: 70_000,
    baseMedian: 35_000,
  },
  {
    name: 'Mid-Large',
    minFollowers: 100_000,
    maxFollowers: 500_000,
    baseMin: 30_000,
    baseMax: 250_000,
    baseMedian: 80_000,
  },
  {
    name: 'Macro',
    minFollowers: 500_000,
    maxFollowers: 1_000_000,
    baseMin: 100_000,
    baseMax: 500_000,
    baseMedian: 200_000,
  },
  {
    name: 'Mega',
    minFollowers: 1_000_000,
    maxFollowers: null,
    baseMin: 300_000,
    baseMax: null, // "Custom quote"
    baseMedian: 300_000,
  },
];

// ──────────────────────────────────────────────
// Niche Multipliers
// ──────────────────────────────────────────────

export const nicheMultipliers: Record<string, number> = {
  'Finance / Tech / B2B SaaS': 1.3,
  'Health / Wellness / Education': 1.15,
  'Beauty / Fashion': 1.1,
  Fitness: 1.0,
  'Food / Lifestyle / Comedy / General': 0.85,
};

// Niche options for the form dropdown
export const nicheOptions = Object.keys(nicheMultipliers);

// ──────────────────────────────────────────────
// Engagement Rate Adjustments
// ──────────────────────────────────────────────

export interface EngagementBracket {
  label: string;
  minRate: number;
  maxRate: number | null; // null = no upper bound
  adjustment: number; // e.g. -0.15 = -15%
}

export const engagementBrackets: EngagementBracket[] = [
  { label: 'Below 2%', minRate: 0, maxRate: 2, adjustment: -0.15 },
  { label: '2–4%', minRate: 2, maxRate: 4, adjustment: 0 },
  { label: '4–7%', minRate: 4, maxRate: 7, adjustment: 0.2 },
  { label: '7%+', minRate: 7, maxRate: null, adjustment: 0.35 },
];

// ──────────────────────────────────────────────
// Deliverable Type Multipliers
// ──────────────────────────────────────────────

export interface Deliverable {
  key: string;
  label: string;
  platform: 'instagram' | 'youtube' | 'facebook';
  multiplierMin: number;
  multiplierMax: number;
}

export const deliverables: Deliverable[] = [
  // Instagram
  {
    key: 'ig_story_single',
    label: 'Story (single)',
    platform: 'instagram',
    multiplierMin: 0.3,
    multiplierMax: 0.3,
  },
  {
    key: 'ig_story_set',
    label: 'Story set (3–5)',
    platform: 'instagram',
    multiplierMin: 0.5,
    multiplierMax: 0.5,
  },
  {
    key: 'ig_carousel',
    label: 'Carousel / Static post',
    platform: 'instagram',
    multiplierMin: 0.9,
    multiplierMax: 0.9,
  },
  {
    key: 'ig_reel',
    label: 'Reel',
    platform: 'instagram',
    multiplierMin: 1.0,
    multiplierMax: 1.0,
  },

  // Facebook
  {
    key: 'fb_post',
    label: 'Single post',
    platform: 'facebook',
    multiplierMin: 0.7,
    multiplierMax: 0.7,
  },
  {
    key: 'fb_video',
    label: 'Video post',
    platform: 'facebook',
    multiplierMin: 0.9,
    multiplierMax: 0.9,
  },

  // YouTube
  {
    key: 'yt_integration',
    label: 'Shorts / Integration',
    platform: 'youtube',
    multiplierMin: 2.0,
    multiplierMax: 2.5,
  },
  {
    key: 'yt_dedicated',
    label: 'Dedicated video',
    platform: 'youtube',
    multiplierMin: 2.5,
    multiplierMax: 3.0,
  },
];

// ──────────────────────────────────────────────
// City Tier Adjustments
// ──────────────────────────────────────────────

export const cityTierAdjustments: Record<string, number> = {
  tier_1: 0.1,
  tier_2: 0,
  tier_3: -0.05,
};

// ──────────────────────────────────────────────
// City → Tier Mapping (Major Indian Cities)
// ──────────────────────────────────────────────

export const cityTierMapping: Record<string, 'tier_1' | 'tier_2' | 'tier_3'> = {
  // Tier 1 — Metro cities
  Mumbai: 'tier_1',
  Delhi: 'tier_1',
  'New Delhi': 'tier_1',
  Bengaluru: 'tier_1',
  Bangalore: 'tier_1',
  Hyderabad: 'tier_1',
  Chennai: 'tier_1',
  Kolkata: 'tier_1',
  Pune: 'tier_1',
  Ahmedabad: 'tier_1',

  // Tier 2 — Major non-metro cities
  Jaipur: 'tier_2',
  Lucknow: 'tier_2',
  Chandigarh: 'tier_2',
  Indore: 'tier_2',
  Kochi: 'tier_2',
  Coimbatore: 'tier_2',
  Nagpur: 'tier_2',
  Bhopal: 'tier_2',
  Surat: 'tier_2',
  Vadodara: 'tier_2',
  Visakhapatnam: 'tier_2',
  Thiruvananthapuram: 'tier_2',
  Patna: 'tier_2',
  Guwahati: 'tier_2',
  Dehradun: 'tier_2',
  Noida: 'tier_2',
  Gurgaon: 'tier_2',
  Gurugram: 'tier_2',
  Mysuru: 'tier_2',
  Mysore: 'tier_2',
  Mangaluru: 'tier_2',
  Rajkot: 'tier_2',
  Ranchi: 'tier_2',
  Bhubaneswar: 'tier_2',
  Amritsar: 'tier_2',
  Jodhpur: 'tier_2',
  Agra: 'tier_2',
  Kanpur: 'tier_2',
  Varanasi: 'tier_2',
  Nashik: 'tier_2',
  Aurangabad: 'tier_2',
  Madurai: 'tier_2',
  Vijayawada: 'tier_2',
  Raipur: 'tier_2',

  // Tier 3 — Smaller cities
  Other: 'tier_3',
};

// Sorted city names for the dropdown
export const cityOptions = Object.keys(cityTierMapping).sort((a, b) => {
  // Put "Other" at the end
  if (a === 'Other') return 1;
  if (b === 'Other') return -1;
  return a.localeCompare(b);
});
