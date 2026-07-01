/**
 * API Route: /api/fetch-profile
 * ────────────────────────────────────────────────
 * Server-side endpoint for fetching social profile data.
 * Called from the calculator form on handle blur.
 *
 * Never exposes API keys to the client.
 * Always falls back gracefully — errors return a structured response
 * that the client interprets as "use manual input".
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchSocialProfile, type FetchResult } from "@/lib/social-fetch";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, handle } = body;

    // Validate input
    if (!platform || !handle) {
      return NextResponse.json(
        {
          success: false,
          error: {
            platform: platform || "unknown",
            handle: handle || "",
            error: "Missing platform or handle",
            code: "PROVIDER_ERROR",
          },
        } satisfies FetchResult,
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms = ["instagram", "youtube", "facebook"];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            platform,
            handle,
            error: "Invalid platform",
            code: "PROVIDER_ERROR",
          },
        } satisfies FetchResult,
        { status: 400 }
      );
    }

    // Validate handle format (basic sanity check)
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (cleanHandle.length < 1 || cleanHandle.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            platform,
            handle: cleanHandle,
            error: "Invalid handle format",
            code: "NOT_FOUND",
          },
        } satisfies FetchResult,
        { status: 400 }
      );
    }

    // Fetch profile data (all error handling is inside social-fetch.ts)
    const result = await fetchSocialProfile(platform, cleanHandle);

    // Log failures server-side for monitoring
    if (!result.success) {
      console.warn(
        `[fetch-profile] Failed: platform=${platform} handle=${cleanHandle} code=${result.error.code} error=${result.error.error}`
      );
    } else {
      console.log(
        `[fetch-profile] Success: platform=${platform} handle=${cleanHandle} followers=${result.data.followers}`
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    // Catch-all for unexpected errors — never leak internals
    console.error("[fetch-profile] Unexpected error:", err);

    return NextResponse.json(
      {
        success: false,
        error: {
          platform: "unknown",
          handle: "",
          error: "Internal server error",
          code: "PROVIDER_ERROR",
        },
      } satisfies FetchResult,
      { status: 500 }
    );
  }
}
