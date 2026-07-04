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
