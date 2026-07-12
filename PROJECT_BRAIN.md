# MoneyCaption — Project Brain & AI Reference Hub

This document is the absolute source of truth for the MoneyCaption project. It maps the architecture, templates, styling systems, logic equations, database schemas, and developer workflows. Share this file with any AI model or new developer to instantly align them with the codebase.

---

## 🌟 1. Project Overview & Capabilities

**MoneyCaption** is a premium, web-based creator rate calculator and portfolio card builder. It allows social media creators (Instagram, YouTube, Facebook) to calculate, customize, save, and share their media rate cards with prospective brand sponsors.

### Core Creator Workflow:
1. **Fetch/Input Profile:** Creator enters details manually or uses automated social API lookups.
2. **Pricing Engine:** System applies baseline CPM rates adjusted by Niche Multipliers, City Location Tiers, and optional metrics (engagement rates, average views).
3. **Customize Pricing:** Creators can override calculations to set custom rates for specific deliverables (e.g., Instagram Reel, Story, YouTube Integrated) before saving.
4. **Download & Share:** System compiles rates into an elegant, branded PDF card, stores the saved rates in the database, and hosts a public shareable portfolio link (`/share/[id]`).

---

## 📁 2. Codebase Routing & Component Map

Use this map to locate screens, components, and layout files:

