/**
 * PDF Rate Card Generator using @react-pdf/renderer.
 *
 * Dynamically imported on the client to avoid SSR issues.
 * Generates a branded, downloadable PDF rate card with v2 selected prices.
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

const isBrowser = typeof window !== 'undefined';
const regularFontUrl = isBrowser ? `${window.location.origin}/fonts/NotoSans-Regular.ttf` : 'https://github.com/notofonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
const boldFontUrl = isBrowser ? `${window.location.origin}/fonts/NotoSans-Bold.ttf` : 'https://github.com/notofonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: regularFontUrl, fontWeight: 'normal' },
    { src: boldFontUrl, fontWeight: 'bold' },
  ],
});

// Disable hyphenation
Font.registerHyphenationCallback((word) => [word]);

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PdfInput {
  creatorName: string;
  niche: string;
  cityTier: string;
  verificationTier: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[]; // RateCardResult[]
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
    fontFamily: "NotoSans",
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
    fontWeight: "bold",
    color: colors.primary,
    fontFamily: "NotoSans",
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    color: colors.textSecondary,
    fontFamily: "NotoSans",
  },
  creatorSection: {
    marginBottom: 24,
  },
  creatorName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 6,
    color: colors.text,
    fontFamily: "NotoSans",
  },
  creatorMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: "NotoSans",
  },
  // Platform header row — icon + name in flex row (Step 6)
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
    width: 24,
    fontWeight: "bold",
    color: colors.accent,
    fontFamily: "NotoSans",
  },
  platformName: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.primary,
    fontFamily: "NotoSans",
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
    fontWeight: "bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "NotoSans",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  col1: { width: "60%" },
  col2: { width: "40%" },
  cellText: {
    fontSize: 10,
    color: colors.text,
    fontFamily: "NotoSans",
  },
  selectedPrice: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.success,
    fontFamily: "NotoSans",
  },
  tierBadge: {
    fontSize: 7,
    color: colors.textSecondary,
    fontFamily: "NotoSans",
    marginTop: 1,
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
    fontFamily: "NotoSans",
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
    fontFamily: "NotoSans",
  },
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

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

const PLATFORM_LABELS: Record<string, { icon: string; name: string }> = {
  instagram: { icon: "IG", name: "Instagram" },
  youtube: { icon: "YT", name: "YouTube" },
  facebook: { icon: "FB", name: "Facebook" },
};

// ──────────────────────────────────────────────
// Document Builder
// ──────────────────────────────────────────────

function buildRateCardDocument(data: PdfInput) {
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
      // Rate tables per platform (Step 9 selected price logic)
      ...data.results.map((p) =>
        createElement(
          View,
          { key: p.platform },
          // Platform header row — icon + name in flex row
          createElement(
            View,
            { style: styles.platformHeaderRow },
            createElement(
              Text,
              { style: styles.platformIcon },
              PLATFORM_LABELS[p.platform]?.icon || p.platform.charAt(0).toUpperCase()
            ),
            createElement(
              Text,
              { style: styles.platformName },
              PLATFORM_LABELS[p.platform]?.name || p.platform
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
              { style: { ...styles.tableHeaderText, ...styles.col2, textAlign: "right" } },
              "Suggested Rate"
            )
          ),
          // Table rows
          ...p.deliverables.map((d: any) =>
            createElement(
              View,
              { key: d.id, style: styles.tableRow },
              createElement(
                Text,
                { style: { ...styles.cellText, ...styles.col1 } },
                d.label
              ),
              createElement(
                View,
                { style: { ...styles.col2, alignItems: "flex-end" } },
                createElement(
                  Text,
                  { style: styles.selectedPrice },
                  `\u20B9${(d.selectedPrice ?? d.marketStandard).toLocaleString("en-IN")}`
                ),
                createElement(
                  Text,
                  { style: styles.tierBadge },
                  d.selectedTier === "contentFee"
                    ? "Content Fee"
                    : d.selectedTier === "brandInvestment"
                    ? "Brand Investment"
                    : "Market Standard"
                )
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
