/**
 * Rate Calculation Engine — Section 6 of the build spec.
 *
 * Pure function implementation: no side effects, no database calls.
 * Takes creator data + deliverable info, returns calculated rate ranges.
 *
 * Formula:
 *   final_rate = base_rate (by follower tier)
 *                × niche_multiplier
 *                × (1 + engagement_adjustment)
 *                × deliverable_multiplier
 *                × (1 + city_adjustment)
 *
 *   display_range = [final_rate × 0.85, final_rate × 1.15]
 */

import {
  followerTiers,
  nicheMultipliers,
  engagementBrackets,
  deliverables,
  cityTierAdjustments,
  type FollowerTier,
  type Deliverable,
} from './rate-config';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CalculationInput {
  platforms: ('instagram' | 'youtube' | 'facebook')[];
  followersInstagram?: number;
  followersYoutube?: number;
  followersFacebook?: number;
  niche: string;
  cityTier: 'tier_1' | 'tier_2' | 'tier_3';
  engagementRate?: number | null; // null or undefined = pending review
}

export interface RateResult {
  platform: 'instagram' | 'youtube' | 'facebook';
  deliverableKey: string;
  deliverableLabel: string;
  rateMin: number;
  rateMax: number;
  rateMedian: number;
  suggestedQuote: number; // top of range
  isCustomQuote: boolean; // true for Mega tier with no max
  followerTierName: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getFollowerTier(followers: number): FollowerTier | null {
  // Handle below minimum threshold
  if (followers < 1_000) return null;

  for (const tier of followerTiers) {
    const inRange =
      followers >= tier.minFollowers &&
      (tier.maxFollowers === null || followers < tier.maxFollowers);
    if (inRange) return tier;
  }

  // Fallback to Mega for any edge case above 1M
  return followerTiers[followerTiers.length - 1];
}

function getEngagementAdjustment(engagementRate?: number | null): number {
  // Not available / pending review → 0% adjustment (use baseline)
  if (engagementRate === null || engagementRate === undefined) return 0;

  for (const bracket of engagementBrackets) {
    const inBracket =
      engagementRate >= bracket.minRate &&
      (bracket.maxRate === null || engagementRate < bracket.maxRate);
    if (inBracket) return bracket.adjustment;
  }

  // Edge case: exactly at a boundary — default to 0
  return 0;
}

function getFollowersForPlatform(
  platform: string,
  input: CalculationInput
): number {
  switch (platform) {
    case 'instagram':
      return input.followersInstagram ?? 0;
    case 'youtube':
      return input.followersYoutube ?? 0;
    case 'facebook':
      return input.followersFacebook ?? 0;
    default:
      return 0;
  }
}

// ──────────────────────────────────────────────
// Main Calculation
// ──────────────────────────────────────────────

export function calculateRates(input: CalculationInput): RateResult[] {
  const results: RateResult[] = [];

  const nicheMultiplier = nicheMultipliers[input.niche] ?? 1.0;
  const engagementAdj = getEngagementAdjustment(input.engagementRate);
  const cityAdj = cityTierAdjustments[input.cityTier] ?? 0;

  for (const platform of input.platforms) {
    const followers = getFollowersForPlatform(platform, input);
    const tier = getFollowerTier(followers);

    if (!tier) continue; // Skip if below 1K followers

    // Get deliverables for this platform
    const platformDeliverables = deliverables.filter(
      (d) => d.platform === platform
    );

    for (const deliverable of platformDeliverables) {
      const isCustomQuote = tier.baseMax === null;

      if (isCustomQuote) {
        // Mega tier — show "Custom quote" with a floor estimate
        results.push({
          platform,
          deliverableKey: deliverable.key,
          deliverableLabel: deliverable.label,
          rateMin: Math.round(
            tier.baseMin *
              nicheMultiplier *
              (1 + engagementAdj) *
              deliverable.multiplierMin *
              (1 + cityAdj)
          ),
          rateMax: 0,
          rateMedian: 0,
          suggestedQuote: 0,
          isCustomQuote: true,
          followerTierName: tier.name,
        });
        continue;
      }

      // Standard calculation for non-Mega tiers
      const calcRate = (base: number, delMult: number) =>
        base * nicheMultiplier * (1 + engagementAdj) * delMult * (1 + cityAdj);

      // Use average of deliverable multiplier range
      const avgDelMult =
        (deliverable.multiplierMin + deliverable.multiplierMax) / 2;

      const rawMin = calcRate(tier.baseMin, avgDelMult);
      const rawMax = calcRate(tier.baseMax!, avgDelMult);
      const rawMedian = calcRate(tier.baseMedian, avgDelMult);

      // Apply display range spread (±15%)
      const displayMin = Math.round(rawMin * 0.85);
      const displayMax = Math.round(rawMax * 1.15);
      const displayMedian = Math.round(rawMedian);

      results.push({
        platform,
        deliverableKey: deliverable.key,
        deliverableLabel: deliverable.label,
        rateMin: displayMin,
        rateMax: displayMax,
        rateMedian: displayMedian,
        suggestedQuote: displayMax,
        isCustomQuote: false,
        followerTierName: tier.name,
      });
    }
  }

  return results;
}

/**
 * Format a rate value as INR currency string.
 */
export function formatINR(amount: number): string {
  if (amount === 0) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
