"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  calculateRates,
  formatINR,
  type CalculationInput,
  type RateResult,
} from "@/lib/rate-engine";
import type { Platform } from "@/lib/supabase/types";
import ScreenshotUploadModal from "./ScreenshotUploadModal";

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
  const [results, setResults] = useState<RateResult[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("mc_calc_input");
    if (!stored) {
      router.push("/calculate");
      return;
    }

    try {
      const data: CalcData = JSON.parse(stored);
      setCalcData(data);

      const input: CalculationInput = {
        platforms: data.platforms,
        followersInstagram: data.followersInstagram,
        followersYoutube: data.followersYoutube,
        followersFacebook: data.followersFacebook,
        niche: data.niche,
        cityTier: data.cityTier,
        engagementRate: data.engagementRate,
      };

      const computed = calculateRates(input);
      setResults(computed);
    } catch {
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
    setIsGeneratingPdf(true);
    try {
      // Dynamic import to avoid SSR issues with @react-pdf/renderer
      const { generateRateCardPdf } = await import("@/lib/pdf-generator");
      await generateRateCardPdf({
        creatorName: calcData!.creatorName,
        niche: calcData!.niche,
        cityTier: calcData!.cityTier,
        verificationTier: calcData!.verificationTier,
        results,
        calculatedAt: calcData!.calculatedAt,
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

  // Group results by platform
  const resultsByPlatform = calcData.platforms.reduce((acc, platform) => {
    acc[platform] = results.filter((r) => r.platform === platform);
    return acc;
  }, {} as Record<string, RateResult[]>);

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

        {/* Rate Tables by Platform */}
        <div className="space-y-8 animate-fade-in-up opacity-0 delay-200">
          {calcData.platforms.map((platform) => {
            const platformResults = resultsByPlatform[platform] || [];
            if (platformResults.length === 0) return null;

            return (
              <div key={platform} className="mc-card overflow-hidden">
                {/* Platform header */}
                <div
                  className="px-6 py-4 flex items-center gap-3 border-b border-[--mc-border]"
                  style={{
                    background: `linear-gradient(135deg, ${PLATFORM_COLORS[platform]}15, transparent)`,
                  }}
                >
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
                    ({platformResults[0]?.followerTierName} tier)
                  </span>
                </div>

                {/* Rate table */}
                <div className="overflow-x-auto">
                  <table className="mc-table">
                    <thead>
                      <tr>
                        <th>Deliverable</th>
                        <th>Rate Range (₹)</th>
                        <th>Suggested Quote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformResults.map((r) => (
                        <tr key={r.deliverableKey}>
                          <td className="font-medium">{r.deliverableLabel}</td>
                          <td>
                            {r.isCustomQuote ? (
                              <span className="text-[--mc-accent]">
                                {formatINR(r.rateMin)}+ (Custom Quote)
                              </span>
                            ) : (
                              <span>
                                {formatINR(r.rateMin)} – {formatINR(r.rateMax)}
                              </span>
                            )}
                          </td>
                          <td>
                            {r.isCustomQuote ? (
                              <span className="mc-badge mc-badge-yellow">
                                Contact for quote
                              </span>
                            ) : (
                              <span className="font-semibold text-[--mc-success]">
                                {formatINR(r.suggestedQuote)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
