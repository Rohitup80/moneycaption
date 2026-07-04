New Changes and Context of the current situation of this project. 

PDF Generation getting failed showing error. when downloading
Need to setip the screenshot Image for manual verfication
When loging in it is sending the link not the OTP to login(I want the proper loging setup for my user and the proper user dashboard after loging in. He can check everything in his profile details, update the details, and also save the activities of rate card generation and he can check those details in past as well)
Add signup button also for new users. they can signup


This is the MoneyCaption project at `d:\moneycaption`.
Phase 1 is already built. This instruction does three things:
1. Fixes existing bugs (login, PDF, niche selection)
2. Replaces the rate calculation logic (rate-config.ts + rate-engine.ts)
3. Updates the UI to show three selectable prices instead of a range

Before making any code changes, read the existing files first to understand
current structure, then make only the changes described below.

---

## STEP 1 — RUN THIS SQL IN SUPABASE FIRST (before any code changes)

Open Supabase → SQL Editor → New Query → paste and run:

```sql
-- Migration 003: Rate Engine v2 + combined schema updates
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

-- E. Verify everything worked — should return 11 rows
SELECT column_name, data_type, table_name
FROM information_schema.columns
WHERE table_name IN ('creator_profiles', 'rate_cards')
  AND column_name IN (
    'avg_views_instagram','avg_views_youtube','avg_views_facebook',
    'data_source_provider','following_instagram','following_youtube',
    'following_facebook','posts_instagram','posts_youtube','posts_facebook',
    'selected_price','selected_tier'
  )
ORDER BY table_name, column_name;
```

---

## STEP 2 — REPLACE lib/rate-config.ts ENTIRELY

Delete the existing file contents and replace with:

```typescript
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

// Niche multipliers — finance/tech commands 30-50% premium over lifestyle
export const NICHE_MULTIPLIERS: Record<string, { multiplier: number; label: string }> = {
  finance_tech_b2b:        { multiplier: 1.40, label: 'Finance / Tech / B2B' },
  health_wellness_edu:     { multiplier: 1.20, label: 'Health / Wellness / Education' },
  beauty_fashion:          { multiplier: 1.15, label: 'Beauty / Fashion' },
  automotive_realty:       { multiplier: 1.20, label: 'Automotive / Real Estate' },
  fitness:                 { multiplier: 1.00, label: 'Fitness' },
  food_travel:             { multiplier: 0.90, label: 'Food / Travel' },
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
```

---

## STEP 3 — REPLACE lib/rate-engine.ts ENTIRELY

Delete existing contents and replace with:

