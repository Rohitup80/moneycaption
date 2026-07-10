"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { NICHE_MULTIPLIERS } from "@/lib/rate-config";

interface CreatorProfile {
  id: string;
  name: string;
  niche: string;
  city: string;
  city_tier: string;
  verification_tier: string;
  instagram_handle?: string | null;
  youtube_handle?: string | null;
  facebook_handle?: string | null;
  followers_instagram?: number | null;
  followers_youtube?: number | null;
  followers_facebook?: number | null;
  avg_views_instagram?: number | null;
  avg_views_youtube?: number | null;
  avg_views_facebook?: number | null;
  engagement_rate?: number | null;
  profile_pic_url?: string | null;
}

interface RateCard {
  id: string;
  creator_id: string;
  platform: string;
  deliverable_id: string;
  label: string;
  selected_price: number;
  selected_tier: "contentFee" | "marketStandard" | "brandInvestment" | "custom" | string;
}

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default function ShareRateCardPage({ params }: SharePageProps) {
  const resolvedParams = use(params);
  const profileId = resolvedParams.id;

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profileId) return;

    async function loadSharedCard() {
      try {
        setLoading(true);
        // 1. Fetch profile details
        const { data: profileData, error: pErr } = await supabase
          .from("creator_profiles")
          .select("*")
          .eq("id", profileId)
          .single();

        if (pErr || !profileData) {
          setError("Creator rate card not found or profile does not exist.");
          return;
        }

        setProfile(profileData);

        // 2. Fetch saved rate deliverables
        const { data: cardsData, error: cErr } = await supabase
          .from("rate_cards")
          .select("*")
          .eq("creator_id", profileId);

        if (cErr) {
          console.error("Failed to load cards:", cErr);
        } else {
          setCards(cardsData || []);
        }
      } catch (err) {
        console.error("Loader error:", err);
        setError("An unexpected error occurred while loading this rate card.");
      } finally {
        setLoading(false);
      }
    }

    loadSharedCard();
  }, [profileId]);

  const getVerificationBadge = (tier: string) => {
    switch (tier) {
      case "auto_fetched_public":
        return <span className="mc-badge mc-badge-teal bg-teal-500/10 text-teal-600 border border-teal-500/10">✓ Public Data Match</span>;
      case "auto_fetched_youtube":
        return <span className="mc-badge bg-red-500/10 text-red-600 border border-red-500/10">✓ YouTube Verified</span>;
      case "screenshot_verified":
        return <span className="mc-badge mc-badge-indigo bg-indigo-500/10 text-indigo-600 border border-indigo-500/10">✓ Screenshot Verified</span>;
      case "api_verified":
        return <span className="mc-badge mc-badge-green bg-emerald-500/10 text-emerald-600 border border-emerald-500/10">✓ API Verified</span>;
      default:
        return <span className="mc-badge mc-badge-grey bg-slate-500/10 text-slate-500 border border-slate-500/10">○ Self-Reported</span>;
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case "custom":
        return <span className="text-[10px] font-bold text-amber-600 bg-amber-500/15 py-0.5 px-2 rounded-full border border-amber-500/10">⚡ Edited by Creator</span>;
      case "contentFee":
        return <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 py-0.5 px-2 rounded-full">Content Fee</span>;
      case "brandInvestment":
        return <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 py-0.5 px-2 rounded-full">Brand Investment</span>;
      default:
        return <span className="text-[10px] font-bold text-indigo-600 bg-indigo-500/10 py-0.5 px-2 rounded-full">Market Standard</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--mc-bg-primary]">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-[--mc-primary]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-[--mc-text-secondary] font-medium">Loading rate card...</span>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[--mc-bg-primary] px-6 text-center">
        <div className="text-4xl mb-4">📭</div>
        <h2 className="text-xl font-bold text-[--mc-text-primary] mb-2">{error || "Rate Card Not Found"}</h2>
        <p className="text-sm text-[--mc-text-secondary] max-w-sm mb-6">
          This rate card link is invalid or may have been deleted by the creator.
        </p>
        <Link href="/" className="mc-btn mc-btn-primary mc-btn-sm">
          Return to MoneyCaption
        </Link>
      </div>
    );
  }

  // Group cards by platform
  const cardsByPlatform = cards.reduce<Record<string, RateCard[]>>((acc, card) => {
    if (!acc[card.platform]) acc[card.platform] = [];
    acc[card.platform].push(card);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[--mc-bg-primary] flex flex-col">
      {/* Branding Header */}
      <header className="glass sticky top-0 z-50 border-b border-[--mc-border] bg-white/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#06B6D4] flex items-center justify-center text-white font-bold text-sm group-hover:scale-105 transition-transform">
              M
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-[#6366F1] to-[#06B6D4] bg-clip-text text-transparent">
              MoneyCaption
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">
              🛡️ VERIFIED RATE ESTIMATE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        {/* Creator Intro Profile Card */}
        <div className="mc-card p-6 sm:p-8 space-y-6 relative overflow-hidden bg-white shadow-sm border border-[--mc-border]">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left">
            {profile.profile_pic_url ? (
              <img
                src={profile.profile_pic_url}
                alt={profile.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[--mc-primary-light]"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#06B6D4] flex items-center justify-center text-white text-3xl font-bold shadow-md">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="space-y-2 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-2xl font-bold text-[--mc-text-primary]">{profile.name}</h1>
                <div className="flex justify-center">
                  {getVerificationBadge(profile.verification_tier)}
                </div>
              </div>

              {/* Handles display */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-start text-sm text-[--mc-text-secondary] font-medium">
                {profile.instagram_handle && (
                  <span>📸 @{profile.instagram_handle.replace(/^@/, "")}</span>
                )}
                {profile.youtube_handle && (
                  <span>🎬 @{profile.youtube_handle.replace(/^@/, "")}</span>
                )}
                {profile.facebook_handle && (
                  <span>📘 @{profile.facebook_handle.replace(/^@/, "")}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-2">
                <span className="px-3 py-1 rounded-lg bg-[--mc-bg-secondary] text-xs font-semibold text-[--mc-text-secondary] border border-[--mc-border]">
                  Niche: {NICHE_MULTIPLIERS[profile.niche]?.label || profile.niche.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
                <span className="px-3 py-1 rounded-lg bg-[--mc-bg-secondary] text-xs font-semibold text-[--mc-text-secondary] border border-[--mc-border]">
                  📍 {profile.city || "India"} ({profile.city_tier?.replace("_", " ").toUpperCase()})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Saved Rate Cards Deliverables Section */}
        <div className="space-y-6">
          {Object.keys(cardsByPlatform).length > 0 ? (
            Object.entries(cardsByPlatform).map(([platform, items]) => (
              <div key={platform} className="mc-card overflow-hidden bg-white shadow-sm border border-[--mc-border]">
                <div className="px-6 py-4 border-b border-[--mc-border] flex items-center justify-between bg-slate-50">
                  <h3 className="font-bold text-base text-[--mc-text-primary] capitalize flex items-center gap-2">
                    <span>
                      {platform === "instagram" ? "📸" : platform === "youtube" ? "🎬" : "📘"}
                    </span>
                    {platform} Rates
                  </h3>
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1">
                    🛡️ Verified by MoneyCaption
                  </span>
                </div>

                <div className="divide-y divide-[--mc-border]">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 sm:p-6 flex items-center justify-between gap-4 text-left hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm sm:text-base text-[--mc-text-primary]">{item.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getTierLabel(item.selected_tier)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg sm:text-xl font-bold text-[--mc-primary-dark]">
                          ₹{item.selected_price.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[10px] text-[--mc-text-muted] mt-0.5">pre-GST rate estimate</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="mc-card p-12 text-center bg-white shadow-sm border border-[--mc-border]">
              <p className="text-sm text-[--mc-text-secondary]">
                This creator hasn't configured any specific rate card deliverables yet.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Share Page Branding Footer */}
      <footer className="py-8 border-t border-[--mc-border] bg-white text-center mt-12">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          <p className="text-xs text-[--mc-text-muted] max-w-md mx-auto leading-relaxed">
            Rate cards are generated using MoneyCaption's benchmark valuation engine for the Indian creator market. Rates shown are baseline estimates based on platform reach parameters.
          </p>
          <div className="mc-divider max-w-xs mx-auto my-2" />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="text-xs font-semibold text-[--mc-text-secondary]">Are you a content creator?</span>
            <Link href="/" className="mc-btn mc-btn-primary mc-btn-sm text-xs py-1.5 shadow-sm">
              Calculate Your Worth Free
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
