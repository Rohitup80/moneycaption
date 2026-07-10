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
  Image,
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
  instagramHandle?: string | null;
  youtubeHandle?: string | null;
  facebookHandle?: string | null;
  followersInstagram?: number;
  followersYoutube?: number;
  followersFacebook?: number;
  followingInstagram?: number | null;
  followingYoutube?: number | null;
  followingFacebook?: number | null;
  postsInstagram?: number | null;
  postsYoutube?: number | null;
  postsFacebook?: number | null;
  profilePicUrl?: string | null;
  recentPosts?: any[]; // FetchedPost[]
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
  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent,
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
  statsRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statBox: {
    flexDirection: "column",
  },
  statLabel: {
    fontSize: 7,
    color: colors.textSecondary,
    textTransform: "uppercase",
    fontFamily: "NotoSans",
  },
  statValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.text,
    fontFamily: "NotoSans",
    marginTop: 2,
  },
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
  metricsSection: {
    marginTop: 24,
    paddingTop: 12,
  },
  metricsSectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.accent,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
    fontFamily: "NotoSans",
  },
  postRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
    borderRadius: 4,
    marginBottom: 4,
  },
  postImage: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginRight: 10,
  },
  postInfo: {
    flex: 1,
    flexDirection: "column",
  },
  postTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.text,
    fontFamily: "NotoSans",
  },
  postDate: {
    fontSize: 7,
    color: colors.textSecondary,
    fontFamily: "NotoSans",
    marginTop: 1,
  },
  postMetrics: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "flex-end",
  },
  postMetricItem: {
    fontSize: 8,
    fontWeight: "bold",
    fontFamily: "NotoSans",
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
    marginTop: 24,
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

  const primaryHandle = data.instagramHandle
    ? `@${data.instagramHandle.replace(/^@/, "")}`
    : data.youtubeHandle
    ? `@${data.youtubeHandle.replace(/^@/, "")}`
    : data.facebookHandle
    ? `@${data.facebookHandle.replace(/^@/, "")}`
    : "";

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
        createElement(
          View,
          null,
          createElement(Text, { style: styles.logoText }, "MoneyCaption"),
          createElement(
            Text,
            { style: { ...styles.badge, marginTop: 4 } },
            getVerificationLabel(data.verificationTier)
          )
        ),
        (data.profilePicUrl || primaryHandle) && createElement(
          View,
          { style: styles.avatarContainer },
          createElement(
            View,
            { style: { alignItems: "flex-end" } },
            createElement(
              Text,
              { style: { fontSize: 10, fontWeight: "bold", color: colors.text } },
              data.creatorName
            ),
            primaryHandle ? createElement(
              Text,
              { style: { fontSize: 8, color: colors.accent, marginTop: 1 } },
              primaryHandle
            ) : null
          ),
          data.profilePicUrl ? createElement(
            Image,
            {
              src: typeof window !== "undefined"
                ? `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(data.profilePicUrl)}`
                : data.profilePicUrl,
              style: styles.avatar
            }
          ) : null
        )
      ),
      // Creator info & stats section
      createElement(
        View,
        { style: styles.creatorSection },
        createElement(
          Text,
          { style: styles.creatorMeta },
          `${data.niche.toUpperCase().replace(/_/g, " ")}  |  ${getCityTierLabel(data.cityTier)}  |  Generated ${formattedDate}`
        ),
        (data.instagramHandle || data.youtubeHandle || data.facebookHandle) && createElement(
          View,
          { style: { flexDirection: "row", gap: 12, marginTop: 6 } },
          data.instagramHandle ? createElement(
            Text,
            { style: { fontSize: 8, color: colors.textSecondary } },
            `IG: @${data.instagramHandle.replace(/^@/, "")}`
          ) : null,
          data.youtubeHandle ? createElement(
            Text,
            { style: { fontSize: 8, color: colors.textSecondary } },
            `YT: @${data.youtubeHandle.replace(/^@/, "")}`
          ) : null,
          data.facebookHandle ? createElement(
            Text,
            { style: { fontSize: 8, color: colors.textSecondary } },
            `FB: @${data.facebookHandle.replace(/^@/, "")}`
          ) : null
        ),
        // Followers / Following / Posts counts box
        (data.followingInstagram || data.followingYoutube || data.followingFacebook ||
         data.postsInstagram || data.postsYoutube || data.postsFacebook ||
         data.followersInstagram || data.followersYoutube || data.followersFacebook) ? createElement(
          View,
          { style: styles.statsRow },
          createElement(
            View,
            { style: styles.statBox },
            createElement(Text, { style: styles.statLabel }, "Audience (Followers)"),
            createElement(
              Text,
              { style: styles.statValue },
              [
                data.followersInstagram ? `${data.followersInstagram.toLocaleString("en-IN")} (IG)` : "",
                data.followersYoutube ? `${data.followersYoutube.toLocaleString("en-IN")} (YT)` : "",
                data.followersFacebook ? `${data.followersFacebook.toLocaleString("en-IN")} (FB)` : "",
              ].filter(Boolean).join("  |  ")
            )
          ),
          (data.followingInstagram || data.followingYoutube || data.followingFacebook) ? createElement(
            View,
            { style: styles.statBox },
            createElement(Text, { style: styles.statLabel }, "Following"),
            createElement(
              Text,
              { style: styles.statValue },
              [
                data.followingInstagram ? `${data.followingInstagram.toLocaleString("en-IN")} (IG)` : "",
                data.followingYoutube ? `${data.followingYoutube.toLocaleString("en-IN")} (YT)` : "",
                data.followingFacebook ? `${data.followingFacebook.toLocaleString("en-IN")} (FB)` : "",
              ].filter(Boolean).join("  |  ")
            )
          ) : null,
          (data.postsInstagram || data.postsYoutube || data.postsFacebook) ? createElement(
            View,
            { style: styles.statBox },
            createElement(Text, { style: styles.statLabel }, "Content Count (Posts)"),
            createElement(
              Text,
              { style: styles.statValue },
              [
                data.postsInstagram ? `${data.postsInstagram.toLocaleString("en-IN")} (IG)` : "",
                data.postsYoutube ? `${data.postsYoutube.toLocaleString("en-IN")} (YT)` : "",
                data.postsFacebook ? `${data.postsFacebook.toLocaleString("en-IN")} (FB)` : "",
              ].filter(Boolean).join("  |  ")
            )
          ) : null
        ) : null
      ),
      // Rate tables per platform
      ...data.results.map((p) =>
        createElement(
          View,
          { key: p.platform },
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
                  { style: { ...styles.tierBadge, color: d.selectedTier === "custom" ? colors.warning : colors.textSecondary } },
                  d.selectedTier === "custom"
                    ? "Edited by Creator"
                    : d.selectedTier === "contentFee"
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
      // Optional Recent Post Metrics Section
      data.recentPosts && data.recentPosts.length > 0 ? createElement(
        View,
        { style: styles.metricsSection, wrap: false },
        createElement(Text, { style: styles.metricsSectionTitle }, "Recent Content Performance (Last 5 Posts)"),
        ...data.recentPosts.map((post: any, idx: number) =>
          createElement(
            View,
            { key: idx, style: styles.postRow },
            post.imageUrl ? createElement(
              Image,
              {
                src: typeof window !== "undefined"
                  ? `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(post.imageUrl)}`
                  : post.imageUrl,
                style: styles.postImage
              }
            ) : null,
            createElement(
              View,
              { style: styles.postInfo },
              createElement(Text, { style: styles.postTitle }, post.title),
              createElement(Text, { style: styles.postDate }, post.date)
            ),
            createElement(
              View,
              { style: styles.postMetrics },
              createElement(
                Text,
                { style: { ...styles.postMetricItem, color: colors.primary } },
                `Likes: ${post.likes.toLocaleString("en-IN")}`
              ),
              createElement(
                Text,
                { style: { ...styles.postMetricItem, color: colors.accent } },
                `Comments: ${post.comments.toLocaleString("en-IN")}`
              ),
              post.views !== null ? createElement(
                Text,
                { style: { ...styles.postMetricItem, color: colors.warning } },
                `Views: ${post.views.toLocaleString("en-IN")}`
              ) : null
            )
          )
        )
      ) : null,
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
        { style: styles.footer, fixed: true },
        createElement(
          Text,
          { style: styles.footerText },
          `Verified & Generated via moneycaption.com — ${formattedDate}`
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
  
  // Mobile-safe fallback redirect
  const isMobile = /iPad|iPhone|iPod|android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobile) {
    window.location.href = url;
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.creatorName.replace(/\s+/g, "_")}_RateCard_MoneyCaption.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