```typescript
/**
 * MoneyCaption — Rate Engine v2
 *
 * COMPATIBILITY: Output shape is unchanged from v1.
 * rate_cards table columns map as:
 *   contentFee      → calculated_rate_min
 *   marketStandard  → calculated_rate_median
 *   brandInvestment → calculated_rate_max
 *   selectedPrice   → selected_price (new column from migration)
 *   selectedTier    → selected_tier  (new column from migration)
 */

import {
  CPM_RATES, REACH_RATES, PRODUCTION_FLOORS,
  DELIVERABLES, NICHE_MULTIPLIERS, CITY_MULTIPLIERS,
} from './rate-config'

export interface RateEngineInput {
  platforms: {
    instagram?: number
    youtube?:   number
    facebook?:  number
  }
  niche:        string
  cityTier:     string
  engagementRate?:     number | null
  avgViewsInstagram?:  number | null
  avgViewsYoutube?:    number | null
  avgViewsFacebook?:   number | null
}

export interface DeliverableRate {
  id:               string
  label:            string
  platform:         string
  contentFee:       number
  marketStandard:   number
  brandInvestment:  number
  selectedPrice?:   number
  selectedTier?:    'contentFee' | 'marketStandard' | 'brandInvestment'
}

export interface RateCardResult {
  platform:     string
  deliverables: DeliverableRate[]
}

function getReachRateKey(er?: number | null): string {
  if (!er)      return 'not_provided'
  if (er < 1)   return 'below_1pct'
  if (er < 2)   return 'er_1_to_2'
  if (er < 4)   return 'er_2_to_4'
  if (er < 6)   return 'er_4_to_6'
  if (er < 8)   return 'er_6_to_8'
  return 'er_above_8'
}

function estimateReach(followers: number, er?: number | null): number {
  return followers * REACH_RATES[getReachRateKey(er)]
}

function roundToHundred(v: number): number {
  return Math.round(v / 100) * 100
}

function calcPrices(
  deliverable: { floorKey: string; viewMultiplier: number },
  baseReach: number,
  nicheMult: number,
  cityMult: number,
) {
  const floor = PRODUCTION_FLOORS[deliverable.floorKey]
  const effectiveReach = baseReach * deliverable.viewMultiplier
  return {
    contentFee:      roundToHundred(Math.max((effectiveReach / 1000) * CPM_RATES.contentFee,      floor) * nicheMult * cityMult),
    marketStandard:  roundToHundred(Math.max((effectiveReach / 1000) * CPM_RATES.marketStandard,  floor) * nicheMult * cityMult),
    brandInvestment: roundToHundred(Math.max((effectiveReach / 1000) * CPM_RATES.brandInvestment, floor) * nicheMult * cityMult),
  }
}

export function calculateRates(input: RateEngineInput): RateCardResult[] {
  const nicheMult = (NICHE_MULTIPLIERS[input.niche] ?? NICHE_MULTIPLIERS.lifestyle_comedy_general).multiplier
  const cityMult  = CITY_MULTIPLIERS[input.cityTier] ?? 1.00
  const results: RateCardResult[] = []

  if (input.platforms.instagram) {
    const baseReach = input.avgViewsInstagram
      ?? estimateReach(input.platforms.instagram, input.engagementRate)
    results.push({
      platform: 'instagram',
      deliverables: DELIVERABLES.instagram.map(d => ({
        id: d.id, label: d.label, platform: 'instagram',
        ...calcPrices(d, baseReach, nicheMult, cityMult),
      })),
    })
  }

  if (input.platforms.youtube) {
    const baseReach = input.avgViewsYoutube ?? input.platforms.youtube * 0.06
    results.push({
      platform: 'youtube',
      deliverables: DELIVERABLES.youtube.map(d => ({
        id: d.id, label: d.label, platform: 'youtube',
        ...calcPrices(d, baseReach, nicheMult, cityMult),
      })),
    })
  }

  if (input.platforms.facebook) {
    const baseReach = input.avgViewsFacebook ?? input.platforms.facebook * 0.07
    results.push({
      platform: 'facebook',
      deliverables: DELIVERABLES.facebook.map(d => ({
        id: d.id, label: d.label, platform: 'facebook',
        ...calcPrices(d, baseReach, nicheMult, cityMult),
      })),
    })
  }

  return results
}

// Call this when creator selects a price tier on results page
export function applyPriceSelection(
  results: RateCardResult[],
  selections: Record<string, 'contentFee' | 'marketStandard' | 'brandInvestment'>,
): RateCardResult[] {
  return results.map(platform => ({
    ...platform,
    deliverables: platform.deliverables.map(d => {
      const tier = selections[d.id] ?? 'marketStandard'
      return { ...d, selectedTier: tier, selectedPrice: d[tier] }
    }),
  }))
}

// Converts results to flat rows for rate_cards table insert
// Maps to existing columns: calculated_rate_min/median/max + new selected columns
export function flattenForDatabase(creatorId: string, results: RateCardResult[]) {
  return results.flatMap(platform =>
    platform.deliverables.map(d => ({
      creator_id:            creatorId,
      platform:              platform.platform,
      deliverable_type:      d.id,
      calculated_rate_min:   d.contentFee,
      calculated_rate_median:d.marketStandard,
      calculated_rate_max:   d.brandInvestment,
      selected_price:        d.selectedPrice ?? null,
      selected_tier:         d.selectedTier  ?? null,
    }))
  )
}
```

