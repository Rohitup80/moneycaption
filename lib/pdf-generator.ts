/**
 * PDF Rate Card Generator using @react-pdf/renderer.
 *
 * Dynamically imported on the client to avoid SSR issues.
 * Generates a branded, downloadable PDF rate card.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import { createElement } from "react";
import type { RateResult } from "./rate-engine";

// ──────────────────────────────────────────────
// Font Registration (A3 fix — Noto Sans supports ₹)
// ──────────────────────────────────────────────

Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf",
      fontWeight: 700,
    },
  ],
});

// Disable hyphenation (causes issues with currency symbols)
Font.registerHyphenationCallback((word) => [word]);

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PdfInput {
  creatorName: string;
  niche: string;
  cityTier: string;
  verificationTier: string;
  results: RateResult[];
  calculatedAt: string;
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const colors = {
  primary: "#6C5CE7",
  accent: "#00D2D3",
  bg: "#0F1123",
  bgCard: "#1A1D35",
  text: "#F0F0F5",
  textSecondary: "#9CA3AF",
  border: "#2A2D45",
  success: "#10B981",
  warning: "#F59E0B",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.bg,
    padding: 40,
    fontFamily: "Roboto",
    color: colors.text,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.primary,
    fontFamily: "Roboto",
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    color: colors.textSecondary,
    fontFamily: "Roboto",
  },
  creatorSection: {
    marginBottom: 24,
  },
  creatorName: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 6,
    color: colors.text,
    fontFamily: "Roboto",
  },
  creatorMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: "Roboto",
  },
  // A4 fix — platform header is now a flex row with gap, not a single Text
  platformHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  platformIcon: {
    fontSize: 14,
    width: 20,
    fontFamily: "Roboto",
  },
  platformName: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.primary,
    fontFamily: "Roboto",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "Roboto",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  col1: { width: "35%" },
  col2: { width: "35%" },
  col3: { width: "30%" },
  cellText: {
    fontSize: 10,
    color: colors.text,
    fontFamily: "Roboto",
  },
  suggestedQuote: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.success,
    fontFamily: "Roboto",
  },
  customQuote: {
    fontSize: 10,
    color: colors.warning,
    fontFamily: "Roboto",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 8,
    color: colors.textSecondary,
    fontFamily: "Roboto",
  },
  disclaimer: {
    marginTop: 30,
    padding: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 4,
  },
  disclaimerText: {
    fontSize: 7,
    color: colors.textSecondary,
    lineHeight: 1.5,
    fontFamily: "Roboto",
  },
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatINR(amount: number): string {
  if (amount === 0) return "—";
  // Use INR formatting with the actual ₹ symbol
  return `\u20B9${amount.toLocaleString("en-IN")}`;
}

function getCityTierLabel(tier: string): string {
  return tier.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getVerificationLabel(tier: string): string {
  switch (tier) {
    case "auto_fetched_public":
      return "~ Public Data Match";
    case "auto_fetched_youtube":
      return "~ YouTube Data Match";
    case "screenshot_verified":
      return "✓ Screenshot Verified";
    case "api_verified":
      return "✓ API Verified";
    default:
      return "○ Self-Reported";
  }
}

// A4 fix — use text labels instead of emoji for PDF (emoji renders poorly in PDF fonts)
const PLATFORM_LABELS: Record<string, { icon: string; name: string }> = {
  instagram: { icon: "IG", name: "Instagram" },
  youtube: { icon: "YT", name: "YouTube" },
  facebook: { icon: "FB", name: "Facebook" },
};

// ──────────────────────────────────────────────
// Document Builder
// ──────────────────────────────────────────────

function buildRateCardDocument(data: PdfInput) {
  const resultsByPlatform = data.results.reduce((acc, r) => {
    if (!acc[r.platform]) acc[r.platform] = [];
    acc[r.platform].push(r);
    return acc;
  }, {} as Record<string, RateResult[]>);

  const formattedDate = new Date(data.calculatedAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(Text, { style: styles.logoText }, "MoneyCaption"),
        createElement(
          Text,
          { style: styles.badge },
          getVerificationLabel(data.verificationTier)
        )
      ),
      // Creator section
      createElement(
        View,
        { style: styles.creatorSection },
        createElement(Text, { style: styles.creatorName }, data.creatorName),
        createElement(
          Text,
          { style: styles.creatorMeta },
          `${data.niche}  |  ${getCityTierLabel(data.cityTier)}  |  Generated ${formattedDate}`
        )
      ),
      // Rate tables per platform (A4 fix — icon and name in separate Text elements)
      ...Object.entries(resultsByPlatform).map(([platform, platformResults]) =>
        createElement(
          View,
          { key: platform },
          // Platform header row — icon + name in flex row (A4 fix)
          createElement(
            View,
            { style: styles.platformHeaderRow },
            createElement(
              Text,
              { style: styles.platformIcon },
              PLATFORM_LABELS[platform]?.icon || platform.charAt(0).toUpperCase()
            ),
            createElement(
              Text,
              { style: styles.platformName },
              PLATFORM_LABELS[platform]?.name || platform
            )
          ),
          // Table header
          createElement(
            View,
            { style: styles.tableHeader },
            createElement(
              Text,
              { style: { ...styles.tableHeaderText, ...styles.col1 } },
              "Deliverable"
            ),
            createElement(
              Text,
              { style: { ...styles.tableHeaderText, ...styles.col2 } },
              "Rate Range"
            ),
            createElement(
              Text,
              { style: { ...styles.tableHeaderText, ...styles.col3 } },
              "Suggested Quote"
            )
          ),
          // Table rows
          ...platformResults.map((r) =>
            createElement(
              View,
              { key: r.deliverableKey, style: styles.tableRow },
              createElement(
                Text,
                { style: { ...styles.cellText, ...styles.col1 } },
                r.deliverableLabel
              ),
              createElement(
                Text,
                {
                  style: {
                    ...(r.isCustomQuote ? styles.customQuote : styles.cellText),
                    ...styles.col2,
                  },
                },
                r.isCustomQuote
                  ? `${formatINR(r.rateMin)}+ (Custom)`
                  : `${formatINR(r.rateMin)} – ${formatINR(r.rateMax)}`
              ),
              createElement(
                Text,
                {
                  style: {
                    ...(r.isCustomQuote
                      ? styles.customQuote
                      : styles.suggestedQuote),
                    ...styles.col3,
                  },
                },
                r.isCustomQuote ? "Contact for quote" : formatINR(r.suggestedQuote)
              )
            )
          )
        )
      ),
      // Disclaimer
      createElement(
        View,
        { style: styles.disclaimer },
        createElement(
          Text,
          { style: styles.disclaimerText },
          "These are benchmark estimates, not guaranteed prices. Your actual rate depends on content quality, audience trust, and brand budget. Rates shown are pre-GST. Bundled deals typically get a 15-25% discount."
        )
      ),
      // Footer
      createElement(
        View,
        { style: styles.footer },
        createElement(
          Text,
          { style: styles.footerText },
          `Generated via moneycaption.com — ${formattedDate}`
        ),
        createElement(
          Text,
          { style: styles.footerText },
          "© MoneyCaption"
        )
      )
    )
  );
}

// ──────────────────────────────────────────────
// PDF Generation & Download
// ──────────────────────────────────────────────

export async function generateRateCardPdf(data: PdfInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = buildRateCardDocument(data) as any;
  const blob = await pdf(doc).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.creatorName.replace(/\s+/g, "_")}_RateCard_MoneyCaption.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