| File Path | Description | Key Customization Notes |
| :--- | :--- | :--- |
| [app/page.tsx](file:///d:/moneycaption/app/page.tsx) | Homepage Landing Page | Hero sections, testimonials, and verified badges overview. |
| [app/calculate/page.tsx](file:///d:/moneycaption/app/calculate/page.tsx) | Rate Calculator Router | Wraps the multi-step calculator form component. |
| [app/calculate/CalculatorForm.tsx](file:///d:/moneycaption/app/calculate/CalculatorForm.tsx) | Multi-Step Calculator Form | Handles validation (Zod & React Hook Form), API blur checks, and platforms/niche options grids. |
| [app/results/page.tsx](file:///d:/moneycaption/app/results/page.tsx) | Results & PDF View | Renders deliverables pricing grids, custom edit states, clipboard shares, and PDF generator wrappers. |
| [app/profile/page.tsx](file:///d:/moneycaption/app/profile/page.tsx) | Creator Dashboard Portal | Credentials portal, login/signup forms, local verification resenders, password resets, verification triggers, and history calculation lists. |
| [app/share/\[id\]/page.tsx](file:///d:/moneycaption/app/share/%5Bid%5D/page.tsx) | Creator Shareable Portfolio | Client-facing public rate card pages (reads active saved deliverables from `rate_cards`). |
| [app/admin/review/page.tsx](file:///d:/moneycaption/app/admin/review/page.tsx) | Admin Panel & Stats | Passcode entry screen, metrics counters dashboard, screenshot review cards, and creator inspection drawers. |
| [components/Navbar.tsx](file:///d:/moneycaption/components/Navbar.tsx) | Navbar Navigation Menu | Mobile hamburger toggler menu overlay and header branding. |
| [app/globals.css](file:///d:/moneycaption/app/globals.css) | Custom Design Styles CSS | Core color palette tokens (`--mc-primary`, etc.), custom inputs, badges, and responsive containers. |

---

## ⚡ 3. The Pricing & Calculation Engine

All calculations are executed server-side to prevent tampering. Customizations to baseline values should be done in the files below:

### Config Variables & Weights
*   **File Path:** [lib/rate-config.ts](file:///d:/moneycaption/lib/rate-config.ts)
*   **Structures:**
    *   `NICHE_MULTIPLIERS`: Multiplier values assigned to each content niche (e.g. Finance has a `1.5x` multiplier, Dev/Coding has `1.4x`, Gaming has `0.9x`).
    *   `cityOptions` & `cityTierMapping`: Designates if a city belongs to `tier_1` (baseline), `tier_2` (0.85x), or `tier_3` (0.7x).
    *   `platformDeliverables`: Defines baseline CPM ranges (min, max, median) for each deliverable (e.g., `ig_reel`, `yt_integrated`).

### Calculation Math
*   **File Path:** [lib/rate-engine.ts](file:///d:/moneycaption/lib/rate-engine.ts)
*   **Equation Structure:**
    ```typescript
    Base Price = Followers * (CPM / 1000)
    Adjusted Price = Base Price * NicheMultiplier * LocationTierMultiplier
    ```
    *   *Engagement Rate Scaling:* If engagement exceeds `3.0%`, baseline rates scale upwards by up to `15%` to reward creator performance.

---

## 🎨 4. PDF Generation & Styling templates

*   **File Path:** [lib/pdf-generator.ts](file:///d:/moneycaption/lib/pdf-generator.ts)
*   **Technologies:** Built on top of `@react-pdf/renderer` (server/client dynamic rendering).
*   **Layout Specifications:** Draws a professional, single-page landscape layout including:
    *   Top left creator header and content niche.
    *   Top right verification tier badge (Self-Reported, Screenshot Verified, or API Verified).
    *   Social metrics display boxes (Instagram, YouTube, and Facebook follower counts).
    *   Core pricing tables listing deliverable item name, custom pricing tags (if creator edited), and prices.
    *   MoneyCaption footer branding signature.

---

## 🛢️ 5. Supabase Database Schema

### Tables & Fields:

#### A. `creator_profiles`
Main table storing creator user profiles:
*   `id` (UUID, Primary Key)
*   `user_id` (UUID, references Supabase Auth users)
*   `name` (TEXT)
*   `email` (TEXT)
*   `phone` (TEXT)
*   `niche` (TEXT)
*   `city` (TEXT)
*   `city_tier` (TEXT)
*   `instagram_handle`, `youtube_handle`, `facebook_handle`
*   `followers_instagram`, `followers_youtube`, `followers_facebook`
*   `verification_tier` ('self_reported', 'screenshot_verified', 'api_verified')
*   `screenshot_url` (TEXT)
*   `screenshot_status` ('none', 'pending', 'approved', 'rejected')
*   `quick_review_requested` (BOOLEAN)
*   `profile_verification_requested` (BOOLEAN)
*   `approval_status` ('pending', 'approved', 'rejected')
*   `downloads_count`, `shares_count`, `updates_count`, `deletes_count` (INTEGER metrics tracking counters)

#### B. `rate_cards`
Stores the active saved rate card deliverables displayed on public portfolio pages:
*   `id` (UUID, Primary Key)
*   `creator_id` (UUID, references `creator_profiles`)
*   `platform` (TEXT - e.g. 'instagram')
*   `deliverable_type` (TEXT - e.g. 'ig_reel')
*   `calculated_rate_median`, `calculated_rate_min`, `calculated_rate_max` (NUMERIC values)
*   `creator_edited` (BOOLEAN - flag indicating custom price modifications)

#### C. `rate_calculations`
Logs the historical calculation entries run by creators:
*   `id` (UUID, Primary Key)
*   `user_id` (UUID, references Supabase Auth users)
*   `creator_name` (TEXT)
*   `niche`, `city_tier`, `verification_tier`
*   `platforms` (TEXT[] array of active platforms)
*   `results_json` (JSONB containing computed results array)

#### D. `admin_review_queue`
Manages screenshot verifications queue for admin audits:
*   `id` (UUID, Primary Key)
*   `creator_id` (UUID, references `creator_profiles`)
*   `status` (TEXT - 'pending', 'approved', 'rejected')

---

## 🔐 6. Row-Level Security (RLS) & Access Overrides

To ensure admin actions (reviews, edits, stats updates) are fully reliable and don't fail due to security constraints, Row-Level Security has specific admin bypass policies:
*   **Database Policy File:** [supabase/migrations/006_creator_approval_status.sql](file:///d:/moneycaption/supabase/migrations/006_creator_approval_status.sql)
*   *Bypass Principle:* Selective policies allow reading/updating data when requests are validated via administrative override controls.

---

## 📬 7. Simulated Service Endpoints

For local development convenience, external messaging services (verification emails, forgot passwords, and notifications) are routed through console mock API endpoints:

1.  **Email Verifications:** [app/api/send-verification/route.ts](file:///d:/moneycaption/app/api/send-verification/route.ts)
    *   *Output:* Prints link to terminal console: `http://localhost:3000/profile?verified=true&email=...`
2.  **Password Recovery:** [app/api/send-reset-password/route.ts](file:///d:/moneycaption/app/api/send-reset-password/route.ts)
    *   *Output:* Prints link to terminal console: `http://localhost:3000/profile?reset=true&email=...`
3.  **Instant Review Admin Alert:** [app/api/send-approval-request/route.ts](file:///d:/moneycaption/app/api/send-approval-request/route.ts)
    *   *Output:* Logs admin warning message for account review request to terminal console.
4.  **Instant Verification Badge Request:** [app/api/send-verification-request/route.ts](file:///d:/moneycaption/app/api/send-verification-request/route.ts)
    *   *Output:* Logs verification badge review request alert.

---

## 🛠️ 8. AI & Developer Conventions

When writing code or modifications for this project, adhere strictly to these principles:

1.  **Duplicate Rates Prevention:**
    *   Always clear old rate card rows matching `creator_id` from the `rate_cards` table before inserting updated ones (delete-then-insert routine) to prevent duplicate table rows.
    *   Always apply the unique-fallback filter (`!acc[platform].some(item => item.deliverable_type === card.deliverable_type)`) in list reducers to protect views from duplicate data.
2.  **Pending Approvals:**
    *   Pending reviews can log in and edit profile details, but cannot download PDFs or share links.
3.  **Compilation & Builds:**
    *   Always verify TypeScript compatibility by running `npm run build` after editing component configurations.
