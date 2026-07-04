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
    Record<string, "contentFee" | "marketStandard" | "brandInvestment">
  >({});

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

  const handleDownloadPdf = async () => {
    if (!calcData) return;
    setIsGeneratingPdf(true);
    try {
      const resultsWithSelections = applyPriceSelection(results, selections);

      // Save to database
      if (calcData.profileId) {
        try {
          const rows = flattenForDatabase(calcData.profileId, resultsWithSelections);
          await supabase.from("rate_cards").upsert(rows);
        } catch (dbErr) {
          console.error("Failed to save rate cards to database:", dbErr);
        }
      }

      // Dynamic import to avoid SSR issues with @react-pdf/renderer
      const { generateRateCardPdf } = await import("@/lib/pdf-generator");
      await generateRateCardPdf({
        creatorName: calcData.creatorName,
        niche: calcData.niche,
        cityTier: calcData.cityTier,
        verificationTier: calcData.verificationTier,
        results: resultsWithSelections,
        calculatedAt: calcData.calculatedAt,
      });
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
      <nav className="glass sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-white font-bold text-xs group-hover:scale-110 transition-transform">
              M
            </div>
            <span className="text-base font-bold bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent">
              MoneyCaption
            </span>
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/calculate"
              className="text-sm font-medium text-[--mc-text-secondary] hover:text-white transition-colors"
            >
              ← Recalculate
            </a>
          </div>
        </div>
      </nav>

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
        <div className="mb-6 flex items-center justify-between animate-fade-in-up opacity-0 delay-100">
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
                  className="px-6 py-4 flex items-center justify-between border-b border-[--mc-border]"
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
                <div className="p-6 space-y-8">
                  {platformData.deliverables.map((d) => {
                    const currentSelection = selections[d.id] || "marketStandard";

                    return (
                      <div key={d.id} className="space-y-3">
                        <div className="flex items-center justify-between">
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
                                onClick={() =>
                                  setSelections((prev) => ({
                                    ...prev,
                                    [d.id]: tierOption.tier,
                                  }))
                                }
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
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10 animate-fade-in-up opacity-0 delay-300">
          <button
            id="download-pdf"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="mc-btn mc-btn-primary mc-btn-lg"
          >
            {isGeneratingPdf ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating PDF...
              </span>
            ) : (
              <>
                📄 Download Rate Card PDF
              </>
            )}
          </button>
          <a href="/calculate" className="mc-btn mc-btn-secondary mc-btn-lg">
            🔄 Recalculate
          </a>
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
