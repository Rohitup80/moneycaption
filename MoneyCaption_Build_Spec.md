# MoneyCaption — Build Specification (v1.0)
**For: Antigravity IDE build**
**Product: Creator Rate Card Generator + Business OS (Phase 1 — Free Rate Card Tool)**
**Platforms targeted: Instagram, YouTube, Facebook**

---

## 1. PROJECT OVERVIEW

MoneyCaption is a web app that helps Indian content creators calculate fair brand-deal pricing across Instagram, YouTube, and Facebook, generate a professional downloadable rate card PDF, and (in later phases) manage invoices, contracts, and payment tracking.

**Phase 1 scope (this document):** The free rate card calculator + creator profile system + PDF generation. This is the wedge product — no payments, no subscriptions yet.

**Domain:** moneycaption.com (already owned, on Hostinger — DNS will be pointed to Vercel)

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14+ (App Router) |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (Postgres + Supabase Auth) |
| Hosting | Vercel |
| PDF generation | `@react-pdf/renderer` (client or serverless function) |
| Form handling | React Hook Form + Zod for validation |
| Deployment domain | moneycaption.com (DNS pointed from Hostinger to Vercel) |

**Auth method:** Phone number + OTP (preferred for India) as primary; email as fallback option. Use Supabase Auth's phone OTP provider.

---

## 3. DATABASE SCHEMA (Supabase / Postgres)

### Table: `creator_profiles`

