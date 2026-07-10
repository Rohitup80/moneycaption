"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { nicheOptions, cityOptions, cityTierMapping } from "@/lib/rate-config";
import ScreenshotUploadModal from "../results/ScreenshotUploadModal";
import Navbar from "@/components/Navbar";

// Untyped client to avoid generics mismatch with current supabase-js version
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreatorProfile = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RateCalculation = Record<string, any>;

type AuthView = "login" | "signup" | "dashboard" | "pending_approval";

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
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [shareCopied, setShareCopied] = useState(false);
  const [instantReviewRequested, setInstantReviewRequested] = useState(false);

  const handleCopyShareLink = () => {
    if (!profile) return;
    const shareUrl = `${window.location.origin}/share/${profile.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  async function handleRequestInstantReview() {
    if (!profile) return;
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/send-approval-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorName: profile.name,
          creatorEmail: profile.email,
          niche: profile.niche,
          city: profile.city || "Not provided",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInstantReviewRequested(true);
        setSuccessMsg("Instant review requested successfully! The administrator has been notified.");
        
        await supabase
          .from("creator_profiles")
          .update({ quick_review_requested: true })
          .eq("id", profile.id);
        
        setProfile((prev: any) => prev ? { ...prev, quick_review_requested: true } : null);
      } else {
        setError(data.error || "Failed to request instant review.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while requesting instant review.");
    } finally {
      setLoading(false);
    }
  }

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
        await linkPastCalculations(session.user.id);
        setUserId(session.user.id);
        setView("dashboard");
        loadProfileAndHistory(session.user.id);
      }
    }
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await linkPastCalculations(session.user.id);
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("view");
      const verified = params.get("verified");
      const emailParam = params.get("email");

      if (verified === "true" && emailParam) {
        setSuccessMsg(`Email ${emailParam} verified successfully! Your profile is pending admin approval.`);
        setView("login");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (mode === "signup") {
        setView("signup");
      } else if (mode === "login") {
        setView("login");
      }
    }
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
        // Enforce creator account approval check
        if (profileData.approval_status === "pending") {
          setProfile(profileData);
          setUserId(uid);
          setView("pending_approval");
          setLoading(false);
          return;
        } else if (profileData.approval_status === "rejected") {
          await supabase.auth.signOut();
          setUserId(null);
          setProfile(null);
          setHistory([]);
          setView("login");
          setError("Your account has been rejected by the admin. You cannot log in.");
          setLoading(false);
          return;
        }

        setProfile(profileData);
        setEditName(profileData.name || "");
        setEditPhone(profileData.phone || "");
        setEditNiche(profileData.niche || "");
        setEditCity(profileData.city || "");
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

      // Load active rate cards from rate_cards table
      if (profileData) {
        const { data: cardsData } = await supabase
          .from("rate_cards")
          .select("*")
          .eq("creator_id", profileData.id);
        if (cardsData) {
          setSavedCards(cardsData);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Helper to link any anonymous calculations stored in sessionStorage
  async function linkPastCalculations(userId: string) {
    const stored = sessionStorage.getItem("mc_calc_input");
    if (!stored) return;
    try {
      const calcData = JSON.parse(stored);
      const { calculateRates } = await import("@/lib/rate-engine");
      const computedRates = calculateRates({
        platforms: {
          instagram: calcData.platforms.includes("instagram") ? calcData.followersInstagram : undefined,
          youtube: calcData.platforms.includes("youtube") ? calcData.followersYoutube : undefined,
          facebook: calcData.platforms.includes("facebook") ? calcData.followersFacebook : undefined,
        },
        niche: calcData.niche,
        cityTier: calcData.cityTier,
        engagementRate: calcData.engagementRate,
        avgViewsInstagram: calcData.avgViewsInstagram ?? null,
        avgViewsYoutube: calcData.avgViewsYoutube ?? null,
        avgViewsFacebook: calcData.avgViewsFacebook ?? null,
      });

      // 1. Save calculation history
      await supabase.from("rate_calculations").insert({
        user_id: userId,
        creator_name: calcData.creatorName,
        niche: calcData.niche,
        city_tier: calcData.cityTier,
        verification_tier: calcData.verificationTier,
        platforms: calcData.platforms,
        followers_instagram: calcData.followersInstagram || null,
        followers_youtube: calcData.followersYoutube || null,
        followers_facebook: calcData.followersFacebook || null,
        engagement_rate: calcData.engagementRate ?? null,
        avg_views_instagram: calcData.avgViewsInstagram || null,
        avg_views_youtube: calcData.avgViewsYoutube || null,
        avg_views_facebook: calcData.avgViewsFacebook || null,
        results_json: computedRates,
      });

      // 2. Resolve creator profile ID
      let profileId = calcData.profileId;
      if (!profileId) {
        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("id")
          .eq("user_id", userId)
          .single();
        if (profile) {
          profileId = profile.id;
        } else {
          // Create baseline profile if not found
          const { data: newProfile } = await supabase
            .from("creator_profiles")
            .insert({
              user_id: userId,
              name: calcData.creatorName,
              niche: calcData.niche,
              city_tier: calcData.cityTier,
              verification_tier: calcData.verificationTier,
              instagram_handle: calcData.handleInstagram || null,
              youtube_handle: calcData.handleYoutube || null,
              facebook_handle: calcData.handleFacebook || null,
              followers_instagram: calcData.followersInstagram || null,
              followers_youtube: calcData.followersYoutube || null,
              followers_facebook: calcData.followersFacebook || null,
            })
            .select("id")
            .single();
          if (newProfile) {
            profileId = newProfile.id;
          }
        }
      }

      // 3. Save rate cards
      if (profileId) {
        const { applyPriceSelection, flattenForDatabase } = await import("@/lib/rate-engine");
        const selections: Record<string, "marketStandard"> = {};
        computedRates.forEach((platform) => {
          platform.deliverables.forEach((d) => {
            selections[d.id] = "marketStandard";
          });
        });
        const resultsWithSelections = applyPriceSelection(computedRates, selections);
        const rows = flattenForDatabase(profileId, resultsWithSelections);
        await supabase.from("rate_cards").upsert(rows);
      }

      // Clear after linking
      sessionStorage.removeItem("mc_calc_input");
    } catch (linkErr) {
      console.error("Failed to link past calculation:", linkErr);
    }
  }

  // Request quick review from admin for uploaded screenshot
  async function handleRequestQuickReview() {
    if (!profile) return;
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({ quick_review_requested: true })
        .eq("id", profile.id);

      if (error) throw error;
      setSuccessMsg("Quick review requested! Admin has been notified.");
      if (userId) loadProfileAndHistory(userId);
    } catch (err) {
      console.error("Failed to request quick review:", err);
      setError("Failed to request quick review. Please try again.");
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

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address with a domain (e.g. you@example.com).");
      return;
    }

    // Phone number length check
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        setError("Phone number must contain exactly 10 digits.");
        return;
      }
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      // 0. Prevent multi-signup on a single email ID
      const { data: existingProfile } = await supabase
        .from("creator_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        setError("An account with this email address already exists.");
        setLoading(false);
        return;
      }

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
          approval_status: "pending", // New creator pending admin approval
        });

      if (profileError) {
        console.error("Failed to insert profile row:", profileError);
      }

      // 3. Send simulated verification email
      try {
        await fetch("/api/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name: fullName }),
        });
      } catch (mailErr) {
        console.error("Verification email simulation error:", mailErr);
      }

      setSuccessMsg("Registration successful! A simulated verification link has been sent. Check your console logs.");
      setTimeout(() => {
        setView("login");
      }, 4500);
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
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Enforce email verification check
      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
      }

      // Check account approval status
      if (data.user) {
        const { data: profileData, error: profileErr } = await supabase
          .from("creator_profiles")
          .select("approval_status")
          .eq("user_id", data.user.id)
          .single();

        if (profileErr) {
          console.error("Error loading profile status during login:", profileErr);
        } else if (profileData) {
          if (profileData.approval_status === "pending") {
            await supabase.auth.signOut();
            throw new Error("Your account is pending verification. The admin will review it shortly.");
          } else if (profileData.approval_status === "rejected") {
            await supabase.auth.signOut();
            throw new Error("Your account has been rejected by the admin. You cannot log in.");
          }
        }
      }

      setSuccessMsg("Logged in successfully!");
      if (data.user) {
        // Link any session storage calculations to their newly logged in profile
        await linkPastCalculations(data.user.id);
        setUserId(data.user.id);
        setView("dashboard");
        loadProfileAndHistory(data.user.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Email OTP / Magic Link Login ──
  async function handleLoginWithMagicLink() {
    if (!email) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + "/profile",
        },
      });

      if (authError) throw authError;

      setSuccessMsg("Check your email for a magic link to sign in!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Magic link request failed.";
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
          city: editCity,
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
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* ── AUTH VIEWS ── */}
        {(view === "login" || view === "signup") && (
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
                  view === "login" ? "bg-[--mc-primary] text-white" : "text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
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
                  view === "signup" ? "bg-[--mc-primary] text-white" : "text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
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
              <div className="mc-card p-8 space-y-5">
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
                    placeholder="Enter your password"
                    className="mc-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="mc-btn mc-btn-primary w-full"
                  >
                    {loading ? "Logging in..." : "Login →"}
                  </button>
                  <button
                    onClick={handleLoginWithMagicLink}
                    disabled={loading}
                    className="mc-btn mc-btn-secondary w-full text-xs py-2"
                  >
                    {loading ? "Requesting..." : "Or Sign In with Magic Link"}
                  </button>
                </div>
                <div className="text-center pt-2 border-t border-[--mc-border]">
                  <span className="text-xs text-[--mc-text-secondary]">New user? </span>
                  <button
                    onClick={() => {
                      setView("signup");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-semibold text-[--mc-primary] hover:text-[--mc-primary-dark] hover:underline"
                  >
                    Create an account
                  </button>
                </div>
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
                          {n.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
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
                <div className="text-center pt-2 border-t border-[--mc-border]">
                  <span className="text-xs text-[--mc-text-secondary]">Already have an account? </span>
                  <button
                    onClick={() => {
                      setView("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-semibold text-[--mc-primary] hover:text-[--mc-primary-dark] hover:underline"
                  >
                    Log In
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PENDING VERIFICATION VIEW ── */}
        {view === "pending_approval" && (
          <div className="max-w-md mx-auto py-12">
            <div className="mc-card p-8 space-y-6 text-center">
              <div className="text-5xl animate-pulse">⏳</div>
              <h2 className="text-2xl font-bold text-[--mc-text-primary]">Account Pending Verification</h2>
              <p className="text-sm text-[--mc-text-secondary] leading-relaxed">
                Hi <strong className="text-[--mc-primary]">{profile?.name}</strong>, your creator profile is currently pending administrator verification.
              </p>
              <p className="text-xs text-[--mc-text-muted]">
                We verify handles and follower data for all creators to ensure baseline CPM standards. This review typically takes less than 24 hours.
              </p>

              {successMsg && (
                <div className="glass p-4 rounded-xl text-sm text-[--mc-success] text-center">
                  ✅ {successMsg}
                </div>
              )}
              {error && (
                <div className="mc-error-text text-sm text-center">
                  ❌ {error}
                </div>
              )}

              <div className="space-y-3 pt-2">
                {profile?.quick_review_requested || instantReviewRequested ? (
                  <div className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/10 rounded-xl py-3 px-4 text-xs font-semibold animate-pulse">
                    🚀 Instant Review Alert Sent to Administrator!
                  </div>
                ) : (
                  <button
                    onClick={handleRequestInstantReview}
                    disabled={loading}
                    className="mc-btn mc-btn-primary w-full flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? "Sending Notification..." : "⚡ Request Instant Review"}
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="mc-btn mc-btn-secondary w-full cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
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
                    <ProfileRow
                      label="Niche"
                      value={profile?.niche ? profile.niche.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : "—"}
                    />
                    <ProfileRow label="City" value={profile?.city || "—"} />
                    <ProfileRow
                      label="Location Tier"
                      value={profile?.city_tier?.replace("_", " ").toUpperCase() || "—"}
                    />
                    <ProfileRow
                      label="Engagement Rate"
                      value={profile?.engagement_rate ? `${profile.engagement_rate}%` : "Pending Review"}
                    />

                    {/* Social Handles & Stats */}
                    {profile?.instagram_handle && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 text-left space-y-1">
                        <p className="text-xs font-semibold text-[--mc-text-secondary]">📸 Instagram</p>
                        <ProfileRow label="Handle" value={`@${profile.instagram_handle.replace(/^@/, "")}`} />
                        {profile.followers_instagram !== null && profile.followers_instagram !== undefined && (
                          <ProfileRow label="Followers" value={profile.followers_instagram.toLocaleString("en-IN")} />
                        )}
                      </div>
                    )}
                    {profile?.youtube_handle && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 text-left space-y-1">
                        <p className="text-xs font-semibold text-[--mc-text-secondary]">🎬 YouTube</p>
                        <ProfileRow label="Channel" value={`@${profile.youtube_handle.replace(/^@/, "")}`} />
                        {profile.followers_youtube !== null && profile.followers_youtube !== undefined && (
                          <ProfileRow label="Subscribers" value={profile.followers_youtube.toLocaleString("en-IN")} />
                        )}
                      </div>
                    )}
                    {profile?.facebook_handle && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 text-left space-y-1">
                        <p className="text-xs font-semibold text-[--mc-text-secondary]">📘 Facebook</p>
                        <ProfileRow label="Page" value={profile.facebook_handle} />
                        {profile.followers_facebook !== null && profile.followers_facebook !== undefined && (
                          <ProfileRow label="Followers" value={profile.followers_facebook.toLocaleString("en-IN")} />
                        )}
                      </div>
                    )}

                    {profile?.screenshot_url && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 space-y-2 text-left">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[--mc-text-secondary]">Screenshot Review:</span>
                          {profile.screenshot_status === "approved" ? (
                            <span className="text-[--mc-success] font-bold">✓ Approved</span>
                          ) : profile.screenshot_status === "rejected" ? (
                            <span className="text-[--mc-error] font-bold">❌ Rejected</span>
                          ) : (
                            <span className="text-[--mc-warning] font-bold">⏳ Pending Review</span>
                          )}
                        </div>
                        {profile.screenshot_status === "pending" && !profile.quick_review_requested && (
                          <button
                            onClick={handleRequestQuickReview}
                            disabled={loading}
                            className="mc-btn mc-btn-secondary w-full text-[10px] py-1 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer"
                          >
                            ⚡ Request Quick Review
                          </button>
                        )}
                        {profile.screenshot_status === "pending" && profile.quick_review_requested && (
                          <p className="text-[10px] text-center text-red-400 font-semibold animate-pulse">
                            ⚡ Quick review requested!
                          </p>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="mc-btn mc-btn-secondary w-full text-xs py-2 cursor-pointer"
                      >
                        {profile?.screenshot_url ? "📷 Upload New Screenshot" : "📷 Upload Verification Screenshot"}
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
                            {n.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
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

              {/* History & Saved Rates Panel (Col 2 & 3) */}
              <div className="lg:col-span-2 space-y-8">
                {/* Active Saved Rates Card */}
                <div className="mc-card p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[--mc-border] pb-4">
                    <div>
                      <h2 className="font-semibold text-lg text-left">My Saved Rate Cards</h2>
                      <p className="text-xs text-[--mc-text-secondary] mt-1 text-left">
                        These are your saved deliverable prices verified on your profile.
                      </p>
                    </div>
                    {profile && (
                      <div className="flex items-center gap-2 self-start sm:self-auto relative">
                        <button
                          onClick={handleCopyShareLink}
                          className="mc-btn mc-btn-primary mc-btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                        >
                          🔗 Copy Share Link
                        </button>
                        {shareCopied && (
                          <span className="absolute -top-9 right-0 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-fade-in whitespace-nowrap">
                            Copied to clipboard! 📋
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {savedCards.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-[--mc-text-secondary] text-sm">
                        No active rate cards saved. Run a calculation and download the PDF to save your pricing.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(
                        savedCards.reduce((acc: any, card: any) => {
                          if (!acc[card.platform]) {
                            acc[card.platform] = [];
                          }
                          acc[card.platform].push(card);
                          return acc;
                        }, {})
                      ).map(([platform, cards]: [string, any]) => (
                        <div key={platform} className="glass p-4 rounded-xl space-y-3 text-left">
                          <h3 className="font-semibold text-sm flex items-center gap-2 capitalize">
                            {platform === "instagram" ? "📸" : platform === "youtube" ? "🎬" : "📘"} {platform}
                          </h3>
                          <div className="space-y-2">
                            {cards.map((card: any) => (
                              <div key={card.id} className="flex justify-between items-center text-xs py-1 border-b border-[--mc-border] last:border-0">
                                <span className="text-[--mc-text-secondary] capitalize">
                                  {card.deliverable_type.replace(/_/g, " ").replace(platform, "").trim()}
                                </span>
                                <span className="font-bold text-[--mc-success]">
                                  ₹{parseFloat(card.calculated_rate_median).toLocaleString("en-IN")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Calculations History Card */}
                <div className="mc-card p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-[--mc-border] pb-4">
                    <h2 className="font-semibold text-lg">Rate Card Calculation History</h2>
                    <a href="/calculate" className="mc-btn mc-btn-primary mc-btn-sm cursor-pointer">
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
                            <span className="text-xs text-[--mc-text-secondary]">{calc.niche.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
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