---

## STEP 4 — FIX: Login/Signup not working

Open `app/profile/page.tsx` (the login page).

The phone OTP is failing because no SMS provider is configured in Supabase.
**Switch primary login to email OTP (magic link)** — Supabase supports this
with zero extra setup.

Changes to make:
- Replace the phone number input field with an email input field for login
- Use `supabase.auth.signInWithOtp({ email })` instead of phone OTP
- Keep phone number as a separate profile field (stored in creator_profiles.phone)
  but it is NOT used for authentication
- Show: "Enter your email → we'll send you a magic link to sign in"

Do NOT set up Twilio or any SMS provider — that is Phase 2.

---

## STEP 5 — FIX: Niche selection has no visual selected state

Open `app/calculate/CalculatorForm.tsx`, find Step 3 (niche selection).

When a creator clicks a niche option, it must show a clear selected state.
Apply these styles on the selected niche card:
- Filled background (use the app's primary accent color)
- A visible border or ring highlight
- A checkmark icon or filled radio indicator

The selected state must persist visually until the creator moves to the
next step or changes their selection.

---

## STEP 6 — FIX: PDF bugs in lib/pdf-generator.ts

### Fix A — ₹ symbol renders as "1"

Register Noto Sans font at the top of pdf-generator.ts:

```typescript
import { Font, StyleSheet, Text, View, Document, Page } from '@react-pdf/renderer'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNb4j5Ba_2c7A.ttf' },
    { src: 'https://fonts.gstatic.com/s/notosans/v36/o-0NIpQlx3QUlC5A4PNjXhFVatyB1Wk.ttf', fontWeight: 'bold' },
  ],
})
```

Then add `fontFamily: 'NotoSans'` to EVERY Text style in the StyleSheet.
Do not leave any Text using default Helvetica — it does not contain the ₹ glyph.

### Fix B — Platform icon overlapping heading text

Find the platform section heading (Instagram / YouTube / Facebook label).
Replace any absolute positioning with a flex row:

```typescript
// Replace this pattern (whatever form it currently takes with absolute positioning):
// with this:
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  <View style={{ width: 18, height: 18 }}>
    {/* icon here with explicit width/height */}
  </View>
  <Text style={{ fontFamily: 'NotoSans', fontWeight: 'bold' }}>
    {platformName}
  </Text>
</View>
```

---

## STEP 7 — UPDATE: Calculator form (CalculatorForm.tsx)

### 7a. Add average views inputs to Step 4 (Engagement Rate step)

Below the existing engagement rate field, add these optional fields.
Show only for the platforms the creator selected in Step 2:

```tsx
{/* Show if Instagram was selected */}
{selectedPlatforms.includes('instagram') && (
  <div>
    <label>Avg Reel Views — Optional</label>
    <input
      type="number"
      placeholder="e.g. 1200"
      {...register('avgViewsInstagram', { valueAsNumber: true })}
    />
    <p className="hint-text">
      Open your last 10 Reels, average the view counts.
      This makes your rate card significantly more accurate.
    </p>
  </div>
)}

{selectedPlatforms.includes('youtube') && (
  <div>
    <label>Avg YouTube Video Views — Optional</label>
    <input
      type="number"
      placeholder="e.g. 5000"
      {...register('avgViewsYoutube', { valueAsNumber: true })}
    />
  </div>
)}

{selectedPlatforms.includes('facebook') && (
  <div>
    <label>Avg Facebook Post Reach — Optional</label>
    <input
      type="number"
      placeholder="e.g. 800"
      {...register('avgViewsFacebook', { valueAsNumber: true })}
    />
  </div>
)}
```

### 7b. Add to Zod schema

```typescript
avgViewsInstagram: z.number().positive().optional().nullable(),
avgViewsYoutube:   z.number().positive().optional().nullable(),
avgViewsFacebook:  z.number().positive().optional().nullable(),
```

### 7c. Update form submit handler

Pass new fields to calculateRates():
```typescript
import { calculateRates, RateEngineInput } from '@/lib/rate-engine'

const rateInput: RateEngineInput = {
  platforms: {
    instagram: formData.followersInstagram,
    youtube:   formData.followersYoutube,
    facebook:  formData.followersFacebook,
  },
  niche:             formData.niche,
  cityTier:          formData.cityTier,
  engagementRate:    formData.engagementRate,
  avgViewsInstagram: formData.avgViewsInstagram ?? null,
  avgViewsYoutube:   formData.avgViewsYoutube   ?? null,
  avgViewsFacebook:  formData.avgViewsFacebook  ?? null,
}
const results = calculateRates(rateInput)
```

Save new fields to Supabase upsert:
```typescript
avg_views_instagram: formData.avgViewsInstagram ?? null,
avg_views_youtube:   formData.avgViewsYoutube   ?? null,
avg_views_facebook:  formData.avgViewsFacebook  ?? null,
```

### 7d. Update auto-fill (returning users)

When loading a saved profile, also pre-fill the new fields:
```typescript
setValue('avgViewsInstagram', profile.avg_views_instagram)
setValue('avgViewsYoutube',   profile.avg_views_youtube)
setValue('avgViewsFacebook',  profile.avg_views_facebook)
```

---

## STEP 8 — UPDATE: Results page (app/results/page.tsx)

### 8a. Replace rate range display with three-price selection cards

The existing table shows min–max range per deliverable.
Replace each deliverable row with three selectable price cards.

Add state at the top of the component:
```typescript
import { PRICE_TIER_LABELS } from '@/lib/rate-config'
import { applyPriceSelection, flattenForDatabase } from '@/lib/rate-engine'

const [selections, setSelections] = useState<
  Record<string, 'contentFee' | 'marketStandard' | 'brandInvestment'>
>({})

// Default all deliverables to marketStandard on load
useEffect(() => {
  if (!results) return
  const defaults: Record<string, 'contentFee' | 'marketStandard' | 'brandInvestment'> = {}
  results.forEach(p => p.deliverables.forEach(d => { defaults[d.id] = 'marketStandard' }))
  setSelections(defaults)
}, [results])
```

Replace each deliverable row render with:
```tsx
<div className="deliverable-row" key={deliverable.id}>
  <span className="deliverable-name">{deliverable.label}</span>

  <div className="price-cards-group">
    {(['contentFee', 'marketStandard', 'brandInvestment'] as const).map(tier => (
      <button
        key={tier}
        onClick={() => setSelections(prev => ({ ...prev, [deliverable.id]: tier }))}
        className={`price-card ${selections[deliverable.id] === tier ? 'price-card--selected' : ''}`}
      >
        <span className="price-card__label">{PRICE_TIER_LABELS[tier].label}</span>
        <span className="price-card__amount">
          ₹{deliverable[tier].toLocaleString('en-IN')}
        </span>
        <span className="price-card__sublabel">{PRICE_TIER_LABELS[tier].sublabel}</span>
      </button>
    ))}
  </div>
</div>
```

### 8b. Add "Apply Market Standard to all" button

Above the deliverables table:
```tsx
<button
  className="btn-secondary"
  onClick={() => {
    const all: Record<string, 'marketStandard'> = {}
    results.forEach(p => p.deliverables.forEach(d => { all[d.id] = 'marketStandard' }))
    setSelections(all)
  }}
>
  Apply Market Standard to all
</button>
```

### 8c. Wire selections to PDF download

```typescript
const handleDownloadPDF = async () => {
  const resultsWithSelections = applyPriceSelection(results, selections)

  // Save to database
  if (creatorProfile?.id) {
    const rows = flattenForDatabase(creatorProfile.id, resultsWithSelections)
    await supabase.from('rate_cards').upsert(rows)
  }

  // Generate PDF with selected prices
  generatePDF(creatorProfile, resultsWithSelections)
}
```

---

## STEP 9 — UPDATE: PDF generator (lib/pdf-generator.ts)

Change the rate display in the PDF table from showing a range to showing
the selected price only:

```typescript
// In the deliverable row of the PDF:

// OLD — remove this:
// <Text>{formatINR(d.calculated_rate_min)} – {formatINR(d.calculated_rate_max)}</Text>

// NEW — show selected price with tier label:
<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
  <Text style={styles.deliverableLabel}>{d.label}</Text>
  <View style={{ alignItems: 'flex-end' }}>
    <Text style={styles.selectedPrice}>
      ₹{(d.selectedPrice ?? d.marketStandard).toLocaleString('en-IN')}
    </Text>
    <Text style={styles.tierBadge}>
      {d.selectedTier === 'contentFee'      ? 'Content Fee'       :
       d.selectedTier === 'brandInvestment' ? 'Brand Investment'  :
       'Market Standard'}
    </Text>
  </View>
</View>
```

The PDF should show ONE confident price per deliverable — not a range.
Brands see a single number; it looks professional and decisive.

---

## STEP 10 — UPDATE: Admin review panel (app/admin/review/page.tsx)

Add an optional avg views field when admin reviews a pending creator:

```tsx
<input
  type="number"
  placeholder="Avg Reel views (check creator's last 10 public posts)"
  onChange={(e) => setReviewedAvgViews(Number(e.target.value) || null)}
/>
```

On review submit, save avg views alongside engagement rate:
```typescript
await supabase
  .from('creator_profiles')
  .update({
    engagement_rate:          reviewedEngagementRate,
    avg_views_instagram:      reviewedAvgViews || null,
    engagement_source:        'manual_calculated',
    engagement_calculated_by: 'admin',
  })
  .eq('id', creatorId)
```

---

## COMPATIBILITY CHECK INSTRUCTIONS FOR ANTIGRAVITY

Before making any changes, verify these things in the existing codebase:

1. Confirm `lib/rate-config.ts` exists — full replace with Step 2 above
2. Confirm `lib/rate-engine.ts` exists — full replace with Step 3 above
3. Check what `calculateRates()` is currently imported as in:
   - `app/calculate/CalculatorForm.tsx` — update import if function name changed
   - `app/results/page.tsx` — update import if needed
4. Check what the rate results are currently stored as in results/page.tsx
   (look for variables named results, rateResults, rateCard etc.) and use
   the same variable name in Step 8 to avoid breaking the page
5. The PDF generator in `lib/pdf-generator.ts` currently receives
   `RateCardResult[]` — this type is unchanged, so PDF generator
   import does not need to change, only the display logic inside it
6. Run `npm run build` after all changes — fix any TypeScript errors
   before considering the task complete

---

## ORDER OF OPERATIONS (do in this exact order)

1. Run SQL migration in Supabase (Step 1)
2. Replace rate-config.ts (Step 2)
3. Replace rate-engine.ts (Step 3)
4. Fix login → email OTP (Step 4)
5. Fix niche selection state (Step 5)
6. Fix PDF bugs — font + icon (Step 6)
7. Update calculator form — add avg views (Step 7)
8. Update results page — three price cards (Step 8)
9. Update PDF generator — single selected price (Step 9)
10. Update admin panel — avg views field (Step 10)
11. Run `npm run build` — fix all TypeScript errors
12. Test locally at localhost:3000 — confirm calculator → results → PDF works end to end

---

## WHAT NOT TO CHANGE

- `lib/supabase/client.ts` — no changes
- `lib/supabase/server.ts` — no changes
- `lib/supabase/types.ts` — no changes
- `app/layout.tsx` — no changes
- `globals.css` — no changes (price card selected state uses existing
  design system classes where possible; add minimal new classes only)
- `supabase/migrations/001_initial_schema.sql` — do not modify
- `supabase/migrations/002_auto_fetch_schema.sql` — do not modify
  (the Step 1 migration above supersedes and combines both previous migrations)

