"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  calculateRates,
  applyPriceSelection,
  flattenForDatabase,
  type RateCardResult,
} from "@/lib/rate-engine";
import { PRICE_TIER_LABELS } from "@/lib/rate-config";
import type { Platform } from "@/lib/supabase/types";
import { createClient } from "@supabase/supabase-js";
import ScreenshotUploadModal from "./ScreenshotUploadModal";
import Navbar from "@/components/Navbar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface CalcData {
  profileId: string | null;
  platforms: Platform[];
  followersInstagram?: number;
  followersYoutube?: number;
  followersFacebook?: number;
  niche: string;
  cityTier: "tier_1" | "tier_2" | "tier_3";
  engagementRate?: number | null;
  creatorName: string;
  engagementSkipped: boolean;
  verificationTier: string;
  calculatedAt: string;
  avgViewsInstagram?: number | null;
  avgViewsYoutube?: number | null;
  avgViewsFacebook?: number | null;
  handleInstagram?: string | null;
  handleYoutube?: string | null;
  handleFacebook?: string | null;
  followingInstagram?: number | null;
  followingYoutube?: number | null;
  followingFacebook?: number | null;
  postsInstagram?: number | null;
  postsYoutube?: number | null;
  postsFacebook?: number | null;
  profilePicUrl?: string | null;
}

