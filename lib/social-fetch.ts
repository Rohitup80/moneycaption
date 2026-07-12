/**
 * Social Profile Auto-Fetch Service
 * ────────────────────────────────────────────────
 * Server-side only. All third-party API calls go through this file.
 * If the scraping provider changes, only this file needs updating.
 *
 * Instagram/Facebook: ScrapeCreators (or EnsembleData) — scraping provider
 * YouTube: Official YouTube Data API v3 — no scraping needed
 *
 * ENVIRONMENT VARIABLES:
 *   SCRAPE_PROVIDER_API_KEY   — API key for ScrapeCreators/EnsembleData
 *   YOUTUBE_API_KEY            — Google Cloud API key for YouTube Data API v3
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface FetchedProfile {
  platform: "instagram" | "youtube" | "facebook";
  handle: string;
  followers: number;
  following: number | null;
  posts: number | null;
  engagementRate: number | null;
  profileName: string | null;
  profilePicUrl: string | null;
  isPrivate: boolean;
  dataSourceProvider: string;
  verificationTier: "auto_fetched_public" | "auto_fetched_youtube";
}

export interface FetchError {
  platform: string;
  handle: string;
  error: string;
  code: "PRIVATE_ACCOUNT" | "NOT_FOUND" | "RATE_LIMIT" | "PROVIDER_ERROR" | "TIMEOUT";
}

export type FetchResult =
  | { success: true; data: FetchedProfile }
  | { success: false; error: FetchError };

// ──────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────

const SCRAPE_API_KEY = process.env.SCRAPE_PROVIDER_API_KEY || "";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const FETCH_TIMEOUT_MS = 8000;

// ScrapeCreators base URL (swap this if changing provider)
const SCRAPE_BASE_URL = "https://api.scrapecreators.com/v1";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calculate engagement rate from recent post metrics.
 * Formula: ER = ((avg likes + avg comments) / followers) × 100
 */
function calculateEngagement(
  followers: number,
  recentPosts: Array<{ likes: number; comments: number }>
): number | null {
  if (!recentPosts || recentPosts.length === 0 || followers === 0) return null;

  const totalInteractions = recentPosts.reduce(
    (sum, post) => sum + (post.likes || 0) + (post.comments || 0),
    0
  );
  const avgInteractions = totalInteractions / recentPosts.length;
  const er = (avgInteractions / followers) * 100;

  // Round to 2 decimal places
  return Math.round(er * 100) / 100;
}

// ──────────────────────────────────────────────
// Instagram Fetch (via scraping provider)
// ──────────────────────────────────────────────

