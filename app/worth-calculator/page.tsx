"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { calculateRates } from "@/lib/rate-engine";
import { cityTierMapping, cityOptions, nicheOptions } from "@/lib/rate-config";

type Platform = "instagram" | "youtube" | "facebook";

export default function WorthCalculatorPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [followers, setFollowers] = useState<number>(25000);
  const [views, setViews] = useState<number>(5000);
  const [er, setEr] = useState<number>(4.2);

  const [minWorth, setMinWorth] = useState<number>(0);
  const [maxWorth, setMaxWorth] = useState<number>(0);

  // Scraper inputs state
  const [scraperHandle, setScraperHandle] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [verifiedHandle, setVerifiedHandle] = useState<string | null>(null);

  // Auth modal state
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authCity, setAuthCity] = useState("Delhi");
  const [authNiche, setAuthNiche] = useState("vlog");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [shareLinkText, setShareLinkText] = useState<string | null>(null);

  // Recalculate estimated worth dynamically
  useEffect(() => {
    let baseValuation = 0;
    let engagementBonus = 0;

    if (platform === "instagram") {
      baseValuation = views * 0.40;
      engagementBonus = followers * (er / 100) * 4.5;
    } else if (platform === "youtube") {
      baseValuation = views * 0.70;
      engagementBonus = followers * (er / 100) * 10.0;
    } else {
      baseValuation = views * 0.25;
      engagementBonus = followers * (er / 100) * 2.0;
    }

    const totalEstimate = baseValuation + engagementBonus;
    let calculatedMin = Math.round(totalEstimate * 0.85);
    let calculatedMax = Math.round(totalEstimate * 1.20);

    if (calculatedMin < 500) calculatedMin = 500;
    if (calculatedMax < 1000) calculatedMax = 1000;

    setMinWorth(calculatedMin);
    setMaxWorth(calculatedMax);
  }, [platform, followers, views, er]);

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }
    document.body.removeChild(textArea);
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch((err) => {
        console.warn("navigator.clipboard.writeText failed, using fallback:", err);
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  // Scraper action handler
  const handleScrapMetrics = async () => {
    if (!scraperHandle) {
      setScrapeError("Please enter a handle/username.");
      return;
    }
    const cleanHandle = scraperHandle.replace(/^@/, "").trim();
    if (!cleanHandle) return;

    setIsScraping(true);
    setScrapeError(null);
    setScrapeSuccess(null);

    try {
      // 1. Fetch Profile details
      const profileResponse = await fetch("/api/fetch-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: cleanHandle }),
      });
      const profileResult = await profileResponse.json();
      if (!profileResult.success || !profileResult.data) {
        throw new Error(profileResult.error || `Could not find details for ${platform} profile.`);
      }
      const d = profileResult.data;

      // 2. Fetch Posts for average views
      let fetchedAvgViews = 5000;
      let postsList: any[] = [];
      try {
        const postsResponse = await fetch("/api/fetch-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, handle: cleanHandle }),
        });
        const postsResult = await postsResponse.json();
        if (postsResult.success && postsResult.posts && postsResult.posts.length > 0) {
          const validPosts = postsResult.posts.filter((post: any) => post.views !== null);
          if (validPosts.length > 0) {
            fetchedAvgViews = Math.round(
              validPosts.reduce((sum: number, post: any) => sum + post.views, 0) / validPosts.length
            );
          }
          postsList = postsResult.posts;
        }
      } catch (err) {
        console.warn("Fetch posts error during worth calculator scraping:", err);
      }

      setFollowers(d.followers || 25000);
      setViews(fetchedAvgViews);
      setEr(d.engagementRate ? parseFloat(d.engagementRate.toFixed(1)) : 4.2);
      setVerifiedHandle(cleanHandle);

      if (postsList.length > 0) {
        sessionStorage.setItem("mc_fetched_posts", JSON.stringify(postsList));
      }

      setScrapeSuccess(`Successfully auto-fetched details for @${cleanHandle}!`);
    } catch (err: any) {
      console.error(err);
      setScrapeError(err.message || "Failed to fetch details. Please adjust sliders manually.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleShareWorthCard = async () => {
    setAuthError(null);
    setShareLinkText(null);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      setShowAuthPopup(true);
      return;
    }

    await executeSharing(session.user.id);
  };

  const executeSharing = async (userId: string) => {
    setAuthLoading(true);
    try {
      const { data: existingProfile } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const profile: any = existingProfile;
      let profileId = profile?.id;
      const cityTier = cityTierMapping[authCity] || profile?.city_tier || "tier_3";

      const profileData: any = {
        name: profile?.name || authName || "Worth Creator",
        niche: profile?.niche || authNiche || "vlog",
        city: profile?.city || authCity || "Delhi",
        city_tier: cityTier,
        updated_at: new Date().toISOString(),
      };

      if (platform === "instagram") {
        profileData.instagram_handle = verifiedHandle || scraperHandle || "worth_estimator";
        profileData.followers_instagram = followers;
        profileData.avg_views_instagram = views;
        profileData.engagement_rate = er;
        profileData.verification_tier = "api_verified";
      } else if (platform === "youtube") {
        profileData.youtube_handle = verifiedHandle || scraperHandle || "worth_estimator";
        profileData.followers_youtube = followers;
        profileData.avg_views_youtube = views;
        profileData.engagement_rate = er;
        profileData.verification_tier = "api_verified";
      } else {
        profileData.facebook_handle = verifiedHandle || scraperHandle || "worth_estimator";
        profileData.followers_facebook = followers;
        profileData.avg_views_facebook = views;
        profileData.engagement_rate = er;
        profileData.verification_tier = "api_verified";
      }

      if (profileId) {
        await (supabase.from("creator_profiles") as any).update(profileData).eq("id", profileId);
      } else {
        profileData.user_id = userId;
        const { data: newProf, error: insErr } = await (supabase
          .from("creator_profiles") as any)
          .insert(profileData)
          .select("id")
          .single();
        if (insErr) throw insErr;
        profileId = newProf.id;
      }

      const input = {
        platforms: {
          instagram: platform === "instagram" ? followers : undefined,
          youtube: platform === "youtube" ? followers : undefined,
          facebook: platform === "facebook" ? followers : undefined,
        },
        niche: profileData.niche,
        cityTier: profileData.city_tier,
        engagementRate: er,
        avgViewsInstagram: platform === "instagram" ? views : null,
        avgViewsYoutube: platform === "youtube" ? views : null,
        avgViewsFacebook: platform === "facebook" ? views : null,
      };

      const computed = calculateRates(input);

      // Purge past active rate card rows to prevent duplications
      await (supabase.from("rate_cards") as any).delete().eq("creator_id", profileId);

      const rows = computed.flatMap((p: any) =>
        p.deliverables.map((d: any) => ({
          creator_id: profileId,
          platform: p.platform,
          deliverable_id: d.id,
          label: d.label,
          selected_price: d.marketStandard,
          selected_tier: "marketStandard",
        }))
      );

      const { error: cardInsErr } = await (supabase.from("rate_cards") as any).insert(rows);
      if (cardInsErr) throw cardInsErr;

      const shareUrl = `${window.location.origin}/share/${profileId}`;
      copyToClipboard(shareUrl);
      setShareLinkText(shareUrl);
      setShowAuthPopup(false);

    } catch (err: any) {
      console.error("Sharing fail error:", err);
      setAuthError(err.message || "Failed to generate rate card link.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === "login") {
        const { data, error: loginErr } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (loginErr) throw loginErr;

        if (data.user) {
          await executeSharing(data.user.id);
        }
      } else {
        if (!authName) {
          throw new Error("Full name is required.");
        }

        const { data: checkData } = await (supabase
          .from("creator_profiles") as any)
          .select("id")
          .eq("email", authEmail)
          .maybeSingle();

        if (checkData) {
          throw new Error("An account already exists with this email address.");
        }

        const { data: signUpData, error: signupErr } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (signupErr) throw signupErr;

        if (signUpData.user) {
          await executeSharing(signUpData.user.id);
        }
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Authentication failed. Please verify credentials.");
      setAuthLoading(false);
    }
  };

  const handleCreateRateCard = () => {
    router.push(
      `/calculate?followers=${followers}&views=${views}&er=${er}&platform=${platform}&source=worth_estimate`
    );
  };

  return (
    <div className="min-h-screen bg-[--mc-bg] text-[--mc-text-primary] pb-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 pt-8 space-y-8 text-center">
        <div className="space-y-3">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 inline-block">
            Sponsorship Worth Calculator
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-[--mc-primary-dark] bg-clip-text text-transparent">
            How Much Should Brands Pay You?
          </h1>
          <p className="text-sm md:text-base text-[--mc-text-secondary] max-w-xl mx-auto">
            Input your account metrics below to calculate your estimated sponsorship valuation range per post.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left items-start mt-6">
          {/* Metrics Form Slider Inputs */}
          <div className="mc-card p-6 space-y-6">
            <h3 className="font-bold text-lg text-[--mc-text-primary] border-b border-[--mc-border] pb-2">
              Step 1: Input Metrics
            </h3>

            {/* Scraper Panel inputs */}
            <div className="bg-[--mc-bg-secondary]/50 p-4 rounded-xl border border-[--mc-border] space-y-4">
              <h4 className="text-sm font-bold text-[--mc-text-primary] flex items-center gap-1.5">
                ⚡ Auto-Fetch Metrics (Optional)
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Select Social Account</label>
                  <select
                    value={platform}
                    onChange={(e) => {
                      const p = e.target.value as Platform;
                      setPlatform(p);
                      if (p === "youtube") {
                        setFollowers(50000);
                        setViews(12000);
                        setEr(2.8);
                      } else if (p === "facebook") {
                        setFollowers(15000);
                        setViews(3000);
                        setEr(1.5);
                      } else {
                        setFollowers(25000);
                        setViews(5000);
                        setEr(4.2);
                      }
                    }}
                    className="mc-select mt-1 bg-[--mc-bg-card]"
                  >
                    <option value="instagram">📸 Instagram Profile</option>
                    <option value="youtube">🎬 YouTube Channel</option>
                    <option value="facebook">📘 Facebook Page</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Social Handle Name</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="e.g. handle or channel name"
                      value={scraperHandle}
                      onChange={(e) => setScraperHandle(e.target.value)}
                      className="mc-input bg-[--mc-bg-card]"
                    />
                    <button
                      type="button"
                      disabled={isScraping}
                      onClick={handleScrapMetrics}
                      className="mc-btn mc-btn-primary py-2.5 px-4 text-xs font-bold shrink-0 shadow-sm transition-all"
                    >
                      {isScraping ? "Fetching..." : "Fetch"}
                    </button>
                  </div>
                </div>

                {scrapeSuccess && (
                  <p className="text-xs text-[--mc-success] font-semibold">✓ {scrapeSuccess}</p>
                )}
                {scrapeError && (
                  <p className="text-xs text-[--mc-warning] font-semibold">⚠ {scrapeError}</p>
                )}
              </div>
            </div>

            {/* Followers Input Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="mc-label mb-0">
                  {platform === "youtube" ? "Subscribers" : "Followers"}
                </label>
                <span className="text-sm font-bold text-[--mc-text-primary] bg-[--mc-bg-elevated] px-2 py-0.5 rounded border border-[--mc-border]">
                  {followers.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={1000000}
                step={1000}
                value={followers}
                onChange={(e) => setFollowers(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[--mc-primary]"
              />
              <input
                type="number"
                value={followers}
                min={1000}
                onChange={(e) => setFollowers(Math.max(1000, parseInt(e.target.value, 10) || 1000))}
                className="mc-input"
              />
            </div>

            {/* Avg Views Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="mc-label mb-0">Average Post/Reel Views</label>
                <span className="text-sm font-bold text-[--mc-text-primary] bg-[--mc-bg-elevated] px-2 py-0.5 rounded border border-[--mc-border]">
                  {views.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={500}
                max={500000}
                step={500}
                value={views}
                onChange={(e) => setViews(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[--mc-primary]"
              />
              <input
                type="number"
                value={views}
                min={100}
                onChange={(e) => setViews(Math.max(100, parseInt(e.target.value, 10) || 100))}
                className="mc-input"
              />
            </div>

            {/* Engagement Rate Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="mc-label mb-0">Engagement Rate (%)</label>
                <span className="text-sm font-bold text-[--mc-text-primary] bg-[--mc-bg-elevated] px-2 py-0.5 rounded border border-[--mc-border]">
                  {er.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={15}
                step={0.1}
                value={er}
                onChange={(e) => setEr(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[--mc-primary]"
              />
              <input
                type="number"
                step="0.1"
                value={er}
                min={0.1}
                max={100}
                onChange={(e) => setEr(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="mc-input"
              />
            </div>
          </div>

          {/* Results Calculator Display */}
          <div className="space-y-6">
            <div className="mc-card p-6 bg-gradient-to-br from-[--mc-bg-card] to-indigo-50/30 text-center space-y-6 border border-indigo-500/10">
              <h3 className="font-bold text-lg text-[--mc-text-primary] border-b border-[--mc-border] pb-2 text-left">
                Step 2: Valuation Estimate
              </h3>

              {verifiedHandle && (
                <div className="bg-emerald-500/10 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-500/25 text-xs text-left font-bold capitalize">
                  {platform === "instagram" ? "📸" : platform === "youtube" ? "🎬" : "📘"} {platform} account: @{verifiedHandle}
                </div>
              )}

              <div className="py-4 space-y-2">
                <span className="text-xs text-[--mc-text-secondary] font-semibold uppercase tracking-wider block">
                  Estimated sponsorship worth range
                </span>
                <p className="text-4xl md:text-5xl font-extrabold text-[--mc-success] tracking-tight">
                  ₹{minWorth.toLocaleString("en-IN")} - ₹{maxWorth.toLocaleString("en-IN")}
                </p>
                <span className="text-xs text-[--mc-text-muted] block mt-1">
                  *Per sponsored brand campaign post/video.
                </span>
              </div>

              {/* Estimation breakdowns */}
              <div className="space-y-3 text-sm text-left bg-[--mc-bg-secondary]/50 p-4 rounded-xl border border-[--mc-border]/50">
                <div className="flex justify-between border-b border-[--mc-border]/20 pb-2">
                  <span className="text-[--mc-text-secondary]">Views baseline CPM worth:</span>
                  <span className="font-semibold text-[--mc-text-primary]">
                    ₹{Math.round(platform === "instagram" ? views * 0.40 : platform === "youtube" ? views * 0.70 : views * 0.25).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[--mc-border]/20 pb-2">
                  <span className="text-[--mc-text-secondary]">Engagement authority bonus:</span>
                  <span className="font-semibold text-indigo-600">
                    ₹{Math.round(followers * (er / 100) * (platform === "instagram" ? 4.5 : platform === "youtube" ? 10.0 : 2.0)).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-[--mc-text-secondary]">Overall creator potential:</span>
                  <span className="font-semibold text-[--mc-primary]">High Engagement Scale</span>
                </div>
              </div>

              {shareLinkText && (
                <div className="bg-emerald-500/10 text-emerald-700 p-3 rounded-lg border border-emerald-500/25 text-xs text-center space-y-1">
                  <p className="font-bold">✓ Share Link copied to clipboard!</p>
                  <p className="font-mono text-[10px] break-all">{shareLinkText}</p>
                </div>
              )}

              <div className="space-y-3 pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleShareWorthCard}
                  className="mc-btn mc-btn-primary w-full py-3.5 font-bold cursor-pointer transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  🔗 Share Estimation Rate Card
                </button>
                <button
                  type="button"
                  onClick={handleCreateRateCard}
                  className="mc-btn mc-btn-secondary w-full py-3 font-semibold cursor-pointer border border-[--mc-border] text-[--mc-text-primary]"
                >
                  ⚡ Generate Full Rate Card Portfolio
                </button>
              </div>
            </div>

            {/* Information Card */}
            <div className="mc-card p-5 text-left border border-[--mc-border] space-y-2.5">
              <h4 className="font-semibold text-sm text-[--mc-text-primary]">💡 How is this calculated?</h4>
              <p className="text-xs text-[--mc-text-secondary] leading-relaxed">
                Valuations are computed using market-standard CPMs (Cost Per Mille) tailored to platform demographics (₹400 for Instagram, ₹700 for YouTube, and ₹250 for Facebook per 1000 views). An engagement score bonus is added representing the direct action authority of your active subscriber count.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Magic Auth Popup Modal ── */}
      {showAuthPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="mc-card max-w-md w-full bg-white p-5 sm:p-8 relative space-y-5 sm:space-y-6 shadow-2xl border border-[--mc-border] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAuthPopup(false)}
              className="absolute top-4 right-4 text-2xl text-[--mc-text-secondary] hover:text-[--mc-text-primary] cursor-pointer"
            >
              ×
            </button>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-[--mc-text-primary]">Login Required</h3>
              <p className="text-xs text-[--mc-text-secondary]">
                Please sign in or create an account to save your worth calculations and generate shareable links.
              </p>
            </div>

            {/* Tabs toggle */}
            <div className="flex bg-[--mc-bg-secondary] p-1 rounded-lg border border-[--mc-border]">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  authMode === "login"
                    ? "bg-white text-[--mc-text-primary] shadow"
                    : "text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  authMode === "signup"
                    ? "bg-white text-[--mc-text-primary] shadow"
                    : "text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              {authMode === "signup" && (
                <div>
                  <label className="mc-label text-xs">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="mc-input mt-1 bg-[--mc-bg-secondary]"
                  />
                </div>
              )}
              <div>
                <label className="mc-label text-xs">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@email.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="mc-input mt-1 bg-[--mc-bg-secondary]"
                />
              </div>
              <div>
                <label className="mc-label text-xs">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="mc-input mt-1 bg-[--mc-bg-secondary]"
                />
              </div>

              {authMode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mc-label text-xs">City</label>
                    <select
                      value={authCity}
                      onChange={(e) => setAuthCity(e.target.value)}
                      className="mc-select mt-1 bg-[--mc-bg-secondary]"
                    >
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mc-label text-xs">Primary Niche</label>
                    <select
                      value={authNiche}
                      onChange={(e) => setAuthNiche(e.target.value)}
                      className="mc-select mt-1 bg-[--mc-bg-secondary]"
                    >
                      {nicheOptions.map((n) => (
                        <option key={n} value={n}>
                          {n.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {authError && (
                <p className="text-xs text-[--mc-error] font-medium text-center bg-red-500/10 p-2 rounded">
                  ⚠ {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="mc-btn mc-btn-primary w-full py-3 font-bold cursor-pointer transition-all shadow mt-2"
              >
                {authLoading ? "Processing..." : authMode === "login" ? "Sign In" : "Register"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
