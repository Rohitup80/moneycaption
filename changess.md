Fix login (A1), niche selection state (A2), PDF rupee symbol (A3),
PDF icon overlap (A4)
Once those are confirmed working, build lib/social-fetch.ts with
the scraping provider integration (B1-B2) for Instagram/Facebook,
and the separate official YouTube Data API v3 function (B3)
Run the schema update (B4) in Supabase before testing the new fetch
flow end-to-end
Update the badge component with the new tier states (B5)
Add error handling/fallback behavior (B6) before considering this
feature done — an unstable fetch that breaks the whole form is
worse than no fetch at all



PART A — FIX EXISTING BUGS (Do These First)

A1. Login/Signup Not Working

Phone OTP login is failing. Check if Supabase Auth → Phone provider has
an SMS provider configured. For now, switch the primary auth method to
email + OTP (Supabase supports email OTP/magic link with zero extra
setup) and keep phone number as a profile field only, not the login
mechanism. We'll add SMS-based phone login in Phase 2 once we have a
Twilio/MSG91 account set up.

A2. Niche Selection — No Visual Selected State

On the niche selection step, when a user clicks/selects a niche option,
apply a clear 'selected' visual state — filled background color,
border highlight, or a checkmark/filled radio indicator. Currently no
visual feedback shows which niche is active.

A3. PDF Bug — Rupee Symbol Renders As "1"

The ₹ symbol renders as '1' in the PDF. Register the 'Noto Sans' font
(supports ₹ and Indic currency symbols) via Font.register() with its
regular + bold weights, and set it as the fontFamily on every Text
style in the document. Do not rely on the default Helvetica font.

A4. PDF Bug — Platform Icon Overlapping Heading Text

The platform name headings (Instagram/YouTube/Facebook) have an icon
overlapping the text. Fix the flex layout so the icon and text sit in
a row with proper gap spacing — give the icon a fixed width/height
container instead of absolute positioning.


PART B — NEW FEATURE: PUBLIC PROFILE AUTO-FETCH

