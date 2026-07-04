import { NextRequest, NextResponse } from "next/server";
import { fetchRecentPosts } from "@/lib/social-fetch";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, handle } = body;

    if (!platform || !handle) {
      return NextResponse.json({ success: false, error: "Missing platform or handle" }, { status: 400 });
    }

    const posts = await fetchRecentPosts(platform, handle);
    return NextResponse.json({ success: true, posts });
  } catch (err) {
    console.error("fetch-posts route error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