const DISCLAIMER = `These are benchmark estimates, not guaranteed prices. Your actual rate depends on content quality, audience trust, and brand budget. We suggest quoting near the top of this range to leave room for negotiation. Rates shown are pre-GST — if your annual brand-deal income exceeds ₹20 lakh, you must register for GST and add 18% on top of your quote. Bundled deals (multiple deliverables) typically get a 15–25% discount versus per-post pricing.`;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  youtube: "#FF0000",
  facebook: "#1877F2",
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter();
  const [calcData, setCalcData] = useState<CalcData | null>(null);
  const [results, setResults] = useState<RateCardResult[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selections, setSelections] = useState<
    Record<string, "contentFee" | "marketStandard" | "brandInvestment" | "custom">
  >({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [pdfGenerator, setPdfGenerator] = useState<any>(null);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [isFetchingPosts, setIsFetchingPosts] = useState(false);
  const [postsFetched, setPostsFetched] = useState(false);

  useEffect(() => {
    // Preload PDF generator component
    import("@/lib/pdf-generator").then((mod) => {
      setPdfGenerator(mod);
    });
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("mc_calc_input");
    if (!stored) {
      router.push("/calculate");
      return;
    }

    try {
      const data: CalcData = JSON.parse(stored);
      setCalcData(data);

      const input = {
        platforms: {
          instagram: data.platforms.includes("instagram") ? data.followersInstagram : undefined,
          youtube: data.platforms.includes("youtube") ? data.followersYoutube : undefined,
          facebook: data.platforms.includes("facebook") ? data.followersFacebook : undefined,
        },
        niche: data.niche,
        cityTier: data.cityTier,
        engagementRate: data.engagementRate,
        avgViewsInstagram: data.avgViewsInstagram ?? null,
        avgViewsYoutube: data.avgViewsYoutube ?? null,
        avgViewsFacebook: data.avgViewsFacebook ?? null,
      };

      const computed = calculateRates(input);
      setResults(computed);

      // Default all deliverables to marketStandard
      const defaults: Record<string, "contentFee" | "marketStandard" | "brandInvestment"> = {};
      computed.forEach((p) => {
        p.deliverables.forEach((d) => {
          defaults[d.id] = "marketStandard";
        });
      });
      setSelections(defaults);
    } catch (err) {
      console.error("Loader error:", err);
      router.push("/calculate");
    }
  }, [router]);

  const getVerificationBadge = useCallback(() => {
    if (!calcData) return null;
    if (calcData.engagementSkipped) {
      return (
        <span className="mc-badge mc-badge-yellow">⏳ Pending Manual Review</span>
      );
    }
    switch (calcData.verificationTier) {
      case "auto_fetched_public":
        return <span className="mc-badge mc-badge-teal">~ Public Data Match</span>;
      case "auto_fetched_youtube":
        return <span className="mc-badge mc-badge-youtube">~ YouTube Data Match</span>;
      case "screenshot_verified":
        return <span className="mc-badge mc-badge-indigo">✓ Screenshot Verified</span>;
      case "api_verified":
        return <span className="mc-badge mc-badge-green">✓ API Verified</span>;
      default:
        return <span className="mc-badge mc-badge-grey">○ Self-Reported</span>;
    }
  }, [calcData]);

  const handleFetchRecentPosts = async () => {
    if (!calcData) return;
    setIsFetchingPosts(true);
    try {
      let platformToFetch: "instagram" | "youtube" | "facebook" | null = null;
      let handleToFetch: string | null = null;

      if (calcData.platforms.includes("instagram") && calcData.handleInstagram) {
        platformToFetch = "instagram";
        handleToFetch = calcData.handleInstagram;
      } else if (calcData.platforms.includes("youtube") && calcData.handleYoutube) {
        platformToFetch = "youtube";
        handleToFetch = calcData.handleYoutube;
      } else if (calcData.platforms.includes("facebook") && calcData.handleFacebook) {
        platformToFetch = "facebook";
        handleToFetch = calcData.handleFacebook;
      }

      if (!platformToFetch || !handleToFetch) {
        alert("No handle available to fetch recent posts. Please update handles in calculator.");
        return;
      }

      const response = await fetch("/api/fetch-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformToFetch, handle: handleToFetch }),
      });
      const result = await response.json();
      if (result.success && result.posts) {
        setRecentPosts(result.posts);
        setPostsFetched(true);
      } else {
        alert("Could not fetch recent posts. Please check your API configuration.");
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      alert("An error occurred while fetching posts.");
    } finally {
      setIsFetchingPosts(false);
    }
  };

  const handleDownloadPdf = async (withMetrics = false) => {
    if (!calcData || !pdfGenerator) return;
    setIsGeneratingPdf(true);
    try {
      const resultsWithSelections = applyPriceSelection(results, selections, customPrices);

      // Trigger PDF download synchronously (Safari/mobile safe)
      pdfGenerator.generateRateCardPdf({
        creatorName: calcData.creatorName,
        niche: calcData.niche,
        cityTier: calcData.cityTier,
        verificationTier: calcData.verificationTier,
        results: resultsWithSelections,
        calculatedAt: calcData.calculatedAt,
        instagramHandle: calcData.handleInstagram,
        youtubeHandle: calcData.handleYoutube,
        facebookHandle: calcData.handleFacebook,
        followingInstagram: calcData.followingInstagram,
        followingYoutube: calcData.followingYoutube,
        followingFacebook: calcData.followingFacebook,
        postsInstagram: calcData.postsInstagram,
        postsYoutube: calcData.postsYoutube,
        postsFacebook: calcData.postsFacebook,
        profilePicUrl: calcData.profilePicUrl,
        recentPosts: withMetrics ? recentPosts : undefined,
      });

      // Save to database in background
      let profileId = calcData.profileId;
      if (!profileId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("creator_profiles")
            .select("id")
            .eq("user_id", session.user.id)
            .single();
          if (profile) {
            profileId = profile.id;
          }
        }
      }

      if (profileId) {
        const rows = flattenForDatabase(profileId, resultsWithSelections);
        supabase.from("rate_cards").upsert(rows).then(({ error }) => {
          if (error) console.error("Database save error:", error);
        });
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF generation failed. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!calcData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-[--mc-primary]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-[--mc-text-secondary]">Loading results...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-10 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #6C5CE7, transparent)" }}
        />
        <div
          className="absolute bottom-20 right-10 w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #00D2D3, transparent)" }}
        />
      </div>

      {/* Nav */}
      <Navbar />

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in opacity-0">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Your{" "}
            <span className="bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent">
              Rate Card
            </span>
          </h1>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-lg font-semibold">{calcData.creatorName}</span>
            {getVerificationBadge()}
          </div>
          <p className="text-sm text-[--mc-text-muted]">
            Last calculated on{" "}
            {new Date(calcData.calculatedAt).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Global Reset / Presets Header */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between animate-fade-in-up opacity-0 delay-100">
          <h2 className="text-lg font-semibold text-[--mc-text-primary]">
            Customize Deliverables Rates
          </h2>
          <button
            onClick={() => {
              setSelections((prev) => {
                const next = { ...prev };
                results.forEach((p) => {
                  p.deliverables.forEach((d) => {
                    next[d.id] = "marketStandard";
                  });
                });
                return next;
              });
            }}
            className="text-xs mc-btn mc-btn-secondary mc-btn-sm"
          >
            Apply Market Standard to All
          </button>
        </div>

        {/* Rate Tables by Platform */}
        <div className="space-y-8 animate-fade-in-up opacity-0 delay-200">
          {calcData.platforms.map((platform) => {
            const platformData = results.find((r) => r.platform === platform);
            if (!platformData) return null;

            return (
              <div key={platform} className="mc-card overflow-hidden">
                {/* Platform header */}
                <div
                  className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[--mc-border]"
                  style={{
                    background: `linear-gradient(135deg, ${PLATFORM_COLORS[platform]}15, transparent)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {platform === "instagram"
                        ? "📸"
                        : platform === "youtube"
                        ? "🎬"
                        : "📘"}
                    </span>
                    <h2
                      className="text-lg font-semibold"
                      style={{ color: PLATFORM_COLORS[platform] }}
                    >
                      {PLATFORM_LABELS[platform]}
                    </h2>
                    <span className="text-sm text-[--mc-text-muted]">
                      ({(platform === "instagram" ? calcData.followersInstagram : platform === "youtube" ? calcData.followersYoutube : calcData.followersFacebook)?.toLocaleString("en-IN") || "0"} followers)
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelections((prev) => {
                        const next = { ...prev };
                        platformData.deliverables.forEach((d) => {
                          next[d.id] = "marketStandard";
                        });
                        return next;
                      });
                    }}
                    className="text-xs mc-btn mc-btn-secondary mc-btn-sm"
                  >
                    Reset Platform to Standard
                  </button>
                </div>

                {/* Deliverables lists */}
                <div className="p-4 sm:p-6 space-y-8">
                  {platformData.deliverables.map((d) => {
                    const currentSelection = selections[d.id] || "marketStandard";

                    return (
                      <div key={d.id} className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left">
                          <h3 className="font-semibold text-base text-[--mc-text-primary]">
                            {d.label}
                          </h3>
                          <span className="text-xs text-[--mc-text-muted]">
                            Select price tier:
                          </span>
                        </div>

                        {/* Three Price Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            {
                              tier: "contentFee" as const,
                              label: "Content Fee",
                              desc: "Production Floor",
                              price: d.contentFee,
                              activeClass: "border-amber-500 bg-amber-500/10 text-amber-400",
                            },
                            {
                              tier: "marketStandard" as const,
                              label: "Market Standard",
                              desc: "Baseline CPM",
                              price: d.marketStandard,
                              activeClass: "border-indigo-500 bg-indigo-500/10 text-indigo-400",
                            },
                            {
                              tier: "brandInvestment" as const,
                              label: "Brand Investment",
                              desc: "Premium CPM",
                              price: d.brandInvestment,
                              activeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-400",
                            },
                          ].map((tierOption) => {
                            const isSelected = currentSelection === tierOption.tier;
                            return (
                              <button
                                key={tierOption.tier}
                                onClick={() => {
                                  setSelections((prev) => ({
                                    ...prev,
                                    [d.id]: tierOption.tier,
                                  }));
                                  setCustomPrices((prev) => {
                                    const next = { ...prev };
                                    delete next[d.id];
                                    return next;
                                  });
                                }}
                                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? tierOption.activeClass
                                    : "border-[--mc-border] bg-[--mc-bg-secondary] hover:bg-[--mc-bg-elevated]"
                                }`}
                              >
                                <div className="text-xs font-semibold uppercase tracking-wider text-[--mc-text-muted] mb-1">
                                  {tierOption.label}
                                </div>
                                <div className="text-lg font-bold">
                                  ₹{tierOption.price.toLocaleString("en-IN")}
                                </div>
                                <div className="text-[10px] text-[--mc-text-secondary] mt-1">
                                  {tierOption.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Price Overrides Input */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 pl-1 text-left">
                          <label htmlFor={`custom-price-${d.id}`} className="text-xs font-medium text-[--mc-text-secondary] whitespace-nowrap">
                            Or enter custom price:
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative max-w-[160px]">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[--mc-text-muted]">₹</span>
                              <input
                                id={`custom-price-${d.id}`}
                                type="number"
                                placeholder="Custom rate"
                                className="mc-input text-xs py-1.5 pl-6 pr-2.5 h-auto bg-[--mc-bg-primary] max-h-8"
                                value={customPrices[d.id] || ""}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val) && val > 0) {
                                    setCustomPrices((prev) => ({ ...prev, [d.id]: val }));
                                    setSelections((prev) => ({ ...prev, [d.id]: "custom" }));
                                  } else {
                                    setCustomPrices((prev) => {
                                      const next = { ...prev };
                                      delete next[d.id];
                                      return next;
                                    });
                                    setSelections((prev) => ({ ...prev, [d.id]: "marketStandard" }));
                                  }
                                }}
                              />
                            </div>
                            {currentSelection === "custom" && (
                              <span className="text-[10px] text-[--mc-warning] font-semibold flex items-center gap-1 animate-fade-in">
                                ⚡ Edited by Creator
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-6 mt-10 animate-fade-in-up opacity-0 delay-300">
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-2xl">
            {postsFetched ? (
              <>
                <button
                  onClick={() => handleDownloadPdf(false)}
                  disabled={isGeneratingPdf}
                  className="mc-btn mc-btn-secondary mc-btn-lg flex-1 cursor-pointer"
                >
                  📄 Download PDF (Standard)
                </button>
                <button
                  onClick={() => handleDownloadPdf(true)}
                  disabled={isGeneratingPdf}
                  className="mc-btn mc-btn-primary mc-btn-lg flex-1 cursor-pointer bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] border-none text-white font-semibold shadow-md"
                >
                  📊 Download PDF (With Metrics)
                </button>
              </>
            ) : (
              <>
                <button
                  id="download-pdf"
                  onClick={() => handleDownloadPdf(false)}
                  disabled={isGeneratingPdf}
                  className="mc-btn mc-btn-primary mc-btn-lg flex-1 cursor-pointer"
                >
                  {isGeneratingPdf ? "Generating PDF..." : "📄 Download Rate Card PDF"}
                </button>
                {(calcData?.handleInstagram || calcData?.handleYoutube || calcData?.handleFacebook) && (
                  <button
                    onClick={handleFetchRecentPosts}
                    disabled={isFetchingPosts}
                    className="mc-btn mc-btn-secondary mc-btn-lg flex-1 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isFetchingPosts ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Fetching Metrics...
                      </span>
                    ) : (
                      <>📊 Fetch Recent Posts</>
                    )}
                  </button>
                )}
              </>
            )}
            <a href="/calculate" className="mc-btn mc-btn-secondary mc-btn-lg cursor-pointer">
              🔄 Recalculate
            </a>
          </div>

          {/* Fetched Posts Preview */}
          {postsFetched && recentPosts.length > 0 && (
            <div className="w-full max-w-2xl mc-card p-6 animate-fade-in space-y-4">
              <h4 className="font-semibold text-sm text-[--mc-text-primary] border-b border-[--mc-border] pb-2 text-left">
                Recent Posts Metrics (Fetched Successfully)
              </h4>
              <div className="space-y-3">
                {recentPosts.map((post, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-[--mc-bg-secondary]">
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-medium text-[--mc-text-primary] truncate">{post.title}</p>
                      <p className="text-[10px] text-[--mc-text-muted]">{post.date}</p>
                    </div>
                    <div className="flex gap-4 text-xs font-semibold flex-shrink-0">
                      <span className="text-indigo-400">❤️ {post.likes.toLocaleString()}</span>
                      <span className="text-teal-400">💬 {post.comments.toLocaleString()}</span>
                      {post.views !== null && <span className="text-amber-400">👁️ {post.views.toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upload Screenshot CTA */}
        <div className="mt-8 mc-card p-6 text-center animate-fade-in-up opacity-0 delay-400">
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl">📷</span>
            <h3 className="font-semibold">Boost your credibility</h3>
            <p className="text-sm text-[--mc-text-secondary] max-w-md">
              Upload an engagement rate screenshot to earn a{" "}
              <span className="mc-badge mc-badge-blue">✓ Verified</span> badge on
              your rate card.
            </p>
            <button
              id="upload-screenshot"
              className="mc-btn mc-btn-secondary mc-btn-sm mt-2"
              onClick={() => setShowUploadModal(true)}
            >
              Upload Screenshot
            </button>
          </div>
        </div>

        {/* Screenshot Upload Modal */}
        {showUploadModal && (
          <ScreenshotUploadModal
            profileId={calcData.profileId}
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => {
              setShowUploadModal(false);
              // Update verification tier in local state
              setCalcData((prev) =>
                prev
                  ? { ...prev, verificationTier: "screenshot_verified" }
                  : prev
              );
              // Also update sessionStorage so it persists
              const stored = sessionStorage.getItem("mc_calc_input");
              if (stored) {
                const parsed = JSON.parse(stored);
                parsed.verificationTier = "screenshot_verified";
                sessionStorage.setItem("mc_calc_input", JSON.stringify(parsed));
              }
            }}
          />
        )}

        {/* Disclaimer */}
        <div className="mt-10 glass p-6 rounded-xl animate-fade-in opacity-0 delay-500">
          <h3 className="text-sm font-semibold text-[--mc-text-secondary] mb-3 flex items-center gap-2">
            ⚠️ Important Disclaimer
          </h3>
          <p className="text-sm text-[--mc-text-muted] leading-relaxed">
            {DISCLAIMER}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[--mc-border] mt-16">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xs text-[--mc-text-muted]">
            Generated via moneycaption.com
          </span>
          <span className="text-xs text-[--mc-text-muted]">
            © {new Date().getFullYear()} MoneyCaption
          </span>
        </div>
      </footer>
    </div>
  );
}