Context (for Antigravity's understanding, not a task itself)

We confirmed that Instagram's official Graph API does not expose
follower/post/engagement data for accounts that haven't authenticated
via OAuth — this is a hard platform restriction, not a config issue.
Tools like trendHERO and InsTrack that offer "type any handle, get
instant stats" achieve this through third-party scraping infrastructure
providers (e.g. EnsembleData, ScrapeCreators, Apify) that capture
Instagram's own internal app/web data, not the official API. We are
knowingly choosing to use one of these providers for this feature.
Build it as an isolated, swappable module so the provider can be
changed later without touching the rest of the app.

B1. Provider Setup


Use ScrapeCreators or EnsembleData (founder will create the
account and provide the API key — do not hardcode any key, read from
environment variable SCRAPE_PROVIDER_API_KEY)
Build a single server-side service file: lib/social-fetch.ts — all
calls to the scraping provider go through this one file, so if we
switch providers later, only this file changes
This must be a server-side only call (API route / server action)
— never call the scraping provider directly from the browser, both
for API key security and so the request doesn't visibly originate
from the creator's own browser session


B2. The Fetch Flow (Calculator Step 2 — Platform Selection)

Creator enters Instagram/YouTube/Facebook handle
        ↓
On blur (after typing, before moving to next field), call our 
server-side endpoint: /api/fetch-profile
        ↓
Server endpoint calls lib/social-fetch.ts → scraping provider API
        ↓
   ┌────────────────┴────────────────┐
   │                                 │
Fetch SUCCEEDS                  Fetch FAILS
(public profile found)          (private account, 
   │                            invalid handle, 
   │                            provider error, 
   │                            rate limit)
   │                                 │
Auto-fill these fields:          Show manual input 
- Follower count                 fields (existing 
- Following count                 behavior, unchanged):
- Post count                     - Followers
- Calculate engagement rate      - Following  
  from last 12-18 posts'         - Posts
  likes+comments using:          - Engagement Rate 
  ER = ((avg likes + avg          (optional)
  comments per post) / 
  followers) × 100
        ↓                              ↓
Tag verification_tier =         Tag verification_tier = 
'auto_fetched_public'           'self_reported'
(or 'pending_review' if 
engagement skipped, per 
existing admin queue logic)
        ↓
Show fetched data to creator with 
an "Edit" option in case any 
number looks wrong to them — 
don't lock it as read-only

B3. YouTube Specifically — Use Official API, Not Scraping

For YouTube only: use the official YouTube Data API v3 instead of
the scraping provider. YouTube channel statistics (subscriber count,
video count, view counts) are public and officially accessible via API
key with no OAuth required — no need to use the scraping provider for
this platform. Build this as a separate function in the same
lib/social-fetch.ts file, e.g. fetchYouTubeStats(), called
alongside but independently from the Instagram/Facebook scraping
function.

B4. Database Schema Update

Add a new allowed value to the existing engagement_source and
verification_tier check constraints in creator_profiles:

sqlalter table creator_profiles 
  drop constraint if exists creator_profiles_verification_tier_check;

alter table creator_profiles 
  add constraint creator_profiles_verification_tier_check 
  check (verification_tier in (
    'self_reported', 
    'auto_fetched_public', 
    'auto_fetched_youtube', 
    'screenshot_verified', 
    'api_verified'
  ));

Also add a new column to track the data source explicitly for
transparency/debugging:

sqlalter table creator_profiles 
  add column if not exists data_source_provider text;
-- e.g. 'scrapecreators', 'ensembledata', 'youtube_api_v3', 'manual'

B5. Verification Badge — New Visual States Required

Update the badge component to support these distinct states. Do NOT
reuse colors between ownership-proven tiers and data-only tiers — this
distinction matters for trust labeling:

TierLabel Shown To UserBadge ColorWhat It Actually Provesself_reported"Self-Reported"GreyNothing verifiedauto_fetched_public"Public Data Match"Teal/Light BlueData is real (scraped from public profile), ownership NOT confirmedauto_fetched_youtube"YouTube Verified"Red-tinted (YouTube brand)Data is real via official API, ownership NOT confirmedscreenshot_verified"Screenshot Verified"IndigoData real, ownership likely (creator's own screenshot)api_verified"API Verified"GreenData real, ownership confirmed (Phase 2, not active yet)

Important: Do not label auto_fetched_public or auto_fetched_youtube
as "Verified" in user-facing copy without qualification — call it
"Public Data Match" or similar. "Verified" should be reserved for tiers
that confirm the form-filler owns the account, to keep the badge system
honest.

B6. Error Handling & Resilience

Scraping-based providers are inherently less stable than official APIs
— they break when Instagram changes its internal structure. Build for
this:


Wrap every call to the scraping provider in a try/catch with a
reasonable timeout (e.g. 8 seconds)
On any failure (timeout, error, rate limit, provider downtime),
silently fall back to manual input fields — never show a raw error
to the creator, just let them type their numbers in as normal
Log failures server-side (just a console log or simple log table is
fine for now) so we can monitor how often the provider is failing,
without needing to build full observability yet


B7. Explicitly Out of Scope For This Pass

Do not build yet:


Instagram/Facebook OAuth "Connect" flow (this remains Phase 2,
separate from this scraping-based auto-fetch)
Fake follower / bot detection scoring (some competitor tools offer
this — not in scope now)
Caching/refresh logic for previously fetched profiles (for now,
re-fetch every time the creator revisits the calculator; optimize
later if API costs become a concern)



=======================


PDF Generation getting failed showing error. when downloading
Need to setip the screenshot Image for manual verfication
When loging in it is sending the link not the OTP to login(I want the proper loging setup for my user and the proper user dashboard after loging in. He can check everything in his profile details, update the details, and also save the activities of rate card generation and he can check those details in past as well)
Add signup button also for new users. they can signup



