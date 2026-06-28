"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Use an untyped client for admin operations to avoid complex generics
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReviewItem {
  id: string;
  creator_id: string;
  status: string;
  created_at: string;
  creator_profiles: {
    name: string;
    niche: string;
    phone: string | null;
    instagram_handle: string | null;
    youtube_handle: string | null;
    facebook_handle: string | null;
    followers_instagram: number | null;
    followers_youtube: number | null;
    followers_facebook: number | null;
    engagement_rate: number | null;
  } | null;
}

export default function AdminReviewPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [engagementInputs, setEngagementInputs] = useState<
    Record<string, string>
  >({});

  // Simple password gate (basic auth for internal use)
  const ADMIN_PASSWORD = "moneycaption-admin-2024";

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthed(true);
      loadQueue();
    } else {
      alert("Invalid password");
    }
  }

  async function loadQueue() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_review_queue")
        .select(
          `
          id,
          creator_id,
          status,
          created_at,
          creator_profiles (
            name,
            niche,
            phone,
            instagram_handle,
            youtube_handle,
            facebook_handle,
            followers_instagram,
            followers_youtube,
            followers_facebook,
            engagement_rate
          )
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setQueue((data as unknown as ReviewItem[]) || []);
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(queueId: string, creatorId: string) {
    const rate = parseFloat(engagementInputs[queueId] || "");
    if (isNaN(rate) || rate <= 0 || rate > 100) {
      alert("Please enter a valid engagement rate (0.1–100)");
      return;
    }

    try {
      // Update creator profile
      await supabase
        .from("creator_profiles")
        .update({
          engagement_rate: rate,
          engagement_source: "manual_calculated",
          engagement_calculated_by: "admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorId);

      // Mark queue item as reviewed
      await supabase
        .from("admin_review_queue")
        .update({
          status: "reviewed",
          reviewed_engagement_rate: rate,
          reviewed_by: "admin",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", queueId);

      // Refresh queue
      setQueue((prev) => prev.filter((item) => item.id !== queueId));
    } catch (err) {
      console.error("Review failed:", err);
      alert("Failed to submit review. Check console for details.");
    }
  }

  useEffect(() => {
    if (isAuthed) loadQueue();
  }, [isAuthed]);

  // ── Auth Gate ──
  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="mc-card p-8 w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-1">Admin Access</h1>
            <p className="text-sm text-[--mc-text-muted]">
              Internal review panel
            </p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="mc-label">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                className="mc-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </div>
            <button type="submit" className="mc-btn mc-btn-primary w-full">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Review Panel ──
  return (
    <div className="min-h-screen">
      <nav className="glass sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-white font-bold text-xs">
                M
              </div>
              <span className="text-base font-bold bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent">
                MoneyCaption
              </span>
            </a>
            <span className="mc-badge mc-badge-yellow">Admin</span>
          </div>
          <button
            onClick={() => setIsAuthed(false)}
            className="text-sm text-[--mc-text-secondary] hover:text-[--mc-error] transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Engagement Review Queue</h1>
            <p className="text-sm text-[--mc-text-muted] mt-1">
              {queue.length} pending review{queue.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={loadQueue}
            className="mc-btn mc-btn-secondary mc-btn-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-6 w-6 text-[--mc-primary]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && queue.length === 0 && (
          <div className="mc-card p-12 text-center">
            <span className="text-4xl mb-4 block">✅</span>
            <p className="text-[--mc-text-secondary]">
              No pending reviews. All caught up!
            </p>
          </div>
        )}

        {!loading && queue.length > 0 && (
          <div className="space-y-4">
            {queue.map((item) => {
              const c = item.creator_profiles;
              return (
                <div key={item.id} className="mc-card p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Creator info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          {c?.name || "Unknown"}
                        </h3>
                        <span className="mc-badge mc-badge-yellow">
                          Pending
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <span className="text-[--mc-text-muted]">Niche</span>
                        <span>{c?.niche || "—"}</span>

                        {c?.followers_instagram && (
                          <>
                            <span className="text-[--mc-text-muted]">
                              📸 Instagram
                            </span>
                            <span>
                              {c.followers_instagram.toLocaleString("en-IN")}{" "}
                              {c.instagram_handle ? `@${c.instagram_handle}` : ""}
                            </span>
                          </>
                        )}
                        {c?.followers_youtube && (
                          <>
                            <span className="text-[--mc-text-muted]">
                              🎬 YouTube
                            </span>
                            <span>
                              {c.followers_youtube.toLocaleString("en-IN")}{" "}
                              {c.youtube_handle ? `@${c.youtube_handle}` : ""}
                            </span>
                          </>
                        )}
                        {c?.followers_facebook && (
                          <>
                            <span className="text-[--mc-text-muted]">
                              📘 Facebook
                            </span>
                            <span>
                              {c.followers_facebook.toLocaleString("en-IN")}{" "}
                              {c.facebook_handle ? `@${c.facebook_handle}` : ""}
                            </span>
                          </>
                        )}

                        <span className="text-[--mc-text-muted]">
                          Submitted
                        </span>
                        <span>
                          {new Date(item.created_at).toLocaleDateString(
                            "en-IN"
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Review action */}
                    <div className="lg:w-72 flex flex-col gap-3">
                      <label className="mc-label">
                        Calculated Engagement Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        placeholder="e.g. 3.5"
                        className="mc-input"
                        value={engagementInputs[item.id] || ""}
                        onChange={(e) =>
                          setEngagementInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        onClick={() =>
                          handleReview(item.id, item.creator_id)
                        }
                        className="mc-btn mc-btn-primary mc-btn-sm"
                      >
                        ✓ Submit Review
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
