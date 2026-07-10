/**
 * MoneyCaption — Rate Configuration v2
 * CPM + Production Floor model
 * Replaces the old follower-tier lookup table
 */

// CPM rates (₹ per 1,000 views/reached audience) — Indian market 2026
export const CPM_RATES = {
  contentFee:      600,
  marketStandard:  1000,
  brandInvestment: 1800,
} as const

// What % of followers actually see a Reel — conservative, real 2026 data
export const REACH_RATES: Record<string, number> = {
  below_1pct:   0.08,
  er_1_to_2:    0.12,
  er_2_to_4:    0.20,
  er_4_to_6:    0.28,
  er_6_to_8:    0.35,
  er_above_8:   0.42,
  not_provided: 0.20,
}

// Minimum price regardless of reach — covers scripting, shooting, editing
export const PRODUCTION_FLOORS: Record<string, number> = {
  story_single:    300,
  story_set:       500,
  static_post:     700,
  carousel:        900,
  reel:            1000,
  facebook_post:   500,
  facebook_video:  800,
  yt_short:        1500,
  yt_integration:  3000,
  yt_dedicated:    5000,
}

// Deliverables per platform
// viewMultiplier = how this format's reach compares to a Reel (baseline 1.0)
export const DELIVERABLES = {
  instagram: [
    { id: 'story_single',  label: 'Story (single)',       floorKey: 'story_single',  viewMultiplier: 0.25, platform: 'instagram' },
    { id: 'story_set',     label: 'Story set (3–5)',      floorKey: 'story_set',     viewMultiplier: 0.40, platform: 'instagram' },
    { id: 'static_post',   label: 'Static post',          floorKey: 'static_post',   viewMultiplier: 0.65, platform: 'instagram' },
    { id: 'carousel',      label: 'Carousel',             floorKey: 'carousel',      viewMultiplier: 0.80, platform: 'instagram' },
    { id: 'reel',          label: 'Reel',                 floorKey: 'reel',          viewMultiplier: 1.00, platform: 'instagram' },
  ],
  youtube: [
    { id: 'yt_short',      label: 'YouTube Short / Integration', floorKey: 'yt_short',     viewMultiplier: 1.80, platform: 'youtube' },
    { id: 'yt_dedicated',  label: 'Dedicated YouTube video',     floorKey: 'yt_dedicated', viewMultiplier: 2.60, platform: 'youtube' },
  ],
  facebook: [
    { id: 'facebook_post',  label: 'Single post',   floorKey: 'facebook_post',  viewMultiplier: 0.55, platform: 'facebook' },
    { id: 'facebook_video', label: 'Video post',    floorKey: 'facebook_video', viewMultiplier: 0.75, platform: 'facebook' },
  ],
} as const

// Niche multipliers — commands up to 40% premium depending on advertiser budgets
export const NICHE_MULTIPLIERS: Record<string, { multiplier: number; label: string }> = {
  finance:                 { multiplier: 1.40, label: 'Finance' },
  investment:              { multiplier: 1.40, label: 'Investment' },
  ai_and_software:         { multiplier: 1.35, label: 'AI and Software' },
  coding_and_dev:          { multiplier: 1.35, label: 'Coding and Dev' },
  tech:                    { multiplier: 1.30, label: 'Tech' },
  real_estate:             { multiplier: 1.25, label: 'Real Estate' },
  side_hustle:             { multiplier: 1.25, label: 'Side Hustle' },
  education:               { multiplier: 1.20, label: 'Education' },
  health_wellness:         { multiplier: 1.20, label: 'Health and Wellness' },
  mental_health:           { multiplier: 1.20, label: 'Mental Health' },
  yoga:                    { multiplier: 1.15, label: 'Yoga' },
  diet_and_nutrition:      { multiplier: 1.15, label: 'Diet and Nutrition' },
  skin_care:               { multiplier: 1.15, label: 'Skin Care' },
  fashion:                 { multiplier: 1.15, label: 'Fashion' },
  home_decor:              { multiplier: 1.10, label: 'Home Decor' },
  photography:             { multiplier: 1.10, label: 'Photography' },
  workout:                 { multiplier: 1.10, label: 'Workout' },
  fitness:                 { multiplier: 1.00, label: 'Fitness' },
  automotive:              { multiplier: 1.20, label: 'Automotive' },
  media:                   { multiplier: 1.00, label: 'Media' },
  entertainment:           { multiplier: 0.90, label: 'Entertainment' },
  food_travel:             { multiplier: 0.95, label: 'Food and Travel' },
  quick_recipe:            { multiplier: 0.90, label: 'Quick Recipe' },
  gaming:                  { multiplier: 0.90, label: 'Gaming' },
  pop_culture:             { multiplier: 0.85, label: 'Pop Culture' },
  lifestyle_comedy_general:{ multiplier: 0.80, label: 'Lifestyle / Comedy / General' },
}

// City tier multipliers
export const CITY_MULTIPLIERS: Record<string, number> = {
  tier_1: 1.10,
  tier_2: 1.00,
  tier_3: 0.90,
}

export const TIER_1_CITIES = [
  'Mumbai','Delhi','Bangalore','Bengaluru','Hyderabad',
  'Chennai','Pune','Kolkata','Ahmedabad','Noida','Gurugram',
]

// Labels shown on results page price cards
export const PRICE_TIER_LABELS = {
  contentFee: {
    label: 'Content Fee',
    sublabel: 'Minimum — covers your production effort',
  },
  marketStandard: {
    label: 'Market Standard',
    sublabel: 'What most brands actively budget',
  },
  brandInvestment: {
    label: 'Brand Investment',
    sublabel: 'For serious brands with real budgets',
  },
} as const

export const DISCLAIMER =
  'Benchmark estimates based on Indian market data 2026. Not guaranteed prices. ' +
  'Content Fee = minimum floor. Market Standard = what similar creators charge. ' +
  'Brand Investment = for brands with serious budgets. ' +
  'All rates pre-GST. Add 18% GST if your annual brand income exceeds ₹20 lakh. ' +
  'Bundle deals typically get 15–25% discount. Generated by moneycaption.com'

// City → Tier Mapping (Major Indian Cities)
export const cityTierMapping: Record<string, 'tier_1' | 'tier_2' | 'tier_3'> = {
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

  Other: 'tier_3',
};

// Sorted city names for the dropdown
export const cityOptions = Object.keys(cityTierMapping).sort((a, b) => {
  if (a === 'Other') return 1;
  if (b === 'Other') return -1;
  return a.localeCompare(b);
});

// Niche Options
export const nicheOptions = Object.keys(NICHE_MULTIPLIERS);