```sql
create table creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique,
  name text not null,
  phone text,
  email text,

  -- Platform handles
  instagram_handle text,
  youtube_handle text,
  facebook_handle text,

  -- Follower counts (per platform)
  followers_instagram integer,
  followers_youtube integer,
  followers_facebook integer,

  -- Niche & location
  niche text not null,
  city_tier text check (city_tier in ('tier_1','tier_2','tier_3')),

  -- Engagement data
  engagement_rate numeric,
  engagement_source text check (engagement_source in ('self_reported','manual_calculated','screenshot_verified','api_verified')) default 'self_reported',
  engagement_calculated_by text check (engagement_calculated_by in ('creator','admin')) default 'creator',

  -- Verification
  verification_tier text check (verification_tier in ('self_reported','screenshot_verified','api_verified')) default 'self_reported',
  verification_date timestamp,
  screenshot_url text,

  -- Meta
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

### Table: `rate_cards`

```sql
create table rate_cards (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creator_profiles(id),

  platform text check (platform in ('instagram','youtube','facebook')),
  deliverable_type text not null, -- e.g. 'reel', 'story', 'carousel', 'youtube_integration', 'youtube_dedicated', 'facebook_post'

  calculated_rate_min numeric,
  calculated_rate_max numeric,
  calculated_rate_median numeric,

  pdf_url text, -- generated PDF stored in Supabase storage
  created_at timestamp default now()
);
```

### Table: `admin_review_queue`

```sql
create table admin_review_queue (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creator_profiles(id),
  status text check (status in ('pending','reviewed')) default 'pending',
  reviewed_engagement_rate numeric,
  reviewed_by text,
  reviewed_at timestamp,
  created_at timestamp default now()
);
```

**Note for Antigravity:** Use Supabase Row Level Security (RLS) so creators can only read/edit their own `creator_profiles` row. `admin_review_queue` should only be writable via a service role key (admin-only access), not exposed to the public client.

---

## 4. PAGE-BY-PAGE SPEC

### Page 1 — Landing Page (`/`)
- Headline: clear value prop (e.g. "Know your worth. Get a brand-ready rate card in 60 seconds.")
- Primary CTA button: "Calculate My Rate" → routes to `/calculate`
- Brief trust section: "Used by creators across Instagram, YouTube & Facebook"
- Footer: links to SEO content pages (Phase 2, not built yet — just reserve the nav slot)

### Page 2 — Calculator Input Form (`/calculate`)

**Step 1 of form — Basic Info**
- Name (text)
- Phone number (text, used for OTP login later — don't force login yet, allow anonymous use first)
- City (dropdown → maps to city_tier: tier_1/tier_2/tier_3 — provide a mapping list of major Indian cities to tiers)

**Step 2 — Platform Selection**
- Checkboxes: Instagram / YouTube / Facebook (multi-select allowed)
- For each platform selected, show follower count input field dynamically

**Step 3 — Niche**
- Dropdown: Finance/Tech/B2B, Health/Wellness/Education, Beauty/Fashion, Fitness, Food/Lifestyle/Comedy/General (per benchmark model — see Section 6)

**Step 4 — Engagement Rate (Optional)**
- Numeric input, clearly labeled: "Engagement Rate (%) — Optional. Don't know it? Skip this and we'll calculate it for you within 24-48 hours."
- If skipped → on form submit, create a row in `admin_review_queue` with status `pending`
- If filled → save with `engagement_source = 'self_reported'`

**Step 5 — Submit**
- On submit: save to `creator_profiles`, redirect to `/results`

### Page 3 — Results Page (`/results`)

- Show calculated rate range per platform + deliverable type (table format)
- Each row: Platform | Deliverable | Rate Range (₹) | Suggested Quote (top of range)
- Verification badge shown next to creator name:
  - Grey badge: "Self-Reported"
  - Yellow/Orange badge: "Pending Manual Review" (if engagement was skipped)
  - Blue badge: "Screenshot Verified"
  - Green badge: "API Verified" (Phase 2, not active yet — UI placeholder only)
- "Last calculated on [date]" timestamp shown
- Button: "Download Rate Card PDF"
- Button: "Upload Screenshot to Verify" → opens upload modal (saves to Supabase Storage, sets `verification_tier = 'screenshot_verified'`, `verification_date = now()`)
- Disclaimer text block (required — see Section 7)

### Page 4 — PDF Rate Card (generated, not a page — a downloadable file)
- Branded with MoneyCaption logo
- Creator name, niche, city tier, verification badge
- Table of rates by platform/deliverable
- Footer: "Generated via moneycaption.com — [date]"

### Page 5 — Login/Profile (`/profile`)
- Phone OTP login via Supabase Auth
- Shows saved profile, last rate card generated
- "Update My Numbers" button — pre-fills the calculator form (Page 2) with existing data instead of blank fields
- Edit engagement rate / upload new screenshot

### Page 6 — Admin Review Panel (`/admin/review`) — internal use only, basic auth-gated
- Table of all `admin_review_queue` entries with status `pending`
- For each: creator name, niche, platform handles, follower counts (links to their public profile to manually check engagement)
- Input field: "Calculated engagement rate" + Submit button
- On submit: updates `creator_profiles.engagement_rate`, sets `engagement_source = 'manual_calculated'`, `engagement_calculated_by = 'admin'`, marks queue row as `reviewed`

---

## 5. AUTO-FILL LOGIC (Returning Users)

- On `/calculate`, check if user is logged in (Supabase session) and has an existing `creator_profiles` row
- If yes: pre-fill all fields from their saved profile
- Show a banner: "We've pre-filled your last details. Update anything that's changed, or just hit Recalculate."
- Button changes from "Calculate My Rate" to "Recalculate My Rate"

---

## 6. RATE BENCHMARK MODEL (Calculation Logic)

This is the core pricing engine. Implement as a pure function — no AI/ML needed, just structured lookup + multipliers.

### Base rate by follower tier (Instagram Reel baseline, INR):

| Tier | Followers | Min | Max | Median |
|---|---|---|---|---|
| Nano | 1K–10K | 1,500 | 10,000 | 4,000 |
| Micro | 10K–50K | 5,000 | 35,000 | 15,000 |
| Mid | 50K–100K | 15,000 | 70,000 | 35,000 |
| Mid-Large | 100K–500K | 30,000 | 250,000 | 80,000 |
| Macro | 500K–1M | 100,000 | 500,000 | 200,000 |
| Mega | 1M+ | 300,000 | — | "Custom quote" |

### Niche multiplier:

| Niche | Multiplier |
|---|---|
| Finance / Tech / B2B SaaS | 1.3 |
| Health / Wellness / Education | 1.15 |
| Beauty / Fashion | 1.1 |
| Fitness | 1.0 |
| Food / Lifestyle / Comedy / General | 0.85 |

### Engagement rate adjustment:

| Engagement Rate | Adjustment |
|---|---|
| Below 2% | -15% |
| 2–4% | 0% |
| 4–7% | +20% |
| 7%+ | +35% |
| Not yet available (pending review) | 0% (use baseline until admin review completes) |

### Deliverable type multiplier (relative to Instagram Reel = 1.0):

| Deliverable | Platform | Multiplier |
|---|---|---|
| Story (single) | Instagram | 0.3 |
| Story set (3–5) | Instagram | 0.5 |
| Carousel/Static post | Instagram | 0.9 |
| Reel | Instagram | 1.0 |
| Single post | Facebook | 0.7 |
| Video post | Facebook | 0.9 |
| Shorts/Integration | YouTube | 2.0–2.5 |
| Dedicated video | YouTube | 2.5–3.0 |

### City tier adjustment:

| City Tier | Adjustment |
|---|---|
| Tier 1 | +10% |
| Tier 2 | 0% |
| Tier 3 | -5% |

### Final formula:

```
final_rate = base_rate (by follower tier)
             × niche_multiplier
             × (1 + engagement_adjustment)
             × deliverable_multiplier
             × (1 + city_adjustment)