export async function fetchInstagramProfile(handle: string): Promise<FetchResult> {
  const cleanHandle = handle.replace(/^@/, "").trim();

  if (!SCRAPE_API_KEY) {
    console.warn("[social-fetch] SCRAPE_PROVIDER_API_KEY not set, falling back to manual");
    return {
      success: false,
      error: {
        platform: "instagram",
        handle: cleanHandle,
        error: "Scraping provider not configured",
        code: "PROVIDER_ERROR",
      },
    };
  }

  try {
    // Fetch profile info
    const profileRes = await fetchWithTimeout(
      `${SCRAPE_BASE_URL}/instagram/profile?handle=${encodeURIComponent(cleanHandle)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": SCRAPE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!profileRes.ok) {
      const status = profileRes.status;
      if (status === 404) {
        return {
          success: false,
          error: {
            platform: "instagram",
            handle: cleanHandle,
            error: "Account not found",
            code: "NOT_FOUND",
          },
        };
      }
      if (status === 429) {
        console.error("[social-fetch] Instagram rate limited");
        return {
          success: false,
          error: {
            platform: "instagram",
            handle: cleanHandle,
            error: "Rate limited",
            code: "RATE_LIMIT",
          },
        };
      }
      throw new Error(`Provider returned ${status}`);
    }

    const rootData: any = await profileRes.json();
    const data = rootData.data?.user || rootData.user || rootData;

    // Handle private accounts
    if (data.is_private) {
      return {
        success: false,
        error: {
          platform: "instagram",
          handle: cleanHandle,
          error: "Account is private",
          code: "PRIVATE_ACCOUNT",
        },
      };
    }

    const followers = data.edge_followed_by?.count || data.followers_count || data.follower_count || 0;
    const following = data.edge_follow?.count || data.following_count || data.followees_count || null;
    const posts = data.edge_owner_to_timeline_media?.count || data.media_count || data.post_count || null;

    // Try to get recent posts for engagement calculation
    let engagementRate: number | null = null;
    try {
      const rawPosts = data.recent_posts || data.edge_owner_to_timeline_media?.edges || [];
      const recentPosts = rawPosts
        .slice(0, 18)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((post: any) => {
          const node = post.node || post;
          return {
            likes: node.like_count || node.edge_liked_by?.count || node.likes || 0,
            comments: node.comment_count || node.edge_media_to_comment?.count || node.comments || 0,
          };
        });

      engagementRate = calculateEngagement(followers, recentPosts);
    } catch {
      // Engagement calculation failed — that's okay, it's optional
      console.warn("[social-fetch] Could not calculate IG engagement for", cleanHandle);
    }

    return {
      success: true,
      data: {
        platform: "instagram",
        handle: cleanHandle,
        followers,
        following,
        posts,
        engagementRate,
        profileName: data.full_name || data.name || null,
        profilePicUrl: data.profile_pic_url_hd || data.profile_pic_url || null,
        isPrivate: false,
        dataSourceProvider: "scrapecreators",
        verificationTier: "auto_fetched_public",
      },
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error("[social-fetch] Instagram fetch error:", cleanHandle, err);

    return {
      success: false,
      error: {
        platform: "instagram",
        handle: cleanHandle,
        error: isTimeout ? "Request timed out" : "Provider error",
        code: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
      },
    };
  }
}

// ──────────────────────────────────────────────
// Facebook Fetch (via scraping provider)
// ──────────────────────────────────────────────

export async function fetchFacebookProfile(handle: string): Promise<FetchResult> {
  const cleanHandle = handle.replace(/^@/, "").trim();

  if (!SCRAPE_API_KEY) {
    console.warn("[social-fetch] SCRAPE_PROVIDER_API_KEY not set, falling back to manual");
    return {
      success: false,
      error: {
        platform: "facebook",
        handle: cleanHandle,
        error: "Scraping provider not configured",
        code: "PROVIDER_ERROR",
      },
    };
  }

  try {
    const profileRes = await fetchWithTimeout(
      `${SCRAPE_BASE_URL}/facebook/profile?url=${encodeURIComponent(`https://www.facebook.com/${cleanHandle}`)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": SCRAPE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!profileRes.ok) {
      const status = profileRes.status;
      if (status === 404) {
        return {
          success: false,
          error: {
            platform: "facebook",
            handle: cleanHandle,
            error: "Page not found",
            code: "NOT_FOUND",
          },
        };
      }
      if (status === 429) {
        return {
          success: false,
          error: {
            platform: "facebook",
            handle: cleanHandle,
            error: "Rate limited",
            code: "RATE_LIMIT",
          },
        };
      }
      throw new Error(`Provider returned ${status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await profileRes.json();

    const followers = data.followerCount || data.followers_count || data.likeCount || data.fan_count || data.likes || 0;

    // Facebook engagement from recent posts if available
    let engagementRate: number | null = null;
    try {
      const recentPosts = (data.recent_posts || [])
        .slice(0, 18)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((post: any) => ({
          likes: post.reactions_count || post.likes || 0,
          comments: post.comments_count || post.comments || 0,
        }));

      engagementRate = calculateEngagement(followers, recentPosts);
    } catch {
      console.warn("[social-fetch] Could not calculate FB engagement for", cleanHandle);
    }

    return {
      success: true,
      data: {
        platform: "facebook",
        handle: cleanHandle,
        followers,
        following: null,
        posts: data.post_count || null,
        engagementRate,
        profileName: data.name || data.page_name || null,
        profilePicUrl: data.profilePicLarge || data.profilePicMedium || data.profilePhoto?.url || data.profile_pic_url || null,
        isPrivate: false,
        dataSourceProvider: "scrapecreators",
        verificationTier: "auto_fetched_public",
      },
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error("[social-fetch] Facebook fetch error:", cleanHandle, err);

    return {
      success: false,
      error: {
        platform: "facebook",
        handle: cleanHandle,
        error: isTimeout ? "Request timed out" : "Provider error",
        code: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
      },
    };
  }
}

// ──────────────────────────────────────────────
// YouTube Fetch (Official YouTube Data API v3)
// ──────────────────────────────────────────────

export async function fetchYouTubeStats(handle: string): Promise<FetchResult> {
  // Clean handle — could be @handle, channel ID, or custom URL
  let cleanHandle = handle.replace(/^@/, "").trim();

  if (!YOUTUBE_API_KEY) {
    console.warn("[social-fetch] YOUTUBE_API_KEY not set, falling back to manual");
    return {
      success: false,
      error: {
        platform: "youtube",
        handle: cleanHandle,
        error: "YouTube API key not configured",
        code: "PROVIDER_ERROR",
      },
    };
  }

  try {
    // Step 1: Resolve handle to channel ID
    // Try forHandle first (for @username format), then search
    let channelId: string | null = null;

    // Try the channels.list?forHandle= endpoint
    const handleRes = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&forHandle=${encodeURIComponent(cleanHandle)}&key=${YOUTUBE_API_KEY}`,
      { method: "GET" }
    );

    if (handleRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleData: any = await handleRes.json();
      if (handleData.items && handleData.items.length > 0) {
        channelId = handleData.items[0].id;
      }
    }

    // If forHandle didn't work, try direct channel ID lookup
    if (!channelId && (cleanHandle.startsWith("UC") || cleanHandle.startsWith("UU"))) {
      channelId = cleanHandle;
    }

    // If still no channel ID, try search as last resort
    if (!channelId) {
      const searchRes = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(cleanHandle)}&type=channel&maxResults=1&key=${YOUTUBE_API_KEY}`,
        { method: "GET" }
      );

      if (searchRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const searchData: any = await searchRes.json();
        if (searchData.items && searchData.items.length > 0) {
          channelId = searchData.items[0].id?.channelId;
        }
      }
    }

    if (!channelId) {
      return {
        success: false,
        error: {
          platform: "youtube",
          handle: cleanHandle,
          error: "Channel not found",
          code: "NOT_FOUND",
        },
      };
    }

    // Step 2: Get channel statistics
    const channelRes = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`,
      { method: "GET" }
    );

    if (!channelRes.ok) {
      throw new Error(`YouTube API returned ${channelRes.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelData: any = await channelRes.json();

    if (!channelData.items || channelData.items.length === 0) {
      return {
        success: false,
        error: {
          platform: "youtube",
          handle: cleanHandle,
          error: "Channel data not available",
          code: "NOT_FOUND",
        },
      };
    }

    const channel = channelData.items[0];
    const stats = channel.statistics || {};
    const snippet = channel.snippet || {};

    const subscribers = parseInt(stats.subscriberCount || "0", 10);
    const videoCount = parseInt(stats.videoCount || "0", 10);
    const viewCount = parseInt(stats.viewCount || "0", 10);

    // Calculate a rough engagement estimate for YouTube
    // Using avg views per video / subscribers × 100
    let engagementRate: number | null = null;
    if (subscribers > 0 && videoCount > 0 && viewCount > 0) {
      const avgViews = viewCount / videoCount;
      engagementRate = Math.round(((avgViews / subscribers) * 100) * 100) / 100;
      // Cap at reasonable max (YouTube engagement can be > 100% with viral videos)
      if (engagementRate > 100) engagementRate = 100;
    }

    return {
      success: true,
      data: {
        platform: "youtube",
        handle: cleanHandle,
        followers: subscribers,
        following: null,
        posts: videoCount,
        engagementRate,
        profileName: snippet.title || null,
        profilePicUrl: snippet.thumbnails?.default?.url || null,
        isPrivate: stats.hiddenSubscriberCount === true,
        dataSourceProvider: "youtube_api_v3",
        verificationTier: "auto_fetched_youtube",
      },
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error("[social-fetch] YouTube fetch error:", cleanHandle, err);

    return {
      success: false,
      error: {
        platform: "youtube",
        handle: cleanHandle,
        error: isTimeout ? "Request timed out" : "API error",
        code: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
      },
    };
  }
}

// ──────────────────────────────────────────────
// Unified fetch dispatcher
// ──────────────────────────────────────────────

export async function fetchSocialProfile(
  platform: "instagram" | "youtube" | "facebook",
  handle: string
): Promise<FetchResult> {
  switch (platform) {
    case "instagram":
      return fetchInstagramProfile(handle);
    case "youtube":
      return fetchYouTubeStats(handle);
    case "facebook":
      return fetchFacebookProfile(handle);
    default:
      return {
        success: false,
        error: {
          platform,
          handle,
          error: "Unsupported platform",
          code: "PROVIDER_ERROR",
        },
      };
  }
}

// ──────────────────────────────────────────────
// Fetch Recent Posts with Metrics
// ──────────────────────────────────────────────

export interface FetchedPost {
  url: string;
  title: string;
  likes: number;
  comments: number;
  views: number | null;
  date: string;
  imageUrl: string | null;
}

export async function fetchRecentPosts(
  platform: "instagram" | "youtube" | "facebook",
  handle: string
): Promise<FetchedPost[]> {
  const cleanHandle = handle.replace(/^@/, "").trim();

  if (platform === "instagram") {
    if (!SCRAPE_API_KEY) return [];
    try {
      const res = await fetchWithTimeout(
        `${SCRAPE_BASE_URL}/instagram/profile?handle=${encodeURIComponent(cleanHandle)}`,
        {
          method: "GET",
          headers: {
            "x-api-key": SCRAPE_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) return [];
      const rootData: any = await res.json();
      const user = rootData.data?.user || rootData.user || rootData;
      const rawPosts = user.recent_posts || user.edge_owner_to_timeline_media?.edges || [];
      return rawPosts.slice(0, 10).map((post: any) => {
        const node = post.node || post;
        return {
          url: node.shortcode ? `https://instagram.com/p/${node.shortcode}` : `https://instagram.com/${cleanHandle}`,
          title: node.caption || node.title || "Instagram Post",
          likes: node.like_count || node.edge_liked_by?.count || node.likes || 0,
          comments: node.comment_count || node.edge_media_to_comment?.count || node.comments || 0,
          views: node.view_count || node.views || null,
          date: node.taken_at ? new Date(node.taken_at * 1000).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
          imageUrl: node.display_url || node.thumbnail_src || null,
        };
      });
    } catch (err) {
      console.error("IG posts fetch error:", err);
      return [];
    }
  }

  if (platform === "youtube") {
    if (!YOUTUBE_API_KEY) return [];
    try {
      let channelId: string | null = null;
      const handleRes = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(cleanHandle)}&key=${YOUTUBE_API_KEY}`,
        { method: "GET" }
      );
      if (handleRes.ok) {
        const handleData: any = await handleRes.json();
        if (handleData.items && handleData.items.length > 0) {
          channelId = handleData.items[0].id;
        }
      }
      if (!channelId && (cleanHandle.startsWith("UC") || cleanHandle.startsWith("UU"))) {
        channelId = cleanHandle;
      }
      if (!channelId) {
        const searchRes = await fetchWithTimeout(
          `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(cleanHandle)}&type=channel&maxResults=1&key=${YOUTUBE_API_KEY}`,
          { method: "GET" }
        );
        if (searchRes.ok) {
          const searchData: any = await searchRes.json();
          if (searchData.items && searchData.items.length > 0) {
            channelId = searchData.items[0].id?.channelId;
          }
        }
      }
      if (!channelId) return [];

      const videosRes = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId=${channelId}&order=date&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`,
        { method: "GET" }
      );
      if (!videosRes.ok) return [];
      const videosData: any = await videosRes.json();
      if (!videosData.items || videosData.items.length === 0) return [];

      const videoIds = videosData.items.map((item: any) => item.id.videoId).filter(Boolean);
      if (videoIds.length === 0) return [];

      const statsRes = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/videos?part=id,snippet,statistics&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`,
        { method: "GET" }
      );
      if (!statsRes.ok) return [];
      const statsData: any = await statsRes.json();

      return (statsData.items || []).map((video: any) => ({
        url: `https://youtube.com/watch?v=${video.id}`,
        title: video.snippet.title,
        likes: parseInt(video.statistics.likeCount || "0", 10),
        comments: parseInt(video.statistics.commentCount || "0", 10),
        views: parseInt(video.statistics.viewCount || "0", 10),
        date: new Date(video.snippet.publishedAt).toLocaleDateString("en-IN"),
        imageUrl: video.snippet.thumbnails?.default?.url || null,
      }));
    } catch (err) {
      console.error("YT posts fetch error:", err);
      return [];
    }
  }

  if (platform === "facebook") {
    if (!SCRAPE_API_KEY) return [];
    try {
      const res = await fetchWithTimeout(
        `${SCRAPE_BASE_URL}/facebook/profile?url=${encodeURIComponent(`https://www.facebook.com/${cleanHandle}`)}`,
        {
          method: "GET",
          headers: {
            "x-api-key": SCRAPE_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) return [];
      const data: any = await res.json();
      const recentPosts = data.recent_posts || [];
      return recentPosts.slice(0, 10).map((post: any) => ({
        url: post.url || `https://facebook.com/${cleanHandle}`,
        title: post.text || post.message || "Facebook Post",
        likes: post.reactions_count || post.likes || 0,
        comments: post.comments_count || post.comments || 0,
        views: post.view_count || null,
        date: post.time ? new Date(post.time).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
        imageUrl: post.image || post.thumbnail || null,
      }));
    } catch (err) {
      console.error("FB posts fetch error:", err);
      return [];
    }
  }

  return [];
}
