"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { nicheOptions, cityOptions, cityTierMapping } from "@/lib/rate-config";
import ScreenshotUploadModal from "../results/ScreenshotUploadModal";

// Untyped client to avoid generics mismatch with current supabase-js version
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreatorProfile = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RateCalculation = Record<string, any>;

type AuthView = "login" | "signup" | "dashboard";

export default function ProfilePage() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Auth form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");

  // Dashboard & profile states
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [history, setHistory] = useState<RateCalculation[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNiche, setEditNiche] = useState("");
  const [editCity, setEditCity] = useState("");

  // Check session on load
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setView("dashboard");
        loadProfileAndHistory(session.user.id);
      }
    }
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setView("dashboard");
        loadProfileAndHistory(session.user.id);
      } else {
        setUserId(null);
        setProfile(null);
        setHistory([]);
        setView("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfileAndHistory(uid: string) {
    setLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("user_id", uid)
        .single();

      if (profileData) {
        setProfile(profileData);
        setEditName(profileData.name || "");
        setEditPhone(profileData.phone || "");
        setEditNiche(profileData.niche || "");
        // Find matching city key from tier mapping if stored as tier
        const matchedCity = Object.entries(cityTierMapping).find(
          ([, tier]) => tier === profileData.city_tier
        );
        setEditCity(matchedCity ? matchedCity[0] : "");
      }

      // Load calculation history
      const { data: historyData } = await supabase
        .from("rate_calculations")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (historyData) {
        setHistory(historyData);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Password Sign Up ──
  async function handleSignUp() {
    if (!email || !password || !fullName || !niche || !city) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Sign up failed. Please check your inputs.");
      }

      // 2. Create the creator profile row
      const cityTier = cityTierMapping[city] || "tier_3";
      const { error: profileError } = await supabase
        .from("creator_profiles")
        .insert({
          user_id: authData.user.id,
          name: fullName,
          email: email,
          phone: phone || null,
          niche: niche,
          city_tier: cityTier,
          verification_tier: "self_reported",
          engagement_source: "self_reported",
        });

      if (profileError) {
        console.error("Failed to insert profile row:", profileError);
      }

      // 3. Link any calculations stored in sessionStorage
      const stored = sessionStorage.getItem("mc_calc_input");
      if (stored) {
        try {
          const calcData = JSON.parse(stored);
          const { calculateRates } = await import("@/lib/rate-engine");
          const computedRates = calculateRates({
            platforms: calcData.platforms,
            followersInstagram: calcData.followersInstagram,
            followersYoutube: calcData.followersYoutube,
            followersFacebook: calcData.followersFacebook,
            niche: calcData.niche,
            cityTier: calcData.cityTier,
            engagementRate: calcData.engagementRate,
          });

          await supabase.from("rate_calculations").insert({
            user_id: authData.user.id,
            creator_name: calcData.creatorName,
            niche: calcData.niche,
            city_tier: calcData.cityTier,
            verification_tier: calcData.verificationTier,
            platforms: calcData.platforms,
            followers_instagram: calcData.followersInstagram || null,
            followers_youtube: calcData.followersYoutube || null,
            followers_facebook: calcData.followersFacebook || null,
            engagement_rate: calcData.engagementRate ?? null,
            results_json: computedRates,
          });
        } catch (linkErr) {
          console.error("Failed to link past calculation:", linkErr);
        }
      }

      setSuccessMsg("Registration successful! Logging you in...");
      setTimeout(() => {
        setView("dashboard");
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Password Login ──
  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Session listener will transition to dashboard and load details
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Update Profile Details ──
  async function handleUpdateProfile() {
    if (!editName || !editNiche || !editCity) {
      setError("Name, Niche, and City are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const cityTier = cityTierMapping[editCity] || "tier_3";
      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({
          name: editName,
          phone: editPhone || null,
          niche: editNiche,
          city_tier: cityTier,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setSuccessMsg("Profile details updated successfully!");
      setIsEditing(false);
      if (userId) loadProfileAndHistory(userId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── View/Redownload a Past Calculation ──
  const handleViewPastCalculation = (calc: RateCalculation) => {
    const calcInput = {
      profileId: profile?.id || null,
      platforms: calc.platforms,
      followersInstagram: calc.followers_instagram,
      followersYoutube: calc.followers_youtube,
      followersFacebook: calc.followers_facebook,
      niche: calc.niche,
      cityTier: calc.city_tier,
      engagementRate: calc.engagement_rate,
      creatorName: calc.creator_name,
      engagementSkipped: calc.engagement_rate === null,
      verificationTier: calc.verification_tier,
      calculatedAt: calc.created_at,
    };
    sessionStorage.setItem("mc_calc_input", JSON.stringify(calcInput));
    router.push("/results");
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    setView("login");
    setProfile(null);
    setHistory([]);
    setUserId(null);
  }

  const getVerificationBadge = (tier: string) => {
    switch (tier) {
      case "auto_fetched_public":
        return <span className="mc-badge mc-badge-teal">~ Public Data Match</span>;
      case "auto_fetched_youtube":
        return <span className="mc-badge mc-badge-youtube">~ YouTube Verified</span>;
      case "screenshot_verified":
        return <span className="mc-badge mc-badge-indigo">✓ Screenshot Verified</span>;
      case "api_verified":
        return <span className="mc-badge mc-badge-green">✓ API Verified</span>;
      default:
        return <span className="mc-badge mc-badge-grey">○ Self-Reported</span>;
    }
  };

  return (
    <div className="min-h-screen relative pb-16">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #6C5CE7, transparent)" }}
        />
        <div
          className="absolute bottom-20 left-10 w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #00D2D3, transparent)" }}
        />
      </div>

      {/* Nav */}
      <nav className="glass sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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
              Calculator
            </a>
            {userId && (
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-error] transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* ── AUTH VIEWS ── */}
        {view !== "dashboard" && (
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">
                {view === "login" ? "Login" : "Create Account"}
              </h1>
              <p className="text-[--mc-text-secondary]">
                {view === "login"
                  ? "Access your rate cards, history, and verification badge"
                  : "Sign up to track and verify your content creator rates"}
              </p>
            </div>

            {/* Toggle tabs */}
            <div className="flex bg-[--mc-bg-elevated] p-1 rounded-xl mb-6">
              <button
                onClick={() => {
                  setView("login");
                  setError("");
                  setSuccessMsg("");
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === "login" ? "bg-[--mc-primary] text-white" : "text-[--mc-text-secondary] hover:text-white"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setView("signup");
                  setError("");
                  setSuccessMsg("");
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === "signup" ? "bg-[--mc-primary] text-white" : "text-[--mc-text-secondary] hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Error & Success Messages */}
            {error && <div className="mc-error-text mb-4 text-center">{error}</div>}
            {successMsg && (
              <div className="glass p-4 rounded-xl text-sm text-[--mc-success] mb-4 text-center">
                ✅ {successMsg}
              </div>
            )}

            {/* LOGIN FORM */}
            {view === "login" && (
              <div className="mc-card p-8 space-y-6">
                <div>
                  <label htmlFor="login-email" className="mc-label">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mc-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="mc-label">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="mc-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="mc-btn mc-btn-primary w-full"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </div>
            )}

            {/* SIGNUP FORM */}
            {view === "signup" && (
              <div className="mc-card p-8 space-y-5">
                <div>
                  <label htmlFor="signup-name" className="mc-label">
                    Full Name <span className="text-[--mc-error]">*</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="e.g. Rohit Sharma"
                    className="mc-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="signup-email" className="mc-label">
                    Email Address <span className="text-[--mc-error]">*</span>
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mc-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="signup-phone" className="mc-label">
                    Phone Number (Optional)
                  </label>
                  <input
                    id="signup-phone"
                    type="tel"
                    placeholder="e.g. +91 9999999999"
                    className="mc-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="mc-label">
                    Password <span className="text-[--mc-error]">*</span>
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    placeholder="Min 6 characters"
                    className="mc-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="signup-niche" className="mc-label">
                      Niche <span className="text-[--mc-error]">*</span>
                    </label>
                    <select
                      id="signup-niche"
                      className="mc-input"
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                    >
                      <option value="">Select Niche</option>
                      {nicheOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="signup-city" className="mc-label">
                      City <span className="text-[--mc-error]">*</span>
                    </label>
                    <select
                      id="signup-city"
                      className="mc-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">Select City</option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleSignUp}
                  disabled={loading}
                  className="mc-btn mc-btn-primary w-full"
                >
                  {loading ? "Registering..." : "Create Account →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── DASHBOARD VIEW ── */}
        {view === "dashboard" && (
          <div className="space-y-8 animate-fade-in opacity-0">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mc-card p-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-3xl font-bold">
                  {profile?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-3">
                    Welcome back, {profile?.name || "Creator"}!
                  </h1>
                  <p className="text-[--mc-text-secondary] text-sm mt-1">
                    Manage details, upload verifications, and view past rate calculations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {profile && getVerificationBadge(profile.verification_tier)}
              </div>
            </div>

            {error && <div className="mc-error-text text-center">{error}</div>}
            {successMsg && (
              <div className="glass p-4 rounded-xl text-sm text-[--mc-success] text-center">
                ✅ {successMsg}
              </div>
            )}

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Details Panel (Col 1) */}
              <div className="mc-card p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[--mc-border] pb-4">
                  <h2 className="font-semibold text-lg">My Details</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-sm text-[--mc-primary-light] hover:underline"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-sm text-[--mc-text-muted] hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div className="space-y-4">
                    <ProfileRow label="Name" value={profile?.name || "—"} />
                    <ProfileRow label="Email" value={profile?.email || "—"} />
                    <ProfileRow label="Phone" value={profile?.phone || "—"} />
                    <ProfileRow label="Niche" value={profile?.niche || "—"} />
                    <ProfileRow
                      label="Location Tier"
                      value={profile?.city_tier?.replace("_", " ").toUpperCase() || "—"}
                    />
                    <ProfileRow
                      label="Engagement Rate"
                      value={profile?.engagement_rate ? `${profile.engagement_rate}%` : "Pending Review"}
                    />
                    <div className="pt-2">
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="mc-btn mc-btn-secondary w-full text-xs py-2"
                      >
                        📷 Upload Verification Screenshot
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mc-label">Full Name</label>
                      <input
                        type="text"
                        className="mc-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mc-label">Phone Number</label>
                      <input
                        type="tel"
                        className="mc-input"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mc-label">Niche</label>
                      <select
                        className="mc-input"
                        value={editNiche}
                        onChange={(e) => setEditNiche(e.target.value)}
                      >
                        {nicheOptions.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mc-label">City</label>
                      <select
                        className="mc-input"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                      >
                        {cityOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleUpdateProfile}
                      disabled={loading}
                      className="mc-btn mc-btn-primary w-full mt-2"
                    >
                      {loading ? "Saving..." : "Save Details"}
                    </button>
                  </div>
                )}
              </div>

              {/* History & Past Activities Panel (Col 2 & 3) */}
              <div className="lg:col-span-2 mc-card p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[--mc-border] pb-4">
                  <h2 className="font-semibold text-lg">Rate Card Calculation History</h2>
                  <a href="/calculate" className="mc-btn mc-btn-primary mc-btn-sm">
                    + Generate New
                  </a>
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="text-4xl block mb-3">📊</span>
                    <p className="text-[--mc-text-secondary] text-sm mb-4">
                      You haven&apos;t saved any rate card calculations yet.
                    </p>
                    <a href="/calculate" className="mc-btn mc-btn-secondary inline-block">
                      Calculate Your First Rate
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((calc) => (
                      <div
                        key={calc.id}
                        className="glass p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[--mc-border-hover] border border-transparent transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white">{calc.creator_name}</span>
                            <span className="text-xs text-[--mc-text-muted]">•</span>
                            <span className="text-xs text-[--mc-text-secondary]">{calc.niche}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[--mc-text-muted] flex-wrap">
                            <span>
                              Calculated on: {new Date(calc.created_at).toLocaleDateString("en-IN")}
                            </span>
                            <span>•</span>
                            <div className="flex gap-2">
                              {calc.platforms.map((p: string) => (
                                <span
                                  key={p}
                                  className="px-1.5 py-0.5 rounded bg-[--mc-bg-elevated] text-[10px] uppercase font-bold"
                                  style={{
                                    color:
                                      p === "instagram"
                                        ? "#E1306C"
                                        : p === "youtube"
                                        ? "#FF0000"
                                        : "#1877F2",
                                  }}
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleViewPastCalculation(calc)}
                          className="mc-btn mc-btn-secondary mc-btn-sm whitespace-nowrap self-start md:self-center"
                        >
                          View Rate Card →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Screenshot Upload Modal */}
      {showUploadModal && profile && (
        <ScreenshotUploadModal
          profileId={profile.id}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            if (userId) loadProfileAndHistory(userId);
          }}
        />
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[--mc-border] last:border-0">
      <span className="text-sm text-[--mc-text-secondary]">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