display_range = [final_rate × 0.85, final_rate × 1.15]
```

**Implementation note:** Store this as a config object/JSON (not hardcoded inline) so it can be updated every 6–9 months without touching core logic — rates will need periodic refreshing.

---

## 7. REQUIRED DISCLAIMER TEXT (show on Results page)

> "These are benchmark estimates, not guaranteed prices. Your actual rate depends on content quality, audience trust, and brand budget. We suggest quoting near the top of this range to leave room for negotiation. Rates shown are pre-GST — if your annual brand-deal income exceeds ₹20 lakh, you must register for GST and add 18% on top of your quote. Bundled deals (multiple deliverables) typically get a 15–25% discount versus per-post pricing."

---

## 8. WHAT'S explicitly OUT OF SCOPE FOR PHASE 1

Do not build these yet — they come in later phases:
- Razorpay payment integration / subscriptions
- Contract template generator
- Invoice generator with GST/SAC fields
- WhatsApp reminder integration
- Instagram/YouTube OAuth API verification (Tier 3 "API Verified")
- Regional language PDF output
- Barter deal logging

These are documented in the product roadmap but should not be scaffolded into the codebase now — keep Phase 1 lean and shippable.

---

## 9. BUILD ORDER (Suggested Sequence for Antigravity)

1. Next.js project setup + Tailwind + Supabase client config
2. Database schema creation (run SQL from Section 3 in Supabase)
3. Landing page (Page 1)
4. Calculator form — all steps (Page 2) — without backend save first, just UI + validation
5. Rate calculation engine (Section 6 logic) as a standalone, testable function
6. Connect form submission → save to Supabase → results page (Page 3)
7. PDF generation (Page 4)
8. Phone OTP auth + profile page + auto-fill logic (Page 5, Section 5)
9. Screenshot upload + verification badge logic
10. Admin review panel (Page 6) — last, since it's internal-only

---

## 10. ENVIRONMENT VARIABLES NEEDED

```
NEXT_PUBLIC_SUPABASE_URL=https://hmysjhbfzhldqmbbaauk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_07S9srH0eEWZYZPMO1uuRQ_Ov3m4HYb
SUPABASE_SERVICE_ROLE_KEY= (DO NOT put this in any file or document — see note below)
```

**Security note — read before proceeding:**
The two values above (URL + publishable/anon key) are safe to expose in frontend
code and in this document — they're designed to be public, protected by Supabase
Row Level Security (RLS) rather than secrecy.

The **service role key** is different — it bypasses RLS completely and grants
full database access. It must NEVER be pasted into this file, into Antigravity's
chat/context, into GitHub, or into any document. Instead:
- Get it from Supabase → Project Settings → API → service_role key
- Paste it directly into Vercel → Project Settings → Environment Variables
- Only server-side code (e.g. the admin review panel's API route) should read
  it via `process.env.SUPABASE_SERVICE_ROLE_KEY` — never expose it to the
  client/browser

Before this project ever goes into a GitHub repo, confirm `.env.local` (or
equivalent) is listed in `.gitignore` so no key — even the public-safe ones —
gets committed by habit.

---

*End of Build Spec v1.0 — Phase 1 scope only.*
